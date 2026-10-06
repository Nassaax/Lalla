-- Hub des fêtes : trois univers d'annonces dans la même mécanique de réservation.
--   tenue      : caftans, takchitas… (tailles, mesures, pressing, caution, état des lieux)
--   materiel   : sono, éclairage, décoration, mobilier, vaisselle (dates, caution, état des lieux, sans pressing)
--   prestation : maquillage, photo, henné, negafa, DJ… (une date et une heure, sans caution ni état des lieux)
-- Chaque catégorie a ses propres critères, enregistrés dans tenues.attributs (formulaire adapté côté site).

create or replace function univers_de(c categorie_tenue) returns text
language sql immutable as $$
  select case
    when c in ('sono', 'eclairage', 'decoration', 'mobilier', 'vaisselle') then 'materiel'
    when c in ('maquillage', 'coiffure', 'photographie', 'videographie', 'henne', 'negafa', 'dj', 'traiteur', 'patisserie') then 'prestation'
    else 'tenue'
  end
$$;

alter table tenues add column if not exists univers text generated always as (univers_de(categorie)) stored;
alter table tenues add column if not exists attributs jsonb not null default '{}'::jsonb;
alter table tenues drop constraint if exists tenues_attributs_check;
alter table tenues add constraint tenues_attributs_check check (jsonb_typeof(attributs) = 'object' and pg_column_size(attributs) < 4000);
create index if not exists tenues_univers on tenues (univers, statut);

-- Mesures obligatoires pour les seules tenues (hors accessoires)
alter table tenues drop constraint if exists mesures_obligatoires;
alter table tenues add constraint mesures_obligatoires check (
  univers <> 'tenue' or categorie = 'accessoire' or (
    poitrine_cm is not null and taille_cm is not null and hanches_cm is not null
    and longueur_cm is not null and manche_cm is not null
  )
);

-- Prestations : pas de caution
alter table tenues drop constraint if exists tenues_prestation_sans_caution;
alter table tenues add constraint tenues_prestation_sans_caution check (univers <> 'prestation' or caution_mode = 'aucune');

-- Réservations : nature (location ou prestation) et lieu de la prestation
alter table reservations add column if not exists nature text not null default 'location';
alter table reservations drop constraint if exists reservations_nature_check;
alter table reservations add constraint reservations_nature_check check (nature in ('location', 'prestation'));
alter table reservations add column if not exists adresse_prestation text check (adresse_prestation is null or char_length(adresse_prestation) <= 300);

-- Disponibilité : battement de pressing pour les seules tenues
create or replace function tenue_disponible(p_tenue uuid, p_debut date, p_fin date) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select not exists (
    select 1 from blocages b
    join tenues t on t.id = p_tenue
    where b.tenue_id = p_tenue
      and b.periode && daterange(
        p_debut - case when t.univers = 'tenue' then param_int('pressing_jours', 2) else 0 end,
        p_fin + case when t.univers = 'tenue' then param_int('pressing_jours', 2) else 0 end, '[]')
  )
$$;

-- Contrôle des annonces : photos adaptées à l'univers, relecture si les critères changent
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
      if new.univers <> 'tenue' then
        -- Matériel et prestations : une photo principale suffit
        if not (coalesce(v_types, '{}') @> array['face']::type_photo[]) then
          raise exception 'Photo principale manquante.' using errcode = 'P0001', hint = 'photos_requises';
        end if;
      elsif new.categorie = 'accessoire' then
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
      or new.categorie is distinct from old.categorie
      or new.attributs is distinct from old.attributs) then
    -- Une modification de fond d'une annonce publiée repasse en relecture.
    new.statut := 'en_attente';
    new.soumise_at := now();
  end if;
  return new;
end $$;

-- Recherche : filtre par univers, critères renvoyés au site
drop function if exists rechercher_tenues(categorie_tenue, text, text, numeric, numeric, numeric, numeric, text, integer, text, date, date, uuid, type_fournisseuse, text, text, integer, integer, text, integer, boolean);
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
  p_decalage integer default 0,
  p_code_postal text default null,
  p_rayon_km integer default null,
  p_instantanee boolean default null,
  p_univers text default null
)
returns table (
  id uuid, titre text, categorie categorie_tenue, sous_categorie sous_categorie_accessoire,
  prix_location_cents integer, valeur_declaree_cents integer, ville text, couleurs text[], occasions text[],
  taille_indicative text, essayage_possible boolean, fournisseuse_id uuid, fournisseuse_nom text,
  type_fournisseuse type_fournisseuse, note_moyenne numeric, photo text, photo_portee text, total bigint,
  commune text, distance_km numeric, reservation_instantanee boolean, badge_confiance boolean, nb_avis integer,
  univers text, attributs jsonb
)
language sql stable set search_path = public, extensions as $$
  with base as (
    select t.*, p.boutique_nom, p.nom_affiche, p.type_fournisseuse as p_type, p.note_moyenne as p_note, p.nb_avis as p_nb_avis,
      p.score_visibilite, p.badge_confiance as p_badge,
      case when p_code_postal is not null then distance_cp(p_code_postal, coalesce(t.code_postal, p.code_postal)) end as dist
    from tenues t
    join profils p on p.id = t.fournisseuse_id
    where t.statut = 'validee'
      and p.statut_compte = 'actif'
      and (p_univers is null or t.univers = p_univers)
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
      and (p_instantanee is null or t.reservation_instantanee = p_instantanee)
      and (p_recherche is null or t.titre ilike '%' || p_recherche || '%' or t.description ilike '%' || p_recherche || '%')
      and (p_debut is null or p_fin is null or tenue_disponible(t.id, p_debut, p_fin))
  )
  select
    b.id, b.titre, b.categorie, b.sous_categorie, b.prix_location_cents, b.valeur_declaree_cents, b.ville,
    b.couleurs, b.occasions, b.taille_indicative, b.essayage_possible, b.fournisseuse_id,
    coalesce(b.boutique_nom, b.nom_affiche), b.p_type, b.p_note,
    (select ph.chemin from tenue_photos ph where ph.tenue_id = b.id and ph.type = 'face' order by ph.ordre limit 1),
    (select ph.chemin from tenue_photos ph where ph.tenue_id = b.id and ph.type = 'portee' order by ph.ordre limit 1),
    count(*) over (),
    b.commune, b.dist, b.reservation_instantanee, b.p_badge, b.p_nb_avis, b.univers, b.attributs
  from base b
  where p_rayon_km is null or b.dist is null or b.dist <= p_rayon_km
  order by
    case when p_tri = 'distance' then b.dist end asc nulls last,
    case when p_tri = 'prix_asc' then b.prix_location_cents end asc,
    case when p_tri = 'prix_desc' then b.prix_location_cents end desc,
    case when p_tri = 'recent' then b.validee_at end desc,
    b.p_badge desc, b.score_visibilite desc, b.p_note desc nulls last, b.nb_locations desc, b.validee_at desc
  limit case when auth.uid() is null then least(greatest(p_limite, 1), 6) else least(greatest(p_limite, 1), 60) end
  offset case when auth.uid() is null then 0 else greatest(p_decalage, 0) end
$$;

grant execute on function rechercher_tenues to anon, authenticated;
alter function public.tenues_controler() set search_path = public, extensions;
alter function public.univers_de(categorie_tenue) set search_path = public;
