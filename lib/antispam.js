import { db } from './supabase.js';
import { HttpError, ipDe } from './http.js';

/**
 * Honeypot : le champ caché « site_web » doit rester vide.
 * Renvoie true si la requête vient manifestement d'un robot.
 */
export function estRobot(corps) {
  return Boolean(corps && typeof corps.site_web === 'string' && corps.site_web.trim() !== '');
}

/** Limitation de fréquence partagée (table limites_frequence via verifier_frequence). */
export async function limiter(req, action, { max = 10, fenetreSecondes = 3600, cle = null } = {}) {
  const sujet = cle || ipDe(req);
  const { data, error } = await db().rpc('verifier_frequence', {
    p_cle: `${action}:${sujet}`, p_max: max, p_fenetre_secondes: fenetreSecondes
  });
  if (error) {
    console.error('[antispam]', error.message);
    return; // en cas de panne de la base, on ne bloque pas l'utilisatrice
  }
  if (data === false) throw new HttpError(429, 'trop_de_requetes', 'Trop de tentatives, réessayez dans quelques minutes.');
}
