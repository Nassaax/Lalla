import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerReservation, calculerCommande, pourcentagePolitique, calculerAnnulation, estimerRevenu } from '../../lib/pricing.js';
import { DEFAUTS, validerParametre } from '../../lib/parametres.js';

const p = DEFAUTS;
const caftan = { prix_location_cents: 10000, valeur_declaree_cents: 120000, categorie: 'caftan' };
const mdamma = { prix_location_cents: 3000, valeur_declaree_cents: 40000, categorie: 'accessoire' };

test('réservation simple : commission, pressing, caution, transfert', () => {
  const r = calculerReservation({ pieces: [caftan], mode_remise: 'main_propre' }, p);
  assert.equal(r.montant_location_cents, 10000);
  assert.equal(r.frais_pressing_cents, 1500);
  assert.equal(r.commission_cents, 1500);
  assert.equal(r.frais_service_cents, 500);
  assert.equal(r.caution_cents, 60000);
  assert.equal(r.montant_transfert_cents, 10000 - 1500 + 1500);
  assert.equal(r.total_cliente_cents, 10000 + 1500 + 500);
});

test('caution choisie par la fournisseuse : montant fixe, sans caution, pourcentage, plafond', () => {
  const fixe = calculerReservation({ pieces: [{ ...caftan, caution_mode: 'montant', caution_montant_cents: 20000 }], mode_remise: 'main_propre' }, p);
  assert.equal(fixe.caution_cents, 20000);
  const sans = calculerReservation({ pieces: [{ ...caftan, caution_mode: 'montant', caution_montant_cents: 0 }], mode_remise: 'main_propre' }, p);
  assert.equal(sans.caution_cents, 0);
  const pct = calculerReservation({ pieces: [{ ...caftan, caution_mode: 'pourcentage', caution_taux: 0.2 }, mdamma], mode_remise: 'main_propre' }, p);
  assert.equal(pct.caution_cents, 24000 + 20000);
  const plafond = calculerReservation({ pieces: [{ ...caftan, caution_mode: 'montant', caution_montant_cents: 999999 }], mode_remise: 'main_propre' }, p);
  assert.equal(plafond.caution_cents, 120000);
});

test('sans caution explicite, caution en espèces (main propre seulement)', () => {
  const aucune = calculerReservation({ pieces: [{ ...caftan, caution_mode: 'aucune', caution_montant_cents: 20000 }], mode_remise: 'main_propre' }, p);
  assert.equal(aucune.caution_cents, 0); assert.equal(aucune.caution_especes_cents, 0);
  const especes = { ...caftan, caution_mode: 'montant', caution_montant_cents: 20000, caution_moyen: 'especes' };
  const main = calculerReservation({ pieces: [especes, mdamma], mode_remise: 'main_propre' }, p);
  assert.equal(main.caution_especes_cents, 20000, 'part en espèces');
  assert.equal(main.caution_cents, 20000, 'part bancaire (mdamma, 50 % de 400 €)');
  const envoi = calculerReservation({ pieces: [especes], mode_remise: 'envoi', frais_envoi_cents: 900 }, p);
  assert.equal(envoi.caution_especes_cents, 0); assert.equal(envoi.caution_cents, 20000, 'envoi : empreinte bancaire');
});

test('accessoire sans pressing, envoi facturé seulement en mode envoi', () => {
  const r = calculerReservation({ pieces: [caftan, mdamma], mode_remise: 'envoi', frais_envoi_cents: 1200 }, p);
  assert.equal(r.frais_pressing_cents, 1500);
  assert.equal(r.frais_envoi_cents, 1200);
  const m = calculerReservation({ pieces: [caftan], mode_remise: 'main_propre', frais_envoi_cents: 1200 }, p);
  assert.equal(m.frais_envoi_cents, 0);
});

test('déduction d\'essayage : réduit le total ; réduit le transfert seulement si déjà reversé', () => {
  const a = calculerReservation({ pieces: [caftan], mode_remise: 'main_propre', deduction_essayage_cents: 1500 }, p);
  assert.equal(a.total_cliente_cents, 12000 - 1500);
  assert.equal(a.montant_transfert_cents, 10000);
  const b = calculerReservation({ pieces: [caftan], mode_remise: 'main_propre', deduction_essayage_cents: 1500, essayage_deja_reverse: true }, p);
  assert.equal(b.montant_transfert_cents, 10000 - 1500);
});

test('commande multi-fournisseuses ignore les réservations annulées', () => {
  const r1 = { ...calculerReservation({ pieces: [caftan], mode_remise: 'main_propre' }, p), statut: 'acceptee' };
  const r2 = { ...calculerReservation({ pieces: [mdamma], mode_remise: 'main_propre' }, p), statut: 'annulee' };
  assert.equal(calculerCommande([r1, r2]).total, 12000);
});

test('politique d\'annulation par paliers', () => {
  const pol = p.politique_annulation;
  assert.equal(pourcentagePolitique(40, pol), 100);
  assert.equal(pourcentagePolitique(30, pol), 100);
  assert.equal(pourcentagePolitique(20, pol), 50);
  assert.equal(pourcentagePolitique(3, pol), 0);
});

test('annulation cliente à 20 jours : 50 % de la location + pressing, compensation fournisseuse', () => {
  const resa = { ...calculerReservation({ pieces: [caftan], mode_remise: 'main_propre' }, p), date_evenement: '2026-11-21' };
  const a = calculerAnnulation(resa, { par: 'cliente', aujourdhui: '2026-11-01' }, p);
  assert.equal(a.pct, 50);
  assert.equal(a.rembourse_cents, 1500 + 5000);
  assert.equal(a.compensation_fournisseuse_cents, 5000 - 750);
});

test('annulation par la fournisseuse : remboursement intégral, frais de service compris', () => {
  const resa = { ...calculerReservation({ pieces: [caftan], mode_remise: 'main_propre' }, p), date_evenement: '2026-11-03' };
  const a = calculerAnnulation(resa, { par: 'fournisseuse', aujourdhui: '2026-11-01' }, p);
  assert.equal(a.rembourse_cents, 12000);
  assert.equal(a.compensation_fournisseuse_cents, 0);
});

test('simulateur : prix × locations × (1 − commission)', () => {
  assert.equal(estimerRevenu(9000, 3, p), 22950);
});

test('validation des paramètres du back-office', () => {
  assert.equal(validerParametre('commission_taux', 0.9).ok, false);
  assert.equal(validerParametre('commission_taux', '0.12').valeur, 0.12);
  assert.equal(validerParametre('politique_annulation', [{ jours_min: 10, pct: 50 }]).ok, false);
  assert.deepEqual(validerParametre('politique_annulation', [{ jours_min: 0, pct: 0 }, { jours_min: 10, pct: 50 }]).valeur, [{ jours_min: 10, pct: 50 }, { jours_min: 0, pct: 0 }]);
});
