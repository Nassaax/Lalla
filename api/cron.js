// Point d'entrée des tâches planifiées : /api/cron/<tâche> (réécrit en /api/cron?task=<tâche>).
// Vercel Cron envoie automatiquement « Authorization: Bearer $CRON_SECRET ».
import { timingSafeEqual } from 'node:crypto';
import { TACHES } from '../lib/cron.js';
import { envoyerJson } from '../lib/http.js';

function autorise(req) {
  const attendu = `Bearer ${process.env.CRON_SECRET || ''}`;
  const recu = String(req.headers.authorization || '');
  if (!process.env.CRON_SECRET || recu.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}

export default async function handler(req, res) {
  if (!autorise(req)) return envoyerJson(res, 401, { erreur: 'non_autorise' });
  const tache = TACHES[String(req.query?.task || '')];
  if (!tache) return envoyerJson(res, 404, { erreur: 'tache_inconnue', taches: Object.keys(TACHES) });
  const debut = Date.now();
  try {
    const rapport = await tache({});
    return envoyerJson(res, 200, { tache: req.query.task, duree_ms: Date.now() - debut, ...rapport });
  } catch (e) {
    console.error('[cron]', req.query.task, e.message);
    return envoyerJson(res, 500, { erreur: 'echec', message: e.message });
  }
}
