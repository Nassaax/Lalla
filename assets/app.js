/*
 * LALLA — cœur front partagé par toutes les pages publiques.
 * Vanilla JS, sans build. Dépendances CDN : supabase-js, GSAP (ScrollTrigger, SplitText, Flip), Lenis.
 * Sommaire :
 *   1. Utilitaires          5. Images & placeholders
 *   2. Supabase & session   6. Panier
 *   3. API serveur          7. Motion design
 *   4. Interface commune    8. Pages (index, catalogue, tenue, boutique, panier, partenaires)
 */
(function () {
  'use strict';

  var C = window.LALLA_CONFIG;
  var ENV = window.LALLA_ENV || {};
  var I = window.I18N;
  var t = I.t;
  var L = (window.Lalla = window.Lalla || {});
  L.config = C;

  // ===========================================================================
  // 1. Utilitaires
  // ===========================================================================
  var $ = (L.$ = function (s, r) { return (r || document).querySelector(s); });
  var $$ = (L.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); });

  /** Construit un élément DOM sans innerHTML (protège des injections). */
  var h = (L.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null || attrs[k] === false) continue;
        var v = attrs[k];
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // réservé aux chaînes du dictionnaire
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) ajouterEnfant(el, arguments[i]);
    return el;
  });
  function ajouterEnfant(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { ajouterEnfant(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }

  L.vider = function (el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; };

  L.euros = function (cents, sansDecimales) {
    var n = (cents || 0) / 100;
    return new Intl.NumberFormat(I.locale, {
      style: 'currency', currency: 'EUR',
      minimumFractionDigits: sansDecimales || n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: sansDecimales ? 0 : 2
    }).format(n);
  };

  L.date = function (iso, options) {
    if (!iso) return '';
    var d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
    return new Intl.DateTimeFormat(I.locale, options || { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  };
  L.dateCourte = function (iso) { return L.date(iso, { day: 'numeric', month: 'short' }); };
  L.dateHeure = function (iso) { return L.date(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

  L.isoDate = function (d) {
    var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  L.ajouterJours = function (iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return L.isoDate(d);
  };
  L.aujourdhui = function () { return L.isoDate(new Date()); };

  L.debounce = function (fn, ms) {
    var id;
    return function () {
      var a = arguments, ctx = this;
      clearTimeout(id);
      id = setTimeout(function () { fn.apply(ctx, a); }, ms);
    };
  };

  L.param = function (nom) { return new URLSearchParams(location.search).get(nom); };

  L.estUuid = function (v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || ''); };

  L.stockage = {
    lire: function (cle, defaut) {
      try { var v = localStorage.getItem(cle); return v == null ? defaut : JSON.parse(v); } catch (e) { return defaut; }
    },
    ecrire: function (cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* ignoré */ } }
  };

  // ===========================================================================
  // 2. Supabase & session
  // ===========================================================================
  L.sb = null;
  L.session = null;
  L.profil = null;
  var abonnesSession = [];

  function initSupabase() {
    if (!window.supabase || !ENV.supabaseUrl || !ENV.supabaseAnonKey) {
      console.warn('[LALLA] Supabase non configuré (voir README : variables SUPABASE_URL et SUPABASE_ANON_KEY).');
      return;
    }
    L.sb = window.supabase.createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
    });
  }

  L.auth = {
    pret: null,
    surChangement: function (fn) { abonnesSession.push(fn); if (L.auth.charge) fn(L.session, L.profil); },
    charge: false,
    chargerProfil: function () {
      if (!L.sb || !L.session) { L.profil = null; return Promise.resolve(null); }
      return L.sb.from('profils').select('*').eq('id', L.session.user.id).maybeSingle().then(function (r) {
        L.profil = r.data || null;
        return L.profil;
      });
    },
    init: function () {
      if (!L.sb) { L.auth.charge = true; L.auth.pret = Promise.resolve(null); return L.auth.pret; }
      L.auth.pret = L.sb.auth.getSession().then(function (r) {
        L.session = r.data.session;
        return L.auth.chargerProfil();
      }).then(function () {
        L.auth.charge = true;
        notifierSession();
        L.sb.auth.onAuthStateChange(function (evt, session) {
          var avant = L.session && L.session.user.id;
          L.session = session;
          if ((session && session.user.id) !== avant || evt === 'USER_UPDATED') {
            L.auth.chargerProfil().then(notifierSession);
          }
        });
        return L.profil;
      });
      return L.auth.pret;
    },
    connexion: function (email, motDePasse) {
      return L.sb.auth.signInWithPassword({ email: email, password: motDePasse });
    },
    lienMagique: function (email) {
      return L.sb.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: false, emailRedirectTo: location.origin + '/compte.html' }
      });
    },
    inscription: function (d) {
      return L.sb.auth.signUp({
        email: d.email,
        password: d.motDePasse,
        options: {
          emailRedirectTo: location.origin + '/compte.html',
          data: {
            prenom: d.prenom, nom: d.nom, langue: I.langue, cgu: true, ville: d.ville || null,
            type_fournisseuse: d.typeFournisseuse || null, partenaire: d.partenaire ? 'true' : 'false'
          }
        }
      });
    },
    deconnexion: function () {
      return L.sb.auth.signOut().then(function () { location.href = 'index.html'; });
    },
    /** Résout le profil ou ouvre la fenêtre de connexion. */
    exiger: function (mode) {
      return (L.auth.pret || Promise.resolve()).then(function () {
        if (L.session) return L.profil;
        L.ui.authentification(mode || 'connexion');
        var e = new Error(t('commun.connexion_requise'));
        e.code = 'non_connecte';
        throw e;
      });
    }
  };

  function notifierSession() {
    abonnesSession.forEach(function (fn) { try { fn(L.session, L.profil); } catch (e) { console.error(e); } });
  }

  // ===========================================================================
  // 3. API serveur (fonctions Vercel)
  // ===========================================================================
  L.api = function (action, corps) {
    var jeton = L.session && L.session.access_token;
    var p = L.sb && L.session ? L.sb.auth.getSession().then(function (r) { return r.data.session && r.data.session.access_token; }) : Promise.resolve(jeton);
    return p.then(function (jt) {
      var entetes = { 'Content-Type': 'application/json' };
      if (jt) entetes.Authorization = 'Bearer ' + jt;
      return fetch('/api/v1/' + action, { method: 'POST', headers: entetes, body: JSON.stringify(corps || {}) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(r.status === 429 ? t('commun.trop_requetes') : j.message || t('commun.erreur'));
          e.code = j.erreur;
          e.status = r.status;
          e.details = j;
          throw e;
        }
        return j;
      });
    });
  };

  /** Message lisible pour une erreur Supabase/PostgREST ou API. */
  L.messageErreur = function (err) {
    if (!err) return t('commun.erreur');
    if (err.code === 'P0429' || err.status === 429) return t('commun.trop_requetes');
    if (err.message && err.message.length < 160 && !/fetch|network|JSON/i.test(err.message)) return err.message;
    return t('commun.erreur');
  };

  // ===========================================================================
  // 4. Interface commune
  // ===========================================================================
  L.ui = {};

  L.ui.toast = function (message, type) {
    var zone = $('#toasts');
    if (!zone) { zone = h('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(zone); }
    var el = h('div', { class: 'toast' + (type ? ' toast--' + type : '') }, message);
    zone.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('est-visible'); });
    setTimeout(function () {
      el.classList.remove('est-visible');
      setTimeout(function () { el.remove(); }, 400);
    }, type === 'erreur' ? 6000 : 3800);
  };

  /** Fenêtre modale accessible (piège du focus, Échap, retour du focus). */
  L.ui.modale = function (contenu, options) {
    options = options || {};
    var precedent = document.activeElement;
    var titreId = 'modale-titre-' + Math.random().toString(36).slice(2, 8);
    var boite = h('div', { class: 'modale__boite' + (options.large ? ' modale__boite--large' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': options.titre ? titreId : null },
      h('button', { class: 'modale__fermer', type: 'button', 'aria-label': t('commun.fermer'), onclick: function () { fermer(); } }, '×'),
      options.titre ? h('h2', { class: 'modale__titre', id: titreId }, options.titre) : null,
      contenu);
    var fond = h('div', { class: 'modale', onclick: function (e) { if (e.target === fond) fermer(); } }, boite);
    function cle(e) {
      if (e.key === 'Escape') fermer();
      if (e.key === 'Tab') {
        var f = $$('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea', boite).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    function fermer() {
      document.removeEventListener('keydown', cle);
      document.documentElement.classList.remove('modale-ouverte');
      if (L.motion.lenis) L.motion.lenis.start();
      fond.classList.remove('est-ouverte');
      setTimeout(function () { fond.remove(); }, 250);
      if (precedent && precedent.focus) precedent.focus();
      if (options.surFermeture) options.surFermeture();
    }
    document.body.appendChild(fond);
    document.addEventListener('keydown', cle);
    document.documentElement.classList.add('modale-ouverte');
    if (L.motion.lenis) L.motion.lenis.stop();
    requestAnimationFrame(function () {
      fond.classList.add('est-ouverte');
      var premier = $('input:not([type=hidden]):not([tabindex="-1"]), select, textarea, button:not(.modale__fermer)', boite);
      (premier || boite.querySelector('button')).focus();
    });
    return { fermer: fermer, boite: boite };
  };

  L.ui.confirmer = function (message, libelle) {
    return new Promise(function (resolve) {
      var m;
      var corps = h('div', null,
        h('p', { class: 'texte' }, message),
        h('div', { class: 'actions' },
          h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function () { m.fermer(); resolve(false); } }, t('commun.annuler')),
          h('button', { class: 'bouton', type: 'button', onclick: function () { resolve(true); m.fermer(); } }, libelle || t('commun.confirmer'))));
      m = L.ui.modale(corps, { titre: t('commun.confirmer') });
    });
  };

  /** Champ caché anti-robots, à placer dans chaque formulaire. */
  L.ui.honeypot = function () {
    return h('div', { class: 'pot', 'aria-hidden': 'true' },
      h('label', null, 'Site web', h('input', { type: 'text', name: 'site_web', tabindex: '-1', autocomplete: 'off' })));
  };
  L.ui.estRobot = function (form) {
    var c = form.querySelector('[name=site_web]');
    return Boolean(c && c.value);
  };

  /** Limitation de fréquence côté navigateur (en complément du serveur). */
  L.ui.limiter = function (cle, max, fenetreMs) {
    var maintenant = Date.now();
    var hist = L.stockage.lire('lalla.freq.' + cle, []).filter(function (x) { return maintenant - x < fenetreMs; });
    if (hist.length >= max) return false;
    hist.push(maintenant);
    L.stockage.ecrire('lalla.freq.' + cle, hist);
    return true;
  };

  L.ui.chargement = function (el) {
    L.vider(el).appendChild(h('div', { class: 'chargement', role: 'status' }, h('span', { class: 'chargement__arche', 'aria-hidden': 'true' }), h('span', { class: 'sr' }, t('commun.chargement'))));
  };

  L.ui.etatVide = function (el, message, action) {
    L.vider(el).appendChild(h('div', { class: 'vide' }, L.ui.motifSvg('vide__motif'), h('p', null, message), action || null));
  };

  /** Icône SVG (dans le bon espace de noms). */
  L.ui.icone = function (contenu, classe) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', classe || 'icone');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = contenu;
    return svg;
  };

  /** Petit motif zellige (étoile à huit branches) en lignes dorées. */
  L.ui.motifSvg = function (classe) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', classe || 'motif');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1"><rect x="22" y="22" width="56" height="56"/><rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="12"/><path d="M50 10v80M10 50h80"/></g>';
    return svg;
  };

  function lienNav(href, cle, extra) {
    var actif = location.pathname.split('/').pop() === href.split('?')[0].split('#')[0];
    return h('a', Object.assign({ href: href, class: 'nav__lien' + (actif ? ' est-actif' : ''), 'data-i18n': cle, 'aria-current': actif ? 'page' : null }, extra || {}), t(cle));
  }

  function basculeLangue() {
    var b = h('div', { class: 'langue', role: 'group', 'aria-label': t('langue.changer'), 'data-i18n-attr': 'aria-label:langue.changer' });
    ['fr', 'nl'].forEach(function (l) {
      b.appendChild(h('button', {
        type: 'button', class: 'langue__btn' + (I.langue === l ? ' est-actif' : ''), lang: l, 'aria-pressed': String(I.langue === l),
        title: t('langue.' + l),
        onclick: function () {
          I.changerLangue(l);
          $$('.langue__btn').forEach(function (x) { x.classList.toggle('est-actif', x.lang === l); x.setAttribute('aria-pressed', String(x.lang === l)); });
        }
      }, l.toUpperCase()));
    });
    return b;
  }

  L.ui.marque = function (classe) {
    return h('a', { href: 'index.html', class: classe || 'marque', 'aria-label': C.brand.name },
      h('span', { class: 'marque__arche', 'aria-hidden': 'true' }),
      h('span', { class: 'marque__nom', 'data-brand': '' }, C.brand.name));
  };

  L.ui.entete = function () {
    var zone = $('#entete');
    if (!zone) return;
    var compteur = h('span', { class: 'panier-compteur', 'aria-hidden': 'true' }, String(L.panier.nb() || ''));
    var boutonCompte = h('button', { type: 'button', class: 'nav__compte', onclick: function () {
      if (L.session) location.href = 'compte.html'; else L.ui.authentification('connexion');
    } }, h('span', { 'data-i18n': 'nav.connexion' }, t('nav.connexion')));
    var menu = h('nav', { class: 'nav', id: 'menu-principal', 'aria-label': 'Navigation principale' },
      lienNav('catalogue.html', 'nav.catalogue'),
      lienNav('index.html#collections', 'nav.collections'),
      lienNav('index.html#comment', 'nav.comment'),
      lienNav('partenaires.html', 'nav.partenaires'),
      lienNav('compte.html?vue=annonces', 'nav.proposer', { class: 'nav__lien nav__lien--accent' }));
    var burger = h('button', { type: 'button', class: 'burger', 'aria-expanded': 'false', 'aria-controls': 'menu-principal', onclick: function () {
      var ouvert = document.documentElement.classList.toggle('menu-ouvert');
      burger.setAttribute('aria-expanded', String(ouvert));
      if (L.motion.lenis) L.motion.lenis[ouvert ? 'stop' : 'start']();
    } }, h('span', { class: 'burger__ligne' }), h('span', { class: 'burger__ligne' }), h('span', { class: 'sr', 'data-i18n': 'nav.menu' }, t('nav.menu')));
    L.vider(zone).appendChild(h('div', { class: 'entete__barre' },
      L.ui.marque(),
      menu,
      h('div', { class: 'entete__outils' },
        basculeLangue(),
        boutonCompte,
        h('a', { href: 'panier.html', class: 'panier-lien', 'aria-label': t('nav.panier'), 'data-i18n-attr': 'aria-label:nav.panier' },
          L.ui.icone('<path d="M6 8h12l-1 12H7L6 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/>'), compteur),
        burger)));
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) { document.documentElement.classList.remove('menu-ouvert'); burger.setAttribute('aria-expanded', 'false'); if (L.motion.lenis) L.motion.lenis.start(); }
    });
    L.auth.surChangement(function (session, profil) {
      var libelle = boutonCompte.querySelector('span');
      if (session) {
        libelle.removeAttribute('data-i18n');
        libelle.textContent = (profil && profil.nom_affiche) || t('nav.compte');
        boutonCompte.setAttribute('aria-label', t('nav.compte'));
      } else {
        libelle.setAttribute('data-i18n', 'nav.connexion');
        libelle.textContent = t('nav.connexion');
      }
      var adminLien = $('.nav__lien--admin', menu);
      if (profil && profil.est_admin && !adminLien) menu.appendChild(lienNav('admin.html', 'nav.admin', { class: 'nav__lien nav__lien--admin' }));
    });
    var defile = false;
    window.addEventListener('scroll', function () {
      var d = window.scrollY > 24;
      if (d !== defile) { defile = d; zone.classList.toggle('est-defile', d); }
    }, { passive: true });
  };

  L.ui.pied = function () {
    var zone = $('#pied');
    if (!zone) return;
    var annee = new Date().getFullYear();
    L.vider(zone).appendChild(h('div', { class: 'pied__grille' },
      h('div', { class: 'pied__marque' }, L.ui.marque('marque marque--pied'),
        h('p', { 'data-i18n': 'promesse', class: 'pied__promesse' }, t('promesse')),
        h('p', { 'data-i18n': 'footer.texte', class: 'pied__texte' }, t('footer.texte'))),
      h('div', null, h('h2', { class: 'pied__titre', 'data-i18n': 'footer.plateforme' }, t('footer.plateforme')),
        h('ul', { class: 'pied__liens' },
          h('li', null, h('a', { href: 'catalogue.html', 'data-i18n': 'nav.catalogue' }, t('nav.catalogue'))),
          h('li', null, h('a', { href: 'compte.html?vue=annonces', 'data-i18n': 'nav.proposer' }, t('nav.proposer'))),
          h('li', null, h('a', { href: 'partenaires.html', 'data-i18n': 'nav.partenaires' }, t('nav.partenaires'))),
          h('li', null, h('a', { href: 'compte.html', 'data-i18n': 'nav.compte' }, t('nav.compte'))))),
      h('div', null, h('h2', { class: 'pied__titre', 'data-i18n': 'footer.aide' }, t('footer.aide')),
        h('ul', { class: 'pied__liens' },
          h('li', null, h('a', { href: 'conditions.html', 'data-i18n': 'footer.conditions' }, t('footer.conditions'))),
          h('li', null, h('a', { href: 'mentions-legales.html', 'data-i18n': 'footer.mentions' }, t('footer.mentions'))),
          h('li', null, h('a', { href: 'confidentialite.html', 'data-i18n': 'footer.confidentialite' }, t('footer.confidentialite'))),
          h('li', null, h('a', { href: 'mailto:' + C.brand.email }, C.brand.email)))),
      h('div', { class: 'pied__bas' },
        h('span', { 'data-droits': '' }, t('footer.droits', { annee: annee })),
        h('span', { 'data-i18n': 'footer.villes' }, t('footer.villes')))));
    // l'année est une variable : on la réinjecte au changement de langue
    document.addEventListener('lalla:langue', function () { var s = $('[data-droits]', zone); if (s) s.textContent = t('footer.droits', { annee: annee }); });
  };

  /** Fenêtre de connexion / inscription (email + mot de passe, ou lien magique). */
  L.ui.authentification = function (mode, options) {
    options = options || {};
    if (!L.sb) { L.ui.toast(t('commun.erreur'), 'erreur'); return; }
    var conteneur = h('div', { class: 'auth' });
    var m = L.ui.modale(conteneur, { titre: t(mode === 'inscription' ? 'auth.titre_inscription' : 'auth.titre_connexion') });
    var titre = m.boite.querySelector('.modale__titre');

    function message(el, texte, type) {
      L.vider(el).appendChild(h('p', { class: 'message message--' + (type || 'info'), role: type === 'erreur' ? 'alert' : 'status' }, texte));
    }

    function vueConnexion() {
      titre.textContent = t('auth.titre_connexion');
      var retour = h('div');
      var form = h('form', { class: 'formulaire', novalidate: true },
        champ('email', 'auth.email', { type: 'email', autocomplete: 'email', required: true }),
        champ('mdp', 'auth.mot_de_passe', { type: 'password', autocomplete: 'current-password', required: true, minlength: 8 }),
        L.ui.honeypot(),
        retour,
        h('button', { class: 'bouton bouton--plein', type: 'submit' }, t('auth.se_connecter')),
        h('div', { class: 'separateur' }, h('span', null, t('auth.ou'))),
        h('button', { class: 'bouton bouton--ligne bouton--plein', type: 'button', onclick: lien }, t('auth.lien_magique')),
        h('p', { class: 'auth__bascule' }, t('auth.pas_de_compte') + ' ',
          h('button', { type: 'button', class: 'lien', onclick: vueInscription }, t('auth.creer'))));
      function lien() {
        var email = form.email.value.trim();
        if (!form.email.checkValidity() || !email) { form.email.focus(); form.email.reportValidity(); return; }
        if (L.ui.estRobot(form) || !L.ui.limiter('lien', 3, 600000)) { message(retour, t('commun.trop_requetes'), 'erreur'); return; }
        L.auth.lienMagique(email).then(function (r) {
          if (r.error) message(retour, L.messageErreur(r.error), 'erreur');
          else message(retour, t('auth.lien_envoye'), 'succes');
        });
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        if (L.ui.estRobot(form) || !L.ui.limiter('connexion', 8, 600000)) { message(retour, t('commun.trop_requetes'), 'erreur'); return; }
        var b = form.querySelector('[type=submit]');
        b.disabled = true;
        L.auth.connexion(form.email.value.trim(), form.mdp.value).then(function (r) {
          b.disabled = false;
          if (r.error) { message(retour, t('auth.erreur_identifiants'), 'erreur'); return; }
          m.fermer();
          L.ui.toast(t('auth.bienvenue', { prenom: (r.data.user.user_metadata || {}).prenom || '' }), 'succes');
          if (options.ensuite) options.ensuite();
        });
      });
      L.vider(conteneur).appendChild(form);
      form.email.focus();
    }

    function vueInscription() {
      titre.textContent = t('auth.titre_inscription');
      var retour = h('div');
      var typeBloc = h('div', { class: 'champ', hidden: true },
        h('span', { class: 'champ__libelle' }, t('auth.type')),
        h('div', { class: 'choix-pastilles' }, ['particuliere', 'negafa', 'creatrice'].map(function (ty, i) {
          return h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'type', value: ty, checked: i === 0 }), h('span', null, t('type.' + ty)));
        })));
      var form = h('form', { class: 'formulaire', novalidate: true },
        h('div', { class: 'champ' },
          h('span', { class: 'champ__libelle' }, t('auth.je_suis')),
          h('div', { class: 'choix-pastilles choix-pastilles--colonne' },
            ['cliente', 'fournisseuse', 'partenaire'].map(function (r, i) {
              return h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'role', value: r, checked: (options.role || 'cliente') === r || (i === 0 && !options.role),
                onchange: function () { typeBloc.hidden = form.role.value !== 'fournisseuse'; } }), h('span', null, t('auth.role_' + r)));
            }))),
        typeBloc,
        h('div', { class: 'grille-2' }, champ('prenom', 'auth.prenom', { autocomplete: 'given-name', required: true, maxlength: 60 }),
          champ('nom', 'auth.nom', { autocomplete: 'family-name', required: true, maxlength: 80 })),
        champ('email', 'auth.email', { type: 'email', autocomplete: 'email', required: true }),
        champ('mdp', 'auth.mot_de_passe', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8, aide: t('auth.mdp_regle') }),
        h('label', { class: 'case' }, h('input', { type: 'checkbox', name: 'cgu', required: true }), h('span', { html: t('auth.cgu') })),
        L.ui.honeypot(),
        retour,
        h('button', { class: 'bouton bouton--plein', type: 'submit' }, t('auth.creer')),
        h('p', { class: 'auth__bascule' }, t('auth.deja_compte') + ' ',
          h('button', { type: 'button', class: 'lien', onclick: vueConnexion }, t('auth.se_connecter'))));
      typeBloc.hidden = (options.role || 'cliente') !== 'fournisseuse';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.cgu.checked) { message(retour, t('auth.erreur_cgu'), 'erreur'); return; }
        if (!form.checkValidity()) { form.reportValidity(); return; }
        if (L.ui.estRobot(form) || !L.ui.limiter('inscription', 3, 3600000)) { message(retour, t('commun.trop_requetes'), 'erreur'); return; }
        var role = form.role.value;
        var b = form.querySelector('[type=submit]');
        b.disabled = true;
        L.auth.inscription({
          email: form.email.value.trim(), motDePasse: form.mdp.value,
          prenom: form.prenom.value.trim(), nom: form.nom.value.trim(),
          typeFournisseuse: role === 'fournisseuse' ? form.type.value : null,
          partenaire: role === 'partenaire'
        }).then(function (r) {
          b.disabled = false;
          if (r.error) { message(retour, L.messageErreur(r.error), 'erreur'); return; }
          if (r.data.session) { m.fermer(); location.href = 'compte.html?bienvenue=1'; return; }
          L.vider(form).appendChild(h('p', { class: 'message message--succes' }, t('auth.verifier_email')));
        });
      });
      L.vider(conteneur).appendChild(form);
    }

    if (mode === 'inscription') vueInscription(); else vueConnexion();
  };

  /** Champ de formulaire avec libellé. */
  var champ = (L.ui.champ = function (nom, cleLibelle, attrs) {
    attrs = attrs || {};
    var id = 'c-' + nom + '-' + Math.random().toString(36).slice(2, 6);
    var aide = attrs.aide;
    delete attrs.aide;
    var tag = attrs.tag || 'input';
    delete attrs.tag;
    var options = attrs.options;
    delete attrs.options;
    var controle = h(tag, Object.assign({ id: id, name: nom, class: 'champ__controle', 'aria-describedby': aide ? id + '-aide' : null }, attrs));
    if (options) options.forEach(function (o) { controle.appendChild(h('option', { value: o[0], selected: o[2] || null }, o[1])); });
    return h('div', { class: 'champ' },
      h('label', { class: 'champ__libelle', for: id }, cleLibelle ? (I.existe(cleLibelle) ? t(cleLibelle) : cleLibelle) : ''),
      controle,
      aide ? h('small', { class: 'champ__aide', id: id + '-aide' }, aide) : null);
  });

  L.ui.consentement = function () {
    if (!C.consentement.actif || L.stockage.lire('lalla.consentement', null) !== null) return;
    var b = h('div', { class: 'consentement', role: 'region', 'aria-label': 'Cookies' },
      h('p', { 'data-i18n': 'consent.texte' }, t('consent.texte')),
      h('div', { class: 'actions' },
        h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function () { L.stockage.ecrire('lalla.consentement', false); b.remove(); } }, t('consent.refuser')),
        h('button', { class: 'bouton', type: 'button', onclick: function () { L.stockage.ecrire('lalla.consentement', true); b.remove(); } }, t('consent.accepter'))));
    document.body.appendChild(b);
  };

  // ===========================================================================
  // 5. Images & placeholders
  // ===========================================================================
  L.img = {};

  /** URL publique d'une image (Storage) ou placeholder SVG généré. */
  L.img.url = function (chemin, bucket) {
    if (!chemin) return L.img.placeholder('placeholder:caftan:ivoire:face:0');
    if (chemin.indexOf('placeholder:') === 0) return L.img.placeholder(chemin);
    if (/^(https?:|data:|blob:)/.test(chemin)) return chemin;
    return (ENV.supabaseUrl || '') + '/storage/v1/object/public/' + (bucket || 'tenues') + '/' + chemin.split('/').map(encodeURIComponent).join('/');
  };

  /** URL signée pour les buckets privés (états des lieux, litiges). */
  L.img.signee = function (bucket, chemin) {
    if (!chemin) return Promise.resolve(null);
    if (chemin.indexOf('placeholder:') === 0) return Promise.resolve(L.img.placeholder(chemin));
    return L.sb.storage.from(bucket).createSignedUrl(chemin, 3600).then(function (r) { return r.data && r.data.signedUrl; });
  };

  function teinte(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var c = f < 0 ? 0 : 255, a = Math.abs(f);
    r = Math.round(r + (c - r) * a); g = Math.round(g + (c - g) * a); b = Math.round(b + (c - b) * a);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  var cachePlaceholder = {};
  /**
   * Illustration originale servant de placeholder (aucune photo externe).
   * Format : placeholder:<categorie|sous_categorie>:<couleur>:<face|dos|broderie|portee|doublure>:<graine>
   */
  L.img.placeholder = function (spec) {
    if (cachePlaceholder[spec]) return cachePlaceholder[spec];
    var p = spec.split(':');
    var cat = p[1] || 'caftan', coul = C.couleurs[p[2]] || C.couleurs.emeraude, vue = p[3] || 'face', graine = parseInt(p[4] || '0', 10) || 0;
    var or = '#C3A35A', orClair = '#E2CF9F';
    var fond = teinte(coul, 0.82), fond2 = teinte(coul, 0.7);
    var tissu = coul, ombre = teinte(coul, -0.25), clair = teinte(coul, 0.18);
    var motif = '<defs><pattern id="z" width="' + (36 + (graine % 3) * 6) + '" height="' + (36 + (graine % 3) * 6) + '" patternUnits="userSpaceOnUse"><g fill="none" stroke="' + or + '" stroke-width=".6" opacity=".35"><rect x="9" y="9" width="18" height="18"/><rect x="9" y="9" width="18" height="18" transform="rotate(45 18 18)"/></g></pattern>' +
      '<linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + fond + '"/><stop offset="1" stop-color="' + fond2 + '"/></linearGradient>' +
      '<linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + ombre + '"/><stop offset=".45" stop-color="' + clair + '"/><stop offset="1" stop-color="' + ombre + '"/></linearGradient></defs>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' + motif + '<rect width="300" height="400" fill="url(#l)"/><rect width="300" height="400" fill="url(#z)"/>';
    var caftan = 'M150 58C138 58 128 62 122 66L96 76C80 82 68 96 60 120L34 238C33 244 37 248 43 247L78 240L84 150L80 372C80 377 84 380 89 380L211 380C216 380 220 377 220 372L216 150L222 240L257 247C263 248 267 244 266 238L240 120C232 96 220 82 204 76L178 66C172 62 162 58 150 58Z';
    var homme = 'M150 56C140 56 130 60 124 64L100 74C86 80 78 92 74 110L60 230L86 232L92 130L92 376L208 376L208 130L214 232L240 230L226 110C222 92 214 80 200 74L176 64C170 60 160 56 150 56Z';
    function silhouette(chemin, details) {
      return '<ellipse cx="150" cy="388" rx="92" ry="6" fill="' + ombre + '" opacity=".18"/><path d="' + chemin + '" fill="url(#t)"/>' + details;
    }
    function boutons(y1, y2) {
      var s = '<path d="M150 92V' + y2 + '" stroke="' + or + '" stroke-width="2.2"/>';
      for (var y = y1; y < y2; y += 11) s += '<circle cx="150" cy="' + y + '" r="2.4" fill="' + orClair + '"/>';
      return s;
    }
    var garnitures = '<path d="M136 64L150 92L164 64" fill="none" stroke="' + or + '" stroke-width="3"/><path d="M84 360H216" stroke="' + or + '" stroke-width="6" opacity=".85"/><path d="M40 238L76 232M224 232L260 238" stroke="' + or + '" stroke-width="4"/>';
    var ceinture = '<rect x="84" y="150" width="132" height="18" rx="3" fill="' + or + '"/><g fill="none" stroke="' + teinte(or, -0.3) + '" stroke-width="1">' +
      [100, 124, 176, 200].map(function (x) { return '<rect x="' + (x - 5) + '" y="154" width="10" height="10" transform="rotate(45 ' + x + ' 159)"/>'; }).join('') + '</g><circle cx="150" cy="159" r="9" fill="' + orClair + '" stroke="' + teinte(or, -0.3) + '"/>';
    var tete = '<circle cx="150" cy="34" r="17" fill="#3A2C25"/><path d="M133 30C134 14 166 14 167 30C170 22 160 10 150 10S130 22 133 30Z" fill="#1E1714"/><rect x="144" y="48" width="12" height="12" fill="#C99B7A"/>';
    var corps = '';
    if (cat === 'mdamma' || cat === 'bijoux' || cat === 'couronne') {
      if (cat === 'mdamma') {
        corps = '<rect x="30" y="160" width="240" height="70" rx="8" fill="' + or + '"/><rect x="38" y="168" width="224" height="54" rx="5" fill="none" stroke="' + teinte(or, -0.3) + '"/>' +
          '<g transform="translate(150 195)"><rect x="-26" y="-26" width="52" height="52" fill="' + orClair + '" transform="rotate(45)"/><rect x="-26" y="-26" width="52" height="52" fill="' + or + '"/><circle r="12" fill="' + coul + '"/></g>';
        for (var i = 0; i < 8; i++) corps += '<circle cx="' + (52 + i * 12 + (i > 3 ? 100 : 0)) + '" cy="195" r="3" fill="' + orClair + '"/>';
      } else if (cat === 'couronne') {
        corps = '<path d="M50 250C90 230 210 230 250 250L240 270C200 254 100 254 60 270Z" fill="' + or + '"/>';
        for (var j = 0; j < 7; j++) {
          var x = 70 + j * 26.6, hy = 150 + Math.abs(3 - j) * 16;
          corps += '<path d="M' + (x - 12) + ' 246L' + x + ' ' + hy + 'L' + (x + 12) + ' 246Z" fill="none" stroke="' + or + '" stroke-width="3"/><circle cx="' + x + '" cy="' + (hy - 6) + '" r="5" fill="' + coul + '" stroke="' + orClair + '" stroke-width="2"/>';
        }
      } else {
        corps = '<path d="M60 120C70 260 230 260 240 120" fill="none" stroke="' + or + '" stroke-width="4"/><path d="M80 120C92 230 208 230 220 120" fill="none" stroke="' + orClair + '" stroke-width="2"/>';
        for (var k = 0; k < 9; k++) {
          var a = Math.PI * (0.12 + k * 0.095), cx = 150 - 88 * Math.cos(a), cy = 150 + 88 * Math.sin(a);
          corps += '<path d="M' + cx.toFixed(1) + ' ' + cy.toFixed(1) + 'l-7 16l7 12l7 -12z" fill="' + coul + '" stroke="' + or + '" stroke-width="2"/>';
        }
      }
      svg += corps;
    } else if (vue === 'broderie' || vue === 'doublure') {
      if (vue === 'doublure') {
        svg += '<rect x="20" y="20" width="260" height="360" fill="' + teinte(coul, 0.55) + '"/><path d="M20 20L280 380M280 20L20 380" stroke="' + teinte(coul, 0.4) + '" stroke-width="1"/>';
      } else {
        svg += '<rect width="300" height="400" fill="' + tissu + '"/><g transform="translate(150 200)" fill="none" stroke="' + or + '">';
        for (var r = 1; r <= 4; r++) {
          var s = 26 * r;
          svg += '<rect x="' + (-s / 2) + '" y="' + (-s / 2) + '" width="' + s + '" height="' + s + '" stroke-width="' + (r === 1 ? 3 : 1.6) + '"/><rect x="' + (-s / 2) + '" y="' + (-s / 2) + '" width="' + s + '" height="' + s + '" transform="rotate(45)" stroke-width="' + (r === 1 ? 3 : 1.6) + '"/>';
        }
        svg += '<circle r="10" fill="' + orClair + '"/></g>';
        for (var d = 0; d < 16; d++) {
          var ang = (d / 16) * Math.PI * 2;
          svg += '<circle cx="' + (150 + Math.cos(ang) * 120).toFixed(1) + '" cy="' + (200 + Math.sin(ang) * 120).toFixed(1) + '" r="3" fill="' + orClair + '"/>';
        }
      }
    } else {
      var chemin = cat === 'homme' ? homme : caftan;
      var details = '';
      if (vue === 'dos') {
        details = '<path d="M150 66V370" stroke="' + ombre + '" stroke-width="1" opacity=".5"/><path d="M84 360H216" stroke="' + or + '" stroke-width="6" opacity=".85"/>';
      } else {
        details = garnitures + boutons(cat === 'homme' ? 100 : 104, cat === 'homme' ? 200 : 340);
        if (cat === 'takchita' || cat === 'mariee') {
          details += '<path d="M122 66L92 140L86 376L130 376L146 96Z" fill="' + teinte(coul, cat === 'mariee' ? 0.45 : 0.3) + '" opacity=".55"/><path d="M178 66L208 140L214 376L170 376L154 96Z" fill="' + teinte(coul, cat === 'mariee' ? 0.45 : 0.3) + '" opacity=".55"/>' + ceinture;
        }
        if (cat === 'mariee') {
          for (var e = 0; e < 22; e++) details += '<circle cx="' + (96 + (e * 37) % 110) + '" cy="' + (190 + (e * 53) % 160) + '" r="1.8" fill="' + orClair + '"/>';
        }
      }
      var groupe = silhouette(chemin, details);
      if (cat === 'enfant') groupe = '<g transform="translate(37 90) scale(.75)">' + groupe + '</g>';
      if (vue === 'portee') groupe = (cat === 'enfant' ? '<g transform="translate(37 90) scale(.75)">' + tete + '</g>' : tete) + groupe;
      svg += groupe;
    }
    svg += '</svg>';
    cachePlaceholder[spec] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return cachePlaceholder[spec];
  };

  /** Compression WebP côté navigateur avant envoi (browser-image-compression). */
  L.img.compresser = function (fichier, options) {
    options = options || {};
    var charger = window.imageCompression ? Promise.resolve() : new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = C.cdn.compression;
      s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
    return charger.then(function () {
      return window.imageCompression(fichier, {
        maxSizeMB: options.maxMo || 0.6,
        maxWidthOrHeight: options.max || 1800,
        fileType: 'image/webp',
        initialQuality: 0.82,
        useWebWorker: true
      });
    }).then(function (blob) {
      return new File([blob], (fichier.name || 'photo').replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
    });
  };

  /** Crée une <img> chargée paresseusement (avec placeholder si chemin vide). */
  L.img.element = function (chemin, alt, attrs) {
    return h('img', Object.assign({ src: L.img.url(chemin), alt: alt || '', loading: 'lazy', decoding: 'async' }, attrs || {}));
  };

  // ===========================================================================
  // 6. Panier (stocké dans le navigateur ; le serveur recalcule tout)
  // ===========================================================================
  var CLE_PANIER = 'lalla.panier';
  L.panier = {
    lire: function () { return L.stockage.lire(CLE_PANIER, { articles: [], dates: null }); },
    ecrire: function (p) {
      L.stockage.ecrire(CLE_PANIER, p);
      $$('.panier-compteur').forEach(function (c) { c.textContent = p.articles.length ? String(p.articles.length) : ''; });
      document.dispatchEvent(new CustomEvent('lalla:panier'));
    },
    nb: function () { return L.panier.lire().articles.length; },
    contient: function (id) { return L.panier.lire().articles.some(function (a) { return a.tenue_id === id; }); },
    ajouter: function (article) {
      var p = L.panier.lire();
      if (p.articles.some(function (a) { return a.tenue_id === article.tenue_id; })) return false;
      p.articles.push(article);
      L.panier.ecrire(p);
      return true;
    },
    retirer: function (id) {
      var p = L.panier.lire();
      p.articles = p.articles.filter(function (a) { return a.tenue_id !== id; });
      L.panier.ecrire(p);
    },
    definirDates: function (dates) { var p = L.panier.lire(); p.dates = dates; L.panier.ecrire(p); },
    vider: function () { L.panier.ecrire({ articles: [], dates: null }); }
  };

  // ===========================================================================
  // 7. Motion design (GSAP + Lenis) — n'anime que transform et opacity
  // ===========================================================================
  L.motion = {
    lenis: null,
    actif: false,
    reduit: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    mobile: function () { return window.innerWidth < 900; },
    duree: function (d) { return L.motion.mobile() ? d * 0.6 : d; },
    init: function () {
      if (!window.gsap) return;
      var plugins = [window.ScrollTrigger, window.Flip, window.SplitText].filter(Boolean);
      gsap.registerPlugin.apply(gsap, plugins);
      L.motion.actif = !L.motion.reduit;
      if (L.motion.reduit) {
        document.documentElement.classList.add('mouvement-reduit');
        return;
      }
      document.documentElement.classList.add('anime');
      if (window.Lenis && !L.motion.mobile()) {
        var lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.95 });
        L.motion.lenis = lenis;
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (temps) { lenis.raf(temps * 1000); });
        gsap.ticker.lagSmoothing(0);
        // Ancres internes en douceur
        document.addEventListener('click', function (e) {
          var a = e.target.closest('a[href*="#"]');
          if (!a) return;
          var url = new URL(a.href, location.href);
          if (url.pathname !== location.pathname || !url.hash) return;
          var cible = document.getElementById(url.hash.slice(1));
          if (!cible) return;
          e.preventDefault();
          lenis.scrollTo(cible, { offset: -72 });
          history.replaceState(null, '', url.hash);
        });
      }
    },
    /** Apparition au défilement des éléments [data-reveal]. */
    reveler: function (racine) {
      var els = $$('[data-reveal]:not(.est-revele)', racine);
      if (!els.length) return;
      if (!L.motion.actif || !window.ScrollTrigger) { els.forEach(function (el) { el.classList.add('est-revele'); }); return; }
      ScrollTrigger.batch(els, {
        start: 'top 88%',
        once: true,
        onEnter: function (lot) {
          lot.forEach(function (el) { el.classList.add('est-revele'); });
          gsap.fromTo(lot, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: L.motion.duree(0.9), ease: 'power3.out', stagger: 0.08, overwrite: true, clearProps: 'transform' });
        }
      });
    },
    /** Titre découpé en lignes qui montent depuis un masque. */
    titreLignes: function (el, delai) {
      if (!el) return;
      if (!L.motion.actif || !window.SplitText) { gsap && gsap.set(el, { opacity: 1 }); return; }
      gsap.set(el, { opacity: 1 });
      window.SplitText.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'ligne',
        onSplit: function (self) {
          return gsap.from(self.lines, { yPercent: 110, duration: L.motion.duree(1.05), ease: 'expo.out', stagger: 0.09, delay: delai || 0 });
        }
      });
    },
    /** Motif zellige dessiné trait par trait (stroke-dashoffset). */
    dessinerMotif: function (svg, delai) {
      if (!svg) return;
      var traits = $$('path, line, polyline, polygon, rect, circle', svg);
      if (!L.motion.actif) return;
      traits.forEach(function (tr) {
        var lg = tr.getTotalLength ? tr.getTotalLength() : 400;
        tr.style.strokeDasharray = lg;
        tr.style.strokeDashoffset = lg;
      });
      gsap.to(traits, { strokeDashoffset: 0, duration: L.motion.duree(1.8), ease: 'power2.inOut', stagger: { each: 0.035, from: 'center' }, delay: delai || 0 });
    },
    /** Compteur animé (tween d'un objet, mise à jour du texte). */
    compteur: function (el, valeur, format) {
      var courant = Number(el.dataset.valeur || 0);
      el.dataset.valeur = valeur;
      if (!L.motion.actif) { el.textContent = format(valeur); return; }
      var o = { v: courant };
      gsap.to(o, { v: valeur, duration: 0.6, ease: 'power2.out', onUpdate: function () { el.textContent = format(Math.round(o.v)); } });
    },
    /** Mémorise la position d'une image avant de naviguer (transition Flip vers la fiche). */
    preparerFlip: function (img, url) {
      if (!img || !L.motion.actif) { location.href = url; return; }
      var r = img.getBoundingClientRect();
      try {
        sessionStorage.setItem('lalla.flip', JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height, src: img.currentSrc || img.src, t: Date.now() }));
      } catch (e) { /* ignoré */ }
      gsap.to('main > *:not(.garder)', { opacity: 0, duration: 0.25, ease: 'power1.out' });
      gsap.to(img, { scale: 1.03, duration: 0.25, onComplete: function () { location.href = url; } });
    },
    /** Sur la fiche : l'image principale part de la position mémorisée (Flip.fit). */
    jouerFlip: function (cible) {
      var brut;
      try { brut = sessionStorage.getItem('lalla.flip'); sessionStorage.removeItem('lalla.flip'); } catch (e) { return; }
      if (!brut || !cible || !L.motion.actif || !window.Flip) return;
      var s = JSON.parse(brut);
      if (Date.now() - s.t > 4000) return;
      var fantome = h('div', { class: 'flip-fantome', style: { left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px' } });
      document.body.appendChild(fantome);
      window.Flip.fit(cible, fantome, { scale: true, absolute: false });
      fantome.remove();
      gsap.to(cible, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.8, ease: 'expo.out', clearProps: 'transform' });
    }
  };

  // ===========================================================================
  // Démarrage
  // ===========================================================================
  L.pages = L.pages || {};

  function demarrer() {
    initSupabase();
    L.motion.init();
    L.ui.entete();
    L.ui.pied();
    I.appliquer(document);
    L.auth.init();
    L.ui.consentement();
    var page = document.body.getAttribute('data-page');
    var fn = L.pages[page];
    if (fn) {
      try { fn(); } catch (e) { console.error(e); }
    }
    L.motion.reveler(document);
    if (L.param('connexion') === '1') L.auth.pret.then(function () { if (!L.session) L.ui.authentification('connexion'); });
  }

  // Les scripts « defer » s'exécutent avant DOMContentLoaded : on attend que compte.js / admin.js
  // aient enregistré leur page avant de démarrer.
  if (document.readyState === 'complete') demarrer();
  else document.addEventListener('DOMContentLoaded', demarrer);
})();
