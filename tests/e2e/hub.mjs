// Hub des fêtes : prestations (maquillage, photo, DJ…) et matériel (sono, amaria…), dans la même
// mécanique que les tenues. Vérifie : formulaire d'annonce adapté, catalogue par univers, fiche avec
// critères, réservation d'une prestation (date + heure + lieu, sans caution ni pressing), paiement,
// prestation réalisée le lendemain, litige côté cliente, versement ; location de matériel (caution, sans pressing).
// Usage : node tests/e2e/hub.mjs
import assert from 'node:assert/strict';
import { environnement, navigateur, contexte, BASE } from './outils.mjs';
import { demarrerStripeMock } from './stripe-mock.mjs';

const MDP = 'Demo-Lalla-2026';
const ok = (m) => console.log(`  ✓ ${m}`);
const etape = (m) => console.log(`\n▶ ${m}`);
const plus = (j) => new Date(Date.now() + j * 86400000).toISOString().slice(0, 10);

const mock = await demarrerStripeMock({ webhookUrl: `${BASE}/api/webhook`, secret: 'whsec_local_test' });
const env = await environnement({ stripeMock: mock.base });
const q = async (sql, p = []) => (await env.pile.pool.query(sql, p)).rows;
const { seed } = await import('../../scripts/seed-demo.mjs');
await seed();

async function jeton(email) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: MDP }) });
  return (await r.json()).access_token;
}
async function api(action, corps, email) {
  const r = await fetch(`${BASE}/api/v1/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(email ? { Authorization: `Bearer ${await jeton(email)}` } : {}) }, body: JSON.stringify(corps) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${action} → ${r.status} ${JSON.stringify(j)}`);
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

let echec = false;
const b = await navigateur();
const ctx = await contexte(b, { largeur: 390, hauteur: 844, mobile: true });
try {
  etape('Formulaire d\'annonce : critères propres à la catégorie');
  const fPage = await ctx.newPage();
  await connecter(fPage, 'presta1@demo.lalla.be', '/compte.html?vue=annonces');
  await fPage.click('button:has-text("Nouvelle annonce")');
  await fPage.waitForSelector('[name=univers][value=prestation]:checked');
  assert.ok(await fPage.isHidden('[name=valeur]'), 'pas de valeur déclarée pour une prestation');
  assert.ok(await fPage.isHidden('[name=caution_mode]'), 'pas de caution pour une prestation');
  await fPage.selectOption('[name=categorie]', 'photographie');
  await fPage.waitForSelector('[name=crit_heures]');
  assert.ok(await fPage.isVisible('[name=crit_drone]'), 'critère photo affiché');
  assert.ok(await fPage.isHidden('[name=poitrine_cm]'), 'pas de mesures');
  await fPage.check('[name=univers][value=materiel]', { force: true });
  await fPage.waitForSelector('[name=crit_puissance_w]');
  assert.ok(await fPage.isVisible('[name=caution_mode]'), 'caution proposée pour le matériel');
  await fPage.check('[name=univers][value=prestation]', { force: true });
  await fPage.selectOption('[name=categorie]', 'coiffure');
  await fPage.fill('[name=titre]', 'Coiffure mariée et chignon');
  await fPage.fill('[name=prix]', '120');
  await fPage.fill('[name=code_postal]', '1000');
  await fPage.fill('[name=crit_nb_personnes_max]', '2');
  await fPage.check('[name=crit_essai]', { force: true });
  await fPage.click('button[name=brouillon]');
  await fPage.waitForSelector('text=Annonce enregistrée', { timeout: 15000 }).catch(() => {});
  const [brouillon] = await q(`select * from tenues where titre = 'Coiffure mariée et chignon'`);
  assert.ok(brouillon, 'brouillon enregistré');
  assert.equal(brouillon.univers, 'prestation');
  assert.equal(brouillon.caution_mode, 'aucune');
  assert.deepEqual(brouillon.attributs, { nb_personnes_max: 2, essai: true, deplacement: false });
  ok('prestation : critères enregistrés, ni caution, ni mesures, ni valeur déclarée');

  etape('Catalogue par univers et fiche avec critères');
  const ctxC = await contexte(b, { largeur: 390, hauteur: 844, mobile: true });
  const cPage = await ctxC.newPage();
  await connecter(cPage, 'cliente1@demo.lalla.be');
  await cPage.goto(`${BASE}/catalogue.html?univers=prestation`, { waitUntil: 'networkidle' });
  await cPage.waitForSelector('.carte:not(.squelette-carte)');
  const titres = await cPage.$$eval('.carte__titre', (els) => els.map((e) => e.textContent));
  assert.ok(titres.includes('Maquillage mariée avec essai') && !titres.some((x) => /Caftan|Takchita/.test(x)), 'seulement des prestations');
  assert.ok((await cPage.textContent('.carte__prix')).includes('la prestation'));
  await cPage.click('.univers-onglet:has-text("Matériel")');
  await cPage.waitForSelector('.carte__titre:has-text("Sono 2 000 W")');
  ok('onglets Tenues / Matériel / Prestations');
  const [maquillage] = await q(`select id from tenues where titre = 'Maquillage mariée avec essai'`);
  await cPage.goto(`${BASE}/tenue.html?id=${maquillage.id}`, { waitUntil: 'networkidle' });
  await cPage.waitForSelector('.mesures th:has-text("Essai inclus")');
  await cPage.waitForSelector('#r-heure');
  assert.equal(await cPage.$('#r-debut'), null, 'pas de dates de récupération et de retour');
  ok('fiche : caractéristiques et réservation par date, heure et lieu');

  etape('Réservation et paiement d\'une prestation');
  const evt = plus(12);
  await cPage.fill('#r-evt', evt); await cPage.dispatchEvent('#r-evt', 'change');
  await cPage.fill('#r-heure', '14:30');
  await cPage.fill('#r-lieu', 'Salle des fêtes, 1000 Bruxelles');
  await cPage.waitForSelector('.disponibilite--oui');
  await cPage.click('.reservation-boite button[type=submit]');
  await cPage.waitForSelector('text=Ajoutée au panier');
  await cPage.goto(`${BASE}/panier.html`);
  await cPage.waitForSelector('[name=heure_prestation]');
  assert.equal(await cPage.$('[name=debut]'), null, 'panier de prestations : pas de dates de location');
  assert.equal(await cPage.inputValue('[name=heure_prestation]'), '14:30');
  await cPage.click('button:has-text("Réserver et payer")');
  await cPage.waitForURL(/localhost:12111\/checkout/);
  await cPage.click('#payer');
  await cPage.waitForURL(/paiement=ok/);
  await cPage.waitForSelector('text=Tout est prêt', { timeout: 20000 });
  const [resa] = await q(`select r.* from reservations r join reservation_lignes l on l.reservation_id = r.id where l.tenue_id = $1`, [maquillage.id]);
  assert.equal(resa.nature, 'prestation');
  assert.equal(resa.statut, 'payee');
  assert.equal(resa.date_debut.toISOString ? resa.date_debut.toISOString().slice(0, 10) : String(resa.date_debut), resa.date_evenement.toISOString ? resa.date_evenement.toISOString().slice(0, 10) : String(resa.date_evenement));
  assert.equal(resa.caution_cents, 0); assert.equal(resa.frais_pressing_cents, 0);
  assert.equal(resa.adresse_prestation, 'Salle des fêtes, 1000 Bruxelles');
  assert.ok(resa.creneau_remise, 'heure de la prestation enregistrée');
  const [bloc] = await q(`select lower(periode)::text d, (upper(periode) - 1)::text f from blocages where reservation_id = $1`, [resa.id]);
  assert.equal(bloc.d, evt); assert.equal(bloc.f, evt);
  ok('prestation payée : sans caution ni pressing, calendrier bloqué le seul jour de la fête');

  etape('Le lendemain : prestation réalisée, signalement possible par la cliente, puis versement');
  await q(`update reservations set date_evenement = current_date - 1, date_debut = current_date - 1, date_fin = current_date - 1 where id = $1`, [resa.id]);
  const cron = async (t) => (await fetch(`${BASE}/api/cron/${t}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })).json();
  await cron('horaire');
  const [rendue] = await q(`select statut, litige_deadline from reservations where id = $1`, [resa.id]);
  assert.equal(rendue.statut, 'rendue');
  await cPage.goto(`${BASE}/compte.html?vue=reservations`);
  await cPage.waitForSelector(`#resa-${resa.id} button:has-text("Signaler un problème")`);
  assert.equal(await cPage.$(`#resa-${resa.id} button:has-text("état des lieux")`), null, 'pas d\'état des lieux pour une prestation');
  await assert.rejects(api('litige-ouvrir', { reservation_id: resa.id, motif: 'retard', description: 'Arrivée avec une heure de retard.' }, 'presta1@demo.lalla.be'), /introuvable/);
  ok('cliente seule peut signaler un problème (la prestataire non)');
  await q(`update reservations set litige_deadline = now() - interval '1 minute', versement_prevu_at = now() - interval '1 minute' where id = $1`, [resa.id]);
  await cron('horaire');
  const [fin] = await q(`select statut, transfer_id, montant_transfert_cents from reservations where id = $1`, [resa.id]);
  assert.ok(fin.transfer_id, 'versement envoyé');
  assert.equal(fin.statut, 'cloturee');
  ok(`versement de ${(fin.montant_transfert_cents / 100).toFixed(2)} € à la prestataire, réservation clôturée`);

  etape('Matériel : location avec caution, sans pressing, calendrier exact');
  const [sono] = await q(`select id from tenues where titre = 'Sono 2 000 W avec deux micros'`);
  const r2 = await api('commande-creer', { articles: [{ tenue_id: sono.id, mode_remise: 'main_propre' }], evenement: plus(20), debut: plus(19), fin: plus(21) }, 'cliente2@demo.lalla.be');
  const [rs] = await q(`select * from reservations where commande_id = $1`, [r2.commande_id]);
  assert.equal(rs.nature, 'location'); assert.equal(rs.frais_pressing_cents, 0); assert.equal(rs.caution_cents, 30000);
  await api('reservation-repondre', { reservation_id: rs.id, decision: 'accepter' }, 'loueur1@demo.lalla.be');
  const [b2] = await q(`select lower(periode)::text d, (upper(periode) - 1)::text f from blocages where reservation_id = $1`, [rs.id]);
  assert.equal(b2.d, plus(19)); assert.equal(b2.f, plus(21));
  ok('matériel : caution de 300 €, pas de pressing, blocage du 1er au dernier jour sans battement');

  assert.deepEqual([...ctx.erreurs, ...ctxC.erreurs], [], 'aucune erreur console');
  ok('zéro erreur console');
} catch (e) {
  echec = true;
  console.error('\n✗ ÉCHEC :', e.message);
  if (ctx.erreurs.length) console.error(ctx.erreurs.join('\n'));
}
await b.close();
await env.arreter();
mock.arreter();
console.log(echec ? '\nÉCHEC — hub' : '\nSUCCÈS — hub');
process.exit(echec ? 1 : 0);
