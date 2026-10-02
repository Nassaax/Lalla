// /t/:id — page de partage d'une tenue (WhatsApp, Instagram, Messenger…).
// Les robots des réseaux sociaux n'exécutent pas JavaScript : les balises Open Graph sont rendues ici,
// puis le visiteur est redirigé vers la fiche.
import { db } from '../lib/supabase.js';
import { siteUrl } from '../lib/env.js';
import { MARQUE } from '../lib/config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LIBELLES = { caftan: 'Caftan', takchita: 'Takchita', mariee: 'Tenue de mariée', homme: 'Tenue homme', enfant: 'Enfant', accessoire: 'Accessoire' };

export default async function handler(req, res) {
  const id = String(req.query?.id || '');
  const site = siteUrl();
  let tn = null;
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const { data } = await db().from('tenues')
      .select('id, titre, description, categorie, ville, prix_location_cents, statut, tenue_photos(type, chemin, ordre), fournisseuse:profils(nom_affiche, boutique_nom)')
      .eq('id', id).eq('statut', 'validee').maybeSingle();
    tn = data;
  }
  const cible = tn ? `${site}/tenue.html?id=${tn.id}` : `${site}/catalogue.html`;
  const photos = (tn?.tenue_photos || []).filter((p) => !p.chemin.startsWith('placeholder:'));
  const photo = photos.find((p) => p.type === 'portee') || photos.find((p) => p.type === 'face');
  const image = photo ? `${process.env.SUPABASE_URL}/storage/v1/object/public/tenues/${photo.chemin}` : `${site}/assets/og-default.jpg`;
  const prix = tn ? `${(tn.prix_location_cents / 100).toFixed(0)} €` : '';
  const titre = tn ? `${tn.titre} | ${prix} la location | ${MARQUE}` : `${MARQUE} | location de tenues marocaines`;
  const nomBoutique = tn?.fournisseuse?.boutique_nom || tn?.fournisseuse?.nom_affiche || '';
  const desc = tn ? `${LIBELLES[tn.categorie] || ''} à louer à ${tn.ville}${nomBoutique ? `, proposé par ${nomBoutique}` : ''}. ${(tn.description || '').slice(0, 120)}` : 'Portez l\'exceptionnel, le temps d\'une fête.';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.end(`<!doctype html><html lang="fr-BE"><head><meta charset="utf-8">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(cible)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="${esc(MARQUE)}">
<meta property="og:title" content="${esc(titre)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(cible)}"><meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(tn?.titre || MARQUE)}">
${tn ? `<meta property="product:price:amount" content="${(tn.prix_location_cents / 100).toFixed(2)}"><meta property="product:price:currency" content="EUR">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(cible)}">
</head><body style="font-family:system-ui;background:#F4EEE3;color:#121110;padding:40px">
<p><a href="${esc(cible)}">${esc(tn?.titre || MARQUE)}</a></p>
</body></html>`);
}
