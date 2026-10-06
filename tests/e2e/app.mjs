// Application mobile : l'interface de app/www (copie du site + couche app) dans un téléphone simulé.
// Vérifie : appels au serveur depuis l'origine de l'app (CORS), paiement Stripe dans la fenêtre sécurisée,
// retour par lallat://retour, partage natif, et que le site lui-même n'est pas modifié.
// Usage : node tests/e2e/app.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { environnement, navigateur, contexte, BASE, racine } from './outils.mjs';
import { demarrerStripeMock } from './stripe-mock.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const MDP = 'Demo-Lalla-2026';
const plus = (j) => new Date(Date.now() + j * 86400000).toISOString().slice(0, 10);

const mock = await demarrerStripeMock({ webhookUrl: `${BASE}/api/webhook`, secret: 'whsec_local_test' });
const env = await environnement({ stripeMock: mock.base });
const q = async (sql, p = []) => (await env.pile.pool.query(sql, p)).rows;
const { seed } = await import('../../scripts/seed-demo.mjs');
await seed();

// Interface de l'app construite contre le serveur local, servie comme le ferait l'app Android (http://localhost)
execFileSync('node', [path.join(racine, 'app/scripts/construire.mjs'), BASE], { stdio: 'inherit' });
const www = path.join(racine, 'app/www');
const TYPES = { html: 'text/html; charset=utf-8', js: 'application/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', json: 'application/json' };
const serveurApp = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const fichier = path.join(www, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier).slice(1)] || 'application/octet-stream' });
    res.end(corps);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => serveurApp.listen(80, r));
const APP = 'http://localhost';

let echec = false;
try {
  console.log('▶ Préparation : réservation instantanée à payer');
  const [tn] = await q(`select t.id from tenues t where t.statut = 'validee' and t.categorie <> 'accessoire' and t.remise_main_propre and t.duree_min_jours <= 2 and t.duree_max_jours >= 2 limit 1`);
  await q(`update tenues set reservation_instantanee = true where id = $1`, [tn.id]);
  const jeton = (await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cliente1@demo.lalla.be', password: MDP }) })).json()).access_token;
  const r = await (await fetch(`${BASE}/api/v1/commande-creer`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` }, body: JSON.stringify({ articles: [{ tenue_id: tn.id, mode_remise: 'main_propre' }], evenement: plus(15), debut: plus(14), fin: plus(16) }) })).json();
  assert.equal(r.statut, 'a_payer');
  ok('commande à payer');

  const b = await navigateur();
  const ctx = await contexte(b, { largeur: 390, hauteur: 844, mobile: true });
  // Supabase autorise toutes les origines ; la pile locale non : on ajoute ces en-têtes hors /api (l'API répond elle-même)
  await ctx.route(new RegExp(`^${BASE}/(?!api/)`), async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': APP, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const rep = await route.fetch();
    return route.fulfill({ response: rep, headers: { ...rep.headers(), ...cors } });
  });
  const appels = [];
  await ctx.exposeFunction('__appel', (nom, arg) => appels.push({ nom, arg }));
  await ctx.addInitScript(() => {
    const ecouteurs = {};
    window.__ecouteurs = ecouteurs;
    const plugin = (nom) => new Proxy({}, { get: (_, m) => (...a) => {
      if (m === 'addListener') { (ecouteurs[nom + '.' + a[0]] = ecouteurs[nom + '.' + a[0]] || []).push(a[1]); return Promise.resolve({ remove() {} }); }
      window.__appel(nom + '.' + String(m), JSON.stringify(a[0] || null));
      return Promise.resolve({});
    } });
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: Object.fromEntries(['StatusBar', 'App', 'Haptics', 'Share', 'Browser'].map((n) => [n, plugin(n)])) };
  });
  const page = await ctx.newPage();

  console.log('▶ Interface de l\'app : accueil, connexion');
  await page.goto(`${APP}/index.html`, { waitUntil: 'networkidle' });
  assert.match(await page.evaluate(() => document.documentElement.className), /est-app/);
  await page.goto(`${APP}/compte.html?connexion=1`);
  await page.waitForSelector('.modale.est-ouverte input[name=email]');
  await page.fill('.modale input[name=email]', 'cliente1@demo.lalla.be');
  await page.fill('.modale input[name=mdp]', MDP);
  await page.click('.modale button[type=submit]');
  await page.waitForSelector('.modale', { state: 'detached' });
  ok('interface embarquée chargée, connexion Supabase depuis l\'app');

  console.log('▶ Paiement : fenêtre Stripe sécurisée puis retour lallat://');
  await page.goto(`${APP}/panier.html?commande=${r.commande_id}`);
  await page.click('button:has-text("Payer")');
  await page.waitForFunction(() => true);
  for (let i = 0; i < 40 && !appels.some((a) => a.nom === 'Browser.open'); i++) await new Promise((x) => setTimeout(x, 100));
  const ouverture = appels.find((a) => a.nom === 'Browser.open');
  assert.ok(ouverture, 'Stripe ouvert dans la fenêtre sécurisée');
  const urlStripe = JSON.parse(ouverture.arg).url;
  const session = mock.etat.objets.get(urlStripe.split('/').pop());
  assert.equal(session.success_url, `${BASE}/api/retour-app?etat=ok`, 'retour Stripe vers l\'app');
  assert.match(page.url(), /panier\.html\?commande=/, 'l\'app reste sur sa page');
  await fetch(`${mock.base}/checkout/${session.id}/payer`, { method: 'POST', redirect: 'manual' });
  const retour = await (await fetch(`${BASE}/api/retour-app?etat=ok`)).text();
  assert.ok(retour.includes('lallat://retour?etat=ok'));
  await page.evaluate(() => window.__ecouteurs['App.appUrlOpen'].forEach((f) => f({ url: 'lallat://retour?etat=ok' })));
  await page.waitForURL(/paiement=ok/);
  await page.waitForSelector('text=Tout est prêt', { timeout: 20000 });
  assert.equal((await q(`select statut from commandes where id = $1`, [r.commande_id]))[0].statut, 'payee');
  assert.ok(appels.some((a) => a.nom === 'Browser.close'), 'fenêtre Stripe refermée');
  ok('paiement dans la fenêtre Stripe, retour automatique dans l\'app, commande payée');

  console.log('▶ Partage natif d\'une tenue');
  await page.goto(`${APP}/tenue.html?id=${tn.id}`, { waitUntil: 'networkidle' });
  await page.click('.bouton--whatsapp');
  for (let i = 0; i < 20 && !appels.some((a) => a.nom === 'Share.share'); i++) await new Promise((x) => setTimeout(x, 100));
  const partage = appels.find((a) => a.nom === 'Share.share');
  assert.ok(partage && JSON.parse(partage.arg).text.includes(`${BASE}/t/${tn.id}`), 'lien public du site dans le partage');
  ok('feuille de partage du téléphone, avec le lien public de la tenue');

  console.log('▶ Le site n\'est pas modifié');
  const siteApp = await (await fetch(`${BASE}/assets/app.js`)).text();
  assert.ok(!siteApp.includes('LALLAT_SITE') && !siteApp.includes('Capacitor'), 'aucune trace de l\'app dans le site');
  const accueil = await (await fetch(`${BASE}/index.html`)).text();
  assert.ok(!accueil.includes('natif'), 'pages du site intactes');
  ok('site intact : la couche app n\'existe que dans app/www');

  assert.deepEqual(ctx.erreurs, [], 'aucune erreur console');
  ok('zéro erreur console');
  await b.close();
} catch (e) {
  echec = true;
  console.error('\n✗ ÉCHEC :', e.message);
}
serveurApp.close();
await env.arreter();
mock.arreter();
console.log(echec ? '\nÉCHEC — app' : '\nSUCCÈS — app');
process.exit(echec ? 1 : 0);
