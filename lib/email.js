// Emails transactionnels via Resend (API HTTP, sans dépendance).
import { env, siteUrl } from './env.js';
import { MARQUE, CONFIG } from './config.js';
import { MODELES } from './emails-modeles.js';

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function rendreEmail(modele, langue, vars = {}) {
  const m = MODELES[modele];
  if (!m) throw new Error(`Modèle d'email inconnu : ${modele}`);
  const l = m[langue] ? langue : 'fr';
  const t = m[l];
  const remplir = (s) => s.replace(/\{(\w+)\}/g, (_, k) => (k === 'marque' ? MARQUE : echapper(vars[k] ?? '')));
  const sujet = remplir(t.sujet);
  const paragraphes = t.corps.map(remplir);
  const lien = vars.lien ? (vars.lien.startsWith('http') ? vars.lien : siteUrl() + vars.lien) : null;
  const html = `<!doctype html><html lang="${l}"><body style="margin:0;background:#F4EEE3;font-family:Manrope,Arial,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#FBF8F2;border:1px solid #E4D9C4">
<tr><td style="padding:28px 32px 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;letter-spacing:.18em">${echapper(MARQUE)}</td></tr>
<tr><td style="padding:8px 32px 24px;font-size:15px;line-height:1.6">
${paragraphes.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join('')}
${lien ? `<p style="margin:24px 0 8px"><a href="${echapper(lien)}" style="display:inline-block;background:#141414;color:#F4EEE3;text-decoration:none;padding:12px 22px;font-size:14px;letter-spacing:.04em">${echapper(remplir(t.bouton || (l === 'nl' ? 'Openen' : 'Ouvrir')))}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #E4D9C4;font-size:12px;color:#5b5b5b">${echapper(MARQUE)} · ${echapper(CONFIG.brand.email)}</td></tr>
</table></td></tr></table></body></html>`;
  const texte = [...paragraphes.map((p) => p.replace(/<[^>]+>/g, '')), lien || ''].join('\n\n');
  return { sujet, html, texte };
}

// En test, les emails sont gardés en mémoire au lieu d'être envoyés.
export const boiteTest = [];

export async function envoyerEmail({ a, modele, langue = 'fr', vars = {} }) {
  if (!a) return { ignore: true };
  const { sujet, html, texte } = rendreEmail(modele, langue, vars);
  if (process.env.EMAIL_MODE === 'journal') {
    boiteTest.push({ a, modele, sujet, vars });
    console.log(`[email] → ${a} : ${sujet}`);
    return { journal: true };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${MARQUE} <${CONFIG.brand.email}>`,
        to: Array.isArray(a) ? a : [a],
        subject: sujet,
        html,
        text: texte
      })
    });
    if (!r.ok) console.error('[email] Resend', r.status, await r.text());
    return { ok: r.ok };
  } catch (e) {
    // Un email qui échoue ne doit jamais bloquer un paiement ou une transition.
    console.error('[email] échec', e.message);
    return { ok: false };
  }
}

export function emailAdmin() {
  return env('EMAIL_ADMIN');
}
