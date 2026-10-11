// Alertes envoyées à l'équipe (EMAIL_ADMIN) : inscriptions, annonces à valider, demandes, paiements,
// demandes de devis, et un résumé quotidien. Une alerte qui échoue ne bloque jamais l'action qui l'a déclenchée.
import crypto from 'node:crypto';
import { db, ok } from './supabase.js';
import { env } from './env.js';
import { HttpError } from './http.js';
import { envoyerEmail, emailAdmin } from './email.js';
import { formatEuros, formatDate } from './dates.js';

const TYPES = { particuliere: 'particulière', negafa: 'negafa', creatrice: 'créatrice', prestataire: 'prestataire', loueur: 'loueur de matériel' };

export async function alerte(titre, detail, lien) {
  try { await envoyerEmail({ a: emailAdmin(), modele: 'admin_alerte', vars: { titre, detail, lien } }); } catch (e) { console.error('[alerte]', e.message); }
}

function profilLisible(p) {
  const roles = [];
  if (p.est_fournisseuse) roles.push(`fournisseuse (${TYPES[p.type_fournisseuse] || p.type_fournisseuse})`);
  if (p.est_partenaire) roles.push('prestataire de l\'annuaire');
  if (!roles.length) roles.push('cliente');
  return roles.join(' et ');
}

/**
 * Appelée par la base (pg_net) à chaque inscription, annonce envoyée en validation ou fiche d'annuaire créée.
 * La base n'envoie que la table et l'identifiant : tout est relu ici avec la clé de service.
 */
export const alerteBase = {
  async executer({ req, corps }) {
    const attendu = env('ALERTES_SECRET', { optionnel: true });
    const recu = String((req.headers && req.headers['x-alerte-secret']) || '');
    if (!attendu || recu.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(recu), Buffer.from(attendu))) {
      throw new HttpError(401, 'non_autorise', 'Non autorisé');
    }
    const id = String(corps.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'parametre_invalide', 'Identifiant invalide');

    if (corps.table === 'profils') {
      const p = ok(await db().from('profils').select('nom_affiche, ville, langue, est_fournisseuse, type_fournisseuse, est_partenaire').eq('id', id).maybeSingle(), 'profil');
      if (!p) return { ignore: true };
      const { data } = await db().auth.admin.getUserById(id);
      const email = (data && data.user && data.user.email) || 'inconnue';
      await alerte(`Nouvelle inscription : ${p.nom_affiche || 'sans nom'}`,
        `Profil : ${profilLisible(p)}. ${p.ville ? `Ville : ${p.ville}. ` : ''}Email : ${email}. Langue : ${String(p.langue).toUpperCase()}. L'adresse n'est pas encore confirmée à ce stade.`,
        '/admin.html#comptes');
    } else if (corps.table === 'tenues') {
      const t = ok(await db().from('tenues').select('titre, statut, ville, prix_location_cents, fournisseuse:profils!tenues_fournisseuse_id_fkey(nom_affiche, boutique_nom, stripe_onboarding_complet)').eq('id', id).maybeSingle(), 'annonce');
      if (!t || t.statut !== 'en_attente') return { ignore: true };
      const f = t.fournisseuse || {};
      await alerte(`Annonce à valider : ${t.titre}`,
        `Publiée par ${f.boutique_nom || f.nom_affiche || 'une fournisseuse'}${t.ville ? `, ${t.ville}` : ''}, ${formatEuros(t.prix_location_cents)} la location. Elle sera visible après validation dans le back-office.${f.stripe_onboarding_complet ? '' : ' Son compte de versement (Stripe) n\'est pas encore configuré : elle ne pourra pas être réservée tant qu\'il ne l\'est pas.'}`,
        '/admin.html#annonces');
    } else if (corps.table === 'partenaires') {
      const pa = ok(await db().from('partenaires').select('nom, metier, ville, valide').eq('id', id).maybeSingle(), 'partenaire');
      if (!pa || pa.valide) return { ignore: true };
      await alerte(`Fiche annuaire à valider : ${pa.nom}`,
        `Métier : ${pa.metier}${pa.ville ? `, ${pa.ville}` : ''}. Elle apparaîtra dans l'annuaire du Hub après validation.`,
        '/admin.html#comptes');
    } else {
      throw new HttpError(400, 'parametre_invalide', 'Table inconnue');
    }
    return { ok: true };
  }
};

/** Nouvelle demande de réservation (après le panier). */
export async function alerteDemande(commandeId, statut) {
  const { data: resas, error } = await db().from('reservations').select('nature, date_evenement').eq('commande_id', commandeId);
  if (error || !resas || !resas.length) return;
  const prestation = resas.some((r) => r.nature === 'prestation');
  await alerte(`Nouvelle demande de réservation`,
    `${resas.length} ${resas.length > 1 ? 'fournisseuses ou prestataires concernées' : 'fournisseuse ou prestataire concernée'}${prestation ? ' (dont une prestation)' : ''}, pour une fête le ${formatDate(resas[0].date_evenement)}. ${statut === 'a_payer' ? 'Réservation instantanée : la cliente passe au paiement.' : 'En attente de leur réponse.'}`,
    '/admin.html#reservations');
}

/** Paiement reçu pour une commande. */
export async function alertePaiement(commandeId, montantCents) {
  await alerte(`Paiement reçu : ${formatEuros(montantCents)}`,
    `La commande ${String(commandeId).slice(0, 8).toUpperCase()} vient d'être payée. Les fournisseuses et prestataires concernées sont prévenues.`,
    '/admin.html#reservations');
}

/** Résumé des dernières 24 heures, envoyé seulement s'il y a du nouveau ou des choses en attente. */
export async function resumeQuotidien(rapport = {}) {
  const depuis = new Date(Date.now() - 86400000).toISOString();
  const compter = async (requete, nom) => { const { count, error } = await requete; if (error) throw new Error(`${nom} : ${error.message}`); return count || 0; };
  const inscrits = ok(await db().from('profils').select('est_fournisseuse, est_partenaire').gte('created_at', depuis), 'inscriptions');
  const payees = ok(await db().from('commandes').select('montant_total_cents').gte('payee_at', depuis), 'paiements');
  const demandes = await compter(db().from('commandes').select('id', { count: 'exact', head: true }).gte('created_at', depuis), 'demandes');
  const aValider = await compter(db().from('tenues').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'), 'annonces');
  const annuaire = await compter(db().from('partenaires').select('id', { count: 'exact', head: true }).eq('valide', false), 'annuaire');
  const litiges = await compter(db().from('litiges').select('id', { count: 'exact', head: true }).eq('statut', 'ouvert'), 'litiges');
  if (!inscrits.length && !payees.length && !demandes && !aValider && !annuaire && !litiges) { rapport.resume = 'rien à signaler'; return rapport; }

  const fournisseuses = inscrits.filter((p) => p.est_fournisseuse).length;
  const partenaires = inscrits.filter((p) => p.est_partenaire && !p.est_fournisseuse).length;
  const clientes = inscrits.length - fournisseuses - partenaires;
  const total = payees.reduce((s, c) => s + (c.montant_total_cents || 0), 0);
  const lignes = [
    `Inscriptions : ${inscrits.length} (${clientes} clientes, ${fournisseuses} fournisseuses, ${partenaires} prestataires de l'annuaire).`,
    `Demandes de réservation : ${demandes}.`,
    `Paiements : ${payees.length}${payees.length ? `, ${formatEuros(total)} au total` : ''}.`,
    `En attente de ton action : ${aValider} annonce(s) à valider, ${annuaire} fiche(s) d'annuaire à valider, ${litiges} litige(s) ouvert(s).`
  ];
  await alerte('Résumé des dernières 24 heures', lignes.join(' '), '/admin.html');
  rapport.resume = 'envoyé';
  return rapport;
}
