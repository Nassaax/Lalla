-- Tests des policies RLS, une par une.
-- Exécution : supabase/tests/run-rls-tests.sh (base locale) — jamais en production.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ---------------------------------------------------------------------------
-- Outils de test
-- ---------------------------------------------------------------------------
create or replace function public.t_ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'ÉCHEC : %', p_msg;
  end if;
  raise notice 'ok  %', p_msg;
end $$;

create or replace function public.t_erreur(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok  % (refusé : %)', p_msg, sqlerrm;
    return;
  end;
  raise exception 'ÉCHEC : % (aucune erreur levée)', p_msg;
end $$;

create or replace function public.t_lignes(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into n;
  return n;
end $$;

create or replace function public.t_comme(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_ok, public.t_erreur, public.t_lignes, public.t_comme to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Jeu de données (en tant que postgres = serveur)
-- ---------------------------------------------------------------------------
-- 'a1' cliente A, 'b1' cliente B, 'f1' fournisseuse F, 'f2' fournisseuse G, 'p1' partenaire P, 'ad' admin
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.be', '{"prenom":"Amina","cgu":true}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.be', '{"prenom":"Bouchra"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'f@test.be', '{"prenom":"Fatima","type_fournisseuse":"negafa"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'g@test.be', '{"prenom":"Ghita","type_fournisseuse":"particuliere"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'p@test.be', '{"prenom":"Paola"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.be', '{"prenom":"Admin"}');

update profils set est_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
update profils set est_partenaire = true where id = '00000000-0000-0000-0000-0000000000c1';
update profils set stripe_onboarding_complet = true where id = '00000000-0000-0000-0000-0000000000f1';

insert into mensurations (user_id, poitrine_cm, taille_cm, hanches_cm) values
  ('00000000-0000-0000-0000-0000000000a1', 92, 72, 98),
  ('00000000-0000-0000-0000-0000000000b1', 88, 68, 94);

insert into tenues (id, fournisseuse_id, categorie, titre, prix_location_cents, valeur_declaree_cents, ville, statut,
  poitrine_cm, taille_cm, hanches_cm, longueur_cm, manche_cm) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'caftan', 'Caftan validé', 9000, 120000, 'Bruxelles', 'validee', 96, 76, 102, 150, 60),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1', 'takchita', 'Takchita en attente', 12000, 200000, 'Liège', 'en_attente', 96, 76, 102, 150, 60),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f2', 'caftan', 'Caftan de G', 7000, 90000, 'Anvers', 'validee', 90, 70, 96, 148, 58);

insert into commandes (id, cliente_id, statut, date_evenement, date_debut, date_fin) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'payee', current_date + 20, current_date + 19, current_date + 21);
insert into reservations (id, commande_id, cliente_id, fournisseuse_id, statut, date_evenement, date_debut, date_fin,
  montant_location_cents, expire_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000f1', 'payee', current_date + 20, current_date + 19, current_date + 21, 9000, now() + interval '1 day');
insert into reservation_lignes (id, reservation_id, tenue_id, titre_snapshot, prix_location_cents) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Caftan validé', 9000);

insert into partenaires (id, user_id, nom, metier, ville, email_contact, valide) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Paola Make-up', 'maquilleuse', 'Bruxelles', 'p@test.be', true),
  ('50000000-0000-0000-0000-000000000002', null, 'Studio Lumière', 'photographe', 'Liège', 'studio@test.be', true);
insert into leads (partenaire_id, nom, email, message) values
  ('50000000-0000-0000-0000-000000000001', 'Amina', 'a@test.be', 'Bonjour, devis pour un mariage en juin.'),
  ('50000000-0000-0000-0000-000000000002', 'Bouchra', 'b@test.be', 'Bonjour, devis pour des fiançailles.');

-- ---------------------------------------------------------------------------
-- 0. RLS activée sur toutes les tables
-- ---------------------------------------------------------------------------
select t_ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'RLS activée sur toutes les tables publiques');
select t_ok((select count(*) from profils) = 6, 'trigger d''inscription : 6 profils créés');
select t_ok((select est_fournisseuse from profils where id = '00000000-0000-0000-0000-0000000000f1'), 'métadonnée type_fournisseuse → est_fournisseuse');

-- ---------------------------------------------------------------------------
-- 1. Visiteuse anonyme
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select t_ok(t_lignes('select * from tenues') = 2, 'anon : seules les tenues validées sont visibles');
select t_erreur('select * from reservations', 'anon : réservations interdites');
select t_erreur('select * from leads', 'anon : leads interdits');
select t_erreur('select * from mensurations', 'anon : mensurations interdites');
select t_erreur('select * from profils_prives', 'anon : profils privés interdits');
select t_ok(t_lignes('select * from rechercher_tenues()') = 2, 'anon : la recherche ne renvoie que les tenues validées');
select t_ok(t_lignes('select * from partenaires') = 2, 'anon : partenaires validés visibles');
select t_erreur($$insert into tenues (fournisseuse_id, categorie, titre, prix_location_cents, valeur_declaree_cents, ville) values ('00000000-0000-0000-0000-0000000000f1','accessoire','x',1000,1000,'Liège')$$, 'anon : création de tenue interdite');
rollback;

-- ---------------------------------------------------------------------------
-- 2. Cliente A
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select t_ok(t_lignes('select * from reservations') = 1, 'cliente A : voit sa réservation');
select t_ok(t_lignes('select * from commandes') = 1, 'cliente A : voit sa commande');
select t_ok(t_lignes('select * from mensurations') = 1, 'cliente A : ne voit que ses mensurations');
select t_ok((select user_id from mensurations) = '00000000-0000-0000-0000-0000000000a1', 'cliente A : la ligne visible est la sienne');
select t_ok(t_lignes('select * from profils_prives') = 2, 'cliente A : voit ses coordonnées + celles de sa fournisseuse (réservation payée)');
select t_ok(t_lignes('select * from tenues') = 2, 'cliente A : ne voit pas la tenue en attente d''une autre');
select t_ok(t_lignes('select * from leads') = 0, 'cliente A : aucun lead');
select t_ok(t_lignes('select * from mouvements') = 0, 'cliente A : aucun mouvement comptable');
select t_ok(t_lignes('select * from reservation_lignes') = 1, 'cliente A : voit les lignes de sa réservation');
select t_erreur($$update profils set est_admin = true where id = '00000000-0000-0000-0000-0000000000a1'$$, 'cliente A : ne peut pas se nommer admin');
select t_erreur($$update profils set identite_verifiee = true where id = '00000000-0000-0000-0000-0000000000a1'$$, 'cliente A : ne peut pas se déclarer vérifiée');
select t_erreur($$update reservations set statut = 'cloturee'$$, 'cliente A : ne peut pas changer le statut d''une réservation');
select t_erreur($$insert into reservations (commande_id, date_evenement, date_debut, date_fin, montant_location_cents, expire_at) values ('20000000-0000-0000-0000-000000000001', current_date, current_date, current_date, 1, now())$$, 'cliente A : ne peut pas insérer de réservation');
update parametres set valeur = '0' where cle = 'commission_taux';
select t_ok((select valeur::text from parametres where cle = 'commission_taux') = '0.15', 'cliente A : ne peut pas modifier les paramètres');
update profils set ville = 'Liège' where id = '00000000-0000-0000-0000-0000000000a1';
select t_ok((select ville from profils where id = '00000000-0000-0000-0000-0000000000a1') = 'Liège', 'cliente A : modifie sa ville');
update profils set ville = 'Anvers' where id = '00000000-0000-0000-0000-0000000000b1';
select t_ok((select ville from profils where id = '00000000-0000-0000-0000-0000000000b1') is null, 'cliente A : ne peut pas modifier le profil de B');
update mensurations set poitrine_cm = 120 where user_id = '00000000-0000-0000-0000-0000000000b1';
select t_erreur($$insert into mensurations (user_id, poitrine_cm) values ('00000000-0000-0000-0000-0000000000b1', 90)$$, 'cliente A : ne peut pas écrire les mensurations de B');
select t_erreur($$insert into tenues (fournisseuse_id, categorie, titre, prix_location_cents, valeur_declaree_cents, ville, sous_categorie) values ('00000000-0000-0000-0000-0000000000a1','accessoire','Bijou',1000,1000,'Liège','bijoux')$$, 'cliente A : pas fournisseuse → pas de publication');
select t_erreur($$insert into avis (reservation_id, auteur_id, note) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 5)$$, 'cliente A : pas d''avis avant le retour');
select t_erreur($$insert into etats_des_lieux (reservation_id, ligne_id, type) values ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'retour')$$, 'cliente A : pas d''état des lieux de retour avant la remise');
insert into etats_des_lieux (reservation_id, ligne_id, type, photo_face, taches) values
  ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'remise', 'x/face.webp', false);
select t_ok(t_lignes('select * from etats_des_lieux') = 1, 'cliente A : crée l''état des lieux de remise de sa réservation');
select t_erreur($$update etats_des_lieux set valide_cliente_at = now()$$, 'cliente A : la validation passe par le serveur');
delete from mensurations where user_id = '00000000-0000-0000-0000-0000000000a1';
select t_ok(t_lignes('select * from mensurations') = 0, 'cliente A : supprime ses mensurations (droit à l''effacement)');
rollback;
select t_ok((select poitrine_cm from mensurations where user_id = '00000000-0000-0000-0000-0000000000b1') = 88, 'mensurations de B intactes après tentative de A');

-- ---------------------------------------------------------------------------
-- 3. Cliente B (aucune réservation)
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select t_ok(t_lignes('select * from reservations') = 0, 'cliente B : ne voit pas la réservation de A');
select t_ok(t_lignes('select * from reservation_lignes') = 0, 'cliente B : ne voit pas les lignes de A');
select t_ok(t_lignes('select * from profils_prives') = 1, 'cliente B : ne voit que ses coordonnées');
select t_erreur($$insert into etats_des_lieux (reservation_id, ligne_id, type) values ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'remise')$$, 'cliente B : pas d''état des lieux sur la réservation de A');
rollback;

-- ---------------------------------------------------------------------------
-- 4. Fournisseuse F (a une demande de A)
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
select t_ok(t_lignes('select * from tenues where fournisseuse_id = auth.uid()') = 2, 'fournisseuse F : voit ses annonces, y compris en attente');
select t_ok(t_lignes('select * from tenues') = 3, 'fournisseuse F : ses annonces + validées des autres');
select t_ok(t_lignes('select * from reservations') = 1, 'fournisseuse F : voit la demande qui la concerne');
select t_ok(t_lignes('select * from mensurations') = 1, 'fournisseuse F : voit les mensurations de A (cliente ayant fait une demande)');
select t_ok((select user_id from mensurations) = '00000000-0000-0000-0000-0000000000a1', 'fournisseuse F : pas celles de B');
select t_erreur($$update tenues set statut = 'validee' where id = '10000000-0000-0000-0000-000000000002'$$, 'fournisseuse F : ne peut pas valider sa propre annonce');
select t_erreur($$update tenues set nb_locations = 99 where id = '10000000-0000-0000-0000-000000000001'$$, 'fournisseuse F : compteur protégé');
update tenues set titre = 'Caftan de G modifié' where id = '10000000-0000-0000-0000-000000000003';
select t_ok((select titre from tenues where id = '10000000-0000-0000-0000-000000000003') = 'Caftan de G', 'fournisseuse F : ne modifie pas l''annonce de G');
update tenues set titre = 'Caftan validé retouché' where id = '10000000-0000-0000-0000-000000000001';
select t_ok((select statut from tenues where id = '10000000-0000-0000-0000-000000000001') = 'en_attente', 'fournisseuse F : modifier le titre d''une annonce validée la renvoie en relecture');
insert into tenues (id, fournisseuse_id, categorie, sous_categorie, titre, prix_location_cents, valeur_declaree_cents, ville, statut)
  values ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000f1', 'accessoire', 'mdamma', 'Mdamma dorée', 2500, 30000, 'Bruxelles', 'validee');
select t_ok((select statut from tenues where id = '10000000-0000-0000-0000-000000000009') = 'brouillon', 'fournisseuse F : une nouvelle annonce démarre en brouillon');
select t_erreur($$update tenues set statut = 'en_attente' where id = '10000000-0000-0000-0000-000000000009'$$, 'fournisseuse F : soumission refusée sans photos obligatoires');
insert into tenue_photos (tenue_id, type, chemin) values
  ('10000000-0000-0000-0000-000000000009', 'face', '00000000-0000-0000-0000-0000000000f1/m/face.webp'),
  ('10000000-0000-0000-0000-000000000009', 'portee', '00000000-0000-0000-0000-0000000000f1/m/portee.webp');
update tenues set statut = 'en_attente' where id = '10000000-0000-0000-0000-000000000009';
select t_ok((select statut from tenues where id = '10000000-0000-0000-0000-000000000009') = 'en_attente', 'fournisseuse F : soumission acceptée avec les photos');
select t_erreur($$insert into tenue_photos (tenue_id, type, chemin) values ('10000000-0000-0000-0000-000000000003', 'face', '00000000-0000-0000-0000-0000000000f1/x.webp')$$, 'fournisseuse F : pas de photo sur l''annonce de G');
select t_erreur($$insert into tenue_photos (tenue_id, type, chemin) values ('10000000-0000-0000-0000-000000000009', 'autre', '00000000-0000-0000-0000-0000000000f2/x.webp')$$, 'fournisseuse F : chemin de photo hors de son dossier refusé');
insert into blocages (tenue_id, periode) values ('10000000-0000-0000-0000-000000000001', daterange(current_date + 40, current_date + 42, '[]'));
select t_ok(t_lignes('select id from blocages where tenue_id = ''10000000-0000-0000-0000-000000000001''') = 1, 'fournisseuse F : bloque des dates manuellement');
select t_erreur($$insert into blocages (tenue_id, periode) values ('10000000-0000-0000-0000-000000000001', daterange(current_date + 41, current_date + 45, '[]'))$$, 'contrainte d''exclusion : pas de chevauchement');
select t_erreur($$insert into blocages (tenue_id, periode) values ('10000000-0000-0000-0000-000000000003', daterange(current_date + 41, current_date + 45, '[]'))$$, 'fournisseuse F : ne bloque pas le calendrier de G');
select t_erreur($$insert into blocages (tenue_id, periode, motif) values ('10000000-0000-0000-0000-000000000001', daterange(current_date + 60, current_date + 62, '[]'), 'reservation')$$, 'fournisseuse F : ne crée pas de blocage de réservation');
select t_ok(not tenue_disponible('10000000-0000-0000-0000-000000000001', current_date + 43, current_date + 44), 'tampon pressing de 2 jours respecté');
select t_ok(tenue_disponible('10000000-0000-0000-0000-000000000001', current_date + 46, current_date + 47), 'disponible après le tampon');
select t_erreur($$update profils set stripe_onboarding_complet = true where id = '00000000-0000-0000-0000-0000000000f2'$$, 'fournisseuse F : ne modifie pas le statut Stripe de G');
select t_ok(t_lignes('select * from leads') = 0, 'fournisseuse F : aucun lead');
rollback;

-- ---------------------------------------------------------------------------
-- 5. Fournisseuse G (aucune demande) et contrôle de publication
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000f2');
set local role authenticated;
select t_ok(t_lignes('select * from mensurations') = 0, 'fournisseuse G : aucune mensuration visible sans demande');
select t_ok(t_lignes('select * from reservations') = 0, 'fournisseuse G : ne voit pas les demandes de F');
select t_ok(t_lignes('select * from profils_prives') = 1, 'fournisseuse G : uniquement ses coordonnées');
insert into tenues (id, fournisseuse_id, categorie, sous_categorie, titre, prix_location_cents, valeur_declaree_cents, ville)
  values ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000000f2', 'accessoire', 'bijoux', 'Parure', 2000, 20000, 'Anvers');
insert into tenue_photos (tenue_id, type, chemin) values
  ('10000000-0000-0000-0000-000000000008', 'face', '00000000-0000-0000-0000-0000000000f2/p/face.webp'),
  ('10000000-0000-0000-0000-000000000008', 'portee', '00000000-0000-0000-0000-0000000000f2/p/portee.webp');
select t_erreur($$update tenues set statut = 'en_attente' where id = '10000000-0000-0000-0000-000000000008'$$, 'fournisseuse G : publication refusée sans Stripe Connect');
select t_erreur($$insert into tenues (fournisseuse_id, categorie, sous_categorie, titre, prix_location_cents, valeur_declaree_cents, ville) values ('00000000-0000-0000-0000-0000000000f1', 'accessoire', 'bijoux', 'Faux', 2000, 20000, 'Anvers')$$, 'fournisseuse G : ne publie pas au nom de F');
rollback;

-- ---------------------------------------------------------------------------
-- 6. Partenaire P
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select t_ok(t_lignes('select * from leads') = 1, 'partenaire P : ne voit que ses leads');
select t_ok((select partenaire_id from leads) = '50000000-0000-0000-0000-000000000001', 'partenaire P : le lead visible est le sien');
update leads set statut = 'converti';
select t_ok((select statut from leads) = 'converti', 'partenaire P : marque son lead converti');
select t_erreur($$update leads set statut = 'payee'$$, 'partenaire P : ne marque pas un lead payé');
select t_erreur($$update partenaires set valide = false where id = '50000000-0000-0000-0000-000000000001'$$, 'partenaire P : ne change pas sa validation');
select t_ok(t_lignes('select * from reservations') = 0, 'partenaire P : aucune réservation');
select t_ok(t_lignes('select * from mensurations') = 0, 'partenaire P : aucune mensuration');
rollback;
select t_ok((select count(*) from leads where statut = 'envoye') = 2, 'lead du photographe non modifié par P');

-- ---------------------------------------------------------------------------
-- 7. Admin
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select t_ok(t_lignes('select * from tenues') = 3, 'admin : voit toutes les annonces');
select t_ok(t_lignes('select * from mensurations') = 2, 'admin : voit les mensurations (support et litiges)');
select t_ok(t_lignes('select * from leads') = 2, 'admin : voit tous les leads');
update tenues set statut = 'validee' where id = '10000000-0000-0000-0000-000000000002';
select t_ok((select validee_at is not null from tenues where id = '10000000-0000-0000-0000-000000000002'), 'admin : valide une annonce (horodatage)');
update parametres set valeur = '0.12' where cle = 'commission_taux';
select t_ok((select valeur::text from parametres where cle = 'commission_taux') = '0.12', 'admin : modifie un paramètre');
update profils set compte_valide = true where id = '00000000-0000-0000-0000-0000000000f2';
select t_ok((select compte_valide from profils where id = '00000000-0000-0000-0000-0000000000f2'), 'admin : valide un compte');
rollback;

-- ---------------------------------------------------------------------------
-- 8. Avis croisés après retour
-- ---------------------------------------------------------------------------
update reservations set statut = 'rendue' where id = '30000000-0000-0000-0000-000000000001';
begin;
select t_comme('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
insert into avis (reservation_id, auteur_id, note, commentaire) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 5, 'Superbe');
select t_ok((select cible_id from avis) = '00000000-0000-0000-0000-0000000000f1', 'avis : la cible est calculée (fournisseuse)');
select t_ok((select nb_avis from profils where id = '00000000-0000-0000-0000-0000000000f1') = 1, 'avis : note moyenne recalculée');
select t_erreur($$insert into avis (reservation_id, auteur_id, note) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 4)$$, 'avis : un seul par partie');
rollback;
begin;
select t_comme('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select t_erreur($$insert into avis (reservation_id, auteur_id, note) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 1)$$, 'avis : refusé à une tierce personne');
rollback;

-- ---------------------------------------------------------------------------
-- 9. Fin de la relation : la fournisseuse ne voit plus les mensurations
-- ---------------------------------------------------------------------------
update reservations set statut = 'cloturee' where id = '30000000-0000-0000-0000-000000000001';
begin;
select t_comme('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
select t_ok(t_lignes('select * from mensurations') = 0, 'fournisseuse F : mensurations masquées une fois la location clôturée');
rollback;

-- ---------------------------------------------------------------------------
-- 10. Stockage
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
insert into storage.objects (bucket_id, name) values ('tenues', '00000000-0000-0000-0000-0000000000f1/t/face.webp');
select t_erreur($$insert into storage.objects (bucket_id, name) values ('tenues', '00000000-0000-0000-0000-0000000000f2/t/face.webp')$$, 'stockage : pas d''écriture dans le dossier d''une autre');
select t_erreur($$insert into storage.objects (bucket_id, name) values ('etats-des-lieux', '30000000-0000-0000-0000-00000000dead/remise/x.webp')$$, 'stockage : pas d''écriture sur une réservation étrangère');
insert into storage.objects (bucket_id, name) values ('etats-des-lieux', '30000000-0000-0000-0000-000000000001/remise/face.webp');
select t_ok(true, 'stockage : écriture des photos d''état des lieux par une partie');
rollback;
begin;
select t_comme('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select t_erreur($$insert into storage.objects (bucket_id, name) values ('etats-des-lieux', '30000000-0000-0000-0000-000000000001/remise/face.webp')$$, 'stockage : cliente B exclue des photos de la réservation de A');
rollback;

-- ---------------------------------------------------------------------------
-- 11. Limitation de fréquence
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select t_ok((select bool_and(incrementer_ma_frequence('test', 3, 3600)) from generate_series(1, 3)), 'fréquence : 3 appels acceptés');
select t_ok(not incrementer_ma_frequence('test', 3, 3600), 'fréquence : le 4e est refusé');
select t_erreur($$select verifier_frequence('test:autre', 1, 60)$$, 'fréquence : la fonction brute est réservée au serveur');
select t_erreur($$select * from limites_frequence$$, 'fréquence : table interne inaccessible');
rollback;

-- ---------------------------------------------------------------------------
-- 12. Plateforme : messagerie, favoris, notifications, signalements, fiscalité
-- ---------------------------------------------------------------------------
begin;
select t_comme('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
insert into conversations (id, cliente_id, fournisseuse_id) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1');
insert into messages (conversation_id, auteur_id, contenu) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Bonjour, appelez-moi au 0470 12 34 56 ou b@exemple.be');
select t_ok((select masque and contenu not like '%0470%' and contenu not like '%@%' from messages limit 1), 'messages : coordonnées masquées avant paiement');
select t_erreur($$insert into conversations (cliente_id, fournisseuse_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1')$$, 'conversations : impossible d''écrire au nom d''une autre');
insert into messages (conversation_id, auteur_id, contenu) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'usurpation');
select t_ok((select auteur_id = '00000000-0000-0000-0000-0000000000b1' from messages where contenu = 'usurpation'), 'messages : l''autrice est toujours la personne connectée');
insert into favoris (tenue_id) values ('10000000-0000-0000-0000-000000000001');
select t_ok(t_lignes('select * from favoris') = 1, 'favoris : ajout pour soi');
insert into signalements (cible_type, cible_id, motif) values ('tenue', '10000000-0000-0000-0000-000000000001', 'photos_trompeuses');
update signalements set statut = 'traite';
select t_ok((select statut = 'ouvert' from signalements limit 1), 'signalements : traitement réservé à l''équipe');
reset role;
select t_comme('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
select t_ok(t_lignes('select * from messages') = 2, 'messages : la fournisseuse lit la conversation');
select t_ok(t_lignes($q$select * from notifications where type = 'message'$q$) = 1, 'notifications : nouveau message signalé à la destinataire');
update messages set lu_at = now();
select t_ok((select bool_and(lu_at is not null) from messages), 'messages : la destinataire marque comme lu');
select t_ok(t_lignes('select * from favoris') = 0, 'favoris : invisibles pour les autres');
reset role;
select t_comme('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select t_ok(t_lignes('select * from messages') = 0, 'messages : conversation invisible pour une tierce personne');
select t_ok(t_lignes('select * from signalements') = 0, 'signalements : invisibles pour une tierce personne');
insert into conversations (id, cliente_id, fournisseuse_id) values ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1');
insert into messages (conversation_id, auteur_id, contenu) values ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'Mon numéro : 0470 12 34 56');
select t_ok((select not masque from messages where conversation_id = '50000000-0000-0000-0000-000000000002'), 'messages : coordonnées visibles après paiement');
insert into infos_fiscales (statut_juridique, nom_legal, date_naissance, adresse, code_postal, localite, numero_fiscal) values ('particulier', 'Amina Test', '1990-01-01', 'Rue de test 1', '1000', 'Bruxelles', '90010112345');
reset role;
select t_comme('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select t_ok(t_lignes('select * from infos_fiscales') = 0, 'fiscalité : données d''une autre invisibles');
reset role;
select t_comme('00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select t_ok(t_lignes('select * from infos_fiscales') = 1, 'fiscalité : lisibles par l''administration');
select t_ok(t_lignes('select * from signalements') = 1, 'signalements : lisibles par l''administration');
rollback;

begin;
select t_comme('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
update tenues set code_postal = '4000' where id = '10000000-0000-0000-0000-000000000001';
select t_ok((select ville = 'Liège' and commune is not null from tenues where id = '10000000-0000-0000-0000-000000000001'), 'localisation : le code postal fixe commune et province');
select t_erreur($$update tenues set code_postal = '0000' where id = '10000000-0000-0000-0000-000000000001'$$, 'localisation : code postal inconnu refusé');
select t_erreur($$update profils set badge_confiance = true where id = '00000000-0000-0000-0000-0000000000f1'$$, 'badge : non modifiable par la fournisseuse');
rollback;

select 'TOUS LES TESTS RLS SONT PASSÉS' as resultat;
