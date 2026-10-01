// Machine à états des réservations. Toute transition passe par ici, côté serveur.
// La mise à jour est conditionnelle (WHERE statut IN …) : deux processus concurrents
// (webhook + cron, double clic…) ne peuvent pas appliquer deux fois la même transition.
import { db, ok } from './supabase.js';
import { HttpError } from './http.js';

export const GRAPHE = {
  demande: ['acceptee', 'annulee'],
  acceptee: ['payee', 'annulee'],
  payee: ['remise', 'annulee'],
  remise: ['rendue', 'litige'],
  rendue: ['cloturee', 'litige'],
  litige: ['cloturee'],
  cloturee: [],
  annulee: []
};

export function transitionPermise(de, vers) {
  return (GRAPHE[de] || []).includes(vers);
}

/**
 * @param {string} id réservation
 * @param {object} o
 * @param {string|string[]} o.de statut(s) d'origine acceptés
 * @param {string} o.vers statut cible
 * @param {string} o.acteur cliente | fournisseuse | systeme | admin | stripe
 * @param {string} [o.raison]
 * @param {object} [o.patch] colonnes à mettre à jour dans la même requête
 * @param {boolean} [o.silencieux] ne lève pas d'erreur si la transition n'a pas eu lieu
 */
export async function transition(id, { de, vers, acteur, raison = null, patch = {}, silencieux = false }) {
  const origines = [].concat(de);
  for (const o of origines) {
    if (!transitionPermise(o, vers)) throw new Error(`Transition interdite ${o} → ${vers}`);
  }
  const lignes = ok(
    await db()
      .from('reservations')
      .update({ ...patch, statut: vers, derniere_action_par: acteur, derniere_raison: raison })
      .eq('id', id)
      .in('statut', origines)
      .select('*'),
    'transition'
  );
  if (!lignes.length) {
    if (silencieux) return null;
    throw new HttpError(409, 'transition_invalide', 'Cette action n\'est plus possible pour cette réservation.');
  }
  return lignes[0];
}

/** Mise à jour sans changement de statut, conditionnée au statut courant. */
export async function majSiStatut(id, statuts, patch) {
  const lignes = ok(
    await db().from('reservations').update(patch).eq('id', id).in('statut', [].concat(statuts)).select('*'),
    'mise à jour réservation'
  );
  return lignes[0] || null;
}
