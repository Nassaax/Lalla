/*
 * LALLA — contrôleurs des pages publiques (accueil, catalogue, fiche tenue, boutique, panier, partenaires).
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
    var defauts = { commission_taux: 0.15, frais_service_taux: 0.05, frais_pressing_cents: 1500, frais_essayage_cents: 1500, caution_taux: 0.5, pressing_jours: 2, seuil_identity_cents: 50000 };
    if (!L.sb) return Promise.resolve(defauts);
    return L.sb.from('parametres').select('cle, valeur').then(function (r) {
      parametres = Object.assign({}, defauts);
      (r.data || []).forEach(function (p) { parametres[p.cle] = p.valeur; });
      return parametres;
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

  /** Carte tenue (catalogue, sélection, boutique, compléter le look). */
  L.carteTenue = function (tn, options) {
    options = options || {};
    var url = 'tenue.html?id=' + tn.id;
    var img = L.img.element(tn.photo || placeholderPour(tn, 'face'), tn.titre, { width: 600, height: 800 });
    var badge = tn.type_fournisseuse && tn.type_fournisseuse !== 'particuliere' ? h('span', { class: 'carte__badge' }, t('type.' + tn.type_fournisseuse)) : null;
    var carte = h('a', { class: 'carte', href: url, 'data-flip-id': tn.id },
      h('div', { class: 'carte__visuel' }, h('div', { class: 'arche' }, img), badge),
      h('div', { class: 'carte__infos' },
        h('h3', { class: 'carte__titre' }, tn.titre),
        h('p', { class: 'carte__meta' }, h('span', null, libelleCategorie(tn)), h('span', null, '·'), h('span', null, tn.ville),
          tn.taille_indicative ? [h('span', null, '·'), h('span', null, tn.taille_indicative === 'unique' ? 'TU' : tn.taille_indicative)] : null),
        h('p', { class: 'carte__prix' }, L.euros(tn.prix_location_cents, true), ' ', h('small', null, t('commun.par_jour')))),
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
    remplirPlaceholders(document);
    animerHero();
    collections();
    selection();
    boutiques();
    commentCaMarche();
    simulateur();
    $$('[data-devenir-fournisseuse]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (L.session) location.href = 'compte.html?vue=annonces';
        else L.ui.authentification('inscription', { role: 'fournisseuse' });
      });
    });
  };

  function animerHero() {
    var titre = $('.hero__titre');
    var autres = $$('[data-anim-hero]');
    var zelliges = $$('[data-zellige]');
    if (!window.gsap || !L.motion.actif) {
      if (window.gsap) gsap.set([titre].concat(autres), { opacity: 1 });
      return;
    }
    var d = L.motion.duree;
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    zelliges.forEach(function (z, i) { L.motion.dessinerMotif(z, i * 0.3); });
    // Le masque en arche s'ouvre comme deux portes, l'image se pose.
    tl.fromTo('.hero__image', { scale: 1.28 }, { scale: 1, duration: d(1.9) }, 0.15)
      .to('.hero__porte--g', { xPercent: -101, duration: d(1.3), ease: 'expo.inOut' }, 0.15)
      .to('.hero__porte--d', { xPercent: 101, duration: d(1.3), ease: 'expo.inOut' }, 0.15);
    L.motion.titreLignes(titre, 0.35);
    tl.fromTo(autres, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: d(1), stagger: 0.08 }, 0.8);
    if (window.ScrollTrigger && !L.motion.mobile()) {
      gsap.to('.hero__image', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__zellige--1', { yPercent: -18, rotate: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }
  }

  function collections() {
    var piste = $('[data-collections]');
    if (!piste) return;
    var cats = [
      { cle: 'caftan', couleur: 'bordeaux', vue: 'portee' },
      { cle: 'takchita', couleur: 'emeraude', vue: 'face' },
      { cle: 'mariee', couleur: 'ivoire', vue: 'portee' },
      { cle: 'homme', couleur: 'bleu_nuit', vue: 'face' },
      { cle: 'enfant', couleur: 'rose', vue: 'face' },
      { cle: 'accessoire', couleur: 'or', vue: 'face', scat: 'mdamma' }
    ];
    var comptes = {};
    cats.forEach(function (c, i) {
      var nb = h('span', { class: 'collection__nb' });
      comptes[c.cle] = nb;
      piste.appendChild(h('a', { class: 'collection', href: 'catalogue.html?categorie=' + c.cle },
        h('div', { class: 'arche-cadre collection__arche' }, h('div', { class: 'arche' },
          L.img.element('placeholder:' + (c.scat || c.cle) + ':' + c.couleur + ':' + c.vue + ':' + (i * 7), t('cat.' + c.cle)))),
        h('div', { class: 'collection__legende' }, h('h3', { class: 'collection__nom', 'data-i18n': 'cat.' + c.cle }, t('cat.' + c.cle)), nb)));
    });
    if (L.sb) {
      L.sb.from('tenues').select('categorie').eq('statut', 'validee').limit(2000).then(function (r) {
        var n = {};
        (r.data || []).forEach(function (x) { n[x.categorie] = (n[x.categorie] || 0) + 1; });
        Object.keys(comptes).forEach(function (k) { comptes[k].textContent = n[k] ? String(n[k]).padStart(2, '0') : ''; });
      });
    }
    // Défilement horizontal épinglé (desktop uniquement)
    if (!window.gsap || !window.ScrollTrigger || !L.motion.actif) return;
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      var section = $('.collections');
      section.classList.add('collections--epinglee');
      var distance = function () { return Math.max(0, piste.scrollWidth - section.querySelector('.conteneur').clientWidth); };
      var tween = gsap.to(piste, {
        x: function () { return -distance(); }, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: function () { return '+=' + distance(); }, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 }
      });
      // Légère inclinaison selon la vitesse
      var cartes = $$('.collection', piste);
      var incliner = gsap.quickTo(cartes, 'rotate', { duration: 0.6, ease: 'power3' });
      var st = tween.scrollTrigger;
      var ticker = function () { incliner(gsap.utils.clamp(-2.5, 2.5, st.getVelocity() / -900)); };
      gsap.ticker.add(ticker);
      return function () { gsap.ticker.remove(ticker); section.classList.remove('collections--epinglee'); gsap.set(cartes, { clearProps: 'rotate' }); };
    });
  }

  function selection() {
    var zone = $('[data-selection]');
    if (!zone) return;
    L.ui.chargement(zone);
    rechercher({ p_tri: 'recent', p_limite: 8 }).then(function (liste) {
      L.vider(zone);
      if (!liste.length) { L.ui.etatVide(zone, t('index.sel.vide')); return; }
      liste.forEach(function (tn) { var c = L.carteTenue(tn); c.setAttribute('data-reveal', ''); zone.appendChild(c); });
      L.motion.reveler(zone);
    }).catch(function () { L.ui.etatVide(zone, t('commun.erreur')); });
  }

  function boutiques() {
    var zone = $('[data-boutiques]');
    if (!zone || !L.sb) return;
    L.sb.from('profils').select('id, nom_affiche, boutique_nom, type_fournisseuse, ville, note_moyenne, nb_avis, avatar_chemin')
      .eq('est_fournisseuse', true).eq('compte_valide', true).in('type_fournisseuse', ['negafa', 'creatrice'])
      .order('score_visibilite', { ascending: false }).limit(4)
      .then(function (r) {
        var liste = r.data || [];
        if (!liste.length) { zone.closest('section').hidden = true; return; }
        liste.forEach(function (p, i) { var c = carteBoutique(p, i); c.setAttribute('data-reveal', ''); zone.appendChild(c); });
        L.motion.reveler(zone);
      });
  }

  function carteBoutique(p, i) {
    var img = p.avatar_chemin ? L.img.url(p.avatar_chemin, 'avatars') : L.img.placeholder('placeholder:' + (i % 2 ? 'caftan' : 'takchita') + ':' + ['noir', 'bordeaux', 'emeraude', 'bleu_nuit'][i % 4] + ':portee:' + (i * 13));
    return h('a', { class: 'carte', href: 'boutique.html?id=' + p.id },
      h('div', { class: 'carte__visuel' }, h('div', { class: 'arche' }, h('img', { src: img, alt: '', loading: 'lazy' })),
        h('span', { class: 'carte__badge' }, t('type.' + p.type_fournisseuse))),
      h('div', { class: 'carte__infos' },
        h('h3', { class: 'carte__titre' }, p.boutique_nom || p.nom_affiche),
        h('p', { class: 'carte__meta' }, p.ville || '', p.nb_avis ? [' · ', h('span', { class: 'note' }, '★ ' + Number(p.note_moyenne).toFixed(1))] : null)));
  }

  function commentCaMarche() {
    if (!window.gsap || !window.ScrollTrigger || !L.motion.actif) return;
    $$('[data-comment]').forEach(function (col, i) {
      var etapes = $$('.comment__etape', col);
      gsap.from(etapes, { opacity: 0, y: 30, duration: L.motion.duree(0.9), ease: 'power3.out', stagger: 0.12, delay: i * 0.15,
        scrollTrigger: { trigger: col, start: 'top 80%', once: true } });
      gsap.to($('.comment__progression span', col), { scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: col, start: 'top 70%', end: 'bottom 55%', scrub: true } });
      gsap.from($('h3', col), { opacity: 0, x: -16, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: col, start: 'top 85%', once: true } });
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
        p_tri: etat.tri || 'pertinence', p_limite: PAR_PAGE, p_decalage: page * PAR_PAGE
      };
      var etatFlip = ajout || !window.Flip || !L.motion.actif ? null : window.Flip.getState($$('.carte', grille));
      rechercher(p).then(function (liste) {
        total = liste.length ? Number(liste[0].total) : (ajout ? total : 0);
        if (!ajout) L.vider(grille);
        compte.textContent = t(total === 1 ? 'cat.resultat' : 'cat.resultats', { n: total });
        if (!liste.length && !ajout) {
          L.ui.etatVide(grille, t('commun.aucun_resultat'), h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function () { etat = {}; synchroniserForm(form, etat); appliquer(); } }, t('cat.reinitialiser')));
          return;
        }
        var nouvelles = liste.map(function (tn) { return L.carteTenue(tn); });
        nouvelles.forEach(function (c) { grille.appendChild(c); });
        plus.hidden = (page + 1) * PAR_PAGE >= total;
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

  var CLES_FILTRES = ['categorie', 'occasion', 'taille', 'couleur', 'prix_max', 'ville', 'debut', 'fin', 'poitrine', 'tour_taille', 'hanches', 'longueur', 'q', 'tri', 'boutique'];

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
    form.appendChild(groupe('cat.f_ville', h('div', { class: 'choix-pastilles' },
      [['', t('cat.toutes_villes')]].concat(C.villes.map(function (v) { return [v, v]; })).map(function (v) {
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
      L.sb.from('tenues').select('*, tenue_photos(id, type, chemin, ordre), fournisseuse:profils(id, nom_affiche, boutique_nom, type_fournisseuse, note_moyenne, nb_avis, avatar_chemin, ville, compte_valide)').eq('id', id).maybeSingle(),
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
    var imgPrincipale = h('img', { src: L.img.url(photos[0].chemin), alt: tn.titre + ' — ' + t('tenue.photo_' + photos[0].type), width: 900, height: 1200, fetchpriority: 'high' });
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
          changerImage(L.img.url(ph.chemin), tn.titre + ' — ' + t('tenue.photo_' + ph.type));
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
    var lienBoutique = h(f.type_fournisseuse && f.type_fournisseuse !== 'particuliere' ? 'a' : 'div', { class: 'fiche__fournisseuse', href: 'boutique.html?id=' + f.id },
      h('span', { class: 'avatar' }, f.avatar_chemin ? h('img', { src: L.img.url(f.avatar_chemin, 'avatars'), alt: '' }) : (nomBoutique[0] || '·').toUpperCase()),
      h('span', null, h('strong', null, nomBoutique), h('br'),
        h('small', { class: 'texte' }, t('type.' + (f.type_fournisseuse || 'particuliere')), ' · ', tn.ville,
          f.nb_avis ? [' · ', h('span', { class: 'note' }, '★ ' + Number(f.note_moyenne).toFixed(1) + ' (' + f.nb_avis + ')')] : null)));

    var mesures = tn.categorie === 'accessoire' ? null : h('table', { class: 'mesures' },
      h('caption', { class: 'sr' }, t('tenue.mesures')),
      h('tbody', null, [['mes.taille_indicative', tn.taille_indicative || '—'], ['mes.poitrine', tn.poitrine_cm], ['mes.taille', tn.taille_cm], ['mes.hanches', tn.hanches_cm], ['mes.longueur', tn.longueur_cm], ['mes.manche', tn.manche_cm]].map(function (l) {
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
      h('div', null, h('p', { class: 'surtitre' }, libelleCategorie(tn) + ' · ' + tn.ville), h('h1', { class: 'fiche__titre' }, tn.titre)),
      h('p', { class: 'fiche__prix' }, h('strong', null, L.euros(tn.prix_location_cents, true)), h('span', { class: 'texte' }, t('tenue.par_location', { min: tn.duree_min_jours, max: tn.duree_max_jours }))),
      modes,
      lienBoutique,
      tn.description ? h('div', { class: 'texte', style: { whiteSpace: 'pre-line' } }, tn.description) : null,
      (tn.couleurs || []).length ? h('p', { class: 'texte' }, t('tenue.couleurs') + ' : ' + tn.couleurs.map(function (c) { return t('coul.' + c); }).join(', ')) : null,
      mesures,
      h('p', { class: 'mention-retouche' }, h('span', null, h('strong', null, t('tenue.retouche_titre')), ' ', t('tenue.retouche_texte'))),
      boite,
      h('div', { class: 'actions' }, partage));

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
    var bouton = h('button', { class: 'bouton bouton--plein', type: 'submit' }, t('tenue.ajouter_panier'));
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
          h('div', { class: 'ligne-resa__tete' }, h('h3', { class: 'ligne-resa__titre' }, s.titre), h('span', { class: 'statut' }, s.ville)),
          h('p', { class: 'texte', style: { margin: 0 } }, L.dateHeure(s.debut) + ' — ' + L.date(s.fin, { hour: '2-digit', minute: '2-digit' }) + ' · ' + s.lieu + ', ' + s.adresse),
          h('div', null, h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function (e) {
            var b = e.currentTarget;
            L.auth.exiger('connexion').then(function () {
              b.disabled = true;
              return L.api('showroom-inscrire', { showroom_id: s.id, tenue_ids: tn ? [tn.id] : [], site_web: '' });
            }).then(function () { m.fermer(); L.ui.toast(t('showroom.inscrite'), 'succes'); })
              .catch(function (err) { b.disabled = false; if (err.code !== 'non_connecte') L.ui.toast(L.messageErreur(err), 'erreur'); });
          } }, t('showroom.inscrire')))));
      });
    });
  };

  function majSeo(tn, photos) {
    var titre = t('tenue.seo_titre', { titre: tn.titre, categorie: libelleCategorie(tn), ville: tn.ville });
    document.title = titre;
    var desc = (tn.description || '').slice(0, 150) || t('tenue.seo_desc', { titre: tn.titre, ville: tn.ville });
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
      L.sb.from('profils').select('id, nom_affiche, boutique_nom, boutique_bio, type_fournisseuse, ville, note_moyenne, nb_avis, avatar_chemin, est_fournisseuse, compte_valide, created_at').eq('id', id).maybeSingle(),
      rechercher({ p_fournisseuse: id, p_limite: 60 }),
      L.sb.from('avis').select('note, commentaire, created_at').eq('cible_id', id).eq('sens', 'cliente_vers_fournisseuse').order('created_at', { ascending: false }).limit(10)
    ]).then(function (res) {
      var p = res[0].data, tenues = res[1], avis = res[2].data || [];
      if (!p || !p.est_fournisseuse) { L.ui.etatVide(zone, t('boutique.introuvable')); return; }
      var nom = p.boutique_nom || p.nom_affiche;
      document.title = t('boutique.seo_titre', { nom: nom, type: t('type.' + p.type_fournisseuse), ville: p.ville || '' });
      var mdesc = $('meta[name=description]');
      if (mdesc) mdesc.setAttribute('content', (p.boutique_bio || '').slice(0, 150) || t('boutique.seo_desc', { nom: nom }));
      var ld = { '@context': 'https://schema.org', '@type': 'Store', name: nom, address: { '@type': 'PostalAddress', addressLocality: p.ville || '', addressCountry: 'BE' } };
      if (p.nb_avis) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: p.note_moyenne, reviewCount: p.nb_avis };
      document.head.appendChild(h('script', { type: 'application/ld+json', text: JSON.stringify(ld) }));
      var nbLocations = 0;
      var visuel = p.avatar_chemin ? L.img.url(p.avatar_chemin, 'avatars') : L.img.placeholder('placeholder:takchita:' + (p.type_fournisseuse === 'negafa' ? 'bordeaux' : 'emeraude') + ':portee:5');
      var grille = h('div', { class: 'grille-cartes' });
      tenues.forEach(function (tn) { var c = L.carteTenue(tn); c.setAttribute('data-reveal', ''); grille.appendChild(c); });
      L.vider(zone).appendChild(h('div', null,
        h('header', { class: 'boutique-entete' },
          h('div', { class: 'arche-cadre boutique-entete__avatar' }, h('div', { class: 'arche' }, h('img', { src: visuel, alt: '' }))),
          h('div', null,
            h('p', { class: 'surtitre' }, t('type.' + p.type_fournisseuse) + (p.ville ? ' · ' + p.ville : '')),
            h('h1', { style: { marginBottom: '12px' } }, nom),
            p.boutique_bio ? h('p', { class: 'chapeau', style: { whiteSpace: 'pre-line' } }, p.boutique_bio) : null,
            h('div', { class: 'boutique-entete__chiffres' },
              h('div', null, h('strong', null, String(tenues.length ? Number(tenues[0].total) : 0)), t('boutique.pieces')),
              p.nb_avis ? h('div', null, h('strong', null, '★ ' + Number(p.note_moyenne).toFixed(1)), t('boutique.avis', { n: p.nb_avis })) : null,
              h('div', null, h('strong', null, String(new Date(p.created_at).getFullYear())), t('boutique.depuis'))))),
        h('section', { class: 'section', style: { paddingTop: '48px' } }, h('h2', { style: { fontSize: '2rem' } }, t('boutique.collection')),
          tenues.length ? grille : h('p', { class: 'texte' }, t('boutique.vide'))),
        avis.length ? h('section', { class: 'section', style: { paddingTop: 0 } }, h('h2', { style: { fontSize: '2rem' } }, t('boutique.avis_titre')), h('div', { class: 'avis-liste' }, avis.map(rendreAvis))) : null));
      void nbLocations;
      L.motion.reveler(zone);
      if (window.gsap && L.motion.actif) L.motion.titreLignes($('h1', zone), 0.1);
    }).catch(function (e) { console.error(e); L.ui.etatVide(zone, t('commun.erreur')); });
  };

  // ===========================================================================
  // Pages légales : sommaire
  // ===========================================================================
  L.pages.legal = function () {};
})();
