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

  function appliquer(racine) {
    racine = racine || document;
    var noeuds = racine.querySelectorAll('[data-i18n]');
    for (var i = 0; i < noeuds.length; i++) noeuds[i].textContent = t(noeuds[i].getAttribute('data-i18n'));
    noeuds = racine.querySelectorAll('[data-i18n-html]');
    for (i = 0; i < noeuds.length; i++) noeuds[i].innerHTML = t(noeuds[i].getAttribute('data-i18n-html'));
    noeuds = racine.querySelectorAll('[data-i18n-attr]');
    for (i = 0; i < noeuds.length; i++) {
      var paires = noeuds[i].getAttribute('data-i18n-attr').split(';');
      for (var j = 0; j < paires.length; j++) {
        var p = paires[j].split(':');
        if (p.length === 2) noeuds[i].setAttribute(p[0].trim(), t(p[1].trim()));
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
