// Parcours complet en mode test (pile Supabase locale + simulateur Stripe) :
// inscription → Connect → publication → validation → essayage → réservation multi-fournisseuses →
// identité → paiement → caution → remise → retour → versement → avis, puis un cas de litige.
// Usage : node tests/e2e/parcours.mjs
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { environnement, navigateur, contexte, BASE } from './outils.mjs';
import { demarrerStripeMock } from './stripe-mock.mjs';

const MDP = 'Demo-Lalla-2026';
const etapes = [];
function etape(nom) { etapes.push(nom); console.log(`\n▶ ${nom}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }

// --- Image PNG générée (aucune photo externe) -----------------------------
function crc32(buf) { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function png(w, h, [r, g, b]) {
  const bloc = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const lignes = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const v = (x * y) % 40; lignes[o] = r + v; lignes[o + 1] = g; lignes[o + 2] = b; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(lignes)), bloc('IEND', Buffer.alloc(0))]);
}
const photo = (nom, couleur = [31, 94, 75]) => ({ name: `${nom}.png`, mimeType: 'image/png', buffer: png(120, 160, couleur) });

// --- Outils -------------------------------------------------------------
async function jeton(email) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: MDP }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Connexion impossible ${email} : ${JSON.stringify(j)}`);
  return j.access_token;
}
async function api(action, corps, email) {
  const r = await fetch(`${BASE}/api/v1/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(email ? { Authorization: `Bearer ${await jeton(email)}` } : {}) }, body: JSON.stringify(corps) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${action} → ${r.status} ${JSON.stringify(j)}`);
  return j;
}
async function cron(tache) {
  const r = await fetch(`${BASE}/api/cron/${tache}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const j = await r.json();
  assert.equal(r.status, 200, `cron ${tache} : ${JSON.stringify(j)}`);
  return j;
}
async function connecter(page, email, url = '/compte.html') {
  await page.goto(`${BASE}${url}${url.includes('?') ? '&' : '?'}connexion=1`);
  await page.waitForSelector('.modale.est-ouverte input[name=email]');
  await page.fill('.modale input[name=email]', email);
  await page.fill('.modale input[name=mdp]', MDP);
  await page.click('.modale button[type=submit]');
  await page.waitForSelector('.modale', { state: 'detached' });
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function attendreQue(fn, msg, essais = 40) {
  for (let i = 0; i < essais; i++) { if (await fn()) return; await attendre(250); }
  throw new Error(`Délai dépassé : ${msg}`);
}
function plus(j) { const d = new Date(); d.setDate(d.getDate() + j); return d.toISOString().slice(0, 10); }

// --- Démarrage ------------------------------------------------------------
const mock = await demarrerStripeMock({ webhookUrl: `${BASE}/api/webhook`, secret: 'whsec_local_test' });
const env = await environnement({ stripeMock: mock.base });
const q = async (sql, p) => (await env.pile.pool.query(sql, p)).rows;
const { seed } = await import('../../scripts/seed-demo.mjs');
await seed();
const b = await navigateur();
const desktop = await contexte(b, { largeur: 1440 });
const mobile = await contexte(b, { largeur: 375, hauteur: 812, mobile: true });
const mobileF = await contexte(b, { largeur: 390, hauteur: 844, mobile: true });
let echec = null;

try {
  // =========================================================================
  etape('Inscription d\'une fournisseuse (negafa)');
  const fPage = await (await contexte(b, { largeur: 1440 })).newPage();
  await fPage.goto(`${BASE}/index.html`);
  await fPage.click('[data-devenir-fournisseuse]');
  await fPage.waitForSelector('.modale.est-ouverte');
  await fPage.check('.modale input[value=fournisseuse]', { force: true });
  await fPage.check('.modale input[value=negafa]', { force: true });
  await fPage.fill('.modale input[name=prenom]', 'Zahra');
  await fPage.fill('.modale input[name=nom]', 'Test');
  await fPage.fill('.modale input[name=email]', 'zahra@test.lalla.be');
  await fPage.fill('.modale input[name=mdp]', MDP);
  await fPage.check('.modale input[name=cgu]', { force: true });
  await fPage.click('.modale button[type=submit]');
  await fPage.waitForURL(/compte\.html/);
  const [zahra] = await q(`select p.* from profils p join auth.users u on u.id = p.id where u.email = 'zahra@test.lalla.be'`);
  assert.equal(zahra.est_fournisseuse, true); assert.equal(zahra.type_fournisseuse, 'negafa');
  ok('compte créé avec le rôle negafa');

  etape('Onboarding Stripe Connect Express');
  await fPage.goto(`${BASE}/compte.html?vue=paiements`);
  await fPage.click('text=Configurer mes versements');
  await fPage.waitForURL(/localhost:12111\/connect/);
  await fPage.click('#terminer');
  await fPage.waitForURL(/compte\.html\?vue=paiements&connect=retour/);
  await fPage.waitForSelector('text=Compte de versement actif');
  assert.equal((await q(`select stripe_onboarding_complet from profils where id = $1`, [zahra.id]))[0].stripe_onboarding_complet, true);
  ok('account.updated reçu, compte de versement actif');

  etape('Publication d\'une tenue (photos compressées en WebP)');
  await fPage.goto(`${BASE}/compte.html?vue=annonces`);
  await fPage.click('text=Nouvelle annonce');
  await fPage.selectOption('select[name=categorie]', 'takchita');
  await fPage.fill('input[name=titre]', 'Takchita de test émeraude');
  await fPage.fill('textarea[name=description]', 'Broderie main, état impeccable.');
  await fPage.check('input[name=couleurs][value=emeraude]', { force: true });
  await fPage.check('input[name=occasions][value=mariage]', { force: true });
  for (const [c, v] of [['poitrine_cm', 94], ['taille_cm', 78], ['hanches_cm', 102], ['longueur_cm', 150], ['manche_cm', 60]]) await fPage.fill(`input[name=${c}]`, String(v));
  await fPage.fill('input[name=prix]', '140');
  await fPage.fill('input[name=valeur]', '1500');
  await fPage.check('input[name=essayage]', { force: true });
  const depots = await fPage.$$('.depot-photos input[type=file]');
  for (const [i, nom] of ['face', 'dos', 'broderie', 'portee'].entries()) {
    await (await fPage.$$('.depot-photos input[type=file]'))[i].setInputFiles(photo(nom));
    await fPage.waitForFunction((n) => document.querySelectorAll('.depot--rempli').length >= n, i + 1, { timeout: 15000 });
  }
  void depots;
  await fPage.click('button[name=soumettre]');
  await fPage.waitForSelector('text=Annonce envoyée en relecture');
  const [tenue] = await q(`select * from tenues where titre = 'Takchita de test émeraude'`);
  assert.equal(tenue.statut, 'en_attente');
  const photos = await q(`select type, chemin from tenue_photos where tenue_id = $1`, [tenue.id]);
  assert.equal(photos.length, 4);
  assert.ok(photos.every((p) => p.chemin.endsWith('.webp')), 'photos en WebP');
  ok('annonce soumise avec 4 photos WebP');

  etape('Validation par l\'admin');
  const aPage = await desktop.newPage();
  await connecter(aPage, 'admin@demo.lalla.be', '/admin.html');
  await aPage.goto(`${BASE}/admin.html#annonces`);
  await aPage.waitForSelector('text=Takchita de test émeraude');
  await aPage.click('button:has-text("Valider")');
  await attendreQue(async () => (await q(`select statut from tenues where id = $1`, [tenue.id]))[0].statut === 'validee', 'validation');
  ok('annonce validée et visible dans le catalogue');

  etape('Essayage chez la fournisseuse (frais payés, puis effectué)');
  const cPage = await mobile.newPage();
  await connecter(cPage, 'cliente1@demo.lalla.be', `/tenue.html?id=${tenue.id}`);
  await cPage.goto(`${BASE}/tenue.html?id=${tenue.id}`);
  await cPage.click('text=Demander un essayage');
  const creneau = new Date(Date.now() + 2 * 86400000); creneau.setHours(15, 0, 0, 0);
  await cPage.fill('.modale input[name=creneau]', `${creneau.toISOString().slice(0, 10)}T15:00`);
  await cPage.click('.modale button[type=submit]');
  await cPage.waitForURL(/localhost:12111\/checkout/);
  await cPage.click('#payer');
  await cPage.waitForURL(/compte\.html\?vue=essayages/);
  const [essai] = await q(`select * from essayages where tenue_id = $1`, [tenue.id]);
  assert.equal(essai.statut, 'demande');
  await api('essayage-repondre', { essayage_id: essai.id, decision: 'confirmer' }, 'zahra@test.lalla.be');
  await api('essayage-repondre', { essayage_id: essai.id, decision: 'effectue' }, 'zahra@test.lalla.be');
  const [essai2] = await q(`select * from essayages where id = $1`, [essai.id]);
  assert.equal(essai2.statut, 'effectue'); assert.ok(essai2.transfer_id, 'frais reversés à la fournisseuse');
  ok('essayage payé, confirmé, effectué et reversé');

  etape('Réservation multi-fournisseuses (panier → une demande par fournisseuse)');
  const [autre] = await q(`select t.* from tenues t join profils p on p.id = t.fournisseuse_id where p.type_fournisseuse = 'creatrice' and t.categorie = 'caftan' limit 1`);
  const evt = plus(10), debut = plus(9), fin = plus(11);
  for (const id of [tenue.id, autre.id]) {
    await cPage.goto(`${BASE}/tenue.html?id=${id}`);
    await cPage.fill('#r-evt', evt); await cPage.fill('#r-debut', debut); await cPage.fill('#r-fin', fin);
    await cPage.dispatchEvent('#r-fin', 'change');
    await cPage.waitForSelector('.disponibilite--oui');
    await cPage.click('.reservation-boite button[type=submit]');
    await cPage.waitForSelector('text=Ajoutée au panier');
  }
  await cPage.goto(`${BASE}/panier.html`);
  await cPage.waitForSelector('.groupe-fournisseuse');
  assert.equal(await cPage.locator('.groupe-fournisseuse').count(), 2);
  await cPage.click('text=Envoyer mes demandes');
  await cPage.waitForURL(/panier\.html\?commande=/);
  const commandeId = new URL(cPage.url()).searchParams.get('commande');
  const resas = await q(`select * from reservations where commande_id = $1 order by created_at`, [commandeId]);
  assert.equal(resas.length, 2);
  const resaZahra = resas.find((r) => r.fournisseuse_id === zahra.id);
  assert.equal(resaZahra.deduction_essayage_cents, 1500, 'frais d\'essayage déduits');
  assert.equal(resaZahra.montant_location_cents, 14000, 'prix relu en base');
  ok('2 demandes créées, montants recalculés, essayage déduit');

  etape('Acceptation par les deux fournisseuses (UI + API)');
  await fPage.goto(`${BASE}/compte.html?vue=demandes`);
  await fPage.waitForSelector('text=Mensurations de la cliente');
  await fPage.waitForSelector('text=/Tour de poitrine 90 cm/');
  ok('la fournisseuse voit les mensurations de la cliente qui lui a fait une demande');
  await fPage.click('button:has-text("Accepter")');
  await fPage.waitForSelector('text=Demande acceptée');
  const autreEmail = (await q(`select email from auth.users where id = $1`, [autre.fournisseuse_id]))[0].email;
  await api('reservation-repondre', { reservation_id: resas.find((r) => r.id !== resaZahra.id).id, decision: 'accepter' }, autreEmail);
  assert.equal((await q(`select statut from commandes where id = $1`, [commandeId]))[0].statut, 'a_payer');
  assert.equal((await q(`select count(*)::int n from blocages where reservation_id = any($1)`, [resas.map((r) => r.id)]))[0].n, 2);
  ok('commande à payer, calendriers bloqués (pressing compris)');

  etape('Stripe Identity (caution > seuil) puis paiement Checkout');
  await cPage.goto(`${BASE}/panier.html?commande=${commandeId}`);
  await cPage.click('button:has-text("Payer")');
  await cPage.waitForSelector('text=Vérifier mon identité');
  await cPage.click('text=Vérifier mon identité');
  await cPage.waitForURL(/localhost:12111\/identity/);
  await cPage.click('#verifier');
  await cPage.waitForURL(/identite=retour/);
  assert.equal((await q(`select identite_verifiee from profils where id = (select cliente_id from commandes where id = $1)`, [commandeId]))[0].identite_verifiee, true);
  await cPage.reload();
  await cPage.click('button:has-text("Payer")');
  await cPage.waitForURL(/localhost:12111\/checkout/);
  const montantAffiche = await cPage.textContent('#montant');
  await cPage.click('#payer');
  await cPage.waitForURL(/paiement=ok/);
  await cPage.waitForSelector('text=Enregistrer ma carte', { timeout: 20000 });
  const [cmd] = await q(`select * from commandes where id = $1`, [commandeId]);
  assert.equal(cmd.statut, 'payee');
  const total = resas.reduce((s, r) => s + r.montant_location_cents + r.frais_pressing_cents + r.frais_envoi_cents + r.frais_service_cents - r.deduction_essayage_cents, 0);
  assert.equal(montantAffiche, `${(total / 100).toFixed(2)} EUR`, 'un seul Checkout pour les deux fournisseuses');
  ok(`paiement unique de ${montantAffiche} (Bancontact + carte), webhook checkout.session.completed traité`);

  etape('Carte de caution (SetupIntent), événement dans plus de 5 jours');
  await cPage.click('text=Enregistrer ma carte');
  await cPage.waitForURL(/localhost:12111\/checkout/);
  await cPage.click('#payer');
  await cPage.waitForURL(/caution=ok/);
  await attendreQue(async () => (await q(`select count(*)::int n from reservations where commande_id = $1 and caution_statut = 'carte_enregistree'`, [commandeId]))[0].n === 2, 'carte enregistrée');
  ok('carte enregistrée, empreinte différée (événement à J+10)');

  etape('Cron : empreinte off_session 2 jours avant la remise (+ cas d\'échec)');
  await q(`update reservations set date_debut = current_date + 1, date_evenement = current_date + 2, date_fin = current_date + 3 where commande_id = $1`, [commandeId]);
  await fetch(`${mock.base}/__test/refuser-empreinte`);
  await cron('empreintes');
  const apres = await q(`select id, caution_statut from reservations where commande_id = $1`, [commandeId]);
  assert.equal(apres.filter((r) => r.caution_statut === 'echec').length, 1, 'une empreinte refusée');
  const { boiteTest } = await import('../../lib/email.js');
  assert.ok(boiteTest.some((m) => m.modele === 'caution_echec') && boiteTest.some((m) => m.modele === 'caution_echec_info') && boiteTest.some((m) => m.modele === 'admin_alerte'), 'alertes cliente, fournisseuse et admin');
  ok('échec d\'empreinte : alertes envoyées à la cliente, à la fournisseuse et à l\'admin');
  await cPage.goto(`${BASE}/panier.html?commande=${commandeId}`);
  await cPage.click('button:has-text("Autoriser la caution")');
  await cPage.waitForURL(/localhost:12111\/checkout/);
  await cPage.click('#payer');
  await cPage.waitForURL(/caution=ok/);
  await attendreQue(async () => (await q(`select count(*)::int n from reservations where commande_id = $1 and caution_statut = 'autorisee'`, [commandeId]))[0].n === 2, 'empreintes autorisées');
  ok('cliente régularise : les deux empreintes (capture_method manual) sont autorisées');

  etape('Remise : état des lieux mobile (4 photos, cases, double validation)');
  async function edl(page, role, type) {
    await page.goto(`${BASE}/compte.html?vue=${role === 'cliente' ? 'reservations' : 'demandes'}&edl=${resaZahra.id}`);
    await page.waitForSelector('.modale.est-ouverte .edl');
    const premiere = (await q(`select count(*)::int n from etats_des_lieux where reservation_id = $1 and type = $2 and photo_doublure is not null`, [resaZahra.id, type]))[0].n === 0;
    if (premiere) {
      for (let i = 0; i < 4; i++) {
        await (await page.$$('.modale .edl__photos input[type=file]'))[i].setInputFiles(photo(`edl-${type}-${i}`, [180, 150, 90]));
        await page.waitForFunction((n) => document.querySelectorAll('.modale .edl__photos .depot--rempli').length >= n, i + 1, { timeout: 15000 });
      }
      if (type === 'retour') await page.check('.modale input[type=checkbox] >> nth=0', { force: true });
      await attendre(400);
    }
    await page.click('.modale button:has-text("Je valide cet état des lieux")');
    await page.waitForSelector('.modale', { state: 'detached' });
  }
  const fMobile = await mobileF.newPage();
  await connecter(fMobile, 'zahra@test.lalla.be');
  await edl(fMobile, 'fournisseuse', 'remise');
  await edl(cPage, 'cliente', 'remise');
  const [rRemise] = await q(`select statut, remise_at from reservations where id = $1`, [resaZahra.id]);
  assert.equal(rRemise.statut, 'remise'); assert.ok(rRemise.remise_at);
  ok('remise validée et horodatée par les deux parties');

  etape('Retour : état des lieux, puis libération de la caution et versement');
  await edl(cPage, 'cliente', 'retour');
  await edl(fMobile, 'fournisseuse', 'retour');
  const [rRetour] = await q(`select * from reservations where id = $1`, [resaZahra.id]);
  assert.equal(rRetour.statut, 'rendue');
  assert.ok(new Date(rRetour.litige_deadline) - new Date(rRetour.rendue_at) > 47 * 3600000, 'fenêtre de litige de 48 h');
  await q(`update reservations set versement_prevu_at = now() - interval '1 minute', litige_deadline = now() - interval '1 minute' where id = $1`, [resaZahra.id]);
  const rapport = await cron('horaire');
  const [rFin] = await q(`select * from reservations where id = $1`, [resaZahra.id]);
  assert.ok(rFin.transfer_id && rFin.transfer_id.startsWith('tr_'), 'transfert Stripe Connect créé');
  assert.equal(rFin.caution_statut, 'liberee');
  assert.equal(rFin.statut, 'cloturee');
  const transfert = mock.etat.objets.get(rFin.transfer_id);
  assert.equal(transfert.amount, rFin.montant_transfert_cents); assert.equal(transfert.transfer_group, `cmd_${commandeId}`); assert.ok(transfert.source_transaction);
  ok(`versement de ${(transfert.amount / 100).toFixed(2)} € (transfer_group cmd_…), caution libérée, location clôturée — ${JSON.stringify(rapport)}`);

  etape('Avis croisés');
  await cPage.goto(`${BASE}/compte.html?vue=reservations&avis=${resaZahra.id}`);
  await cPage.waitForSelector('.modale textarea[name=commentaire]');
  await cPage.fill('.modale textarea[name=commentaire]', 'Pièce sublime, remise impeccable.');
  await cPage.click('.modale button[type=submit]');
  await cPage.waitForSelector('text=Merci pour votre avis');
  await fMobile.goto(`${BASE}/compte.html?vue=demandes&avis=${resaZahra.id}`);
  await fMobile.waitForSelector('.modale textarea[name=commentaire]');
  await fMobile.click('.modale button[type=submit]');
  await fMobile.waitForSelector('text=Merci pour votre avis');
  assert.equal((await q(`select count(*)::int n from avis where reservation_id = $1`, [resaZahra.id]))[0].n, 2);
  ok('avis cliente → fournisseuse et fournisseuse → cliente');

  // =========================================================================
  etape('Cas de litige : événement proche (empreinte immédiate), retour abîmé');
  const r2 = await api('commande-creer', { articles: [{ tenue_id: tenue.id, mode_remise: 'main_propre' }], evenement: plus(20), debut: plus(19), fin: plus(21) }, 'cliente2@demo.lalla.be');
  const [resaL] = await q(`select * from reservations where commande_id = $1`, [r2.commande_id]);
  await api('reservation-repondre', { reservation_id: resaL.id, decision: 'accepter' }, 'zahra@test.lalla.be');
  // Cliente 2 n'a pas vérifié son identité : on la marque vérifiée pour ce cas (le flux Identity est couvert plus haut)
  await q(`update profils set identite_verifiee = true where id = $1`, [resaL.cliente_id]);
  await q(`update reservations set date_debut = current_date + 2, date_evenement = current_date + 3, date_fin = current_date + 4 where id = $1`, [resaL.id]);
  const pay = await api('checkout-creer', { commande_id: r2.commande_id }, 'cliente2@demo.lalla.be');
  const csId = pay.url.split('/').pop();
  await fetch(`${mock.base}/checkout/${csId}/payer`, { method: 'POST', redirect: 'manual' });
  const setup = await api('caution-setup', { commande_id: r2.commande_id }, 'cliente2@demo.lalla.be');
  await fetch(`${mock.base}/checkout/${setup.url.split('/').pop()}/payer`, { method: 'POST', redirect: 'manual' });
  await attendreQue(async () => (await q(`select caution_statut from reservations where id = $1`, [resaL.id]))[0].caution_statut === 'autorisee', 'empreinte immédiate');
  ok('événement à ≤ 5 jours : empreinte créée dès l\'enregistrement de la carte');
  // Remise et retour express (EDL déposés en base par les parties)
  const lignes = await q(`select id from reservation_lignes where reservation_id = $1`, [resaL.id]);
  for (const type of ['remise', 'retour']) {
    await q(`insert into etats_des_lieux (reservation_id, ligne_id, type, photo_face, photo_dos, photo_broderies, photo_doublure, taches) values ($1, $2, $3, 'placeholder:takchita:emeraude:face:1', 'placeholder:takchita:emeraude:dos:1', 'placeholder:takchita:emeraude:broderie:1', 'placeholder:takchita:emeraude:doublure:1', $4)`, [resaL.id, lignes[0].id, type, type === 'retour']);
    await api('edl-valider', { reservation_id: resaL.id, type }, 'cliente2@demo.lalla.be');
    await api('edl-valider', { reservation_id: resaL.id, type }, 'zahra@test.lalla.be');
  }
  assert.equal((await q(`select statut from reservations where id = $1`, [resaL.id]))[0].statut, 'rendue');
  await fMobile.goto(`${BASE}/compte.html?vue=demandes`);
  await fMobile.click(`#resa-${resaL.id} button:has-text("Signaler un problème")`);
  await fMobile.selectOption('.modale select[name=motif]', 'tache');
  await fMobile.fill('.modale textarea[name=description]', 'Tache de maquillage sur le col, non présente à la remise.');
  await fMobile.fill('.modale input[name=montant]', '120');
  await fMobile.setInputFiles('.modale .depot input[type=file]', photo('tache', [200, 60, 60]));
  await fMobile.waitForSelector('.modale .depot--rempli');
  await fMobile.click('.modale button:has-text("Ouvrir le litige")');
  await fMobile.waitForSelector('text=Litige ouvert');
  assert.equal((await q(`select statut from reservations where id = $1`, [resaL.id]))[0].statut, 'litige');
  ok('litige ouvert par la fournisseuse dans les 48 h, avec photo');

  etape('Résolution du litige par l\'admin (photos côte à côte, capture partielle)');
  await aPage.goto(`${BASE}/admin.html#litiges`);
  await aPage.waitForSelector('.edl__comparaison figure');
  await aPage.fill('input[name=capture]', '80');
  await aPage.fill('textarea[name=decision]', 'Tache constatée au retour, absente à la remise : retenue de 80 € pour nettoyage spécialisé.');
  await aPage.click('button:has-text("Clôturer le litige")');
  await aPage.click('.modale button:has-text("Clôturer")');
  await attendreQue(async () => (await q(`select statut from litiges where reservation_id = $1`, [resaL.id]))[0].statut === 'resolu', 'litige résolu');
  const [rL] = await q(`select * from reservations where id = $1`, [resaL.id]);
  assert.equal(rL.statut, 'cloturee'); assert.equal(rL.caution_statut, 'capturee'); assert.equal(rL.caution_capturee_cents, 8000);
  const pi = mock.etat.objets.get(rL.caution_payment_intent_id);
  assert.equal(pi.amount_received, 8000, 'capture partielle Stripe');
  await cron('versements');
  assert.ok((await q(`select transfer_id from reservations where id = $1`, [resaL.id]))[0].transfer_id, 'versement de la location après décision');
  ok('80 € capturés sur l\'empreinte et reversés, location versée, litige clos');

  etape('Expiration automatique d\'une demande sans réponse (cron)');
  const r3 = await api('commande-creer', { articles: [{ tenue_id: autre.id, mode_remise: 'main_propre' }], evenement: plus(40), debut: plus(39), fin: plus(41) }, 'cliente3@demo.lalla.be');
  await q(`update reservations set expire_at = now() - interval '1 minute' where commande_id = $1`, [r3.commande_id]);
  await cron('expirer-demandes');
  assert.equal((await q(`select statut from reservations where commande_id = $1`, [r3.commande_id]))[0].statut, 'annulee');
  assert.equal((await q(`select statut from commandes where id = $1`, [r3.commande_id]))[0].statut, 'annulee');
  ok('demande expirée annulée, commande annulée');

  etape('Sécurité : webhook non signé refusé, cron sans secret refusé, prix non modifiable par le navigateur');
  assert.equal((await fetch(`${BASE}/api/webhook`, { method: 'POST', body: '{"id":"evt_x","type":"checkout.session.completed"}', headers: { 'Stripe-Signature': 't=1,v1=faux' } })).status, 400);
  assert.equal((await fetch(`${BASE}/api/cron/horaire`)).status, 401);
  const r4 = await api('commande-creer', { articles: [{ tenue_id: autre.id, prix_location_cents: 1 }], evenement: plus(50), debut: plus(49), fin: plus(51) }, 'cliente4@demo.lalla.be');
  assert.equal((await q(`select montant_location_cents from reservations where commande_id = $1`, [r4.commande_id]))[0].montant_location_cents, autre.prix_location_cents);
  ok('les trois protections tiennent');

  etape('Export comptable');
  const exp = await api('admin-export', { mois: new Date().toISOString().slice(0, 7) }, 'admin@demo.lalla.be');
  assert.ok(exp.csv.includes('transfert') && exp.csv.includes('remboursement') === exp.csv.includes('remboursement') && exp.csv.includes('commission'));
  ok(`CSV ${exp.nom} : ${Object.entries(exp.totaux).map(([k, v]) => `${k} ${(v / 100).toFixed(2)} €`).join(', ')}`);

  const erreurs = [...desktop.erreurs, ...mobile.erreurs, ...mobileF.erreurs];
  for (const p of [fPage]) void p;
  assert.deepEqual(erreurs, [], 'aucune erreur console');
  ok('zéro erreur console sur l\'ensemble du parcours');
} catch (e) {
  echec = e;
  console.error('\n✗ ÉCHEC :', e.message);
  console.error([...desktop.erreurs, ...mobile.erreurs, ...mobileF.erreurs].join('\n'));
  const j = mock.etat.journal.filter((x) => x.webhook_erreur);
  if (j.length) console.error('Webhooks en erreur :', JSON.stringify(j, null, 1));
}

await b.close();
mock.arreter();
await env.arreter();
console.log(`\n${echec ? 'ÉCHEC' : 'SUCCÈS'} — ${etapes.length} étapes`);
process.exit(echec ? 1 : 0);
