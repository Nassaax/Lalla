// Génère assets/og-default.jpg (1200×630), l'aperçu de partage par défaut, à partir d'une composition originale.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import '../assets/config.js';
const nom = globalThis.LALLA_CONFIG.brand.name;
const arche = "M0 500V170C0 80 80 14 200 0C320 14 400 80 400 170V500Z";
const rosace = readFileSync('index.html', 'utf8').match(/<svg class="hero__zellige hero__zellige--1"[\s\S]*?<\/svg>/)[0].replace('class="hero__zellige hero__zellige--1"', 'class="z"');
const html = `<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:#F4EEE3;font-family:Georgia,serif;overflow:hidden;position:relative">
<style>.z{position:absolute;width:520px;right:-120px;top:-120px;color:#B8975A;opacity:.5}.z path{fill:none;stroke:currentColor;stroke-width:1}</style>
${rosace}
<div style="position:absolute;left:90px;top:150px;width:620px">
  <div style="font-family:Arial,sans-serif;font-size:20px;letter-spacing:.3em;color:#8C6F3A;margin-bottom:28px">BRUXELLES · LIÈGE · ANVERS</div>
  <div style="font-size:120px;letter-spacing:.3em;color:#121110;line-height:1">${nom}</div>
  <div style="font-size:44px;font-style:italic;color:#1F5E4B;margin-top:34px;line-height:1.2">Portez l'exceptionnel,<br>le temps d'une fête.</div>
</div>
<svg viewBox="0 0 400 500" style="position:absolute;right:120px;bottom:-40px;width:330px"><path d="${arche}" fill="#1F5E4B"/><path d="M20 500V180C20 98 92 38 200 26C308 38 380 98 380 180V500" fill="none" stroke="#D9C597" stroke-width="2"/></svg>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html);
await p.screenshot({ path: 'assets/og-default.jpg', type: 'jpeg', quality: 88 });
await b.close();
console.log('assets/og-default.jpg généré');
