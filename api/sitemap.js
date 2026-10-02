// sitemap.xml dynamique : pages publiques, tenues validées, boutiques.
import { db } from '../lib/supabase.js';
import { siteUrl } from '../lib/env.js';

const STATIQUES = ['', 'catalogue.html', 'partenaires.html', 'conditions.html', 'mentions-legales.html', 'confidentialite.html',
  'catalogue.html?categorie=caftan', 'catalogue.html?categorie=takchita', 'catalogue.html?categorie=mariee',
  'catalogue.html?ville=Bruxelles', 'catalogue.html?ville=Li%C3%A8ge', 'catalogue.html?ville=Anvers'];

export default async function handler(req, res) {
  const site = siteUrl();
  const [tenues, boutiques] = await Promise.all([
    db().from('tenues').select('id, updated_at').eq('statut', 'validee').limit(5000),
    db().from('profils').select('id, created_at').eq('est_fournisseuse', true).eq('compte_valide', true).in('type_fournisseuse', ['negafa', 'creatrice']).limit(2000)
  ]);
  const url = (loc, lastmod, prio) => `<url><loc>${loc.replace(/&/g, '&amp;')}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}<priority>${prio}</priority>` +
    `<xhtml:link rel="alternate" hreflang="nl-BE" href="${(loc + (loc.includes('?') ? '&' : '?') + 'lang=nl').replace(/&/g, '&amp;')}"/></url>`;
  const corps = [
    ...STATIQUES.map((p) => url(`${site}/${p}`, null, p === '' ? '1.0' : '0.7')),
    ...(tenues.data || []).map((t) => url(`${site}/tenue.html?id=${t.id}`, t.updated_at, '0.8')),
    ...(boutiques.data || []).map((b) => url(`${site}/boutique.html?id=${b.id}`, b.created_at, '0.6'))
  ];
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${corps.join('\n')}\n</urlset>`);
}
