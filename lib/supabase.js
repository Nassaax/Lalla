import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { HttpError } from './http.js';

let client;

/** Client service_role : contourne RLS. À n'utiliser que côté serveur, après vérification des droits. */
export function db() {
  if (!client) {
    client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }
  return client;
}

/** Déballe une réponse supabase-js et lève une erreur 500 explicite si besoin. */
export function ok({ data, error }, contexte = 'base de données') {
  if (error) {
    const e = new HttpError(500, 'erreur_base', `Erreur ${contexte}`);
    e.cause = error;
    e.pg = error;
    throw e;
  }
  return data;
}

/** Identifie l'utilisatrice à partir du JWT Supabase (en-tête Authorization). */
export async function utilisatrice(req, { requise = true } = {}) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const jeton = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!jeton) {
    if (requise) throw new HttpError(401, 'non_connecte', 'Connexion requise');
    return null;
  }
  const { data, error } = await db().auth.getUser(jeton);
  if (error || !data?.user) {
    if (requise) throw new HttpError(401, 'session_invalide', 'Session expirée, reconnectez-vous');
    return null;
  }
  const profil = ok(await db().from('profils').select('*').eq('id', data.user.id).single(), 'profil');
  if (profil.statut_compte === 'suspendu') throw new HttpError(403, 'compte_suspendu', 'Compte suspendu');
  return { id: data.user.id, email: data.user.email, profil };
}

export async function exigerAdmin(req) {
  const u = await utilisatrice(req);
  if (!u.profil.est_admin) throw new HttpError(403, 'admin_requis', 'Accès réservé à l\'équipe');
  return u;
}
