// Outils communs aux tests de bout en bout : pile locale, serveur, navigateur.
// Les CDN (jsDelivr) sont servis depuis node_modules pour que les tests tournent hors ligne,
// avec exactement les versions référencées dans les pages.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PORT = Number(process.env.E2E_PORT || 8787);
export const BASE = `http://localhost:${PORT}`;

const CDN = [
  [/^https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@3\.13\.0\/dist\/(.+)$/, (m) => `node_modules/gsap/dist/${m[1]}`],
  [/^https:\/\/cdn\.jsdelivr\.net\/npm\/lenis@1\.3\.4\/dist\/(.+)$/, (m) => `node_modules/lenis/dist/${m[1]}`],
  [/^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[\d.]+\/dist\/umd\/(.+)$/, (m) => `node_modules/@supabase/supabase-js/dist/umd/${m[1]}`],
  [/^https:\/\/cdn\.jsdelivr\.net\/npm\/browser-image-compression@2\.0\.2\/dist\/(.+)$/, (m) => `node_modules/browser-image-compression/dist/${m[1]}`]
];

export async function environnement({ stripeMock = null } = {}) {
  const { demarrerPile, CLES } = await import('../../scripts/stack-local.mjs');
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SUPABASE_URL: BASE,
    SUPABASE_ANON_KEY: CLES.anon,
    SUPABASE_SERVICE_ROLE_KEY: CLES.service,
    STRIPE_SECRET_KEY: 'sk_test_local',
    STRIPE_WEBHOOK_SECRET: 'whsec_local_test',
    RESEND_API_KEY: 're_test',
    EMAIL_ADMIN: 'admin@demo.lalla.be',
    EMAIL_MODE: 'journal',
    SITE_URL: BASE,
    CRON_SECRET: 'cron-local',
    ...(stripeMock ? { STRIPE_API_HOST: stripeMock } : {})
  });
  const pile = await demarrerPile({ reset: true });
  const { creerServeur } = await import('../../scripts/dev-server.mjs');
  const serveur = await creerServeur({ port: PORT });
  return {
    pile,
    serveur,
    arreter: async () => { serveur.close(); await pile.arreter(); }
  };
}

export async function navigateur() {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  return b;
}

/** Contexte navigateur avec CDN locaux et journal des erreurs console. */
export async function contexte(b, { largeur = 1440, hauteur = 900, mobile = false, reduit = false } = {}) {
  const ctx = await b.newContext({
    viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
    reducedMotion: reduit ? 'reduce' : 'no-preference', locale: 'fr-BE'
  });
  await ctx.route(/^https:\/\/cdn\.jsdelivr\.net\//, async (route) => {
    const url = route.request().url();
    for (const [motif, cible] of CDN) {
      const m = url.match(motif);
      if (m) return route.fulfill({ body: await readFile(path.join(racine, cible(m))), contentType: 'application/javascript' });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  // Polices Google : servies vides hors ligne (repli sur les polices système)
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  ctx.erreurs = [];
  ctx.on('page', (page) => suivreErreurs(page, ctx.erreurs));
  return ctx;
}

export function suivreErreurs(page, liste) {
  page.on('console', (msg) => { if (msg.type() === 'error') liste.push(`[console] ${page.url()} : ${msg.text()}`); });
  page.on('pageerror', (err) => liste.push(`[exception] ${page.url()} : ${err.message}`));
}

export async function attendreAnimations(page, ms = 2200) {
  await page.waitForTimeout(ms);
}
