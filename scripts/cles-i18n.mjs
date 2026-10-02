// Liste les clés de traduction utilisées dans le code et absentes du dictionnaire (FR ou NL).
// Usage : node scripts/cles-i18n.mjs
import { readFileSync, readdirSync } from 'node:fs';
globalThis.window = {}; globalThis.localStorage = { getItem() {}, setItem() {} }; Object.defineProperty(globalThis, 'navigator', { value: { language: 'fr' }, configurable: true });
globalThis.location = { search: '' }; globalThis.document = { documentElement: {}, dispatchEvent() {} }; globalThis.CustomEvent = function () {};
await import('../assets/i18n.js');
const D = window.I18N.dictionnaire;
const js = ['assets/app.js', 'assets/pages.js', 'assets/compte.js', 'assets/admin.js'].flatMap((f) => { try { return [readFileSync(f, 'utf8')]; } catch { return []; } }).join('\n');
const html = readdirSync('.').filter((f) => f.endsWith('.html')).map((f) => readFileSync(f, 'utf8')).join('\n');
const clesJs = new Set([...js.matchAll(/\bt\('([a-z_]+\.[a-z0-9_.]+)'/g)].map((m) => m[1]).filter((k) => !k.endsWith('.') && !k.endsWith('_')));
// Clés passées en paramètre à L.ui.champ / panneaux
for (const m of js.matchAll(/L\.ui\.champ\('[a-z_]+', '([a-z_]+\.[a-z0-9_.]+)'/g)) clesJs.add(m[1]);
const clesHtml = new Set([...html.matchAll(/data-i18n(?:-html)?="([^"]+)"|content:([a-z.]+)/g)].map((m) => m[1] || m[2]));
const manqueFr = [...clesJs].filter((k) => D.fr[k] == null && !clesHtml.has(k));
const manqueNl = [...new Set([...clesJs, ...clesHtml])].filter((k) => D.nl[k] == null);
console.log('FR manquantes :', manqueFr.join(' ') || 'aucune');
console.log('NL manquantes :', manqueNl.join(' ') || 'aucune');
process.exitCode = manqueFr.length || manqueNl.length ? 1 : 0;
