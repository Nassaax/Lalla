#!/usr/bin/env node
// Exporte les dossiers de démarchage : une image PNG par page (pour Instagram et WhatsApp) et un PDF par dossier.
// Usage : node marque/demarchage/rendre.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const DOSSIERS = { tenues: 'lallat-fournisseuses', prestataires: 'lallat-prestataires' };
const b = await chromium.launch();

for (const [doc, nom] of Object.entries(DOSSIERS)) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto('file://' + path.join(ici, 'dossiers.html'));
  await p.evaluate(() => window.pret);
  // Ne garder que les pages du dossier, sans marges, pour les images comme pour le PDF
  await p.evaluate((d) => {
    document.querySelectorAll('.page').forEach((s) => { if (s.dataset.doc !== d) s.remove(); });
    document.body.style.cssText = 'background:none;padding:0;display:block';
    const st = document.createElement('style');
    st.textContent = '@page { size: 1080px 1350px; margin: 0 } .page { break-after: page }';
    document.head.appendChild(st);
  }, doc);
  const dossier = path.join(ici, nom);
  mkdirSync(dossier, { recursive: true });
  const pages = p.locator('.page');
  const n = await pages.count();
  for (let i = 0; i < n; i++) await pages.nth(i).screenshot({ path: path.join(dossier, `${String(i + 1).padStart(2, '0')}.png`) });
  // Le PDF est assemblé à partir des images : il est identique à ce qu'on voit (l'impression navigateur déforme les ombres)
  execFileSync('convert', [...Array.from({ length: n }, (_, i) => path.join(dossier, `${String(i + 1).padStart(2, '0')}.png`)), '-compress', 'jpeg', '-quality', '90', '-density', '144', path.join(ici, `${nom}.pdf`)]);
  console.log(`${nom} : ${n} pages`);
  await p.close();
}
await b.close();
