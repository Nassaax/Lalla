-- LALLA, migration 007
-- 1. Toute la Belgique : la colonne « ville » accepte désormais Bruxelles et les 10 provinces.
-- 2. Catalogue : un visiteur non connecté ne voit qu'un aperçu (6 tenues), il doit s'inscrire pour voir la suite.

create or replace function public.zone_valide(v text)
returns boolean
language sql immutable
set search_path = public, extensions
as $$
  select v in (
    'Bruxelles', 'Anvers', 'Brabant flamand', 'Brabant wallon', 'Flandre occidentale', 'Flandre orientale',
    'Hainaut', 'Liège', 'Limbourg', 'Luxembourg', 'Namur'
  )
$$;

alter table tenues drop constraint if exists tenues_ville_check;
alter table tenues add constraint tenues_ville_check check (zone_valide(ville));
alter table showrooms drop constraint if exists showrooms_ville_check;
alter table showrooms add constraint showrooms_ville_check check (zone_valide(ville));
alter table partenaires drop constraint if exists partenaires_ville_check;
alter table partenaires add constraint partenaires_ville_check check (zone_valide(ville));

-- Création du profil à l'inscription : même logique qu'en 002, avec la nouvelle liste de zones.
create or replace function creer_profil_utilisateur() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
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
    case when zone_valide(m ->> 'ville') then m ->> 'ville' end
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

-- Recherche : aperçu limité à 6 tenues (sans pagination) pour les visiteurs non connectés.
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
  limit case when auth.uid() is null then least(greatest(p_limite, 1), 6) else least(greatest(p_limite, 1), 60) end
  offset case when auth.uid() is null then 0 else greatest(p_decalage, 0) end
$$;
