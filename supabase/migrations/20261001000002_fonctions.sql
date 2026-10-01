-- LALLA — 002 : fonctions utilitaires et triggers métier
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------

-- Vrai quand la requête vient du serveur (clé service_role) ou d'une migration.
-- Volontairement SANS security definer : current_user doit être le rôle appelant.
create or replace function est_serveur() returns boolean
language sql stable as $$
  select current_user::text in ('service_role', 'postgres', 'supabase_admin')
$$;

create or replace function est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.est_admin from profils p where p.id = auth.uid()), false)
$$;

create or replace function param(p_cle text) returns jsonb
language sql stable security definer set search_path = public as $$
  select valeur from parametres where cle = p_cle
$$;

create or replace function param_int(p_cle text, p_defaut integer) returns integer
language sql stable as $$
  select coalesce((param(p_cle) #>> '{}')::integer, p_defaut)
$$;

create or replace function maj_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Limitation de fréquence : renvoie false si la limite est atteinte.
create or replace function verifier_frequence(p_cle text, p_max integer, p_fenetre_secondes integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_fenetre timestamptz := to_timestamp(floor(extract(epoch from now()) / p_fenetre_secondes) * p_fenetre_secondes);
  v_compteur integer;
begin
  insert into limites_frequence (cle, fenetre, compteur) values (p_cle, v_fenetre, 1)
  on conflict (cle, fenetre) do update set compteur = limites_frequence.compteur + 1
  returning compteur into v_compteur;
  return v_compteur <= p_max;
end $$;

-- Variante utilisateur : la clé est toujours liée à auth.uid(), un appel direct
-- ne peut donc pas consommer le quota de quelqu'un d'autre.
create or replace function incrementer_ma_frequence(p_action text, p_max integer, p_fenetre_secondes integer)
returns boolean
language sql security definer set search_path = public as $$
  select verifier_frequence(left(p_action, 40) || ':' || coalesce(auth.uid()::text, 'anon'), p_max, p_fenetre_secondes)
$$;

create or replace function exiger_frequence(p_action text, p_max integer, p_fenetre_secondes integer)
returns void
language plpgsql as $$
begin
  if est_serveur() then return; end if;
  if not incrementer_ma_frequence(p_action, p_max, p_fenetre_secondes) then
    raise exception 'Trop de requêtes, réessayez plus tard.' using errcode = 'P0429', hint = 'trop_de_requetes';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Inscription : création du profil
-- ---------------------------------------------------------------------------
create or replace function creer_profil_utilisateur() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type type_fournisseuse;
begin
  if m ->> 'type_fournisseuse' in ('particuliere', 'negafa', 'creatrice') then
    v_type := (m ->> 'type_fournisseuse')::type_fournisseuse;
  end if;
  insert into profils (id, nom_affiche, langue, est_fournisseuse, type_fournisseuse, est_partenaire, ville)
  values (
    new.id,
    left(coalesce(nullif(m ->> 'prenom', ''), split_part(new.email, '@', 1)), 80),
    case when m ->> 'langue' = 'nl' then 'nl' else 'fr' end,
    v_type is not null,
    v_type,
    coalesce(m ->> 'partenaire', '') = 'true',
    case when m ->> 'ville' in ('Bruxelles', 'Liège', 'Anvers') then m ->> 'ville' end
  )
  on conflict (id) do nothing;
  insert into profils_prives (id, prenom, nom, email, consentement_cgu_at)
  values (
    new.id,
    left(m ->> 'prenom', 60),
    left(m ->> 'nom', 80),
    new.email,
    case when (m ->> 'cgu')::boolean then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger a_la_creation_utilisateur
  after insert on auth.users
  for each row execute function creer_profil_utilisateur();

-- ---------------------------------------------------------------------------
-- Profils : champs protégés
-- ---------------------------------------------------------------------------
create or replace function profils_proteger() returns trigger
language plpgsql as $$
begin
  if est_serveur() or est_admin() then return new; end if;
  if new.est_admin is distinct from old.est_admin
     or new.statut_compte is distinct from old.statut_compte
     or new.compte_valide is distinct from old.compte_valide
     or new.stripe_onboarding_complet is distinct from old.stripe_onboarding_complet
     or new.identite_verifiee is distinct from old.identite_verifiee
     or new.score_visibilite is distinct from old.score_visibilite
     or new.solde_penalites_cents is distinct from old.solde_penalites_cents
     or new.note_moyenne is distinct from old.note_moyenne
     or new.nb_avis is distinct from old.nb_avis then
    raise exception 'Champ protégé.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profils_proteger before update on profils
  for each row execute function profils_proteger();

create or replace function profils_prives_proteger() returns trigger
language plpgsql as $$
begin
  if est_serveur() or est_admin() then
    new.updated_at := now();
    return new;
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_account_id is distinct from old.stripe_account_id
     or new.identite_session_id is distinct from old.identite_session_id
     or new.email is distinct from old.email then
    raise exception 'Champ protégé.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profils_prives_proteger before update on profils_prives
  for each row execute function profils_prives_proteger();

create trigger mensurations_maj before update on mensurations
  for each row execute function maj_updated_at();

-- ---------------------------------------------------------------------------
-- Accès aux données personnelles
-- ---------------------------------------------------------------------------

-- La fournisseuse ne voit les mensurations d'une cliente que si celle-ci lui
-- a adressé une demande encore active.
create or replace function peut_voir_mensurations(p_cliente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = p_cliente
    or est_admin()
    or exists (
      select 1 from reservations r
      where r.cliente_id = p_cliente
        and r.fournisseuse_id = auth.uid()
        and r.statut not in ('annulee', 'cloturee')
    )
  )
$$;

create or replace function est_partie_reservation(p_reservation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reservations r
    where r.id = p_reservation
      and auth.uid() is not null
      and (r.cliente_id = auth.uid() or r.fournisseuse_id = auth.uid())
  )
$$;

-- Coordonnées visibles par la contrepartie d'une réservation payée (remise en main propre).
create or replace function peut_voir_coordonnees(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = p_user
    or est_admin()
    or exists (
      select 1 from reservations r
      where r.statut in ('payee', 'remise', 'rendue', 'litige')
        and ((r.cliente_id = auth.uid() and r.fournisseuse_id = p_user)
          or (r.fournisseuse_id = auth.uid() and r.cliente_id = p_user))
    )
  )
$$;

create or replace function est_proprietaire_tenue(p_tenue uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenues t where t.id = p_tenue and t.fournisseuse_id = auth.uid())
$$;

create or replace function tenue_visible(p_tenue uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenues t
    where t.id = p_tenue
      and (t.statut = 'validee' or t.fournisseuse_id = auth.uid() or est_admin())
  )
$$;

-- ---------------------------------------------------------------------------
-- Tenues : workflow de publication
-- ---------------------------------------------------------------------------
create or replace function tenues_controler() returns trigger
language plpgsql as $$
declare
  v_profil profils%rowtype;
  v_types type_photo[];
begin
  new.updated_at := now();
  if est_serveur() or est_admin() then
    if tg_op = 'UPDATE' and new.statut = 'validee' and old.statut is distinct from 'validee' then
      new.validee_at := now();
      new.motif_refus := null;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform exiger_frequence('tenue_creer', 40, 3600);
    if new.fournisseuse_id is distinct from auth.uid() then
      raise exception 'Annonce : propriétaire invalide.' using errcode = '42501';
    end if;
    new.nb_locations := 0;
    new.validee_at := null;
    new.motif_refus := null;
    if new.statut not in ('brouillon') then
      new.statut := 'brouillon';
    end if;
    return new;
  end if;

  -- UPDATE par la propriétaire
  if new.fournisseuse_id is distinct from old.fournisseuse_id
     or new.nb_locations is distinct from old.nb_locations
     or new.validee_at is distinct from old.validee_at
     or new.motif_refus is distinct from old.motif_refus then
    raise exception 'Champ protégé.' using errcode = '42501';
  end if;

  if new.statut is distinct from old.statut then
    if new.statut in ('validee', 'refusee') then
      raise exception 'Seule l''équipe peut valider une annonce.' using errcode = '42501';
    end if;
    if new.statut = 'en_attente' then
      select * into v_profil from profils where id = new.fournisseuse_id;
      if not v_profil.stripe_onboarding_complet then
        raise exception 'Finalisez votre compte de paiement avant de publier.' using errcode = 'P0001', hint = 'stripe_requis';
      end if;
      select array_agg(distinct type) into v_types from tenue_photos where tenue_id = new.id;
      if new.categorie = 'accessoire' then
        if not (coalesce(v_types, '{}') @> array['face', 'portee']::type_photo[]) then
          raise exception 'Photos obligatoires manquantes.' using errcode = 'P0001', hint = 'photos_requises';
        end if;
      elsif not (coalesce(v_types, '{}') @> array['face', 'dos', 'broderie', 'portee']::type_photo[]) then
        raise exception 'Photos obligatoires manquantes.' using errcode = 'P0001', hint = 'photos_requises';
      end if;
      new.soumise_at := now();
    end if;
  elsif old.statut = 'validee' and (
      new.titre is distinct from old.titre
      or new.description is distinct from old.description
      or new.categorie is distinct from old.categorie) then
    -- Une modification de fond d'une annonce publiée repasse en relecture.
    new.statut := 'en_attente';
    new.soumise_at := now();
  end if;
  return new;
end $$;
create trigger tenues_controler before insert or update on tenues
  for each row execute function tenues_controler();

create or replace function tenue_photos_controler() returns trigger
language plpgsql as $$
begin
  if est_serveur() or est_admin() then return new; end if;
  perform exiger_frequence('photo_ajouter', 300, 3600);
  if not est_proprietaire_tenue(new.tenue_id) then
    raise exception 'Annonce : accès refusé.' using errcode = '42501';
  end if;
  if new.chemin not like auth.uid()::text || '/%' then
    raise exception 'Chemin de photo invalide.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger tenue_photos_controler before insert or update on tenue_photos
  for each row execute function tenue_photos_controler();

create or replace function ensembles_controler() returns trigger
language plpgsql as $$
declare
  a tenues%rowtype;
  b tenues%rowtype;
begin
  select * into a from tenues where id = new.tenue_id;
  select * into b from tenues where id = new.accessoire_id;
  if a.fournisseuse_id is distinct from b.fournisseuse_id then
    raise exception 'Un ensemble relie des pièces de la même fournisseuse.' using errcode = 'P0001';
  end if;
  if b.categorie <> 'accessoire' or a.categorie = 'accessoire' then
    raise exception 'Un ensemble relie une tenue à un accessoire.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger ensembles_controler before insert on ensembles
  for each row execute function ensembles_controler();

create or replace function blocages_controler() returns trigger
language plpgsql as $$
begin
  if est_serveur() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.motif <> 'manuel' then
      raise exception 'Ce blocage est lié à une réservation.' using errcode = '42501';
    end if;
    return old;
  end if;
  perform exiger_frequence('blocage', 200, 3600);
  if new.motif <> 'manuel' or new.reservation_id is not null then
    raise exception 'Blocage manuel uniquement.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.motif <> 'manuel' then
    raise exception 'Ce blocage est lié à une réservation.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger blocages_controler before insert or update or delete on blocages
  for each row execute function blocages_controler();

-- Disponibilité : aucune période bloquée ne chevauche la location + tampon pressing.
create or replace function tenue_disponible(p_tenue uuid, p_debut date, p_fin date) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select not exists (
    select 1 from blocages b
    where b.tenue_id = p_tenue
      and b.periode && daterange(p_debut - param_int('pressing_jours', 2), p_fin + param_int('pressing_jours', 2), '[]')
  )
$$;

-- ---------------------------------------------------------------------------
-- Réservations : journal et compteurs
-- ---------------------------------------------------------------------------
alter table reservations add column derniere_action_par text;
alter table reservations add column derniere_raison text;

create or replace function reservations_journaliser() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into reservation_historique (reservation_id, de, vers, acteur, raison)
    values (new.id, null, new.statut, coalesce(new.derniere_action_par, 'cliente'), coalesce(new.derniere_raison, 'creation'));
  elsif new.statut is distinct from old.statut then
    insert into reservation_historique (reservation_id, de, vers, acteur, raison)
    values (new.id, old.statut, new.statut, coalesce(new.derniere_action_par, 'systeme'), new.derniere_raison);
    if new.statut = 'payee' then
      update tenues t set nb_locations = nb_locations + 1
      from reservation_lignes l where l.reservation_id = new.id and l.tenue_id = t.id;
    end if;
    if new.statut = 'annulee' then
      delete from blocages where reservation_id = new.id;
    end if;
  end if;
  return new;
end $$;
create trigger reservations_journaliser after insert or update on reservations
  for each row execute function reservations_journaliser();
create trigger reservations_maj before update on reservations
  for each row execute function maj_updated_at();
create trigger essayages_maj before update on essayages
  for each row execute function maj_updated_at();

-- ---------------------------------------------------------------------------
-- États des lieux
-- ---------------------------------------------------------------------------
create or replace function edl_controler() returns trigger
language plpgsql as $$
declare
  r reservations%rowtype;
begin
  new.updated_at := now();
  if est_serveur() then return new; end if;
  perform exiger_frequence('edl', 60, 3600);
  select * into r from reservations where id = new.reservation_id;
  if not exists (select 1 from reservation_lignes l where l.id = new.ligne_id and l.reservation_id = new.reservation_id) then
    raise exception 'Ligne de réservation invalide.' using errcode = '42501';
  end if;
  if new.type = 'remise' and r.statut <> 'payee' then
    raise exception 'L''état des lieux de remise se fait sur une réservation payée.' using errcode = 'P0001';
  end if;
  if new.type = 'retour' and r.statut <> 'remise' then
    raise exception 'L''état des lieux de retour se fait après la remise.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.cree_par := auth.uid();
    new.valide_cliente_at := null;
    new.valide_fournisseuse_at := null;
  else
    if old.valide_cliente_at is not null or old.valide_fournisseuse_at is not null then
      raise exception 'État des lieux déjà validé : il ne peut plus être modifié.' using errcode = 'P0001';
    end if;
    if new.valide_cliente_at is distinct from old.valide_cliente_at
       or new.valide_fournisseuse_at is distinct from old.valide_fournisseuse_at
       or new.cree_par is distinct from old.cree_par
       or new.reservation_id is distinct from old.reservation_id
       or new.ligne_id is distinct from old.ligne_id
       or new.type is distinct from old.type then
      raise exception 'Champ protégé.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger edl_controler before insert or update on etats_des_lieux
  for each row execute function edl_controler();

-- ---------------------------------------------------------------------------
-- Avis croisés
-- ---------------------------------------------------------------------------
create or replace function avis_preparer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r reservations%rowtype;
begin
  select * into r from reservations where id = new.reservation_id;
  if r.id is null or r.statut not in ('rendue', 'cloturee') then
    raise exception 'Avis possible après le retour de la tenue.' using errcode = 'P0001';
  end if;
  if new.auteur_id = r.cliente_id then
    new.cible_id := r.fournisseuse_id;
    new.sens := 'cliente_vers_fournisseuse';
  elsif new.auteur_id = r.fournisseuse_id then
    new.cible_id := r.cliente_id;
    new.sens := 'fournisseuse_vers_cliente';
  else
    raise exception 'Avis réservé aux parties de la location.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger avis_preparer before insert on avis
  for each row execute function avis_preparer();

create or replace function avis_limiter() returns trigger
language plpgsql as $$
begin
  perform exiger_frequence('avis', 20, 3600);
  return new;
end $$;
create trigger avis_limiter before insert on avis
  for each row execute function avis_limiter();

create or replace function avis_recalculer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cible uuid := coalesce(new.cible_id, old.cible_id);
begin
  update profils p set
    note_moyenne = s.moyenne,
    nb_avis = s.nb
  from (select round(avg(note)::numeric, 2) as moyenne, count(*)::int as nb from avis where cible_id = v_cible) s
  where p.id = v_cible;
  return null;
end $$;
create trigger avis_recalculer after insert or delete on avis
  for each row execute function avis_recalculer();

-- ---------------------------------------------------------------------------
-- Hub partenaires
-- ---------------------------------------------------------------------------
create or replace function partenaires_controler() returns trigger
language plpgsql as $$
begin
  if est_serveur() or est_admin() then return new; end if;
  if tg_op = 'INSERT' then
    perform exiger_frequence('partenaire', 3, 86400);
    new.user_id := auth.uid();
    new.valide := false;
    new.taux_commission := 0.10;
  elsif new.valide is distinct from old.valide
     or new.taux_commission is distinct from old.taux_commission
     or new.user_id is distinct from old.user_id then
    raise exception 'Champ protégé.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger partenaires_controler before insert or update on partenaires
  for each row execute function partenaires_controler();

create or replace function leads_controler() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if est_serveur() or est_admin() then return new; end if;
  -- Le partenaire peut seulement signaler qu'un lead est converti.
  if not (old.statut = 'envoye' and new.statut = 'converti')
     or (to_jsonb(new) - 'statut' - 'updated_at') is distinct from (to_jsonb(old) - 'statut' - 'updated_at') then
    raise exception 'Modification non autorisée.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger leads_controler before update on leads
  for each row execute function leads_controler();

create or replace function showroom_inscriptions_controler() returns trigger
language plpgsql as $$
declare
  v_places integer;
  v_inscrits integer;
begin
  select places into v_places from showrooms where id = new.showroom_id and actif and fin > now();
  if v_places is null then
    raise exception 'Showroom indisponible.' using errcode = 'P0001';
  end if;
  select count(*) into v_inscrits from showroom_inscriptions where showroom_id = new.showroom_id;
  if v_inscrits >= v_places then
    raise exception 'Showroom complet.' using errcode = 'P0001', hint = 'complet';
  end if;
  return new;
end $$;
create trigger showroom_inscriptions_controler before insert on showroom_inscriptions
  for each row execute function showroom_inscriptions_controler();

create trigger parametres_maj before update on parametres
  for each row execute function maj_updated_at();

-- ---------------------------------------------------------------------------
-- Recherche catalogue (RLS appliquée : security invoker)
-- ---------------------------------------------------------------------------
create or replace function rechercher_tenues(
  p_categorie categorie_tenue default null,
  p_occasion text default null,
  p_taille text default null,
  p_poitrine numeric default null,
  p_tour_taille numeric default null,
  p_hanches numeric default null,
  p_longueur numeric default null,
  p_couleur text default null,
  p_prix_max integer default null,
  p_ville text default null,
  p_debut date default null,
  p_fin date default null,
  p_fournisseuse uuid default null,
  p_type_fournisseuse type_fournisseuse default null,
  p_recherche text default null,
  p_tri text default 'pertinence',
  p_limite integer default 24,
  p_decalage integer default 0
)
returns table (
  id uuid, titre text, categorie categorie_tenue, sous_categorie sous_categorie_accessoire,
  prix_location_cents integer, valeur_declaree_cents integer, ville text, couleurs text[], occasions text[],
  taille_indicative text, essayage_possible boolean, fournisseuse_id uuid, fournisseuse_nom text,
  type_fournisseuse type_fournisseuse, note_moyenne numeric, photo text, photo_portee text, total bigint
)
language sql stable set search_path = public, extensions as $$
  select
    t.id, t.titre, t.categorie, t.sous_categorie, t.prix_location_cents, t.valeur_declaree_cents, t.ville,
    t.couleurs, t.occasions, t.taille_indicative, t.essayage_possible, t.fournisseuse_id,
    coalesce(p.boutique_nom, p.nom_affiche), p.type_fournisseuse, p.note_moyenne,
    (select ph.chemin from tenue_photos ph where ph.tenue_id = t.id and ph.type = 'face' order by ph.ordre limit 1),
    (select ph.chemin from tenue_photos ph where ph.tenue_id = t.id and ph.type = 'portee' order by ph.ordre limit 1),
    count(*) over ()
  from tenues t
  join profils p on p.id = t.fournisseuse_id
  where t.statut = 'validee'
    and p.statut_compte = 'actif'
    and (p_categorie is null or t.categorie = p_categorie)
    and (p_occasion is null or p_occasion = any (t.occasions))
    and (p_taille is null or t.taille_indicative = p_taille or t.taille_indicative = 'unique')
    and (p_poitrine is null or t.poitrine_cm is null or t.poitrine_cm between p_poitrine and p_poitrine + 8)
    and (p_tour_taille is null or t.taille_cm is null or t.taille_cm between p_tour_taille and p_tour_taille + 8)
    and (p_hanches is null or t.hanches_cm is null or t.hanches_cm between p_hanches and p_hanches + 8)
    and (p_longueur is null or t.longueur_cm is null or abs(t.longueur_cm - p_longueur) <= 6)
    and (p_couleur is null or p_couleur = any (t.couleurs))
    and (p_prix_max is null or t.prix_location_cents <= p_prix_max)
    and (p_ville is null or t.ville = p_ville)
    and (p_fournisseuse is null or t.fournisseuse_id = p_fournisseuse)
    and (p_type_fournisseuse is null or p.type_fournisseuse = p_type_fournisseuse)
    and (p_recherche is null or t.titre ilike '%' || p_recherche || '%' or t.description ilike '%' || p_recherche || '%')
    and (p_debut is null or p_fin is null or tenue_disponible(t.id, p_debut, p_fin))
  order by
    case when p_tri = 'prix_asc' then t.prix_location_cents end asc,
    case when p_tri = 'prix_desc' then t.prix_location_cents end desc,
    case when p_tri = 'recent' then t.validee_at end desc,
    p.score_visibilite desc, p.note_moyenne desc nulls last, t.nb_locations desc, t.validee_at desc
  limit least(greatest(p_limite, 1), 60) offset greatest(p_decalage, 0)
$$;
