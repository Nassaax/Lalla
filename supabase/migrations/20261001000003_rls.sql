-- LALLA — 003 : Row Level Security sur toutes les tables + privilèges
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Activer RLS partout
-- ---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

-- Privilèges : on part de zéro puis on accorde au plus juste.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- profils
-- ---------------------------------------------------------------------------
grant select on profils to anon, authenticated;
grant update (nom_affiche, ville, langue, est_cliente, est_fournisseuse, type_fournisseuse, est_partenaire,
              boutique_nom, boutique_slug, boutique_bio, avatar_chemin) on profils to authenticated;
-- L'admin modifie aussi les champs protégés (validation, suspension…)
grant update (est_admin, statut_compte, compte_valide, score_visibilite, solde_penalites_cents) on profils to authenticated;

create policy profils_lecture on profils for select using (true);
create policy profils_maj_soi on profils for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profils_maj_admin on profils for update to authenticated
  using (est_admin()) with check (est_admin());

-- ---------------------------------------------------------------------------
-- profils_prives
-- ---------------------------------------------------------------------------
grant select on profils_prives to authenticated;
grant update (prenom, nom, telephone, adresse, code_postal, consentement_cgu_at) on profils_prives to authenticated;

create policy profils_prives_lecture on profils_prives for select to authenticated
  using (peut_voir_coordonnees(id));
create policy profils_prives_maj on profils_prives for update to authenticated
  using (id = auth.uid() or est_admin()) with check (id = auth.uid() or est_admin());

-- ---------------------------------------------------------------------------
-- mensurations (données personnelles)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on mensurations to authenticated;

create policy mensurations_lecture on mensurations for select to authenticated
  using (peut_voir_mensurations(user_id));
create policy mensurations_insertion on mensurations for insert to authenticated
  with check (user_id = auth.uid());
create policy mensurations_maj on mensurations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mensurations_suppression on mensurations for delete to authenticated
  using (user_id = auth.uid() or est_admin());

-- ---------------------------------------------------------------------------
-- parametres
-- ---------------------------------------------------------------------------
grant select on parametres to anon, authenticated;
grant insert, update, delete on parametres to authenticated;

create policy parametres_lecture on parametres for select using (true);
create policy parametres_admin_ins on parametres for insert to authenticated with check (est_admin());
create policy parametres_admin_maj on parametres for update to authenticated using (est_admin()) with check (est_admin());
create policy parametres_admin_sup on parametres for delete to authenticated using (est_admin());

-- ---------------------------------------------------------------------------
-- tenues
-- ---------------------------------------------------------------------------
grant select on tenues to anon, authenticated;
grant insert, update, delete on tenues to authenticated;

create policy tenues_lecture_publique on tenues for select
  using (statut = 'validee');
create policy tenues_lecture_proprietaire on tenues for select to authenticated
  using (fournisseuse_id = auth.uid() or est_admin());
create policy tenues_insertion on tenues for insert to authenticated
  with check (
    fournisseuse_id = auth.uid()
    and exists (select 1 from profils p where p.id = auth.uid() and p.est_fournisseuse and p.statut_compte = 'actif')
  );
create policy tenues_maj on tenues for update to authenticated
  using (fournisseuse_id = auth.uid() or est_admin())
  with check (fournisseuse_id = auth.uid() or est_admin());
create policy tenues_suppression on tenues for delete to authenticated
  using (
    (fournisseuse_id = auth.uid() or est_admin())
    and not exists (select 1 from reservation_lignes l where l.tenue_id = tenues.id)
  );

-- ---------------------------------------------------------------------------
-- tenue_photos
-- ---------------------------------------------------------------------------
grant select on tenue_photos to anon, authenticated;
grant insert, update, delete on tenue_photos to authenticated;

create policy tenue_photos_lecture on tenue_photos for select using (tenue_visible(tenue_id));
create policy tenue_photos_insertion on tenue_photos for insert to authenticated
  with check (est_proprietaire_tenue(tenue_id));
create policy tenue_photos_maj on tenue_photos for update to authenticated
  using (est_proprietaire_tenue(tenue_id)) with check (est_proprietaire_tenue(tenue_id));
create policy tenue_photos_suppression on tenue_photos for delete to authenticated
  using (est_proprietaire_tenue(tenue_id) or est_admin());

-- ---------------------------------------------------------------------------
-- ensembles
-- ---------------------------------------------------------------------------
grant select on ensembles to anon, authenticated;
grant insert, delete on ensembles to authenticated;

create policy ensembles_lecture on ensembles for select
  using (tenue_visible(tenue_id) and tenue_visible(accessoire_id));
create policy ensembles_insertion on ensembles for insert to authenticated
  with check (est_proprietaire_tenue(tenue_id) and est_proprietaire_tenue(accessoire_id));
create policy ensembles_suppression on ensembles for delete to authenticated
  using (est_proprietaire_tenue(tenue_id));

-- ---------------------------------------------------------------------------
-- blocages (calendrier) : les dates sont publiques, pas le lien vers la réservation
-- ---------------------------------------------------------------------------
grant select (id, tenue_id, periode, motif, created_at) on blocages to anon, authenticated;
grant insert (tenue_id, periode, motif), update (periode), delete on blocages to authenticated;

create policy blocages_lecture on blocages for select using (tenue_visible(tenue_id));
create policy blocages_insertion on blocages for insert to authenticated
  with check (est_proprietaire_tenue(tenue_id) and motif = 'manuel');
create policy blocages_maj on blocages for update to authenticated
  using (est_proprietaire_tenue(tenue_id) and motif = 'manuel')
  with check (est_proprietaire_tenue(tenue_id) and motif = 'manuel');
create policy blocages_suppression on blocages for delete to authenticated
  using (est_proprietaire_tenue(tenue_id) and motif = 'manuel');

-- ---------------------------------------------------------------------------
-- commandes, réservations (écriture serveur uniquement)
-- ---------------------------------------------------------------------------
grant select on commandes, reservations, reservation_lignes, reservation_historique to authenticated;

create policy commandes_lecture on commandes for select to authenticated
  using (
    cliente_id = auth.uid() or est_admin()
    or exists (select 1 from reservations r where r.commande_id = commandes.id and r.fournisseuse_id = auth.uid())
  );

create policy reservations_lecture on reservations for select to authenticated
  using (cliente_id = auth.uid() or fournisseuse_id = auth.uid() or est_admin());

create policy reservation_lignes_lecture on reservation_lignes for select to authenticated
  using (est_partie_reservation(reservation_id) or est_admin());

create policy reservation_historique_lecture on reservation_historique for select to authenticated
  using (est_partie_reservation(reservation_id) or est_admin());

-- ---------------------------------------------------------------------------
-- showrooms et essayages
-- ---------------------------------------------------------------------------
grant select on showrooms to anon, authenticated;
grant insert, update, delete on showrooms to authenticated;
create policy showrooms_lecture on showrooms for select using (actif or est_admin());
create policy showrooms_admin_ins on showrooms for insert to authenticated with check (est_admin());
create policy showrooms_admin_maj on showrooms for update to authenticated using (est_admin()) with check (est_admin());
create policy showrooms_admin_sup on showrooms for delete to authenticated using (est_admin());

grant select, delete on showroom_inscriptions to authenticated;
create policy showroom_inscriptions_lecture on showroom_inscriptions for select to authenticated
  using (user_id = auth.uid() or est_admin());
create policy showroom_inscriptions_suppression on showroom_inscriptions for delete to authenticated
  using (user_id = auth.uid() or est_admin());

grant select on essayages to authenticated;
create policy essayages_lecture on essayages for select to authenticated
  using (cliente_id = auth.uid() or fournisseuse_id = auth.uid() or est_admin());

-- ---------------------------------------------------------------------------
-- états des lieux
-- ---------------------------------------------------------------------------
grant select on etats_des_lieux to authenticated;
grant insert (reservation_id, ligne_id, type, photo_face, photo_dos, photo_broderies, photo_doublure,
              taches, accrocs, perles_manquantes, commentaire) on etats_des_lieux to authenticated;
grant update (photo_face, photo_dos, photo_broderies, photo_doublure, taches, accrocs, perles_manquantes, commentaire)
  on etats_des_lieux to authenticated;

create policy edl_lecture on etats_des_lieux for select to authenticated
  using (est_partie_reservation(reservation_id) or est_admin());
create policy edl_insertion on etats_des_lieux for insert to authenticated
  with check (est_partie_reservation(reservation_id));
create policy edl_maj on etats_des_lieux for update to authenticated
  using (est_partie_reservation(reservation_id)) with check (est_partie_reservation(reservation_id));

-- ---------------------------------------------------------------------------
-- litiges (ouverture et résolution côté serveur)
-- ---------------------------------------------------------------------------
grant select on litiges to authenticated;
create policy litiges_lecture on litiges for select to authenticated
  using (est_partie_reservation(reservation_id) or est_admin());

-- ---------------------------------------------------------------------------
-- avis
-- ---------------------------------------------------------------------------
grant select on avis to anon, authenticated;
grant insert (reservation_id, auteur_id, note, commentaire) on avis to authenticated;
grant delete on avis to authenticated;

create policy avis_lecture on avis for select using (true);
create policy avis_insertion on avis for insert to authenticated
  with check (auteur_id = auth.uid() and est_partie_reservation(reservation_id));
create policy avis_suppression on avis for delete to authenticated using (est_admin());

-- ---------------------------------------------------------------------------
-- partenaires et leads
-- ---------------------------------------------------------------------------
grant select on partenaires to anon, authenticated;
grant insert (nom, metier, ville, bio, galerie, instagram, site, email_contact),
      update (nom, metier, ville, bio, galerie, instagram, site, email_contact, valide, taux_commission)
  on partenaires to authenticated;
grant delete on partenaires to authenticated;

create policy partenaires_lecture on partenaires for select
  using (valide or user_id = auth.uid() or est_admin());
create policy partenaires_insertion on partenaires for insert to authenticated
  with check (
    exists (select 1 from profils p where p.id = auth.uid() and p.est_partenaire)
    and not exists (select 1 from partenaires x where x.user_id = auth.uid())
  );
create policy partenaires_maj on partenaires for update to authenticated
  using (user_id = auth.uid() or est_admin()) with check (user_id = auth.uid() or est_admin());
create policy partenaires_suppression on partenaires for delete to authenticated using (est_admin());

grant select on leads to authenticated;
grant update (statut, montant_commission_cents) on leads to authenticated;
create policy leads_lecture on leads for select to authenticated
  using (est_admin() or exists (select 1 from partenaires p where p.id = leads.partenaire_id and p.user_id = auth.uid()));
create policy leads_maj on leads for update to authenticated
  using (est_admin() or exists (select 1 from partenaires p where p.id = leads.partenaire_id and p.user_id = auth.uid()))
  with check (est_admin() or exists (select 1 from partenaires p where p.id = leads.partenaire_id and p.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- tables internes : lecture admin uniquement
-- ---------------------------------------------------------------------------
grant select on mouvements, evenements_stripe to authenticated;
create policy mouvements_admin on mouvements for select to authenticated using (est_admin());
create policy evenements_stripe_admin on evenements_stripe for select to authenticated using (est_admin());
-- limites_frequence : aucune policy, aucun privilège (accès via fonction security definer)

-- ---------------------------------------------------------------------------
-- Fonctions : exécution
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  est_admin(), est_serveur(), param(text), param_int(text, integer),
  peut_voir_mensurations(uuid), est_partie_reservation(uuid), peut_voir_coordonnees(uuid),
  est_proprietaire_tenue(uuid), tenue_visible(uuid), tenue_disponible(uuid, date, date),
  exiger_frequence(text, integer, integer), incrementer_ma_frequence(text, integer, integer)
  to anon, authenticated;
grant execute on function rechercher_tenues to anon, authenticated;
-- Les fonctions de trigger n'ont pas besoin d'EXECUTE pour le rôle appelant.
grant execute on all functions in schema public to service_role;
-- verifier_frequence (security definer) : appelée par exiger_frequence et par le serveur.
grant execute on function verifier_frequence(text, integer, integer) to service_role;
