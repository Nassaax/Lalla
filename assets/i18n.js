/*
 * Dictionnaire FR / NL et bascule de langue sans rechargement.
 * Usage HTML :
 *   <span data-i18n="cle"></span>                 → textContent
 *   <p data-i18n-html="cle"></p>                  → innerHTML (textes du dictionnaire uniquement)
 *   <input data-i18n-attr="placeholder:cle;aria-label:cle2">
 * Usage JS : I18N.t('cle', { variable: 'x' }) ; écoute de l'événement « lalla:langue ».
 * {brand} est remplacé automatiquement par le nom défini dans assets/config.js.
 */
(function () {
  'use strict';

  var D = { fr: {}, nl: {} };

  function ajouter(langue, entrees) {
    for (var k in entrees) if (Object.prototype.hasOwnProperty.call(entrees, k)) D[langue][k] = entrees[k];
  }

  // ---------------------------------------------------------------------------
  // Commun
  // ---------------------------------------------------------------------------
  ajouter('fr', {
    'promesse': 'Portez l\'exceptionnel, le temps d\'une fête.',
    'nav.catalogue': 'Catalogue',
    'nav.collections': 'Collections',
    'nav.comment': 'Comment ça marche',
    'nav.proposer': 'Proposer une tenue',
    'nav.partenaires': 'Hub mariage',
    'nav.compte': 'Mon espace',
    'nav.connexion': 'Connexion',
    'nav.panier': 'Panier',
    'nav.menu': 'Menu',
    'nav.fermer': 'Fermer',
    'nav.admin': 'Back-office',
    'nav.deconnexion': 'Se déconnecter',
    'nav.aller_contenu': 'Aller au contenu',
    'langue.fr': 'Français',
    'langue.nl': 'Nederlands',
    'langue.changer': 'Changer de langue',
    'footer.texte': 'Location de tenues marocaines entre particulières, negafas et créatrices, à Bruxelles, Liège et Anvers.',
    'footer.plateforme': 'Plateforme',
    'footer.aide': 'Informations',
    'footer.conditions': 'Conditions générales',
    'footer.mentions': 'Mentions légales',
    'footer.confidentialite': 'Confidentialité',
    'footer.contact': 'Contact',
    'footer.droits': '© {annee} {brand}. Tous droits réservés.',
    'footer.villes': 'Bruxelles · Liège · Anvers',
    'commun.chargement': 'Chargement…',
    'commun.erreur': 'Une erreur est survenue. Réessayez dans un instant.',
    'commun.reessayer': 'Réessayer',
    'commun.annuler': 'Annuler',
    'commun.confirmer': 'Confirmer',
    'commun.enregistrer': 'Enregistrer',
    'commun.enregistre': 'Enregistré',
    'commun.envoyer': 'Envoyer',
    'commun.fermer': 'Fermer',
    'commun.retour': 'Retour',
    'commun.suivant': 'Suivant',
    'commun.precedent': 'Précédent',
    'commun.voir': 'Voir',
    'commun.modifier': 'Modifier',
    'commun.supprimer': 'Supprimer',
    'commun.oui': 'Oui',
    'commun.non': 'Non',
    'commun.par_jour': '/ location',
    'commun.a_partir': 'à partir de',
    'commun.estimation': 'Estimation indicative',
    'commun.aucun_resultat': 'Aucun résultat pour ces critères.',
    'commun.connexion_requise': 'Connectez-vous pour continuer.',
    'commun.trop_requetes': 'Trop de tentatives. Patientez quelques minutes.',
    'commun.copie': 'Lien copié',
    'commun.facultatif': 'facultatif',
    'commun.cm': 'cm',
    'commun.jours': '{n} jours',
    'commun.jour': '{n} jour',
    'commun.du_au': 'du {debut} au {fin}',
    'commun.voir_tout': 'Voir tout',
    'commun.photo_placeholder': 'Photo à venir',
    // Authentification
    'auth.titre_connexion': 'Bon retour parmi nous',
    'auth.titre_inscription': 'Créer un compte',
    'auth.email': 'Adresse email',
    'auth.mot_de_passe': 'Mot de passe',
    'auth.prenom': 'Prénom',
    'auth.nom': 'Nom',
    'auth.se_connecter': 'Se connecter',
    'auth.creer': 'Créer mon compte',
    'auth.lien_magique': 'Recevoir un lien de connexion',
    'auth.lien_envoye': 'Un lien de connexion vient de vous être envoyé. Ouvrez-le depuis ce téléphone ou cet ordinateur.',
    'auth.ou': 'ou',
    'auth.pas_de_compte': 'Pas encore de compte ?',
    'auth.deja_compte': 'Déjà un compte ?',
    'auth.je_suis': 'Je souhaite',
    'auth.role_cliente': 'Louer des tenues',
    'auth.role_fournisseuse': 'Proposer mes tenues',
    'auth.role_partenaire': 'Référencer mon activité (hub mariage)',
    'auth.type': 'Vous êtes',
    'auth.cgu': 'J\'accepte les <a href="conditions.html" target="_blank">conditions générales</a> et la <a href="confidentialite.html" target="_blank">politique de confidentialité</a>.',
    'auth.mdp_regle': '8 caractères minimum',
    'auth.verifier_email': 'Vérifiez votre boîte mail pour confirmer votre adresse.',
    'auth.erreur_identifiants': 'Email ou mot de passe incorrect.',
    'auth.erreur_cgu': 'Merci d\'accepter les conditions pour continuer.',
    'auth.bienvenue': 'Bienvenue, {prenom}',
    // Types et rôles
    'role.cliente': 'Cliente',
    'role.fournisseuse': 'Fournisseuse',
    'role.partenaire': 'Partenaire',
    'role.admin': 'Admin',
    'type.particuliere': 'Particulière',
    'type.negafa': 'Negafa',
    'type.creatrice': 'Créatrice',
    // Catégories
    'cat.caftan': 'Caftan',
    'cat.takchita': 'Takchita',
    'cat.mariee': 'Tenue de mariée',
    'cat.homme': 'Tenue homme',
    'cat.enfant': 'Enfant',
    'cat.accessoire': 'Accessoire',
    'cat.tous': 'Toutes les catégories',
    'scat.mdamma': 'Mdamma (ceinture)',
    'scat.bijoux': 'Bijoux',
    'scat.couronne': 'Couronne',
    // Occasions
    'occ.mariage': 'Mariage',
    'occ.fiancailles': 'Fiançailles',
    'occ.henne': 'Henné',
    'occ.aid': 'Aïd',
    'occ.soiree': 'Soirée',
    'occ.bapteme': 'Baptême',
    'occ.toutes': 'Toutes les occasions',
    // Couleurs
    'coul.ivoire': 'Ivoire', 'coul.or': 'Or', 'coul.emeraude': 'Émeraude', 'coul.noir': 'Noir', 'coul.bordeaux': 'Bordeaux',
    'coul.rose': 'Rose poudré', 'coul.bleu_nuit': 'Bleu nuit', 'coul.blanc': 'Blanc', 'coul.vert_sauge': 'Vert sauge',
    'coul.argent': 'Argent', 'coul.fuchsia': 'Fuchsia', 'coul.moutarde': 'Moutarde', 'coul.turquoise': 'Turquoise',
    'coul.lilas': 'Lilas', 'coul.terracotta': 'Terracotta',
    // Mesures
    'mes.poitrine': 'Tour de poitrine',
    'mes.taille': 'Tour de taille',
    'mes.hanches': 'Tour de hanches',
    'mes.longueur': 'Longueur totale',
    'mes.manche': 'Longueur de manche',
    'mes.hauteur': 'Votre taille (hauteur)',
    'mes.taille_indicative': 'Taille indicative',
    // Statuts
    'statut.demande': 'Demande envoyée',
    'statut.acceptee': 'Acceptée — à payer',
    'statut.payee': 'Payée',
    'statut.remise': 'Remise',
    'statut.rendue': 'Rendue',
    'statut.cloturee': 'Clôturée',
    'statut.annulee': 'Annulée',
    'statut.litige': 'Litige en cours',
    'annonce.brouillon': 'Brouillon',
    'annonce.en_attente': 'En relecture',
    'annonce.validee': 'En ligne',
    'annonce.refusee': 'À modifier',
    'annonce.archivee': 'Archivée',
    'caution.aucune': 'Aucune',
    'caution.a_enregistrer': 'Carte à enregistrer',
    'caution.carte_enregistree': 'Carte enregistrée',
    'caution.autorisee': 'Empreinte autorisée',
    'caution.echec': 'Échec — à régulariser',
    'caution.liberee': 'Libérée',
    'caution.capturee': 'Retenue (litige)',
    // Consentement
    'consent.texte': 'Nous n\'utilisons aucun cookie de suivi sans votre accord.',
    'consent.accepter': 'Accepter',
    'consent.refuser': 'Refuser'
  });

  ajouter('nl', {
    'promesse': 'Draag het uitzonderlijke, de tijd van een feest.',
    'nav.catalogue': 'Catalogus',
    'nav.collections': 'Collecties',
    'nav.comment': 'Hoe werkt het',
    'nav.proposer': 'Kledij aanbieden',
    'nav.partenaires': 'Huwelijkshub',
    'nav.compte': 'Mijn ruimte',
    'nav.connexion': 'Inloggen',
    'nav.panier': 'Winkelmand',
    'nav.menu': 'Menu',
    'nav.fermer': 'Sluiten',
    'nav.admin': 'Back-office',
    'nav.deconnexion': 'Uitloggen',
    'nav.aller_contenu': 'Naar de inhoud',
    'langue.fr': 'Français',
    'langue.nl': 'Nederlands',
    'langue.changer': 'Taal wijzigen',
    'footer.texte': 'Verhuur van Marokkaanse kledij tussen particulieren, negafa\'s en ontwerpsters, in Brussel, Luik en Antwerpen.',
    'footer.plateforme': 'Platform',
    'footer.aide': 'Informatie',
    'footer.conditions': 'Algemene voorwaarden',
    'footer.mentions': 'Wettelijke vermeldingen',
    'footer.confidentialite': 'Privacy',
    'footer.contact': 'Contact',
    'footer.droits': '© {annee} {brand}. Alle rechten voorbehouden.',
    'footer.villes': 'Brussel · Luik · Antwerpen',
    'commun.chargement': 'Laden…',
    'commun.erreur': 'Er ging iets mis. Probeer het zo meteen opnieuw.',
    'commun.reessayer': 'Opnieuw proberen',
    'commun.annuler': 'Annuleren',
    'commun.confirmer': 'Bevestigen',
    'commun.enregistrer': 'Opslaan',
    'commun.enregistre': 'Opgeslagen',
    'commun.envoyer': 'Verzenden',
    'commun.fermer': 'Sluiten',
    'commun.retour': 'Terug',
    'commun.suivant': 'Volgende',
    'commun.precedent': 'Vorige',
    'commun.voir': 'Bekijken',
    'commun.modifier': 'Wijzigen',
    'commun.supprimer': 'Verwijderen',
    'commun.oui': 'Ja',
    'commun.non': 'Nee',
    'commun.par_jour': '/ huur',
    'commun.a_partir': 'vanaf',
    'commun.estimation': 'Indicatieve schatting',
    'commun.aucun_resultat': 'Geen resultaten voor deze criteria.',
    'commun.connexion_requise': 'Log in om verder te gaan.',
    'commun.trop_requetes': 'Te veel pogingen. Wacht enkele minuten.',
    'commun.copie': 'Link gekopieerd',
    'commun.facultatif': 'optioneel',
    'commun.cm': 'cm',
    'commun.jours': '{n} dagen',
    'commun.jour': '{n} dag',
    'commun.du_au': 'van {debut} tot {fin}',
    'commun.voir_tout': 'Alles bekijken',
    'commun.photo_placeholder': 'Foto volgt',
    'auth.titre_connexion': 'Welkom terug',
    'auth.titre_inscription': 'Account aanmaken',
    'auth.email': 'E-mailadres',
    'auth.mot_de_passe': 'Wachtwoord',
    'auth.prenom': 'Voornaam',
    'auth.nom': 'Naam',
    'auth.se_connecter': 'Inloggen',
    'auth.creer': 'Mijn account aanmaken',
    'auth.lien_magique': 'Een inloglink ontvangen',
    'auth.lien_envoye': 'We stuurden u een inloglink. Open hem op dit toestel.',
    'auth.ou': 'of',
    'auth.pas_de_compte': 'Nog geen account?',
    'auth.deja_compte': 'Al een account?',
    'auth.je_suis': 'Ik wil',
    'auth.role_cliente': 'Kledij huren',
    'auth.role_fournisseuse': 'Mijn kledij aanbieden',
    'auth.role_partenaire': 'Mijn zaak vermelden (huwelijkshub)',
    'auth.type': 'U bent',
    'auth.cgu': 'Ik aanvaard de <a href="conditions.html" target="_blank">algemene voorwaarden</a> en het <a href="confidentialite.html" target="_blank">privacybeleid</a>.',
    'auth.mdp_regle': 'Minstens 8 tekens',
    'auth.verifier_email': 'Kijk in uw mailbox om uw adres te bevestigen.',
    'auth.erreur_identifiants': 'E-mail of wachtwoord onjuist.',
    'auth.erreur_cgu': 'Aanvaard de voorwaarden om verder te gaan.',
    'auth.bienvenue': 'Welkom, {prenom}',
    'role.cliente': 'Klant',
    'role.fournisseuse': 'Aanbieder',
    'role.partenaire': 'Partner',
    'role.admin': 'Admin',
    'type.particuliere': 'Particulier',
    'type.negafa': 'Negafa',
    'type.creatrice': 'Ontwerpster',
    'cat.caftan': 'Kaftan',
    'cat.takchita': 'Takchita',
    'cat.mariee': 'Bruidskledij',
    'cat.homme': 'Herenkledij',
    'cat.enfant': 'Kinderen',
    'cat.accessoire': 'Accessoire',
    'cat.tous': 'Alle categorieën',
    'scat.mdamma': 'Mdamma (riem)',
    'scat.bijoux': 'Juwelen',
    'scat.couronne': 'Kroon',
    'occ.mariage': 'Huwelijk',
    'occ.fiancailles': 'Verloving',
    'occ.henne': 'Henna',
    'occ.aid': 'Eid',
    'occ.soiree': 'Avondfeest',
    'occ.bapteme': 'Naamfeest',
    'occ.toutes': 'Alle gelegenheden',
    'coul.ivoire': 'Ivoor', 'coul.or': 'Goud', 'coul.emeraude': 'Smaragd', 'coul.noir': 'Zwart', 'coul.bordeaux': 'Bordeaux',
    'coul.rose': 'Poederroze', 'coul.bleu_nuit': 'Nachtblauw', 'coul.blanc': 'Wit', 'coul.vert_sauge': 'Saliegroen',
    'coul.argent': 'Zilver', 'coul.fuchsia': 'Fuchsia', 'coul.moutarde': 'Mosterd', 'coul.turquoise': 'Turkoois',
    'coul.lilas': 'Lila', 'coul.terracotta': 'Terracotta',
    'mes.poitrine': 'Borstomtrek',
    'mes.taille': 'Taille-omtrek',
    'mes.hanches': 'Heupomtrek',
    'mes.longueur': 'Totale lengte',
    'mes.manche': 'Mouwlengte',
    'mes.hauteur': 'Uw lengte',
    'mes.taille_indicative': 'Indicatieve maat',
    'statut.demande': 'Aanvraag verzonden',
    'statut.acceptee': 'Aanvaard — te betalen',
    'statut.payee': 'Betaald',
    'statut.remise': 'Overhandigd',
    'statut.rendue': 'Teruggebracht',
    'statut.cloturee': 'Afgesloten',
    'statut.annulee': 'Geannuleerd',
    'statut.litige': 'Geschil lopende',
    'annonce.brouillon': 'Concept',
    'annonce.en_attente': 'In nazicht',
    'annonce.validee': 'Online',
    'annonce.refusee': 'Aan te passen',
    'annonce.archivee': 'Gearchiveerd',
    'caution.aucune': 'Geen',
    'caution.a_enregistrer': 'Kaart te registreren',
    'caution.carte_enregistree': 'Kaart geregistreerd',
    'caution.autorisee': 'Autorisatie actief',
    'caution.echec': 'Mislukt — te regelen',
    'caution.liberee': 'Vrijgegeven',
    'caution.capturee': 'Ingehouden (geschil)',
    'consent.texte': 'We gebruiken geen volgcookies zonder uw toestemming.',
    'consent.accepter': 'Aanvaarden',
    'consent.refuser': 'Weigeren'
  });

  // ---------------------------------------------------------------------------
  // Pages publiques (le FR des textes statiques est lu dans le HTML)
  // ---------------------------------------------------------------------------
  ajouter('fr', {
    'cat.du': 'Du', 'cat.au': 'Au',
    'cat.f_categorie': 'Catégorie', 'cat.f_occasion': 'Occasion', 'cat.f_date': 'Disponible pour vos dates', 'cat.f_ville': 'Ville',
    'cat.f_mesures': 'Vos mesures', 'cat.f_couleur': 'Couleur', 'cat.f_budget': 'Budget', 'cat.f_vendeuse': 'Proposée par',
    'cat.budget_max': 'Prix maximum (€)', 'cat.recherche': 'Rechercher', 'cat.recherche_ph': 'Velours, brodé main, sfifa…',
    'cat.toutes': 'Toutes', 'cat.toutes_tailles': 'Toutes', 'cat.toutes_villes': 'Toutes', 'cat.enfant': 'Enfant',
    'cat.mesures_aide': 'Nous affichons les pièces dont les mesures conviennent, sans retouche (aisance de 0 à 8 cm).',
    'cat.mes_mesures': 'Utiliser mes mensurations enregistrées',
    'cat.mesures_absentes': 'Enregistrez d\'abord vos mensurations dans votre espace.',
    'cat.mesures_appliquees': 'Vos mensurations sont appliquées.',
    'cat.reinitialiser': 'Réinitialiser',
    'cat.resultat': '{n} pièce', 'cat.resultats': '{n} pièces',
    'index.sel.vide': 'Les premières pièces arrivent très bientôt.',
    'index.simu.note': 'Estimation : prix × locations × (1 − commission de {pct} %). Hors frais de pressing, reversés en plus.',
    'tenue.introuvable': 'Cette tenue n\'est pas (ou plus) disponible.',
    'tenue.fil': 'Fil d\'Ariane',
    'tenue.photos': 'Photos de la tenue',
    'tenue.photo_face': 'vue de face', 'tenue.photo_dos': 'vue de dos', 'tenue.photo_broderie': 'détail de la broderie',
    'tenue.photo_portee': 'tenue portée', 'tenue.photo_autre': 'autre vue',
    'tenue.loupe_aide': 'Survolez ou appuyez longuement pour observer les broderies.',
    'tenue.par_location': 'la location, de {min} à {max} jours',
    'tenue.main_propre': 'Remise en main propre',
    'tenue.envoi': 'Envoi assuré (+{prix})',
    'tenue.essayage_possible': 'Essayage possible',
    'tenue.couleurs': 'Couleurs',
    'tenue.mesures': 'Mesures de la tenue',
    'tenue.retouche_titre': 'Aucune retouche autorisée.',
    'tenue.retouche_texte': 'Comparez ces mesures aux vôtres : la tenue doit être rendue dans son état d\'origine.',
    'tenue.reserver_titre': 'Réserver',
    'tenue.reserver': 'Réserver',
    'tenue.date_evenement': 'Date de l\'événement',
    'tenue.date_debut': 'Récupération',
    'tenue.date_fin': 'Retour',
    'tenue.mode_remise': 'Mode de remise',
    'tenue.choisir_dates': 'Choisissez vos dates pour vérifier la disponibilité.',
    'tenue.verification': 'Vérification…',
    'tenue.disponible': 'Disponible à ces dates',
    'tenue.indisponible': 'Indisponible à ces dates (pressing compris). Essayez d\'autres dates.',
    'tenue.dates_incoherentes': 'L\'événement doit se situer entre la récupération et le retour.',
    'tenue.duree_hors': 'Durée de location : de {min} à {max} jours.',
    'tenue.r_location': 'Location', 'tenue.r_pressing': 'Pressing', 'tenue.r_envoi': 'Envoi assuré', 'tenue.r_service': 'Frais de service',
    'tenue.r_total': 'Total estimé', 'tenue.r_caution': 'Caution (empreinte, non débitée)',
    'tenue.r_note': 'Vous ne payez qu\'après l\'acceptation de la fournisseuse.',
    'tenue.ajouter_panier': 'Envoyer une demande',
    'tenue.deja_panier': 'Dans le panier',
    'tenue.ajoute': 'Ajoutée au panier',
    'tenue.dates_panier_maj': 'Les dates de votre panier ont été mises à jour.',
    'tenue.essayer': 'Demander un essayage ({prix})',
    'tenue.showroom_lien': 'Ou essayer lors d\'un showroom',
    'tenue.whatsapp': 'Partager sur WhatsApp',
    'tenue.partage_texte': 'Regarde cette tenue : {titre}',
    'tenue.seo_titre': '{titre} — location {categorie} {ville} | {brand}',
    'tenue.seo_desc': 'Louez {titre} à {ville} : mesures détaillées, photos des broderies, caution encadrée.',
    'look.ajouter': 'Ajouter',
    'look.ensemble': 'Pensé pour cette tenue',
    'look.meme': 'Même fournisseuse',
    'look.dates_dabord': 'Choisissez d\'abord vos dates.',
    'essai.titre': 'Demander un essayage',
    'essai.intro': 'Proposez un créneau à la fournisseuse. Les frais d\'essayage ({prix}) sont déduits de votre location si vous réservez dans les 30 jours, et remboursés si l\'essayage est refusé.',
    'essai.creneau': 'Créneau souhaité',
    'essai.message': 'Message',
    'essai.payer': 'Payer {prix} et envoyer',
    'essai.envoye': 'Demande d\'essayage envoyée.',
    'showroom.titre': 'Showrooms',
    'showroom.intro': 'Essayez plusieurs pièces au même endroit, lors d\'une journée showroom.',
    'showroom.aucun': 'Aucun showroom programmé pour le moment.',
    'showroom.inscrire': 'M\'inscrire',
    'showroom.inscrite': 'Inscription confirmée. Un email récapitulatif vous a été envoyé.',
    'boutique.introuvable': 'Cette boutique est introuvable.',
    'boutique.pieces': 'pièces',
    'boutique.avis': '{n} avis',
    'boutique.depuis': 'membre depuis',
    'boutique.collection': 'La collection',
    'boutique.vide': 'Aucune pièce en ligne pour le moment.',
    'boutique.avis_titre': 'Avis des clientes',
    'boutique.seo_titre': '{nom} — {type} à {ville} | {brand}',
    'boutique.seo_desc': 'Découvrez et louez la collection de {nom}.'
  });

  ajouter('nl', {
    'meta.index.titre': 'Kaftans en takchita\'s huren in Brussel, Luik en Antwerpen — {brand}',
    'meta.index.desc': 'Huur kaftans, takchita\'s, bruidskledij en accessoires bij geverifieerde particulieren, negafa\'s en ontwerpsters in Brussel, Luik en Antwerpen.',
    'meta.cat.titre': 'Catalogus: kaftan, takchita en bruidskledij huren — {brand}',
    'meta.cat.desc': 'Huur een kaftan in Antwerpen, een takchita in Brussel of negafa-kledij in Luik. Filter op gelegenheid, maat, afmetingen, kleur, budget en datum.',
    'meta.tenue.titre': 'Marokkaanse kledij huren — {brand}',
    'meta.tenue.desc': 'Gedetailleerde afmetingen, foto\'s van het borduurwerk, beschikbaarheid en veilige reservering.',
    'meta.boutique.titre': 'Boetiek — negafa en ontwerpster — {brand}',
    'meta.boutique.desc': 'Ontdek de collectie van een negafa of ontwerpster en huur haar stukken veilig.',
    'index.hero.surtitre': 'Verhuur van Marokkaanse kledij · België',
    'index.hero.titre': 'Draag het <em>uitzonderlijke,</em> de tijd van een feest.',
    'index.hero.texte': 'Kaftans, takchita\'s, bruidskledij en juwelen, uitgeleend door geverifieerde particulieren, negafa\'s en ontwerpsters. Voor een huwelijk, een verloving, een henna-avond of Eid.',
    'index.hero.cta': 'Ontdek de catalogus',
    'index.hero.cta2': 'Mijn kledij aanbieden',
    'index.hero.etiquette_titre': 'Smaragdgroene takchita',
    'index.hero.etiquette_texte': 'Met de hand geborduurd, mdamma-riem inbegrepen',
    'index.conf.1t': 'Geverifieerde kledij', 'index.conf.1': 'elke advertentie wordt nagelezen',
    'index.conf.2t': 'Veilige betaling', 'index.conf.2': 'Bancontact of kaart',
    'index.conf.3t': 'Omkaderde waarborg', 'index.conf.3': 'enkel een autorisatie, nooit afgeschreven',
    'index.conf.4t': 'Stomerij inbegrepen', 'index.conf.4': 'breng het stuk terug zoals het is',
    'index.coll.surtitre': 'Collecties',
    'index.coll.titre': 'Een stuk voor elk feest',
    'index.sel.surtitre': 'Selectie',
    'index.sel.titre': 'Stukken van het moment',
    'index.sel.lien': 'Alle nieuwigheden',
    'index.sel.vide': 'De eerste stukken komen er heel binnenkort aan.',
    'index.cmt.surtitre': 'Hoe werkt het',
    'index.cmt.titre': 'Eenvoudig, omkaderd, onder ons',
    'index.cmt.chapeau': 'Het platform controleert, int, beschermt beide partijen en betaalt de rest uit. U concentreert zich op het feest.',
    'index.cmt.clientes': 'Voor klanten',
    'index.cmt.c1t': 'Kies', 'index.cmt.c1': 'Filter op gelegenheid, maat, afmetingen, kleur en datum. De exacte afmetingen staan vermeld: aanpassingen zijn niet toegestaan.',
    'index.cmt.c2t': 'Pas indien nodig', 'index.cmt.c2': 'Reserveer een tijdslot bij de aanbieder of tijdens een showroom. De kosten worden afgetrokken als u huurt.',
    'index.cmt.c3t': 'Betaal in één keer', 'index.cmt.c3': 'Uw winkelmand kan meerdere aanbieders bevatten. U betaalt zodra iedereen heeft aanvaard, met Bancontact of kaart.',
    'index.cmt.c4t': 'Draag, breng terug', 'index.cmt.c4': 'Staat in vier foto\'s bij overhandiging en terugbezorging. De waarborg is een autorisatie die automatisch wordt vrijgegeven.',
    'index.cmt.fournisseuses': 'Voor aanbieders',
    'index.cmt.f1t': 'Publiceer', 'index.cmt.f1': 'Vier foto\'s, de afmetingen, uw prijs. Ons team leest elke advertentie na voor ze online gaat.',
    'index.cmt.f2t': 'Aanvaard binnen 24 u', 'index.cmt.f2': 'U behoudt de controle over elke aanvraag en uw kalender. Rond elke huur worden twee dagen geblokkeerd voor de stomerij.',
    'index.cmt.f3t': 'Overhandig met vertrouwen', 'index.cmt.f3': 'Geverifieerde identiteit bij hoge waarborgen, bankautorisatie en een gedateerde staat.',
    'index.cmt.f4t': 'Ontvang uw uitbetaling', 'index.cmt.f4': 'De uitbetaling vertrekt 24 uur na de bevestigde terugbezorging, rechtstreeks op uw rekening.',
    'index.simu.surtitre': 'Particulieren, negafa\'s, ontwerpsters',
    'index.simu.titre': 'Uw kleerkast is waardevol',
    'index.simu.chapeau': 'Een takchita die twee keer gedragen werd, hangt vaak tien jaar in een hoes. Geef ze een nieuw leven, in alle veiligheid.',
    'index.simu.p1': 'Veilige betaling en automatische uitbetaling',
    'index.simu.p2': 'Waarborg en staat bij elke huur',
    'index.simu.p3': 'Boetiekpagina voor negafa\'s en ontwerpsters',
    'index.simu.cta': 'Mijn kledij aanbieden',
    'index.simu.prix': 'Huurprijs',
    'index.simu.nb': 'Verhuringen per maand',
    'index.simu.resultat': 'Geschat inkomen per maand',
    'index.simu.note': 'Schatting: prijs × verhuringen × (1 − commissie van {pct} %). Stomerijkosten worden extra uitbetaald.',
    'index.bout.surtitre': 'Negafa\'s en ontwerpsters',
    'index.bout.titre': 'Huizen om te ontdekken',
    'index.hub.surtitre': 'Huwelijkshub',
    'index.hub.titre': 'De hele grote dag, op één plek',
    'index.hub.chapeau': 'Vertrouwde visagisten, fotografen, hennaya\'s en negafa\'s in Brussel, Luik en Antwerpen. Vraag een offerte aan in één bericht.',
    'index.hub.cta': 'De hub verkennen',
    'index.fin.surtitre': 'Uw volgende feest',
    'index.fin.titre': 'De kaftan van uw dromen bestaat al. Iemand leent hem u.',
    'cat.surtitre': 'Brussel · Luik · Antwerpen',
    'cat.titre': 'De catalogus',
    'cat.chapeau': 'Kaftans, takchita\'s, bruidskledij, herenkledij en accessoires, één voor één gecontroleerd.',
    'cat.trier': 'Sorteren', 'cat.tri_pertinence': 'Relevantie', 'cat.tri_recent': 'Nieuw', 'cat.tri_prix_asc': 'Prijs oplopend', 'cat.tri_prix_desc': 'Prijs aflopend',
    'cat.filtres': 'Filters', 'cat.plus': 'Meer tonen', 'cat.reinitialiser': 'Wissen', 'cat.voir_resultats': 'Resultaten bekijken',
    'cat.du': 'Van', 'cat.au': 'Tot',
    'cat.f_categorie': 'Categorie', 'cat.f_occasion': 'Gelegenheid', 'cat.f_date': 'Beschikbaar op uw data', 'cat.f_ville': 'Stad',
    'cat.f_mesures': 'Uw afmetingen', 'cat.f_couleur': 'Kleur', 'cat.f_budget': 'Budget', 'cat.f_vendeuse': 'Aangeboden door',
    'cat.budget_max': 'Maximumprijs (€)', 'cat.recherche': 'Zoeken', 'cat.recherche_ph': 'Fluweel, handgeborduurd, sfifa…',
    'cat.toutes': 'Alle', 'cat.toutes_tailles': 'Alle', 'cat.toutes_villes': 'Alle', 'cat.enfant': 'Kind',
    'cat.mesures_aide': 'We tonen de stukken waarvan de afmetingen passen, zonder aanpassing (0 tot 8 cm ruimte).',
    'cat.mes_mesures': 'Mijn opgeslagen afmetingen gebruiken',
    'cat.mesures_absentes': 'Sla eerst uw afmetingen op in uw ruimte.',
    'cat.mesures_appliquees': 'Uw afmetingen worden toegepast.',
    'cat.resultat': '{n} stuk', 'cat.resultats': '{n} stukken',
    'tenue.introuvable': 'Deze kledij is niet (meer) beschikbaar.',
    'tenue.fil': 'Kruimelpad',
    'tenue.photos': 'Foto\'s van de kledij',
    'tenue.photo_face': 'vooraanzicht', 'tenue.photo_dos': 'achteraanzicht', 'tenue.photo_broderie': 'detail van het borduurwerk',
    'tenue.photo_portee': 'gedragen', 'tenue.photo_autre': 'ander zicht',
    'tenue.loupe_aide': 'Beweeg erover of druk lang om het borduurwerk te bekijken.',
    'tenue.par_location': 'per huur, van {min} tot {max} dagen',
    'tenue.main_propre': 'Persoonlijke overhandiging',
    'tenue.envoi': 'Verzekerde verzending (+{prix})',
    'tenue.essayage_possible': 'Passen mogelijk',
    'tenue.couleurs': 'Kleuren',
    'tenue.mesures': 'Afmetingen van de kledij',
    'tenue.retouche_titre': 'Geen aanpassingen toegestaan.',
    'tenue.retouche_texte': 'Vergelijk deze afmetingen met de uwe: de kledij moet in originele staat worden teruggebracht.',
    'tenue.reserver_titre': 'Reserveren',
    'tenue.reserver': 'Reserveren',
    'tenue.date_evenement': 'Datum van het evenement',
    'tenue.date_debut': 'Ophalen',
    'tenue.date_fin': 'Terugbrengen',
    'tenue.mode_remise': 'Wijze van overhandiging',
    'tenue.choisir_dates': 'Kies uw data om de beschikbaarheid te controleren.',
    'tenue.verification': 'Controleren…',
    'tenue.disponible': 'Beschikbaar op deze data',
    'tenue.indisponible': 'Niet beschikbaar op deze data (stomerij inbegrepen). Probeer andere data.',
    'tenue.dates_incoherentes': 'Het evenement moet tussen ophalen en terugbrengen vallen.',
    'tenue.duree_hors': 'Huurduur: van {min} tot {max} dagen.',
    'tenue.r_location': 'Huur', 'tenue.r_pressing': 'Stomerij', 'tenue.r_envoi': 'Verzekerde verzending', 'tenue.r_service': 'Servicekosten',
    'tenue.r_total': 'Geschat totaal', 'tenue.r_caution': 'Waarborg (autorisatie, niet afgeschreven)',
    'tenue.r_note': 'U betaalt pas na aanvaarding door de aanbieder.',
    'tenue.ajouter_panier': 'Aanvraag versturen',
    'tenue.deja_panier': 'In de winkelmand',
    'tenue.ajoute': 'Toegevoegd aan de winkelmand',
    'tenue.dates_panier_maj': 'De data van uw winkelmand werden bijgewerkt.',
    'tenue.essayer': 'Passen aanvragen ({prix})',
    'tenue.showroom_lien': 'Of passen tijdens een showroom',
    'tenue.whatsapp': 'Delen via WhatsApp',
    'tenue.partage_texte': 'Kijk eens naar deze kledij: {titre}',
    'tenue.seo_titre': '{titre} — {categorie} huren {ville} | {brand}',
    'tenue.seo_desc': 'Huur {titre} in {ville}: gedetailleerde afmetingen, foto\'s van het borduurwerk, omkaderde waarborg.',
    'tenue.avis_titre': 'Wat klanten zeggen',
    'look.surtitre': 'Geheel',
    'look.titre': 'De look vervolledigen',
    'look.chapeau': 'Mdamma, juwelen en kronen van dezelfde aanbieder eerst, daarna uit de gemeenschap.',
    'look.ajouter': 'Toevoegen',
    'look.ensemble': 'Bedacht voor deze kledij',
    'look.meme': 'Zelfde aanbieder',
    'look.dates_dabord': 'Kies eerst uw data.',
    'essai.titre': 'Passen aanvragen',
    'essai.intro': 'Stel de aanbieder een tijdslot voor. De paskosten ({prix}) worden afgetrokken van uw huur als u binnen 30 dagen reserveert, en terugbetaald als het passen wordt geweigerd.',
    'essai.creneau': 'Gewenst tijdslot',
    'essai.message': 'Bericht',
    'essai.payer': '{prix} betalen en versturen',
    'essai.envoye': 'Pasaanvraag verzonden.',
    'showroom.titre': 'Showrooms',
    'showroom.intro': 'Pas meerdere stukken op dezelfde plek, tijdens een showroomdag.',
    'showroom.aucun': 'Momenteel geen showroom gepland.',
    'showroom.inscrire': 'Inschrijven',
    'showroom.inscrite': 'Inschrijving bevestigd. U ontving een overzicht per e-mail.',
    'boutique.introuvable': 'Deze boetiek bestaat niet.',
    'boutique.pieces': 'stukken',
    'boutique.avis': '{n} reviews',
    'boutique.depuis': 'lid sinds',
    'boutique.collection': 'De collectie',
    'boutique.vide': 'Momenteel geen stukken online.',
    'boutique.avis_titre': 'Reviews van klanten',
    'boutique.seo_titre': '{nom} — {type} in {ville} | {brand}',
    'boutique.seo_desc': 'Ontdek en huur de collectie van {nom}.'
  });

  // ---------------------------------------------------------------------------
  // Moteur
  // ---------------------------------------------------------------------------
  var STOCKAGE = 'lalla.langue';
  var langue = (function () {
    try {
      var url = new URLSearchParams(location.search).get('lang');
      if (url === 'fr' || url === 'nl') return url;
      var s = localStorage.getItem(STOCKAGE);
      if (s === 'fr' || s === 'nl') return s;
    } catch (e) { /* stockage indisponible */ }
    return /^nl\b/i.test(navigator.language || '') ? 'nl' : 'fr';
  })();

  function marque() {
    return (window.LALLA_CONFIG && window.LALLA_CONFIG.brand.name) || 'LALLA';
  }

  function t(cle, vars) {
    var s = D[langue][cle];
    if (s == null) s = D.fr[cle];
    if (s == null) return cle;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      if (k === 'brand') return marque();
      if (vars && vars[k] != null) return String(vars[k]);
      return m;
    });
  }

  function existe(cle) {
    return D.fr[cle] != null || D.nl[cle] != null;
  }

  // Le français des pages statiques est écrit directement dans le HTML (référencement, sans JS).
  // Il est capturé au premier passage : seul le néerlandais doit figurer dans le dictionnaire.
  function capturer(noeud, cle, html) {
    if (D.fr[cle] == null) D.fr[cle] = html ? noeud.innerHTML.trim() : noeud.textContent.trim();
  }

  function appliquer(racine) {
    racine = racine || document;
    var noeuds = racine.querySelectorAll('[data-i18n]');
    for (var i = 0; i < noeuds.length; i++) {
      capturer(noeuds[i], noeuds[i].getAttribute('data-i18n'), false);
      noeuds[i].textContent = t(noeuds[i].getAttribute('data-i18n'));
    }
    noeuds = racine.querySelectorAll('[data-i18n-html]');
    for (i = 0; i < noeuds.length; i++) {
      capturer(noeuds[i], noeuds[i].getAttribute('data-i18n-html'), true);
      noeuds[i].innerHTML = t(noeuds[i].getAttribute('data-i18n-html'));
    }
    noeuds = racine.querySelectorAll('[data-i18n-attr]');
    for (i = 0; i < noeuds.length; i++) {
      var paires = noeuds[i].getAttribute('data-i18n-attr').split(';');
      for (var j = 0; j < paires.length; j++) {
        var p = paires[j].split(':');
        if (p.length !== 2) continue;
        var attr = p[0].trim(), cleAttr = p[1].trim();
        if (D.fr[cleAttr] == null && noeuds[i].hasAttribute(attr)) D.fr[cleAttr] = noeuds[i].getAttribute(attr);
        noeuds[i].setAttribute(attr, t(cleAttr));
      }
    }
    var marques = racine.querySelectorAll('[data-brand]');
    for (i = 0; i < marques.length; i++) marques[i].textContent = marque();
  }

  function changerLangue(l) {
    if (l !== 'fr' && l !== 'nl') return;
    langue = l;
    try { localStorage.setItem(STOCKAGE, l); } catch (e) { /* ignoré */ }
    document.documentElement.lang = l === 'nl' ? 'nl-BE' : 'fr-BE';
    appliquer(document);
    document.dispatchEvent(new CustomEvent('lalla:langue', { detail: { langue: l } }));
  }

  window.I18N = {
    t: t,
    existe: existe,
    appliquer: appliquer,
    changerLangue: changerLangue,
    ajouter: ajouter,
    get langue() { return langue; },
    get locale() { return langue === 'nl' ? 'nl-BE' : 'fr-BE'; },
    dictionnaire: D
  };

  document.documentElement.lang = langue === 'nl' ? 'nl-BE' : 'fr-BE';
})();
