import Stripe from 'stripe';
import { env } from './env.js';

let client;

export function stripe() {
  if (!client) {
    const options = { appInfo: { name: 'LALLA' }, maxNetworkRetries: 2 };
    // Uniquement pour les tests automatisés : redirige vers un simulateur local de l'API Stripe.
    if (process.env.STRIPE_API_HOST && process.env.NODE_ENV === 'test') {
      const u = new URL(process.env.STRIPE_API_HOST);
      Object.assign(options, { host: u.hostname, port: Number(u.port), protocol: u.protocol.replace(':', '') });
    }
    client = new Stripe(env('STRIPE_SECRET_KEY'), options);
  }
  return client;
}

export function secretsWebhook() {
  return env('STRIPE_WEBHOOK_SECRET').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Vérifie la signature avec chacun des secrets configurés (endpoint compte + endpoint Connect). */
export function construireEvenement(corpsBrut, signature) {
  let derniereErreur;
  for (const secret of secretsWebhook()) {
    try {
      return stripe().webhooks.constructEvent(corpsBrut, signature, secret);
    } catch (e) {
      derniereErreur = e;
    }
  }
  throw derniereErreur || new Error('Signature absente');
}
