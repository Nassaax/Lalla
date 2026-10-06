// Panier → commande (une réservation par fournisseuse), réponses, annulations.
import { db, ok, utilisatrice } from '../supabase.js';
import { HttpError, verif } from '../http.js';
import { estRobot, limiter } from '../antispam.js';
import { parametres, exigerReservationsOuvertes } from '../parametres.js';
import { calculerReservation } from '../pricing.js';
import { transition } from '../transitions.js';
import { aujourdhui, ajouterJours, joursEntre, heuresPlus, formatDate } from '../dates.js';
import { evaluerCommande, notifier, annulerReservation, titresReservation, libererEssayages } from '../metier.js';

export const commandeCreer = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    if (estRobot(corps)) throw new HttpError(400, 'refuse', 'Requête refusée');
    await exigerReservationsOuvertes();
    await limiter(req, 'commande', { max: 10, fenetreSecondes: 3600, cle: u.id });

    const evenement = verif.date(corps.evenement, 'date de l\'événement');
    const debut = verif.date(corps.debut, 'date de récupération');
    const fin = verif.date(corps.fin, 'date de retour');
    const auj = aujourdhui();
    if (debut <= auj) throw new HttpError(400, 'dates', 'La récupération doit avoir lieu au plus tôt demain.');
    if (!(debut <= evenement && evenement <= fin)) throw new HttpError(400, 'dates', 'L\'événement doit se situer entre la récupération et le retour.');
    if (joursEntre(auj, debut) > 365) throw new HttpError(400, 'dates', 'Réservation possible jusqu\'à un an à l\'avance.');
    const duree = joursEntre(debut, fin);

    const articles = Array.isArray(corps.articles) ? corps.articles : [];
    if (!articles.length || articles.length > 12) throw new HttpError(400, 'panier', 'Panier vide ou trop volumineux.');
    const ids = [...new Set(articles.map((a) => verif.uuid(a.tenue_id, 'tenue')))];
    const modeDe = Object.fromEntries(articles.map((a) => [a.tenue_id, a.mode_remise === 'envoi' ? 'envoi' : 'main_propre']));
    const message = verif.texte(corps.message, { nom: 'message', max: 1000, optionnel: true });
    const creneau = lireCreneau(corps.creneau, debut);
    const creneauPrestation = lireCreneauPrestation(corps.creneau_prestation, evenement);
    const adresse = verif.texte(corps.adresse_envoi, { nom: 'adresse', max: 300, optionnel: true });
    const adressePrestation = verif.texte(corps.adresse_prestation, { nom: 'lieu de la prestation', max: 300, optionnel: true });

    // Prix et disponibilités relus en base : jamais repris du navigateur.
    const tenues = ok(await db().from('tenues').select('*').in('id', ids).eq('statut', 'validee'), 'tenues');
    if (tenues.length !== ids.length) throw new HttpError(409, 'indisponible', 'Une pièce de votre panier n\'est plus disponible.');
    for (const tn of tenues) {
      if (tn.fournisseuse_id === u.id) throw new HttpError(400, 'propre_tenue', 'Vous ne pouvez pas louer vos propres pièces.');
      // Prestation : seule la date de l'événement compte (pas de durée de location)
      const prestation = tn.univers === 'prestation';
      if (!prestation && (duree < tn.duree_min_jours || duree > tn.duree_max_jours)) {
        throw new HttpError(400, 'duree', `« ${tn.titre} » se loue de ${tn.duree_min_jours} à ${tn.duree_max_jours} jours.`);
      }
      const { data: libre, error } = await db().rpc('tenue_disponible', { p_tenue: tn.id, p_debut: prestation ? evenement : debut, p_fin: prestation ? evenement : fin });
      if (error) throw error;
      if (!libre) throw new HttpError(409, 'indisponible', `« ${tn.titre} » n'est plus disponible à ces dates.`);
      if (modeDe[tn.id] === 'envoi' && !tn.envoi_assure) modeDe[tn.id] = 'main_propre';
      if (modeDe[tn.id] === 'main_propre' && !tn.remise_main_propre) modeDe[tn.id] = 'envoi';
    }

    const parFournisseuse = new Map();
    for (const tn of tenues) {
      if (!parFournisseuse.has(tn.fournisseuse_id)) parFournisseuse.set(tn.fournisseuse_id, []);
      parFournisseuse.get(tn.fournisseuse_id).push(tn);
    }
    const fournisseuses = ok(await db().from('profils').select('id, statut_compte, stripe_onboarding_complet').in('id', [...parFournisseuse.keys()]), 'fournisseuses');
    for (const f of fournisseuses) {
      if (f.statut_compte !== 'actif' || !f.stripe_onboarding_complet) throw new HttpError(409, 'indisponible', 'Une fournisseuse de votre panier n\'accepte pas de réservation actuellement.');
    }

    const p = await parametres();
    // Frais d'essayage payés et encore déductibles
    const limite = new Date(Date.now() - Number(p.essayage_validite_jours) * 86400000).toISOString();
    const essayages = ok(await db().from('essayages').select('id, type, fournisseuse_id, frais_cents, statut, transfer_id')
      .eq('cliente_id', u.id).in('statut', ['demande', 'confirme', 'effectue']).eq('rembourse', false).is('deduit_commande_id', null).gte('created_at', limite), 'essayages');

    const commande = ok(await db().from('commandes').insert({
      cliente_id: u.id, date_evenement: evenement, date_debut: debut, date_fin: fin
    }).select('*').single(), 'commande');
    ok(await db().from('commandes').update({ transfer_group: `cmd_${commande.id}` }).eq('id', commande.id), 'transfer_group');

    try {
      let showroomDisponible = essayages.filter((e) => e.type === 'showroom');
      const delai = Number(p.delai_reponse_heures);
      for (const [fournisseuseId, pieces] of parFournisseuse) {
        const nature = pieces.every((x) => x.univers === 'prestation') ? 'prestation' : 'location';
        const mode = nature === 'prestation' ? 'main_propre' : pieces.some((x) => modeDe[x.id] === 'envoi') ? 'envoi' : 'main_propre';
        const [rDebut, rFin] = nature === 'prestation' ? [evenement, evenement] : [debut, fin];
        const essai = essayages.find((e) => e.type === 'chez_fournisseuse' && e.fournisseuse_id === fournisseuseId) || showroomDisponible.shift();
        const calc = calculerReservation({
          pieces, mode_remise: mode,
          frais_envoi_cents: Math.max(...pieces.map((x) => (x.envoi_assure ? x.frais_envoi_cents : 0))),
          deduction_essayage_cents: essai ? essai.frais_cents : 0,
          essayage_deja_reverse: Boolean(essai && essai.type === 'chez_fournisseuse' && essai.transfer_id)
        }, p);
        const resa = ok(await db().from('reservations').insert({
          commande_id: commande.id, cliente_id: u.id, fournisseuse_id: fournisseuseId, statut: 'demande',
          date_evenement: evenement, date_debut: rDebut, date_fin: rFin, mode_remise: mode, nature,
          adresse_envoi: mode === 'envoi' ? adresse : null, message,
          adresse_prestation: pieces.some((x) => x.univers === 'prestation') ? adressePrestation : null,
          montant_location_cents: calc.montant_location_cents, frais_pressing_cents: calc.frais_pressing_cents,
          frais_envoi_cents: calc.frais_envoi_cents, frais_service_cents: calc.frais_service_cents,
          commission_cents: calc.commission_cents, deduction_essayage_cents: calc.deduction_essayage_cents,
          montant_transfert_cents: calc.montant_transfert_cents, caution_cents: calc.caution_cents, caution_especes_cents: calc.caution_especes_cents,
          expire_at: heuresPlus(delai), derniere_action_par: 'cliente',
          ...creneauReservation(nature === 'prestation' ? creneauPrestation : (mode === 'main_propre' ? creneau : null))
        }).select('*').single(), 'réservation');
        ok(await db().from('reservation_lignes').insert(pieces.map((x, i) => ({
          reservation_id: resa.id, tenue_id: x.id, titre_snapshot: x.titre,
          prix_location_cents: calc.lignes[i].prix_location_cents, frais_pressing_cents: calc.lignes[i].frais_pressing_cents, caution_cents: calc.lignes[i].caution_cents
        }))), 'lignes');
        if (essai && calc.deduction_essayage_cents > 0) {
          ok(await db().from('essayages').update({ deduit_commande_id: commande.id }).eq('id', essai.id).is('deduit_commande_id', null), 'essayage déduit');
        }
        // Réservation instantanée : toutes les pièces de cette fournisseuse l'acceptent, pas d'attente.
        if (pieces.every((x) => x.reservation_instantanee)) {
          await accepter(resa, p);
          await notifier(fournisseuseId, 'reservation_instantanee', {
            titre: pieces.map((x) => x.titre).join(', '), debut: formatDate(rDebut), fin: formatDate(rFin), evenement: formatDate(evenement),
            lien: `/compte.html?vue=demandes&reservation=${resa.id}`
          });
          continue;
        }
        await notifier(fournisseuseId, 'demande_recue', {
          titre: pieces.map((x) => x.titre).join(', '), debut: formatDate(rDebut), fin: formatDate(rFin), evenement: formatDate(evenement),
          lien: `/compte.html?vue=demandes&reservation=${resa.id}`
        });
      }
    } catch (e) {
      await db().from('blocages').delete().in('reservation_id', ok(await db().from('reservations').select('id').eq('commande_id', commande.id), 'réservations').map((r) => r.id));
      await libererEssayages(commande.id);
      await db().from('commandes').delete().eq('id', commande.id);
      throw e;
    }
    await evaluerCommande(commande.id);
    // Toutes les pièces en réservation instantanée : la commande est déjà à payer, le site enchaîne sur le paiement.
    const etat = ok(await db().from('commandes').select('statut').eq('id', commande.id).single(), 'commande');
    return { commande_id: commande.id, statut: etat.statut };
  }
};

export const reservationRepondre = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    const id = verif.uuid(corps.reservation_id, 'réservation');
    const decision = verif.choix(corps.decision, ['accepter', 'refuser'], 'décision');
    const resa = ok(await db().from('reservations').select('*').eq('id', id).maybeSingle(), 'réservation');
    if (!resa || resa.fournisseuse_id !== u.id) throw new HttpError(404, 'introuvable', 'Demande introuvable');
    if (resa.statut !== 'demande') throw new HttpError(409, 'deja_traitee', 'Cette demande a déjà été traitée.');
    if (new Date(resa.expire_at) < new Date()) throw new HttpError(409, 'expiree', 'Le délai de réponse est dépassé.');
    const titres = await titresReservation(id);

    if (decision === 'refuser') {
      const motif = verif.texte(corps.motif, { nom: 'motif', max: 300, optionnel: true }) || 'indisponible';
      await transition(id, { de: 'demande', vers: 'annulee', acteur: 'fournisseuse', raison: motif, patch: { annulee_at: new Date().toISOString(), annulee_par: 'fournisseuse', motif_annulation: motif } });
      await notifier(resa.cliente_id, 'demande_refusee', { titre: titres, raison: motif, lien: `/panier.html?commande=${resa.commande_id}` });
      await evaluerCommande(resa.commande_id);
      return { statut: 'annulee' };
    }

    await accepter(resa, await parametres(), 'fournisseuse');
    if (corps.confirmer_creneau && resa.creneau_remise) {
      ok(await db().from('reservations').update({ creneau_confirme: true }).eq('id', id), 'créneau');
    }
    await evaluerCommande(resa.commande_id);
    return { statut: 'acceptee' };
  }
};

/**
 * Acceptation : la contrainte d'exclusion de la table blocages empêche toute double réservation.
 * Utilisée par la réponse de la fournisseuse et par la réservation instantanée.
 */
async function accepter(resa, p, acteur = 'systeme') {
  const tampon = Number(p.pressing_jours);
  const lignes = ok(await db().from('reservation_lignes').select('tenue_id, tenue:tenues(univers)').eq('reservation_id', resa.id), 'lignes');
  // Tenues : battement de pressing ; matériel : les dates seules ; prestation : le jour de l'événement
  const periodeDe = (univers) => (univers === 'prestation' ? `[${resa.date_evenement},${resa.date_evenement}]`
    : univers === 'materiel' ? `[${resa.date_debut},${resa.date_fin}]`
    : `[${ajouterJours(resa.date_debut, -tampon)},${ajouterJours(resa.date_fin, tampon)}]`);
  const { error } = await db().from('blocages').insert(lignes.filter((l) => l.tenue_id).map((l) => ({ tenue_id: l.tenue_id, periode: periodeDe(l.tenue?.univers), motif: 'reservation', reservation_id: resa.id })));
  if (error) {
    if (error.code === '23P01') throw new HttpError(409, 'conflit_calendrier', 'Ces dates chevauchent une autre location ou un blocage du calendrier.');
    throw error;
  }
  const acceptee = await transition(resa.id, { de: 'demande', vers: 'acceptee', acteur, raison: acteur === 'fournisseuse' ? 'acceptée' : 'réservation instantanée', patch: { acceptee_at: new Date().toISOString() }, silencieux: true });
  if (!acceptee) {
    await db().from('blocages').delete().eq('reservation_id', resa.id);
    throw new HttpError(409, 'deja_traitee', 'Cette demande a déjà été traitée.');
  }
}

const creneauReservation = (c) => ({ creneau_remise: c || null, creneau_propose_par: c ? 'cliente' : null });

/** Heure de la prestation (le jour de l'événement) : facultative. */
function lireCreneauPrestation(valeur, evenement) {
  if (!valeur) return null;
  const d = new Date(String(valeur));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'creneau', 'Heure de la prestation invalide.');
  if (Math.abs(d.getTime() - new Date(`${evenement}T12:00:00Z`).getTime()) > 36 * 3600000) throw new HttpError(400, 'creneau', 'L\'heure de la prestation doit être le jour de l\'événement.');
  return d.toISOString();
}

/** Créneau de remise proposé (date et heure) : facultatif, au plus tard le jour de récupération. */
function lireCreneau(valeur, debut) {
  if (!valeur) return null;
  const d = new Date(String(valeur));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'creneau', 'Créneau de remise invalide.');
  if (d.getTime() < Date.now() + 3600000) throw new HttpError(400, 'creneau', 'Le créneau de remise doit être dans le futur.');
  if (d.toISOString().slice(0, 10) > ajouterJours(debut, 0)) throw new HttpError(400, 'creneau', 'La remise doit avoir lieu au plus tard le jour de récupération.');
  return d.toISOString();
}

/** Proposer un autre créneau de remise, ou confirmer celui proposé par l'autre partie. */
export const reservationCreneau = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    const id = verif.uuid(corps.reservation_id, 'réservation');
    const resa = ok(await db().from('reservations').select('*').eq('id', id).maybeSingle(), 'réservation');
    const role = resa && (resa.cliente_id === u.id ? 'cliente' : resa.fournisseuse_id === u.id ? 'fournisseuse' : null);
    if (!role) throw new HttpError(404, 'introuvable', 'Réservation introuvable');
    if (!['demande', 'acceptee', 'payee'].includes(resa.statut) || resa.mode_remise !== 'main_propre') throw new HttpError(409, 'impossible', 'Le créneau ne peut plus être modifié.');
    const autre = role === 'cliente' ? resa.fournisseuse_id : resa.cliente_id;
    if (corps.confirmer) {
      if (!resa.creneau_remise || resa.creneau_propose_par === role) throw new HttpError(409, 'impossible', 'Aucun créneau à confirmer.');
      ok(await db().from('reservations').update({ creneau_confirme: true }).eq('id', id), 'créneau');
      await notifier(autre, 'creneau_confirme', { titre: await titresReservation(id), creneau: formatCreneau(resa.creneau_remise), lien: lienResa(role === 'cliente' ? 'fournisseuse' : 'cliente', id) });
      return { creneau_confirme: true };
    }
    const creneau = lireCreneau(corps.creneau, resa.date_debut);
    if (!creneau) throw new HttpError(400, 'creneau', 'Indiquez une date et une heure.');
    ok(await db().from('reservations').update({ creneau_remise: creneau, creneau_propose_par: role, creneau_confirme: false }).eq('id', id), 'créneau');
    await notifier(autre, 'creneau_propose', { titre: await titresReservation(id), creneau: formatCreneau(creneau), lien: lienResa(role === 'cliente' ? 'fournisseuse' : 'cliente', id) });
    return { creneau_remise: creneau };
  }
};

const lienResa = (pour, id) => (pour === 'fournisseuse' ? `/compte.html?vue=demandes&reservation=${id}` : `/compte.html?vue=reservations&reservation=${id}`);
function formatCreneau(iso) {
  return new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export const reservationAnnuler = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    const id = verif.uuid(corps.reservation_id, 'réservation');
    const motif = verif.texte(corps.motif, { nom: 'motif', max: 300, optionnel: true });
    const resa = ok(await db().from('reservations').select('*').eq('id', id).maybeSingle(), 'réservation');
    if (!resa) throw new HttpError(404, 'introuvable', 'Réservation introuvable');
    const par = resa.cliente_id === u.id ? 'cliente' : resa.fournisseuse_id === u.id ? 'fournisseuse' : u.profil.est_admin ? 'admin' : null;
    if (!par) throw new HttpError(404, 'introuvable', 'Réservation introuvable');
    const detail = await annulerReservation(resa, { par, motif });
    return { statut: 'annulee', ...detail };
  }
};

/** La cliente annule tout ce qui n'est pas encore payé dans sa commande. */
export const commandeAnnuler = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    const id = verif.uuid(corps.commande_id, 'commande');
    const commande = ok(await db().from('commandes').select('*').eq('id', id).maybeSingle(), 'commande');
    if (!commande || commande.cliente_id !== u.id) throw new HttpError(404, 'introuvable', 'Commande introuvable');
    if (!['en_attente_reponses', 'a_payer'].includes(commande.statut)) throw new HttpError(409, 'deja_payee', 'Commande déjà réglée : annulez chaque location depuis votre espace.');
    const resas = ok(await db().from('reservations').select('*').eq('commande_id', id).in('statut', ['demande', 'acceptee']), 'réservations');
    for (const r of resas) {
      await transition(r.id, { de: r.statut, vers: 'annulee', acteur: 'cliente', raison: 'commande annulée', patch: { annulee_at: new Date().toISOString(), annulee_par: 'cliente', motif_annulation: 'Commande annulée par la cliente' } });
      await notifier(r.fournisseuse_id, 'annulation_fournisseuse', { titre: await titresReservation(r.id), raison: 'annulée par la cliente avant paiement', compensation: '', lien: '/compte.html?vue=demandes' });
    }
    ok(await db().from('commandes').update({ statut: 'annulee' }).eq('id', id), 'commande');
    await libererEssayages(id);
    return { statut: 'annulee' };
  }
};

export const reservationEnvoi = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    const id = verif.uuid(corps.reservation_id, 'réservation');
    const suivi = verif.texte(corps.numero_suivi, { nom: 'numéro de suivi', min: 4, max: 60 });
    const lignes = ok(await db().from('reservations').update({ numero_suivi: suivi }).eq('id', id).eq('fournisseuse_id', u.id).eq('mode_remise', 'envoi').in('statut', ['payee', 'remise']).select('id, cliente_id'), 'suivi');
    if (!lignes.length) throw new HttpError(409, 'impossible', 'Numéro de suivi non enregistré.');
    return { ok: true };
  }
};
