# LALLA — Plan technique

> Plateforme belge de location de tenues marocaines entre particulières, negafas, créatrices et clientes.
> Promesse : « Portez l'exceptionnel, le temps d'une fête. »

Ce document est la référence d'architecture. Il décrit le schéma SQL, les règles d'accès (RLS), les flux Stripe, les tâches planifiées et la timeline des animations.

---

## 0. Vue d'ensemble

```
Navigateur (HTML/CSS/JS vanilla, CDN)
   │  supabase-js (clé anon + JWT utilisateur)  ──►  Supabase (Auth, Postgres + RLS, Storage)
   │  fetch('/api/v1/<action>')  (JWT dans Authorization)
   ▼
Vercel Functions (/api) ── clé service_role, Stripe, Resend
   ▲
Stripe ── webhooks signés ──► /api/webhook
Vercel Cron ──► /api/cron/<tâche>  (Authorization: Bearer CRON_SECRET)
```

Principes :
- **Le navigateur lit** (catalogue, fiches, tableau de bord) et **écrit uniquement ce qui ne touche pas l'argent ni les statuts** (profil, annonces en brouillon, mensurations, photos, avis), toujours sous RLS.
- **Le serveur décide** : montants, statuts de réservation, transferts, cautions, validations. Chaque transition passe par `lib/transitions.js`, qui vérifie l'état courant et journalise dans `reservation_historique`.
- **Une seule source de vérité** pour les paramètres métier : la table `parametres`, éditable depuis `admin.html`.
- **Nom de marque** : `assets/config.js` (`BRAND.name`). Ce fichier est lu à la fois par le navigateur et par les fonctions `/api`.

### Fonctions Vercel (6 au total, sous la limite du plan Hobby)

| Fichier | Rôle |
|---|---|
| `api/config.js` | Expose au navigateur `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SITE_URL` (valeurs publiques), mis en cache 1 h |
| `api/v1/[action].js` | Routeur JSON vers `lib/actions/*` (commandes, paiements, Connect, Identity, états des lieux, litiges, formulaires, admin) |
| `api/webhook.js` | Webhooks Stripe, corps brut, signature vérifiée, idempotence |
| `api/cron.js` | Tâches planifiées (`?task=`) |
| `api/share.js` | Page de partage `/t/:id` avec les balises Open Graph de la tenue, puis redirection |
| `api/sitemap.js` | `sitemap.xml` dynamique (tenues validées et boutiques) |

---

## 1. Schéma SQL

Fichiers : `supabase/migrations/2026100100000*_*.sql`. Extensions : `pgcrypto`, `btree_gist`, `citext`.

### 1.1 Types énumérés

| Type | Valeurs |
|---|---|
| `type_fournisseuse` | particuliere, negafa, creatrice |
| `categorie_tenue` | caftan, takchita, mariee, homme, enfant, accessoire |
| `sous_categorie_accessoire` | mdamma, bijoux, couronne |
| `statut_annonce` | brouillon, en_attente, validee, refusee, archivee |
| `type_photo` | face, dos, broderie, portee, autre |
| `statut_reservation` | demande, acceptee, payee, remise, rendue, cloturee, annulee, litige |
| `statut_commande` | en_attente_reponses, a_payer, payee, annulee, terminee |
| `statut_caution` | aucune, a_enregistrer, carte_enregistree, autorisee, echec, liberee, capturee |
| `mode_remise` | main_propre, envoi |
| `statut_essayage` | a_payer, demande, confirme, refuse, effectue, annule |
| `type_essayage` | chez_fournisseuse, showroom |
| `type_edl` | remise, retour |
| `statut_litige` | ouvert, resolu |
| `metier_partenaire` | maquilleuse, photographe, hennaya, negafa |
| `statut_lead` | envoye, converti, commission_due, payee |
| `type_mouvement` | paiement, frais_service, commission, transfert, remboursement, caution_capture, essayage, penalite |

### 1.2 Tables

**profils** — une ligne par compte (`id = auth.users.id`), créée par trigger à l'inscription. Champs publics uniquement.
`id, nom_affiche, ville, langue (fr|nl), est_cliente, est_fournisseuse, type_fournisseuse, est_partenaire, est_admin, statut_compte (actif|suspendu), boutique_nom, boutique_slug, boutique_bio, avatar_chemin, stripe_account_id, stripe_onboarding_complet, identite_verifiee, score_visibilite (0-100), solde_penalites_cents, note_moyenne, nb_avis, created_at`

**profils_prives** — données personnelles (RGPD).
`id → profils, prenom, nom, email, telephone, adresse, code_postal, stripe_customer_id, identite_session_id, consentement_cgu_at`

**mensurations** — données personnelles sensibles.
`user_id PK → profils, poitrine_cm, taille_cm, hanches_cm, longueur_cm, manche_cm, hauteur_cm, updated_at`

**parametres** — `cle PK, valeur jsonb, description, updated_at, updated_by`.

| Clé | Défaut | Sens |
|---|---|---|
| commission_taux | 0.15 | Part prélevée sur la location (côté fournisseuse) |
| frais_service_taux | 0.05 | Frais de service ajoutés au panier (côté cliente) |
| frais_pressing_cents | 1500 | Fixe par tenue, reversé à la fournisseuse |
| frais_essayage_cents | 1500 | Déduits si la cliente réserve dans les 30 jours |
| caution_taux | 0.5 | Caution = valeur déclarée × taux |
| pressing_jours | 2 | Jours bloqués avant et après chaque location |
| delai_reponse_heures | 24 | Au-delà, la demande est annulée automatiquement |
| delai_litige_heures | 48 | Fenêtre d'ouverture d'un litige après le retour |
| delai_versement_heures | 24 | Délai entre le retour confirmé et le transfert |
| seuil_identity_cents | 50000 | Caution totale au-delà de laquelle Stripe Identity est exigé |
| empreinte_jours_avant | 2 | Création de l'empreinte X jours avant la remise |
| seuil_setup_jours | 5 | Au-delà, enregistrement de la carte puis empreinte différée |
| politique_annulation | `[{"jours_min":30,"pct":100},{"jours_min":14,"pct":50},{"jours_min":0,"pct":0}]` | Remboursement de la location selon le délai avant l'événement |
| penalite_fournisseuse_cents | 2500 | Pénalité si une fournisseuse annule après acceptation |
| penalite_visibilite_points | 15 | Baisse du score de visibilité |
| essayage_validite_jours | 30 | Durée de validité de la déduction |

**tenues**
`id, fournisseuse_id, categorie, sous_categorie, titre, description, couleurs text[], occasions text[], taille_indicative, poitrine_cm, taille_cm, hanches_cm, longueur_cm, manche_cm, prix_location_cents, valeur_declaree_cents, duree_min_jours, duree_max_jours, remise_main_propre, essayage_possible, envoi_assure, frais_envoi_cents, ville, statut, motif_refus, soumise_at, validee_at, nb_locations, created_at, updated_at`
- Contraintes : les mesures sont obligatoires sauf pour un accessoire, `duree_min ≤ duree_max`, prix > 0, au moins un mode de remise.
- Index : `(statut, categorie)`, `(ville)`, GIN sur `couleurs` et `occasions`.

**tenue_photos** — `id, tenue_id, type, chemin, ordre, largeur, hauteur`. Bucket public `tenues` : `<fournisseuse_id>/<tenue_id>/<uuid>.webp`.

**ensembles** — `tenue_id, accessoire_id` (même fournisseuse ; l'accessoire est de catégorie `accessoire`).

**blocages** — `id, tenue_id, periode daterange, motif (manuel|reservation), reservation_id`.
`EXCLUDE USING gist (tenue_id WITH =, periode WITH &&)` : la base elle-même interdit la double réservation. Une réservation bloque `[debut − pressing_jours, fin + pressing_jours]`.

**commandes** — le panier payé en une fois.
`id, cliente_id, statut, date_evenement, date_debut, date_fin, transfer_group ('cmd_<id>'), checkout_session_id, payment_intent_id, charge_id, setup_checkout_session_id, payment_method_id (carte de caution), montant_total_cents, frais_service_cents, deduction_essayage_cents, identite_requise, payee_at, created_at`

**reservations** — une demande par fournisseuse.
`id, commande_id, cliente_id, fournisseuse_id, statut, date_evenement, date_debut, date_fin, mode_remise, adresse_envoi, numero_suivi, message, montant_location_cents, frais_pressing_cents, frais_envoi_cents, commission_cents, deduction_essayage_cents, montant_transfert_cents, caution_cents, caution_statut, caution_payment_intent_id, caution_autorisee_at, caution_capturee_cents, expire_at, acceptee_at, payee_at, remise_at, rendue_at, litige_deadline, versement_prevu_at, transfer_id, verse_at, cloturee_at, annulee_at, annulee_par (cliente|fournisseuse|systeme|admin), motif_annulation, rembourse_cents, created_at`

**reservation_lignes** — `id, reservation_id, tenue_id, prix_location_cents, frais_pressing_cents, caution_cents, titre_snapshot`.

**reservation_historique** — `id, reservation_id, de, vers, acteur, raison, created_at` (journal des transitions).

**essayages** — `id, tenue_id, cliente_id, fournisseuse_id, type, showroom_id, creneau, statut, frais_cents, checkout_session_id, payment_intent_id, transfer_id, deduit_commande_id, message, created_at`.

**showrooms** — `id, titre, ville, lieu, adresse, debut, fin, places, actif`.
**showroom_inscriptions** — `id, showroom_id, user_id, creneau, tenue_ids uuid[], created_at` (unique `showroom_id, user_id`).

**etats_des_lieux** — `id, reservation_id, ligne_id, type, photo_face, photo_dos, photo_broderies, photo_doublure, taches, accrocs, perles_manquantes, commentaire, cree_par, valide_cliente_at, valide_fournisseuse_at, created_at` (unique `ligne_id, type`). Bucket privé `etats-des-lieux` : `<reservation_id>/<type>/<ligne_id>/<photo>.webp`.

**litiges** — `id, reservation_id, ouvert_par, motif, description, photos text[], montant_demande_cents, statut, decision, montant_capture_cents, montant_rembourse_cents, resolu_par, created_at, resolu_at`.

**avis** — `id, reservation_id, auteur_id, cible_id, sens (cliente_vers_fournisseuse|fournisseuse_vers_cliente), note 1-5, commentaire, created_at` (unique `reservation_id, auteur_id`). Un trigger recalcule `profils.note_moyenne`.

**partenaires** — `id, user_id, nom, metier, ville, bio, galerie text[], instagram, site, email_contact, valide, taux_commission, created_at`.
**leads** — `id, partenaire_id, nom, email, telephone, date_evenement, ville, message, statut, montant_commission_cents, created_at, updated_at`.

**mouvements** — journal comptable pour l'export CSV : `id, type, montant_cents, commande_id, reservation_id, essayage_id, stripe_id, libelle, created_at`.

**evenements_stripe** — `id (evt_…) PK, type, recu_at, traite_at, erreur` (idempotence des webhooks).

**limites_frequence** — `cle, fenetre, compteur` (anti-spam, nettoyé chaque jour).

### 1.3 Fonctions SQL utiles
- `est_admin()` : `security definer`, lit `profils.est_admin` pour `auth.uid()`.
- `peut_voir_mensurations(cliente uuid)` : vraie si `auth.uid()` est la cliente, une admin, ou une fournisseuse ayant une réservation non annulée de cette cliente.
- `tenue_disponible(tenue, debut, fin)` : aucune ligne de `blocages` ne chevauche `[debut − pressing, fin + pressing]`.
- `rechercher_tenues(...)` : RPC de recherche (filtres + disponibilité + tri par score de visibilité).
- `verifier_frequence(cle, max, fenetre)` : limitation de fréquence partagée par les triggers et l'API.
- `param(cle)` : lit `parametres`.

---

## 2. Policies RLS

RLS est activée sur **toutes** les tables, sans exception. Les fonctions `/api` utilisent `service_role`, qui contourne RLS. Elles vérifient elles-mêmes l'appartenance avant d'agir.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profils | tous (champs publics) | trigger uniquement | soi (colonnes autorisées par GRANT, champs sensibles protégés par trigger) ; admin | — |
| profils_prives | soi ; admin ; contrepartie d'une réservation payée (téléphone pour la remise) | trigger | soi ; admin | — |
| mensurations | `peut_voir_mensurations(user_id)` | soi | soi | soi (droit à l'effacement) |
| parametres | tous | admin | admin | admin |
| tenues | `statut = validee` ; propriétaire ; admin | fournisseuse (soi) | propriétaire (le trigger interdit de s'auto-valider) ; admin | propriétaire si aucune réservation |
| tenue_photos | si la tenue est visible | propriétaire de la tenue | propriétaire | propriétaire |
| ensembles | si la tenue est visible | propriétaire des deux tenues | — | propriétaire |
| blocages | tous (dates seulement, pour le calendrier) | propriétaire (motif manuel) | propriétaire (manuel) | propriétaire (manuel) |
| commandes | cliente ; admin | serveur | serveur | — |
| reservations | cliente ; fournisseuse ; admin | serveur | serveur | — |
| reservation_lignes | parties de la réservation ; admin | serveur | — | — |
| reservation_historique | parties ; admin | serveur | — | — |
| essayages | cliente ; fournisseuse ; admin | serveur | serveur | — |
| showrooms | tous (actifs) ; admin | admin | admin | admin |
| showroom_inscriptions | soi ; admin | serveur | — | soi |
| etats_des_lieux | parties ; admin | parties (réservation payée ou remise) | parties tant que non validé par les deux | — |
| litiges | parties ; admin | serveur | admin | — |
| avis | tous | partie d'une réservation rendue ou clôturée, une seule fois | — | admin |
| partenaires | `valide` ; propriétaire ; admin | soi | propriétaire (sans `valide`) ; admin | admin |
| leads | partenaire propriétaire ; admin | serveur | partenaire (statut `converti` uniquement) ; admin | — |
| mouvements, evenements_stripe, limites_frequence | admin | serveur | serveur | — |

Stockage :
- `tenues` (public en lecture) : écriture limitée au dossier `<auth.uid()>/…`.
- `etats-des-lieux` (privé) : lecture et écriture par les parties de la réservation (`<reservation_id>/…`) et l'admin.
- `litiges` (privé) : parties et admin.
- `partenaires` (public en lecture) : écriture limitée au dossier `<auth.uid()>/…`.
- `avatars` (public en lecture) : écriture limitée au dossier `<auth.uid()>/…`.

Les tests RLS se trouvent dans `supabase/tests/rls.test.sql`. Chaque policy est vérifiée par une assertion qui simule `auth.uid()` et le rôle `authenticated` ou `anon`.

---

## 3. Flux Stripe

Modèle : **separate charges and transfers**. La plateforme encaisse (Checkout), puis transfère à chaque fournisseuse via `transfers.create({ destination, transfer_group, source_transaction })`.

### 3.1 Montants (calculés exclusivement dans `lib/pricing.js`)
```
Pour chaque réservation (une fournisseuse) :
  location        = Σ prix_location des lignes
  pressing        = frais_pressing × nb de lignes (hors accessoires)
  envoi           = frais_envoi si mode = envoi
  commission      = round(location × commission_taux)
  deduction       = frais d'essayage déjà payés et éligibles
  transfert       = location − commission + pressing + envoi − pénalités dues − (déduction si l'essayage a déjà été reversé)
  caution         = Σ round(valeur_declaree × caution_taux)
Commande :
  frais_service   = round(Σ location × frais_service_taux)
  total Checkout  = Σ (location + pressing + envoi) + frais_service − Σ déductions
```

### 3.2 Diagramme
```
FOURNISSEUSE
 compte.html ─► POST /api/v1/connect-onboarding ─► accounts.create(express, BE) + accountLinks.create
             ◄── retour /compte.html?connect=retour ─► POST /api/v1/connect-statut (vérification immédiate)
 webhook account.updated ─► profils.stripe_onboarding_complet = details_submitted && payouts_enabled

CLIENTE
 panier.html ─► POST /api/v1/commande-creer
               (recalcul serveur, disponibilité, 1 réservation par fournisseuse, statut=demande, expire_at=+24h)
               ─► emails fournisseuses
 FOURNISSEUSE ─► POST /api/v1/reservation-repondre {accepter|refuser}
               accepter : INSERT blocages (EXCLUDE ⇒ conflit = refus propre) ─► statut=acceptee
               refuser  : statut=annulee
               ─► évaluer la commande :
                   toutes répondues & ≥1 acceptée & 0 refus ─► commande=a_payer, email « Vous pouvez payer »
                   ≥1 refus ─► email « payer le reste ou tout annuler »
 CRON expirer-demandes ─► demande & expire_at<now ─► annulee (systeme) ─► évaluer la commande

 panier.html?commande= ─► POST /api/v1/checkout-creer
   ├─ caution totale > seuil_identity && !identite_verifiee
   │     ─► {identity_requise} ─► POST /api/v1/identity-session ─► VerificationSession (document + selfie) ─► url
   │        webhook identity.verification_session.verified ─► profils.identite_verifiee = true
   │        webhook identity.verification_session.requires_input ─► email « vérification à reprendre »
   └─ checkout.sessions.create(mode=payment, payment_method_types=[card,bancontact],
        payment_intent_data.transfer_group=cmd_<id>, metadata{commande_id,type=commande})
 webhook checkout.session.completed (payment_status=paid) [ou async_payment_succeeded]
   ─► commande=payee, réservations acceptee→payee, mouvements(paiement, frais_service, commission)
   ─► caution_statut=a_enregistrer ─► email « enregistrez votre carte de caution »

 panier.html?commande=…&etape=caution ─► POST /api/v1/caution-setup
   ─► checkout.sessions.create(mode=setup, payment_method_types=[card], customer)
 webhook checkout.session.completed (mode=setup) puis setup_intent.succeeded
   ─► commandes.payment_method_id ; réservations caution_statut=carte_enregistree
   ─► si date_debut − now ≤ seuil_setup_jours (5 j) : empreinte immédiate (voir plus bas)

 CRON empreintes (toutes les heures)
   réservations payee, caution_statut=carte_enregistree, date_debut − empreinte_jours_avant ≤ aujourd'hui
   ─► paymentIntents.create({amount: caution, capture_method: manual, off_session: true, confirm: true,
        customer, payment_method, transfer_group, metadata{reservation_id,type=caution}})
 webhook payment_intent.amount_capturable_updated ─► caution_statut=autorisee
 webhook payment_intent.payment_failed (type=caution) ─► caution_statut=echec
   ─► emails cliente + fournisseuse + admin ; la cliente relance via POST /api/v1/caution-reessayer
      (Checkout mode=payment, card, capture_method=manual)

 REMISE (état des lieux, caution autorisée obligatoire) ─► POST /api/v1/edl-valider ×2 ─► statut=remise
 RETOUR (état des lieux) ─► POST /api/v1/edl-valider ×2 ─► statut=rendue,
        litige_deadline = now + 48 h, versement_prevu_at = now + 24 h
   ├─ FOURNISSEUSE ouvre un litige < 48 h ─► POST /api/v1/litige-ouvrir ─► statut=litige (empreinte conservée)
   │    ADMIN ─► POST /api/v1/admin-litige-resoudre
   │         paymentIntents.capture(amount_to_capture) puis transfers.create(capture → fournisseuse)
   │         et/ou refunds.create ; statut=cloturee
   └─ CRON liberer-cautions : litige_deadline < now && pas de litige ─► paymentIntents.cancel ─► caution=liberee
 CRON versements : versement_prevu_at < now && !transfer_id && statut∈{rendue,cloturee}
   ─► transfers.create({amount: transfert, destination, transfer_group, source_transaction: charge_id})
 CRON cloturer : rendue && caution liberee && transfert fait ─► cloturee ─► invitation aux avis croisés
 CRON renouveler-empreintes : empreinte > 6 jours et réservation encore active
   ─► nouvelle empreinte off_session puis annulation de l'ancienne (une autorisation carte expire après 7 jours)

ANNULATION (POST /api/v1/reservation-annuler)
 cliente avant paiement   ─► annulee, blocages supprimés
 cliente après paiement   ─► remboursement = pct(politique, jours avant l'événement) × (location + pressing + envoi)
                              part retenue × (1 − commission) transférée à la fournisseuse
 fournisseuse après acceptation ─► remboursement intégral à la cliente + pénalité + baisse du score de visibilité
 toute annulation ─► annulation de l'empreinte de caution si elle existe

ESSAYAGE
 POST /api/v1/essayage-creer ─► Checkout(mode=payment, frais d'essayage, metadata.type=essayage)
 webhook ─► essayage=demande ─► la fournisseuse confirme ou refuse (refus ⇒ refunds.create)
 essayage effectué chez la fournisseuse ─► transfert des frais à la fournisseuse
 réservation dans les 30 jours ─► déduction automatique dans le panier
```

### 3.3 Webhooks traités (`api/webhook.js`)
`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.succeeded`, `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`, `payment_intent.canceled`, `setup_intent.succeeded`, `account.updated`, `identity.verification_session.verified`, `identity.verification_session.requires_input`, `charge.refunded`.

- La signature est vérifiée avec `stripe.webhooks.constructEvent(rawBody, signature, secret)`. `STRIPE_WEBHOOK_SECRET` accepte plusieurs secrets séparés par des virgules (endpoint « compte » et endpoint « Connect »).
- Idempotence : `INSERT INTO evenements_stripe(id)`. Si l'événement existe déjà et a été traité, la fonction répond 200 sans rien refaire.
- Toutes les transitions passent par `lib/transitions.js`, qui vérifie que l'état d'origine est valide.

---

## 4. Tâches planifiées (vercel.json)

| Chemin | Planification | Tâche |
|---|---|---|
| `/api/cron/horaire` | `0 * * * *` | expirer-demandes, empreintes, liberer-cautions, versements, cloturer |
| `/api/cron/quotidien` | `30 6 * * *` | renouveler-empreintes, rappels (remise demain, retour demain), purge des limites de fréquence |

Chaque tâche est aussi appelable seule : `/api/cron/<tâche>`. L'en-tête `Authorization: Bearer CRON_SECRET` est obligatoire.
Sur le plan Hobby de Vercel, un cron ne peut s'exécuter qu'une fois par jour. Pour la cadence horaire, il faut le plan Pro ou un service externe (le README explique les deux options).

---

## 5. Front

| Page | Contenu |
|---|---|
| index.html | Hero en arche, collections (défilement horizontal), « Comment ça marche », simulateur, hub mariage, appel à l'action |
| catalogue.html | Filtres (catégorie, occasion, taille, mesures, couleur, budget, ville, date), grille, transition Flip |
| tenue.html?id= | Galerie et loupe, mesures, « aucune retouche autorisée », compléter le look, WhatsApp, réservation, essayage |
| boutique.html?id= | Page publique d'une negafa ou d'une créatrice |
| panier.html | Panier multi-fournisseuses, demandes, paiement, caution, identité |
| compte.html | Tableau de bord selon le rôle (cliente, fournisseuse, partenaire), états des lieux, avis |
| partenaires.html | Annuaire, profil, demande de devis, « Beauté de la mariée » |
| admin.html | Back-office |
| conditions, mentions-legales, confidentialite | Documents légaux en brouillon |

Fichiers partagés : `assets/config.js` (marque et liens), `assets/i18n.js` (dictionnaire FR/NL et bascule sans rechargement), `assets/app.js` (Supabase, session, UI, motion), `assets/admin.js`, `assets/style.css`.

---

## 6. Timeline des animations

Règles : seules `transform` et `opacity` sont animées (le `clip-path` du hero est la seule exception, limitée au masque initial). Si `prefers-reduced-motion: reduce`, les éléments apparaissent dans leur état final, sans Lenis ni épinglage. En dessous de 900 px, rien n'est épinglé et les durées sont réduites d'environ 40 %.

```
Lenis : lenis.on('scroll', ScrollTrigger.update) ; gsap.ticker.add(t => lenis.raf(t*1000)) ; lagSmoothing(0)

HERO (au chargement, t en secondes)
 0.00  le motif zellige SVG (lignes or) se dessine trait par trait : stroke-dashoffset longueur→0, 1.6 s, stagger 0.04
 0.15  le masque en arche s'ouvre : la photo passe à l'échelle 1, l'arche intérieure scaleY 0→1 depuis la base, 1.2 s, expo.out
 0.35  le titre est découpé en lignes (SplitText), chaque ligne monte de yPercent 110→0, stagger 0.08, 1.0 s
 0.80  la promesse et les appels à l'action apparaissent : opacity 0→1, y 16→0
 scroll  parallaxe légère : photo y 0→8 %, motif y 0→−6 %, scrub

COLLECTIONS (≥ 900 px)
 section épinglée, la piste horizontale se déplace en x de 0 à −(largeur − viewport), scrub 1
 cartes : légère rotation et décalage selon la vélocité (transform)
 clic sur une carte ─► Flip.getState(image) ─► sessionStorage ─► tenue.html : Flip.from(état) 0.7 s
 (< 900 px : défilement natif avec scroll-snap, sans épinglage)

COMMENT ÇA MARCHE
 deux colonnes, Clientes et Fournisseuses ; les étapes apparaissent en décalé (y 30→0, opacity), stagger 0.12
 la ligne de progression or de chaque colonne passe de scaleY 0 à 1 au scroll

SIMULATEUR
 le compteur s'anime sur un tween d'objet (texte mis à jour via onUpdate), mention « estimation »

LOUPE (fiche tenue)
 desktop : au survol, une lentille ronde suit le curseur (quickTo sur x/y, 0.25 s) avec une image à l'échelle 2.5
 mobile : appui long (350 ms), la lentille suit le doigt et le défilement est bloqué pendant l'appui

RÉVÉLATIONS GÉNÉRIQUES
 [data-reveal] : y 24→0, opacity 0→1, ScrollTrigger start « top 85 % », une seule fois
```

---

## 7. Sécurité et RGPD
- Clé `service_role` uniquement dans `/api` (`lib/supabase-admin.js`).
- Tous les montants sont recalculés côté serveur depuis la base. Le navigateur n'envoie que des identifiants et des dates.
- Anti-spam : champ honeypot `site_web` sur chaque formulaire, `verifier_frequence()` côté SQL (triggers sur les insertions) et côté API (par IP et par utilisateur).
- En-têtes de sécurité via `vercel.json` : CSP, `X-Frame-Options: DENY`, `Referrer-Policy` et `Permissions-Policy`.
- Mensurations : l'utilisatrice peut les supprimer depuis `compte.html`. La suppression du compte passe par `/api/v1/compte-supprimer`, qui anonymise l'historique comptable.
- Aucun cookie de traceur. La bannière de consentement est prête dans `app.js` (`CONSENT.enabled = false`).

## 8. Phases
1. PLAN.md
2. Fondations : migrations, auth, rôles, RLS, i18n
3. Front : landing, catalogue, fiche, boutique, motion
4. Réservation : panier, demandes, Checkout, caution, webhooks, crons
5. États des lieux, litiges, avis, hub partenaires, back-office
6. Données de démo
7. Tests du parcours complet
8. README
