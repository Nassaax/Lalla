// Fonctions « plateforme » côté serveur : réservation instantanée, créneau de remise,
// notifications dans le site, export DAC7, recherche par distance.
// Usage : node tests/e2e/plateforme.mjs
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { environnement, BASE } from './outils.mjs';

const env = await environnement();
const { seed, MOT_DE_PASSE_DEMO } = await import('../../scripts/seed-demo.mjs');
await seed();
const q = async (sql, p) => (await env.pile.pool.query(sql, p)).rows;
const ok = (m) => console.log('  ✓ ' + m);

async function session(email) {
  const sb = createClient(BASE, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const r = await sb.auth.signInWithPassword({ email, password: MOT_DE_PASSE_DEMO });
  if (r.error) throw r.error;
  const api = async (action, corps) => {
    const res = await fetch(`${BASE}/api/v1/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${r.data.session.access_token}` }, body: JSON.stringify(corps) });
    const j = await res.json();
    if (!res.ok) throw new Error(`${action} : ${j.message}`);
    return j;
  };
  return { sb, api, id: r.data.user.id };
}

const plus = (j) => new Date(Date.now() + j * 86400000).toISOString().slice(0, 10);
const [tn] = await q(`select t.id, t.fournisseuse_id, u.email from tenues t join auth.users u on u.id = t.fournisseuse_id
  where t.statut = 'validee' and t.categorie <> 'accessoire' and t.remise_main_propre and t.duree_min_jours <= 2 and t.duree_max_jours >= 2 limit 1`);
// Caution fixée par la fournisseuse : 150 € en espèces, quelle que soit la valeur déclarée
await q(`update tenues set reservation_instantanee = true, code_postal = '4000', caution_mode = 'montant', caution_montant_cents = 15000, caution_moyen = 'especes' where id = $1`, [tn.id]);

console.log('▶ Pré-lancement');
const adminPL = await session('admin@demo.lalla.be');
const clientePL = await session('cliente1@demo.lalla.be');
await adminPL.api('admin-parametres', { cle: 'reservations_ouvertes', valeur: false });
await assert.rejects(clientePL.api('commande-creer', { articles: [{ tenue_id: tn.id, mode_remise: 'main_propre' }], evenement: plus(21), debut: plus(20), fin: plus(22) }), /Coming soon/);
await assert.rejects(clientePL.api('admin-parametres', { cle: 'reservations_ouvertes', valeur: true }));
await adminPL.api('admin-parametres', { cle: 'reservations_ouvertes', valeur: true });
const annonce = await clientePL.sb.from('notifications').select('type, lien').eq('type', 'ouverture');
assert.equal(annonce.data.length, 1, 'inscrites prévenues de l\'ouverture');
ok('pré-lancement : réservation refusée (Coming soon), ouverture par l\'admin, inscrites prévenues');

console.log('▶ Réservation instantanée et créneau de remise');
const cliente = await session('cliente2@demo.lalla.be');
const fournisseuse = await session(tn.email);
const creneau = new Date(`${plus(20)}T15:00:00Z`).toISOString();
const { commande_id, statut: statutCree } = await cliente.api('commande-creer', { articles: [{ tenue_id: tn.id, mode_remise: 'main_propre' }], evenement: plus(21), debut: plus(20), fin: plus(22), creneau });
const [resa] = await q(`select r.*, c.statut as statut_commande from reservations r join commandes c on c.id = r.commande_id where r.commande_id = $1`, [commande_id]);
assert.equal(resa.statut, 'acceptee', 'acceptée sans attendre');
assert.equal(resa.statut_commande, 'a_payer');
assert.equal(resa.creneau_propose_par, 'cliente');
assert.equal(statutCree, 'a_payer', 'le site peut enchaîner directement sur le paiement');
assert.equal(resa.caution_especes_cents, 15000, 'caution fixée par la fournisseuse, en espèces');
assert.equal(resa.caution_cents, 0, 'aucune empreinte bancaire');
const blocages = await q(`select count(*)::int n from blocages where reservation_id = $1`, [resa.id]);
assert.equal(blocages[0].n, 1, 'calendrier bloqué');
ok('réservation instantanée acceptée, commande à payer d\'office, caution en espèces choisie par la fournisseuse, calendrier bloqué');
await fournisseuse.api('reservation-creneau', { reservation_id: resa.id, confirmer: true });
assert.equal((await q(`select creneau_confirme from reservations where id = $1`, [resa.id]))[0].creneau_confirme, true);
const autre = new Date(`${plus(19)}T10:30:00Z`).toISOString();
await fournisseuse.api('reservation-creneau', { reservation_id: resa.id, creneau: autre });
const [r2] = await q(`select creneau_confirme, creneau_propose_par from reservations where id = $1`, [resa.id]);
assert.deepEqual([r2.creneau_confirme, r2.creneau_propose_par], [false, 'fournisseuse']);
await assert.rejects(fournisseuse.api('reservation-creneau', { reservation_id: resa.id, confirmer: true }), /Aucun créneau/);
await cliente.api('reservation-creneau', { reservation_id: resa.id, confirmer: true });
ok('créneau confirmé, nouvelle proposition, confirmation par l\'autre partie uniquement');

console.log('▶ Notifications dans le site');
const nf = await fournisseuse.sb.from('notifications').select('type, titre, lien').order('created_at');
assert.ok(nf.data.some((n) => n.type === 'reservation_instantanee' && n.lien.includes(resa.id)), 'fournisseuse prévenue');
const nc = await cliente.sb.from('notifications').select('type');
assert.ok(nc.data.some((n) => n.type === 'commande_a_payer') && nc.data.some((n) => n.type === 'creneau_propose'), 'cliente prévenue');
const autreCliente = await session('cliente1@demo.lalla.be');
assert.equal((await autreCliente.sb.from('notifications').select('id').eq('lien', `/compte.html?vue=demandes&reservation=${resa.id}`)).data.length, 0);
ok('notifications créées pour chaque partie, invisibles pour les autres');

console.log('▶ Recherche par distance');
const res = await cliente.sb.rpc('rechercher_tenues', { p_code_postal: '4020', p_tri: 'distance', p_rayon_km: 15, p_limite: 5 });
assert.ifError(res.error);
assert.equal(res.data[0].id, tn.id, 'la plus proche en premier');
assert.ok(res.data[0].distance_km <= 15 && res.data[0].commune && res.data[0].reservation_instantanee);
ok(`tri par distance (${res.data[0].distance_km} km, ${res.data[0].commune}) et rayon`);

console.log('▶ Export DAC7');
await q(`update reservations set statut = 'cloturee', payee_at = now() where id = $1`, [resa.id]);
const admin = await session('admin@demo.lalla.be');
const dac7 = await admin.api('admin-dac7', { annee: new Date().getFullYear() });
assert.ok(dac7.csv.includes('nb_locations') && dac7.fournisseuses >= 1 && dac7.incompletes >= 1);
await assert.rejects(cliente.api('admin-dac7', { annee: 2026 }));
ok(`export DAC7 : ${dac7.fournisseuses} fournisseuse(s), ${dac7.incompletes} sans informations fiscales ; refusé hors administration`);

console.log('\nSUCCÈS — plateforme');
await env.arreter();
process.exit(0);
