/*
 * LALLAT — contrôleurs des pages publiques (accueil, catalogue, fiche tenue, boutique, panier, partenaires).
 * S'appuie sur window.Lalla (assets/app.js).
 */
(function () {
  'use strict';

  var L = window.Lalla, I = window.I18N, t = I.t, h = L.h, $ = L.$, $$ = L.$$, C = L.config;

  // ===========================================================================
  // Composants partagés
  // ===========================================================================

  /** Paramètres métier publics (commission, pressing…) — lus depuis la table parametres. */
  var parametres = null;
  L.parametres = function () {
    if (parametres) return Promise.resolve(parametres);
    var defauts = { commission_taux: 0.15, frais_service_taux: 0.05, frais_pressing_cents: 1500, frais_essayage_cents: 1500, caution_taux: 0.5, pressing_jours: 2, seuil_identity_cents: 50000, reservations_ouvertes: false };
    if (!L.sb) return Promise.resolve(defauts);
    return L.sb.from('parametres').select('cle, valeur').then(function (r) {
      parametres = Object.assign({}, defauts);
      (r.data || []).forEach(function (p) { parametres[p.cle] = p.valeur; });
      return parametres;
    });
  };

  /** Bandeau discret sous l'en-tête tant que les réservations sont fermées. */
  L.bandeauLancement = function (page) {
    if (['index', 'catalogue', 'tenue', 'boutique', 'panier'].indexOf(page) < 0) return;
    L.parametres().then(function (p) {
      if (p.reservations_ouvertes === true || $('.bandeau-lancement')) return;
      var b = h('div', { class: 'bandeau-lancement', role: 'status' }, h('strong', null, 'Coming soon'), h('span', null, ' · ' + t('lanc.bandeau')));
      var entete = $('#entete');
      if (entete) entete.insertAdjacentElement('afterend', b);
    });
  };

  function libelleCategorie(tn) {
    return tn.categorie === 'accessoire' && tn.sous_categorie ? t('scat.' + tn.sous_categorie) : t('cat.' + tn.categorie);
  }
  L.libelleCategorie = libelleCategorie;

  function placeholderPour(tn, vue) {
    var couleur = (tn.couleurs && tn.couleurs[0]) || 'ivoire';
    var cat = tn.categorie === 'accessoire' ? (tn.sous_categorie || 'bijoux') : tn.categorie;
    var graine = parseInt(String(tn.id || '0').replace(/\D/g, '').slice(-3) || '0', 10);
    return 'placeholder:' + cat + ':' + couleur + ':' + (vue || 'face') + ':' + graine;
  }
  L.placeholderPour = placeholderPour;

  /** Ligne « Chez Samira, negafa à Liège · à 12 km ». */
  function chezQui(tn) {
    var lieu = tn.commune || L.zone(tn.ville);
    var qui = tn.fournisseuse_nom ? t('carte.chez', { nom: tn.fournisseuse_nom, type: t('type.' + (tn.type_fournisseuse || 'particuliere')).toLowerCase(), lieu: lieu }) : lieu;
    return qui + (tn.distance_km != null ? ' · ' + t('carte.km', { n: tn.distance_km }) : '');
  }
  L.chezQui = chezQui;

  /** Note affichée : moyenne et nombre d'avis, ou « Nouveau ». */
  function noteCourte(note, nb) {
    return nb ? '★ ' + Number(note).toFixed(1).replace('.', ',') + ' (' + nb + ')' : '★ ' + t('carte.nouveau');
  }
  L.noteCourte = noteCourte;

  /** Carte d'annonce (catalogue, accueil, profil, compléter le look). */
  L.carteTenue = function (tn, options) {
    options = options || {};
    var url = 'tenue.html?id=' + tn.id;
    var img = L.img.element(tn.photo || placeholderPour(tn, 'face'), tn.titre, { width: 600, height: 750 });
    var badge = tn.badge_confiance ? h('span', { class: 'carte__badge' }, t('badge.confiance_court'))
      : tn.type_fournisseuse && tn.type_fournisseuse !== 'particuliere' ? h('span', { class: 'carte__badge' }, t('type.' + tn.type_fournisseuse)) : null;
    var carte = h('a', { class: 'carte', href: url, 'data-flip-id': tn.id },
      h('div', { class: 'carte__visuel' }, h('div', { class: 'arche' }, img), badge, options.sansFavori ? null : L.favoris.bouton(tn.id)),
      h('div', { class: 'carte__infos' },
        h('div', { class: 'carte__ligne1' }, h('h3', { class: 'carte__titre' }, tn.titre), h('span', { class: 'carte__note' }, noteCourte(tn.note_moyenne, tn.nb_avis))),
        h('p', { class: 'carte__meta' }, chezQui(tn)),
        h('p', { class: 'carte__prix' }, h('strong', null, L.euros(tn.prix_location_cents, true)), ' ', t('carte.la_location'),
          tn.reservation_instantanee ? [' · ', h('span', { class: 'carte__eclair' }, '⚡ ' + t('carte.instantanee'))] : null)),
      options.extra || null);
    carte.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      L.motion.preparerFlip(img, url);
    });
    return carte;
  };

  function remplirPlaceholders(racine) {
    $$('img[data-placeholder]', racine).forEach(function (img) { img.src = L.img.placeholder(img.getAttribute('data-placeholder')); });
  }

  function rechercher(params) {
    if (!L.sb) return Promise.resolve([]);
    return L.sb.rpc('rechercher_tenues', params).then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }
  L.rechercher = rechercher;

  // ===========================================================================
  // Accueil
  // ===========================================================================
  L.pages.index = function () {
    photosAccueil();
    rechercheAccueil();
    categoriesAccueil();
    apercu();
    hotes();
    simulateur();
    $$('[data-devenir-fournisseuse]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (L.session) location.href = 'compte.html?vue=annonces';
        else L.ui.authentification('inscription', { role: 'fournisseuse' });
      });
    });
    $$('[data-inscription]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (L.session) location.href = 'catalogue.html';
        else L.ui.authentification('inscription');
      });
    });
    $$('[data-connexion]').forEach(function (b) {
      b.addEventListener('click', function () { L.ui.authentification('connexion'); });
    });
  };

  /** Photos réelles de l'accueil si elles sont renseignées dans config.photos. */
  function photosAccueil() {
    $$('img[data-visuel-photo]').forEach(function (img) {
      var chemin = (C.photos || {})[img.getAttribute('data-visuel-photo')];
      if (chemin) { img.src = chemin; img.hidden = false; }
    });
  }

  /** Barre de recherche « Tenue / Où / Date » : mène au catalogue filtré. */
  function rechercheAccueil() {
    var form = $('[data-recherche]');
    if (!form) return;
    var sel = form.categorie;
    function options() {
      var v = sel.value;
      L.vider(sel).appendChild(h('option', { value: '' }, t('index.r.toutes')));
      C.categories.forEach(function (c) { sel.appendChild(h('option', { value: c, selected: c === v }, t('cat.' + c))); });
    }
    options();
    document.addEventListener('lalla:langue', options);
    form.date.min = L.aujourdhui();
    try { var cp = L.stockage.lire('lalla.cp', ''); if (cp) form.cp.value = cp; } catch (e) { /* ignoré */ }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = new URLSearchParams();
      if (sel.value) q.set('categorie', sel.value);
      var cp = form.cp.value.trim();
      if (/^[0-9]{4}$/.test(cp)) { q.set('cp', cp); q.set('tri', 'distance'); L.stockage.ecrire('lalla.cp', cp); }
      if (form.date.value) { q.set('debut', form.date.value); q.set('fin', form.date.value); }
      location.href = 'catalogue.html' + (q.toString() ? '?' + q.toString() : '');
    });
  }

  var OCCASIONS_ACCUEIL = [['mariee', 'categorie'], ['takchita', 'categorie'], ['caftan', 'categorie'], ['henne', 'occasion'], ['fiancailles', 'occasion'], ['aid', 'occasion'], ['homme', 'categorie'], ['enfant', 'categorie'], ['accessoire', 'categorie']];
  function categoriesAccueil() {
    var zone = $('[data-categories]');
    if (!zone) return;
    function remplir() {
      L.vider(zone).appendChild(h('a', { class: 'puce est-actif', href: 'catalogue.html' }, t('cat.toutes')));
      OCCASIONS_ACCUEIL.forEach(function (c) {
        zone.appendChild(h('a', { class: 'puce', href: 'catalogue.html?' + c[1] + '=' + c[0] }, t((c[1] === 'categorie' ? 'cat.' : 'occ.') + c[0])));
      });
    }
    remplir();
    document.addEventListener('lalla:langue', remplir);
  }

  // Fournisseuses d'exemple tant qu'aucune n'est validée.
  var HOTES_EXEMPLES = [
    { nom: 'Samira', type: 'negafa', commune: 'Bruxelles', couleur: 'rose' },
    { nom: 'Maison Yasmine', type: 'creatrice', commune: 'Gand', couleur: 'or' },
    { nom: 'Nadia', type: 'particuliere', commune: 'Liège', couleur: 'bordeaux' },
    { nom: 'Imane', type: 'particuliere', commune: 'Charleroi', couleur: 'emeraude' }
  ];

  /** Carte d'une fournisseuse (accueil). */
  function carteHote(p, exemple) {
    var photo = p.avatar_chemin ? L.img.url(p.avatar_chemin, 'avatars') : L.img.placeholder('placeholder:caftan:' + (p.couleur || 'rose') + ':face:' + (p.nom || '').length);
    var badges = [];
    if (p.badge_confiance) badges.push(h('span', { class: 'badge badge--or' }, t('badge.confiance_court')));
    else if (exemple || p.identite_verifiee || p.compte_valide) badges.push(h('span', { class: 'badge' }, t(exemple ? 'index.ap.exemple' : 'badge.verifiee')));
    return h(exemple ? 'div' : 'a', { class: 'hote', href: exemple ? null : 'boutique.html?id=' + p.id },
      h('div', { class: 'hote__photo' }, h('img', { src: photo, alt: '', loading: 'lazy' })),
      h('b', null, p.boutique_nom || p.nom_affiche || p.nom),
      h('span', null, t('type.' + (p.type_fournisseuse || p.type || 'particuliere')) + ' · ' + (p.commune || L.zone(p.ville) || '')),
      p.nb_avis ? h('span', null, noteCourte(p.note_moyenne, p.nb_avis)) : null,
      badges);
  }

  function hotes() {
    var zone = $('[data-hotes]');
    if (!zone) return;
    function exemples() { L.vider(zone); HOTES_EXEMPLES.forEach(function (x) { zone.appendChild(carteHote(x, true)); }); }
    if (!L.sb) { exemples(); return; }
    L.sb.from('profils').select('id, nom_affiche, boutique_nom, type_fournisseuse, ville, commune, note_moyenne, nb_avis, avatar_chemin, badge_confiance, identite_verifiee, compte_valide')
      .eq('est_fournisseuse', true).eq('compte_valide', true).eq('statut_compte', 'actif')
      .order('badge_confiance', { ascending: false }).order('score_visibilite', { ascending: false }).limit(4)
      .then(function (r) {
        var liste = r.data || [];
        if (!liste.length) { exemples(); return; }
        L.vider(zone);
        liste.forEach(function (p) { zone.appendChild(carteHote(p, false)); });
      }, exemples);
  }

  // Exemples affichés tant qu'aucune tenue n'est publiée (illustrations générées, non réservables).
  var EXEMPLES = [
    { cle: 'index.ex.1', categorie: 'takchita', couleurs: ['emeraude'], prix_location_cents: 9500, nom: 'Samira', type: 'negafa', commune: 'Bruxelles', graine: 5 },
    { cle: 'index.ex.2', categorie: 'caftan', couleurs: ['bordeaux'], prix_location_cents: 7000, nom: 'Nadia', type: 'particuliere', commune: 'Liège', graine: 3 },
    { cle: 'index.ex.3', categorie: 'mariee', couleurs: ['ivoire'], prix_location_cents: 22000, nom: 'Maison Yasmine', type: 'creatrice', commune: 'Gand', graine: 9 },
    { cle: 'index.ex.4', categorie: 'homme', couleurs: ['bleu_nuit'], prix_location_cents: 4500, nom: 'Karima', type: 'particuliere', commune: 'Charleroi', graine: 2 },
    { cle: 'index.ex.5', categorie: 'accessoire', sous_categorie: 'mdamma', couleurs: ['or'], prix_location_cents: 3500, nom: 'Hanane', type: 'negafa', commune: 'Namur', graine: 1 },
    { cle: 'index.ex.6', categorie: 'enfant', couleurs: ['rose'], prix_location_cents: 3000, nom: 'Imane', type: 'particuliere', commune: 'Anvers', graine: 4 }
  ];
  L.exemples = EXEMPLES;

  /** Carte d'exemple : même allure qu'une vraie carte, marquée « Exemple », ouvre l'inscription. */
  L.carteExemple = function (ex) {
    var cat = ex.categorie === 'accessoire' ? ex.sous_categorie : ex.categorie;
    var carte = h('button', { type: 'button', class: 'carte carte--exemple' },
      h('div', { class: 'carte__visuel' },
        h('div', { class: 'arche' }, h('img', { src: L.img.placeholder('placeholder:' + cat + ':' + ex.couleurs[0] + ':face:' + ex.graine), alt: '', loading: 'lazy', width: 600, height: 750 })),
        h('span', { class: 'carte__badge carte__badge--exemple', 'data-i18n': 'index.ap.exemple' }, t('index.ap.exemple'))),
      h('div', { class: 'carte__infos' },
        h('div', { class: 'carte__ligne1' }, h('h3', { class: 'carte__titre', 'data-i18n': ex.cle }, t(ex.cle)), h('span', { class: 'carte__note' }, noteCourte(null, 0))),
        h('p', { class: 'carte__meta' }, chezQui({ fournisseuse_nom: ex.nom, type_fournisseuse: ex.type, commune: ex.commune })),
        h('p', { class: 'carte__prix' }, h('strong', null, L.euros(ex.prix_location_cents, true)), ' ', t('carte.la_location'))));
    carte.addEventListener('click', function () {
      if (L.session) location.href = 'catalogue.html';
      else L.ui.authentification('inscription');
    });
    return carte;
  };

  /** Aperçu : 6 pièces (réelles s'il y en a, sinon des exemples) puis l'invitation à s'inscrire. */
  function apercu() {
    var zone = $('[data-apercu]');
    if (!zone) return;
    var mur = $('[data-apercu-mur]'), connecte = $('[data-apercu-connecte]'), note = $('[data-apercu-note]');
    L.ui.chargement(zone);
    rechercher({ p_tri: 'recent', p_limite: 6 }).catch(function () { return []; }).then(function (liste) {
      L.vider(zone);
      if (liste.length) {
        note.setAttribute('data-i18n', 'index.ap.note_reel');
        note.textContent = t('index.ap.note_reel');
        liste.forEach(function (tn) { var c = L.carteTenue(tn); c.setAttribute('data-reveal', ''); zone.appendChild(c); });
      } else {
        EXEMPLES.forEach(function (ex) { var c = L.carteExemple(ex); c.setAttribute('data-reveal', ''); zone.appendChild(c); });
      }
      L.motion.reveler(zone);
      L.auth.pret.then(function () {
        var avecCompte = !!L.session;
        mur.hidden = avecCompte;
        connecte.hidden = !avecCompte || !liste.length;
        zone.classList.toggle('s-apercu__grille--voilee', !avecCompte);
      });
    });
  }

  function simulateur() {
    var prix = $('#simu-prix'), nb = $('#simu-nb');
    if (!prix) return;
    var sortiePrix = $('#simu-prix-sortie'), sortieNb = $('#simu-nb-sortie'), resultat = $('[data-simu-resultat]'), note = $('[data-simu-note]');
    var taux = 0.15;
    function pct(input) { input.style.setProperty('--pct', ((input.value - input.min) / (input.max - input.min) * 100) + '%'); }
    function maj() {
      var p = Number(prix.value), n = Number(nb.value);
      sortiePrix.textContent = L.euros(p * 100, true);
      sortieNb.textContent = String(n);
      pct(prix); pct(nb);
      // prix de location × locations par mois × (1 − commission) = revenu estimé
      L.motion.compteur(resultat, Math.round(p * n * (1 - taux)), function (v) { return L.euros(v * 100, true); });
      note.textContent = t('index.simu.note', { pct: Math.round(taux * 100) });
    }
    prix.addEventListener('input', maj);
    nb.addEventListener('input', maj);
    document.addEventListener('lalla:langue', maj);
    L.parametres().then(function (p) { taux = Number(p.commission_taux); maj(); });
    maj();
  }

  // ===========================================================================
  // Catalogue
  // ===========================================================================
  L.pages.catalogue = function () {
    var etat = lireFiltresUrl();
    var grille = $('[data-resultats]');
    var compte = $('[data-compte]');
    var plus = $('[data-plus]');
    var form = $('#filtres');
    var tiroir = $('.tiroir');
    var page = 0;
    var PAR_PAGE = 24;
    var total = 0;
    var mur = $('[data-mur]'), murTitre = $('[data-mur-titre]'), noteExemples = $('[data-note-exemples]');
    $$('[data-inscription]').forEach(function (b) { b.addEventListener('click', function () { L.ui.authentification('inscription'); }); });
    $$('[data-connexion]').forEach(function (b) { b.addEventListener('click', function () { L.ui.authentification('connexion'); }); });
    L.auth.surChangement(function () { if (grille.childNodes.length) { page = 0; charger(false); } });

    // Un seul panneau de filtres : tiroir sur mobile, colonne latérale sur desktop.
    var zoneFiltres = $('[data-filtres-zone]');
    var mq = window.matchMedia('(min-width: 1100px)');
    function placerFiltres() {
      if (mq.matches) zoneFiltres.appendChild(tiroir);
      else if (tiroir.parentElement === zoneFiltres) $('main').appendChild(tiroir);
    }
    placerFiltres();
    if (mq.addEventListener) mq.addEventListener('change', placerFiltres);
    zoneFiltres.setAttribute('data-lenis-prevent', '');
    $('.tiroir__panneau', tiroir).setAttribute('data-lenis-prevent', '');

    construireFiltres(form, etat);
    construirePuces($('[data-puces]'), etat, function (cat) { etat.categorie = cat; synchroniserForm(form, etat); appliquer(); });

    function ouvrirTiroir(o) {
      if (mq.matches) return;
      tiroir.classList.toggle('est-ouvert', o);
      document.documentElement.classList.toggle('modale-ouverte', o);
      if (L.motion.lenis) L.motion.lenis[o ? 'stop' : 'start']();
      $('[data-ouvrir-filtres]').setAttribute('aria-expanded', String(o));
    }
    $('[data-ouvrir-filtres]').addEventListener('click', function () { ouvrirTiroir(true); });
    $$('[data-fermer-filtres]').forEach(function (b) { b.addEventListener('click', function () { ouvrirTiroir(false); }); });
    tiroir.addEventListener('click', function (e) { if (e.target === tiroir) ouvrirTiroir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tiroir.classList.contains('est-ouvert')) ouvrirTiroir(false); });

    form.addEventListener('change', L.debounce(function () { etat = lireFormulaire(form); appliquer(); }, 250));
    form.addEventListener('submit', function (e) { e.preventDefault(); etat = lireFormulaire(form); appliquer(); ouvrirTiroir(false); });
    $('[data-reinitialiser]').addEventListener('click', function () { etat = {}; synchroniserForm(form, etat); appliquer(); });
    $('[data-tri]').addEventListener('change', function (e) { etat.tri = e.target.value; appliquer(); });
    $('[data-tri]').value = etat.tri || 'pertinence';
    plus.addEventListener('click', function () { page++; charger(true); });

    // Utiliser les mensurations enregistrées (délégation : le formulaire est reconstruit)
    L.auth.surChangement(function (session) {
      $$('[data-mes-mesures]', form).forEach(function (b) { b.hidden = !session; });
    });
    form.addEventListener('click', function (e) {
      if (!e.target.closest('[data-mes-mesures]') || !L.session) return;
      L.sb.from('mensurations').select('*').eq('user_id', L.session.user.id).maybeSingle().then(function (r) {
        if (!r.data) { L.ui.toast(t('cat.mesures_absentes')); location.href = 'compte.html?vue=mensurations'; return; }
        etat.poitrine = r.data.poitrine_cm; etat.tour_taille = r.data.taille_cm; etat.hanches = r.data.hanches_cm; etat.longueur = r.data.longueur_cm;
        synchroniserForm(form, etat);
        appliquer();
        L.ui.toast(t('cat.mesures_appliquees'), 'succes');
      });
    });

    function appliquer() {
      page = 0;
      ecrireFiltresUrl(etat);
      $$('.puce', $('[data-puces]')).forEach(function (p) { p.setAttribute('aria-pressed', String((p.dataset.cat || '') === (etat.categorie || ''))); });
      charger(false);
    }

    function charger(ajout) {
      if (!ajout) L.ui.chargement(grille);
      plus.hidden = true;
      var p = {
        p_categorie: etat.categorie || null, p_occasion: etat.occasion || null, p_taille: etat.taille || null,
        p_poitrine: num(etat.poitrine), p_tour_taille: num(etat.tour_taille), p_hanches: num(etat.hanches), p_longueur: num(etat.longueur),
        p_couleur: etat.couleur || null, p_prix_max: etat.prix_max ? Number(etat.prix_max) * 100 : null, p_ville: etat.ville || null,
        p_debut: etat.debut || null, p_fin: etat.fin || etat.debut || null, p_recherche: etat.q || null,
        p_type_fournisseuse: etat.boutique || null,
        p_tri: etat.tri === 'distance' && !/^[0-9]{4}$/.test(etat.cp || '') ? 'pertinence' : (etat.tri || 'pertinence'), p_limite: PAR_PAGE, p_decalage: page * PAR_PAGE,
        p_code_postal: /^[0-9]{4}$/.test(etat.cp || '') ? etat.cp : null, p_rayon_km: etat.rayon && /^[0-9]{4}$/.test(etat.cp || '') ? Number(etat.rayon) : null,
        p_instantanee: etat.instant === '1' ? true : null
      };
      var etatFlip = ajout || !window.Flip || !L.motion.actif ? null : window.Flip.getState($$('.carte', grille));
      Promise.all([rechercher(p), L.auth.pret]).then(function (res) {
        var liste = res[0];
        total = liste.length ? Number(liste[0].total) : (ajout ? total : 0);
        if (!ajout) L.vider(grille);
        compte.textContent = t(total === 1 ? 'cat.resultat' : 'cat.resultats', { n: total });
        // Visiteur sans compte : aperçu limité (6 pièces côté serveur), puis invitation à s'inscrire.
        var limite = !L.session && total > liste.length;
        mur.hidden = !limite;
        grille.classList.toggle('s-apercu__grille--voilee', limite);
        if (limite) murTitre.textContent = t('cat.mur_titre', { n: total - liste.length });
        noteExemples.hidden = true;
        var sansFiltre = Object.keys(etat).every(function (k) { return k === 'tri' || !etat[k]; });
        if (!liste.length && !ajout && sansFiltre) {
          // Catalogue encore vide : exemples illustrés, clairement signalés.
          compte.textContent = '';
          noteExemples.hidden = false;
          L.exemples.forEach(function (ex) { grille.appendChild(L.carteExemple(ex)); });
          mur.hidden = !!L.session;
          if (!L.session) murTitre.textContent = t('index.ap.mur_titre');
          return;
        }
        if (!liste.length && !ajout) {
          L.ui.etatVide(grille, t('commun.aucun_resultat'), h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function () { etat = {}; synchroniserForm(form, etat); appliquer(); } }, t('cat.reinitialiser')));
          return;
        }
        var nouvelles = liste.map(function (tn) { return L.carteTenue(tn); });
        nouvelles.forEach(function (c) { grille.appendChild(c); });
        plus.hidden = limite || (page + 1) * PAR_PAGE >= total;
        if (etatFlip && etatFlip.elementStates.length) {
          window.Flip.from(etatFlip, { targets: $$('.carte', grille), duration: 0.6, ease: 'power3.inOut', absolute: true, scale: false, stagger: 0.015,
            onEnter: function (els) { return gsap.fromTo(els, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.03 }); },
            onLeave: function (els) { return gsap.to(els, { opacity: 0, duration: 0.25 }); } });
        } else if (L.motion.actif && window.gsap) {
          gsap.fromTo(nouvelles, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out', clearProps: 'transform' });
        }
      }).catch(function (e) {
        console.error(e);
        L.ui.etatVide(grille, t('commun.erreur'));
      });
    }

    document.addEventListener('lalla:langue', function () { construireFiltres(form, etat); construirePuces($('[data-puces]'), etat, function (cat) { etat.categorie = cat; synchroniserForm(form, etat); appliquer(); }); charger(false); });
    appliquer();
  };

  function num(v) { var n = Number(v); return v === '' || v == null || !isFinite(n) || n <= 0 ? null : n; }

  var CLES_FILTRES = ['categorie', 'occasion', 'taille', 'couleur', 'prix_max', 'ville', 'debut', 'fin', 'poitrine', 'tour_taille', 'hanches', 'longueur', 'q', 'tri', 'boutique', 'cp', 'rayon', 'instant'];

  function lireFiltresUrl() {
    var s = new URLSearchParams(location.search), e = {};
    CLES_FILTRES.forEach(function (k) { if (s.get(k)) e[k] = s.get(k); });
    if (s.get('boutiques')) e.boutique = 'negafa';
    if (e.categorie && C.categories.indexOf(e.categorie) < 0) delete e.categorie;
    return e;
  }

  function ecrireFiltresUrl(e) {
    var s = new URLSearchParams();
    CLES_FILTRES.forEach(function (k) { if (e[k]) s.set(k, e[k]); });
    var q = s.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
  }

  function construirePuces(zone, etat, surChoix) {
    L.vider(zone);
    [''].concat(C.categories).forEach(function (cat) {
      zone.appendChild(h('button', { type: 'button', class: 'puce', 'data-cat': cat, 'aria-pressed': String((etat.categorie || '') === cat), onclick: function () { surChoix(cat || null); } },
        cat ? t('cat.' + cat) : t('cat.tous')));
    });
  }

  function construireFiltres(form, etat) {
    L.vider(form);
    function groupe(cle, contenu) { return h('fieldset', { class: 'filtres__groupe' }, h('legend', null, t(cle)), contenu); }
    form.appendChild(h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'f-q' }, t('cat.recherche')),
      h('input', { id: 'f-q', name: 'q', type: 'search', class: 'champ__controle', value: etat.q || '', placeholder: t('cat.recherche_ph') })));
    form.appendChild(groupe('cat.f_categorie', h('select', { name: 'categorie', class: 'champ__controle', 'aria-label': t('cat.f_categorie') },
      [h('option', { value: '' }, t('cat.tous'))].concat(C.categories.map(function (c) { return h('option', { value: c, selected: etat.categorie === c }, t('cat.' + c)); })))));
    form.appendChild(groupe('cat.f_occasion', h('div', { class: 'choix-pastilles' },
      [['', t('occ.toutes')]].concat(C.occasions.map(function (o) { return [o, t('occ.' + o)]; })).map(function (o) {
        return h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'occasion', value: o[0], checked: (etat.occasion || '') === o[0] }), h('span', null, o[1]));
      }))));
    form.appendChild(groupe('cat.f_date', h('div', { class: 'grille-2' },
      h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'f-debut' }, t('cat.du')), h('input', { id: 'f-debut', name: 'debut', type: 'date', class: 'champ__controle', min: L.aujourdhui(), value: etat.debut || '' })),
      h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'f-fin' }, t('cat.au')), h('input', { id: 'f-fin', name: 'fin', type: 'date', class: 'champ__controle', min: L.aujourdhui(), value: etat.fin || '' })))));
    form.appendChild(groupe('cat.f_pres', h('div', { class: 'grille-2' },
      h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'f-cp' }, t('cat.code_postal')),
        h('input', { id: 'f-cp', name: 'cp', inputmode: 'numeric', maxlength: '4', pattern: '[0-9]{4}', class: 'champ__controle', value: etat.cp || '', placeholder: '1000' })),
      h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'f-rayon' }, t('cat.rayon')),
        h('select', { id: 'f-rayon', name: 'rayon', class: 'champ__controle' },
          [['', t('cat.rayon_tous')], ['10', '10 km'], ['25', '25 km'], ['50', '50 km'], ['100', '100 km']].map(function (o) { return h('option', { value: o[0], selected: (etat.rayon || '') === o[0] }, o[1]); }))))));
    form.appendChild(h('label', { class: 'case' }, h('input', { type: 'checkbox', name: 'instant', value: '1', checked: etat.instant === '1' }), h('span', null, '⚡ ' + t('cat.instantanee'))));
    form.appendChild(groupe('cat.f_ville', h('div', { class: 'choix-pastilles' },
      [['', t('cat.toutes_villes')]].concat(C.villes.map(function (v) { return [v, L.zone(v)]; })).map(function (v) {
        return h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'ville', value: v[0], checked: (etat.ville || '') === v[0] }), h('span', null, v[1]));
      }))));
    form.appendChild(groupe('mes.taille_indicative', h('div', { class: 'choix-pastilles' },
      [['', t('cat.toutes_tailles')]].concat(C.tailles.filter(function (x) { return x !== 'unique'; }).map(function (x) { return [x, x === 'enfant' ? t('cat.enfant') : x]; })).map(function (v) {
        return h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'taille', value: v[0], checked: (etat.taille || '') === v[0] }), h('span', null, v[1]));
      }))));
    form.appendChild(groupe('cat.f_mesures', h('div', null,
      h('p', { class: 'champ__aide', style: { margin: '0 0 10px' } }, t('cat.mesures_aide')),
      h('div', { class: 'grille-2' },
        mesure('poitrine', 'mes.poitrine', etat.poitrine), mesure('tour_taille', 'mes.taille', etat.tour_taille),
        mesure('hanches', 'mes.hanches', etat.hanches), mesure('longueur', 'mes.longueur', etat.longueur)),
      h('button', { type: 'button', class: 'lien', 'data-mes-mesures': '', hidden: !L.session, style: { marginTop: '10px' } }, t('cat.mes_mesures')))));
    var couleurs = h('div', { class: 'filtres__couleurs' });
    couleurs.appendChild(h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'couleur', value: '', checked: !etat.couleur }), h('span', null, t('cat.toutes'))));
    Object.keys(C.couleurs).forEach(function (k) {
      couleurs.appendChild(h('label', { class: 'couleur-pastille', title: t('coul.' + k), style: { background: C.couleurs[k] } },
        h('input', { type: 'radio', name: 'couleur', value: k, checked: etat.couleur === k, 'aria-label': t('coul.' + k) })));
    });
    form.appendChild(groupe('cat.f_couleur', couleurs));
    form.appendChild(groupe('cat.f_budget', h('div', { class: 'champ' },
      h('label', { class: 'champ__libelle', for: 'f-prix' }, t('cat.budget_max')),
      h('input', { id: 'f-prix', name: 'prix_max', type: 'number', inputmode: 'numeric', min: '10', step: '5', class: 'champ__controle', value: etat.prix_max || '', placeholder: '150' }))));
    form.appendChild(groupe('cat.f_vendeuse', h('div', { class: 'choix-pastilles' },
      [['', t('cat.toutes')], ['negafa', t('type.negafa')], ['creatrice', t('type.creatrice')], ['particuliere', t('type.particuliere')]].map(function (v) {
        return h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'boutique', value: v[0], checked: (etat.boutique || '') === v[0] }), h('span', null, v[1]));
      }))));
  }

  function mesure(nom, cle, valeur) {
    return h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'f-' + nom }, t(cle) + ' (cm)'),
      h('input', { id: 'f-' + nom, name: nom, type: 'number', inputmode: 'decimal', min: '30', max: '220', step: '0.5', class: 'champ__controle', value: valeur || '' }));
  }

  function lireFormulaire(form) {
    var e = {}, fd = new FormData(form);
    fd.forEach(function (v, k) { if (v !== '' && v != null) e[k] = String(v); });
    var tri = $('[data-tri]');
    if (tri && tri.value !== 'pertinence') e.tri = tri.value;
    if (e.debut && !e.fin) e.fin = e.debut;
    if (e.debut && e.fin && e.fin < e.debut) e.fin = e.debut;
    return e;
  }

  function synchroniserForm(form, etat) {
    construireFiltres(form, etat);
  }

  // ===========================================================================
  // Fiche tenue
  // ===========================================================================
  L.pages.tenue = function () {
    var id = L.param('id');
    var zone = $('[data-fiche]');
    if (!L.estUuid(id)) { L.ui.etatVide(zone, t('tenue.introuvable'), h('a', { class: 'bouton', href: 'catalogue.html' }, t('nav.catalogue'))); return; }
    if (!L.sb) { L.ui.etatVide(zone, t('commun.erreur')); return; }
    L.ui.chargement(zone);
    Promise.all([
      L.sb.from('tenues').select('*, tenue_photos(id, type, chemin, ordre), fournisseuse:profils!tenues_fournisseuse_id_fkey(id, nom_affiche, boutique_nom, type_fournisseuse, note_moyenne, nb_avis, avatar_chemin, ville, commune, compte_valide, badge_confiance, identite_verifiee, taux_reponse, delai_reponse_h, created_at)').eq('id', id).maybeSingle(),
      L.parametres(),
      L.auth.pret
    ]).then(function (res) {
      var r = res[0], p = res[1];
      if (r.error || !r.data) { L.ui.etatVide(zone, t('tenue.introuvable'), h('a', { class: 'bouton', href: 'catalogue.html' }, t('nav.catalogue'))); return; }
      rendreFiche(zone, r.data, p);
    }).catch(function (e) { console.error(e); L.ui.etatVide(zone, t('commun.erreur')); });
  };

  var ORDRE_PHOTOS = { face: 0, dos: 1, broderie: 2, portee: 3, autre: 4 };

  function photosDe(tn) {
    var photos = (tn.tenue_photos || []).slice().sort(function (a, b) { return (ORDRE_PHOTOS[a.type] - ORDRE_PHOTOS[b.type]) || a.ordre - b.ordre; });
    if (!photos.length) {
      photos = (tn.categorie === 'accessoire' ? ['face', 'portee'] : ['face', 'dos', 'broderie', 'portee']).map(function (v) { return { type: v, chemin: placeholderPour(tn, v) }; });
    }
    return photos;
  }

  function rendreFiche(zone, tn, p) {
    var f = tn.fournisseuse || {};
    var photos = photosDe(tn);
    majSeo(tn, photos);

    // --- Galerie
    var imgPrincipale = h('img', { src: L.img.url(photos[0].chemin), alt: tn.titre + ', ' + t('tenue.photo_' + photos[0].type), width: 900, height: 1200, fetchpriority: 'high' });
    var arche = h('div', { class: 'arche' }, imgPrincipale);
    var loupe = h('div', { class: 'loupe', 'aria-hidden': 'true' });
    var legende = h('p', { class: 'galerie__legende' }, t('tenue.loupe_aide'));
    var vignettes = h('div', { class: 'galerie__vignettes', role: 'tablist', 'aria-label': t('tenue.photos') });
    photos.forEach(function (ph, i) {
      vignettes.appendChild(h('button', { type: 'button', role: 'tab', class: 'galerie__vignette' + (i === 0 ? ' est-actif' : ''), 'aria-selected': String(i === 0), 'aria-label': t('tenue.photo_' + ph.type),
        onclick: function (e) {
          $$('.galerie__vignette', vignettes).forEach(function (v) { v.classList.remove('est-actif'); v.setAttribute('aria-selected', 'false'); });
          e.currentTarget.classList.add('est-actif');
          e.currentTarget.setAttribute('aria-selected', 'true');
          changerImage(L.img.url(ph.chemin), tn.titre + ', ' + t('tenue.photo_' + ph.type));
        } }, h('img', { src: L.img.url(ph.chemin), alt: '', loading: 'lazy' })));
    });
    function changerImage(src, alt) {
      if (!window.gsap || !L.motion.actif) { imgPrincipale.src = src; imgPrincipale.alt = alt; return; }
      gsap.to(imgPrincipale, { opacity: 0, duration: 0.18, onComplete: function () {
        imgPrincipale.src = src; imgPrincipale.alt = alt;
        gsap.fromTo(imgPrincipale, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
      } });
    }
    var galerie = h('div', { class: 'galerie garder' },
      h('div', { class: 'galerie__principale' }, h('div', { class: 'arche-cadre' }, arche), loupe),
      vignettes, legende);
    installerLoupe(arche, imgPrincipale, loupe);

    // --- Informations
    var nomBoutique = f.boutique_nom || f.nom_affiche || '';
    var lienBoutique = carteFournisseuse(f, tn);
    var lieu = h('span', null, (tn.commune ? tn.commune + ', ' : '') + L.zone(tn.ville));
    var cp = L.stockage.lire('lalla.cp', '');
    if (/^[0-9]{4}$/.test(cp) && tn.code_postal) {
      L.sb.rpc('distance_cp', { a: cp, b: tn.code_postal }).then(function (r) { if (r.data != null) lieu.textContent += ' · ' + t('carte.km', { n: r.data }); });
    }

    var mesures = tn.categorie === 'accessoire' ? null : h('table', { class: 'mesures' },
      h('caption', { class: 'sr' }, t('tenue.mesures')),
      h('tbody', null, [['mes.taille_indicative', tn.taille_indicative || ''], ['mes.poitrine', tn.poitrine_cm], ['mes.taille', tn.taille_cm], ['mes.hanches', tn.hanches_cm], ['mes.longueur', tn.longueur_cm], ['mes.manche', tn.manche_cm]].map(function (l) {
        return h('tr', null, h('th', { scope: 'row' }, t(l[0])), h('td', null, typeof l[1] === 'number' || /^\d/.test(String(l[1])) ? String(Number(l[1])) + ' cm' : l[1]));
      })));

    var modes = h('div', { class: 'etiquettes' },
      tn.remise_main_propre ? h('span', { class: 'etiquette' }, t('tenue.main_propre')) : null,
      tn.envoi_assure ? h('span', { class: 'etiquette' }, t('tenue.envoi', { prix: L.euros(tn.frais_envoi_cents) })) : null,
      tn.essayage_possible ? h('span', { class: 'etiquette etiquette--emeraude' }, t('tenue.essayage_possible')) : null,
      (tn.occasions || []).map(function (o) { return h('span', { class: 'etiquette' }, t('occ.' + o)); }));

    var boite = boiteReservation(tn, p);

    var partage = h('button', { type: 'button', class: 'bouton bouton--whatsapp', onclick: function () {
      var url = location.origin + '/t/' + tn.id;
      window.open('https://wa.me/?text=' + encodeURIComponent(t('tenue.partage_texte', { titre: tn.titre }) + ' ' + url), '_blank', 'noopener');
    } }, iconeWhatsapp(), t('tenue.whatsapp'));

    var infos = h('div', { class: 'fiche__infos' },
      h('nav', { class: 'fil', 'aria-label': t('tenue.fil') }, h('a', { href: 'catalogue.html' }, t('nav.catalogue')), h('span', null, h('a', { href: 'catalogue.html?categorie=' + tn.categorie }, libelleCategorie(tn)))),
      h('div', { style: { position: 'relative' } }, h('p', { class: 'surtitre' }, libelleCategorie(tn)), h('h1', { class: 'fiche__titre', style: { paddingRight: '48px' } }, tn.titre),
        h('div', { style: { position: 'absolute', top: '0', right: '0', color: 'var(--encre)' } }, L.favoris.bouton(tn.id)),
        h('p', { class: 'texte', style: { margin: '8px 0 0' } }, noteCourte(f.note_moyenne, f.nb_avis), ' · ', lieu)),
      h('p', { class: 'fiche__prix' }, h('strong', null, L.euros(tn.prix_location_cents, true)), h('span', { class: 'texte' }, t('tenue.par_location', { min: tn.duree_min_jours, max: tn.duree_max_jours }))),
      tn.reservation_instantanee ? h('p', { class: 'eclair', style: { margin: 0 } }, '⚡ ' + t('tenue.instantanee')) : null,
      modes,
      lienBoutique,
      tn.description ? h('div', { class: 'texte', style: { whiteSpace: 'pre-line' } }, tn.description) : null,
      (tn.couleurs || []).length ? h('p', { class: 'texte' }, t('tenue.couleurs') + ' : ' + tn.couleurs.map(function (c) { return t('coul.' + c); }).join(', ')) : null,
      mesures,
      h('p', { class: 'mention-retouche' }, h('span', null, h('strong', null, t('tenue.retouche_titre')), ' ', t('tenue.retouche_texte'))),
      boite,
      h('div', { class: 'actions' }, partage),
      h('button', { type: 'button', class: 'lien-discret', onclick: function () { L.ui.signaler('tenue', tn.id); } }, t('signal.annonce')));

    L.vider(zone).appendChild(h('div', { class: 'fiche' }, galerie, infos));

    // Barre d'action mobile
    var cta = h('div', { class: 'fiche__cta-mobile' },
      h('div', null, h('strong', { style: { fontFamily: 'var(--serif)', fontSize: '1.5rem' } }, L.euros(tn.prix_location_cents, true)), ' ', h('small', { class: 'texte' }, t('commun.par_jour'))),
      h('button', { class: 'bouton', type: 'button', onclick: function () { boite.scrollIntoView({ behavior: L.motion.actif ? 'smooth' : 'auto', block: 'center' }); } }, t('tenue.reserver')));
    document.body.appendChild(cta);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { cta.classList.toggle('est-visible', !e[0].isIntersecting && e[0].boundingClientRect.top > 0); }).observe(boite);
    }

    L.motion.jouerFlip(arche);
    if (window.gsap && L.motion.actif) gsap.from(infos.children, { opacity: 0, y: 18, duration: 0.8, stagger: 0.05, ease: 'power3.out', delay: 0.15 });

    completerLook(tn);
    avisFournisseuse(f.id);
  }

  /** Bloc « Proposée par » : photo, type, commune, note, badges, réactivité, contact. */
  function carteFournisseuse(f, tn) {
    var nom = f.boutique_nom || f.nom_affiche || '';
    var badges = [];
    if (f.badge_confiance) badges.push(h('span', { class: 'badge badge--or' }, t('badge.confiance')));
    if (f.identite_verifiee) badges.push(h('span', { class: 'badge' }, t('badge.identite')));
    var reactivite = f.taux_reponse != null ? t('profil.reponse', { taux: f.taux_reponse, delai: delaiLisible(f.delai_reponse_h) }) : null;
    return h('div', { class: 'hote-carte' },
      h('a', { class: 'hote-carte__photo', href: 'boutique.html?id=' + f.id, 'aria-label': nom }, f.avatar_chemin ? h('img', { src: L.img.url(f.avatar_chemin, 'avatars'), alt: '' }) : (nom[0] || '·').toUpperCase()),
      h('div', null, h('b', null, t('tenue.proposee_par', { nom: nom })),
        h('small', null, t('type.' + (f.type_fournisseuse || 'particuliere')) + ' · ' + (f.commune || L.zone(f.ville) || '') + (f.created_at ? ' · ' + t('profil.depuis', { annee: new Date(f.created_at).getFullYear() }) : '')),
        reactivite ? h('small', null, reactivite) : null,
        badges.length ? h('div', null, badges) : null),
      h('div', { class: 'hote-carte__actions' },
        h('button', { class: 'bouton bouton--sombre bouton--petit', type: 'button', onclick: function () { L.contacter(f.id, tn && tn.id); } }, t('msg.contacter')),
        h('a', { class: 'bouton bouton--ligne bouton--petit', href: 'boutique.html?id=' + f.id }, t('profil.voir'))));
  }
  L.carteFournisseuse = carteFournisseuse;

  function delaiLisible(heures) {
    if (heures == null) return t('profil.delai_inconnu');
    if (heures < 1) return t('profil.delai_heure');
    if (heures < 24) return t('profil.delai_heures', { n: Math.max(1, Math.round(heures)) });
    return t('profil.delai_jour');
  }
  L.delaiLisible = delaiLisible;

  function iconeWhatsapp() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'icone'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.5 8.5c.3-.8.7-.8 1-.8h.6c.2 0 .4 0 .6.5l.8 1.8c.1.3 0 .5-.1.7l-.5.6c-.2.2-.2.4 0 .7.6 1 1.4 1.8 2.5 2.3.3.1.5.1.7-.1l.7-.8c.2-.2.4-.3.7-.2l1.8.8c.3.1.4.3.4.5 0 .5-.2 1.4-1 1.8-.7.4-2 .4-3.6-.3-2.1-.9-3.7-2.8-4.4-4.2-.6-1.1-.5-2.4-.2-3.3z" fill="currentColor"/>';
    return s;
  }

  /** Loupe fluide : survol sur desktop, appui long sur mobile. Animation via transform uniquement. */
  function installerLoupe(arche, img, loupe) {
    var zoom = 2.6, actif = false, minuterie = null;
    var conteneur = loupe.parentElement;
    var dx = window.gsap ? gsap.quickTo(loupe, 'x', { duration: 0.25, ease: 'power3' }) : null;
    var dy = window.gsap ? gsap.quickTo(loupe, 'y', { duration: 0.25, ease: 'power3' }) : null;
    function position(clientX, clientY) {
      var r = img.getBoundingClientRect(), c = conteneur.getBoundingClientRect();
      var px = Math.min(Math.max(clientX - r.left, 0), r.width), py = Math.min(Math.max(clientY - r.top, 0), r.height);
      var lw = loupe.offsetWidth;
      loupe.style.backgroundImage = 'url("' + img.currentSrc.replace(/"/g, '%22') + '")';
      loupe.style.backgroundSize = (r.width * zoom) + 'px ' + (r.height * zoom) + 'px';
      loupe.style.backgroundPosition = (-(px * zoom - lw / 2)) + 'px ' + (-(py * zoom - lw / 2)) + 'px';
      var x = clientX - c.left, y = clientY - c.top - (actif === 'tactile' ? lw * 0.75 : 0);
      if (dx && L.motion.actif) { dx(x); dy(y); } else { loupe.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)'; }
    }
    function montrer(mode, x, y) {
      actif = mode;
      if (window.gsap) { gsap.set(loupe, { x: x - conteneur.getBoundingClientRect().left, y: y - conteneur.getBoundingClientRect().top, xPercent: -50, yPercent: -50 }); }
      position(x, y);
      if (window.gsap) gsap.to(loupe, { opacity: 1, scale: 1, duration: L.motion.actif ? 0.3 : 0, ease: 'power3.out' });
      else loupe.style.opacity = 1;
    }
    function cacher() {
      actif = false;
      if (window.gsap) gsap.to(loupe, { opacity: 0, scale: 0.6, duration: L.motion.actif ? 0.25 : 0, ease: 'power2.in' });
      else loupe.style.opacity = 0;
    }
    // Desktop : survol (souris uniquement)
    arche.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') montrer('souris', e.clientX, e.clientY); });
    arche.addEventListener('pointermove', function (e) { if (actif) position(e.clientX, e.clientY); });
    arche.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') cacher(); });
    // Mobile : appui long (350 ms), le défilement est bloqué pendant l'appui
    arche.addEventListener('touchstart', function (e) {
      var tc = e.touches[0];
      clearTimeout(minuterie);
      minuterie = setTimeout(function () { montrer('tactile', tc.clientX, tc.clientY); if (navigator.vibrate) navigator.vibrate(8); }, 350);
    }, { passive: true });
    arche.addEventListener('touchmove', function (e) {
      if (actif === 'tactile') { e.preventDefault(); position(e.touches[0].clientX, e.touches[0].clientY); }
      else clearTimeout(minuterie);
    }, { passive: false });
    ['touchend', 'touchcancel'].forEach(function (ev) { arche.addEventListener(ev, function () { clearTimeout(minuterie); if (actif === 'tactile') cacher(); }); });
    arche.addEventListener('contextmenu', function (e) { if (actif) e.preventDefault(); });
  }

  /** Boîte de réservation : dates, disponibilité, estimation, ajout au panier, essayage. */
  function boiteReservation(tn, p) {
    if (p.reservations_ouvertes !== true) return boitePreLancement(tn, p);
    var panier = L.panier.lire();
    var dates = panier.dates || {};
    var dispo = h('p', { class: 'disponibilite', 'aria-live': 'polite' }, t('tenue.choisir_dates'));
    var recap = h('div', { class: 'recap' });
    var evenement = h('input', { type: 'date', name: 'evenement', class: 'champ__controle', min: L.ajouterJours(L.aujourdhui(), 2), value: dates.evenement || '', required: true, id: 'r-evt' });
    var debut = h('input', { type: 'date', name: 'debut', class: 'champ__controle', min: L.ajouterJours(L.aujourdhui(), 1), value: dates.debut || '', required: true, id: 'r-debut' });
    var fin = h('input', { type: 'date', name: 'fin', class: 'champ__controle', min: L.ajouterJours(L.aujourdhui(), 2), value: dates.fin || '', required: true, id: 'r-fin' });
    var mode = h('select', { name: 'mode', class: 'champ__controle', id: 'r-mode' },
      tn.remise_main_propre ? h('option', { value: 'main_propre' }, t('tenue.main_propre')) : null,
      tn.envoi_assure ? h('option', { value: 'envoi' }, t('tenue.envoi', { prix: L.euros(tn.frais_envoi_cents) })) : null);
    var bouton = h('button', { class: 'bouton bouton--plein', type: 'submit' }, t(tn.reservation_instantanee ? 'tenue.ajouter_instantane' : 'tenue.ajouter_panier'));
    var dejaDansPanier = L.panier.contient(tn.id);
    if (dejaDansPanier) bouton.textContent = t('tenue.deja_panier');
    var form = h('form', { class: 'reservation-boite', novalidate: true },
      h('h2', { style: { fontSize: '1.6rem', margin: 0 } }, t('tenue.reserver_titre')),
      h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'r-evt' }, t('tenue.date_evenement')), evenement),
      h('div', { class: 'grille-2' },
        h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'r-debut' }, t('tenue.date_debut')), debut),
        h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'r-fin' }, t('tenue.date_fin')), fin)),
      h('div', { class: 'champ' }, h('label', { class: 'champ__libelle', for: 'r-mode' }, t('tenue.mode_remise')), mode),
      dispo, recap, bouton,
      tn.essayage_possible ? h('button', { class: 'bouton bouton--ligne bouton--plein', type: 'button', onclick: function () { L.essayage(tn, p); } }, t('tenue.essayer', { prix: L.euros(p.frais_essayage_cents) })) : null,
      h('button', { class: 'lien', type: 'button', style: { justifySelf: 'center', fontSize: '13px' }, onclick: function () { L.showrooms(tn); } }, t('tenue.showroom_lien')));

    evenement.addEventListener('change', function () {
      if (evenement.value && !debut.value) debut.value = L.ajouterJours(evenement.value, -1);
      if (evenement.value && !fin.value) fin.value = L.ajouterJours(evenement.value, Math.max(1, tn.duree_min_jours - 1));
      verifier();
    });
    debut.addEventListener('change', verifier);
    fin.addEventListener('change', verifier);
    mode.addEventListener('change', verifier);

    var ok = false;
    function verifier() {
      ok = false;
      L.vider(recap);
      if (!evenement.value || !debut.value || !fin.value) { dispo.className = 'disponibilite'; dispo.textContent = t('tenue.choisir_dates'); return; }
      var duree = Math.round((new Date(fin.value) - new Date(debut.value)) / 86400000);
      if (debut.value > evenement.value || fin.value < evenement.value) { dispo.className = 'disponibilite disponibilite--non'; dispo.textContent = t('tenue.dates_incoherentes'); return; }
      if (duree < tn.duree_min_jours || duree > tn.duree_max_jours) { dispo.className = 'disponibilite disponibilite--non'; dispo.textContent = t('tenue.duree_hors', { min: tn.duree_min_jours, max: tn.duree_max_jours }); return; }
      dispo.className = 'disponibilite'; dispo.textContent = t('tenue.verification');
      L.sb.rpc('tenue_disponible', { p_tenue: tn.id, p_debut: debut.value, p_fin: fin.value }).then(function (r) {
        if (r.error) { dispo.textContent = t('commun.erreur'); return; }
        ok = r.data === true;
        dispo.className = 'disponibilite disponibilite--' + (ok ? 'oui' : 'non');
        dispo.textContent = ok ? t('tenue.disponible') : t('tenue.indisponible');
        if (ok) estimation();
      });
    }
    function estimation() {
      var pressing = tn.categorie === 'accessoire' ? 0 : Number(p.frais_pressing_cents);
      var envoi = mode.value === 'envoi' ? tn.frais_envoi_cents : 0;
      var service = Math.round(tn.prix_location_cents * Number(p.frais_service_taux));
      var caution = Math.round(tn.valeur_declaree_cents * Number(p.caution_taux));
      L.vider(recap);
      [['tenue.r_location', tn.prix_location_cents], ['tenue.r_pressing', pressing], ['tenue.r_envoi', envoi], ['tenue.r_service', service]].forEach(function (l) {
        if (l[1] || l[0] === 'tenue.r_location') recap.appendChild(h('div', { class: 'recap__ligne' }, h('span', null, t(l[0])), h('span', null, L.euros(l[1]))));
      });
      recap.appendChild(h('div', { class: 'recap__ligne recap__ligne--total' }, h('span', null, t('tenue.r_total')), h('span', null, L.euros(tn.prix_location_cents + pressing + envoi + service))));
      recap.appendChild(h('div', { class: 'recap__ligne recap__ligne--note' }, h('span', null, t('tenue.r_caution')), h('span', null, L.euros(caution))));
      recap.appendChild(h('p', { class: 'recap__ligne--note', style: { margin: '4px 0 0' } }, t('tenue.r_note')));
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (L.panier.contient(tn.id)) { location.href = 'panier.html'; return; }
      if (!ok) { verifier(); dispo.focus && dispo.scrollIntoView({ block: 'center' }); return; }
      var pan = L.panier.lire();
      var nouvellesDates = { evenement: evenement.value, debut: debut.value, fin: fin.value };
      if (pan.articles.length && pan.dates && (pan.dates.debut !== debut.value || pan.dates.fin !== fin.value || pan.dates.evenement !== evenement.value)) {
        L.ui.toast(t('tenue.dates_panier_maj'));
      }
      L.panier.definirDates(nouvellesDates);
      L.panier.ajouter({ tenue_id: tn.id, titre: tn.titre, fournisseuse_id: tn.fournisseuse_id, fournisseuse_nom: (tn.fournisseuse && (tn.fournisseuse.boutique_nom || tn.fournisseuse.nom_affiche)) || '',
        prix_location_cents: tn.prix_location_cents, categorie: tn.categorie, sous_categorie: tn.sous_categorie, couleurs: tn.couleurs, photo: (photosDe(tn)[0] || {}).chemin, mode_remise: mode.value });
      bouton.textContent = t('tenue.deja_panier');
      L.ui.toast(t('tenue.ajoute'), 'succes');
      if (window.gsap && L.motion.actif) gsap.fromTo('.panier-lien', { scale: 1 }, { scale: 1.25, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' });
    });
    if (evenement.value) setTimeout(verifier, 0);
    return form;
  }

  /** Pré-lancement : à la place du formulaire de réservation, favoris et question à la fournisseuse. */
  function boitePreLancement(tn, p) {
    var favori = h('button', { class: 'bouton bouton--plein', type: 'button' }, t('lanc.favori'));
    favori.addEventListener('click', function () {
      if (!L.session) { L.ui.authentification('inscription'); return; }
      favori.disabled = true;
      L.sb.from('favoris').insert({ tenue_id: tn.id }).then(function (r) {
        if (r.error && r.error.code !== '23505') { favori.disabled = false; L.ui.toast(L.messageErreur(r.error), 'erreur'); return; }
        favori.textContent = t('favori.ajoute');
        L.ui.toast(t('lanc.favori_ok'), 'succes');
      });
    });
    return h('div', { class: 'reservation-boite reservation-boite--lancement' },
      h('p', { class: 'surtitre' }, t('lanc.surtitre')),
      h('h2', { style: { fontSize: '1.6rem', margin: 0 } }, t('lanc.titre')),
      h('p', { class: 'texte' }, t('lanc.texte')),
      favori,
      h('button', { class: 'bouton bouton--ligne bouton--plein', type: 'button', onclick: function () { L.contacter(tn.fournisseuse_id, tn.id); } }, t('lanc.question')));
  }

  /** Demande d'essayage chez la fournisseuse (frais payés via Stripe Checkout). */
  L.essayage = function (tn, p) {
    L.auth.exiger('connexion').then(function () {
      var retour = h('div');
      var form = h('form', { class: 'formulaire' },
        h('p', { class: 'texte' }, t('essai.intro', { prix: L.euros(p.frais_essayage_cents) })),
        L.ui.champ('creneau', 'essai.creneau', { type: 'datetime-local', required: true, min: L.ajouterJours(L.aujourdhui(), 1) + 'T09:00' }),
        L.ui.champ('message', 'essai.message', { tag: 'textarea', maxlength: 500, aide: t('commun.facultatif') }),
        L.ui.honeypot(), retour,
        h('button', { class: 'bouton bouton--plein', type: 'submit' }, t('essai.payer', { prix: L.euros(p.frais_essayage_cents) })));
      var m = L.ui.modale(form, { titre: t('essai.titre') });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        var b = form.querySelector('[type=submit]');
        b.disabled = true;
        L.api('essayage-creer', { tenue_id: tn.id, type: 'chez_fournisseuse', creneau: new Date(form.creneau.value).toISOString(), message: form.message.value, site_web: form.site_web.value })
          .then(function (r) { if (r.url) location.href = r.url; else { m.fermer(); L.ui.toast(t('essai.envoye'), 'succes'); } })
          .catch(function (err) { b.disabled = false; L.vider(retour).appendChild(h('p', { class: 'message message--erreur' }, L.messageErreur(err))); });
      });
    }).catch(function () {});
  };

  /** Showrooms à venir : inscription avec sélection de pièces. */
  L.showrooms = function (tn) {
    var contenu = h('div');
    var m = L.ui.modale(contenu, { titre: t('showroom.titre'), large: true });
    L.ui.chargement(contenu);
    L.sb.from('showrooms').select('*').eq('actif', true).gt('fin', new Date().toISOString()).order('debut').then(function (r) {
      L.vider(contenu);
      var liste = r.data || [];
      if (!liste.length) { L.ui.etatVide(contenu, t('showroom.aucun')); return; }
      contenu.appendChild(h('p', { class: 'texte' }, t('showroom.intro')));
      liste.forEach(function (s) {
        contenu.appendChild(h('div', { class: 'ligne-resa' },
          h('div', { class: 'ligne-resa__tete' }, h('h3', { class: 'ligne-resa__titre' }, s.titre), h('span', { class: 'statut' }, L.zone(s.ville))),
          h('p', { class: 'texte', style: { margin: 0 } }, L.dateHeure(s.debut) + ' → ' + L.date(s.fin, { hour: '2-digit', minute: '2-digit' }) + ' · ' + s.lieu + ', ' + s.adresse),
          h('div', null, h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function (e) {
            var b = e.currentTarget;
            L.auth.exiger('connexion').then(function () {
              b.disabled = true;
              return L.api('showroom-inscrire', { showroom_id: s.id, tenue_ids: tn ? [tn.id] : [], site_web: '' });
            }).then(function (r) { if (r && r.url) { location.href = r.url; return; } m.fermer(); L.ui.toast(t('showroom.inscrite'), 'succes'); })
              .catch(function (err) { b.disabled = false; if (err.code !== 'non_connecte') L.ui.toast(L.messageErreur(err), 'erreur'); });
          } }, t('showroom.inscrire')))));
      });
    });
  };

  function majSeo(tn, photos) {
    var titre = t('tenue.seo_titre', { titre: tn.titre, categorie: libelleCategorie(tn), ville: L.zone(tn.ville) });
    document.title = titre;
    var desc = (tn.description || '').slice(0, 150) || t('tenue.seo_desc', { titre: tn.titre, ville: L.zone(tn.ville) });
    var meta = function (sel, attr, val) { var m = $(sel); if (m) m.setAttribute(attr, val); };
    meta('meta[name=description]', 'content', desc);
    meta('meta[property="og:title"]', 'content', titre);
    meta('meta[property="og:description"]', 'content', desc);
    meta('link[rel=canonical]', 'href', location.origin + '/tenue.html?id=' + tn.id);
    // schema.org Product + Offer
    var ld = {
      '@context': 'https://schema.org', '@type': 'Product', name: tn.titre, description: desc, category: libelleCategorie(tn),
      image: photos.filter(function (p) { return p.chemin.indexOf('placeholder:') !== 0; }).map(function (p) { return L.img.url(p.chemin); }),
      brand: { '@type': 'Brand', name: (tn.fournisseuse && (tn.fournisseuse.boutique_nom || tn.fournisseuse.nom_affiche)) || C.brand.name },
      offers: { '@type': 'Offer', priceCurrency: 'EUR', price: (tn.prix_location_cents / 100).toFixed(2), availability: 'https://schema.org/InStock',
        url: location.origin + '/tenue.html?id=' + tn.id, areaServed: tn.ville, businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut' }
    };
    if (tn.fournisseuse && tn.fournisseuse.nb_avis) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: tn.fournisseuse.note_moyenne, reviewCount: tn.fournisseuse.nb_avis };
    var s = $('#ld-produit') || document.head.appendChild(h('script', { type: 'application/ld+json', id: 'ld-produit' }));
    s.textContent = JSON.stringify(ld);
  }

  /** « Compléter le look » : accessoires de la même fournisseuse d'abord, puis des autres. */
  function completerLook(tn) {
    var zone = $('[data-look]');
    if (!zone || tn.categorie === 'accessoire') { if (zone) zone.closest('section').hidden = true; return; }
    var grille = $('[data-look-grille]', zone);
    Promise.all([
      L.sb.from('ensembles').select('accessoire_id').eq('tenue_id', tn.id),
      rechercher({ p_categorie: 'accessoire', p_fournisseuse: tn.fournisseuse_id, p_limite: 8 }),
      rechercher({ p_categorie: 'accessoire', p_ville: tn.ville, p_limite: 12 })
    ]).then(function (res) {
      var ensemble = (res[0].data || []).map(function (e) { return e.accessoire_id; });
      var memes = res[1].sort(function (a, b) { return (ensemble.indexOf(b.id) >= 0) - (ensemble.indexOf(a.id) >= 0); });
      var ids = memes.map(function (x) { return x.id; });
      var autres = res[2].filter(function (x) { return ids.indexOf(x.id) < 0; });
      var liste = memes.concat(autres).slice(0, 8);
      if (!liste.length) { zone.hidden = true; return; }
      liste.forEach(function (a) {
        var dansEnsemble = ensemble.indexOf(a.id) >= 0;
        var ajout = h('button', { class: 'bouton bouton--ligne bouton--petit look__ajout', type: 'button', onclick: function (e) {
          e.preventDefault();
          var pan = L.panier.lire();
          if (!pan.dates) { L.ui.toast(t('look.dates_dabord')); $('.reservation-boite').scrollIntoView({ block: 'center' }); return; }
          if (L.panier.ajouter({ tenue_id: a.id, titre: a.titre, fournisseuse_id: a.fournisseuse_id, fournisseuse_nom: a.fournisseuse_nom, prix_location_cents: a.prix_location_cents, categorie: a.categorie, sous_categorie: a.sous_categorie, couleurs: a.couleurs, photo: a.photo, mode_remise: 'main_propre' })) {
            e.currentTarget.textContent = t('tenue.deja_panier');
            L.ui.toast(t('tenue.ajoute'), 'succes');
          }
        } }, L.panier.contient(a.id) ? t('tenue.deja_panier') : t('look.ajouter'));
        var c = L.carteTenue(a, { extra: h('div', null, dansEnsemble ? h('span', { class: 'etiquette etiquette--emeraude' }, t('look.ensemble')) : (a.fournisseuse_id === tn.fournisseuse_id ? h('span', { class: 'etiquette' }, t('look.meme')) : null), ajout) });
        c.setAttribute('data-reveal', '');
        grille.appendChild(c);
      });
      L.motion.reveler(grille);
    });
  }

  function avisFournisseuse(id) {
    var zone = $('[data-avis]');
    if (!zone || !id) return;
    L.sb.from('avis').select('note, commentaire, created_at').eq('cible_id', id).eq('sens', 'cliente_vers_fournisseuse').order('created_at', { ascending: false }).limit(4).then(function (r) {
      var liste = r.data || [];
      if (!liste.length) { zone.hidden = true; return; }
      var l = $('[data-avis-liste]', zone);
      liste.forEach(function (a) { l.appendChild(rendreAvis(a)); });
    });
  }

  function rendreAvis(a) {
    return h('article', { class: 'avis' },
      h('div', { class: 'avis__tete' }, h('span', { class: 'note', 'aria-label': a.note + '/5' }, '★★★★★'.slice(0, a.note) + '☆☆☆☆☆'.slice(0, 5 - a.note)), h('time', { datetime: a.created_at }, L.date(a.created_at))),
      a.commentaire ? h('p', { style: { margin: '6px 0 0' } }, a.commentaire) : null);
  }
  L.rendreAvis = rendreAvis;

  // ===========================================================================
  // Boutique publique (negafas et créatrices)
  // ===========================================================================
  L.pages.boutique = function () {
    var id = L.param('id');
    var zone = $('[data-boutique]');
    if (!L.estUuid(id) || !L.sb) { L.ui.etatVide(zone, t('boutique.introuvable')); return; }
    L.ui.chargement(zone);
    Promise.all([
      L.sb.from('profils').select('id, nom_affiche, boutique_nom, boutique_bio, type_fournisseuse, ville, commune, note_moyenne, nb_avis, avatar_chemin, est_fournisseuse, compte_valide, created_at, badge_confiance, identite_verifiee, taux_reponse, delai_reponse_h, langues').eq('id', id).maybeSingle(),
      rechercher({ p_fournisseuse: id, p_limite: 60 }),
      L.sb.from('avis').select('note, commentaire, created_at').eq('cible_id', id).eq('sens', 'cliente_vers_fournisseuse').order('created_at', { ascending: false }).limit(10)
    ]).then(function (res) {
      var p = res[0].data, tenues = res[1], avis = res[2].data || [];
      if (!p || !p.est_fournisseuse) { L.ui.etatVide(zone, t('boutique.introuvable')); return; }
      var nom = p.boutique_nom || p.nom_affiche;
      document.title = t('boutique.seo_titre', { nom: nom, type: t('type.' + p.type_fournisseuse), ville: L.zone(p.ville) });
      var mdesc = $('meta[name=description]');
      if (mdesc) mdesc.setAttribute('content', (p.boutique_bio || '').slice(0, 150) || t('boutique.seo_desc', { nom: nom }));
      var ld = { '@context': 'https://schema.org', '@type': 'Store', name: nom, address: { '@type': 'PostalAddress', addressLocality: p.ville || '', addressCountry: 'BE' } };
      if (p.nb_avis) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: p.note_moyenne, reviewCount: p.nb_avis };
      document.head.appendChild(h('script', { type: 'application/ld+json', text: JSON.stringify(ld) }));
      var grille = h('div', { class: 'grille-cartes' });
      tenues.forEach(function (tn) { var c = L.carteTenue(tn); c.setAttribute('data-reveal', ''); grille.appendChild(c); });
      var initiale = (nom[0] || '·').toUpperCase();
      var langues = (p.langues || []).map(function (l) { return t('langue.' + l); }).join(', ');
      var faits = [
        p.commune || p.ville ? '📍 ' + (p.commune ? p.commune + ', ' : '') + L.zone(p.ville) : null,
        p.taux_reponse != null ? '💬 ' + t('profil.reponse', { taux: p.taux_reponse, delai: L.delaiLisible(p.delai_reponse_h) }) : null,
        langues ? '🗣 ' + t('profil.langues', { langues: langues }) : null,
        p.identite_verifiee ? '✓ ' + t('badge.identite') : null
      ].filter(Boolean);
      L.vider(zone).appendChild(h('div', null,
        h('header', { class: 'profil-entete' },
          h('div', { class: 'profil-carte' },
            h('div', { class: 'profil-carte__photo' }, p.avatar_chemin ? h('img', { src: L.img.url(p.avatar_chemin, 'avatars'), alt: '' }) : initiale),
            h('h1', null, nom),
            h('p', { class: 'texte', style: { margin: '4px 0 0' } }, t('type.' + p.type_fournisseuse)),
            p.badge_confiance ? h('span', { class: 'badge badge--or' }, t('badge.confiance')) : null,
            h('div', { class: 'profil-chiffres' },
              h('div', null, h('strong', null, String(p.nb_avis || 0)), h('span', null, t('profil.avis'))),
              h('div', null, h('strong', null, p.nb_avis ? Number(p.note_moyenne).toFixed(1).replace('.', ',') + '★' : '·'), h('span', null, t('profil.note'))),
              h('div', null, h('strong', null, String(new Date().getFullYear() - new Date(p.created_at).getFullYear() || 1)), h('span', null, t('profil.annees'))))),
          h('div', null,
            h('h2', { style: { marginTop: 0 } }, t('profil.a_propos', { nom: nom })),
            h('ul', { class: 'profil-faits' }, faits.map(function (x) { return h('li', null, x); })),
            p.boutique_bio ? h('p', { class: 'chapeau', style: { whiteSpace: 'pre-line' } }, p.boutique_bio) : h('p', { class: 'texte' }, t('profil.bio_vide')),
            h('div', { class: 'actions' },
              h('button', { class: 'bouton', type: 'button', onclick: function () { L.contacter(p.id); } }, t('msg.contacter_nom', { nom: nom })),
              h('button', { class: 'lien-discret', type: 'button', onclick: function () { L.ui.signaler('profil', p.id); } }, t('signal.profil'))))),
        h('section', { class: 'section', style: { paddingTop: '48px' } }, h('h2', null, t('profil.annonces', { nom: nom })),
          tenues.length ? grille : h('p', { class: 'texte' }, t('boutique.vide'))),
        avis.length ? h('section', { class: 'section', style: { paddingTop: 0 } }, h('h2', null, t('boutique.avis_titre')), h('div', { class: 'avis-liste' }, avis.map(rendreAvis))) : null));
      L.motion.reveler(zone);
      if (window.gsap && L.motion.actif) L.motion.titreLignes($('h1', zone), 0.1);
    }).catch(function (e) { console.error(e); L.ui.etatVide(zone, t('commun.erreur')); });
  };

  // ===========================================================================
  // Panier, demandes, paiement, identité, caution
  // ===========================================================================
  L.pages.panier = function () {
    var zone = $('[data-panier]');
    var id = L.param('commande');
    if (L.estUuid(id)) suiviCommande(zone, id);
    else panierLocal(zone);
  };

  function etapes(actif) {
    var noms = ['panier.e_demandes', 'panier.e_paiement', 'panier.e_caution', 'panier.e_remise'];
    return h('ol', { class: 'etapes', 'aria-label': t('panier.progression') }, noms.map(function (n, i) {
      return h('li', { class: i < actif ? 'est-fait' : i === actif ? 'est-actif' : '', 'aria-current': i === actif ? 'step' : null }, t(n));
    }));
  }

  function panierLocal(zone) {
    var pan = L.panier.lire();
    L.vider(zone);
    if (!pan.articles.length) {
      L.ui.etatVide(zone, t('panier.vide'), h('a', { class: 'bouton', href: 'catalogue.html' }, t('index.hero.cta')));
      return;
    }
    L.parametres().then(function (p) { rendre(p); });

    function rendre(p) {
      pan = L.panier.lire();
      L.vider(zone);
      if (!pan.articles.length) { panierLocal(zone); return; }
      var groupes = {};
      pan.articles.forEach(function (a) { (groupes[a.fournisseuse_id] = groupes[a.fournisseuse_id] || []).push(a); });
      var liste = h('div');
      var totalLocation = 0, pressing = 0;
      Object.keys(groupes).forEach(function (fid) {
        var arts = groupes[fid];
        liste.appendChild(h('section', { class: 'groupe-fournisseuse' },
          h('div', { class: 'groupe-fournisseuse__tete' }, h('strong', null, arts[0].fournisseuse_nom || t('role.fournisseuse')), h('span', { class: 'texte' }, t('panier.une_demande'))),
          arts.map(function (a) {
            totalLocation += a.prix_location_cents;
            if (a.categorie !== 'accessoire') pressing += Number(p.frais_pressing_cents);
            return h('div', { class: 'article' },
              h('a', { class: 'article__visuel', href: 'tenue.html?id=' + a.tenue_id }, h('div', { class: 'arche' }, L.img.element(a.photo || L.placeholderPour({ id: a.tenue_id, categorie: a.categorie, sous_categorie: a.sous_categorie, couleurs: a.couleurs }, 'face'), ''))),
              h('div', null, h('p', { class: 'article__titre' }, a.titre), h('p', { class: 'article__meta' }, L.libelleCategorie(a) + ' · ' + L.euros(a.prix_location_cents) + ' · ' + t(a.mode_remise === 'envoi' ? 'panier.envoi' : 'tenue.main_propre'))),
              h('button', { class: 'lien', type: 'button', 'aria-label': t('panier.retirer') + ' ' + a.titre, onclick: function () { L.panier.retirer(a.tenue_id); rendre(p); } }, t('panier.retirer')));
          })));
      });
      var service = Math.round(totalLocation * Number(p.frais_service_taux));
      var dates = pan.dates || {};
      var aEnvoi = pan.articles.some(function (a) { return a.mode_remise === 'envoi'; });
      var retour = h('div');
      var form = h('form', { class: 'formulaire panneau', novalidate: true },
        h('h2', { class: 'panneau__titre' }, t('panier.vos_dates')),
        h('div', { class: 'grille-3' },
          L.ui.champ('evenement', 'tenue.date_evenement', { type: 'date', required: true, value: dates.evenement || '', min: L.ajouterJours(L.aujourdhui(), 2) }),
          L.ui.champ('debut', 'tenue.date_debut', { type: 'date', required: true, value: dates.debut || '', min: L.ajouterJours(L.aujourdhui(), 1) }),
          L.ui.champ('fin', 'tenue.date_fin', { type: 'date', required: true, value: dates.fin || '', min: L.ajouterJours(L.aujourdhui(), 2) })),
        aEnvoi ? L.ui.champ('adresse', 'panier.adresse', { tag: 'textarea', required: true, maxlength: 300, autocomplete: 'street-address' }) : null,
        pan.articles.some(function (a) { return a.mode_remise !== 'envoi'; }) ? L.ui.champ('creneau', 'panier.creneau', { type: 'datetime-local', aide: t('panier.creneau_aide') }) : null,
        L.ui.champ('message', 'panier.message', { tag: 'textarea', maxlength: 1000, aide: t('commun.facultatif') }),
        h('div', { 'data-mensurations': '' }),
        L.ui.honeypot(), retour,
        h('button', { class: 'bouton bouton--plein', type: 'submit' }, t('panier.envoyer')),
        h('p', { class: 'champ__aide', style: { textAlign: 'center' } }, t('panier.envoyer_aide')));
      var resume = h('aside', { class: 'panier__resume panneau' },
        h('h2', { class: 'panneau__titre' }, t('panier.resume')),
        h('div', { class: 'recap' },
          ligneRecap('tenue.r_location', totalLocation), ligneRecap('tenue.r_pressing', pressing), ligneRecap('tenue.r_service', service),
          h('div', { class: 'recap__ligne recap__ligne--total' }, h('span', null, t('tenue.r_total')), h('span', null, L.euros(totalLocation + pressing + service))),
          h('p', { class: 'recap__ligne--note' }, t('panier.resume_note'))));
      if (p.reservations_ouvertes !== true) {
        form = h('div', { class: 'panneau' }, h('h2', { class: 'panneau__titre' }, t('lanc.titre')), h('p', { class: 'texte' }, t('lanc.panier')),
          h('a', { class: 'bouton bouton--ligne', href: 'catalogue.html' }, t('index.ap.explorer')));
      }
      zone.appendChild(etapes(0));
      zone.appendChild(h('div', { class: 'panier' }, h('div', null, liste, form), resume));
      if (p.reservations_ouvertes !== true) return;
      blocMensurations($('[data-mensurations]', form));

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        if (L.ui.estRobot(form)) return;
        L.auth.exiger('inscription').then(function () {
          var b = form.querySelector('[type=submit]');
          b.disabled = true;
          L.panier.definirDates({ evenement: form.evenement.value, debut: form.debut.value, fin: form.fin.value });
          return L.api('commande-creer', {
            articles: L.panier.lire().articles.map(function (a) { return { tenue_id: a.tenue_id, mode_remise: a.mode_remise }; }),
            evenement: form.evenement.value, debut: form.debut.value, fin: form.fin.value,
            adresse_envoi: form.adresse ? form.adresse.value : null, message: form.message.value, site_web: form.site_web.value,
            creneau: form.creneau && form.creneau.value ? new Date(form.creneau.value).toISOString() : null
          }).then(function (r) {
            L.panier.vider();
            location.href = 'panier.html?commande=' + r.commande_id + '&envoye=1';
          }).catch(function (err) {
            b.disabled = false;
            L.vider(retour).appendChild(h('p', { class: 'message message--erreur', role: 'alert' }, L.messageErreur(err)));
          });
        }).catch(function () {});
      });
    }
  }

  function ligneRecap(cle, montant) {
    return h('div', { class: 'recap__ligne' }, h('span', null, t(cle)), h('span', null, L.euros(montant)));
  }

  /** Mensurations : visibles uniquement par les fournisseuses qui reçoivent une demande. */
  function blocMensurations(zone) {
    L.auth.pret.then(function () {
      if (!L.session) { zone.appendChild(h('p', { class: 'message' }, t('panier.mensurations_connexion'))); return; }
      L.sb.from('mensurations').select('*').eq('user_id', L.session.user.id).maybeSingle().then(function (r) {
        var m = r.data || {};
        var champs = [['poitrine_cm', 'mes.poitrine'], ['taille_cm', 'mes.taille'], ['hanches_cm', 'mes.hanches'], ['longueur_cm', 'mes.longueur'], ['manche_cm', 'mes.manche'], ['hauteur_cm', 'mes.hauteur']];
        var etat = h('span', { class: 'champ__aide' });
        var details = h('details', { class: 'panneau', style: { margin: 0, padding: '16px' }, open: !r.data || null },
          h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, t('panier.mensurations_titre')),
          h('p', { class: 'champ__aide' }, t('panier.mensurations_aide')),
          h('div', { class: 'grille-3' }, champs.map(function (c) {
            return L.ui.champ(c[0], t(c[1]) + ' (cm)', { type: 'number', inputmode: 'decimal', step: '0.5', min: '10', max: '230', value: m[c[0]] || '' });
          })),
          h('div', { class: 'actions' }, h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () {
            var o = { user_id: L.session.user.id };
            champs.forEach(function (c) { var v = details.querySelector('[name=' + c[0] + ']').value; o[c[0]] = v ? Number(v) : null; });
            L.sb.from('mensurations').upsert(o).then(function (res) {
              etat.textContent = res.error ? L.messageErreur(res.error) : t('commun.enregistre');
            });
          } }, t('panier.mensurations_enregistrer')), etat));
        zone.appendChild(details);
      });
    });
  }

  function suiviCommande(zone, id) {
    L.ui.chargement(zone);
    var tentatives = 0;
    L.auth.exiger('connexion').then(charger).catch(function () { L.ui.etatVide(zone, t('commun.connexion_requise')); });

    function charger() {
      return Promise.all([
        L.sb.from('commandes').select('*').eq('id', id).maybeSingle(),
        L.sb.from('reservations').select('*, reservation_lignes(titre_snapshot, prix_location_cents, caution_cents, tenue_id), fournisseuse:profils!reservations_fournisseuse_id_fkey(nom_affiche, boutique_nom)').eq('commande_id', id).order('created_at')
      ]).then(function (res) {
        var c = res[0].data, resas = res[1].data || [];
        if (!c) { L.ui.etatVide(zone, t('panier.commande_introuvable')); return; }
        // Retour de Stripe : le webhook peut avoir quelques secondes de retard
        var attendPaiement = L.param('paiement') === 'ok' && c.statut === 'a_payer';
        var attendCarte = L.param('caution') === 'ok' && resas.some(function (r) { return ['a_enregistrer', 'echec'].indexOf(r.caution_statut) >= 0; });
        if ((attendPaiement || attendCarte) && tentatives++ < 15) {
          L.vider(zone).appendChild(h('div', { class: 'vide' }, h('span', { class: 'chargement__arche' }), h('p', null, t(attendPaiement ? 'panier.confirmation_paiement' : 'panier.confirmation_carte'))));
          setTimeout(charger, 2000);
          return;
        }
        rendreCommande(zone, c, resas, charger);
      });
    }
  }

  function rendreCommande(zone, c, resas, recharger) {
    L.vider(zone);
    var actives = resas.filter(function (r) { return r.statut !== 'annulee'; });
    var refusees = resas.filter(function (r) { return r.statut === 'annulee'; });
    var etape = c.statut === 'en_attente_reponses' ? 0 : c.statut === 'a_payer' ? 1 : c.statut === 'annulee' ? 0 :
      actives.some(function (r) { return ['a_enregistrer', 'echec'].indexOf(r.caution_statut) >= 0; }) ? 2 : 3;
    zone.appendChild(etapes(etape));
    var retour = h('div', { 'aria-live': 'polite' });
    var colonne = h('div');
    var resume = h('aside', { class: 'panier__resume panneau' });
    zone.appendChild(h('div', { class: 'panier' }, colonne, resume));

    if (L.param('envoye') === '1' && c.statut === 'en_attente_reponses') colonne.appendChild(h('p', { class: 'message message--succes' }, t('panier.demandes_envoyees')));
    if (L.param('paiement') === 'annule') colonne.appendChild(h('p', { class: 'message message--alerte' }, t('panier.paiement_annule')));

    resas.forEach(function (r) {
      var f = r.fournisseuse || {};
      var lignes = r.reservation_lignes || [];
      colonne.appendChild(h('section', { class: 'groupe-fournisseuse' },
        h('div', { class: 'groupe-fournisseuse__tete' }, h('strong', null, f.boutique_nom || f.nom_affiche || ''), h('span', { class: 'statut statut--' + r.statut }, t('statut.' + r.statut))),
        lignes.map(function (l) {
          return h('div', { class: 'article', style: { gridTemplateColumns: '1fr auto' } }, h('div', null, h('p', { class: 'article__titre' }, l.titre_snapshot), h('p', { class: 'article__meta' }, t('commun.du_au', { debut: L.dateCourte(r.date_debut), fin: L.dateCourte(r.date_fin) }))), h('span', null, L.euros(l.prix_location_cents)));
        }),
        r.statut === 'demande' ? h('p', { class: 'texte', style: { padding: '0 18px 14px', margin: 0, fontSize: '13px' } }, t('panier.attente_reponse', { heure: L.dateHeure(r.expire_at) })) : null,
        r.statut === 'annulee' && r.motif_annulation ? h('p', { class: 'texte', style: { padding: '0 18px 14px', margin: 0, fontSize: '13px' } }, r.motif_annulation) : null,
        ['payee', 'remise'].indexOf(r.statut) >= 0 && r.caution_cents ? h('p', { style: { padding: '0 18px 14px', margin: 0, fontSize: '13px' } }, t('panier.caution') + ' ' + L.euros(r.caution_cents) + ', ', h('span', { class: 'statut statut--' + r.caution_statut }, t('caution.' + r.caution_statut)),
          r.caution_statut === 'echec' ? h('button', { class: 'lien', type: 'button', style: { marginLeft: '10px' }, onclick: function (e) { rediriger(e.currentTarget, 'caution-reessayer', { reservation_id: r.id }); } }, t('panier.autoriser_caution')) : null) : null));
    });

    var totaux = actives.reduce(function (o, r) {
      if (['acceptee', 'demande'].indexOf(r.statut) >= 0 || c.statut === 'payee' || c.statut === 'terminee') {
        o.location += r.montant_location_cents; o.pressing += r.frais_pressing_cents + r.frais_envoi_cents; o.service += r.frais_service_cents; o.deduction += r.deduction_essayage_cents; o.caution += r.caution_cents;
      }
      return o;
    }, { location: 0, pressing: 0, service: 0, deduction: 0, caution: 0 });
    resume.appendChild(h('h2', { class: 'panneau__titre' }, t('panier.resume')));
    resume.appendChild(h('div', { class: 'recap' },
      ligneRecap('tenue.r_location', totaux.location), ligneRecap('panier.pressing_envoi', totaux.pressing), ligneRecap('tenue.r_service', totaux.service),
      totaux.deduction ? ligneRecap('panier.deduction', -totaux.deduction) : null,
      h('div', { class: 'recap__ligne recap__ligne--total' }, h('span', null, t('panier.total')), h('span', null, L.euros(totaux.location + totaux.pressing + totaux.service - totaux.deduction))),
      h('div', { class: 'recap__ligne recap__ligne--note' }, h('span', null, t('tenue.r_caution')), h('span', null, L.euros(totaux.caution))),
      h('p', { class: 'recap__ligne--note' }, t('panier.evenement', { date: L.date(c.date_evenement) }))));
    resume.appendChild(retour);

    function rediriger(bouton, action, corps) {
      bouton.disabled = true;
      L.api(action, corps).then(function (r) {
        if (r.url) { location.href = r.url; return; }
        if (r.identite_requise) { bouton.disabled = false; identite(); return; }
        recharger();
      }).catch(function (err) {
        bouton.disabled = false;
        L.vider(retour).appendChild(h('p', { class: 'message message--erreur', role: 'alert' }, L.messageErreur(err)));
      });
    }
    function identite() {
      L.vider(retour).appendChild(h('div', { class: 'message message--alerte' },
        h('p', null, t('panier.identite_texte')),
        h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function (e) { rediriger(e.currentTarget, 'identite-session', { commande_id: c.id }); } }, t('panier.identite_bouton'))));
    }
    var annuler = h('button', { class: 'bouton bouton--ligne bouton--plein', type: 'button', onclick: function (e) {
      var b = e.currentTarget;
      L.ui.confirmer(t('panier.annuler_confirmer'), t('panier.tout_annuler')).then(function (ok) {
        if (ok) { b.disabled = true; L.api('commande-annuler', { commande_id: c.id }).then(recharger).catch(function (err) { b.disabled = false; L.ui.toast(L.messageErreur(err), 'erreur'); }); }
      });
    } }, t('panier.tout_annuler'));

    if (c.statut === 'en_attente_reponses') {
      resume.appendChild(h('p', { class: 'message' }, t('panier.attente')));
      resume.appendChild(h('div', { class: 'actions' }, annuler));
    } else if (c.statut === 'a_payer') {
      if (refusees.length) resume.appendChild(h('p', { class: 'message message--alerte' }, t('panier.partiel')));
      if (c.identite_requise && !(L.profil && L.profil.identite_verifiee)) identite();
      if (L.param('identite') === 'retour') resume.appendChild(h('p', { class: 'message' }, t('panier.identite_retour')));
      resume.appendChild(h('div', { class: 'actions' },
        h('button', { class: 'bouton bouton--plein', type: 'button', onclick: function (e) { rediriger(e.currentTarget, 'checkout-creer', { commande_id: c.id }); } }, t('panier.payer')),
        annuler,
        h('p', { class: 'champ__aide', style: { width: '100%', textAlign: 'center', margin: 0 } }, t('panier.moyens'))));
    } else if (c.statut === 'payee' || c.statut === 'terminee') {
      var aEnregistrer = actives.some(function (r) { return ['payee', 'remise'].indexOf(r.statut) >= 0 && ['a_enregistrer', 'echec'].indexOf(r.caution_statut) >= 0; });
      if (aEnregistrer) {
        resume.appendChild(h('div', { class: 'message message--alerte' }, h('p', null, t('panier.carte_texte')),
          h('button', { class: 'bouton', type: 'button', onclick: function (e) { rediriger(e.currentTarget, 'caution-setup', { commande_id: c.id }); } }, t('panier.carte_bouton'))));
      } else {
        resume.appendChild(h('p', { class: 'message message--succes' }, t('panier.pret')));
        resume.appendChild(h('div', { class: 'actions' }, h('a', { class: 'bouton bouton--plein', href: 'compte.html?vue=reservations' }, t('panier.voir_espace'))));
      }
    } else if (c.statut === 'annulee') {
      resume.appendChild(h('p', { class: 'message' }, t('panier.annulee')));
    }
  }

  // ===========================================================================
  // Hub mariage : annuaire des partenaires et demandes de devis
  // ===========================================================================
  L.pages.partenaires = function () {
    remplirPlaceholders(document);
    var lienBeaute = $('[data-beaute]');
    if (lienBeaute) lienBeaute.href = C.liens.beauteMariee;
    var grille = $('[data-partenaires]');
    var filtres = { metier: L.param('metier') || '', ville: L.param('ville') || '' };
    var barre = $('[data-filtres-partenaires]');
    function puces() {
      L.vider(barre);
      [['', t('hub.tous')]].concat(C.metiers.map(function (m) { return [m, t('metier.' + m)]; })).forEach(function (m) {
        barre.appendChild(h('button', { type: 'button', class: 'puce', 'aria-pressed': String(filtres.metier === m[0]), onclick: function () { filtres.metier = m[0]; puces(); charger(); } }, m[1]));
      });
      barre.appendChild(h('select', { class: 'champ__controle', style: { width: 'auto', minHeight: '38px', fontSize: '14px' }, 'aria-label': t('cat.f_ville'), onchange: function (e) { filtres.ville = e.target.value; charger(); } },
        [h('option', { value: '' }, t('cat.toutes_villes'))].concat(C.villes.map(function (v) { return h('option', { value: v, selected: filtres.ville === v }, L.zone(v)); }))));
    }
    function charger() {
      if (!L.sb) return;
      L.ui.chargement(grille);
      var q = L.sb.from('partenaires').select('id, nom, metier, ville, bio, galerie, instagram, site').eq('valide', true).order('created_at');
      if (filtres.metier) q = q.eq('metier', filtres.metier);
      if (filtres.ville) q = q.eq('ville', filtres.ville);
      q.then(function (r) {
        L.vider(grille);
        var liste = r.data || [];
        if (!liste.length) { L.ui.etatVide(grille, t('hub.aucun')); return; }
        liste.forEach(function (p, i) {
          var visuel = (p.galerie && p.galerie[0]) || 'placeholder:' + ['couronne', 'bijoux', 'mdamma'][i % 3] + ':' + ['or', 'emeraude', 'bordeaux'][i % 3] + ':face:' + i;
          var carte = h('article', { class: 'partenaire', id: 'p-' + p.id, 'data-reveal': '' },
            h('div', { class: 'partenaire__visuel' }, h('img', { src: L.img.url(visuel, 'partenaires'), alt: '', loading: 'lazy' })),
            h('div', { class: 'partenaire__corps' },
              h('p', { class: 'surtitre', style: { margin: 0 } }, t('metier.' + p.metier) + ' · ' + L.zone(p.ville)),
              h('h3', { class: 'partenaire__nom' }, p.nom),
              p.bio ? h('p', { class: 'texte', style: { margin: 0, fontSize: '14px' } }, p.bio.length > 160 ? p.bio.slice(0, 157) + '…' : p.bio) : null,
              h('div', { class: 'actions', style: { marginTop: '8px' } },
                h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function () { devis(p); } }, t('hub.devis')),
                h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { fiche(p); } }, t('hub.profil')))));
          grille.appendChild(carte);
        });
        L.motion.reveler(grille);
        var ancre = location.hash && $(location.hash);
        if (ancre) ancre.scrollIntoView({ block: 'center' });
      });
    }
    puces();
    charger();
    document.addEventListener('lalla:langue', function () { puces(); charger(); });
    var cta = $('[data-devenir-partenaire]');
    if (cta) cta.addEventListener('click', function (e) {
      e.preventDefault();
      if (!L.session) { L.ui.authentification('inscription', { role: 'partenaire' }); return; }
      var aller = function () { location.href = 'compte.html?vue=partenaire'; };
      if (L.profil && L.profil.est_partenaire) aller();
      else L.sb.from('profils').update({ est_partenaire: true }).eq('id', L.session.user.id).then(aller);
    });
  };

  function fiche(p) {
    var contenu = h('div', { style: { display: 'grid', gap: '16px' } },
      h('p', { class: 'surtitre', style: { margin: 0 } }, t('metier.' + p.metier) + ' · ' + L.zone(p.ville)),
      p.bio ? h('p', { style: { whiteSpace: 'pre-line', margin: 0 } }, p.bio) : null,
      (p.galerie || []).length ? h('div', { class: 'edl__photos' }, p.galerie.map(function (g) { return h('img', { src: L.img.url(g, 'partenaires'), alt: '', loading: 'lazy', style: { aspectRatio: '1', objectFit: 'cover', width: '100%' } }); })) : null,
      h('p', { style: { margin: 0 } },
        p.instagram ? h('a', { href: 'https://instagram.com/' + encodeURIComponent(p.instagram), target: '_blank', rel: 'noopener' }, '@' + p.instagram) : null,
        p.instagram && p.site ? ' · ' : null,
        p.site ? h('a', { href: p.site, target: '_blank', rel: 'noopener nofollow' }, p.site.replace(/^https:\/\//, '')) : null),
      h('button', { class: 'bouton', type: 'button', onclick: function () { m.fermer(); setTimeout(function () { devis(p); }, 260); } }, t('hub.devis')));
    var m = L.ui.modale(contenu, { titre: p.nom, large: true });
  }

  function devis(p) {
    var retour = h('div');
    var form = h('form', { class: 'formulaire', novalidate: true },
      h('p', { class: 'texte' }, t('hub.devis_intro', { nom: p.nom })),
      h('div', { class: 'grille-2' },
        L.ui.champ('nom', 'auth.prenom', { required: true, minlength: 2, maxlength: 80, autocomplete: 'name', value: (L.profil && L.profil.nom_affiche) || '' }),
        L.ui.champ('email', 'auth.email', { type: 'email', required: true, autocomplete: 'email', value: (L.session && L.session.user.email) || '' })),
      h('div', { class: 'grille-2' },
        L.ui.champ('telephone', 'profil.telephone', { type: 'tel', pattern: '[+0-9 ().-]{6,25}', autocomplete: 'tel' }),
        L.ui.champ('date', 'tenue.date_evenement', { type: 'date', min: L.aujourdhui() })),
      L.ui.champ('ville', 'cat.f_ville', { tag: 'select', options: [['', t('commun.non_precise')]].concat(C.villes.map(function (v) { return [v, L.zone(v), v === p.ville]; })) }),
      L.ui.champ('message', 'hub.message', { tag: 'textarea', required: true, minlength: 10, maxlength: 1500 }),
      L.ui.honeypot(), retour,
      h('button', { class: 'bouton bouton--plein', type: 'submit' }, t('hub.envoyer')),
      h('p', { class: 'champ__aide' }, t('hub.rgpd')));
    var m = L.ui.modale(form, { titre: t('hub.devis') });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (!L.ui.limiter('devis', 5, 3600000)) { L.vider(retour).appendChild(h('p', { class: 'message message--erreur' }, t('commun.trop_requetes'))); return; }
      var b = form.querySelector('[type=submit]');
      b.disabled = true;
      L.api('lead-creer', { partenaire_id: p.id, nom: form.nom.value, email: form.email.value, telephone: form.telephone.value || null, date_evenement: form.date.value || null,
        ville: form.ville.value || null, message: form.message.value, langue: I.langue, site_web: form.site_web.value })
        .then(function () { L.vider(form).appendChild(h('p', { class: 'message message--succes' }, t('hub.envoye', { nom: p.nom }))); setTimeout(m.fermer, 2600); })
        .catch(function (err) { b.disabled = false; L.vider(retour).appendChild(h('p', { class: 'message message--erreur', role: 'alert' }, L.messageErreur(err))); });
    });
  }

  // ===========================================================================
  // Pages légales : sommaire
  // ===========================================================================
  L.pages.legal = function () {
    // Les documents légaux ne sont rédigés qu'en français tant qu'ils ne sont pas validés.
    function maj() { $$('[data-legal-nl]').forEach(function (x) { x.hidden = I.langue !== 'nl'; }); }
    maj();
    document.addEventListener('lalla:langue', maj);
  };
})();
