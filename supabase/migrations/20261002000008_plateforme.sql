-- LALLA, migration 008 : fonctions « plateforme » (Airbnb des caftans).
-- Messagerie, favoris, notifications, signalements, informations fiscales (DAC7),
-- localisation par code postal, réservation instantanée, créneau de remise, badge de confiance.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Localisation : codes postaux (remplis par la migration 009), province déduite du code
-- ---------------------------------------------------------------------------
create table code_postaux (
  cp text not null check (cp ~ '^[0-9]{4}$'),
  commune text not null,
  lat double precision not null,
  lon double precision not null,
  primary key (cp, commune)
);

create or replace function province_du_cp(p_cp text) returns text
language sql immutable set search_path = public, extensions as $$
  select case
    when p_cp !~ '^[0-9]{4}$' then null
    when p_cp::int between 1000 and 1299 then 'Bruxelles'
    when p_cp::int between 1300 and 1499 then 'Brabant wallon'
    when p_cp::int between 1500 and 1999 then 'Brabant flamand'
    when p_cp::int between 2000 and 2999 then 'Anvers'
    when p_cp::int between 3000 and 3499 then 'Brabant flamand'
    when p_cp::int between 3500 and 3999 then 'Limbourg'
    when p_cp::int between 4000 and 4999 then 'Liège'
    when p_cp::int between 5000 and 5999 then 'Namur'
    when p_cp::int between 6000 and 6599 then 'Hainaut'
    when p_cp::int between 6600 and 6999 then 'Luxembourg'
    when p_cp::int between 7000 and 7999 then 'Hainaut'
    when p_cp::int between 8000 and 8999 then 'Flandre occidentale'
    when p_cp::int between 9000 and 9999 then 'Flandre orientale'
  end
$$;

/** Distance approximative en km entre deux codes postaux (centre des communes). */
create or replace function distance_cp(a text, b text) returns numeric
language sql stable set search_path = public, extensions as $$
  with pa as (select avg(lat) lat, avg(lon) lon from code_postaux where cp = a),
       pb as (select avg(lat) lat, avg(lon) lon from code_postaux where cp = b)
  select round((6371 * 2 * asin(sqrt(
      power(sin(radians(pb.lat - pa.lat) / 2), 2)
      + cos(radians(pa.lat)) * cos(radians(pb.lat)) * power(sin(radians(pb.lon - pa.lon) / 2), 2)
    )))::numeric, 0)
  from pa, pb where pa.lat is not null and pb.lat is not null
$$;

alter table tenues add column code_postal text check (code_postal is null or code_postal ~ '^[0-9]{4}$');
alter table tenues add column commune text check (commune is null or char_length(commune) <= 60);
alter table profils add column code_postal text check (code_postal is null or code_postal ~ '^[0-9]{4}$');
alter table profils add column commune text check (commune is null or char_length(commune) <= 60);

-- Le code postal fixe la commune et la province (colonne « ville »).
create or replace function localiser() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if new.code_postal is not null and (tg_op = 'INSERT' or new.code_postal is distinct from old.code_postal) then
    if not exists (select 1 from code_postaux where cp = new.code_postal) then
      raise exception 'Code postal belge inconnu : %', new.code_postal using errcode = '22023';
    end if;
    if new.commune is null or not exists (select 1 from code_postaux where cp = new.code_postal and commune = new.commune) then
      new.commune := (select commune from code_postaux where cp = new.code_postal order by commune limit 1);
    end if;
    new.ville := province_du_cp(new.code_postal);
  end if;
  return new;
end $$;
create trigger tenues_localiser before insert or update on tenues for each row execute function localiser();
create trigger profils_localiser before insert or update on profils for each row execute function localiser();

-- ---------------------------------------------------------------------------
-- Réservation instantanée, créneau de remise, instructions de remise
-- ---------------------------------------------------------------------------
alter table tenues add column reservation_instantanee boolean not null default false;
alter table reservations add column creneau_remise timestamptz;
alter table reservations add column creneau_propose_par text check (creneau_propose_par in ('cliente', 'fournisseuse'));
alter table reservations add column creneau_confirme boolean not null default false;
alter table profils_prives add column instructions_remise text check (instructions_remise is null or char_length(instructions_remise) <= 500);

-- ---------------------------------------------------------------------------
-- Profil public et badge « Fournisseuse de confiance »
-- ---------------------------------------------------------------------------
alter table profils add column badge_confiance boolean not null default false;
alter table profils add column taux_reponse smallint check (taux_reponse between 0 and 100);
alter table profils add column delai_reponse_h numeric(6,1);
alter table profils add column nb_locations integer not null default 0;
alter table profils add column langues text[] not null default '{}'
  check (langues <@ array['fr','nl','en','ar','darija','tamazight','es','tr']::text[]);

/** Recalcule taux et délai de réponse, nombre de locations et badge (appelée chaque jour par le cron). */
create or replace function maj_indicateurs_fournisseuses() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  with stats as (
    select r.fournisseuse_id id,
      count(*) filter (where r.created_at > now() - interval '365 days') demandes,
      count(*) filter (where r.created_at > now() - interval '365 days' and (r.acceptee_at is not null or r.annulee_par = 'fournisseuse')) repondues,
      avg(extract(epoch from (coalesce(r.acceptee_at, r.annulee_at) - r.created_at)) / 3600)
        filter (where r.created_at > now() - interval '365 days' and (r.acceptee_at is not null or r.annulee_par = 'fournisseuse')) delai,
      count(*) filter (where r.statut in ('rendue', 'cloturee')) locations,
      count(*) filter (where r.annulee_par = 'fournisseuse' and r.acceptee_at is not null and r.annulee_at > now() - interval '365 days') annul
    from reservations r where r.fournisseuse_id is not null group by r.fournisseuse_id
  )
  update profils p set
    taux_reponse = case when s.demandes > 0 then round(100.0 * s.repondues / s.demandes) end,
    delai_reponse_h = round(s.delai::numeric, 1),
    nb_locations = s.locations,
    badge_confiance = (s.locations >= 3 and coalesce(p.note_moyenne, 0) >= 4.7 and p.nb_avis >= 3
                       and s.demandes > 0 and 100.0 * s.repondues / s.demandes >= 90 and s.annul = 0)
  from stats s where s.id = p.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications (cloche) : créées par le serveur et par les triggers
-- ---------------------------------------------------------------------------
create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profils(id) on delete cascade,
  type text not null check (char_length(type) <= 40),
  titre text not null check (char_length(titre) <= 200),
  lien text check (lien is null or lien ~ '^/'),
  lu_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Messagerie : une conversation par paire cliente / fournisseuse
-- ---------------------------------------------------------------------------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references profils(id) on delete cascade,
  fournisseuse_id uuid not null references profils(id) on delete cascade,
  tenue_id uuid references tenues(id) on delete set null,
  dernier_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cliente_id, fournisseuse_id),
  check (cliente_id <> fournisseuse_id)
);
create index conversations_fournisseuse on conversations (fournisseuse_id, dernier_message_at desc);
create index conversations_cliente on conversations (cliente_id, dernier_message_at desc);

create table messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  auteur_id uuid references profils(id) on delete set null,
  contenu text not null check (char_length(contenu) between 1 and 2000),
  masque boolean not null default false,
  lu_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation on messages (conversation_id, created_at);

create or replace function est_partie_conversation(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations c where c.id = p_conv and auth.uid() in (c.cliente_id, c.fournisseuse_id))
$$;

create or replace function conversations_controler() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if est_serveur() then return new; end if;
  perform exiger_frequence('conversation_creer', 20, 3600);
  if new.cliente_id is distinct from auth.uid() then
    raise exception 'Conversation : vous ne pouvez écrire qu''en votre nom.' using errcode = '42501';
  end if;
  if not exists (select 1 from profils p where p.id = new.fournisseuse_id and p.est_fournisseuse and p.statut_compte = 'actif') then
    raise exception 'Cette fournisseuse n''est pas joignable.' using errcode = '42501';
  end if;
  new.dernier_message_at := null;
  new.created_at := now();
  return new;
end $$;
create trigger conversations_controler before insert on conversations for each row execute function conversations_controler();

-- Avant paiement, les coordonnées (email, téléphone, liens) sont masquées : la relation reste sur la plateforme.
create or replace function messages_controler() returns trigger
language plpgsql set search_path = public, extensions as $$
declare
  c conversations%rowtype;
  payee boolean;
  propre text;
begin
  select * into c from conversations where id = new.conversation_id;
  if not est_serveur() then
    perform exiger_frequence('message', 40, 600);
    if auth.uid() is null or auth.uid() not in (c.cliente_id, c.fournisseuse_id) then
      raise exception 'Message : conversation introuvable.' using errcode = '42501';
    end if;
    new.auteur_id := auth.uid();
    new.lu_at := null;
    new.created_at := now();
  end if;
  new.contenu := btrim(new.contenu);
  select exists (
    select 1 from reservations r
    where r.cliente_id = c.cliente_id and r.fournisseuse_id = c.fournisseuse_id
      and r.statut in ('payee', 'remise', 'rendue', 'cloturee', 'litige')
  ) into payee;
  if not payee then
    propre := regexp_replace(new.contenu, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[coordonnées masquées]', 'g');
    propre := regexp_replace(propre, '(\+|00)?[0-9][0-9 ./-]{7,}[0-9]', '[coordonnées masquées]', 'g');
    propre := regexp_replace(propre, '(https?://|www\.)\S+', '[lien masqué]', 'gi');
    propre := regexp_replace(propre, '(wa\.me|whatsapp|snap(chat)?|insta(gram)?|telegram)\S*', '[coordonnées masquées]', 'gi');
    if propre is distinct from new.contenu then
      new.masque := true;
      new.contenu := propre;
    end if;
  end if;
  return new;
end $$;
create trigger messages_controler before insert on messages for each row execute function messages_controler();

create or replace function messages_apres() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  c conversations%rowtype;
  dest uuid;
  nom text;
begin
  select * into c from conversations where id = new.conversation_id;
  update conversations set dernier_message_at = new.created_at where id = c.id;
  dest := case when new.auteur_id = c.cliente_id then c.fournisseuse_id else c.cliente_id end;
  select coalesce(nullif(boutique_nom, ''), nom_affiche) into nom from profils where id = new.auteur_id;
  -- Une seule notification non lue par conversation : on évite d'inonder la cloche.
  if not exists (select 1 from notifications n where n.user_id = dest and n.type = 'message' and n.lu_at is null and n.lien = '/compte.html?vue=messages&c=' || c.id) then
    insert into notifications (user_id, type, titre, lien)
    values (dest, 'message', 'Nouveau message de ' || coalesce(nom, 'votre interlocutrice'), '/compte.html?vue=messages&c=' || c.id);
  end if;
  return null;
end $$;
create trigger messages_apres after insert on messages for each row execute function messages_apres();

-- Seule la destinataire peut marquer un message comme lu (colonne lu_at uniquement).
create or replace function messages_lecture_controler() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if est_serveur() then return new; end if;
  if new.auteur_id = auth.uid() then
    raise exception 'Message : action non autorisée.' using errcode = '42501';
  end if;
  new.lu_at := coalesce(old.lu_at, now());
  return new;
end $$;
create trigger messages_lecture before update on messages for each row execute function messages_lecture_controler();

-- ---------------------------------------------------------------------------
-- Favoris
-- ---------------------------------------------------------------------------
create table favoris (
  user_id uuid not null default auth.uid() references profils(id) on delete cascade,
  tenue_id uuid not null references tenues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tenue_id)
);

-- ---------------------------------------------------------------------------
-- Signalements
-- ---------------------------------------------------------------------------
create table signalements (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid default auth.uid() references profils(id) on delete set null,
  cible_type text not null check (cible_type in ('tenue', 'profil', 'conversation')),
  cible_id uuid not null,
  motif text not null check (motif in ('contrefacon', 'photos_trompeuses', 'arnaque', 'comportement', 'hors_plateforme', 'autre')),
  message text check (message is null or char_length(message) <= 1000),
  statut text not null default 'ouvert' check (statut in ('ouvert', 'traite')),
  note_admin text check (note_admin is null or char_length(note_admin) <= 1000),
  created_at timestamptz not null default now(),
  traite_at timestamptz
);
create index signalements_statut on signalements (statut, created_at desc);

create or replace function signalements_controler() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if est_serveur() or est_admin() then return new; end if;
  if tg_op = 'INSERT' then
    perform exiger_frequence('signalement', 10, 3600);
    new.auteur_id := auth.uid();
    new.statut := 'ouvert';
    new.note_admin := null;
    new.traite_at := null;
    return new;
  end if;
  raise exception 'Signalement : action réservée à l''équipe.' using errcode = '42501';
end $$;
create trigger signalements_controler before insert or update on signalements for each row execute function signalements_controler();

-- ---------------------------------------------------------------------------
-- Informations fiscales des fournisseuses (directive DAC7)
-- ---------------------------------------------------------------------------
create table infos_fiscales (
  user_id uuid primary key default auth.uid() references profils(id) on delete cascade,
  statut_juridique text not null check (statut_juridique in ('particulier', 'entreprise')),
  nom_legal text not null check (char_length(nom_legal) between 2 and 120),
  date_naissance date,
  adresse text not null check (char_length(adresse) between 5 and 200),
  code_postal text not null check (char_length(code_postal) between 3 and 10),
  localite text not null check (char_length(localite) between 2 and 80),
  pays text not null default 'BE' check (pays ~ '^[A-Z]{2}$'),
  numero_fiscal text check (numero_fiscal is null or numero_fiscal ~ '^[A-Za-z0-9 .-]{6,20}$'),
  numero_entreprise text check (numero_entreprise is null or numero_entreprise ~ '^[A-Za-z0-9 .-]{6,20}$'),
  numero_tva text check (numero_tva is null or numero_tva ~ '^[A-Za-z]{2}[A-Za-z0-9 .-]{6,16}$'),
  iban text check (iban is null or iban ~ '^[A-Z]{2}[0-9A-Z ]{12,32}$'),
  updated_at timestamptz not null default now(),
  check (statut_juridique = 'entreprise' or (date_naissance is not null and numero_fiscal is not null)),
  check (statut_juridique = 'particulier' or numero_entreprise is not null)
);

create or replace function infos_fiscales_controler() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  new.updated_at := now();
  if est_serveur() or est_admin() then return new; end if;
  perform exiger_frequence('infos_fiscales', 20, 3600);
  if new.user_id is distinct from auth.uid() then
    raise exception 'Informations fiscales : vous ne pouvez modifier que les vôtres.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger infos_fiscales_controler before insert or update on infos_fiscales for each row execute function infos_fiscales_controler();

-- Fonctions de trigger déjà existantes : chemin de recherche figé (cohérent avec la migration 006).
alter function province_du_cp(text) set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Recherche : distance depuis un code postal, tri par proximité
-- ---------------------------------------------------------------------------
drop function if exists rechercher_tenues(categorie_tenue, text, text, numeric, numeric, numeric, numeric, text, integer, text, date, date, uuid, type_fournisseuse, text, text, integer, integer);
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
  p_instantanee boolean default null
)
returns table (
  id uuid, titre text, categorie categorie_tenue, sous_categorie sous_categorie_accessoire,
  prix_location_cents integer, valeur_declaree_cents integer, ville text, couleurs text[], occasions text[],
  taille_indicative text, essayage_possible boolean, fournisseuse_id uuid, fournisseuse_nom text,
  type_fournisseuse type_fournisseuse, note_moyenne numeric, photo text, photo_portee text, total bigint,
  commune text, distance_km numeric, reservation_instantanee boolean, badge_confiance boolean, nb_avis integer
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
    b.commune, b.dist, b.reservation_instantanee, b.p_badge, b.p_nb_avis
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

-- ---------------------------------------------------------------------------
-- RLS et privilèges
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['code_postaux', 'notifications', 'conversations', 'messages', 'favoris', 'signalements', 'infos_fiscales'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;

grant select on code_postaux to anon, authenticated;
create policy code_postaux_lecture on code_postaux for select using (true);

grant select on notifications to authenticated;
grant update (lu_at) on notifications to authenticated;
create policy notifications_lecture on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_lu on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert on conversations to authenticated;
create policy conversations_lecture on conversations for select to authenticated
  using (auth.uid() in (cliente_id, fournisseuse_id) or est_admin());
create policy conversations_creation on conversations for insert to authenticated with check (cliente_id = auth.uid());

grant select, insert on messages to authenticated;
grant update (lu_at) on messages to authenticated;
grant usage on sequence messages_id_seq to authenticated;
create policy messages_lecture on messages for select to authenticated using (est_partie_conversation(conversation_id) or est_admin());
create policy messages_envoi on messages for insert to authenticated with check (est_partie_conversation(conversation_id) and auteur_id = auth.uid());
create policy messages_lu on messages for update to authenticated using (est_partie_conversation(conversation_id) and auteur_id <> auth.uid());

grant select, insert, delete on favoris to authenticated;
create policy favoris_lecture on favoris for select to authenticated using (user_id = auth.uid());
create policy favoris_ajout on favoris for insert to authenticated with check (user_id = auth.uid());
create policy favoris_retrait on favoris for delete to authenticated using (user_id = auth.uid());

grant select, insert on signalements to authenticated;
grant update (statut, note_admin, traite_at) on signalements to authenticated;
create policy signalements_lecture on signalements for select to authenticated using (auteur_id = auth.uid() or est_admin());
create policy signalements_creation on signalements for insert to authenticated with check (auteur_id = auth.uid());
create policy signalements_admin on signalements for update to authenticated using (est_admin()) with check (est_admin());

grant select, insert, update on infos_fiscales to authenticated;
create policy infos_fiscales_lecture on infos_fiscales for select to authenticated using (user_id = auth.uid() or est_admin());
create policy infos_fiscales_creation on infos_fiscales for insert to authenticated with check (user_id = auth.uid());
create policy infos_fiscales_maj on infos_fiscales for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nouvelles colonnes modifiables par l'utilisatrice elle-même
grant update (code_postal, commune, langues) on profils to authenticated;
grant update (instructions_remise) on profils_prives to authenticated;

-- Fonctions
revoke execute on function maj_indicateurs_fournisseuses() from public, anon, authenticated;
grant execute on function maj_indicateurs_fournisseuses() to service_role;
grant execute on function province_du_cp(text), distance_cp(text, text), est_partie_conversation(uuid) to anon, authenticated;
grant execute on function rechercher_tenues to anon, authenticated;
