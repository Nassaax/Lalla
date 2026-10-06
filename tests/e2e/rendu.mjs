// Rendu de toutes les pages à 375 / 768 / 1440 px : zéro erreur console, aucun défilement horizontal,
// bascule FR/NL sans rechargement, mouvement réduit respecté. Captures dans .tmp/captures/.
// Usage : node tests/e2e/rendu.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { environnement, navigateur, contexte, BASE, racine } from './outils.mjs';

const env = await environnement();
const { seed } = await import('../../scripts/seed-demo.mjs');
await seed();
const q = async (sql) => (await env.pile.pool.query(sql)).rows;
const [tenue] = await q(`select id from tenues where categorie = 'takchita' limit 1`);
const [boutique] = await q(`select id from profils where type_fournisseuse = 'negafa' limit 1`);
const dossier = path.join(racine, '.tmp/captures');
mkdirSync(dossier, { recursive: true });

const PUBLIQUES = ['index.html', 'catalogue.html', `tenue.html?id=${tenue.id}`, `boutique.html?id=${boutique.id}`, 'panier.html', 'partenaires.html', 'notre-histoire.html',
  'conditions.html', 'mentions-legales.html', 'confidentialite.html', 'compte.html', 'aide.html'];
const CONNECTEES = [
  ['cliente1@demo.lalla.be', ['compte.html?vue=reservations', 'compte.html?vue=mensurations', 'compte.html?vue=profil']],
  ['negafa1@demo.lalla.be', ['compte.html?vue=demandes', 'compte.html?vue=annonces', 'compte.html?vue=calendrier', 'compte.html?vue=revenus', 'compte.html?vue=boutique']],
  ['partenaire1@demo.lalla.be', ['compte.html?vue=partenaire', 'compte.html?vue=leads']],
  ['admin@demo.lalla.be', ['admin.html#tableau', 'admin.html#comptes', 'admin.html#parametres', 'admin.html#showrooms']]
];

const b = await navigateur();
const problemes = [];
let captures = 0;

async function verifier(page, nom, largeur) {
  await page.waitForTimeout(1800);
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (debord > 1) problemes.push(`${nom} @${largeur}px : débordement horizontal de ${debord}px`);
  await page.screenshot({ path: path.join(dossier, `${nom.replace(/[^a-z0-9]+/gi, '_')}-${largeur}.png`), fullPage: largeur === 375 });
  captures++;
}

for (const largeur of [375, 768, 1440]) {
  const ctx = await contexte(b, { largeur, hauteur: largeur < 800 ? 812 : 900, mobile: largeur < 800 });
  const page = await ctx.newPage();
  for (const p of PUBLIQUES) {
    await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
    await verifier(page, p.split('?')[0], largeur);
  }
  for (const [email, vues] of process.env.SANS_CONNEXION ? [] : CONNECTEES) {
    const c2 = await contexte(b, { largeur, hauteur: largeur < 800 ? 812 : 900, mobile: largeur < 800 });
    const pg = await c2.newPage();
    await pg.goto(`${BASE}/compte.html?connexion=1`);
    await pg.waitForSelector('.modale.est-ouverte input[name=email]');
    await pg.fill('.modale input[name=email]', email);
    await pg.fill('.modale input[name=mdp]', 'Demo-Lalla-2026');
    await pg.click('.modale button[type=submit]');
    await pg.waitForSelector('.modale', { state: 'detached' }).catch(async (e) => {
      throw new Error(`connexion ${email} @${largeur}px : ${await pg.textContent('.modale')}`);
    });
    for (const v of vues) {
      await pg.goto(`${BASE}/${v}`, { waitUntil: 'networkidle' });
      await verifier(pg, v.replace(/[?#=]/g, '-'), largeur);
    }
    problemes.push(...c2.erreurs);
    await c2.close();
  }
  problemes.push(...ctx.erreurs);
  await ctx.close();
}

// Bascule FR → NL sans rechargement
{
  const ctx = await contexte(b, { largeur: 1440 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.__marqueur = 'sans-rechargement'; });
  await page.click('.langue__btn[lang=nl]');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__marqueur), 'sans-rechargement');
  assert.match(await page.textContent('[data-i18n="index.r.chercher"]'), /Zoeken/);
  assert.equal(await page.getAttribute('html', 'lang'), 'nl-BE');
  await page.goto(`${BASE}/catalogue.html`, { waitUntil: 'networkidle' });
  assert.match(await page.textContent('h1'), /De catalogus/);
  await page.screenshot({ path: path.join(dossier, 'catalogue-nl-1440.png') });
  problemes.push(...ctx.erreurs);
  await ctx.close();
  console.log('✓ bascule FR/NL sans rechargement (langue mémorisée entre les pages)');
}

// prefers-reduced-motion : pas de Lenis, contenu visible immédiatement
{
  const ctx = await contexte(b, { largeur: 1440, reduit: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('mouvement-reduit')), true);
  assert.equal(await page.evaluate(() => Boolean(window.Lalla.motion.lenis)), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#hero-titre')).opacity), '1');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.recherche')).opacity), '1');
  problemes.push(...ctx.erreurs);
  await ctx.close();
  console.log('✓ prefers-reduced-motion respecté');
}

await b.close();
await env.arreter();
console.log(`${captures} captures dans .tmp/captures/`);
if (problemes.length) { console.error('✗ Problèmes :\n' + problemes.join('\n')); process.exit(1); }
console.log('✓ zéro erreur console et aucun débordement à 375, 768 et 1440 px');
process.exit(0);
