#!/usr/bin/env node
// Applique le nom et le domaine définis dans assets/config.js aux balises SEO statiques
// (<title>, Open Graph, JSON-LD, robots.txt). Le reste du site lit déjà la configuration.
// Usage : node scripts/rebrand.mjs [ancien_nom] [ancien_domaine]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import '../assets/config.js';

const { name, domaine } = globalThis.LALLA_CONFIG.brand;
const ancienNom = process.argv[2] || 'LALLA';
const ancienDomaine = process.argv[3] || 'lalla.be';
const fichiers = [...readdirSync('.').filter((f) => f.endsWith('.html')), 'robots.txt'];
let n = 0;
for (const f of fichiers) {
  const avant = readFileSync(f, 'utf8');
  const apres = avant
    .replaceAll(`https://${ancienDomaine}`, `https://${domaine}`)
    .replaceAll(`— ${ancienNom}<`, `— ${name}<`)
    .replaceAll(`content="${ancienNom}"`, `content="${name}"`)
    .replaceAll(`content="${ancienNom} —`, `content="${name} —`)
    .replaceAll(`"name":"${ancienNom}"`, `"name":"${name}"`)
    .replaceAll(`| ${ancienNom}"`, `| ${name}"`);
  if (apres !== avant) { writeFileSync(f, apres); n++; }
}
console.log(`${n} fichier(s) mis à jour avec « ${name} » (${domaine}).`);
