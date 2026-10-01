// Lecture des variables d'environnement. Aucune valeur par défaut pour les secrets.
const REQUISES = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY',
  'EMAIL_ADMIN', 'SITE_URL', 'CRON_SECRET'
];

export function env(nom, { optionnel = false } = {}) {
  const v = process.env[nom];
  if (!v && !optionnel) throw new Error(`Variable d'environnement manquante : ${nom}`);
  return v || '';
}

export function siteUrl() {
  return env('SITE_URL').replace(/\/+$/, '');
}

export function variablesManquantes() {
  return REQUISES.filter((n) => !process.env[n]);
}
