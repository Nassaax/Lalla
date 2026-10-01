// Outils HTTP communs aux fonctions Vercel.
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export function envoyerJson(res, status, corps) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corps));
}

export function envoyerErreur(res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  const code = err instanceof HttpError ? err.code : 'erreur_interne';
  if (status >= 500) console.error('[api]', code, err.message, err.cause || err.pg || err.stack);
  envoyerJson(res, status, { erreur: code, message: status >= 500 ? 'Une erreur est survenue.' : err.message });
}

/** Corps JSON (Vercel le parse pour nous ; le serveur de dev fournit le même comportement). */
export async function lireJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const brut = typeof req.body === 'string' ? req.body : (await lireBrut(req)).toString('utf8');
  if (!brut) return {};
  try { return JSON.parse(brut); } catch { throw new HttpError(400, 'json_invalide', 'Requête invalide'); }
}

export function lireBrut(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const morceaux = [];
    req.on('data', (c) => morceaux.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(morceaux)));
    req.on('error', reject);
  });
}

export function ipDe(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'inconnue';
}

// Validation légère
export const verif = {
  uuid(v, nom = 'id') {
    if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
      throw new HttpError(400, 'parametre_invalide', `${nom} invalide`);
    }
    return v;
  },
  date(v, nom = 'date') {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + 'T00:00:00Z'))) {
      throw new HttpError(400, 'parametre_invalide', `${nom} invalide`);
    }
    return v;
  },
  texte(v, { nom = 'texte', min = 0, max = 1000, optionnel = false } = {}) {
    if (v == null || v === '') {
      if (optionnel) return null;
      throw new HttpError(400, 'parametre_invalide', `${nom} requis`);
    }
    const s = String(v).trim();
    if (s.length < min || s.length > max) throw new HttpError(400, 'parametre_invalide', `${nom} : longueur invalide`);
    return s;
  },
  email(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 200) throw new HttpError(400, 'parametre_invalide', 'Email invalide');
    return s;
  },
  choix(v, valeurs, nom = 'valeur') {
    if (!valeurs.includes(v)) throw new HttpError(400, 'parametre_invalide', `${nom} invalide`);
    return v;
  },
  entier(v, { nom = 'nombre', min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, 'parametre_invalide', `${nom} invalide`);
    return n;
  }
};
