// Table des actions exposées sur /api/v1/<action>.
import { commandeCreer, commandeAnnuler, reservationRepondre, reservationAnnuler, reservationEnvoi } from './commandes.js';
import {
  checkoutCreer, cautionSetup, cautionReessayer, identiteSession,
  connectOnboarding, connectStatut, connectTableau,
  essayageCreer, essayageRepondre, showroomInscrire
} from './paiements.js';
import { edlValider, litigeOuvrir } from './suivi.js';
import { leadCreer, compteExporter, compteSupprimer } from './hub.js';
import { adminStats, adminTenueStatut, adminCompte, adminParametres, adminLitigeResoudre, adminExport, adminReservationEdl } from './admin.js';

export const ACTIONS = {
  'commande-creer': commandeCreer,
  'commande-annuler': commandeAnnuler,
  'reservation-repondre': reservationRepondre,
  'reservation-annuler': reservationAnnuler,
  'reservation-envoi': reservationEnvoi,
  'checkout-creer': checkoutCreer,
  'caution-setup': cautionSetup,
  'caution-reessayer': cautionReessayer,
  'identite-session': identiteSession,
  'connect-onboarding': connectOnboarding,
  'connect-statut': connectStatut,
  'connect-tableau': connectTableau,
  'essayage-creer': essayageCreer,
  'essayage-repondre': essayageRepondre,
  'showroom-inscrire': showroomInscrire,
  'edl-valider': edlValider,
  'litige-ouvrir': litigeOuvrir,
  'lead-creer': leadCreer,
  'compte-exporter': compteExporter,
  'compte-supprimer': compteSupprimer,
  'admin-stats': adminStats,
  'admin-tenue-statut': adminTenueStatut,
  'admin-compte': adminCompte,
  'admin-parametres': adminParametres,
  'admin-litige-resoudre': adminLitigeResoudre,
  'admin-export': adminExport,
  'admin-reservation-edl': adminReservationEdl
};
