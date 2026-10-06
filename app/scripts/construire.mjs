// Construit l'interface de l'application dans app/www à partir de celle du site (sans jamais modifier le site) :
// copie des pages et des fichiers, puis ajout de la couche « app » (src/natif.js, src/natif.css).
// Usage : node scripts/construire.mjs [adresse du site]   (par défaut, l'adresse de production)
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(ici, '..');
const site = path.resolve(app, '..');
const www = path.join(app, 'www');
const SITE = (process.argv[2] || process.env.LALLAT_SITE || 'https://lalla-pearl.vercel.app').replace(/\/+$/, '');

// Pages utiles dans l'app (l'administration reste sur le site)
const PAGES = readdirSync(site).filter((f) => f.endsWith('.html') && !['admin.html', 'offline.html'].includes(f));

rmSync(www, { recursive: true, force: true });
mkdirSync(path.join(www, 'app'), { recursive: true });
cpSync(path.join(site, 'assets'), path.join(www, 'assets'), { recursive: true, filter: (src) => !src.endsWith('admin.js') });

function remplacer(texte, avant, apres, fichier, min = 1) {
  const n = texte.split(avant).length - 1;
  if (n < min) throw new Error(`${fichier} : motif introuvable « ${avant} » (le site a changé, adapter scripts/construire.mjs)`);
  return texte.split(avant).join(apres);
}

function remplacerMotif(texte, motif, fn, fichier) {
  if (!motif.test(texte)) throw new Error(`${fichier} : motif introuvable ${motif} (le site a changé, adapter scripts/construire.mjs)`);
  return texte.replace(motif, fn);
}

for (const page of PAGES) {
  let html = readFileSync(path.join(site, page), 'utf8');
  // Configuration publique (Supabase) servie par le site
  html = remplacer(html, '<script src="/api/config"></script>', `<script src="${SITE}/api/config"></script>`, page);
  // Couche app : chargée avant tout le reste, styles après ceux du site
  html = remplacerMotif(html, /<script src="assets\/config\.js(\?v=[\w-]+)?"><\/script>/, (m) => '<script src="app/natif.js"></script>\n  ' + m, page);
  html = remplacerMotif(html, /<link rel="stylesheet" href="assets\/style\.css(\?v=[\w-]+)?">/, (m) => m + '\n  <link rel="stylesheet" href="app/natif.css">', page);
  writeFileSync(path.join(www, page), html);
}

// Liens partagés et adresses de retour par email : toujours l'adresse publique du site
for (const f of ['app.js', 'pages.js', 'compte.js']) {
  const p = path.join(www, 'assets', f);
  if (!existsSync(p)) continue;
  writeFileSync(p, readFileSync(p, 'utf8').split('location.origin').join('(window.LALLAT_SITE || location.origin)'));
}

writeFileSync(path.join(www, 'app', 'natif.js'), readFileSync(path.join(app, 'src', 'natif.js'), 'utf8').replace('__LALLAT_SITE__', SITE));
cpSync(path.join(app, 'src', 'natif.css'), path.join(www, 'app', 'natif.css'));
console.log(`Interface de l'app construite : ${PAGES.length} pages, serveur ${SITE}`);
