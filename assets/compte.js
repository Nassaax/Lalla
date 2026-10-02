/*
 * LALLA — espace personnel (compte.html) : tableau de bord selon le rôle.
 * Cliente : réservations, états des lieux, essayages, mensurations, avis.
 * Fournisseuse : demandes, annonces (ajout en série), calendrier, revenus, paiements, boutique.
 * Partenaire : fiche annuaire, demandes de devis.
 */
(function () {
  'use strict';
  var L = window.Lalla, I = window.I18N, t = I.t, h = L.h, $ = L.$, $$ = L.$$, C = L.config;

  var etat = { vue: null, profil: null, prive: null };

  L.pages.compte = function () {
    var zone = $('[data-compte]');
    L.ui.chargement(zone);
    L.auth.pret.then(function () {
      if (!L.session) {
        L.vider(zone).appendChild(h('div', { class: 'vide' },
          h('p', null, t('compte.connexion_texte')),
          h('div', { class: 'actions', style: { justifyContent: 'center' } },
            h('button', { class: 'bouton', type: 'button', onclick: function () { L.ui.authentification('connexion', { ensuite: function () { location.reload(); } }); } }, t('auth.se_connecter')),
            h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function () { L.ui.authentification('inscription'); } }, t('auth.creer')))));
        L.auth.surChangement(function (s) { if (s) location.reload(); });
        return;
      }
      chargerProfil().then(function () { construire(zone); });
    });
  };

  function chargerProfil() {
    return Promise.all([
      L.sb.from('profils').select('*').eq('id', L.session.user.id).single(),
      L.sb.from('profils_prives').select('*').eq('id', L.session.user.id).single()
    ]).then(function (r) { etat.profil = r[0].data; etat.prive = r[1].data || {}; L.profil = etat.profil; });
  }

  function vuesDisponibles() {
    var p = etat.profil, v = [];
    if (p.est_cliente) v.push(['reservations', 'compte.v_reservations'], ['essayages', 'compte.v_essayages'], ['mensurations', 'compte.v_mensurations']);
    if (p.est_fournisseuse) v.push(['demandes', 'compte.v_demandes'], ['annonces', 'compte.v_annonces'], ['calendrier', 'compte.v_calendrier'], ['revenus', 'compte.v_revenus'], ['paiements', 'compte.v_paiements']);
    if (p.est_fournisseuse && p.type_fournisseuse !== 'particuliere') v.push(['boutique', 'compte.v_boutique']);
    if (p.est_partenaire) v.push(['partenaire', 'compte.v_partenaire'], ['leads', 'compte.v_leads']);
    if (!p.est_fournisseuse) v.push(['annonces', 'compte.v_devenir']);
    v.push(['profil', 'compte.v_profil']);
    return v;
  }

  function construire(zone) {
    var vues = vuesDisponibles();
    var demandee = L.param('vue');
    etat.vue = vues.some(function (v) { return v[0] === demandee; }) ? demandee : vues[0][0];
    var nav = h('nav', { class: 'tableau__nav', 'aria-label': t('compte.navigation') });
    var contenu = h('div', { class: 'tableau__contenu' });
    vues.forEach(function (v) {
      nav.appendChild(h('a', { href: '?vue=' + v[0], class: 'onglet' + (v[0] === etat.vue ? ' est-actif' : ''), 'aria-current': v[0] === etat.vue ? 'page' : null, 'data-vue': v[0],
        onclick: function (e) { e.preventDefault(); aller(v[0]); } }, h('span', null, t(v[1])), h('span', { class: 'onglet__badge', hidden: true })));
    });
    nav.appendChild(h('button', { class: 'onglet', type: 'button', onclick: function () { L.auth.deconnexion(); } }, t('nav.deconnexion')));
    var p = etat.profil;
    L.vider(zone).appendChild(h('div', null,
      h('div', { class: 'page-entete', style: { borderBottom: 0, paddingBottom: 0 } },
        h('p', { class: 'surtitre' }, [p.est_cliente ? t('role.cliente') : null, p.est_fournisseuse ? t('type.' + p.type_fournisseuse) : null, p.est_partenaire ? t('role.partenaire') : null].filter(Boolean).join(' · ')),
        h('h1', null, t('compte.bonjour', { prenom: etat.prive.prenom || p.nom_affiche }))),
      h('div', { class: 'tableau' }, nav, contenu)));
    if (L.param('bienvenue')) L.ui.toast(t('compte.bienvenue'), 'succes');
    function aller(v) {
      etat.vue = v;
      $$('.onglet', nav).forEach(function (o) { var a = o.dataset.vue === v; o.classList.toggle('est-actif', a); if (o.dataset.vue) o.setAttribute('aria-current', a ? 'page' : 'false'); });
      var u = new URL(location.href); u.searchParams.set('vue', v); ['reservation', 'edl', 'avis', 'tenue', 'connect', 'essayage', 'bienvenue'].forEach(function (k) { if (k !== 'reservation' || v !== 'demandes') u.searchParams.delete(k); });
      history.replaceState(null, '', u);
      afficher(contenu);
    }
    etat.aller = aller;
    afficher(contenu);
    badges(nav);
  }

  function badges(nav) {
    if (!etat.profil.est_fournisseuse) return;
    L.sb.from('reservations').select('id', { count: 'exact', head: true }).eq('fournisseuse_id', etat.profil.id).eq('statut', 'demande').then(function (r) {
      var b = $('[data-vue=demandes] .onglet__badge', nav);
      if (b && r.count) { b.hidden = false; b.textContent = String(r.count); }
    });
  }

  var VUES = {};
  function afficher(contenu) {
    L.ui.chargement(contenu);
    var fn = VUES[etat.vue];
    Promise.resolve().then(function () { return fn(contenu); }).then(function () {
      L.motion.reveler(contenu);
      if (window.gsap && L.motion.actif) gsap.from(contenu.children, { opacity: 0, y: 12, duration: 0.45, stagger: 0.04, ease: 'power2.out' });
    }).catch(function (e) { console.error(e); L.ui.etatVide(contenu, L.messageErreur(e)); });
  }

  function panneau(titre, contenu, action) {
    return h('section', { class: 'panneau' }, h('div', { class: 'panneau__tete' }, h('h2', { class: 'panneau__titre' }, titre), action || null), contenu);
  }
  function statut(cle, prefixe) { return h('span', { class: 'statut statut--' + cle }, t((prefixe || 'statut.') + cle)); }
  function erreur(zone, err) { L.vider(zone).appendChild(h('p', { class: 'message message--erreur', role: 'alert' }, L.messageErreur(err))); }
  function sb(promesse) { return promesse.then(function (r) { if (r.error) throw r.error; return r.data; }); }

  // ===========================================================================
  // Cliente : réservations
  // ===========================================================================
  VUES.reservations = function (contenu) {
    return sb(L.sb.from('reservations').select('*, reservation_lignes(id, titre_snapshot, tenue_id, prix_location_cents), fournisseuse:profils!reservations_fournisseuse_id_fkey(id, nom_affiche, boutique_nom), avis(auteur_id)')
      .eq('cliente_id', etat.profil.id).order('date_debut', { ascending: false })).then(function (liste) {
      L.vider(contenu);
      if (!liste.length) { L.ui.etatVide(contenu, t('compte.aucune_reservation'), h('a', { class: 'bouton', href: 'catalogue.html' }, t('index.hero.cta'))); return; }
      var corps = h('div');
      liste.forEach(function (r) { corps.appendChild(ligneReservation(r, 'cliente')); });
      contenu.appendChild(panneau(t('compte.v_reservations'), corps));
      ouvrirDepuisUrl(liste, 'cliente');
    });
  };

  function ouvrirDepuisUrl(liste, role) {
    var edl = L.param('edl'), avis = L.param('avis');
    var r = liste.find(function (x) { return x.id === edl || x.id === avis; });
    if (r && edl) etatDesLieux(r, r.statut === 'remise' ? 'retour' : 'remise', role);
    if (r && avis) laisserAvis(r, role);
  }

  function ligneReservation(r, role) {
    var f = r.fournisseuse || {};
    var titres = (r.reservation_lignes || []).map(function (l) { return l.titre_snapshot; }).join(', ');
    var actions = h('div', { class: 'actions', style: { marginTop: 0 } });
    var aDejaAvis = (r.avis || []).some(function (a) { return a.auteur_id === etat.profil.id; });
    if (role === 'cliente' && ['demande', 'acceptee'].indexOf(r.statut) >= 0) actions.appendChild(h('a', { class: 'bouton bouton--petit', href: 'panier.html?commande=' + r.commande_id }, r.statut === 'acceptee' ? t('panier.payer') : t('commun.voir')));
    if (['payee'].indexOf(r.statut) >= 0) actions.appendChild(h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function () { etatDesLieux(r, 'remise', role); } }, t('edl.remise')));
    if (r.statut === 'remise') actions.appendChild(h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function () { etatDesLieux(r, 'retour', role); } }, t('edl.retour')));
    if (['rendue', 'cloturee', 'litige'].indexOf(r.statut) >= 0) actions.appendChild(h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { etatDesLieux(r, 'retour', role, true); } }, t('edl.voir')));
    if (['rendue', 'cloturee'].indexOf(r.statut) >= 0 && !aDejaAvis) actions.appendChild(h('button', { class: 'bouton bouton--or bouton--petit', type: 'button', onclick: function () { laisserAvis(r, role); } }, t('avis.laisser')));
    if (role === 'fournisseuse' && r.statut === 'rendue' && new Date(r.litige_deadline) > new Date()) actions.appendChild(h('button', { class: 'bouton bouton--danger bouton--petit', type: 'button', onclick: function () { ouvrirLitige(r); } }, t('litige.ouvrir')));
    if (role === 'fournisseuse' && r.mode_remise === 'envoi' && ['payee', 'remise'].indexOf(r.statut) >= 0) actions.appendChild(h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { saisirSuivi(r); } }, t('compte.suivi')));
    if (['demande', 'acceptee', 'payee'].indexOf(r.statut) >= 0) actions.appendChild(h('button', { class: 'lien', type: 'button', onclick: function () { annuler(r, role); } }, t('compte.annuler')));
    if (role === 'cliente' && ['payee', 'remise'].indexOf(r.statut) >= 0 && r.caution_statut === 'echec') actions.appendChild(h('a', { class: 'bouton bouton--danger bouton--petit', href: 'panier.html?commande=' + r.commande_id + '&etape=caution' }, t('panier.autoriser_caution')));
    var infos = [t('commun.du_au', { debut: L.date(r.date_debut), fin: L.date(r.date_fin) })];
    if (role === 'cliente') infos.push(f.boutique_nom || f.nom_affiche || '');
    return h('article', { class: 'ligne-resa', id: 'resa-' + r.id },
      h('div', { class: 'ligne-resa__tete' }, h('h3', { class: 'ligne-resa__titre' }, titres), statut(r.statut)),
      h('p', { class: 'texte', style: { margin: 0, fontSize: '14px' } }, infos.filter(Boolean).join(' · ')),
      h('p', { style: { margin: 0, fontSize: '13px' } }, L.euros(r.montant_location_cents) + ' · ' + t('panier.caution') + ' ' + L.euros(r.caution_cents) + ' ',
        r.caution_cents ? statut(r.caution_statut, 'caution.') : null,
        r.numero_suivi ? h('span', { class: 'texte' }, ' · ' + t('compte.suivi') + ' : ' + r.numero_suivi) : null),
      r.statut === 'rendue' && role === 'fournisseuse' ? h('p', { class: 'champ__aide', style: { margin: 0 } }, t('litige.delai', { date: L.dateHeure(r.litige_deadline) })) : null,
      actions);
  }

  function annuler(r, role) {
    var aide = role === 'fournisseuse' && r.statut !== 'demande' ? t('compte.annuler_penalite') : r.statut === 'payee' ? t('compte.annuler_politique') : '';
    var form = h('form', { class: 'formulaire' },
      aide ? h('p', { class: 'message message--alerte' }, aide) : null,
      L.ui.champ('motif', 'compte.motif', { tag: 'textarea', maxlength: 300 }),
      h('div', { class: 'retour' }),
      h('div', { class: 'actions' }, h('button', { class: 'bouton bouton--danger', type: 'submit' }, t('compte.confirmer_annulation'))));
    var m = L.ui.modale(form, { titre: t('compte.annuler') });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.querySelector('[type=submit]').disabled = true;
      L.api('reservation-annuler', { reservation_id: r.id, motif: form.motif.value || null }).then(function (res) {
        m.fermer();
        L.ui.toast(res.rembourse_cents ? t('compte.annulee_rembourse', { montant: L.euros(res.rembourse_cents) }) : t('compte.annulee'), 'succes');
        etat.aller(etat.vue);
      }).catch(function (err) { form.querySelector('[type=submit]').disabled = false; erreur($('.retour', form), err); });
    });
  }

  function saisirSuivi(r) {
    var form = h('form', { class: 'formulaire' }, L.ui.champ('suivi', 'compte.suivi', { required: true, minlength: 4, maxlength: 60, value: r.numero_suivi || '' }), h('div', { class: 'retour' }), h('button', { class: 'bouton', type: 'submit' }, t('commun.enregistrer')));
    var m = L.ui.modale(form, { titre: t('compte.suivi') });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      L.api('reservation-envoi', { reservation_id: r.id, numero_suivi: form.suivi.value }).then(function () { m.fermer(); etat.aller(etat.vue); }).catch(function (err) { erreur($('.retour', form), err); });
    });
  }

  // ===========================================================================
  // État des lieux (remise / retour) — pensé pour mobile
  // ===========================================================================
  var SLOTS = [['photo_face', 'edl.face'], ['photo_dos', 'edl.dos'], ['photo_broderies', 'edl.broderies'], ['photo_doublure', 'edl.doublure']];

  function etatDesLieux(r, type, role, lectureSeule) {
    var contenu = h('div', { class: 'edl' });
    var m = L.ui.modale(contenu, { titre: t(type === 'remise' ? 'edl.titre_remise' : 'edl.titre_retour'), large: true });
    L.ui.chargement(contenu);
    Promise.all([
      sb(L.sb.from('reservation_lignes').select('id, titre_snapshot, tenue_id, tenues(categorie)').eq('reservation_id', r.id)),
      sb(L.sb.from('etats_des_lieux').select('*').eq('reservation_id', r.id))
    ]).then(function (res) {
      var lignes = res[0], tous = res[1];
      L.vider(contenu);
      if (type === 'remise' && r.caution_cents && r.caution_statut !== 'autorisee' && !lectureSeule) {
        contenu.appendChild(h('p', { class: 'message message--alerte' }, t('edl.caution_requise')));
      }
      contenu.appendChild(h('p', { class: 'texte' }, t('edl.intro')));
      var verrouille = lectureSeule || tous.some(function (e) { return e.type === type && (e.valide_cliente_at || e.valide_fournisseuse_at); });
      lignes.forEach(function (l) {
        var e = tous.find(function (x) { return x.ligne_id === l.id && x.type === type; }) || { reservation_id: r.id, ligne_id: l.id, type: type };
        var remise = type === 'retour' ? tous.find(function (x) { return x.ligne_id === l.id && x.type === 'remise'; }) : null;
        contenu.appendChild(blocEdl(r, l, e, remise, verrouille));
      });
      var validations = tous.filter(function (e) { return e.type === type; });
      var vC = validations.length && validations.every(function (e) { return e.valide_cliente_at; }) ? validations[0].valide_cliente_at : null;
      var vF = validations.length && validations.every(function (e) { return e.valide_fournisseuse_at; }) ? validations[0].valide_fournisseuse_at : null;
      contenu.appendChild(h('div', { class: 'panneau', style: { margin: 0 } },
        h('p', { class: 'horodatage' }, t('edl.validation_cliente') + ' : ' + (vC ? L.dateHeure(vC) : '—')),
        h('p', { class: 'horodatage', style: { margin: 0 } }, t('edl.validation_fournisseuse') + ' : ' + (vF ? L.dateHeure(vF) : '—'))));
      var dejaMoi = role === 'cliente' ? vC : vF;
      var retour = h('div');
      contenu.appendChild(retour);
      if (!lectureSeule && !dejaMoi) {
        contenu.appendChild(h('button', { class: 'bouton bouton--plein', type: 'button', onclick: function (ev) {
          var b = ev.currentTarget;
          b.disabled = true;
          L.api('edl-valider', { reservation_id: r.id, type: type }).then(function (res) {
            L.ui.toast(res.complet ? t('edl.complet_' + type) : t('edl.valide_attente'), 'succes');
            m.fermer();
            etat.aller(etat.vue);
          }).catch(function (err) { b.disabled = false; erreur(retour, err); });
        } }, t('edl.valider')));
        contenu.appendChild(h('p', { class: 'champ__aide' }, t('edl.valider_aide')));
      }
    }).catch(function (err) { erreur(contenu, err); });
  }

  function blocEdl(r, l, e, remise, verrouille) {
    var categorie = l.tenues && l.tenues.categorie;
    var slots = categorie === 'accessoire' ? SLOTS.filter(function (s) { return s[0] === 'photo_face' || s[0] === 'photo_broderies'; }) : SLOTS;
    var grille = h('div', { class: 'edl__photos' });
    var donnees = Object.assign({}, e);
    slots.forEach(function (s) {
      var img = h('img', { alt: '', hidden: true });
      var depot = h('label', { class: 'depot' + (donnees[s[0]] ? ' depot--rempli' : '') }, img, h('span', { class: 'depot__libelle' }, t(s[1]), donnees[s[0]] ? '' : h('span', { class: 'depot__requis' }, ' *')));
      if (donnees[s[0]]) L.img.signee('etats-des-lieux', donnees[s[0]]).then(function (u) { if (u) { img.src = u; img.hidden = false; } });
      if (!verrouille) {
        var input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': t(s[1]) });
        depot.appendChild(input);
        input.addEventListener('change', function () {
          var fichier = input.files[0];
          if (!fichier) return;
          depot.classList.add('depot--envoi');
          L.img.compresser(fichier, { max: 1600 }).then(function (webp) {
            var chemin = r.id + '/' + e.type + '/' + l.id + '/' + s[0] + '-' + Date.now() + '.webp';
            return L.sb.storage.from('etats-des-lieux').upload(chemin, webp, { contentType: 'image/webp', upsert: false }).then(function (up) {
              if (up.error) throw up.error;
              donnees[s[0]] = chemin;
              img.src = URL.createObjectURL(webp); img.hidden = false;
              depot.classList.add('depot--rempli');
              return enregistrer();
            });
          }).catch(function (err) { L.ui.toast(L.messageErreur(err), 'erreur'); }).then(function () { depot.classList.remove('depot--envoi'); });
        });
      }
      grille.appendChild(depot);
    });
    var cases = h('div', { class: 'choix-pastilles' }, [['taches', 'edl.taches'], ['accrocs', 'edl.accrocs'], ['perles_manquantes', 'edl.perles']].map(function (c) {
      return h('label', { class: 'pastille' }, h('input', { type: 'checkbox', checked: donnees[c[0]] || null, disabled: verrouille || null, onchange: function (ev) { donnees[c[0]] = ev.target.checked; enregistrer(); } }), h('span', null, t(c[1])));
    }));
    var commentaire = h('textarea', { class: 'champ__controle', maxlength: 1000, disabled: verrouille || null, placeholder: t('edl.commentaire'), 'aria-label': t('edl.commentaire') }, donnees.commentaire || '');
    commentaire.addEventListener('change', function () { donnees.commentaire = commentaire.value; enregistrer(); });

    function enregistrer() {
      var champs = { photo_face: donnees.photo_face || null, photo_dos: donnees.photo_dos || null, photo_broderies: donnees.photo_broderies || null, photo_doublure: donnees.photo_doublure || null,
        taches: !!donnees.taches, accrocs: !!donnees.accrocs, perles_manquantes: !!donnees.perles_manquantes, commentaire: donnees.commentaire || null };
      var q = donnees.id
        ? L.sb.from('etats_des_lieux').update(champs).eq('id', donnees.id).select('id').single()
        : L.sb.from('etats_des_lieux').insert(Object.assign({ reservation_id: r.id, ligne_id: l.id, type: e.type }, champs)).select('id').single();
      return q.then(function (res) { if (res.error) throw res.error; donnees.id = res.data.id; });
    }

    var comparaison = null;
    if (remise) {
      comparaison = h('div', null, h('p', { class: 'kpi__libelle' }, t('edl.comparaison')), h('div', { class: 'edl__comparaison' }));
      slots.forEach(function (s) {
        var a = h('img', { alt: t('edl.remise') + ' — ' + t(s[1]) }), b = h('img', { alt: t('edl.retour') + ' — ' + t(s[1]) });
        L.img.signee('etats-des-lieux', remise[s[0]]).then(function (u) { if (u) a.src = u; });
        if (donnees[s[0]]) L.img.signee('etats-des-lieux', donnees[s[0]]).then(function (u) { if (u) b.src = u; });
        $('.edl__comparaison', comparaison).appendChild(h('figure', null, a, h('figcaption', null, t('edl.remise') + ' · ' + t(s[1]))));
        $('.edl__comparaison', comparaison).appendChild(h('figure', null, b, h('figcaption', null, t('edl.retour') + ' · ' + t(s[1]))));
      });
    }
    return h('section', { class: 'panneau', style: { margin: 0 } },
      h('h3', { style: { fontSize: '1.3rem' } }, l.titre_snapshot), grille,
      h('p', { class: 'kpi__libelle', style: { marginTop: '14px' } }, t('edl.constat')), cases, commentaire, comparaison);
  }

  // ===========================================================================
  // Avis croisés
  // ===========================================================================
  function laisserAvis(r, role) {
    var note = 5;
    var etoiles = h('div', { class: 'choix-pastilles', role: 'radiogroup', 'aria-label': t('avis.note') }, [1, 2, 3, 4, 5].map(function (n) {
      return h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'note', value: n, checked: n === 5, onchange: function () { note = n; } }), h('span', null, '★ ' + n));
    }));
    var form = h('form', { class: 'formulaire' },
      h('p', { class: 'texte' }, t(role === 'cliente' ? 'avis.intro_cliente' : 'avis.intro_fournisseuse')),
      etoiles, L.ui.champ('commentaire', 'avis.commentaire', { tag: 'textarea', maxlength: 1000 }), h('div', { class: 'retour' }),
      h('button', { class: 'bouton', type: 'submit' }, t('commun.envoyer')));
    var m = L.ui.modale(form, { titre: t('avis.laisser') });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      L.sb.from('avis').insert({ reservation_id: r.id, auteur_id: etat.profil.id, note: note, commentaire: form.commentaire.value || null }).then(function (res) {
        if (res.error) { erreur($('.retour', form), res.error.code === '23505' ? { message: t('avis.deja') } : res.error); return; }
        m.fermer(); L.ui.toast(t('avis.merci'), 'succes'); etat.aller(etat.vue);
      });
    });
  }

  // ===========================================================================
  // Essayages
  // ===========================================================================
  VUES.essayages = function (contenu) {
    var moi = etat.profil.id;
    return Promise.all([
      sb(L.sb.from('essayages').select('*, tenue:tenues(id, titre), showroom:showrooms(titre, lieu, adresse)').or('cliente_id.eq.' + moi + ',fournisseuse_id.eq.' + moi).neq('statut', 'a_payer').order('creneau', { ascending: false })),
      sb(L.sb.from('showroom_inscriptions').select('*, showroom:showrooms(*)').eq('user_id', moi))
    ]).then(function (res) {
      L.vider(contenu);
      if (L.param('essayage') === 'ok') contenu.appendChild(h('p', { class: 'message message--succes' }, t('essai.paye')));
      var liste = res[0], inscriptions = res[1];
      var corps = h('div');
      if (!liste.length) corps.appendChild(h('p', { class: 'texte' }, t('essai.aucun')));
      liste.forEach(function (e) {
        var suisFournisseuse = e.fournisseuse_id === moi;
        var actions = h('div', { class: 'actions', style: { marginTop: 0 } });
        function agir(decision) { return function (ev) { ev.currentTarget.disabled = true; L.api('essayage-repondre', { essayage_id: e.id, decision: decision }).then(function () { etat.aller('essayages'); }).catch(function (err) { L.ui.toast(L.messageErreur(err), 'erreur'); }); }; }
        if (suisFournisseuse && e.statut === 'demande') { actions.appendChild(h('button', { class: 'bouton bouton--petit', type: 'button', onclick: agir('confirmer') }, t('commun.confirmer'))); actions.appendChild(h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: agir('refuser') }, t('compte.refuser'))); }
        if (suisFournisseuse && e.statut === 'confirme') actions.appendChild(h('button', { class: 'bouton bouton--petit', type: 'button', onclick: agir('effectue') }, t('essai.effectue')));
        if (!suisFournisseuse && ['demande', 'confirme'].indexOf(e.statut) >= 0) actions.appendChild(h('button', { class: 'lien', type: 'button', onclick: agir('annuler') }, t('compte.annuler')));
        corps.appendChild(h('article', { class: 'ligne-resa' },
          h('div', { class: 'ligne-resa__tete' }, h('h3', { class: 'ligne-resa__titre' }, e.type === 'showroom' ? (e.showroom && e.showroom.titre) || 'Showroom' : (e.tenue && e.tenue.titre) || ''), statut(e.statut, 'essai.s_')),
          h('p', { class: 'texte', style: { margin: 0 } }, L.dateHeure(e.creneau) + ' · ' + L.euros(e.frais_cents) + (e.deduit_commande_id ? ' · ' + t('essai.deduit') : '') + (suisFournisseuse ? ' · ' + t('essai.chez_vous') : '')),
          e.message ? h('p', { style: { margin: 0, fontSize: '14px' } }, '« ' + e.message + ' »') : null,
          actions));
      });
      contenu.appendChild(panneau(t('compte.v_essayages'), corps));
      if (inscriptions.length) {
        contenu.appendChild(panneau(t('showroom.titre'), h('div', null, inscriptions.map(function (i) {
          return h('div', { class: 'ligne-resa' }, h('strong', null, i.showroom.titre), h('span', { class: 'texte' }, L.dateHeure(i.showroom.debut) + ' · ' + i.showroom.lieu + ', ' + i.showroom.adresse),
            h('div', null, h('button', { class: 'lien', type: 'button', onclick: function () { L.sb.from('showroom_inscriptions').delete().eq('id', i.id).then(function () { etat.aller('essayages'); }); } }, t('showroom.desinscrire'))));
        }))));
      }
    });
  };

  // ===========================================================================
  // Mensurations (données personnelles)
  // ===========================================================================
  var MESURES = [['poitrine_cm', 'mes.poitrine'], ['taille_cm', 'mes.taille'], ['hanches_cm', 'mes.hanches'], ['longueur_cm', 'mes.longueur'], ['manche_cm', 'mes.manche'], ['hauteur_cm', 'mes.hauteur']];
  VUES.mensurations = function (contenu) {
    return sb(L.sb.from('mensurations').select('*').eq('user_id', etat.profil.id).maybeSingle()).then(function (m) {
      m = m || {};
      var retour = h('div');
      var form = h('form', { class: 'formulaire' },
        h('p', { class: 'texte' }, t('compte.mensurations_intro')),
        h('div', { class: 'grille-3' }, MESURES.map(function (c) { return L.ui.champ(c[0], t(c[1]) + ' (cm)', { type: 'number', step: '0.5', min: '10', max: '230', inputmode: 'decimal', value: m[c[0]] || '' }); })),
        retour,
        h('div', { class: 'actions' }, h('button', { class: 'bouton', type: 'submit' }, t('commun.enregistrer')),
          m.user_id ? h('button', { class: 'bouton bouton--danger', type: 'button', onclick: function () {
            L.ui.confirmer(t('compte.mensurations_supprimer_confirmer'), t('commun.supprimer')).then(function (ok) {
              if (ok) L.sb.from('mensurations').delete().eq('user_id', etat.profil.id).then(function () { L.ui.toast(t('compte.mensurations_supprimees'), 'succes'); etat.aller('mensurations'); });
            });
          } }, t('compte.mensurations_supprimer')) : null));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var o = { user_id: etat.profil.id };
        MESURES.forEach(function (c) { o[c[0]] = form[c[0]].value ? Number(form[c[0]].value) : null; });
        L.sb.from('mensurations').upsert(o).then(function (r) { if (r.error) erreur(retour, r.error); else L.ui.toast(t('commun.enregistre'), 'succes'); });
      });
      L.vider(contenu).appendChild(panneau(t('compte.v_mensurations'), form));
    });
  };

  // ===========================================================================
  // Fournisseuse : demandes
  // ===========================================================================
  VUES.demandes = function (contenu) {
    return sb(L.sb.from('reservations').select('*, reservation_lignes(id, titre_snapshot, tenue_id, prix_location_cents), commande:commandes(date_evenement), avis(auteur_id)')
      .eq('fournisseuse_id', etat.profil.id).order('created_at', { ascending: false }).limit(200)).then(function (liste) {
      L.vider(contenu);
      var attente = liste.filter(function (r) { return r.statut === 'demande'; });
      var enCours = liste.filter(function (r) { return ['acceptee', 'payee', 'remise', 'rendue', 'litige'].indexOf(r.statut) >= 0; });
      var passees = liste.filter(function (r) { return ['cloturee', 'annulee'].indexOf(r.statut) >= 0; });
      var blocAttente = h('div');
      if (!attente.length) blocAttente.appendChild(h('p', { class: 'texte' }, t('compte.aucune_demande')));
      attente.forEach(function (r) { blocAttente.appendChild(carteDemande(r)); });
      contenu.appendChild(panneau(t('compte.demandes_attente'), blocAttente));
      contenu.appendChild(panneau(t('compte.locations_cours'), enCours.length ? h('div', null, enCours.map(function (r) { return ligneReservation(r, 'fournisseuse'); })) : h('p', { class: 'texte' }, t('compte.aucune_location'))));
      if (passees.length) contenu.appendChild(panneau(t('compte.historique'), h('div', null, passees.slice(0, 30).map(function (r) { return ligneReservation(r, 'fournisseuse'); }))));
      ouvrirDepuisUrl(liste, 'fournisseuse');
      var cible = L.param('reservation');
      if (cible && $('#resa-' + cible)) $('#resa-' + cible).scrollIntoView({ block: 'center' });
    });
  };

  function carteDemande(r) {
    var mens = h('div', { class: 'texte', style: { fontSize: '13px' } });
    // Mensurations visibles grâce à la policy RLS « cliente ayant fait une demande »
    L.sb.from('mensurations').select('*').eq('user_id', r.cliente_id).maybeSingle().then(function (res) {
      var m = res.data;
      mens.textContent = m ? MESURES.filter(function (c) { return m[c[0]]; }).map(function (c) { return t(c[1]) + ' ' + Number(m[c[0]]) + ' cm'; }).join(' · ') : t('compte.pas_de_mensurations');
    });
    var restant = Math.max(0, new Date(r.expire_at) - Date.now());
    var retour = h('div');
    function repondre(decision, motif) {
      return L.api('reservation-repondre', { reservation_id: r.id, decision: decision, motif: motif }).then(function () {
        L.ui.toast(t(decision === 'accepter' ? 'compte.acceptee' : 'compte.refusee'), 'succes'); etat.aller('demandes');
      }).catch(function (err) { erreur(retour, err); });
    }
    return h('article', { class: 'ligne-resa', id: 'resa-' + r.id },
      h('div', { class: 'ligne-resa__tete' }, h('h3', { class: 'ligne-resa__titre' }, (r.reservation_lignes || []).map(function (l) { return l.titre_snapshot; }).join(', ')),
        h('span', { class: 'statut statut--demande' }, t('compte.reste', { h: Math.floor(restant / 3600000), m: Math.floor(restant / 60000) % 60 }))),
      h('p', { style: { margin: 0 } }, t('commun.du_au', { debut: L.date(r.date_debut), fin: L.date(r.date_fin) }) + ' · ' + t('compte.evenement') + ' ' + L.date(r.date_evenement)),
      h('p', { style: { margin: 0, fontSize: '14px' } }, t('compte.vous_recevrez', { montant: L.euros(r.montant_transfert_cents) }) + ' · ' + t(r.mode_remise === 'envoi' ? 'panier.envoi' : 'tenue.main_propre')),
      r.message ? h('p', { style: { margin: 0, fontSize: '14px' } }, '« ' + r.message + ' »') : null,
      h('div', null, h('strong', { style: { fontSize: '12px', letterSpacing: '.08em', textTransform: 'uppercase' } }, t('compte.mensurations_cliente')), mens),
      retour,
      h('div', { class: 'actions', style: { marginTop: 0 } },
        h('button', { class: 'bouton bouton--emeraude bouton--petit', type: 'button', onclick: function (e) { e.currentTarget.disabled = true; repondre('accepter'); } }, t('compte.accepter')),
        h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () {
          var f = h('form', { class: 'formulaire' }, L.ui.champ('motif', 'compte.motif_refus', { tag: 'textarea', maxlength: 300 }), h('button', { class: 'bouton', type: 'submit' }, t('compte.refuser')));
          var mo = L.ui.modale(f, { titre: t('compte.refuser') });
          f.addEventListener('submit', function (ev) { ev.preventDefault(); mo.fermer(); repondre('refuser', f.motif.value || null); });
        } }, t('compte.refuser'))));
  }

  function ouvrirLitige(r) {
    var photos = [];
    var liste = h('div', { class: 'depot-photos' });
    var ajout = h('label', { class: 'depot' }, h('span', { class: 'depot__libelle' }, t('litige.ajouter_photo')), h('input', { type: 'file', accept: 'image/*', multiple: true, capture: 'environment' }));
    liste.appendChild(ajout);
    $('input', ajout).addEventListener('change', function (e) {
      Array.prototype.slice.call(e.target.files, 0, 8 - photos.length).forEach(function (f) {
        L.img.compresser(f, { max: 1800 }).then(function (webp) {
          var chemin = r.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.webp';
          return L.sb.storage.from('litiges').upload(chemin, webp, { contentType: 'image/webp' }).then(function (up) {
            if (up.error) throw up.error;
            photos.push(chemin);
            liste.insertBefore(h('div', { class: 'depot depot--rempli' }, h('img', { src: URL.createObjectURL(webp), alt: '' })), ajout);
          });
        }).catch(function (err) { L.ui.toast(L.messageErreur(err), 'erreur'); });
      });
    });
    var form = h('form', { class: 'formulaire' },
      h('p', { class: 'texte' }, t('litige.intro', { date: L.dateHeure(r.litige_deadline) })),
      L.ui.champ('motif', 'litige.motif', { tag: 'select', required: true, options: ['degat', 'tache', 'perte', 'retard', 'non_conforme', 'autre'].map(function (m) { return [m, t('litige.m_' + m)]; }) }),
      L.ui.champ('description', 'litige.description', { tag: 'textarea', required: true, minlength: 10, maxlength: 2000 }),
      L.ui.champ('montant', t('litige.montant', { max: L.euros(r.caution_cents) }), { type: 'number', min: '0', step: '1', max: String(r.caution_cents / 100) }),
      liste, h('div', { class: 'retour' }),
      h('button', { class: 'bouton bouton--danger', type: 'submit' }, t('litige.envoyer')));
    var m = L.ui.modale(form, { titre: t('litige.ouvrir'), large: true });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      L.api('litige-ouvrir', { reservation_id: r.id, motif: form.motif.value, description: form.description.value, photos: photos, montant_demande_cents: Math.round(Number(form.montant.value || 0) * 100) })
        .then(function () { m.fermer(); L.ui.toast(t('litige.envoye'), 'succes'); etat.aller('demandes'); })
        .catch(function (err) { erreur($('.retour', form), err); });
    });
  }

  // ===========================================================================
  // Fournisseuse : annonces (formulaire, photos, ensembles, ajout en série)
  // ===========================================================================
  VUES.annonces = function (contenu) {
    if (!etat.profil.est_fournisseuse) return devenirFournisseuse(contenu);
    return sb(L.sb.from('tenues').select('*, tenue_photos(id, type, chemin, ordre)').eq('fournisseuse_id', etat.profil.id).order('created_at', { ascending: false })).then(function (liste) {
      L.vider(contenu);
      if (!etat.profil.stripe_onboarding_complet) contenu.appendChild(h('p', { class: 'message message--alerte' }, t('annonce.stripe_requis'), ' ', h('a', { href: '?vue=paiements', onclick: function (e) { e.preventDefault(); etat.aller('paiements'); } }, t('annonce.stripe_lien'))));
      var serie = etat.profil.type_fournisseuse !== 'particuliere';
      var tete = h('div', { class: 'actions', style: { marginTop: 0 } },
        h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function () { formulaireTenue(contenu, null, false); } }, t('annonce.nouvelle')),
        serie ? h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { formulaireTenue(contenu, null, true); } }, t('annonce.serie')) : null);
      var grille = h('div', { class: 'grille-cartes', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' } });
      liste.forEach(function (tn) {
        var face = (tn.tenue_photos || []).find(function (p) { return p.type === 'face'; });
        grille.appendChild(h('div', { class: 'carte' },
          h('div', { class: 'arche' }, L.img.element(face ? face.chemin : L.placeholderPour(tn, 'face'), '')),
          h('div', { class: 'carte__infos' }, h('h3', { class: 'carte__titre', style: { fontSize: '1.1rem' } }, tn.titre), statut(tn.statut, 'annonce.'),
            tn.motif_refus && tn.statut === 'refusee' ? h('p', { class: 'champ__aide' }, tn.motif_refus) : null,
            h('p', { class: 'carte__prix' }, L.euros(tn.prix_location_cents) + ' · ' + t('annonce.locations', { n: tn.nb_locations })),
            h('div', { class: 'actions', style: { marginTop: '6px' } }, h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { formulaireTenue(contenu, tn, false); } }, t('commun.modifier')),
              tn.statut === 'validee' ? h('a', { class: 'lien', href: 'tenue.html?id=' + tn.id }, t('commun.voir')) : null))));
      });
      contenu.appendChild(panneau(t('compte.v_annonces'), liste.length ? grille : h('p', { class: 'texte' }, t('annonce.aucune')), tete));
      var cible = L.param('tenue');
      var tn = liste.find(function (x) { return x.id === cible; });
      if (tn) formulaireTenue(contenu, tn, false);
    });
  };

  function devenirFournisseuse(contenu) {
    var form = h('form', { class: 'formulaire' },
      h('p', { class: 'chapeau' }, t('devenir.intro')),
      h('div', { class: 'choix-pastilles' }, ['particuliere', 'negafa', 'creatrice'].map(function (ty, i) { return h('label', { class: 'pastille' }, h('input', { type: 'radio', name: 'type', value: ty, checked: i === 0 }), h('span', null, t('type.' + ty))); })),
      L.ui.champ('ville', 'cat.f_ville', { tag: 'select', options: C.villes.map(function (v) { return [v, v, v === etat.profil.ville]; }) }),
      h('div', { class: 'retour' }),
      h('button', { class: 'bouton', type: 'submit' }, t('devenir.activer')));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      L.sb.from('profils').update({ est_fournisseuse: true, type_fournisseuse: form.type.value, ville: form.ville.value }).eq('id', etat.profil.id).then(function (r) {
        if (r.error) { erreur($('.retour', form), r.error); return; }
        location.href = 'compte.html?vue=paiements';
      });
    });
    L.vider(contenu).appendChild(panneau(t('compte.v_devenir'), form));
  }

  var TYPES_PHOTOS = [['face', 'annonce.p_face'], ['dos', 'annonce.p_dos'], ['broderie', 'annonce.p_broderie'], ['portee', 'annonce.p_portee']];

  /** Formulaire d'annonce. En mode série, il se réinitialise après chaque publication (sans recharger). */
  function formulaireTenue(contenu, tn, serie) {
    var photos = {};
    (tn && tn.tenue_photos || []).forEach(function (p) { if (!photos[p.type]) photos[p.type] = p; });
    var aEnvoyer = {};
    var retour = h('div');
    var compteurSerie = h('span', { class: 'texte' });
    var nbSerie = 0;
    var v = tn || { categorie: 'caftan', couleurs: [], occasions: [], duree_min_jours: 2, duree_max_jours: 4, remise_main_propre: true, ville: etat.profil.ville || 'Bruxelles' };
    var depot = h('div', { class: 'depot-photos' });
    function rendrePhotos() {
      L.vider(depot);
      var cat = form ? form.categorie.value : v.categorie;
      TYPES_PHOTOS.forEach(function (tp) {
        var requis = cat !== 'accessoire' || tp[0] === 'face' || tp[0] === 'portee';
        var existant = aEnvoyer[tp[0]] ? URL.createObjectURL(aEnvoyer[tp[0]]) : photos[tp[0]] ? L.img.url(photos[tp[0]].chemin) : null;
        var input = h('input', { type: 'file', accept: 'image/*', 'aria-label': t(tp[1]) });
        var label = h('label', { class: 'depot' + (existant ? ' depot--rempli' : '') }, existant ? h('img', { src: existant, alt: '' }) : null,
          h('span', { class: 'depot__libelle' }, t(tp[1]), requis && !existant ? h('span', { class: 'depot__requis' }, ' *') : null), input);
        input.addEventListener('change', function () {
          if (!input.files[0]) return;
          label.classList.add('depot--envoi');
          L.img.compresser(input.files[0]).then(function (webp) { aEnvoyer[tp[0]] = webp; rendrePhotos(); }).catch(function (err) { L.ui.toast(L.messageErreur(err), 'erreur'); label.classList.remove('depot--envoi'); });
        });
        depot.appendChild(label);
      });
    }
    var couleurs = h('div', { class: 'filtres__couleurs' }, Object.keys(C.couleurs).map(function (k) {
      return h('label', { class: 'couleur-pastille', title: t('coul.' + k), style: { background: C.couleurs[k] } }, h('input', { type: 'checkbox', name: 'couleurs', value: k, checked: v.couleurs.indexOf(k) >= 0, 'aria-label': t('coul.' + k) }));
    }));
    var occasions = h('div', { class: 'choix-pastilles' }, C.occasions.map(function (o) { return h('label', { class: 'pastille' }, h('input', { type: 'checkbox', name: 'occasions', value: o, checked: v.occasions.indexOf(o) >= 0 }), h('span', null, t('occ.' + o))); }));
    var mesures = h('div', { class: 'grille-3', 'data-mesures': '' }, [['poitrine_cm', 'mes.poitrine'], ['taille_cm', 'mes.taille'], ['hanches_cm', 'mes.hanches'], ['longueur_cm', 'mes.longueur'], ['manche_cm', 'mes.manche']].map(function (c) {
      return L.ui.champ(c[0], t(c[1]) + ' (cm)', { type: 'number', step: '0.5', min: '10', max: '220', inputmode: 'decimal', value: v[c[0]] || '' });
    }));
    var ensembleZone = h('div');
    var form = h('form', { class: 'formulaire', novalidate: true },
      h('div', { class: 'grille-2' },
        L.ui.champ('categorie', 'cat.f_categorie', { tag: 'select', options: C.categories.map(function (c) { return [c, t('cat.' + c), v.categorie === c]; }) }),
        L.ui.champ('sous_categorie', 'annonce.sous_categorie', { tag: 'select', options: C.sousCategories.map(function (c) { return [c, t('scat.' + c), v.sous_categorie === c]; }) })),
      L.ui.champ('titre', 'annonce.titre', { required: true, minlength: 3, maxlength: 90, value: v.titre || '', placeholder: t('annonce.titre_ph') }),
      L.ui.champ('description', 'annonce.description', { tag: 'textarea', maxlength: 2500 }),
      h('fieldset', { class: 'filtres__groupe' }, h('legend', null, t('cat.f_couleur')), couleurs),
      h('fieldset', { class: 'filtres__groupe' }, h('legend', null, t('cat.f_occasion')), occasions),
      h('div', { class: 'grille-2' },
        L.ui.champ('taille_indicative', 'mes.taille_indicative', { tag: 'select', options: C.tailles.map(function (x) { return [x, x === 'unique' ? t('annonce.taille_unique') : x === 'enfant' ? t('cat.enfant') : x, v.taille_indicative === x]; }) }),
        L.ui.champ('ville', 'cat.f_ville', { tag: 'select', options: C.villes.map(function (x) { return [x, x, v.ville === x]; }) })),
      h('fieldset', { class: 'filtres__groupe' }, h('legend', null, t('annonce.mesures')), h('p', { class: 'champ__aide', style: { margin: 0 } }, t('annonce.mesures_aide')), mesures),
      h('div', { class: 'grille-2' },
        L.ui.champ('prix', 'annonce.prix', { type: 'number', required: true, min: '5', max: '5000', step: '1', inputmode: 'numeric', value: v.prix_location_cents ? v.prix_location_cents / 100 : '' }),
        L.ui.champ('valeur', 'annonce.valeur', { type: 'number', required: true, min: '10', max: '50000', step: '1', inputmode: 'numeric', value: v.valeur_declaree_cents ? v.valeur_declaree_cents / 100 : '', aide: t('annonce.valeur_aide') })),
      h('div', { class: 'grille-2' },
        L.ui.champ('duree_min', 'annonce.duree_min', { type: 'number', min: '1', max: '30', value: v.duree_min_jours }),
        L.ui.champ('duree_max', 'annonce.duree_max', { type: 'number', min: '1', max: '30', value: v.duree_max_jours })),
      h('fieldset', { class: 'filtres__groupe' }, h('legend', null, t('tenue.mode_remise')),
        h('label', { class: 'case' }, h('input', { type: 'checkbox', name: 'main_propre', checked: v.remise_main_propre }), h('span', null, t('tenue.main_propre'))),
        h('label', { class: 'case' }, h('input', { type: 'checkbox', name: 'essayage', checked: v.essayage_possible }), h('span', null, t('tenue.essayage_possible'))),
        h('label', { class: 'case' }, h('input', { type: 'checkbox', name: 'envoi', checked: v.envoi_assure }), h('span', null, t('annonce.envoi'))),
        L.ui.champ('frais_envoi', 'annonce.frais_envoi', { type: 'number', min: '0', max: '100', step: '0.5', value: v.frais_envoi_cents ? v.frais_envoi_cents / 100 : '' })),
      h('fieldset', { class: 'filtres__groupe' }, h('legend', null, t('annonce.photos')), h('p', { class: 'champ__aide', style: { margin: 0 } }, t('annonce.photos_aide')), depot),
      ensembleZone,
      retour,
      h('div', { class: 'actions' },
        h('button', { class: 'bouton', type: 'submit', name: 'soumettre', value: '1' }, t(serie ? 'annonce.publier_suivante' : 'annonce.soumettre')),
        serie ? null : h('button', { class: 'bouton bouton--ligne', type: 'submit', name: 'brouillon', value: '1' }, t('annonce.brouillon')),
        tn ? h('button', { class: 'bouton bouton--danger', type: 'button', onclick: archiver }, t('annonce.archiver')) : null,
        serie ? compteurSerie : null));
    function majVisibilite() {
      var acc = form.categorie.value === 'accessoire';
      form.sous_categorie.closest('.champ').hidden = !acc;
      mesures.closest('fieldset').hidden = acc;
      rendrePhotos();
    }
    form.categorie.addEventListener('change', majVisibilite);
    if (v.description) form.description.value = v.description;
    majVisibilite();
    if (tn && tn.categorie !== 'accessoire') blocEnsemble(ensembleZone, tn);

    var bouton = null;
    form.addEventListener('click', function (e) { if (e.target.type === 'submit') bouton = e.target.name; });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var soumettre = bouton !== 'brouillon';
      if (!form.titre.value || !form.prix.value || !form.valeur.value) { form.reportValidity(); return; }
      var cat = form.categorie.value;
      var valeurs = {
        fournisseuse_id: etat.profil.id, categorie: cat, sous_categorie: cat === 'accessoire' ? form.sous_categorie.value : null,
        titre: form.titre.value.trim(), description: form.description.value.trim(),
        couleurs: $$('[name=couleurs]:checked', form).map(function (x) { return x.value; }),
        occasions: $$('[name=occasions]:checked', form).map(function (x) { return x.value; }),
        taille_indicative: form.taille_indicative.value, ville: form.ville.value,
        prix_location_cents: Math.round(Number(form.prix.value) * 100), valeur_declaree_cents: Math.round(Number(form.valeur.value) * 100),
        duree_min_jours: Number(form.duree_min.value) || 1, duree_max_jours: Number(form.duree_max.value) || 4,
        remise_main_propre: form.main_propre.checked, essayage_possible: form.essayage.checked, envoi_assure: form.envoi.checked,
        frais_envoi_cents: form.envoi.checked ? Math.round(Number(form.frais_envoi.value || 0) * 100) : 0
      };
      ['poitrine_cm', 'taille_cm', 'hanches_cm', 'longueur_cm', 'manche_cm'].forEach(function (c) { valeurs[c] = cat === 'accessoire' || !form[c].value ? null : Number(form[c].value); });
      if (cat !== 'accessoire' && ['poitrine_cm', 'taille_cm', 'hanches_cm', 'longueur_cm', 'manche_cm'].some(function (c) { return valeurs[c] == null; })) { erreur(retour, { message: t('annonce.mesures_requises') }); return; }
      var boutons = $$('[type=submit]', form);
      boutons.forEach(function (b) { b.disabled = true; });
      var enregistrement = tn
        ? L.sb.from('tenues').update(valeurs).eq('id', tn.id).select('*').single()
        : L.sb.from('tenues').insert(valeurs).select('*').single();
      enregistrement.then(function (r) {
        if (r.error) throw r.error;
        var id = r.data.id;
        var envois = Object.keys(aEnvoyer).map(function (type, i) {
          var chemin = etat.profil.id + '/' + id + '/' + type + '-' + Date.now() + '.webp';
          return L.sb.storage.from('tenues').upload(chemin, aEnvoyer[type], { contentType: 'image/webp' }).then(function (up) {
            if (up.error) throw up.error;
            var ancienne = photos[type];
            return L.sb.from('tenue_photos').insert({ tenue_id: id, type: type, chemin: chemin, ordre: i }).then(function (ins) {
              if (ins.error) throw ins.error;
              if (ancienne) return L.sb.from('tenue_photos').delete().eq('id', ancienne.id);
            });
          });
        });
        return Promise.all(envois).then(function () {
          if (soumettre && r.data.statut !== 'en_attente' && r.data.statut !== 'validee') {
            return L.sb.from('tenues').update({ statut: 'en_attente' }).eq('id', id).then(function (s) { if (s.error) throw s.error; });
          }
        });
      }).then(function () {
        boutons.forEach(function (b) { b.disabled = false; });
        L.ui.toast(t(soumettre ? 'annonce.soumise' : 'annonce.enregistree'), 'succes');
        if (serie) {
          // Ajout en série : on garde catégorie, ville, durées et modes ; le reste est vidé.
          nbSerie++;
          compteurSerie.textContent = t('annonce.serie_compteur', { n: nbSerie });
          form.titre.value = ''; form.description.value = ''; form.prix.value = ''; form.valeur.value = '';
          ['poitrine_cm', 'taille_cm', 'hanches_cm', 'longueur_cm', 'manche_cm'].forEach(function (c) { form[c].value = ''; });
          $$('[name=couleurs]', form).forEach(function (x) { x.checked = false; });
          aEnvoyer = {}; photos = {};
          rendrePhotos();
          form.titre.focus();
          L.vider(retour);
        } else {
          etat.aller('annonces');
        }
      }).catch(function (err) {
        boutons.forEach(function (b) { b.disabled = false; });
        var msg = err && err.hint === 'stripe_requis' ? t('annonce.stripe_requis') : err && err.hint === 'photos_requises' ? t('annonce.photos_requises') : L.messageErreur(err);
        erreur(retour, { message: msg });
      });
    });
    function archiver() {
      L.ui.confirmer(t('annonce.archiver_confirmer'), t('annonce.archiver')).then(function (ok) {
        if (ok) L.sb.from('tenues').update({ statut: 'archivee' }).eq('id', tn.id).then(function () { etat.aller('annonces'); });
      });
    }
    var titre = tn ? t('annonce.modifier') : serie ? t('annonce.serie') : t('annonce.nouvelle');
    L.vider(contenu).appendChild(panneau(titre, form, h('button', { class: 'lien', type: 'button', onclick: function () { etat.aller('annonces'); } }, t('commun.retour'))));
    form.titre.focus();
  }

  /** Option « Ensemble » : relier la tenue à des accessoires de la même fournisseuse. */
  function blocEnsemble(zone, tn) {
    Promise.all([
      sb(L.sb.from('tenues').select('id, titre, sous_categorie').eq('fournisseuse_id', etat.profil.id).eq('categorie', 'accessoire').neq('statut', 'archivee')),
      sb(L.sb.from('ensembles').select('accessoire_id').eq('tenue_id', tn.id))
    ]).then(function (res) {
      var acc = res[0], lies = res[1].map(function (e) { return e.accessoire_id; });
      if (!acc.length) { zone.appendChild(h('p', { class: 'champ__aide' }, t('annonce.ensemble_vide'))); return; }
      zone.appendChild(h('fieldset', { class: 'filtres__groupe' }, h('legend', null, t('annonce.ensemble')), h('p', { class: 'champ__aide', style: { margin: 0 } }, t('annonce.ensemble_aide')),
        h('div', { class: 'choix-pastilles' }, acc.map(function (a) {
          return h('label', { class: 'pastille' }, h('input', { type: 'checkbox', checked: lies.indexOf(a.id) >= 0, onchange: function (e) {
            var q = e.target.checked ? L.sb.from('ensembles').insert({ tenue_id: tn.id, accessoire_id: a.id }) : L.sb.from('ensembles').delete().eq('tenue_id', tn.id).eq('accessoire_id', a.id);
            q.then(function (r) { if (r.error) { e.target.checked = !e.target.checked; L.ui.toast(L.messageErreur(r.error), 'erreur'); } });
          } }), h('span', null, a.titre));
        }))));
    });
  }

  // ===========================================================================
  // Fournisseuse : calendrier (blocages manuels)
  // ===========================================================================
  VUES.calendrier = function (contenu) {
    return sb(L.sb.from('tenues').select('id, titre').eq('fournisseuse_id', etat.profil.id).neq('statut', 'archivee').order('titre')).then(function (tenues) {
      L.vider(contenu);
      if (!tenues.length) { L.ui.etatVide(contenu, t('annonce.aucune')); return; }
      var choix = L.ui.champ('tenue', 'calendrier.tenue', { tag: 'select', options: tenues.map(function (x) { return [x.id, x.titre]; }) });
      var cal = h('div', { class: 'calendrier' });
      var mois = new Date(); mois.setDate(1);
      var selection = null;
      var aide = h('p', { class: 'champ__aide' }, t('calendrier.aide'));
      contenu.appendChild(panneau(t('compte.v_calendrier'), h('div', null, choix, aide, cal,
        h('p', { class: 'calendrier__legende' }, h('span', { class: 'l-manuel' }, t('calendrier.manuel')), h('span', { class: 'l-resa' }, t('calendrier.reservation'))))));
      var select = $('select', choix);
      select.addEventListener('change', dessiner);
      dessiner();
      function dessiner() {
        var debutM = L.isoDate(mois), finM = L.isoDate(new Date(mois.getFullYear(), mois.getMonth() + 1, 0));
        L.sb.from('blocages').select('id, periode, motif').eq('tenue_id', select.value).then(function (r) {
          var blocs = (r.data || []).map(function (b) { var m = b.periode.match(/^[\[(]([\d-]+),([\d-]+)[\])]$/); return { id: b.id, motif: b.motif, debut: m[1], fin: L.ajouterJours(m[2], b.periode.slice(-1) === ')' ? -1 : 0) }; });
          L.vider(cal);
          cal.appendChild(h('div', { class: 'calendrier__tete' },
            h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', 'aria-label': t('commun.precedent'), onclick: function () { mois.setMonth(mois.getMonth() - 1); dessiner(); } }, '‹'),
            h('strong', null, L.date(debutM, { month: 'long', year: 'numeric' })),
            h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', 'aria-label': t('commun.suivant'), onclick: function () { mois.setMonth(mois.getMonth() + 1); dessiner(); } }, '›')));
          var grille = h('div', { class: 'calendrier__grille' });
          ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (j) { grille.appendChild(h('span', { class: 'calendrier__jour-nom', 'aria-hidden': 'true' }, j)); });
          var decalage = (mois.getDay() + 6) % 7;
          for (var i = 0; i < decalage; i++) grille.appendChild(h('span', { class: 'calendrier__jour calendrier__jour--hors' }));
          for (var d = debutM; d <= finM; d = L.ajouterJours(d, 1)) {
            (function (jour) {
              var bloc = blocs.find(function (b) { return jour >= b.debut && jour <= b.fin; });
              var classe = 'calendrier__jour' + (bloc ? ' calendrier__jour--' + bloc.motif : '') + (selection === jour ? ' calendrier__jour--selection' : '');
              grille.appendChild(h('button', { type: 'button', class: classe, disabled: jour < L.aujourdhui() || (bloc && bloc.motif === 'reservation') || null, 'aria-label': L.date(jour) + (bloc ? ' — ' + t('calendrier.' + (bloc.motif === 'manuel' ? 'manuel' : 'reservation')) : ''),
                onclick: function () {
                  if (bloc && bloc.motif === 'manuel') {
                    L.sb.from('blocages').delete().eq('id', bloc.id).then(function (x) { if (x.error) L.ui.toast(L.messageErreur(x.error), 'erreur'); dessiner(); });
                    return;
                  }
                  if (!selection) { selection = jour; aide.textContent = t('calendrier.fin'); dessiner(); return; }
                  var a = selection < jour ? selection : jour, b = selection < jour ? jour : selection;
                  selection = null; aide.textContent = t('calendrier.aide');
                  L.sb.from('blocages').insert({ tenue_id: select.value, periode: '[' + a + ',' + b + ']', motif: 'manuel' }).then(function (x) {
                    if (x.error) L.ui.toast(x.error.code === '23P01' ? t('calendrier.chevauchement') : L.messageErreur(x.error), 'erreur');
                    dessiner();
                  });
                } }, String(Number(jour.slice(8)))));
            })(d);
          }
          cal.appendChild(grille);
        });
      }
    });
  };

  // ===========================================================================
  // Fournisseuse : revenus et paiements (Stripe Connect)
  // ===========================================================================
  VUES.revenus = function (contenu) {
    return sb(L.sb.from('reservations').select('id, statut, montant_transfert_cents, transfer_id, verse_at, date_debut, commission_cents, montant_location_cents, reservation_lignes(titre_snapshot)')
      .eq('fournisseuse_id', etat.profil.id).not('statut', 'in', '(demande,annulee)').order('date_debut', { ascending: false })).then(function (liste) {
      L.vider(contenu);
      var verse = liste.filter(function (r) { return r.verse_at && r.transfer_id !== 'aucun'; }).reduce(function (s, r) { return s + r.montant_transfert_cents; }, 0);
      var avenir = liste.filter(function (r) { return !r.verse_at && ['payee', 'remise', 'rendue', 'litige', 'acceptee'].indexOf(r.statut) >= 0; }).reduce(function (s, r) { return s + r.montant_transfert_cents; }, 0);
      contenu.appendChild(h('div', { class: 'kpis' },
        kpi(t('revenus.verse'), L.euros(verse)), kpi(t('revenus.a_venir'), L.euros(avenir)),
        kpi(t('revenus.locations'), String(liste.length)), kpi(t('revenus.note'), etat.profil.nb_avis ? '★ ' + Number(etat.profil.note_moyenne).toFixed(1) : '—', t('boutique.avis', { n: etat.profil.nb_avis })),
        etat.profil.solde_penalites_cents ? kpi(t('revenus.penalites'), L.euros(etat.profil.solde_penalites_cents), t('revenus.penalites_aide')) : null));
      var table = h('table', { class: 'table table--defile' }, h('thead', null, h('tr', null, h('th', null, t('revenus.date')), h('th', null, t('revenus.piece')), h('th', null, t('revenus.statut')), h('th', { class: 'num' }, t('revenus.location')), h('th', { class: 'num' }, t('revenus.commission')), h('th', { class: 'num' }, t('revenus.versement')))),
        h('tbody', null, liste.map(function (r) {
          return h('tr', null, h('td', null, L.dateCourte(r.date_debut)), h('td', null, (r.reservation_lignes || []).map(function (l) { return l.titre_snapshot; }).join(', ')), h('td', null, statut(r.statut)),
            h('td', { class: 'num' }, L.euros(r.montant_location_cents)), h('td', { class: 'num' }, '−' + L.euros(r.commission_cents)), h('td', { class: 'num' }, L.euros(r.montant_transfert_cents) + (r.verse_at ? ' ✓' : '')));
        })));
      contenu.appendChild(panneau(t('revenus.historique'), liste.length ? table : h('p', { class: 'texte' }, t('compte.aucune_location'))));
      return sb(L.sb.from('avis').select('note, commentaire, created_at').eq('cible_id', etat.profil.id).order('created_at', { ascending: false }).limit(20)).then(function (avis) {
        if (avis.length) contenu.appendChild(panneau(t('boutique.avis_titre'), h('div', { class: 'avis-liste' }, avis.map(L.rendreAvis))));
      });
    });
  };
  function kpi(libelle, valeur, note) { return h('div', { class: 'kpi' }, h('div', { class: 'kpi__libelle' }, libelle), h('div', { class: 'kpi__valeur' }, valeur), note ? h('div', { class: 'kpi__note' }, note) : null); }

  VUES.paiements = function (contenu) {
    L.vider(contenu);
    var etatZone = h('div');
    contenu.appendChild(panneau(t('compte.v_paiements'), h('div', null, h('p', { class: 'texte' }, t('paiements.intro')), etatZone)));
    function rendre(s) {
      L.vider(etatZone);
      if (s.complet) {
        etatZone.appendChild(h('p', { class: 'message message--succes' }, t('paiements.actif')));
        etatZone.appendChild(h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function (e) { e.currentTarget.disabled = true; L.api('connect-tableau').then(function (r) { location.href = r.url; }).catch(function (err) { L.ui.toast(L.messageErreur(err), 'erreur'); }); } }, t('paiements.tableau')));
      } else {
        etatZone.appendChild(h('p', { class: 'message message--alerte' }, s.compte ? t('paiements.incomplet') : t('paiements.aucun')));
        etatZone.appendChild(h('button', { class: 'bouton', type: 'button', onclick: function (e) { e.currentTarget.disabled = true; L.api('connect-onboarding').then(function (r) { location.href = r.url; }).catch(function (err) { e.target.disabled = false; L.ui.toast(L.messageErreur(err), 'erreur'); }); } }, s.compte ? t('paiements.reprendre') : t('paiements.configurer')));
      }
    }
    rendre({ complet: etat.profil.stripe_onboarding_complet, compte: !!etat.prive.stripe_account_id });
    if (L.param('connect') || !etat.profil.stripe_onboarding_complet) {
      L.api('connect-statut').then(function (s) { if (s.complet && !etat.profil.stripe_onboarding_complet) L.ui.toast(t('paiements.actif'), 'succes'); etat.profil.stripe_onboarding_complet = s.complet; rendre(s); }).catch(function () {});
    }
  };

  // ===========================================================================
  // Boutique (negafas et créatrices)
  // ===========================================================================
  VUES.boutique = function (contenu) {
    var p = etat.profil;
    var retour = h('div');
    var avatar = h('div', { class: 'arche', style: { width: '140px' } }, h('img', { src: p.avatar_chemin ? L.img.url(p.avatar_chemin, 'avatars') : L.img.placeholder('placeholder:takchita:emeraude:portee:5'), alt: '' }));
    var fichier = h('input', { type: 'file', accept: 'image/*', 'aria-label': t('boutique.photo') });
    var form = h('form', { class: 'formulaire' },
      h('div', { style: { display: 'flex', gap: '20px', alignItems: 'end', flexWrap: 'wrap' } }, h('div', { class: 'arche-cadre' }, avatar), h('label', { class: 'bouton bouton--ligne bouton--petit' }, t('boutique.photo'), fichier)),
      L.ui.champ('nom', 'boutique.nom', { maxlength: 80, value: p.boutique_nom || '' }),
      L.ui.champ('slug', 'boutique.slug', { maxlength: 40, pattern: '[a-z0-9-]{3,40}', value: p.boutique_slug || '', aide: t('boutique.slug_aide') }),
      L.ui.champ('bio', 'boutique.bio', { tag: 'textarea', maxlength: 1200 }),
      retour,
      h('div', { class: 'actions' }, h('button', { class: 'bouton', type: 'submit' }, t('commun.enregistrer')), h('a', { class: 'bouton bouton--ligne', href: 'boutique.html?id=' + p.id }, t('boutique.voir'))),
      p.compte_valide ? null : h('p', { class: 'message message--alerte' }, t('boutique.en_validation')));
    form.bio.value = p.boutique_bio || '';
    fichier.addEventListener('change', function () {
      if (!fichier.files[0]) return;
      L.img.compresser(fichier.files[0], { max: 900, maxMo: 0.3 }).then(function (webp) {
        var chemin = p.id + '/avatar-' + Date.now() + '.webp';
        return L.sb.storage.from('avatars').upload(chemin, webp, { contentType: 'image/webp' }).then(function (up) {
          if (up.error) throw up.error;
          return L.sb.from('profils').update({ avatar_chemin: chemin }).eq('id', p.id).then(function () { $('img', avatar).src = URL.createObjectURL(webp); p.avatar_chemin = chemin; });
        });
      }).catch(function (err) { erreur(retour, err); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      L.sb.from('profils').update({ boutique_nom: form.nom.value || null, boutique_slug: form.slug.value || null, boutique_bio: form.bio.value || null }).eq('id', p.id).then(function (r) {
        if (r.error) erreur(retour, r.error.code === '23505' ? { message: t('boutique.slug_pris') } : r.error); else L.ui.toast(t('commun.enregistre'), 'succes');
      });
    });
    L.vider(contenu).appendChild(panneau(t('compte.v_boutique'), form));
  };

  // ===========================================================================
  // Partenaire : fiche annuaire et leads
  // ===========================================================================
  VUES.partenaire = function (contenu) {
    return sb(L.sb.from('partenaires').select('*').eq('user_id', etat.profil.id).maybeSingle()).then(function (pa) {
      pa = pa || { galerie: [] };
      var galerie = (pa.galerie || []).slice();
      var retour = h('div');
      var vignettes = h('div', { class: 'depot-photos' });
      function rendreGalerie() {
        L.vider(vignettes);
        galerie.forEach(function (g, i) { vignettes.appendChild(h('div', { class: 'depot depot--rempli' }, h('img', { src: L.img.url(g, 'partenaires'), alt: '' }), h('button', { class: 'depot__libelle', type: 'button', onclick: function () { galerie.splice(i, 1); rendreGalerie(); } }, t('commun.supprimer')))); });
        if (galerie.length < 8) {
          var input = h('input', { type: 'file', accept: 'image/*', 'aria-label': t('partenaire.ajouter_photo') });
          input.addEventListener('change', function () {
            L.img.compresser(input.files[0]).then(function (webp) {
              var chemin = etat.profil.id + '/' + Date.now() + '.webp';
              return L.sb.storage.from('partenaires').upload(chemin, webp, { contentType: 'image/webp' }).then(function (up) { if (up.error) throw up.error; galerie.push(chemin); rendreGalerie(); });
            }).catch(function (err) { erreur(retour, err); });
          });
          vignettes.appendChild(h('label', { class: 'depot' }, h('span', { class: 'depot__libelle' }, t('partenaire.ajouter_photo')), input));
        }
      }
      rendreGalerie();
      var form = h('form', { class: 'formulaire' },
        pa.id && !pa.valide ? h('p', { class: 'message message--alerte' }, t('partenaire.en_validation')) : null,
        L.ui.champ('nom', 'partenaire.nom', { required: true, minlength: 2, maxlength: 80, value: pa.nom || '' }),
        h('div', { class: 'grille-2' },
          L.ui.champ('metier', 'partenaire.metier', { tag: 'select', options: C.metiers.map(function (m) { return [m, t('metier.' + m), pa.metier === m]; }) }),
          L.ui.champ('ville', 'cat.f_ville', { tag: 'select', options: C.villes.map(function (v) { return [v, v, pa.ville === v]; }) })),
        L.ui.champ('bio', 'partenaire.bio', { tag: 'textarea', maxlength: 1500 }),
        h('div', { class: 'grille-2' },
          L.ui.champ('email', 'partenaire.email', { type: 'email', required: true, value: pa.email_contact || L.session.user.email }),
          L.ui.champ('instagram', 'partenaire.instagram', { maxlength: 30, value: pa.instagram || '', pattern: '[A-Za-z0-9._]{1,30}' })),
        L.ui.champ('site', 'partenaire.site', { type: 'url', value: pa.site || '', placeholder: 'https://' }),
        h('fieldset', { class: 'filtres__groupe' }, h('legend', null, t('partenaire.galerie')), vignettes),
        retour, h('button', { class: 'bouton', type: 'submit' }, t('commun.enregistrer')));
      form.bio.value = pa.bio || '';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        var o = { nom: form.nom.value, metier: form.metier.value, ville: form.ville.value, bio: form.bio.value || null, email_contact: form.email.value, instagram: form.instagram.value || null, site: form.site.value || null, galerie: galerie };
        (pa.id ? L.sb.from('partenaires').update(o).eq('id', pa.id) : L.sb.from('partenaires').insert(o)).then(function (r) {
          if (r.error) erreur(retour, r.error); else { L.ui.toast(t('commun.enregistre'), 'succes'); etat.aller('partenaire'); }
        });
      });
      L.vider(contenu).appendChild(panneau(t('compte.v_partenaire'), form, pa.id && pa.valide ? h('a', { class: 'lien', href: 'partenaires.html#p-' + pa.id }, t('commun.voir')) : null));
    });
  };

  VUES.leads = function (contenu) {
    return sb(L.sb.from('leads').select('*').order('created_at', { ascending: false })).then(function (liste) {
      L.vider(contenu);
      if (!liste.length) { L.ui.etatVide(contenu, t('leads.aucun')); return; }
      contenu.appendChild(panneau(t('compte.v_leads'), h('div', null, liste.map(function (l) {
        return h('article', { class: 'ligne-resa' },
          h('div', { class: 'ligne-resa__tete' }, h('h3', { class: 'ligne-resa__titre' }, l.nom), h('span', { class: 'statut statut--' + (l.statut === 'envoye' ? 'demande' : 'confirme') }, t('leads.s_' + l.statut))),
          h('p', { style: { margin: 0, fontSize: '14px' } }, [l.date_evenement ? L.date(l.date_evenement) : null, l.ville, L.dateCourte(l.created_at)].filter(Boolean).join(' · ')),
          h('p', { style: { margin: 0 } }, l.message),
          h('p', { style: { margin: 0, fontSize: '14px' } }, h('a', { href: 'mailto:' + l.email }, l.email), l.telephone ? [' · ', h('a', { href: 'tel:' + l.telephone.replace(/\s/g, '') }, l.telephone)] : null),
          l.statut === 'envoye' ? h('div', null, h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { L.sb.from('leads').update({ statut: 'converti' }).eq('id', l.id).then(function () { etat.aller('leads'); }); } }, t('leads.converti'))) : null);
      }))));
    });
  };

  // ===========================================================================
  // Profil, identité, RGPD
  // ===========================================================================
  VUES.profil = function (contenu) {
    var p = etat.profil, pr = etat.prive;
    var retour = h('div');
    var form = h('form', { class: 'formulaire' },
      h('div', { class: 'grille-2' }, L.ui.champ('prenom', 'auth.prenom', { maxlength: 60, value: pr.prenom || '' }), L.ui.champ('nom', 'auth.nom', { maxlength: 80, value: pr.nom || '' })),
      h('div', { class: 'grille-2' }, L.ui.champ('nom_affiche', 'profil.nom_affiche', { maxlength: 80, value: p.nom_affiche || '', aide: t('profil.nom_affiche_aide') }), L.ui.champ('telephone', 'profil.telephone', { type: 'tel', value: pr.telephone || '', pattern: '[+0-9 ().-]{6,25}', aide: t('profil.telephone_aide') })),
      h('div', { class: 'grille-2' }, L.ui.champ('ville', 'cat.f_ville', { tag: 'select', options: [['', '—']].concat(C.villes.map(function (v) { return [v, v, p.ville === v]; })) }),
        L.ui.champ('langue', 'profil.langue', { tag: 'select', options: [['fr', 'Français', p.langue === 'fr'], ['nl', 'Nederlands', p.langue === 'nl']] })),
      L.ui.champ('adresse', 'profil.adresse', { maxlength: 200, value: pr.adresse || '', autocomplete: 'street-address' }),
      retour, h('button', { class: 'bouton', type: 'submit' }, t('commun.enregistrer')));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      Promise.all([
        L.sb.from('profils').update({ nom_affiche: form.nom_affiche.value, ville: form.ville.value || null, langue: form.langue.value }).eq('id', p.id),
        L.sb.from('profils_prives').update({ prenom: form.prenom.value || null, nom: form.nom.value || null, telephone: form.telephone.value || null, adresse: form.adresse.value || null }).eq('id', p.id)
      ]).then(function (r) {
        var err = r[0].error || r[1].error;
        if (err) erreur(retour, err); else { L.ui.toast(t('commun.enregistre'), 'succes'); I.changerLangue(form.langue.value); }
      });
    });
    var identite = h('div', null, p.identite_verifiee ? h('p', { class: 'message message--succes' }, t('profil.identite_ok')) :
      h('div', null, h('p', { class: 'texte' }, t('profil.identite_aide')), h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function (e) { e.currentTarget.disabled = true; L.api('identite-session', {}).then(function (r) { if (r.url) location.href = r.url; }).catch(function (err) { L.ui.toast(L.messageErreur(err), 'erreur'); }); } }, t('panier.identite_bouton'))));
    var rgpd = h('div', { class: 'actions' },
      h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function () {
        L.api('compte-exporter').then(function (d) {
          var a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })), download: 'mes-donnees.json' });
          document.body.appendChild(a); a.click(); a.remove();
        }).catch(function (err) { L.ui.toast(L.messageErreur(err), 'erreur'); });
      } }, t('profil.exporter')),
      h('button', { class: 'bouton bouton--danger', type: 'button', onclick: supprimerCompte }, t('profil.supprimer')));
    L.vider(contenu).appendChild(panneau(t('compte.v_profil'), form));
    contenu.appendChild(panneau(t('profil.identite'), identite));
    contenu.appendChild(panneau(t('profil.donnees'), h('div', null, h('p', { class: 'texte' }, t('profil.donnees_aide')), rgpd)));
    if (!p.est_partenaire && !p.est_fournisseuse) contenu.appendChild(panneau(t('profil.autres_roles'), h('div', { class: 'actions', style: { marginTop: 0 } },
      h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { etat.aller('annonces'); } }, t('compte.v_devenir')),
      h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { L.sb.from('profils').update({ est_partenaire: true }).eq('id', p.id).then(function () { location.href = 'compte.html?vue=partenaire'; }); } }, t('profil.devenir_partenaire')))));
  };

  function supprimerCompte() {
    var form = h('form', { class: 'formulaire' }, h('p', { class: 'message message--erreur' }, t('profil.supprimer_texte')),
      L.ui.champ('confirmation', 'profil.supprimer_saisir', { required: true, pattern: 'SUPPRIMER' }), h('div', { class: 'retour' }),
      h('button', { class: 'bouton bouton--danger', type: 'submit' }, t('profil.supprimer')));
    var m = L.ui.modale(form, { titre: t('profil.supprimer') });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      L.api('compte-supprimer', { confirmation: form.confirmation.value }).then(function () { m.fermer(); return L.sb.auth.signOut(); }).then(function () { location.href = 'index.html'; })
        .catch(function (err) { erreur($('.retour', form), err); });
    });
  }
})();
