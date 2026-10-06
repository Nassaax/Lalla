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
