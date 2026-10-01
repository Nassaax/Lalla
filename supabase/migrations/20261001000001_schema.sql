-- LALLA — 001 : extensions, types et tables
-- Tous les montants sont en centimes d'euro (integer).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists citext with schema extensions;

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type type_fournisseuse as enum ('particuliere', 'negafa', 'creatrice');
create type categorie_tenue as enum ('caftan', 'takchita', 'mariee', 'homme', 'enfant', 'accessoire');
create type sous_categorie_accessoire as enum ('mdamma', 'bijoux', 'couronne');
create type statut_annonce as enum ('brouillon', 'en_attente', 'validee', 'refusee', 'archivee');
create type type_photo as enum ('face', 'dos', 'broderie', 'portee', 'autre');
create type statut_reservation as enum ('demande', 'acceptee', 'payee', 'remise', 'rendue', 'cloturee', 'annulee', 'litige');
create type statut_commande as enum ('en_attente_reponses', 'a_payer', 'payee', 'annulee', 'terminee');
create type statut_caution as enum ('aucune', 'a_enregistrer', 'carte_enregistree', 'autorisee', 'echec', 'liberee', 'capturee');
create type mode_remise as enum ('main_propre', 'envoi');
create type statut_essayage as enum ('a_payer', 'demande', 'confirme', 'refuse', 'effectue', 'annule');
create type type_essayage as enum ('chez_fournisseuse', 'showroom');
create type type_edl as enum ('remise', 'retour');
create type statut_litige as enum ('ouvert', 'resolu');
create type metier_partenaire as enum ('maquilleuse', 'photographe', 'hennaya', 'negafa');
create type statut_lead as enum ('envoye', 'converti', 'commission_due', 'payee');
create type type_mouvement as enum ('paiement', 'frais_service', 'commission', 'transfert', 'remboursement', 'caution_capture', 'essayage', 'penalite');
create type acteur_annulation as enum ('cliente', 'fournisseuse', 'systeme', 'admin');

-- ---------------------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------------------
create table profils (
  id uuid primary key references auth.users(id) on delete cascade,
  nom_affiche text not null default '' check (char_length(nom_affiche) <= 80),
  ville text check (ville is null or char_length(ville) <= 60),
  langue text not null default 'fr' check (langue in ('fr', 'nl')),
  est_cliente boolean not null default true,
  est_fournisseuse boolean not null default false,
  type_fournisseuse type_fournisseuse,
  est_partenaire boolean not null default false,
  est_admin boolean not null default false,
  statut_compte text not null default 'actif' check (statut_compte in ('actif', 'suspendu')),
  compte_valide boolean not null default false,
  boutique_nom text check (boutique_nom is null or char_length(boutique_nom) <= 80),
  boutique_slug citext unique check (boutique_slug is null or boutique_slug ~ '^[a-z0-9-]{3,40}$'),
  boutique_bio text check (boutique_bio is null or char_length(boutique_bio) <= 1200),
  avatar_chemin text,
  stripe_onboarding_complet boolean not null default false,
  identite_verifiee boolean not null default false,
  score_visibilite integer not null default 100 check (score_visibilite between 0 and 100),
  solde_penalites_cents integer not null default 0 check (solde_penalites_cents >= 0),
  note_moyenne numeric(3,2),
  nb_avis integer not null default 0,
  created_at timestamptz not null default now(),
  constraint fournisseuse_a_un_type check (not est_fournisseuse or type_fournisseuse is not null)
);

create table profils_prives (
  id uuid primary key references profils(id) on delete cascade,
  prenom text check (prenom is null or char_length(prenom) <= 60),
  nom text check (nom is null or char_length(nom) <= 80),
  email citext,
  telephone text check (telephone is null or telephone ~ '^[+0-9 ().-]{6,25}$'),
  adresse text check (adresse is null or char_length(adresse) <= 200),
  code_postal text check (code_postal is null or code_postal ~ '^[0-9]{4}$'),
  stripe_customer_id text,
  stripe_account_id text unique,
  identite_session_id text,
  consentement_cgu_at timestamptz,
  updated_at timestamptz not null default now()
);

create table mensurations (
  user_id uuid primary key references profils(id) on delete cascade,
  poitrine_cm numeric(5,1) check (poitrine_cm between 40 and 200),
  taille_cm numeric(5,1) check (taille_cm between 30 and 200),
  hanches_cm numeric(5,1) check (hanches_cm between 40 and 220),
  longueur_cm numeric(5,1) check (longueur_cm between 30 and 220),
  manche_cm numeric(5,1) check (manche_cm between 10 and 100),
  hauteur_cm numeric(5,1) check (hauteur_cm between 80 and 230),
  updated_at timestamptz not null default now()
);

create table parametres (
  cle text primary key,
  valeur jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profils(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Annonces
-- ---------------------------------------------------------------------------
create table tenues (
  id uuid primary key default gen_random_uuid(),
  fournisseuse_id uuid not null references profils(id) on delete cascade,
  categorie categorie_tenue not null,
  sous_categorie sous_categorie_accessoire,
  titre text not null check (char_length(titre) between 3 and 90),
  description text not null default '' check (char_length(description) <= 2500),
  couleurs text[] not null default '{}',
  occasions text[] not null default '{}',
  taille_indicative text check (taille_indicative is null or taille_indicative in ('XS','S','M','L','XL','XXL','3XL','unique','enfant')),
  poitrine_cm numeric(5,1),
  taille_cm numeric(5,1),
  hanches_cm numeric(5,1),
  longueur_cm numeric(5,1),
  manche_cm numeric(5,1),
  prix_location_cents integer not null check (prix_location_cents between 500 and 500000),
  valeur_declaree_cents integer not null check (valeur_declaree_cents between 1000 and 5000000),
  duree_min_jours integer not null default 1 check (duree_min_jours between 1 and 30),
  duree_max_jours integer not null default 4 check (duree_max_jours between 1 and 30),
  remise_main_propre boolean not null default true,
  essayage_possible boolean not null default false,
  envoi_assure boolean not null default false,
  frais_envoi_cents integer not null default 0 check (frais_envoi_cents between 0 and 10000),
  ville text not null check (ville in ('Bruxelles', 'Liège', 'Anvers')),
  statut statut_annonce not null default 'brouillon',
  motif_refus text,
  soumise_at timestamptz,
  validee_at timestamptz,
  nb_locations integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint duree_coherente check (duree_min_jours <= duree_max_jours),
  constraint un_mode_de_remise check (remise_main_propre or envoi_assure),
  constraint sous_categorie_accessoire check ((categorie = 'accessoire') = (sous_categorie is not null)),
  constraint mesures_obligatoires check (
    categorie = 'accessoire' or (
      poitrine_cm is not null and taille_cm is not null and hanches_cm is not null
      and longueur_cm is not null and manche_cm is not null
    )
  ),
  constraint occasions_valides check (occasions <@ array['mariage','fiancailles','henne','aid','soiree','bapteme']::text[])
);
create index tenues_statut_categorie on tenues (statut, categorie);
create index tenues_fournisseuse on tenues (fournisseuse_id);
create index tenues_ville on tenues (ville);
create index tenues_couleurs on tenues using gin (couleurs);
create index tenues_occasions on tenues using gin (occasions);

create table tenue_photos (
  id uuid primary key default gen_random_uuid(),
  tenue_id uuid not null references tenues(id) on delete cascade,
  type type_photo not null,
  chemin text not null,
  ordre integer not null default 0,
  largeur integer,
  hauteur integer,
  created_at timestamptz not null default now()
);
create index tenue_photos_tenue on tenue_photos (tenue_id, ordre);

create table ensembles (
  tenue_id uuid not null references tenues(id) on delete cascade,
  accessoire_id uuid not null references tenues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenue_id, accessoire_id),
  check (tenue_id <> accessoire_id)
);

-- ---------------------------------------------------------------------------
-- Commandes et réservations
-- ---------------------------------------------------------------------------
create table commandes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references profils(id) on delete set null,
  statut statut_commande not null default 'en_attente_reponses',
  date_evenement date not null,
  date_debut date not null,
  date_fin date not null,
  transfer_group text unique,
  checkout_session_id text,
  payment_intent_id text,
  charge_id text,
  setup_checkout_session_id text,
  payment_method_id text,
  montant_total_cents integer,
  frais_service_cents integer not null default 0,
  deduction_essayage_cents integer not null default 0,
  identite_requise boolean not null default false,
  payee_at timestamptz,
  created_at timestamptz not null default now(),
  check (date_debut <= date_evenement and date_evenement <= date_fin)
);
create index commandes_cliente on commandes (cliente_id);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes(id) on delete cascade,
  cliente_id uuid references profils(id) on delete set null,
  fournisseuse_id uuid references profils(id) on delete set null,
  statut statut_reservation not null default 'demande',
  date_evenement date not null,
  date_debut date not null,
  date_fin date not null,
  mode_remise mode_remise not null default 'main_propre',
  adresse_envoi text,
  numero_suivi text check (numero_suivi is null or char_length(numero_suivi) <= 60),
  message text check (message is null or char_length(message) <= 1000),
  montant_location_cents integer not null,
  frais_pressing_cents integer not null default 0,
  frais_envoi_cents integer not null default 0,
  frais_service_cents integer not null default 0,
  commission_cents integer not null default 0,
  deduction_essayage_cents integer not null default 0,
  montant_transfert_cents integer not null default 0,
  caution_cents integer not null default 0,
  caution_statut statut_caution not null default 'aucune',
  caution_payment_intent_id text,
  caution_autorisee_at timestamptz,
  caution_capturee_cents integer not null default 0,
  expire_at timestamptz not null,
  acceptee_at timestamptz,
  payee_at timestamptz,
  remise_at timestamptz,
  rendue_at timestamptz,
  litige_deadline timestamptz,
  versement_prevu_at timestamptz,
  transfer_id text,
  verse_at timestamptz,
  cloturee_at timestamptz,
  annulee_at timestamptz,
  annulee_par acteur_annulation,
  motif_annulation text,
  rembourse_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_debut <= date_fin)
);
create index reservations_cliente on reservations (cliente_id, statut);
create index reservations_fournisseuse on reservations (fournisseuse_id, statut);
create index reservations_commande on reservations (commande_id);
create index reservations_statut on reservations (statut);

create table reservation_lignes (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  tenue_id uuid references tenues(id) on delete set null,
  titre_snapshot text not null,
  prix_location_cents integer not null,
  frais_pressing_cents integer not null default 0,
  caution_cents integer not null default 0
);
create index reservation_lignes_reservation on reservation_lignes (reservation_id);
create index reservation_lignes_tenue on reservation_lignes (tenue_id);

create table reservation_historique (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references reservations(id) on delete cascade,
  de statut_reservation,
  vers statut_reservation not null,
  acteur text not null,
  raison text,
  created_at timestamptz not null default now()
);
create index reservation_historique_resa on reservation_historique (reservation_id, created_at);

create table blocages (
  id uuid primary key default gen_random_uuid(),
  tenue_id uuid not null references tenues(id) on delete cascade,
  periode daterange not null,
  motif text not null default 'manuel' check (motif in ('manuel', 'reservation')),
  reservation_id uuid references reservations(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((motif = 'reservation') = (reservation_id is not null)),
  check (not isempty(periode)),
  exclude using gist (tenue_id with =, periode with &&)
);

-- ---------------------------------------------------------------------------
-- Essayages et showrooms
-- ---------------------------------------------------------------------------
create table showrooms (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  ville text not null check (ville in ('Bruxelles', 'Liège', 'Anvers')),
  lieu text not null,
  adresse text not null,
  debut timestamptz not null,
  fin timestamptz not null,
  places integer not null default 30 check (places > 0),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  check (debut < fin)
);

create table showroom_inscriptions (
  id uuid primary key default gen_random_uuid(),
  showroom_id uuid not null references showrooms(id) on delete cascade,
  user_id uuid not null references profils(id) on delete cascade,
  tenue_ids uuid[] not null default '{}',
  message text check (message is null or char_length(message) <= 500),
  created_at timestamptz not null default now(),
  unique (showroom_id, user_id)
);

create table essayages (
  id uuid primary key default gen_random_uuid(),
  tenue_id uuid references tenues(id) on delete set null,
  cliente_id uuid references profils(id) on delete set null,
  fournisseuse_id uuid references profils(id) on delete set null,
  type type_essayage not null,
  showroom_id uuid references showrooms(id) on delete set null,
  creneau timestamptz not null,
  statut statut_essayage not null default 'a_payer',
  frais_cents integer not null default 0,
  checkout_session_id text,
  payment_intent_id text,
  transfer_id text,
  rembourse boolean not null default false,
  deduit_commande_id uuid references commandes(id) on delete set null,
  message text check (message is null or char_length(message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index essayages_cliente on essayages (cliente_id);
create index essayages_fournisseuse on essayages (fournisseuse_id);

-- ---------------------------------------------------------------------------
-- États des lieux, litiges, avis
-- ---------------------------------------------------------------------------
create table etats_des_lieux (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  ligne_id uuid not null references reservation_lignes(id) on delete cascade,
  type type_edl not null,
  photo_face text,
  photo_dos text,
  photo_broderies text,
  photo_doublure text,
  taches boolean not null default false,
  accrocs boolean not null default false,
  perles_manquantes boolean not null default false,
  commentaire text check (commentaire is null or char_length(commentaire) <= 1000),
  cree_par uuid references profils(id) on delete set null,
  valide_cliente_at timestamptz,
  valide_fournisseuse_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ligne_id, type)
);
create index edl_reservation on etats_des_lieux (reservation_id);

create table litiges (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations(id) on delete cascade,
  ouvert_par uuid references profils(id) on delete set null,
  motif text not null check (motif in ('degat', 'tache', 'perte', 'retard', 'non_conforme', 'autre')),
  description text not null check (char_length(description) between 10 and 2000),
  photos text[] not null default '{}',
  montant_demande_cents integer not null default 0 check (montant_demande_cents >= 0),
  statut statut_litige not null default 'ouvert',
  decision text,
  montant_capture_cents integer not null default 0,
  montant_rembourse_cents integer not null default 0,
  resolu_par uuid references profils(id) on delete set null,
  created_at timestamptz not null default now(),
  resolu_at timestamptz
);

create table avis (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  auteur_id uuid references profils(id) on delete set null,
  cible_id uuid references profils(id) on delete cascade,
  sens text not null check (sens in ('cliente_vers_fournisseuse', 'fournisseuse_vers_cliente')),
  note smallint not null check (note between 1 and 5),
  commentaire text check (commentaire is null or char_length(commentaire) <= 1000),
  created_at timestamptz not null default now(),
  unique (reservation_id, auteur_id)
);
create index avis_cible on avis (cible_id);

-- ---------------------------------------------------------------------------
-- Hub mariage
-- ---------------------------------------------------------------------------
create table partenaires (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references profils(id) on delete cascade,
  nom text not null check (char_length(nom) between 2 and 80),
  metier metier_partenaire not null,
  ville text not null check (ville in ('Bruxelles', 'Liège', 'Anvers')),
  bio text check (bio is null or char_length(bio) <= 1500),
  galerie text[] not null default '{}',
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  site text check (site is null or site ~ '^https://'),
  email_contact citext not null,
  valide boolean not null default false,
  taux_commission numeric(4,3) not null default 0.10,
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  partenaire_id uuid not null references partenaires(id) on delete cascade,
  nom text not null check (char_length(nom) between 2 and 80),
  email citext not null,
  telephone text,
  date_evenement date,
  ville text,
  message text not null check (char_length(message) between 10 and 1500),
  statut statut_lead not null default 'envoye',
  montant_commission_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_partenaire on leads (partenaire_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Comptabilité, Stripe, anti-spam
-- ---------------------------------------------------------------------------
create table mouvements (
  id bigint generated always as identity primary key,
  type type_mouvement not null,
  montant_cents integer not null,
  commande_id uuid references commandes(id) on delete set null,
  reservation_id uuid references reservations(id) on delete set null,
  essayage_id uuid references essayages(id) on delete set null,
  stripe_id text,
  libelle text,
  created_at timestamptz not null default now()
);
create index mouvements_date on mouvements (created_at);
create unique index mouvements_unicite on mouvements (type, coalesce(stripe_id, ''), coalesce(reservation_id::text, ''), coalesce(essayage_id::text, ''))
  where stripe_id is not null;

create table evenements_stripe (
  id text primary key,
  type text not null,
  recu_at timestamptz not null default now(),
  traite_at timestamptz,
  erreur text
);

create table limites_frequence (
  cle text not null,
  fenetre timestamptz not null,
  compteur integer not null default 0,
  primary key (cle, fenetre)
);
