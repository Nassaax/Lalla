// Simulateur local de l'API Stripe, utilisé uniquement par les tests de bout en bout
// (l'API Stripe réelle n'est pas joignable depuis l'environnement de test).
// Couvre : customers, checkout.sessions (payment/setup) avec page de paiement simulée,
// payment_intents (dont capture_method manual), setup_intents, refunds, transfers,
// accounts/account_links (Connect Express), identity.verification_sessions.
// Les webhooks sont signés avec la même méthode que Stripe (stripe.webhooks.generateTestHeaderString).
import http from 'node:http';
import Stripe from 'stripe';

const stripeSign = new Stripe('sk_test_signature');

function parseForm(corps) {
  const racine = {};
  for (const [cleBrute, valeur] of new URLSearchParams(corps)) {
    const cles = cleBrute.replace(/\]/g, '').split('[');
    let o = racine;
    cles.forEach((k, i) => {
      const dernier = i === cles.length - 1;
      const suivantNum = !dernier && /^\d+$/.test(cles[i + 1]);
      if (dernier) o[k] = valeur;
      else { o[k] = o[k] || (suivantNum ? [] : {}); o = o[k]; }
    });
  }
  return racine;
}

export async function demarrerStripeMock({ port = 12111, webhookUrl, secret }) {
  const etat = { objets: new Map(), journal: [], refuserProchaineEmpreinte: false, n: 0 };
  const base = `http://localhost:${port}`;
  const id = (p) => `${p}_test_${(++etat.n).toString(36)}${Date.now().toString(36).slice(-4)}`;
  const sauver = (o) => { etat.objets.set(o.id, o); return o; };

  async function webhook(type, objet) {
    const evt = { id: id('evt'), object: 'event', type, created: Math.floor(Date.now() / 1000), data: { object: objet }, livemode: false, api_version: '2025-08-27.basil' };
    const payload = JSON.stringify(evt);
    const signature = stripeSign.webhooks.generateTestHeaderString({ payload, secret });
    etat.journal.push({ webhook: type, id: objet.id });
    const r = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: payload });
    if (!r.ok) etat.journal.push({ webhook_erreur: type, statut: r.status, corps: await r.text() });
    return r.status;
  }
  etat.webhook = webhook;

  function creerPI(p) {
    const manuel = p.capture_method === 'manual';
    const pi = sauver({
      id: id('pi'), object: 'payment_intent', amount: Number(p.amount), currency: p.currency || 'eur', customer: p.customer || null,
      payment_method: p.payment_method || id('pm'), capture_method: p.capture_method || 'automatic', transfer_group: p.transfer_group || null,
      metadata: p.metadata || {}, status: manuel ? 'requires_capture' : 'succeeded', amount_capturable: manuel ? Number(p.amount) : 0,
      amount_received: manuel ? 0 : Number(p.amount), latest_charge: id('ch'), description: p.description || null
    });
    return pi;
  }

  async function payerSession(s) {
    if (s.mode === 'setup') {
      const si = sauver({ id: id('seti'), object: 'setup_intent', status: 'succeeded', payment_method: id('pm_carte'), customer: s.customer, metadata: s.setup_intent_data?.metadata || {} });
      s.setup_intent = si.id; s.status = 'complete';
      await webhook('checkout.session.completed', s);
      await webhook('setup_intent.succeeded', si);
      return;
    }
    const pid = s.payment_intent_data || {};
    // Paiement par carte avec setup_future_usage : la carte est rattachée au client (réutilisable pour la caution).
    // Paiement Bancontact (piloté par /__test/payer-bancontact) : aucun moyen de paiement réutilisable.
    const bancontact = etat.prochainPaiementBancontact; etat.prochainPaiementBancontact = false;
    const carte = !bancontact && s.payment_method_options?.card?.setup_future_usage
      ? sauver({ id: id('pm_carte'), object: 'payment_method', type: 'card', customer: s.customer }) : null;
    const pi = creerPI({ amount: s.amount_total, customer: s.customer, capture_method: pid.capture_method, transfer_group: pid.transfer_group, metadata: pid.metadata || {}, payment_method: carte?.id });
    s.payment_intent = pi.id; s.payment_status = 'paid'; s.status = 'complete';
    await webhook('checkout.session.completed', s);
    if (pi.status === 'requires_capture') await webhook('payment_intent.amount_capturable_updated', pi);
    else await webhook('payment_intent.succeeded', pi);
  }

  const serveur = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    const corps = await new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); });
    const p = req.headers['content-type']?.includes('x-www-form-urlencoded') ? parseForm(corps) : {};
    const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const html = (contenu) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px">${contenu}</body>`); };
    const rediriger = (u) => { res.writeHead(303, { Location: u }); res.end(); };
    const chemin = url.pathname;
    etat.journal.push({ appel: `${req.method} ${chemin}`, p });
    let m;
    try {
      // --- Pages simulées (navigateur)
      if ((m = chemin.match(/^\/checkout\/([\w]+)$/))) {
        const s = etat.objets.get(m[1]);
        return html(`<h1>Stripe (simulation)</h1><p id="montant">${s.mode === 'setup' ? 'Enregistrement de carte' : (s.amount_total / 100).toFixed(2) + ' EUR'}</p>
          <form method="post" action="/checkout/${s.id}/payer"><button id="payer" type="submit">Payer</button></form>
          <form method="post" action="/checkout/${s.id}/annuler"><button id="annuler" type="submit">Annuler</button></form>`);
      }
      if ((m = chemin.match(/^\/checkout\/([\w]+)\/payer$/))) {
        const s = etat.objets.get(m[1]);
        await payerSession(s);
        return rediriger(s.success_url.replace('{CHECKOUT_SESSION_ID}', s.id));
      }
      if ((m = chemin.match(/^\/checkout\/([\w]+)\/annuler$/))) return rediriger(etat.objets.get(m[1]).cancel_url);
      if ((m = chemin.match(/^\/connect\/([\w]+)$/))) {
        const a = etat.objets.get(m[1]);
        if (req.method === 'POST') {
          Object.assign(a, { details_submitted: true, payouts_enabled: true, charges_enabled: true, requirements: { currently_due: [] } });
          await webhook('account.updated', a);
          return rediriger(a._return_url);
        }
        return html(`<h1>Stripe Connect (simulation)</h1><form method="post"><button id="terminer" type="submit">Terminer l'inscription</button></form>`);
      }
      if ((m = chemin.match(/^\/identity\/([\w]+)$/))) {
        const v = etat.objets.get(m[1]);
        if (req.method === 'POST') { v.status = 'verified'; await webhook('identity.verification_session.verified', v); return rediriger(v.return_url); }
        return html(`<h1>Stripe Identity (simulation)</h1><form method="post"><button id="verifier" type="submit">Vérifier</button></form>`);
      }
      // --- Pilotage des tests
      if (chemin === '/__test/refuser-empreinte') { etat.refuserProchaineEmpreinte = true; return json(200, { ok: true }); }
      if (chemin === '/__test/payer-bancontact') { etat.prochainPaiementBancontact = true; return json(200, { ok: true }); }
      if (chemin === '/__test/journal') return json(200, etat.journal);

      // --- API
      if (chemin === '/v1/customers' && req.method === 'POST') return json(200, sauver({ id: id('cus'), object: 'customer', email: p.email, metadata: p.metadata || {} }));
      if (chemin === '/v1/checkout/sessions' && req.method === 'POST') {
        const total = (p.line_items || []).reduce((s, l) => s + Number(l.price_data.unit_amount) * Number(l.quantity || 1), 0);
        const s = sauver({ id: id('cs'), object: 'checkout.session', mode: p.mode, customer: p.customer, metadata: p.metadata || {}, amount_total: total,
          payment_intent_data: p.payment_intent_data, payment_method_options: p.payment_method_options, setup_intent_data: p.setup_intent_data, success_url: p.success_url, cancel_url: p.cancel_url,
          payment_method_types: p.payment_method_types, client_reference_id: p.client_reference_id, payment_status: 'unpaid', status: 'open' });
        s.url = `${base}/checkout/${s.id}`;
        return json(200, s);
      }
      if ((m = chemin.match(/^\/v1\/payment_intents\/(\w+)$/)) && req.method === 'GET') return json(200, etat.objets.get(m[1]));
      if (chemin === '/v1/payment_intents' && req.method === 'POST') {
        if (etat.refuserProchaineEmpreinte) {
          etat.refuserProchaineEmpreinte = false;
          const pi = sauver({ id: id('pi'), object: 'payment_intent', status: 'requires_payment_method', metadata: p.metadata || {}, amount: Number(p.amount) });
          return json(402, { error: { type: 'card_error', code: 'card_declined', message: 'Your card was declined.', payment_intent: pi } });
        }
        const pi = creerPI(p);
        if (pi.status === 'requires_capture') setTimeout(() => webhook('payment_intent.amount_capturable_updated', pi), 50);
        return json(200, pi);
      }
      if ((m = chemin.match(/^\/v1\/payment_intents\/(\w+)\/capture$/))) {
        const pi = etat.objets.get(m[1]);
        const montant = Number(p.amount_to_capture || pi.amount_capturable);
        Object.assign(pi, { status: 'succeeded', amount_received: montant, amount_capturable: 0 });
        return json(200, pi);
      }
      if ((m = chemin.match(/^\/v1\/payment_intents\/(\w+)\/cancel$/))) {
        const pi = etat.objets.get(m[1]);
        pi.status = 'canceled';
        setTimeout(() => webhook('payment_intent.canceled', pi), 50);
        return json(200, pi);
      }
      if ((m = chemin.match(/^\/v1\/payment_methods\/(\w+)$/))) {
        const pm = etat.objets.get(m[1]);
        return pm ? json(200, pm) : json(404, { error: { type: 'invalid_request_error', message: 'No such PaymentMethod' } });
      }
      if ((m = chemin.match(/^\/v1\/setup_intents\/(\w+)$/))) return json(200, etat.objets.get(m[1]));
      if (chemin === '/v1/refunds') return json(200, sauver({ id: id('re'), object: 'refund', amount: Number(p.amount || 0), payment_intent: p.payment_intent, status: 'succeeded', metadata: p.metadata || {} }));
      if (chemin === '/v1/transfers') return json(200, sauver({ id: id('tr'), object: 'transfer', amount: Number(p.amount), destination: p.destination, transfer_group: p.transfer_group, source_transaction: p.source_transaction || null, metadata: p.metadata || {} }));
      if (chemin === '/v1/accounts' && req.method === 'POST') return json(200, sauver({ id: id('acct'), object: 'account', type: 'express', email: p.email, details_submitted: false, payouts_enabled: false, charges_enabled: false, requirements: { currently_due: ['external_account'] }, metadata: p.metadata || {} }));
      if ((m = chemin.match(/^\/v1\/accounts\/(\w+)$/))) {
        const a = etat.objets.get(m[1]) || { id: m[1], object: 'account', details_submitted: true, payouts_enabled: true, requirements: { currently_due: [] } };
        return json(200, a);
      }
      if ((m = chemin.match(/^\/v1\/accounts\/(\w+)\/login_links$/))) return json(200, { object: 'login_link', url: `${base}/connect/${m[1]}` });
      if (chemin === '/v1/account_links') {
        const a = etat.objets.get(p.account);
        if (a) a._return_url = p.return_url;
        return json(200, { object: 'account_link', url: `${base}/connect/${p.account}` });
      }
      if (chemin === '/v1/identity/verification_sessions') {
        const v = sauver({ id: id('vs'), object: 'identity.verification_session', status: 'requires_input', metadata: p.metadata || {}, return_url: p.return_url });
        v.url = `${base}/identity/${v.id}`;
        return json(200, v);
      }
      return json(404, { error: { type: 'invalid_request_error', message: `Route non simulée : ${req.method} ${chemin}` } });
    } catch (e) {
      return json(500, { error: { type: 'api_error', message: e.message } });
    }
  });
  await new Promise((ok) => serveur.listen(port, ok));
  return { base, etat, arreter: () => serveur.close() };
}
