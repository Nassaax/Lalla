// Stripe : Checkout (location), carte de caution, Identity, Connect Express, essayages.
import { db, ok, utilisatrice } from '../supabase.js';
import { stripe } from '../stripe.js';
import { HttpError, verif } from '../http.js';
import { estRobot, limiter } from '../antispam.js';
import { parametres, exigerReservationsOuvertes } from '../parametres.js';
import { siteUrl } from '../env.js';
import { MARQUE } from '../config.js';
import { calculerCommande } from '../pricing.js';
import { notifier, titresReservation, reference, formatDate } from '../metier.js';

async function clientStripe(u) {
  const prive = ok(await db().from('profils_prives').select('stripe_customer_id, prenom, nom').eq('id', u.id).single(), 'profil');
  if (prive.stripe_customer_id) return prive.stripe_customer_id;
  const c = await stripe().customers.create({
    email: u.email, name: [prive.prenom, prive.nom].filter(Boolean).join(' ') || undefined,
    metadata: { user_id: u.id }, preferred_locales: [u.profil.langue === 'nl' ? 'nl' : 'fr']
  }, { idempotencyKey: `client-${u.id}` });
  ok(await db().from('profils_prives').update({ stripe_customer_id: c.id }).eq('id', u.id), 'client Stripe');
  return c.id;
}

const localeStripe = (u) => (u.profil.langue === 'nl' ? 'nl' : 'fr');

async function chargerCommande(u, id) {
  const commande = ok(await db().from('commandes').select('*').eq('id', verif.uuid(id, 'commande')).maybeSingle(), 'commande');
  if (!commande || commande.cliente_id !== u.id) throw new HttpError(404, 'introuvable', 'Commande introuvable');
  return commande;
}

export const checkoutCreer = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    await limiter(req, 'checkout', { max: 20, fenetreSecondes: 3600, cle: u.id });
    const commande = await chargerCommande(u, corps.commande_id);
    if (commande.statut !== 'a_payer') throw new HttpError(409, 'pas_a_payer', commande.statut === 'payee' ? 'Cette commande est déjà réglée.' : 'Toutes les fournisseuses n\'ont pas encore répondu.');
    const resas = ok(await db().from('reservations').select('*').eq('commande_id', commande.id).eq('statut', 'acceptee'), 'réservations');
    if (!resas.length) throw new HttpError(409, 'vide', 'Aucune location acceptée à payer.');
    const totaux = calculerCommande(resas);

    // Stripe Identity obligatoire au-delà du seuil de caution
    const p = await parametres();
    if (totaux.caution > Number(p.seuil_identity_cents) && !u.profil.identite_verifiee) {
      ok(await db().from('commandes').update({ identite_requise: true }).eq('id', commande.id), 'identité requise');
      return { identite_requise: true, caution_cents: totaux.caution, seuil_cents: Number(p.seuil_identity_cents) };
    }

    const customer = await clientStripe(u);
    const profils = ok(await db().from('profils').select('id, nom_affiche, boutique_nom').in('id', resas.map((r) => r.fournisseuse_id)), 'fournisseuses');
    const nom = (id) => { const f = profils.find((x) => x.id === id); return f ? f.boutique_nom || f.nom_affiche : ''; };
    const lignes = [];
    for (const r of resas) {
      const titres = await titresReservation(r.id);
      const montant = r.montant_location_cents + r.frais_pressing_cents + r.frais_envoi_cents - r.deduction_essayage_cents;
      const details = [`Location ${formatDate(r.date_debut)} → ${formatDate(r.date_fin)}`];
      if (r.frais_pressing_cents) details.push(`pressing ${(r.frais_pressing_cents / 100).toFixed(2)} €`);
      if (r.frais_envoi_cents) details.push(`envoi assuré ${(r.frais_envoi_cents / 100).toFixed(2)} €`);
      if (r.deduction_essayage_cents) details.push(`essayage déduit −${(r.deduction_essayage_cents / 100).toFixed(2)} €`);
      lignes.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: montant, product_data: { name: `${titres} : ${nom(r.fournisseuse_id)}`.slice(0, 250), description: details.join(' · ') } } });
    }
    if (totaux.frais_service > 0) {
      lignes.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: totaux.frais_service, product_data: { name: `Frais de service ${MARQUE}`, description: 'Paiement sécurisé, vérifications, assistance' } } });
    }
    const base = `${siteUrl()}/panier.html?commande=${commande.id}`;
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      customer,
      client_reference_id: commande.id,
      payment_method_types: ['card', 'bancontact'],
      line_items: lignes,
      locale: localeStripe(u),
      payment_intent_data: {
        transfer_group: commande.transfer_group,
        description: `Commande ${reference(commande.id)}`,
        metadata: { type: 'commande', commande_id: commande.id }
      },
      metadata: { type: 'commande', commande_id: commande.id },
      success_url: `${base}&paiement=ok`,
      cancel_url: `${base}&paiement=annule`,
      expires_at: Math.floor(Date.now() / 1000) + 3600
    }, { idempotencyKey: `checkout-${commande.id}-${totaux.total}-${Math.floor(Date.now() / 600000)}` });
    ok(await db().from('commandes').update({ checkout_session_id: session.id, montant_total_cents: totaux.total, frais_service_cents: totaux.frais_service, deduction_essayage_cents: totaux.deduction }).eq('id', commande.id), 'session');
    return { url: session.url };
  }
};

/** Enregistrement de la carte de caution (Checkout en mode setup, carte uniquement). */
export const cautionSetup = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    const commande = await chargerCommande(u, corps.commande_id);
    if (commande.statut !== 'payee') throw new HttpError(409, 'pas_payee', 'Réglez d\'abord votre location.');
    const resas = ok(await db().from('reservations').select('id, caution_cents').eq('commande_id', commande.id).in('statut', ['payee', 'remise']).in('caution_statut', ['a_enregistrer', 'echec']), 'réservations');
    if (!resas.length) throw new HttpError(409, 'rien_a_faire', 'Votre carte de caution est déjà enregistrée.');
    const customer = await clientStripe(u);
    const base = `${siteUrl()}/panier.html?commande=${commande.id}&etape=caution`;
    const session = await stripe().checkout.sessions.create({
      mode: 'setup',
      customer,
      currency: 'eur',
      payment_method_types: ['card'],
      locale: localeStripe(u),
      client_reference_id: commande.id,
      setup_intent_data: { description: `Carte de caution, commande ${reference(commande.id)}`, metadata: { type: 'caution', commande_id: commande.id } },
      metadata: { type: 'caution', commande_id: commande.id },
      success_url: `${base}&caution=ok`,
      cancel_url: `${base}&caution=annule`
    });
    ok(await db().from('commandes').update({ setup_checkout_session_id: session.id }).eq('id', commande.id), 'session setup');
    return { url: session.url };
  }
};

/** Après un échec d'empreinte : la cliente autorise la caution en direct (3-D Secure possible). */
export const cautionReessayer = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    const id = verif.uuid(corps.reservation_id, 'réservation');
    const resa = ok(await db().from('reservations').select('*').eq('id', id).maybeSingle(), 'réservation');
    if (!resa || resa.cliente_id !== u.id) throw new HttpError(404, 'introuvable', 'Réservation introuvable');
    if (!['payee', 'remise'].includes(resa.statut) || !['echec', 'a_enregistrer', 'carte_enregistree'].includes(resa.caution_statut)) {
      throw new HttpError(409, 'rien_a_faire', 'La caution est déjà en place.');
    }
    const commande = ok(await db().from('commandes').select('id, transfer_group').eq('id', resa.commande_id).single(), 'commande');
    const customer = await clientStripe(u);
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      customer,
      payment_method_types: ['card'],
      locale: localeStripe(u),
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: resa.caution_cents, product_data: { name: `Caution (empreinte, non débitée) : ${reference(resa.id)}`, description: 'Montant bloqué puis libéré automatiquement après le retour' } } }],
      payment_intent_data: {
        capture_method: 'manual', setup_future_usage: 'off_session', transfer_group: commande.transfer_group,
        metadata: { type: 'caution', reservation_id: resa.id, commande_id: commande.id }
      },
      metadata: { type: 'caution_manuelle', reservation_id: resa.id, commande_id: commande.id },
      success_url: `${siteUrl()}/panier.html?commande=${commande.id}&etape=caution&caution=ok`,
      cancel_url: `${siteUrl()}/panier.html?commande=${commande.id}&etape=caution`
    });
    return { url: session.url };
  }
};

export const identiteSession = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    if (u.profil.identite_verifiee) return { deja: true };
    await limiter(req, 'identite', { max: 5, fenetreSecondes: 86400, cle: u.id });
    const retour = corps.commande_id ? `${siteUrl()}/panier.html?commande=${verif.uuid(corps.commande_id, 'commande')}&identite=retour` : `${siteUrl()}/compte.html?vue=profil&identite=retour`;
    const vs = await stripe().identity.verificationSessions.create({
      type: 'document',
      options: { document: { require_matching_selfie: true, allowed_types: ['id_card', 'passport', 'driving_license'] } },
      metadata: { user_id: u.id },
      return_url: retour
    });
    ok(await db().from('profils_prives').update({ identite_session_id: vs.id }).eq('id', u.id), 'session identité');
    return { url: vs.url };
  }
};

// ---------------------------------------------------------------------------
// Stripe Connect Express (fournisseuses)
// ---------------------------------------------------------------------------
async function majStatutConnect(userId, compte) {
  const complet = Boolean(compte.details_submitted && compte.payouts_enabled);
  ok(await db().from('profils').update({ stripe_onboarding_complet: complet }).eq('id', userId), 'statut Connect');
  return complet;
}
export { majStatutConnect };

export const connectOnboarding = {
  async executer({ req }) {
    const u = await utilisatrice(req);
    if (!u.profil.est_fournisseuse) throw new HttpError(403, 'fournisseuse_requise', 'Activez d\'abord votre espace fournisseuse.');
    await limiter(req, 'connect', { max: 10, fenetreSecondes: 3600, cle: u.id });
    const prive = ok(await db().from('profils_prives').select('stripe_account_id').eq('id', u.id).single(), 'profil');
    let compte = prive.stripe_account_id;
    if (!compte) {
      const a = await stripe().accounts.create({
        type: 'express', country: 'BE', email: u.email,
        capabilities: { transfers: { requested: true } },
        business_profile: { product_description: 'Location de tenues via la plateforme ' + MARQUE, mcc: '7296' },
        settings: { payouts: { schedule: { interval: 'daily' } } },
        metadata: { user_id: u.id }
      }, { idempotencyKey: `connect-${u.id}` });
      compte = a.id;
      ok(await db().from('profils_prives').update({ stripe_account_id: compte }).eq('id', u.id), 'compte Connect');
    }
    const lien = await stripe().accountLinks.create({
      account: compte, type: 'account_onboarding',
      refresh_url: `${siteUrl()}/compte.html?vue=paiements&connect=relance`,
      return_url: `${siteUrl()}/compte.html?vue=paiements&connect=retour`
    });
    return { url: lien.url };
  }
};

export const connectStatut = {
  async executer({ req }) {
    const u = await utilisatrice(req);
    const prive = ok(await db().from('profils_prives').select('stripe_account_id').eq('id', u.id).single(), 'profil');
    if (!prive.stripe_account_id) return { complet: false, compte: false };
    const a = await stripe().accounts.retrieve(prive.stripe_account_id);
    const complet = await majStatutConnect(u.id, a);
    return { complet, compte: true, exigences: a.requirements?.currently_due || [] };
  }
};

export const connectTableau = {
  async executer({ req }) {
    const u = await utilisatrice(req);
    const prive = ok(await db().from('profils_prives').select('stripe_account_id').eq('id', u.id).single(), 'profil');
    if (!prive.stripe_account_id) throw new HttpError(409, 'pas_de_compte', 'Aucun compte de paiement.');
    const l = await stripe().accounts.createLoginLink(prive.stripe_account_id);
    return { url: l.url };
  }
};

// ---------------------------------------------------------------------------
// Essayages et showrooms
// ---------------------------------------------------------------------------
export const essayageCreer = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    if (estRobot(corps)) throw new HttpError(400, 'refuse', 'Requête refusée');
    await exigerReservationsOuvertes();
    await limiter(req, 'essayage', { max: 6, fenetreSecondes: 86400, cle: u.id });
    const tenue = ok(await db().from('tenues').select('id, titre, fournisseuse_id, essayage_possible, statut').eq('id', verif.uuid(corps.tenue_id, 'tenue')).maybeSingle(), 'tenue');
    if (!tenue || tenue.statut !== 'validee' || !tenue.essayage_possible) throw new HttpError(409, 'essayage_impossible', 'L\'essayage n\'est pas proposé pour cette pièce.');
    if (tenue.fournisseuse_id === u.id) throw new HttpError(400, 'propre_tenue', 'Il s\'agit de votre propre pièce.');
    const creneau = new Date(corps.creneau);
    if (Number.isNaN(creneau.getTime()) || creneau.getTime() < Date.now() + 12 * 3600_000 || creneau.getTime() > Date.now() + 120 * 86400_000) {
      throw new HttpError(400, 'creneau', 'Choisissez un créneau entre demain et les quatre prochains mois.');
    }
    const p = await parametres();
    const frais = Number(p.frais_essayage_cents);
    const essai = ok(await db().from('essayages').insert({
      tenue_id: tenue.id, cliente_id: u.id, fournisseuse_id: tenue.fournisseuse_id, type: 'chez_fournisseuse',
      creneau: creneau.toISOString(), statut: frais > 0 ? 'a_payer' : 'demande', frais_cents: frais,
      message: verif.texte(corps.message, { nom: 'message', max: 500, optionnel: true })
    }).select('*').single(), 'essayage');
    if (frais === 0) {
      await notifier(tenue.fournisseuse_id, 'essayage_demande', { titre: tenue.titre, creneau: creneau.toLocaleString('fr-BE', { timeZone: 'Europe/Brussels' }), lien: '/compte.html?vue=essayages' });
      return { essayage_id: essai.id };
    }
    const session = await stripe().checkout.sessions.create({
      mode: 'payment', customer: await clientStripe(u), payment_method_types: ['card', 'bancontact'], locale: localeStripe(u),
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: frais, product_data: { name: `Essayage : ${tenue.titre}`.slice(0, 250), description: 'Déduit de votre location si vous réservez dans les 30 jours' } } }],
      payment_intent_data: { transfer_group: `ess_${essai.id}`, metadata: { type: 'essayage', essayage_id: essai.id } },
      metadata: { type: 'essayage', essayage_id: essai.id },
      success_url: `${siteUrl()}/compte.html?vue=essayages&essayage=ok`,
      cancel_url: `${siteUrl()}/tenue.html?id=${tenue.id}`
    });
    ok(await db().from('essayages').update({ checkout_session_id: session.id }).eq('id', essai.id), 'session essayage');
    return { url: session.url };
  }
};

export const essayageRepondre = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    const id = verif.uuid(corps.essayage_id, 'essayage');
    const decision = verif.choix(corps.decision, ['confirmer', 'refuser', 'effectue', 'annuler'], 'décision');
    const e = ok(await db().from('essayages').select('*, tenue:tenues(titre)').eq('id', id).maybeSingle(), 'essayage');
    if (!e) throw new HttpError(404, 'introuvable', 'Essayage introuvable');
    const estFournisseuse = e.fournisseuse_id === u.id;
    const estCliente = e.cliente_id === u.id;
    if (!estFournisseuse && !(estCliente && decision === 'annuler')) throw new HttpError(404, 'introuvable', 'Essayage introuvable');
    const transitions = { confirmer: [['demande'], 'confirme'], refuser: [['demande', 'confirme'], 'refuse'], effectue: [['confirme'], 'effectue'], annuler: [['demande', 'confirme', 'a_payer'], 'annule'] };
    const [de, vers] = transitions[decision];
    const maj = ok(await db().from('essayages').update({ statut: vers }).eq('id', id).in('statut', de).select('*'), 'essayage');
    if (!maj.length) throw new HttpError(409, 'impossible', 'Action impossible pour cet essayage.');
    // Remboursement si refus par la fournisseuse ou annulation par la cliente au moins 24 h avant
    const rembourser = (vers === 'refuse') || (vers === 'annule' && new Date(e.creneau) - Date.now() > 24 * 3600_000);
    if (rembourser && e.payment_intent_id && !e.rembourse && !e.deduit_commande_id) {
      const rf = await stripe().refunds.create({ payment_intent: e.payment_intent_id }, { idempotencyKey: `essayage-remb-${id}` });
      ok(await db().from('essayages').update({ rembourse: true }).eq('id', id), 'remboursement');
      await db().from('mouvements').insert({ type: 'remboursement', montant_cents: e.frais_cents, essayage_id: id, stripe_id: rf.id, libelle: 'Remboursement essayage' });
    }
    if (vers === 'effectue' && e.type === 'chez_fournisseuse' && e.payment_intent_id && e.frais_cents > 0 && !e.transfer_id) {
      const dest = ok(await db().from('profils_prives').select('stripe_account_id').eq('id', e.fournisseuse_id).single(), 'compte');
      if (dest.stripe_account_id) {
        const pi = await stripe().paymentIntents.retrieve(e.payment_intent_id);
        const tr = await stripe().transfers.create({
          amount: e.frais_cents, currency: 'eur', destination: dest.stripe_account_id, transfer_group: `ess_${id}`,
          source_transaction: typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id, metadata: { essayage_id: id }
        }, { idempotencyKey: `essayage-tr-${id}` });
        ok(await db().from('essayages').update({ transfer_id: tr.id }).eq('id', id), 'transfert essayage');
        await db().from('mouvements').insert({ type: 'transfert', montant_cents: e.frais_cents, essayage_id: id, stripe_id: tr.id, libelle: 'Frais d\'essayage reversés' });
      }
    }
    const libelle = { confirme: 'confirmé', refuse: 'refusé', effectue: 'effectué', annule: 'annulé' }[vers];
    const detail = vers === 'refuse' ? 'Les frais d\'essayage vous sont remboursés.' : vers === 'confirme' ? 'Les coordonnées de la fournisseuse sont disponibles dans votre espace.' : '';
    if (estFournisseuse) await notifier(e.cliente_id, 'essayage_reponse', { titre: e.tenue?.titre || '', statut: libelle, creneau: new Date(e.creneau).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels' }), detail, lien: '/compte.html?vue=essayages' });
    return { statut: vers };
  }
};

export const showroomInscrire = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    if (estRobot(corps)) throw new HttpError(400, 'refuse', 'Requête refusée');
    await exigerReservationsOuvertes();
    await limiter(req, 'showroom', { max: 10, fenetreSecondes: 3600, cle: u.id });
    const showroomId = verif.uuid(corps.showroom_id, 'showroom');
    const tenueIds = (Array.isArray(corps.tenue_ids) ? corps.tenue_ids : []).slice(0, 10).map((x) => verif.uuid(x, 'tenue'));
    const { data, error } = await db().from('showroom_inscriptions')
      .upsert({ showroom_id: showroomId, user_id: u.id, tenue_ids: tenueIds }, { onConflict: 'showroom_id,user_id' }).select('*, showroom:showrooms(*)').single();
    if (error) {
      if (error.hint === 'complet') throw new HttpError(409, 'complet', 'Ce showroom est complet.');
      throw new HttpError(409, 'indisponible', 'Inscription impossible pour ce showroom.');
    }
    const s = data.showroom;
    await notifier(u.id, 'showroom_inscription', { titre: s.titre, date: new Date(s.debut).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', dateStyle: 'long', timeStyle: 'short' }), lieu: `${s.lieu}, ${s.adresse}`, lien: '/compte.html?vue=essayages' });
    // Frais d'essayage en showroom (déductibles de toute location dans le délai de validité)
    const p = await parametres();
    const frais = Number(p.frais_essayage_cents);
    const existant = ok(await db().from('essayages').select('id, statut').eq('cliente_id', u.id).eq('showroom_id', showroomId).neq('statut', 'annule'), 'essayage showroom');
    if (frais > 0 && !existant.some((x) => x.statut !== 'a_payer')) {
      const essai = existant[0] || ok(await db().from('essayages').insert({
        tenue_id: tenueIds[0] || null, cliente_id: u.id, fournisseuse_id: null, type: 'showroom', showroom_id: showroomId,
        creneau: s.debut, statut: 'a_payer', frais_cents: frais
      }).select('*').single(), 'essayage showroom');
      const session = await stripe().checkout.sessions.create({
        mode: 'payment', customer: await clientStripe(u), payment_method_types: ['card', 'bancontact'], locale: localeStripe(u),
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: frais, product_data: { name: `Essayage showroom : ${s.titre}`.slice(0, 250), description: 'Déduit de votre location si vous réservez dans les 30 jours' } } }],
        payment_intent_data: { transfer_group: `ess_${essai.id}`, metadata: { type: 'essayage', essayage_id: essai.id } },
        metadata: { type: 'essayage', essayage_id: essai.id },
        success_url: `${siteUrl()}/compte.html?vue=essayages&essayage=ok`,
        cancel_url: `${siteUrl()}/compte.html?vue=essayages`
      });
      ok(await db().from('essayages').update({ checkout_session_id: session.id }).eq('id', essai.id), 'session essayage');
      return { ok: true, url: session.url };
    }
    return { ok: true };
  }
};
