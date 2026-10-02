// Hub mariage : demandes de devis (leads) et RGPD (export, suppression de compte).
import { db, ok, utilisatrice } from '../supabase.js';
import { HttpError, verif } from '../http.js';
import { estRobot, limiter } from '../antispam.js';
import { envoyerEmail } from '../email.js';
import { formatDate } from '../dates.js';

export const leadCreer = {
  async executer({ req, corps }) {
    // Honeypot : on répond « ok » au robot sans rien enregistrer.
    if (estRobot(corps)) return { ok: true };
    await limiter(req, 'lead', { max: 5, fenetreSecondes: 3600 });
    const partenaireId = verif.uuid(corps.partenaire_id, 'partenaire');
    const nom = verif.texte(corps.nom, { nom: 'nom', min: 2, max: 80 });
    const email = verif.email(corps.email);
    const telephone = verif.texte(corps.telephone, { nom: 'téléphone', max: 25, optionnel: true });
    if (telephone && !/^[+0-9 ().-]{6,25}$/.test(telephone)) throw new HttpError(400, 'parametre_invalide', 'Téléphone invalide');
    const message = verif.texte(corps.message, { nom: 'message', min: 10, max: 1500 });
    const date = corps.date_evenement ? verif.date(corps.date_evenement, 'date') : null;
    const ville = corps.ville ? verif.choix(corps.ville, ['Bruxelles', 'Liège', 'Anvers'], 'ville') : null;
    const langue = corps.langue === 'nl' ? 'nl' : 'fr';
    await limiter(req, 'lead-email', { max: 8, fenetreSecondes: 86400, cle: email });

    const partenaire = ok(await db().from('partenaires').select('id, nom, email_contact, valide').eq('id', partenaireId).maybeSingle(), 'partenaire');
    if (!partenaire?.valide) throw new HttpError(404, 'introuvable', 'Partenaire introuvable');
    ok(await db().from('leads').insert({ partenaire_id: partenaireId, nom, email, telephone, date_evenement: date, ville, message }), 'lead');
    await envoyerEmail({
      a: partenaire.email_contact, modele: 'lead_nouveau', langue: 'fr',
      vars: { partenaire: partenaire.nom, nom, email, telephone: telephone || '', date: date ? formatDate(date) : '—', ville: ville || '—', message, lien: '/compte.html?vue=leads' }
    });
    await envoyerEmail({ a: email, modele: 'lead_confirmation', langue, vars: { nom, partenaire: partenaire.nom, lien: '/partenaires.html' } });
    return { ok: true };
  }
};

/** Portabilité (RGPD) : toutes les données personnelles de l'utilisatrice. */
export const compteExporter = {
  async executer({ req }) {
    const u = await utilisatrice(req);
    await limiter(req, 'export', { max: 5, fenetreSecondes: 86400, cle: u.id });
    const [prive, mensurations, reservations, avis, essayages, tenues] = await Promise.all([
      db().from('profils_prives').select('prenom, nom, email, telephone, adresse, code_postal, consentement_cgu_at').eq('id', u.id).maybeSingle(),
      db().from('mensurations').select('*').eq('user_id', u.id).maybeSingle(),
      db().from('reservations').select('id, statut, date_evenement, date_debut, date_fin, montant_location_cents, caution_cents, created_at').or(`cliente_id.eq.${u.id},fournisseuse_id.eq.${u.id}`),
      db().from('avis').select('note, commentaire, created_at').eq('auteur_id', u.id),
      db().from('essayages').select('creneau, statut, frais_cents, created_at').eq('cliente_id', u.id),
      db().from('tenues').select('id, titre, statut, created_at').eq('fournisseuse_id', u.id)
    ]);
    return {
      genere_le: new Date().toISOString(),
      profil: u.profil, coordonnees: prive.data, mensurations: mensurations.data,
      reservations: reservations.data, avis: avis.data, essayages: essayages.data, annonces: tenues.data
    };
  }
};

/** Droit à l'effacement : suppression du compte, l'historique comptable est anonymisé. */
export const compteSupprimer = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    if (corps.confirmation !== 'SUPPRIMER') throw new HttpError(400, 'confirmation', 'Confirmation manquante');
    const actives = ok(await db().from('reservations').select('id').or(`cliente_id.eq.${u.id},fournisseuse_id.eq.${u.id}`).in('statut', ['demande', 'acceptee', 'payee', 'remise', 'rendue', 'litige']), 'réservations');
    if (actives.length) throw new HttpError(409, 'locations_actives', 'Des locations sont en cours : la suppression sera possible une fois celles-ci clôturées.');
    await db().from('mensurations').delete().eq('user_id', u.id);
    // Les annonces sans historique disparaissent avec le compte ; les autres sont archivées puis anonymisées par la cascade.
    await db().from('tenues').update({ statut: 'archivee' }).eq('fournisseuse_id', u.id);
    const { error } = await db().auth.admin.deleteUser(u.id);
    if (error) throw new HttpError(500, 'suppression', 'Suppression impossible, contactez-nous.');
    return { ok: true };
  }
};
