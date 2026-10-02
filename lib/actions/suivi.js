// États des lieux (remise / retour) et ouverture de litige.
import { db, ok, utilisatrice } from '../supabase.js';
import { HttpError, verif } from '../http.js';
import { limiter } from '../antispam.js';
import { parametres } from '../parametres.js';
import { transition } from '../transitions.js';
import { heuresPlus, notifier, alerterAdmin, titresReservation, reference } from '../metier.js';

const PHOTOS = ['photo_face', 'photo_dos', 'photo_broderies', 'photo_doublure'];

function photosRequises(categorie) {
  // Accessoires : vue d'ensemble et détail suffisent
  return categorie === 'accessoire' ? ['photo_face', 'photo_broderies'] : PHOTOS;
}

export const edlValider = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    await limiter(req, 'edl', { max: 60, fenetreSecondes: 3600, cle: u.id });
    const id = verif.uuid(corps.reservation_id, 'réservation');
    const type = verif.choix(corps.type, ['remise', 'retour'], 'type');
    const resa = ok(await db().from('reservations').select('*').eq('id', id).maybeSingle(), 'réservation');
    if (!resa) throw new HttpError(404, 'introuvable', 'Réservation introuvable');
    const role = resa.cliente_id === u.id ? 'cliente' : resa.fournisseuse_id === u.id ? 'fournisseuse' : null;
    if (!role) throw new HttpError(404, 'introuvable', 'Réservation introuvable');
    const statutAttendu = type === 'remise' ? 'payee' : 'remise';
    if (resa.statut !== statutAttendu) throw new HttpError(409, 'etape', type === 'remise' ? 'La remise se valide sur une location payée.' : 'Le retour se valide après la remise.');
    if (type === 'remise' && resa.caution_cents > 0 && resa.caution_statut !== 'autorisee') {
      throw new HttpError(409, 'caution_requise', 'La caution doit être autorisée avant la remise. La cliente peut la régulariser depuis son panier.');
    }

    const lignes = ok(await db().from('reservation_lignes').select('id, titre_snapshot, tenue:tenues(categorie)').eq('reservation_id', id), 'lignes');
    const edls = ok(await db().from('etats_des_lieux').select('*').eq('reservation_id', id).eq('type', type), 'états des lieux');
    for (const l of lignes) {
      const e = edls.find((x) => x.ligne_id === l.id);
      const manquantes = photosRequises(l.tenue?.categorie).filter((c) => !e || !e[c]);
      if (manquantes.length) throw new HttpError(409, 'photos_manquantes', `État des lieux incomplet pour « ${l.titre_snapshot} » : ${manquantes.length} photo(s) manquante(s).`);
    }
    const colonne = role === 'cliente' ? 'valide_cliente_at' : 'valide_fournisseuse_at';
    const horodatage = new Date().toISOString();
    ok(await db().from('etats_des_lieux').update({ [colonne]: horodatage }).eq('reservation_id', id).eq('type', type).is(colonne, null), 'validation');

    const apres = ok(await db().from('etats_des_lieux').select('valide_cliente_at, valide_fournisseuse_at').eq('reservation_id', id).eq('type', type), 'états des lieux');
    const complet = apres.length >= lignes.length && apres.every((e) => e.valide_cliente_at && e.valide_fournisseuse_at);
    if (!complet) return { valide: role, complet: false, horodatage };

    if (type === 'remise') {
      await transition(id, { de: 'payee', vers: 'remise', acteur: role, raison: 'état des lieux de remise validé par les deux parties', patch: { remise_at: horodatage }, silencieux: true });
    } else {
      const p = await parametres();
      const r = await transition(id, {
        de: 'remise', vers: 'rendue', acteur: role, raison: 'état des lieux de retour validé par les deux parties',
        patch: { rendue_at: horodatage, litige_deadline: heuresPlus(Number(p.delai_litige_heures)), versement_prevu_at: heuresPlus(Number(p.delai_versement_heures)) },
        silencieux: true
      });
      if (r) await notifier(resa.fournisseuse_id, 'retour_confirme', { titre: await titresReservation(id), heures: p.delai_litige_heures, lien: `/compte.html?vue=demandes&reservation=${id}` });
    }
    return { valide: role, complet: true, horodatage };
  }
};

export const litigeOuvrir = {
  async executer({ req, corps }) {
    const u = await utilisatrice(req);
    await limiter(req, 'litige', { max: 5, fenetreSecondes: 86400, cle: u.id });
    const id = verif.uuid(corps.reservation_id, 'réservation');
    const motif = verif.choix(corps.motif, ['degat', 'tache', 'perte', 'retard', 'non_conforme', 'autre'], 'motif');
    const description = verif.texte(corps.description, { nom: 'description', min: 10, max: 2000 });
    const resa = ok(await db().from('reservations').select('*').eq('id', id).maybeSingle(), 'réservation');
    if (!resa || resa.fournisseuse_id !== u.id) throw new HttpError(404, 'introuvable', 'Réservation introuvable');
    if (resa.statut !== 'rendue') throw new HttpError(409, 'etape', 'Un litige s\'ouvre après le retour de la tenue.');
    if (new Date(resa.litige_deadline) < new Date()) throw new HttpError(409, 'delai_depasse', 'Le délai pour signaler un problème est dépassé.');
    const photos = (Array.isArray(corps.photos) ? corps.photos : []).slice(0, 8).map(String);
    if (photos.some((ph) => !ph.startsWith(`${id}/`))) throw new HttpError(400, 'photos', 'Photos invalides.');
    if (!photos.length && !['retard', 'perte'].includes(motif)) throw new HttpError(400, 'photos', 'Ajoutez au moins une photo du problème.');
    const montant = Math.min(verif.entier(corps.montant_demande_cents ?? 0, { nom: 'montant', min: 0, max: 5000000 }), resa.caution_cents);

    const { error } = await db().from('litiges').insert({ reservation_id: id, ouvert_par: u.id, motif, description, photos, montant_demande_cents: montant });
    if (error) {
      if (error.code === '23505') throw new HttpError(409, 'deja_ouvert', 'Un litige est déjà ouvert pour cette location.');
      throw error;
    }
    await transition(id, { de: 'rendue', vers: 'litige', acteur: 'fournisseuse', raison: `litige : ${motif}` });
    const vars = { reference: reference(id), motif: description.slice(0, 160) };
    await notifier(resa.cliente_id, 'litige_ouvert', { ...vars, lien: '/compte.html?vue=reservations' });
    await notifier(resa.fournisseuse_id, 'litige_ouvert', { ...vars, lien: '/compte.html?vue=demandes' });
    await alerterAdmin(`Litige ouvert ${reference(id)}`, `Motif : ${motif}. Montant demandé : ${(montant / 100).toFixed(2)} €. ${description}`, '/admin.html#litiges');
    return { ok: true };
  }
};
