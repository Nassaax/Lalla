import { db } from './supabase.js';

// Valeurs de repli si la table est vide (identiques à la migration 005).
export const DEFAUTS = {
  commission_taux: 0.15,
  frais_service_taux: 0.05,
  frais_pressing_cents: 1500,
  frais_essayage_cents: 1500,
  essayage_validite_jours: 30,
  caution_taux: 0.5,
  pressing_jours: 2,
  delai_reponse_heures: 24,
  delai_litige_heures: 48,
  delai_versement_heures: 24,
  seuil_identity_cents: 50000,
  empreinte_jours_avant: 2,
  seuil_setup_jours: 5,
  politique_annulation: [
    { jours_min: 30, pct: 100 },
    { jours_min: 14, pct: 50 },
    { jours_min: 0, pct: 0 }
  ],
  penalite_fournisseuse_cents: 2500,
  penalite_visibilite_points: 15
};

// Contrôle des valeurs saisies dans le back-office.
export const SCHEMA = {
  commission_taux: { type: 'taux', min: 0, max: 0.5 },
  frais_service_taux: { type: 'taux', min: 0, max: 0.3 },
  frais_pressing_cents: { type: 'entier', min: 0, max: 10000 },
  frais_essayage_cents: { type: 'entier', min: 0, max: 10000 },
  essayage_validite_jours: { type: 'entier', min: 1, max: 365 },
  caution_taux: { type: 'taux', min: 0.05, max: 1 },
  pressing_jours: { type: 'entier', min: 0, max: 10 },
  delai_reponse_heures: { type: 'entier', min: 1, max: 168 },
  delai_litige_heures: { type: 'entier', min: 1, max: 336 },
  delai_versement_heures: { type: 'entier', min: 0, max: 720 },
  seuil_identity_cents: { type: 'entier', min: 0, max: 10000000 },
  empreinte_jours_avant: { type: 'entier', min: 0, max: 6 },
  seuil_setup_jours: { type: 'entier', min: 1, max: 30 },
  politique_annulation: { type: 'politique' },
  penalite_fournisseuse_cents: { type: 'entier', min: 0, max: 100000 },
  penalite_visibilite_points: { type: 'entier', min: 0, max: 100 }
};

export function validerParametre(cle, valeur) {
  const s = SCHEMA[cle];
  if (!s) return { ok: false, message: 'Paramètre inconnu' };
  if (s.type === 'taux' || s.type === 'entier') {
    const n = Number(valeur);
    if (!Number.isFinite(n) || n < s.min || n > s.max) return { ok: false, message: `Valeur attendue entre ${s.min} et ${s.max}` };
    if (s.type === 'entier' && !Number.isInteger(n)) return { ok: false, message: 'Nombre entier attendu' };
    return { ok: true, valeur: n };
  }
  if (s.type === 'politique') {
    if (!Array.isArray(valeur) || valeur.length === 0 || valeur.length > 10) return { ok: false, message: 'Politique invalide' };
    const paliers = valeur.map((p) => ({ jours_min: Number(p.jours_min), pct: Number(p.pct) }));
    if (paliers.some((p) => !Number.isInteger(p.jours_min) || p.jours_min < 0 || !(p.pct >= 0 && p.pct <= 100))) {
      return { ok: false, message: 'Chaque palier : jours_min entier ≥ 0 et pct entre 0 et 100' };
    }
    if (!paliers.some((p) => p.jours_min === 0)) return { ok: false, message: 'Un palier à 0 jour est obligatoire' };
    paliers.sort((a, b) => b.jours_min - a.jours_min);
    return { ok: true, valeur: paliers };
  }
  return { ok: false, message: 'Type inconnu' };
}

let cache = null;
let cacheAt = 0;

export async function parametres({ frais = false } = {}) {
  if (!frais && cache && Date.now() - cacheAt < 30_000) return cache;
  const { data, error } = await db().from('parametres').select('cle, valeur');
  if (error) throw error;
  const p = { ...DEFAUTS };
  for (const ligne of data || []) p[ligne.cle] = ligne.valeur;
  cache = p;
  cacheAt = Date.now();
  return p;
}

export function viderCacheParametres() {
  cache = null;
}
