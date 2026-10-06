// Conditions générales : version en vigueur (assets/config.js) acceptée par le membre.
import { db, ok } from './supabase.js';
import { HttpError } from './http.js';
import { CONFIG } from './config.js';

export async function exigerCgu(u) {
  const prive = ok(await db().from('profils_prives').select('cgu_version').eq('id', u.id).maybeSingle(), 'conditions');
  if (!prive || prive.cgu_version !== CONFIG.cguVersion) {
    throw new HttpError(403, 'cgu', 'Merci d\'accepter les conditions générales mises à jour (rechargez la page).');
  }
}
