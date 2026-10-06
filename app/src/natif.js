// LALLAT : couche propre à l'application iOS / Android.
// L'interface est une copie de celle du site (même architecture, même serveur, même base de données) ;
// ce fichier est ajouté à la copie par scripts/construire.mjs. Le site n'est jamais modifié.
(function () {
  'use strict';
  var SITE = '__LALLAT_SITE__';
  window.LALLAT_SITE = SITE;
  var Cap = window.Capacitor;
  var natif = Boolean(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var P = natif && Cap.Plugins ? Cap.Plugins : {};
  if (natif) document.documentElement.classList.add('est-app', 'est-app--' + Cap.getPlatform());

  // Pages Stripe ouvertes depuis l'app : on les affiche dans une fenêtre sécurisée par-dessus l'app,
  // puis on revient sur la bonne page (paiement, carte de caution, versements, essayage).
  var REDIRECTIONS = {
    'checkout-creer': function (c) { return c.commande_id ? { ok: 'panier.html?commande=' + c.commande_id + '&paiement=ok', non: 'panier.html?commande=' + c.commande_id } : null; },
    'caution-setup': function (c) { return c.commande_id ? { ok: 'panier.html?commande=' + c.commande_id + '&etape=caution&caution=ok', non: 'panier.html?commande=' + c.commande_id } : null; },
    'caution-reessayer': function () { return { ok: avec(pageActuelle(), 'caution=ok'), non: pageActuelle() }; },
    'connect-onboarding': function () { return { ok: 'compte.html?vue=paiements&connect=retour', non: 'compte.html?vue=paiements' }; },
    'connect-tableau': function () { return { ok: pageActuelle(), non: pageActuelle() }; },
    'identite-session': function () { return { ok: 'compte.html?vue=profil&identite=retour', non: pageActuelle() }; },
    'essayage-creer': function () { return { ok: 'compte.html?vue=essayages&essayage=ok', non: pageActuelle() }; },
    'showroom-inscrire': function () { return { ok: 'compte.html?vue=essayages&essayage=ok', non: pageActuelle() }; }
  };
  function pageActuelle() { return location.pathname.replace(/^\//, '') + location.search; }
  function avec(url, param) { return url + (url.indexOf('?') >= 0 ? '&' : '?') + param; }
  var retourEnAttente = null;
  function revenir(etat) {
    var r = retourEnAttente;
    retourEnAttente = null;
    if (r) location.replace(etat === 'ok' ? r.ok : r.non);
  }

  // Appels au serveur : adresse complète du site, et indication « app » pour les retours Stripe.
  var fetchOrigine = window.fetch.bind(window);
  window.fetch = function (entree, options) {
    if (typeof entree !== 'string' || entree.indexOf('/api/') !== 0) return fetchOrigine(entree, options);
    var action = (entree.match(/^\/api\/v1\/([a-z0-9-]+)/) || [])[1];
    var cible = REDIRECTIONS[action];
    var corps = {};
    if (cible && options && typeof options.body === 'string') {
      try { corps = JSON.parse(options.body) || {}; } catch (e) { corps = {}; }
      corps.app = true;
      options = Object.assign({}, options, { body: JSON.stringify(corps) });
    }
    var reponse = fetchOrigine(SITE + entree, options);
    if (!cible || !P.Browser) return reponse;
    return reponse.then(function (r) {
      if (!r.ok) return r;
      return r.clone().json().then(function (j) {
        if (!j || !j.url) return r;
        retourEnAttente = cible(corps);
        P.Browser.open({ url: j.url, presentationStyle: 'fullscreen' }).catch(function () { location.href = j.url; });
        j.url = '#'; // la page n'est pas quittée : la fenêtre Stripe s'ouvre par-dessus
        return new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }).catch(function () { return r; });
    });
  };

  if (!natif) return;

  // Retour de Stripe : lallat://retour?etat=ok|annule|relance
  if (P.App) {
    P.App.addListener('appUrlOpen', function (e) {
      var m = /^lallat:\/\/retour\?etat=(\w+)/.exec(e.url || '');
      if (!m) return;
      if (P.Browser) P.Browser.close().catch(function () {});
      revenir(m[1]);
    });
    // Android : retour arrière, puis fermeture de l'app
    P.App.addListener('backButton', function (e) {
      var fermer = document.querySelector('.modale.est-ouverte .modale__fermer');
      if (fermer) { fermer.click(); return; }
      if (e.canGoBack) history.back(); else P.App.exitApp();
    });
  }
  // Fenêtre Stripe fermée à la main : on recharge l'état de la page.
  if (P.Browser) P.Browser.addListener('browserFinished', function () { revenir('ok'); });

  // Partage d'une tenue : feuille de partage du téléphone au lieu de WhatsApp seul
  var ouvrir = window.open.bind(window);
  window.open = function (url) {
    var m = /^https:\/\/wa\.me\/\?text=(.*)$/.exec(url || '');
    if (m && P.Share) { P.Share.share({ text: decodeURIComponent(m[1]) }).catch(function () {}); return null; }
    if (/^https?:/.test(url || '') && P.Browser) { P.Browser.open({ url: url }).catch(function () {}); return null; }
    return ouvrir.apply(window, arguments);
  };

  document.addEventListener('click', function (e) {
    var cible = e.target.closest ? e.target.closest('a[href], button') : null;
    if (!cible) return;
    // Petit retour tactile sur les actions principales
    if (P.Haptics && cible.matches('.reservation-boite [type=submit], .bouton--plein')) P.Haptics.impact({ style: 'LIGHT' }).catch(function () {});
    // Liens vers d'autres sites (Instagram, emails partenaires…) : navigateur sécurisé
    if (cible.tagName !== 'A') return;
    var href = cible.getAttribute('href') || '';
    if (!/^https?:\/\//.test(href) || href.indexOf(SITE) === 0) return;
    if (!P.Browser) return;
    e.preventDefault();
    P.Browser.open({ url: href }).catch(function () {});
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    if (P.StatusBar) {
      P.StatusBar.setStyle({ style: 'LIGHT' }).catch(function () {});
      if (Cap.getPlatform() === 'android') P.StatusBar.setBackgroundColor({ color: '#FAF6F0' }).catch(function () {});
    }
  });
})();
