/*
 * Configuration de marque et de contenu — fichier unique.
 * Lu par le navigateur (window.LALLA_CONFIG) et par les fonctions /api (globalThis.LALLA_CONFIG).
 * Pour renommer la plateforme : changez `brand.name`, puis lancez `node scripts/rebrand.mjs`
 * (met à jour les balises <title> et Open Graph statiques des pages HTML).
 * Aucune clé secrète ici.
 */
(function (root) {
  var CONFIG = {
    brand: {
      name: 'LALLAT',
      email: 'bonjour@lallat.be',
      instagram: 'lallat.be',
      domaine: 'lallat.be'
    },
    // Zones couvertes : toute la Belgique (Bruxelles et les 10 provinces). Valeur stockée en français.
    villes: ['Bruxelles', 'Anvers', 'Brabant flamand', 'Brabant wallon', 'Flandre occidentale', 'Flandre orientale',
      'Hainaut', 'Liège', 'Limbourg', 'Luxembourg', 'Namur'],
    villesNl: {
      'Bruxelles': 'Brussel', 'Anvers': 'Antwerpen', 'Brabant flamand': 'Vlaams-Brabant', 'Brabant wallon': 'Waals-Brabant',
      'Flandre occidentale': 'West-Vlaanderen', 'Flandre orientale': 'Oost-Vlaanderen', 'Hainaut': 'Henegouwen',
      'Liège': 'Luik', 'Limbourg': 'Limburg', 'Luxembourg': 'Luxemburg', 'Namur': 'Namen'
    },
    langues: ['fr', 'nl'],
    // Version des conditions générales : la changer oblige chaque membre à les accepter de nouveau.
    cguVersion: '2026-10-06',
    // Photos de l'accueil : déposez vos fichiers dans assets/photos/ et indiquez leur chemin ici
    // (ex. 'assets/photos/accueil.jpg'). Tant qu'un chemin est vide, un aplat de tissu sobre est affiché.
    photos: {
      accueil: '',  // photos de l'accueil désormais placées directement dans index.html (assets/photos/)
      hub: '',
      collections: { caftan: '', takchita: '', mariee: '', homme: '', enfant: '', accessoire: '' }
    },
    liens: {
      // Bloc « Beauté de la mariée » (hub mariage) : boutique externe
      beauteMariee: 'https://exemple.com/boutique-beaute'
    },
    categories: ['caftan', 'takchita', 'mariee', 'homme', 'enfant', 'accessoire'],
    // Hub des fêtes : trois univers d'annonces, par ordre d'importance (tenues d'abord, matériel en complément)
    univers: {
      tenue: ['caftan', 'takchita', 'mariee', 'homme', 'enfant', 'accessoire'],
      prestation: ['maquillage', 'coiffure', 'photographie', 'videographie', 'henne', 'negafa', 'dj', 'traiteur', 'patisserie'],
      materiel: ['sono', 'eclairage', 'decoration', 'mobilier', 'vaisselle']
    },
    // Critères propres à chaque catégorie (matériel et prestations) : type nombre | oui_non | choix | texte
    criteres: {
      sono: [{ cle: 'puissance_w', type: 'nombre', unite: 'W', requis: true }, { cle: 'nb_enceintes', type: 'nombre' }, { cle: 'micro', type: 'oui_non' }, { cle: 'table_mixage', type: 'oui_non' }, { cle: 'installation', type: 'oui_non' }],
      eclairage: [{ cle: 'type_eclairage', type: 'choix', options: ['projecteurs', 'jeux_lumiere', 'guirlandes', 'neon', 'bougies_led'], requis: true }, { cle: 'nb_elements', type: 'nombre' }, { cle: 'installation', type: 'oui_non' }],
      decoration: [{ cle: 'style', type: 'choix', options: ['oriental', 'moderne', 'boheme', 'luxe'], requis: true }, { cle: 'contenu', type: 'texte' }, { cle: 'dimensions', type: 'texte' }, { cle: 'installation', type: 'oui_non' }],
      mobilier: [{ cle: 'type_mobilier', type: 'choix', options: ['amaria', 'trone', 'salon_marocain', 'tables', 'chaises', 'estrade'], requis: true }, { cle: 'quantite', type: 'nombre' }, { cle: 'dimensions', type: 'texte' }, { cle: 'installation', type: 'oui_non' }],
      vaisselle: [{ cle: 'type_vaisselle', type: 'choix', options: ['service_the', 'plateaux', 'verres', 'couverts', 'assiettes', 'nappes'], requis: true }, { cle: 'quantite', type: 'nombre' }, { cle: 'nb_personnes', type: 'nombre' }],
      maquillage: [{ cle: 'nb_personnes_max', type: 'nombre', requis: true }, { cle: 'duree_min', type: 'nombre', unite: 'min' }, { cle: 'essai', type: 'oui_non' }, { cle: 'deplacement', type: 'oui_non' }, { cle: 'faux_cils', type: 'oui_non' }],
      coiffure: [{ cle: 'nb_personnes_max', type: 'nombre', requis: true }, { cle: 'duree_min', type: 'nombre', unite: 'min' }, { cle: 'essai', type: 'oui_non' }, { cle: 'deplacement', type: 'oui_non' }],
      photographie: [{ cle: 'heures', type: 'nombre', unite: 'h', requis: true }, { cle: 'nb_photos', type: 'nombre' }, { cle: 'delai_livraison', type: 'nombre', unite: 'jours' }, { cle: 'album', type: 'oui_non' }, { cle: 'drone', type: 'oui_non' }, { cle: 'deplacement', type: 'oui_non' }],
      videographie: [{ cle: 'heures', type: 'nombre', unite: 'h', requis: true }, { cle: 'film_minutes', type: 'nombre', unite: 'min' }, { cle: 'delai_livraison', type: 'nombre', unite: 'jours' }, { cle: 'drone', type: 'oui_non' }, { cle: 'deplacement', type: 'oui_non' }],
      henne: [{ cle: 'style_henne', type: 'choix', options: ['marocain', 'soudanais', 'indien', 'khaliji'], requis: true }, { cle: 'zones', type: 'choix', options: ['mains', 'mains_pieds'] }, { cle: 'nb_personnes_max', type: 'nombre' }, { cle: 'deplacement', type: 'oui_non' }],
      negafa: [{ cle: 'nb_tenues', type: 'nombre', requis: true }, { cle: 'equipe', type: 'nombre' }, { cle: 'amaria', type: 'oui_non' }, { cle: 'deplacement', type: 'oui_non' }],
      dj: [{ cle: 'heures', type: 'nombre', unite: 'h', requis: true }, { cle: 'styles', type: 'texte' }, { cle: 'materiel_inclus', type: 'oui_non' }, { cle: 'eclairage_inclus', type: 'oui_non' }],
      traiteur: [{ cle: 'cuisine', type: 'choix', options: ['marocaine', 'orientale', 'internationale'], requis: true }, { cle: 'nb_personnes_min', type: 'nombre' }, { cle: 'nb_personnes_max', type: 'nombre' }, { cle: 'service_inclus', type: 'oui_non' }, { cle: 'halal', type: 'oui_non' }],
      patisserie: [{ cle: 'type_patisserie', type: 'choix', options: ['gateaux_marocains', 'piece_montee', 'sale', 'sucre_sale'], requis: true }, { cle: 'nb_personnes', type: 'nombre' }, { cle: 'livraison', type: 'oui_non' }]
    },
    sousCategories: ['mdamma', 'bijoux', 'couronne'],
    occasions: ['mariage', 'fiancailles', 'henne', 'aid', 'soiree', 'bapteme'],
    tailles: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'unique', 'enfant'],
    couleurs: {
      ivoire: '#F4EEE3', or: '#C3A35A', emeraude: '#1F5E4B', noir: '#141414', bordeaux: '#6E1F2A',
      rose: '#D9A5A0', bleu_nuit: '#1E2A4A', blanc: '#FFFFFF', vert_sauge: '#9AA98A', argent: '#BFC1C2',
      fuchsia: '#B03A6F', moutarde: '#C8962E', turquoise: '#2E8C8A', lilas: '#A694B8', terracotta: '#B5643C'
    },
    metiers: ['maquilleuse', 'photographe', 'hennaya', 'negafa'],
    // Bannière de consentement prête mais désactivée : aucun traceur n'est chargé par défaut.
    consentement: { actif: false },
    cdn: {
      gsap: 'assets/vendor/',
      lenis: 'assets/vendor/lenis.min.js',
      supabase: 'assets/vendor/supabase.js',
      compression: 'assets/vendor/browser-image-compression.js'
    }
  };
  if (typeof module === 'object' && module && module.exports) module.exports = CONFIG;
  root.LALLA_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
