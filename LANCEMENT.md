# LALLAT : liste de lancement

## Fait
- [x] Paiement test Stripe de bout en bout (Checkout, webhooks, Connect)
- [x] Parcours simplifié : sans vérification d'identité, carte gardée pour la caution
- [x] Caution choisie par la loueuse : sans caution, pourcentage, montant fixe, carte ou espèces
- [x] Resend : compte créé (lallat.info@gmail.com), `RESEND_API_KEY` et `EMAIL_FROM` provisoire dans Vercel
- [x] `EMAIL_ADMIN` = lallat.info@gmail.com

## À faire quand le domaine lallat.be est acheté
- [ ] Vercel : ajouter le domaine au projet `lalla` (lallat.be et www.lallat.be)
- [ ] Resend : section Domains, ajouter `lallat.be` (région Irlande), puis ajouter les enregistrements DNS (DKIM, SPF, DMARC)
- [ ] Vercel : **supprimer `EMAIL_FROM`** (les emails partiront alors de bonjour@lallat.be)
- [ ] Vercel : `SITE_URL` = https://lallat.be
- [ ] Supabase : Authentication, URL Configuration, Site URL = https://lallat.be (+ redirections)
- [ ] Stripe : mettre à jour l'URL des 2 webhooks vers https://lallat.be/api/webhook
- [ ] Redéployer, puis vérifier un email reçu par une adresse quelconque

## Avant l'ouverture des réservations
- [ ] Inscription indépendant complémentaire (numéro BCE, caisse d'assurances sociales, TVA)
- [ ] Stripe en mode réel : activation du compte, nouvelles clés, 2 webhooks, option Accounts v1
- [ ] Conditions générales relues par un avocat (caution en espèces, DAC7, annulations) + assurance RC pro
- [ ] 10 à 20 loueuses inscrites avec annonces validées
- [ ] Une location réelle à petit prix, puis « Ouvrir les réservations » dans l'admin

## Application iPhone / iPad / Android
- [x] Projet Capacitor (`app/`), icône, écran de démarrage ; interface embarquée copiée du site (site inchangé)
- [x] Fabrication automatique sur GitHub : « App iOS » et « App Android » (Actions → Run workflow)
- [ ] Compte Apple Developer (particulier, 99 $/an) puis secrets GitHub : APPLE_TEAM_ID,
      APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_KEY_P8
- [ ] App Store Connect : créer l'app « LALLAT » (identifiant be.lallat.app), fiche, captures, confidentialité
- [ ] Compte Google Play Console (25 $ une fois) puis secrets GitHub : ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD
- [ ] Notifications push (Firebase + clé APNs) : à brancher quand les comptes existent
- [ ] Domaine lallat.be : changer l'adresse par défaut dans `app/scripts/construire.mjs` et republier les apps
- [ ] Une fois les apps publiées : ajouter sur le site un bouton vers l'App Store et Google Play
