// Logique métier partagée par les actions API, le webhook Stripe et les tâches planifiées.
import { db, ok } from './supabase.js';
import { stripe } from './stripe.js';
import { parametres } from './parametres.js';
import { transition, majSiStatut } from './transitions.js';
import { envoyerEmail, emailAdmin, rendreEmail } from './email.js';
import { aujourdhui, ajouterJours, joursEntre, heuresPlus, formatDate, formatEuros } from './dates.js';
import { calculerAnnulation } from './pricing.js';
import { HttpError } from './http.js';

// ---------------------------------------------------------------------------
// Destinataires et notifications
// ---------------------------------------------------------------------------
export async function destinataire(userId) {
  if (!userId) return null;
  const { data } = await db().from('profils').select('id, nom_affiche, langue, profils_prives(email, prenom)').eq('id', userId).maybeSingle();
  if (!data) return null;
  const prive = Array.isArray(data.profils_prives) ? data.profils_prives[0] : data.profils_prives;
  return { id: data.id, email: prive?.email, prenom: prive?.prenom || data.nom_affiche, langue: data.langue || 'fr' };
}

export async function notifier(userId, modele, vars = {}) {
  const d = await destinataire(userId);
  if (!d) return;
  // Notification dans le site (cloche) : même titre que l'email, lien relatif.
  try {
    const { sujet } = rendreEmail(modele, d.langue, { prenom: d.prenom, ...vars });
    const lien = vars.lien && String(vars.lien).startsWith('/') ? vars.lien : null;
    const titre = sujet.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
    const { error } = await db().from('notifications').insert({ user_id: userId, type: modele.slice(0, 40), titre: titre.slice(0, 200), lien });
    if (error) console.error('[notifications]', error.message);
  } catch (e) { console.error('[notifications]', e.message); }
  if (d.email) await envoyerEmail({ a: d.email, modele, langue: d.langue, vars: { prenom: d.prenom, ...vars } });
}

export async function alerterAdmin(titre, detail, lien = '/admin.html') {
  await envoyerEmail({ a: emailAdmin(), modele: 'admin_alerte', vars: { titre, detail, lien } });
}

export async function titresReservation(reservationId) {
  const lignes = ok(await db().from('reservation_lignes').select('titre_snapshot').eq('reservation_id', reservationId), 'lignes');
  return lignes.map((l) => l.titre_snapshot).join(', ');
}

export const reference = (id) => String(id).slice(0, 8).toUpperCase();

export async function journaliserMouvement(m) {
  const { error } = await db().from('mouvements').insert(m);
  // Doublon (même objet Stripe déjà journalisé) : ignoré volontairement.
  if (error && error.code !== '23505') console.error('[mouvements]', error.message);
}

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------

/**
 * Réévalue une commande après une réponse, une expiration ou une annulation.
 * - plus aucune demande en attente et au moins une acceptée → « à payer »
 * - plus rien d'actif → commande annulée
 */
export async function evaluerCommande(commandeId) {
  const commande = ok(await db().from('commandes').select('*').eq('id', commandeId).single(), 'commande');
  if (['payee', 'terminee', 'annulee'].includes(commande.statut)) return commande;
  const resas = ok(await db().from('reservations').select('id, statut, montant_location_cents, frais_pressing_cents, frais_envoi_cents, frais_service_cents, deduction_essayage_cents').eq('commande_id', commandeId), 'réservations');
  const enAttente = resas.filter((r) => r.statut === 'demande').length;
  const acceptees = resas.filter((r) => r.statut === 'acceptee');
  if (enAttente > 0) return commande;
  if (!acceptees.length) {
    ok(await db().from('commandes').update({ statut: 'annulee' }).eq('id', commandeId).eq('statut', commande.statut), 'commande annulée');
    await libererEssayages(commandeId);
    return { ...commande, statut: 'annulee' };
  }
  const total = acceptees.reduce((s, r) => s + r.montant_location_cents + r.frais_pressing_cents + r.frais_envoi_cents + r.frais_service_cents - r.deduction_essayage_cents, 0);
  const maj = ok(await db().from('commandes').update({ statut: 'a_payer', montant_total_cents: total }).eq('id', commandeId).eq('statut', 'en_attente_reponses').select('*'), 'commande à payer');
  if (maj.length) {
    await notifier(commande.cliente_id, 'commande_a_payer', { montant: formatEuros(total), lien: `/panier.html?commande=${commandeId}` });
  }
  return maj[0] || commande;
}

/** Les frais d'essayage réservés pour une commande annulée redeviennent déductibles. */
export async function libererEssayages(commandeId) {
  await db().from('essayages').update({ deduit_commande_id: null }).eq('deduit_commande_id', commandeId);
}

// ---------------------------------------------------------------------------
// Paiement de la commande (webhook)
// ---------------------------------------------------------------------------
export async function payerCommande(commandeId, paymentIntentId, montantPaye) {
  const commande = ok(await db().from('commandes').select('*').eq('id', commandeId).single(), 'commande');
  if (commande.statut === 'payee' || commande.statut === 'terminee') return { deja: true };
  const pi = await stripe().paymentIntents.retrieve(paymentIntentId);
  const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
  const maj = ok(await db().from('commandes').update({
    statut: 'payee', payment_intent_id: paymentIntentId, charge_id: chargeId, payee_at: new Date().toISOString()
  }).eq('id', commandeId).in('statut', ['a_payer', 'en_attente_reponses', 'annulee']).select('*'), 'commande payée');
  if (!maj.length) return { deja: true };

  const resas = ok(await db().from('reservations').select('*').eq('commande_id', commandeId), 'réservations');
  let attendu = 0;
  for (const r of resas.filter((x) => x.statut === 'acceptee')) {
    const payee = await transition(r.id, {
      de: 'acceptee', vers: 'payee', acteur: 'stripe', raison: 'paiement confirmé',
      patch: { payee_at: new Date().toISOString(), caution_statut: r.caution_cents > 0 ? 'a_enregistrer' : 'aucune' },
      silencieux: true
    });
    if (!payee) continue;
    attendu += r.montant_location_cents + r.frais_pressing_cents + r.frais_envoi_cents + r.frais_service_cents - r.deduction_essayage_cents;
    await journaliserMouvement({ type: 'commission', montant_cents: r.commission_cents, commande_id: commandeId, reservation_id: r.id, stripe_id: paymentIntentId, libelle: 'Commission plateforme' });
    await journaliserMouvement({ type: 'frais_service', montant_cents: r.frais_service_cents, commande_id: commandeId, reservation_id: r.id, stripe_id: paymentIntentId, libelle: 'Frais de service' });
    const titres = await titresReservation(r.id);
    await notifier(r.fournisseuse_id, 'reservation_payee', { titre: titres, debut: formatDate(r.date_debut), lien: `/compte.html?vue=demandes&reservation=${r.id}` });
  }
  const paye = montantPaye ?? pi.amount_received ?? pi.amount;
  await journaliserMouvement({ type: 'paiement', montant_cents: paye, commande_id: commandeId, stripe_id: paymentIntentId, libelle: 'Paiement Checkout' });

  // Sécurité : une demande annulée entre-temps ne doit pas être facturée.
  if (paye > attendu) {
    const diff = paye - attendu;
    const rf = await stripe().refunds.create({ payment_intent: paymentIntentId, amount: diff, metadata: { commande_id: commandeId, motif: 'ajustement' } }, { idempotencyKey: `ajustement-${commandeId}` });
    await journaliserMouvement({ type: 'remboursement', montant_cents: diff, commande_id: commandeId, stripe_id: rf.id, libelle: 'Ajustement : demande annulée avant paiement' });
  }

  const p = await parametres();
  const cautionTotale = resas.filter((r) => r.statut === 'acceptee').reduce((s, r) => s + r.caution_cents, 0);
  // Carte utilisée pour le paiement (enregistrée par Checkout) : elle sert aussi à la caution.
  let carteEnregistree = false;
  if (cautionTotale > 0) {
    const pmId = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id;
    const pm = pmId ? await stripe().paymentMethods.retrieve(pmId).catch(() => null) : null;
    if (pm && pm.type === 'card' && pm.customer) {
      await enregistrerCarte(commandeId, pm.id);
      carteEnregistree = true;
    }
  }
  const vars = { montant: formatEuros(attendu || paye), caution: formatEuros(cautionTotale), jours: p.empreinte_jours_avant };
  if (cautionTotale > 0 && !carteEnregistree) {
    await notifier(commande.cliente_id, 'paiement_confirme', { ...vars, lien: `/panier.html?commande=${commandeId}&etape=caution` });
  } else {
    await notifier(commande.cliente_id, cautionTotale > 0 ? 'paiement_confirme_caution' : 'paiement_confirme_complet', { ...vars, lien: '/compte.html?vue=reservations' });
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Caution : carte enregistrée puis empreinte (capture_method manual)
// ---------------------------------------------------------------------------
export async function enregistrerCarte(commandeId, paymentMethodId) {
  ok(await db().from('commandes').update({ payment_method_id: paymentMethodId }).eq('id', commandeId), 'carte');
  const resas = ok(await db().from('reservations').select('*').eq('commande_id', commandeId).in('statut', ['payee', 'remise']).in('caution_statut', ['a_enregistrer', 'echec']), 'réservations');
  const p = await parametres();
  const auj = aujourdhui();
  for (const r of resas) {
    const maj = await majSiStatut(r.id, ['payee', 'remise'], { caution_statut: 'carte_enregistree' });
    if (!maj) continue;
    // Événement proche (≤ seuil) ou date d'empreinte déjà atteinte : empreinte immédiate.
    if (joursEntre(auj, r.date_evenement) <= Number(p.seuil_setup_jours) || ajouterJours(r.date_debut, -Number(p.empreinte_jours_avant)) <= auj) {
      await creerEmpreinte(maj);
    }
  }
}

export async function creerEmpreinte(resa, { renouvellement = false } = {}) {
  if (!resa.caution_cents) return null;
  const commande = ok(await db().from('commandes').select('id, cliente_id, payment_method_id, transfer_group').eq('id', resa.commande_id).single(), 'commande');
  const prive = ok(await db().from('profils_prives').select('stripe_customer_id').eq('id', resa.cliente_id).single(), 'cliente');
  if (!commande.payment_method_id || !prive.stripe_customer_id) {
    await echecCaution(resa, 'Aucune carte enregistrée');
    return null;
  }
  const tentative = renouvellement ? `renouv-${Date.now()}` : (resa.caution_payment_intent_id ? `relance-${Date.now()}` : 'initiale');
  try {
    const pi = await stripe().paymentIntents.create({
      amount: resa.caution_cents, currency: 'eur', customer: prive.stripe_customer_id, payment_method: commande.payment_method_id,
      payment_method_types: ['card'], capture_method: 'manual', confirm: true, off_session: true,
      transfer_group: commande.transfer_group, description: `Caution réservation ${reference(resa.id)}`,
      metadata: { type: 'caution', reservation_id: resa.id, commande_id: commande.id }
    }, { idempotencyKey: `caution-${resa.id}-${tentative}` });
    if (pi.status === 'requires_capture') {
      const ancien = resa.caution_payment_intent_id;
      await majSiStatut(resa.id, ['payee', 'remise', 'rendue', 'litige'], {
        caution_statut: 'autorisee', caution_payment_intent_id: pi.id, caution_autorisee_at: new Date().toISOString()
      });
      if (renouvellement && ancien && ancien !== pi.id) {
        await stripe().paymentIntents.cancel(ancien).catch((e) => console.error('[caution] annulation ancienne empreinte', e.message));
      }
      return pi;
    }
    await echecCaution(resa, `Statut inattendu : ${pi.status}`, pi.id);
    return null;
  } catch (e) {
    await echecCaution(resa, e.code || e.message, e.payment_intent?.id);
    return null;
  }
}

export async function echecCaution(resa, raison, piId = null) {
  const maj = await majSiStatut(resa.id, ['payee', 'remise', 'rendue', 'litige'], { caution_statut: 'echec', ...(piId ? { caution_payment_intent_id: piId } : {}) });
  if (!maj) return;
  const vars = { montant: formatEuros(resa.caution_cents), debut: formatDate(resa.date_debut), reference: reference(resa.id) };
  await notifier(resa.cliente_id, 'caution_echec', { ...vars, lien: `/panier.html?commande=${resa.commande_id}&etape=caution` });
  await notifier(resa.fournisseuse_id, 'caution_echec_info', { ...vars, lien: `/compte.html?vue=demandes&reservation=${resa.id}` });
  await alerterAdmin(`Caution refusée ${reference(resa.id)}`, `Empreinte de ${vars.montant} refusée (${raison}). Remise prévue le ${vars.debut}.`, `/admin.html#reservations`);
}

export async function libererCaution(resa) {
  if (resa.caution_statut !== 'autorisee' || !resa.caution_payment_intent_id) {
    return majSiStatut(resa.id, ['rendue', 'cloturee', 'annulee', 'litige'], { caution_statut: resa.caution_cents ? 'liberee' : 'aucune' });
  }
  await stripe().paymentIntents.cancel(resa.caution_payment_intent_id).catch((e) => {
    if (e.code !== 'payment_intent_unexpected_state') throw e;
  });
  return majSiStatut(resa.id, ['rendue', 'cloturee', 'annulee', 'litige', 'payee', 'remise'], { caution_statut: 'liberee' });
}

// ---------------------------------------------------------------------------
// Annulations
// ---------------------------------------------------------------------------
export async function appliquerPenalite(fournisseuseId) {
  const p = await parametres();
  const prof = ok(await db().from('profils').select('solde_penalites_cents, score_visibilite').eq('id', fournisseuseId).single(), 'profil');
  ok(await db().from('profils').update({
    solde_penalites_cents: prof.solde_penalites_cents + Number(p.penalite_fournisseuse_cents),
    score_visibilite: Math.max(0, prof.score_visibilite - Number(p.penalite_visibilite_points))
  }).eq('id', fournisseuseId), 'pénalité');
  await journaliserMouvement({ type: 'penalite', montant_cents: Number(p.penalite_fournisseuse_cents), libelle: `Pénalité d'annulation (${fournisseuseId})`, stripe_id: null });
}

/**
 * Annule une réservation (cliente, fournisseuse, système ou équipe) et applique la politique.
 * @returns {object} réservation annulée + détail du remboursement
 */
export async function annulerReservation(resa, { par, motif }) {
  const p = await parametres();
  const commande = ok(await db().from('commandes').select('*').eq('id', resa.commande_id).single(), 'commande');
  const titres = await titresReservation(resa.id);
  let detail = { rembourse_cents: 0, compensation_fournisseuse_cents: 0, pct: null };

  if (['demande', 'acceptee'].includes(resa.statut)) {
    await transition(resa.id, {
      de: resa.statut, vers: 'annulee', acteur: par, raison: motif,
      patch: { annulee_at: new Date().toISOString(), annulee_par: par, motif_annulation: motif }
    });
    if (par === 'fournisseuse' && resa.statut === 'acceptee') await appliquerPenalite(resa.fournisseuse_id);
    await evaluerCommande(resa.commande_id);
  } else if (resa.statut === 'payee') {
    detail = calculerAnnulation(resa, { par, aujourdhui: aujourdhui() }, p);
    const annulee = await transition(resa.id, {
      de: 'payee', vers: 'annulee', acteur: par, raison: motif,
      patch: { annulee_at: new Date().toISOString(), annulee_par: par, motif_annulation: motif, rembourse_cents: detail.rembourse_cents }
    });
    if (detail.rembourse_cents > 0 && commande.payment_intent_id) {
      const rf = await stripe().refunds.create({
        payment_intent: commande.payment_intent_id, amount: detail.rembourse_cents,
        metadata: { reservation_id: resa.id, motif: `annulation_${par}` }
      }, { idempotencyKey: `annulation-${resa.id}` });
      await journaliserMouvement({ type: 'remboursement', montant_cents: detail.rembourse_cents, commande_id: commande.id, reservation_id: resa.id, stripe_id: rf.id, libelle: `Annulation (${par}) : ${detail.pct ?? 100} %` });
    }
    if (annulee.caution_statut === 'autorisee') await libererCaution(annulee);
    if (detail.compensation_fournisseuse_cents > 0) {
      const dest = ok(await db().from('profils_prives').select('stripe_account_id').eq('id', resa.fournisseuse_id).single(), 'compte fournisseuse');
      if (dest.stripe_account_id) {
        const tr = await stripe().transfers.create({
          amount: detail.compensation_fournisseuse_cents, currency: 'eur', destination: dest.stripe_account_id,
          transfer_group: commande.transfer_group, source_transaction: commande.charge_id || undefined,
          metadata: { reservation_id: resa.id, type: 'compensation_annulation' }
        }, { idempotencyKey: `compensation-${resa.id}` });
        ok(await db().from('reservations').update({ transfer_id: tr.id, verse_at: new Date().toISOString(), montant_transfert_cents: detail.compensation_fournisseuse_cents }).eq('id', resa.id), 'compensation');
        await journaliserMouvement({ type: 'transfert', montant_cents: detail.compensation_fournisseuse_cents, commande_id: commande.id, reservation_id: resa.id, stripe_id: tr.id, libelle: 'Compensation annulation tardive' });
      }
    }
    if (par === 'fournisseuse') await appliquerPenalite(resa.fournisseuse_id);
  } else {
    throw new HttpError(409, 'annulation_impossible', 'Cette réservation ne peut plus être annulée en ligne. Contactez-nous.');
  }

  const raison = motif || ({ cliente: 'à la demande de la cliente', fournisseuse: 'par la fournisseuse', systeme: 'délai de réponse dépassé', admin: 'par notre équipe' }[par]);
  await notifier(resa.cliente_id, 'annulation', { titre: titres, raison, rembourse: formatEuros(detail.rembourse_cents), lien: `/compte.html?vue=reservations` });
  await notifier(resa.fournisseuse_id, 'annulation_fournisseuse', {
    titre: titres, raison,
    compensation: detail.compensation_fournisseuse_cents ? `Une compensation de ${formatEuros(detail.compensation_fournisseuse_cents)} vous est versée.` : '',
    lien: '/compte.html?vue=demandes'
  });
  return { ...detail };
}

// ---------------------------------------------------------------------------
// Versements
// ---------------------------------------------------------------------------
export async function verser(resa) {
  if (resa.transfer_id) return null;
  const commande = ok(await db().from('commandes').select('id, transfer_group, charge_id').eq('id', resa.commande_id).single(), 'commande');
  const dest = ok(await db().from('profils_prives').select('stripe_account_id').eq('id', resa.fournisseuse_id).single(), 'compte');
  const prof = ok(await db().from('profils').select('solde_penalites_cents').eq('id', resa.fournisseuse_id).single(), 'profil');
  if (!dest.stripe_account_id) return null;
  const retenue = Math.min(prof.solde_penalites_cents, resa.montant_transfert_cents);
  const montant = resa.montant_transfert_cents - retenue;
  let trId = null;
  if (montant > 0) {
    const tr = await stripe().transfers.create({
      amount: montant, currency: 'eur', destination: dest.stripe_account_id, transfer_group: commande.transfer_group,
      source_transaction: commande.charge_id || undefined, description: `Location ${reference(resa.id)}`,
      metadata: { reservation_id: resa.id, type: 'versement' }
    }, { idempotencyKey: `versement-${resa.id}` });
    trId = tr.id;
    await journaliserMouvement({ type: 'transfert', montant_cents: montant, commande_id: commande.id, reservation_id: resa.id, stripe_id: tr.id, libelle: retenue ? `Versement (pénalité retenue : ${formatEuros(retenue)})` : 'Versement fournisseuse' });
  }
  const maj = ok(await db().from('reservations').update({ transfer_id: trId || 'aucun', verse_at: new Date().toISOString() }).eq('id', resa.id).is('transfer_id', null).select('*'), 'versement');
  if (retenue) ok(await db().from('profils').update({ solde_penalites_cents: prof.solde_penalites_cents - retenue }).eq('id', resa.fournisseuse_id), 'solde pénalités');
  if (maj.length && montant > 0) {
    await notifier(resa.fournisseuse_id, 'versement_effectue', { montant: formatEuros(montant), titre: await titresReservation(resa.id), lien: '/compte.html?vue=revenus' });
  }
  return maj[0] || null;
}

export { heuresPlus, aujourdhui, ajouterJours, joursEntre, formatDate, formatEuros };
