// Back-office : indicateurs, validations, litiges, paramètres, export comptable.
import { db, ok, exigerAdmin } from '../supabase.js';
import { stripe } from '../stripe.js';
import { HttpError, verif } from '../http.js';
import { validerParametre, viderCacheParametres } from '../parametres.js';
import { transition, majSiStatut } from '../transitions.js';
import { notifier, journaliserMouvement, reference, formatEuros } from '../metier.js';

export const adminStats = {
  async executer({ req }) {
    await exigerAdmin(req);
    const debut = new Date(); debut.setMonth(debut.getMonth() - 5); debut.setDate(1); debut.setHours(0, 0, 0, 0);
    const [resas, mouvs, litiges, annonces, comptes] = await Promise.all([
      db().from('reservations').select('statut, montant_location_cents, commission_cents, annulee_par, acceptee_at, created_at').gte('created_at', debut.toISOString()),
      db().from('mouvements').select('type, montant_cents, created_at').gte('created_at', debut.toISOString()),
      db().from('litiges').select('statut'),
      db().from('tenues').select('statut'),
      db().from('profils').select('est_fournisseuse, est_partenaire, compte_valide, type_fournisseuse').or('est_fournisseuse.eq.true,est_partenaire.eq.true')
    ]);
    const r = ok(resas, 'réservations'), m = ok(mouvs, 'mouvements');
    const payees = r.filter((x) => ['payee', 'remise', 'rendue', 'cloturee', 'litige'].includes(x.statut));
    const decidees = r.filter((x) => x.acceptee_at || (x.statut === 'annulee' && x.annulee_par === 'fournisseuse'));
    const acceptees = r.filter((x) => x.acceptee_at);
    const mois = {};
    for (let i = 0; i < 6; i++) { const d = new Date(debut); d.setMonth(d.getMonth() + i); mois[d.toISOString().slice(0, 7)] = { locations: 0, volume: 0, commissions: 0 }; }
    for (const x of payees) { const k = x.created_at.slice(0, 7); if (mois[k]) { mois[k].locations++; mois[k].volume += x.montant_location_cents; } }
    for (const x of m) { const k = x.created_at.slice(0, 7); if (mois[k] && ['commission', 'frais_service'].includes(x.type)) mois[k].commissions += x.montant_cents; }
    const somme = (t) => m.filter((x) => x.type === t).reduce((s, x) => s + x.montant_cents, 0);
    return {
      locations: payees.length,
      volume_cents: payees.reduce((s, x) => s + x.montant_location_cents, 0),
      commissions_cents: somme('commission') + somme('frais_service'),
      rembourse_cents: somme('remboursement'),
      taux_acceptation: decidees.length ? Math.round((acceptees.length / decidees.length) * 100) : null,
      litiges_ouverts: ok(litiges, 'litiges').filter((x) => x.statut === 'ouvert').length,
      litiges_total: ok(litiges, 'litiges').length,
      annonces_en_attente: ok(annonces, 'annonces').filter((x) => x.statut === 'en_attente').length,
      comptes_a_valider: ok(comptes, 'comptes').filter((x) => !x.compte_valide).length,
      par_statut: r.reduce((o, x) => ({ ...o, [x.statut]: (o[x.statut] || 0) + 1 }), {}),
      mois
    };
  }
};

export const adminTenueStatut = {
  async executer({ req, corps }) {
    await exigerAdmin(req);
    const id = verif.uuid(corps.tenue_id, 'annonce');
    const statut = verif.choix(corps.statut, ['validee', 'refusee', 'archivee'], 'statut');
    const motif = statut === 'refusee' ? verif.texte(corps.motif, { nom: 'motif', min: 5, max: 500 }) : null;
    const tn = ok(await db().from('tenues').update({ statut, motif_refus: motif }).eq('id', id).select('id, titre, fournisseuse_id').maybeSingle(), 'annonce');
    if (!tn) throw new HttpError(404, 'introuvable', 'Annonce introuvable');
    if (statut === 'validee') await notifier(tn.fournisseuse_id, 'annonce_validee', { titre: tn.titre, lien: `/tenue.html?id=${tn.id}` });
    if (statut === 'refusee') await notifier(tn.fournisseuse_id, 'annonce_refusee', { titre: tn.titre, motif, lien: `/compte.html?vue=annonces&tenue=${tn.id}` });
    return { statut };
  }
};

export const adminCompte = {
  async executer({ req, corps }) {
    const admin = await exigerAdmin(req);
    const id = verif.uuid(corps.user_id, 'compte');
    const action = verif.choix(corps.action, ['valider', 'suspendre', 'reactiver', 'reinitialiser_score'], 'action');
    if (id === admin.id && action === 'suspendre') throw new HttpError(400, 'soi_meme', 'Vous ne pouvez pas suspendre votre propre compte.');
    const patch = { valider: { compte_valide: true }, suspendre: { statut_compte: 'suspendu' }, reactiver: { statut_compte: 'actif' }, reinitialiser_score: { score_visibilite: 100 } }[action];
    const p = ok(await db().from('profils').update(patch).eq('id', id).select('id').maybeSingle(), 'compte');
    if (!p) throw new HttpError(404, 'introuvable', 'Compte introuvable');
    if (action === 'valider') await notifier(id, 'compte_valide', { lien: '/compte.html' });
    // Un partenaire validé apparaît dans l'annuaire
    if (action === 'valider') await db().from('partenaires').update({ valide: true }).eq('user_id', id);
    return { ok: true };
  }
};

export const adminParametres = {
  async executer({ req, corps }) {
    const admin = await exigerAdmin(req);
    const cle = String(corps.cle || '');
    const v = validerParametre(cle, corps.valeur);
    if (!v.ok) throw new HttpError(400, 'parametre_invalide', v.message);
    ok(await db().from('parametres').upsert({ cle, valeur: v.valeur, updated_by: admin.id }), 'paramètre');
    viderCacheParametres();
    return { cle, valeur: v.valeur };
  }
};

export const adminLitigeResoudre = {
  async executer({ req, corps }) {
    const admin = await exigerAdmin(req);
    const litige = ok(await db().from('litiges').select('*').eq('id', verif.uuid(corps.litige_id, 'litige')).maybeSingle(), 'litige');
    if (!litige || litige.statut !== 'ouvert') throw new HttpError(409, 'deja_resolu', 'Ce litige est déjà résolu.');
    const resa = ok(await db().from('reservations').select('*').eq('id', litige.reservation_id).single(), 'réservation');
    const commande = ok(await db().from('commandes').select('*').eq('id', resa.commande_id).single(), 'commande');
    const decision = verif.texte(corps.decision, { nom: 'décision', min: 10, max: 2000 });
    const capture = verif.entier(corps.capture_cents ?? 0, { nom: 'montant retenu', min: 0, max: resa.caution_cents });
    const dejaRembourse = resa.rembourse_cents || 0;
    const payePourResa = resa.montant_location_cents + resa.frais_pressing_cents + resa.frais_envoi_cents + resa.frais_service_cents - resa.deduction_essayage_cents;
    const rembourse = verif.entier(corps.rembourse_cents ?? 0, { nom: 'montant remboursé', min: 0, max: Math.max(0, payePourResa - dejaRembourse) });

    // 1. Caution : capture partielle (puis reversement à la fournisseuse) ou libération
    let cautionStatut = resa.caution_statut;
    if (capture > 0) {
      if (resa.caution_statut !== 'autorisee' || !resa.caution_payment_intent_id) throw new HttpError(409, 'caution_absente', 'Aucune empreinte active : capture impossible.');
      const pi = await stripe().paymentIntents.capture(resa.caution_payment_intent_id, { amount_to_capture: capture }, { idempotencyKey: `litige-capture-${litige.id}` });
      await journaliserMouvement({ type: 'caution_capture', montant_cents: capture, commande_id: commande.id, reservation_id: resa.id, stripe_id: pi.id, libelle: `Litige ${reference(resa.id)} : retenue sur caution` });
      const dest = ok(await db().from('profils_prives').select('stripe_account_id').eq('id', resa.fournisseuse_id).single(), 'compte');
      if (dest.stripe_account_id) {
        const charge = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
        const tr = await stripe().transfers.create({ amount: capture, currency: 'eur', destination: dest.stripe_account_id, transfer_group: commande.transfer_group, source_transaction: charge, metadata: { reservation_id: resa.id, type: 'litige' } }, { idempotencyKey: `litige-transfert-${litige.id}` });
        await journaliserMouvement({ type: 'transfert', montant_cents: capture, commande_id: commande.id, reservation_id: resa.id, stripe_id: tr.id, libelle: `Litige ${reference(resa.id)} : indemnisation fournisseuse` });
      }
      cautionStatut = 'capturee';
    } else if (resa.caution_statut === 'autorisee' && resa.caution_payment_intent_id) {
      await stripe().paymentIntents.cancel(resa.caution_payment_intent_id).catch(() => {});
      cautionStatut = 'liberee';
    }

    // 2. Remboursement éventuel de la cliente (sur le paiement de la location)
    if (rembourse > 0) {
      const rf = await stripe().refunds.create({ payment_intent: commande.payment_intent_id, amount: rembourse, metadata: { reservation_id: resa.id, motif: 'litige' } }, { idempotencyKey: `litige-remb-${litige.id}` });
      await journaliserMouvement({ type: 'remboursement', montant_cents: rembourse, commande_id: commande.id, reservation_id: resa.id, stripe_id: rf.id, libelle: `Litige ${reference(resa.id)} : remboursement` });
    }

    ok(await db().from('litiges').update({ statut: 'resolu', decision, montant_capture_cents: capture, montant_rembourse_cents: rembourse, resolu_par: admin.id, resolu_at: new Date().toISOString() }).eq('id', litige.id), 'litige');
    // Le versement de la location (s'il n'a pas eu lieu) suit la décision : réduit du remboursement accordé.
    await transition(resa.id, {
      de: 'litige', vers: 'cloturee', acteur: 'admin', raison: 'litige résolu',
      patch: {
        cloturee_at: new Date().toISOString(), caution_statut: cautionStatut, caution_capturee_cents: capture,
        rembourse_cents: dejaRembourse + rembourse,
        ...(resa.transfer_id ? {} : { montant_transfert_cents: Math.max(0, resa.montant_transfert_cents - rembourse), versement_prevu_at: new Date().toISOString() })
      }
    });
    const vars = { reference: reference(resa.id), decision, capture: formatEuros(capture), rembourse: formatEuros(rembourse) };
    await notifier(resa.cliente_id, 'litige_resolu', { ...vars, lien: '/compte.html?vue=reservations' });
    await notifier(resa.fournisseuse_id, 'litige_resolu', { ...vars, lien: '/compte.html?vue=demandes' });
    return { ok: true, caution_statut: cautionStatut };
  }
};

/** Export comptable mensuel : ventes, commissions, transferts, remboursements. */
export const adminExport = {
  async executer({ req, corps }) {
    await exigerAdmin(req);
    const mois = String(corps.mois || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) throw new HttpError(400, 'mois', 'Mois invalide (AAAA-MM).');
    const debut = new Date(`${mois}-01T00:00:00Z`);
    const fin = new Date(debut); fin.setUTCMonth(fin.getUTCMonth() + 1);
    const lignes = ok(await db().from('mouvements').select('*').gte('created_at', debut.toISOString()).lt('created_at', fin.toISOString()).order('created_at'), 'mouvements');
    const esc = (v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const euros = (c) => (c / 100).toFixed(2).replace('.', ',');
    const entete = ['date', 'type', 'montant_eur', 'commande', 'reservation', 'essayage', 'reference_stripe', 'libelle'];
    const corpsCsv = lignes.map((l) => [l.created_at.slice(0, 19).replace('T', ' '), l.type, euros(l.montant_cents), l.commande_id, l.reservation_id, l.essayage_id, l.stripe_id, l.libelle].map(esc).join(';'));
    const totaux = {};
    for (const l of lignes) totaux[l.type] = (totaux[l.type] || 0) + l.montant_cents;
    const recap = ['', 'Récapitulatif', ...Object.entries(totaux).map(([k, v]) => `${k};${euros(v)}`)];
    // BOM UTF-8 + séparateur « ; » : ouverture directe dans Excel (configuration belge)
    const csv = '﻿' + [entete.join(';'), ...corpsCsv, ...recap].join('\r\n');
    return { nom: `lalla-comptabilite-${mois}.csv`, csv, totaux };
  }
};

export const adminReservationEdl = {
  // Lecture des deux états des lieux d'une réservation (comparaison côte à côte dans les litiges)
  async executer({ req, corps }) {
    await exigerAdmin(req);
    const id = verif.uuid(corps.reservation_id, 'réservation');
    const [edl, lignes] = await Promise.all([
      db().from('etats_des_lieux').select('*').eq('reservation_id', id),
      db().from('reservation_lignes').select('id, titre_snapshot').eq('reservation_id', id)
    ]);
    return { etats: ok(edl, 'edl'), lignes: ok(lignes, 'lignes') };
  }
};

export { majSiStatut };
