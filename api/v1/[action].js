// Routeur unique des actions JSON : /api/v1/<action>
// Chaque action vérifie elle-même l'identité et les droits, puis recalcule tout côté serveur.
import { ACTIONS } from '../../lib/actions/index.js';
import { envoyerJson, envoyerErreur, lireJson, HttpError } from '../../lib/http.js';

// Applications iOS / Android (Capacitor) : interface embarquée, servie depuis ces origines.
const ORIGINES_APP = ['capacitor://localhost', 'https://localhost', 'http://localhost'];

export default async function handler(req, res) {
  const origine = req.headers && req.headers.origin;
  if (origine && ORIGINES_APP.includes(origine)) {
    res.setHeader('Access-Control-Allow-Origin', origine);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  }
  try {
    const nom = String((req.query && req.query.action) || '').replace(/[^a-z0-9-]/g, '');
    const action = ACTIONS[nom];
    if (!action) throw new HttpError(404, 'action_inconnue', 'Action inconnue');
    const methode = action.methode || 'POST';
    if (req.method !== methode) {
      res.setHeader('Allow', methode);
      throw new HttpError(405, 'methode', 'Méthode non autorisée');
    }
    const corps = methode === 'POST' ? await lireJson(req) : {};
    const resultat = await action.executer({ req, res, corps, query: req.query || {} });
    if (!res.writableEnded) envoyerJson(res, 200, resultat ?? { ok: true });
  } catch (err) {
    envoyerErreur(res, err);
  }
}
