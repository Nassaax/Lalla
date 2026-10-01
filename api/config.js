// Expose au navigateur les seules valeurs publiques (URL et clé anon Supabase, URL du site).
export default function handler(req, res) {
  const env = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    siteUrl: (process.env.SITE_URL || '').replace(/\/+$/, '')
  };
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.end(`window.LALLA_ENV=${JSON.stringify(env)};`);
}
