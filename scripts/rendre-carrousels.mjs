#!/usr/bin/env node
// Exporte chaque diapositive (section.s[data-nom]) de marque/carrousels/carrousels.html en PNG 1080x1350.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const source = path.resolve('marque/carrousels/carrousels.html');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 1500 } });
await p.goto('file://' + source);
await p.evaluate(() => document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))));
const slides = await p.locator('section.s').all();
for (const s of slides) {
  const nom = await s.getAttribute('data-nom');
  const fichier = nom.startsWith('video/') ? path.resolve('marque', nom + '.png') : path.resolve('marque/carrousels', nom + '.png');
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  await s.screenshot({ path: fichier });
}
console.log(slides.length + ' diapositives exportées.');
await b.close();
