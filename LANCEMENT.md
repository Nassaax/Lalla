# LALLAT : liste de lancement

## Fait
- [x] Paiement test Stripe de bout en bout (Checkout, webhooks, Connect)
- [x] Parcours simplifié : sans vérification d'identité, carte gardée pour la caution
- [x] Caution choisie par la loueuse : sans caution, pourcentage, montant fixe, carte ou espèces
- [x] Resend : compte créé (lallat.info@gmail.com), `RESEND_API_KEY` et `EMAIL_FROM` provisoire dans Vercel
- [x] `EMAIL_ADMIN` = lallat.info@gmail.com

## Domaine lallat.be (acheté chez OVHcloud le 8 octobre 2026)
- [x] Achat chez OVHcloud (6,99 € la 1re année, puis 7,89 €/an), DNSSEC retiré, boîte Zimbra Starter incluse
- [x] Vercel : domaine ajouté au compte avec zone DNS, rattaché au projet `lalla` (lallat.be ; www.lallat.be redirige en 308)
- [x] OVHcloud : serveurs DNS remplacés par ns1.vercel-dns.com et ns2.vercel-dns.com
- [x] Zone Vercel : MX OVH (mx0 1, mx1 5, mx2 50, mx3 100 .mail.ovh.net), SPF `v=spf1 include:mx.ovh.com ~all`, DMARC `p=none`
- [x] Adresse de contact du site : info@lallat.be
- [x] Serveurs DNS pris en compte (9 octobre), certificats HTTPS émis pour lallat.be et www.lallat.be
- [ ] OVHcloud Zimbra : associer lallat.be, créer la boîte **info@lallat.be** ; ajouter dans la zone Vercel les 2 CNAME propres au compte (vérification `ovh-zimbra-…` et DKIM `ovhmo-selector-1._domainkey`)
- [ ] Resend : section Domains, ajouter `lallat.be` (région Irlande), puis ajouter ses enregistrements dans la zone Vercel (DKIM `resend._domainkey`, MX et TXT sur `send`)
- [ ] Vercel : **supprimer `EMAIL_FROM`** une fois Resend vérifié (les emails partiront alors de info@lallat.be)
- [x] Vercel : `SITE_URL` = https://lallat.be
- [ ] Supabase : Authentication, URL Configuration, Site URL = https://lallat.be (+ redirections https://lallat.be/**)
- [ ] Stripe : mettre à jour l'URL des 2 webhooks vers https://lallat.be/api/webhook
- [x] App : adresse par défaut dans `app/scripts/construire.mjs` ; dossiers de démarchage régénérés avec lallat.be
- [ ] Plus tard (après mise à jour des webhooks Stripe) : rediriger lalla-pearl.vercel.app vers lallat.be
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
- [x] Domaine lallat.be : adresse par défaut changée dans `app/scripts/construire.mjs` (à republier avec les apps)
- [ ] Une fois les apps publiées : ajouter sur le site un bouton vers l'App Store et Google Play
