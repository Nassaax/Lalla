// Webhook Stripe : corps brut, signature vérifiée, idempotence par identifiant d'événement.
import { lireBrut, envoyerJson } from '../lib/http.js';
import { construireEvenement } from '../lib/stripe.js';
import { db } from '../lib/supabase.js';
import { traiterEvenement } from '../lib/webhook-stripe.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return envoyerJson(res, 405, { erreur: 'methode' }); }
  let evt;
  try {
    const brut = await lireBrut(req);
    evt = construireEvenement(brut, req.headers['stripe-signature']);
  } catch (e) {
    console.warn('[webhook] signature invalide', e.message);
    return envoyerJson(res, 400, { erreur: 'signature_invalide' });
  }

  const { data: existant } = await db().from('evenements_stripe').select('id, traite_at').eq('id', evt.id).maybeSingle();
  if (existant?.traite_at) return envoyerJson(res, 200, { recu: true, doublon: true });
  if (!existant) {
    const { error } = await db().from('evenements_stripe').insert({ id: evt.id, type: evt.type });
    if (error && error.code !== '23505') return envoyerJson(res, 500, { erreur: 'base' });
  }

  try {
    await traiterEvenement(evt);
    await db().from('evenements_stripe').update({ traite_at: new Date().toISOString(), erreur: null }).eq('id', evt.id);
    return envoyerJson(res, 200, { recu: true });
  } catch (e) {
    console.error('[webhook]', evt.type, evt.id, e.message, e.pg || '');
    await db().from('evenements_stripe').update({ erreur: String(e.message).slice(0, 500) }).eq('id', evt.id);
    // 500 : Stripe renverra l'événement (nouvelle tentative automatique).
    return envoyerJson(res, 500, { erreur: 'traitement' });
  }
}
