// Traitement des événements Stripe (signature vérifiée en amont, dans api/webhook.js).
import { db, ok } from './supabase.js';
import { stripe } from './stripe.js';
import { majSiStatut } from './transitions.js';
import { majStatutConnect } from './actions/paiements.js';
import { payerCommande, enregistrerCarte, echecCaution, notifier, journaliserMouvement, alerterAdmin } from './metier.js';

const idDe = (x) => (typeof x === 'string' ? x : x?.id);

async function essayagePaye(essayageId, paymentIntentId) {
  const e = ok(await db().from('essayages').select('*, tenue:tenues(titre)').eq('id', essayageId).maybeSingle(), 'essayage');
  if (!e) return;
  const statut = e.type === 'showroom' ? 'confirme' : 'demande';
  const maj = ok(await db().from('essayages').update({ statut, payment_intent_id: paymentIntentId }).eq('id', essayageId).eq('statut', 'a_payer').select('id'), 'essayage payé');
  if (!maj.length) return;
  await journaliserMouvement({ type: 'essayage', montant_cents: e.frais_cents, essayage_id: e.id, stripe_id: paymentIntentId, libelle: 'Frais d\'essayage' });
  if (e.fournisseuse_id) {
    await notifier(e.fournisseuse_id, 'essayage_demande', { titre: e.tenue?.titre || '', creneau: new Date(e.creneau).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels' }), lien: '/compte.html?vue=essayages' });
  }
}

async function sessionTerminee(session) {
  const meta = session.metadata || {};
  if (session.mode === 'payment' && meta.type === 'commande') {
    if (session.payment_status !== 'paid') return; // Bancontact différé : async_payment_succeeded suivra
    await payerCommande(meta.commande_id, idDe(session.payment_intent), session.amount_total);
  } else if (session.mode === 'setup' && meta.type === 'caution') {
    const si = await stripe().setupIntents.retrieve(idDe(session.setup_intent));
    if (si.status === 'succeeded') await enregistrerCarte(meta.commande_id, idDe(si.payment_method));
  } else if (session.mode === 'payment' && meta.type === 'essayage' && session.payment_status === 'paid') {
    await essayagePaye(meta.essayage_id, idDe(session.payment_intent));
  } else if (session.mode === 'payment' && meta.type === 'caution_manuelle') {
    // L'empreinte est confirmée par payment_intent.amount_capturable_updated ; on mémorise la carte.
    const pi = await stripe().paymentIntents.retrieve(idDe(session.payment_intent));
    ok(await db().from('commandes').update({ payment_method_id: idDe(pi.payment_method) }).eq('id', meta.commande_id), 'carte');
    await cautionAutorisee(pi);
  }
}

async function cautionAutorisee(pi) {
  const meta = pi.metadata || {};
  if (meta.type !== 'caution' || !meta.reservation_id || pi.status !== 'requires_capture') return;
  const resa = ok(await db().from('reservations').select('*').eq('id', meta.reservation_id).maybeSingle(), 'réservation');
  if (!resa) return;
  const ancien = resa.caution_statut === 'autorisee' ? resa.caution_payment_intent_id : null;
  await majSiStatut(resa.id, ['payee', 'remise', 'rendue', 'litige'], { caution_statut: 'autorisee', caution_payment_intent_id: pi.id, caution_autorisee_at: new Date().toISOString() });
  if (ancien && ancien !== pi.id) await stripe().paymentIntents.cancel(ancien).catch(() => {});
}

export async function traiterEvenement(evt) {
  const o = evt.data.object;
  switch (evt.type) {
    case 'checkout.session.completed':
      return sessionTerminee(o);
    case 'checkout.session.async_payment_succeeded':
      if (o.metadata?.type === 'commande') return payerCommande(o.metadata.commande_id, idDe(o.payment_intent), o.amount_total);
      if (o.metadata?.type === 'essayage') return essayagePaye(o.metadata.essayage_id, idDe(o.payment_intent));
      return null;
    case 'checkout.session.async_payment_failed':
      if (o.metadata?.type === 'commande') {
        const c = ok(await db().from('commandes').select('cliente_id').eq('id', o.metadata.commande_id).single(), 'commande');
        await notifier(c.cliente_id, 'admin_alerte', { titre: 'Paiement Bancontact non abouti', detail: 'Le paiement n\'a pas pu être finalisé. Vous pouvez réessayer depuis votre panier.', lien: `/panier.html?commande=${o.metadata.commande_id}` });
      }
      return null;
    case 'payment_intent.succeeded':
      // Filet de sécurité si checkout.session.completed n'est pas arrivé.
      if (o.metadata?.type === 'commande' && o.metadata.commande_id) return payerCommande(o.metadata.commande_id, o.id, o.amount_received);
      return null;
    case 'payment_intent.amount_capturable_updated':
      return cautionAutorisee(o);
    case 'payment_intent.payment_failed':
      if (o.metadata?.type === 'caution' && o.metadata.reservation_id) {
        const resa = ok(await db().from('reservations').select('*').eq('id', o.metadata.reservation_id).maybeSingle(), 'réservation');
        if (resa && resa.caution_statut !== 'autorisee') await echecCaution(resa, o.last_payment_error?.code || 'refus bancaire', o.id);
      }
      return null;
    case 'payment_intent.canceled':
      if (o.metadata?.type === 'caution' && o.metadata.reservation_id) {
        const resa = ok(await db().from('reservations').select('*').eq('id', o.metadata.reservation_id).maybeSingle(), 'réservation');
        // Autorisation expirée chez la banque pendant une location active : elle sera recréée par le cron.
        if (resa && resa.caution_payment_intent_id === o.id && resa.caution_statut === 'autorisee') {
          const actif = ['payee', 'remise', 'rendue', 'litige'].includes(resa.statut);
          await majSiStatut(resa.id, [resa.statut], { caution_statut: actif ? 'carte_enregistree' : 'liberee' });
          if (actif) await alerterAdmin('Empreinte expirée', `L'empreinte de la réservation ${resa.id} a expiré ; une nouvelle empreinte sera tentée.`);
        }
      }
      return null;
    case 'setup_intent.succeeded':
      if (o.metadata?.type === 'caution' && o.metadata.commande_id) return enregistrerCarte(o.metadata.commande_id, idDe(o.payment_method));
      return null;
    case 'account.updated': {
      const prive = ok(await db().from('profils_prives').select('id').eq('stripe_account_id', o.id).maybeSingle(), 'compte');
      if (prive) await majStatutConnect(prive.id, o);
      return null;
    }
    case 'identity.verification_session.verified': {
      const userId = o.metadata?.user_id;
      if (userId) ok(await db().from('profils').update({ identite_verifiee: true }).eq('id', userId), 'identité');
      return null;
    }
    case 'identity.verification_session.requires_input': {
      const userId = o.metadata?.user_id;
      if (userId) await notifier(userId, 'identite_a_reprendre', { lien: '/compte.html?vue=profil' });
      return null;
    }
    case 'charge.refunded':
      return null; // les remboursements sont journalisés au moment où la plateforme les crée
    default:
      return null;
  }
}
