# LALLA

> Portez l'exceptionnel, le temps d'une fête.

LALLA est une plateforme belge de location de tenues marocaines (caftans, takchitas, tenues de mariée, tenues homme, enfant, accessoires). Elle met en relation des particulières, negafas et créatrices avec des clientes, à Bruxelles, Liège et Anvers. La plateforme vérifie les annonces, encaisse le paiement, prend sa commission et reverse le reste.

Ce guide s'adresse à une personne **non développeuse** : il explique pas à pas comment mettre le site en ligne. Comptez environ deux heures la première fois.

---

## Sommaire

1. [Comment le site fonctionne](#1-comment-le-site-fonctionne)
2. [Les comptes à créer](#2-les-comptes-à-créer)
3. [Supabase : base de données, connexion et photos](#3-supabase--base-de-données-connexion-et-photos)
4. [Stripe : paiements, Connect et Identity](#4-stripe--paiements-connect-et-identity)
5. [Resend : les emails](#5-resend--les-emails)
6. [Vercel : mettre le site en ligne](#6-vercel--mettre-le-site-en-ligne)
7. [Le webhook Stripe](#7-le-webhook-stripe)
8. [Les tâches planifiées (crons)](#8-les-tâches-planifiées-crons)
9. [Premier compte administrateur et données de démo](#9-premier-compte-administrateur-et-données-de-démo)
10. [Tester en mode test](#10-tester-en-mode-test)
11. [Passer en production](#11-passer-en-production)
12. [Au quotidien](#12-au-quotidien)
13. [Pour les développeurs](#13-pour-les-développeurs)

---

## 1. Comment le site fonctionne

| Élément | Rôle | Où ça vit |
|---|---|---|
| Les pages (HTML, CSS, JavaScript) | Ce que voient les visiteuses | GitHub, puis Vercel |
| Supabase | Comptes, base de données, photos | supabase.com |
| Stripe | Paiements (Bancontact + carte), caution, versements aux fournisseuses (Connect), vérification d'identité (Identity) | stripe.com |
| Resend | Emails automatiques (demandes, paiements, rappels…) | resend.com |
| Fonctions Vercel (`/api`) | Tout ce qui touche à l'argent ou à un secret | Vercel |
| Crons Vercel | Tâches automatiques (annulation après 24 h, cautions, versements…) | `vercel.json` |

Les montants sont **toujours recalculés sur le serveur**, jamais repris du navigateur. Toutes les tables de la base sont protégées par des règles d'accès (RLS) : chaque personne ne voit que ce qui la concerne.

Le détail technique (schéma, règles d'accès, schéma des paiements, animations) se trouve dans [PLAN.md](PLAN.md).

---

## 2. Les comptes à créer

1. **GitHub** : le code y est déjà (dépôt `Lalla`).
2. **Supabase** (gratuit pour démarrer) : https://supabase.com
3. **Stripe** (gratuit, commission par transaction) : https://stripe.com/be
4. **Resend** (gratuit jusqu'à 3 000 emails par mois) : https://resend.com
5. **Vercel** (gratuit ; le plan Pro est conseillé pour les crons horaires, voir §8) : https://vercel.com
6. **Un nom de domaine**, par exemple `lalla.be`, chez votre registraire habituel.

Gardez un fichier texte sécurisé (un gestionnaire de mots de passe, par exemple) pour y noter les clés au fur et à mesure. **Ne collez jamais une clé secrète dans le code ni dans un email.**

---

## 3. Supabase : base de données, connexion et photos

### 3.1 Créer le projet
1. Sur supabase.com, cliquez sur **New project**.
2. Nom : `lalla`. Région : **Central EU (Frankfurt)**, pour garder les données dans l'Union européenne. Choisissez un mot de passe de base de données solide et notez-le.
3. Une fois le projet prêt, ouvrez **Project Settings → API** et notez :
   - **Project URL** → ce sera `SUPABASE_URL`
   - **anon public** → ce sera `SUPABASE_ANON_KEY`
   - **service_role** → ce sera `SUPABASE_SERVICE_ROLE_KEY` (**secrète** : elle donne tous les droits)

### 3.2 Lancer les migrations (créer les tables)
Le dossier `supabase/migrations/` contient 5 fichiers à exécuter **dans l'ordre**.

**Méthode simple, sans rien installer :**
1. Dans Supabase, ouvrez **SQL Editor → New query**.
2. Ouvrez sur GitHub le fichier `supabase/migrations/20261001000001_schema.sql`, copiez tout son contenu, collez-le dans l'éditeur et cliquez sur **Run**.
3. Recommencez avec `…02_fonctions.sql`, `…03_rls.sql`, `…04_storage.sql` puis `…05_parametres.sql`.
4. Vérifiez dans **Table Editor** que les tables `profils`, `tenues`, `reservations`… existent, et dans **Storage** que les 5 espaces de stockage (`tenues`, `avatars`, `partenaires`, `etats-des-lieux`, `litiges`) sont créés.

**Méthode en ligne de commande** (si une personne technique vous aide) : `supabase link --project-ref <ref>` puis `supabase db push`.

### 3.3 Réglages de connexion
Dans **Authentication → URL Configuration** :
- **Site URL** : `https://votre-domaine.be`
- **Redirect URLs** : ajoutez `https://votre-domaine.be/**`, puis l'adresse Vercel provisoire (`https://lalla-xxx.vercel.app/**`)

Dans **Authentication → Providers → Email** : laissez **Confirm email** activé. Le site gère la connexion par mot de passe et par lien magique.

Dans **Authentication → Emails → SMTP Settings** : branchez Resend (voir §5) pour que les emails de connexion partent de votre domaine. Hôte `smtp.resend.com`, port `465`, utilisateur `resend`, mot de passe : votre clé API Resend.

---

## 4. Stripe : paiements, Connect et Identity

Restez en **mode test** (interrupteur « Test mode » en haut à droite) tant que tout n'est pas vérifié.

1. **Clé secrète** : **Developers → API keys → Secret key** (`sk_test_…`). Ce sera `STRIPE_SECRET_KEY`.
2. **Bancontact** : **Settings → Payment methods**, activez **Bancontact** (la carte est active par défaut).
3. **Connect** (versements aux fournisseuses) :
   - **Connect → Get started**, choisissez le modèle **Platform** avec des comptes **Express**.
   - Pays : Belgique. Responsabilité des pertes : la plateforme (modèle « separate charges and transfers »).
   - Dans **Connect → Settings → Branding**, ajoutez le nom LALLA, le logo et les couleurs (ivoire `#F4EEE3`, émeraude `#1F5E4B`).
4. **Identity** (vérification d'identité au-delà du seuil de caution) : **Identity → Get started**. Activez-le en mode test, puis en production (Stripe demande une courte validation).
5. Le **webhook** se configure après la mise en ligne : voir §7.

---

## 5. Resend : les emails

1. Sur resend.com, ouvrez **Domains → Add domain** et saisissez `lalla.be` (votre domaine).
2. Ajoutez chez votre registraire les enregistrements DNS que Resend affiche (SPF, DKIM), puis attendez la validation (de quelques minutes à quelques heures).
3. Ouvrez **API Keys → Create API key** (permission « Sending access »). Ce sera `RESEND_API_KEY`.
4. L'adresse d'envoi par défaut est `bonjour@<domaine>` (définie dans `assets/config.js`). Pour en utiliser une autre, ajoutez la variable facultative `EMAIL_FROM`, par exemple `LALLA <bonjour@lalla.be>`.

---

## 6. Vercel : mettre le site en ligne

1. Sur vercel.com, cliquez sur **Add New → Project** et importez le dépôt GitHub `Lalla`.
2. Framework : **Other**. Laissez *Build Command* et *Output Directory* **vides**. Il n'y a rien à compiler.
3. Ouvrez **Environment Variables** et ajoutez les 9 variables suivantes (pour *Production* et *Preview*) :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | Project URL Supabase |
| `SUPABASE_ANON_KEY` | clé anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role (secrète) |
| `STRIPE_SECRET_KEY` | `sk_test_…` (puis `sk_live_…` en production) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (voir §7 ; vous pouvez en mettre deux, séparés par une virgule) |
| `RESEND_API_KEY` | clé Resend |
| `EMAIL_ADMIN` | l'adresse qui reçoit les alertes (litiges, cautions refusées) |
| `SITE_URL` | `https://votre-domaine.be` (sans barre finale) |
| `CRON_SECRET` | une longue chaîne aléatoire, par exemple générée par un gestionnaire de mots de passe (32 caractères ou plus) |

4. Cliquez sur **Deploy**. Une adresse `https://lalla-xxx.vercel.app` apparaît.
5. **Domaine** : **Settings → Domains → Add**, puis suivez les instructions DNS. Mettez ensuite `SITE_URL` à jour et redéployez (**Deployments → … → Redeploy**).

Les clés publiques (URL et clé anon Supabase) sont transmises au navigateur par `/api/config`. Aucune clé n'est écrite dans le code.

---

## 7. Le webhook Stripe

Le webhook informe le site qu'un paiement, une carte, une caution, une vérification d'identité ou un compte fournisseuse a changé d'état. **Tous les statuts de réservation en dépendent.**

Créez **deux** points de terminaison dans **Developers → Webhooks → Add endpoint**, tous les deux avec l'URL `https://votre-domaine.be/api/webhook` :

**A. « Your account »** (événements du compte de la plateforme), à cocher :
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.succeeded`
- `payment_intent.amount_capturable_updated`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `setup_intent.succeeded`
- `identity.verification_session.verified`
- `identity.verification_session.requires_input`
- `charge.refunded`

**B. « Connected accounts »** (événements des comptes des fournisseuses) :
- `account.updated`

Chaque point de terminaison a son **Signing secret** (`whsec_…`). Mettez les deux dans `STRIPE_WEBHOOK_SECRET`, séparés par une virgule : `whsec_AAA,whsec_BBB`. Redéployez.

Pour vérifier : dans Stripe, ouvrez le point de terminaison et cliquez sur **Send test event**. La réponse doit être `200` (ou `400 signature_invalide` pour un événement de test non signé, ce qui prouve que la vérification fonctionne).

---

## 8. Les tâches planifiées (crons)

Elles sont déclarées dans `vercel.json` et créées automatiquement par Vercel :

| Adresse | Fréquence | Ce qu'elle fait |
|---|---|---|
| `/api/cron/horaire` | toutes les heures (via GitHub Actions) + une fois par jour à 5 h (UTC) par Vercel | annule les demandes sans réponse après 24 h ; crée les empreintes de caution 2 jours avant la remise ; libère les cautions 48 h après le retour sans litige ; verse les fournisseuses 24 h après le retour ; clôture les locations et invite aux avis |
| `/api/cron/quotidien` | chaque jour à 6 h 30 (UTC) | renouvelle les empreintes de plus de 6 jours (une autorisation bancaire expire au bout de 7 jours) ; envoie les rappels de remise et de retour ; nettoie l'anti-spam |

Vercel envoie automatiquement l'en-tête `Authorization: Bearer <CRON_SECRET>`. Sans ce secret, les adresses répondent `401`.

> **Plan Hobby (gratuit)** : Vercel n'autorise qu'un passage par jour. Le passage horaire est donc assuré par **GitHub Actions** (gratuit), via `.github/workflows/cron-horaire.yml`. À régler une seule fois dans GitHub → *Settings* → *Secrets and variables* → *Actions* :
> - onglet **Secrets** : `CRON_SECRET` = la même valeur que sur Vercel ;
> - onglet **Variables** : `SITE_URL` = l'adresse du site (ex. `https://lalla-pearl.vercel.app`, sans « / » final).
>
> Tant que ces deux réglages manquent, le workflow ne fait rien. Avec le **plan Pro** de Vercel, vous pouvez remettre `"0 * * * *"` pour `/api/cron/horaire` dans `vercel.json` et supprimer le workflow.

Vous pouvez aussi lancer une seule tâche à la main : `/api/cron/expirer-demandes`, `/empreintes`, `/liberer-cautions`, `/versements`, `/cloturer`, `/renouveler-empreintes`, `/rappels`, `/purger`.

---

## 9. Premier compte administrateur et données de démo

### Devenir administratrice
1. Créez votre compte sur le site (bouton **Connexion → Créer mon compte**).
2. Dans Supabase, **SQL Editor**, exécutez en remplaçant l'email :
   ```sql
   update profils set est_admin = true, compte_valide = true
   where id = (select id from auth.users where email = 'vous@exemple.be');
   ```
3. Rechargez le site : le lien **Back-office** apparaît dans le menu.

### Données de démonstration (mode test uniquement)
Le script crée 3 negafas, 5 particulières, 2 créatrices, 40 tenues (avec illustrations originales en guise de photos), 4 clientes, 3 partenaires, 1 admin et 2 showrooms. Il refuse de tourner avec une clé Stripe `sk_live`.

```bash
npm install
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed
# avec de vrais comptes Connect de test : ajoutez STRIPE_SECRET_KEY=sk_test_… SEED_STRIPE=1
```
Tous les comptes de démo utilisent le mot de passe `Demo-Lalla-2026`, par exemple `cliente1@demo.lalla.be`, `negafa1@demo.lalla.be` ou `admin@demo.lalla.be`. **Supprimez-les avant l'ouverture au public.**

---

## 10. Tester en mode test

Cartes de test Stripe (date d'expiration future et CVC quelconques) :

| Carte | Effet |
|---|---|
| `4242 4242 4242 4242` | paiement accepté |
| `4000 0025 0000 3155` | demande une authentification 3-D Secure |
| `4000 0000 0000 0341` | s'enregistre, puis **refuse l'empreinte de caution** (teste les alertes) |
| Bancontact | choisissez « Authorize test payment » sur la page de test |

Parcours conseillé : inscription d'une fournisseuse, configuration des versements (Connect de test), publication d'une annonce avec 4 photos, validation dans le back-office, essayage, panier avec deux fournisseuses, acceptation, vérification d'identité (caution > 500 €), paiement, carte de caution, état des lieux de remise sur téléphone, état des lieux de retour, versement, avis. Puis refaites un cas de **litige**.

Pour tester plus vite les étapes liées au temps (empreinte J−2, libération après 48 h, versement après 24 h), appelez les crons à la main (§8).

---

## 11. Passer en production

Avant d'ouvrir le site :

- [ ] Faire relire et compléter par un avocat les pages **Mentions légales**, **Conditions générales** et **Confidentialité** (tout ce qui est entre crochets : BCE, TVA, siège, médiation…). La version néerlandaise des textes légaux reste à fournir après validation.
- [ ] Stripe : quitter le mode test, activer le compte (informations de l'entreprise), puis réactiver **Connect** et **Identity** en mode live.
- [ ] Recréer les **deux webhooks** en mode live et mettre à jour `STRIPE_WEBHOOK_SECRET`.
- [ ] Remplacer `STRIPE_SECRET_KEY` par la clé `sk_live_…`.
- [ ] Vérifier `SITE_URL`, le domaine et les URL de redirection Supabase.
- [ ] Supprimer les comptes et tenues de démo.
- [ ] Ajuster les **paramètres** dans le back-office : commission, frais de pressing et d'essayage, seuil Identity, politique d'annulation.
- [ ] Activer les **sauvegardes** Supabase (plan Pro) et la double authentification sur tous les comptes (GitHub, Vercel, Supabase, Stripe, Resend).
- [ ] Faire une vraie location à petit prix entre deux personnes de confiance.

---

## 12. Au quotidien

- **Back-office** (`/admin.html`) : indicateurs, annonces à valider, comptes, réservations, litiges (photos de remise et de retour côte à côte, retenue partielle sur la caution, remboursement), paramètres, showrooms, leads du hub mariage, export CSV mensuel pour la comptabilité.
- **Changer le nom de la marque** : modifiez `brand.name` (et `brand.domaine`) dans `assets/config.js`, puis lancez `node scripts/rebrand.mjs` pour mettre à jour les titres et balises de partage des pages.
- **Lien « Beauté de la mariée »** : `liens.beauteMariee` dans `assets/config.js`.
- **Bannière cookies** : prête mais désactivée (`consentement.actif` dans `assets/config.js`). À n'activer que si vous ajoutez un outil de mesure d'audience.
- **Partage d'une tenue** : le bouton WhatsApp partage `https://votre-domaine.be/t/<id>`, une page qui fournit l'aperçu (titre, prix, photo) aux réseaux sociaux.

---

## 13. Pour les développeurs

### Structure
```
index.html, catalogue.html, tenue.html, boutique.html, panier.html, compte.html,
partenaires.html, admin.html, conditions.html, mentions-legales.html, confidentialite.html
assets/
  config.js     marque, liens, listes (partagé navigateur + serveur)
  i18n.js       dictionnaire FR/NL et bascule sans rechargement
  app.js        socle : Supabase, session, UI, panier, placeholders, motion (GSAP + Lenis)
  pages.js      pages publiques, panier, hub
  compte.js     espace personnel
  admin.js      back-office
  style.css     design system
api/            fonctions Vercel : config, v1/[action] (routeur), webhook, cron, share, sitemap
lib/            logique serveur : tarification, machine à états, Stripe, emails, crons…
supabase/       migrations SQL + tests RLS
scripts/        seed de démo, pile locale, serveur de dev, rebrand
tests/          unitaires (tarification) et de bout en bout (Playwright)
```
Pas de framework, pas de build. Les CDN utilisés sont GSAP 3.13 (ScrollTrigger, SplitText, Flip), Lenis 1.3.4, supabase-js 2 et browser-image-compression 2.0.2.

### Tests
```bash
npm install
npm test                 # tests unitaires de tarification
npm run test:rls         # tests RLS (Postgres local requis)
node tests/e2e/parcours.mjs   # parcours complet + litige
node tests/e2e/rendu.mjs      # toutes les pages à 375 / 768 / 1440 px, zéro erreur console
node scripts/cles-i18n.mjs    # aucune clé de traduction manquante
```
Les tests de bout en bout démarrent une pile Supabase locale (Postgres 16, binaires officiels GoTrue et PostgREST, voir `scripts/stack-local.mjs`) et un **simulateur de l'API Stripe** (`tests/e2e/stripe-mock.mjs`). Ce simulateur produit des webhooks signés avec la méthode officielle de `stripe-node`. Avant la production, refaites le parcours du §10 sur un déploiement de préproduction, avec les vraies clés Stripe de test.

### Développement local
```bash
node scripts/stack-local.mjs      # dans un terminal : Postgres + GoTrue + PostgREST
SUPABASE_URL=http://localhost:8787 SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=whsec_… RESEND_API_KEY=x EMAIL_MODE=journal \
EMAIL_ADMIN=vous@exemple.be SITE_URL=http://localhost:8787 CRON_SECRET=local npm run dev
```
`EMAIL_MODE=journal` affiche les emails dans le terminal au lieu de les envoyer.
