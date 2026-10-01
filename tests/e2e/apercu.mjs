// Captures d'écran rapides des pages publiques (développement).
import { environnement, navigateur, contexte, BASE, racine } from './outils.mjs';
import path from 'node:path';
const env = await environnement();
const { seed } = await import('../../scripts/seed-demo.mjs');
await seed();
const b = await navigateur();
const pages = (process.env.PAGES || 'index.html,catalogue.html').split(',');
const largeurs = (process.env.LARGEURS || '375,1440').split(',').map(Number);
for (const l of largeurs) {
  const ctx = await contexte(b, { largeur: l, hauteur: l < 800 ? 812 : 900, mobile: l < 800 });
  for (const p of pages) {
    const page = await ctx.newPage();
    let url = p;
    if (p.startsWith('tenue')) {
      const r = await env.pile.pool.query("select id from tenues where categorie='takchita' limit 1");
      url = 'tenue.html?id=' + r.rows[0].id;
    }
    if (p.startsWith('boutique')) {
      const r = await env.pile.pool.query("select id from profils where type_fournisseuse='negafa' limit 1");
      url = 'boutique.html?id=' + r.rows[0].id;
    }
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: path.join(racine, `.tmp/captures/${p.replace(/\W/g, '_')}-${l}.png`), fullPage: process.env.FULL === '1' });
    await page.close();
  }
  console.log(ctx.erreurs.join('\n') || `aucune erreur (${l}px)`);
  await ctx.close();
}
await b.close();
await env.arreter();
process.exit(0);
