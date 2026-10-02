// Tâches planifiées (Vercel Cron). Chaque tâche est idempotente : la relancer ne crée pas de doublon.
import { db, ok } from './supabase.js';
import { parametres } from './parametres.js';
import { transition, majSiStatut } from './transitions.js';
import {
  annulerReservation, creerEmpreinte, libererCaution, verser, notifier, titresReservation,
  aujourdhui, ajouterJours, formatDate, formatEuros
} from './metier.js';

async function chaque(liste, fn, rapport, cle) {
  for (const x of liste) {
    try { await fn(x); rapport[cle] = (rapport[cle] || 0) + 1; } catch (e) {
      console.error(`[cron:${cle}]`, x.id, e.message);
      rapport.erreurs = (rapport.erreurs || 0) + 1;
    }
  }
}

/** Demandes sans réponse dans le délai → annulation automatique. */
export async function expirerDemandes(rapport = {}) {
  const liste = ok(await db().from('reservations').select('*').eq('statut', 'demande').lt('expire_at', new Date().toISOString()).limit(200), 'demandes expirées');
  await chaque(liste, async (r) => {
    await annulerReservation(r, { par: 'systeme', motif: 'Délai de réponse dépassé' });
    await notifier(r.fournisseuse_id, 'demande_expiree_fournisseuse', { titre: await titresReservation(r.id), lien: '/compte.html?vue=demandes' });
  }, rapport, 'demandes_expirees');
  return rapport;
}

/** Empreintes de caution X jours avant la remise (carte enregistrée au paiement). */
export async function empreintes(rapport = {}) {
  const p = await parametres();
  const limite = ajouterJours(aujourdhui(), Number(p.empreinte_jours_avant));
  const liste = ok(await db().from('reservations').select('*').in('statut', ['payee', 'remise', 'rendue', 'litige'])
    .eq('caution_statut', 'carte_enregistree').lte('date_debut', limite).limit(200), 'empreintes');
  await chaque(liste, (r) => creerEmpreinte(r), rapport, 'empreintes');
  return rapport;
}

/** Une autorisation carte expire après 7 jours : renouvellement si la location dure encore. */
export async function renouvelerEmpreintes(rapport = {}) {
  const avant = new Date(Date.now() - 6 * 86400_000).toISOString();
  const liste = ok(await db().from('reservations').select('*').in('statut', ['payee', 'remise', 'rendue', 'litige'])
    .eq('caution_statut', 'autorisee').lt('caution_autorisee_at', avant).limit(200), 'renouvellements');
  await chaque(liste, (r) => creerEmpreinte(r, { renouvellement: true }), rapport, 'empreintes_renouvelees');
  return rapport;
}

/** Fin de la fenêtre de litige sans signalement → libération de la caution. */
export async function libererCautions(rapport = {}) {
  const liste = ok(await db().from('reservations').select('*').eq('statut', 'rendue').lt('litige_deadline', new Date().toISOString())
    .in('caution_statut', ['autorisee', 'carte_enregistree', 'a_enregistrer']).limit(200), 'cautions');
  await chaque(liste, async (r) => {
    const avant = r.caution_statut;
    await libererCaution(r);
    if (avant === 'autorisee') await notifier(r.cliente_id, 'caution_liberee', { montant: formatEuros(r.caution_cents), lien: `/compte.html?vue=reservations&avis=${r.id}` });
  }, rapport, 'cautions_liberees');
  return rapport;
}

/** Versement à la fournisseuse après le délai suivant le retour confirmé. */
export async function versements(rapport = {}) {
  const liste = ok(await db().from('reservations').select('*').in('statut', ['rendue', 'cloturee']).is('transfer_id', null)
    .lte('versement_prevu_at', new Date().toISOString()).limit(200), 'versements');
  await chaque(liste, (r) => verser(r), rapport, 'versements');
  return rapport;
}

/** Clôture : retour confirmé, caution libérée, versement fait → avis croisés. */
export async function cloturer(rapport = {}) {
  const liste = ok(await db().from('reservations').select('*').eq('statut', 'rendue').lt('litige_deadline', new Date().toISOString())
    .not('transfer_id', 'is', null).in('caution_statut', ['liberee', 'aucune', 'echec']).limit(200), 'clôtures');
  await chaque(liste, async (r) => {
    const c = await transition(r.id, { de: 'rendue', vers: 'cloturee', acteur: 'systeme', raison: 'clôture automatique', patch: { cloturee_at: new Date().toISOString() }, silencieux: true });
    if (!c) return;
    const titre = await titresReservation(r.id);
    await notifier(r.cliente_id, 'avis_invitation', { titre, lien: `/compte.html?vue=reservations&avis=${r.id}` });
    await notifier(r.fournisseuse_id, 'avis_invitation', { titre, lien: `/compte.html?vue=demandes&avis=${r.id}` });
    const restantes = ok(await db().from('reservations').select('id').eq('commande_id', r.commande_id).not('statut', 'in', '(cloturee,annulee)'), 'reste');
    if (!restantes.length) await db().from('commandes').update({ statut: 'terminee' }).eq('id', r.commande_id);
  }, rapport, 'cloturees');
  return rapport;
}

/** Rappels de la veille (remise et retour) et carte de caution manquante. */
export async function rappels(rapport = {}) {
  const demain = ajouterJours(aujourdhui(), 1);
  const remises = ok(await db().from('reservations').select('*').eq('statut', 'payee').eq('date_debut', demain), 'rappels remise');
  await chaque(remises, async (r) => {
    const titre = await titresReservation(r.id);
    await notifier(r.cliente_id, 'rappel_remise', { titre, lien: `/compte.html?vue=reservations&edl=${r.id}` });
    await notifier(r.fournisseuse_id, 'rappel_remise', { titre, lien: `/compte.html?vue=demandes&edl=${r.id}` });
  }, rapport, 'rappels_remise');
  const retours = ok(await db().from('reservations').select('*').eq('statut', 'remise').eq('date_fin', demain), 'rappels retour');
  await chaque(retours, async (r) => notifier(r.cliente_id, 'rappel_retour', { titre: await titresReservation(r.id), lien: '/compte.html?vue=reservations' }), rapport, 'rappels_retour');
  const sansCarte = ok(await db().from('reservations').select('*').eq('statut', 'payee').eq('caution_statut', 'a_enregistrer').lte('date_debut', ajouterJours(aujourdhui(), 4)), 'cartes manquantes');
  await chaque(sansCarte, (r) => notifier(r.cliente_id, 'caution_echec', { montant: formatEuros(r.caution_cents), debut: formatDate(r.date_debut), lien: `/panier.html?commande=${r.commande_id}&etape=caution` }), rapport, 'rappels_carte');
  return rapport;
}

export async function purger(rapport = {}) {
  const avant = new Date(Date.now() - 2 * 86400_000).toISOString();
  await db().from('limites_frequence').delete().lt('fenetre', avant);
  rapport.purge = true;
  return rapport;
}

/** Taux et délai de réponse, nombre de locations, badge « Fournisseuse de confiance ». */
export async function indicateurs(rapport = {}) {
  const { data, error } = await db().rpc('maj_indicateurs_fournisseuses');
  if (error) throw error;
  rapport.indicateurs = data;
  return rapport;
}

export const TACHES = {
  'expirer-demandes': expirerDemandes,
  empreintes,
  'renouveler-empreintes': renouvelerEmpreintes,
  'liberer-cautions': libererCautions,
  versements,
  cloturer,
  rappels,
  purger,
  indicateurs,
  async horaire(r = {}) {
    for (const f of [expirerDemandes, empreintes, libererCautions, versements, cloturer]) await f(r);
    return r;
  },
  async quotidien(r = {}) {
    for (const f of [renouvelerEmpreintes, rappels, purger, indicateurs]) await f(r);
    return r;
  }
};

export { majSiStatut };
