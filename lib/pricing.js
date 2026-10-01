// Calcul des montants — UNIQUE source de vérité, exécutée côté serveur.
// Le navigateur affiche des estimations, mais tout montant facturé est recalculé ici
// à partir des données de la base (prix, valeur déclarée, paramètres).
import { joursEntre } from './dates.js';

const arrondi = (n) => Math.round(n);

/** Caution d'une pièce : valeur déclarée × taux. */
export function cautionPiece(valeurDeclareeCents, p) {
  return arrondi(valeurDeclareeCents * Number(p.caution_taux));
}

/**
 * Montants d'une réservation (une fournisseuse).
 * @param {object} r
 * @param {Array<{prix_location_cents:number, valeur_declaree_cents:number, categorie:string}>} r.pieces
 * @param {'main_propre'|'envoi'} r.mode_remise
 * @param {number} [r.frais_envoi_cents] frais d'envoi (le plus élevé des pièces)
 * @param {number} [r.deduction_essayage_cents]
 * @param {boolean} [r.essayage_deja_reverse] l'essayage a déjà été transféré à la fournisseuse
 */
export function calculerReservation(r, p) {
  if (!Array.isArray(r.pieces) || r.pieces.length === 0) throw new Error('Réservation sans pièce');
  const lignes = r.pieces.map((piece) => ({
    prix_location_cents: piece.prix_location_cents,
    // Les accessoires ne passent pas au pressing.
    frais_pressing_cents: piece.categorie === 'accessoire' ? 0 : Number(p.frais_pressing_cents),
    caution_cents: cautionPiece(piece.valeur_declaree_cents, p)
  }));
  const location = lignes.reduce((s, l) => s + l.prix_location_cents, 0);
  const pressing = lignes.reduce((s, l) => s + l.frais_pressing_cents, 0);
  const caution = lignes.reduce((s, l) => s + l.caution_cents, 0);
  const envoi = r.mode_remise === 'envoi' ? Math.max(0, r.frais_envoi_cents || 0) : 0;
  const commission = arrondi(location * Number(p.commission_taux));
  const fraisService = arrondi(location * Number(p.frais_service_taux));
  const deduction = Math.min(Math.max(0, r.deduction_essayage_cents || 0), location);
  const transfert = location - commission + pressing + envoi - (r.essayage_deja_reverse ? deduction : 0);
  const totalCliente = location + pressing + envoi + fraisService - deduction;
  return {
    lignes,
    montant_location_cents: location,
    frais_pressing_cents: pressing,
    frais_envoi_cents: envoi,
    frais_service_cents: fraisService,
    commission_cents: commission,
    deduction_essayage_cents: deduction,
    montant_transfert_cents: Math.max(0, transfert),
    caution_cents: caution,
    total_cliente_cents: totalCliente
  };
}

/** Totaux d'une commande (plusieurs réservations), hors réservations annulées. */
export function calculerCommande(reservations) {
  const actives = reservations.filter((r) => r.statut !== 'annulee');
  const somme = (cle) => actives.reduce((s, r) => s + (r[cle] || 0), 0);
  return {
    location: somme('montant_location_cents'),
    pressing: somme('frais_pressing_cents'),
    envoi: somme('frais_envoi_cents'),
    frais_service: somme('frais_service_cents'),
    deduction: somme('deduction_essayage_cents'),
    caution: somme('caution_cents'),
    total:
      somme('montant_location_cents') + somme('frais_pressing_cents') + somme('frais_envoi_cents') +
      somme('frais_service_cents') - somme('deduction_essayage_cents')
  };
}

/** Pourcentage remboursé selon la politique (paliers triés par jours_min décroissants). */
export function pourcentagePolitique(joursAvant, politique) {
  const paliers = [...politique].sort((a, b) => b.jours_min - a.jours_min);
  for (const palier of paliers) {
    if (joursAvant >= palier.jours_min) return Number(palier.pct);
  }
  return 0;
}

/**
 * Remboursement d'une réservation payée qui est annulée.
 * - Annulation par la cliente : pressing et envoi remboursés (non consommés),
 *   location remboursée selon la politique, frais de service conservés.
 *   La part de location retenue est reversée à la fournisseuse, moins la commission.
 * - Annulation par la fournisseuse, le système ou l'équipe : remboursement intégral.
 */
export function calculerAnnulation(resa, { par, aujourdhui }, p) {
  const locationPayee = resa.montant_location_cents - (resa.deduction_essayage_cents || 0);
  const totalPaye = locationPayee + resa.frais_pressing_cents + resa.frais_envoi_cents + (resa.frais_service_cents || 0);
  if (par !== 'cliente') {
    return { pct: 100, rembourse_cents: totalPaye, compensation_fournisseuse_cents: 0, jours_avant: null };
  }
  const joursAvant = joursEntre(aujourdhui, resa.date_evenement);
  const pct = pourcentagePolitique(joursAvant, p.politique_annulation);
  const locationRemboursee = arrondi((locationPayee * pct) / 100);
  const retenu = locationPayee - locationRemboursee;
  return {
    pct,
    jours_avant: joursAvant,
    rembourse_cents: resa.frais_pressing_cents + resa.frais_envoi_cents + locationRemboursee,
    compensation_fournisseuse_cents: retenu - arrondi(retenu * Number(p.commission_taux))
  };
}

/** Simulateur fournisseuse (affiché comme estimation). */
export function estimerRevenu(prixCents, locationsParMois, p) {
  return arrondi(prixCents * locationsParMois * (1 - Number(p.commission_taux)));
}
