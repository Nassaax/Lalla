/*
 * LALLAT — back-office (admin.html). Outil interne, en français.
 * Lecture via Supabase (RLS : est_admin()), actions sensibles via /api/v1/admin-*.
 */
(function () {
  'use strict';
  var L = window.Lalla, h = L.h, $ = L.$, $$ = L.$$;

  var ONGLETS = [
    ['tableau', 'Indicateurs'], ['annonces', 'Annonces'], ['comptes', 'Comptes'], ['reservations', 'Réservations'],
    ['litiges', 'Litiges'], ['signalements', 'Signalements'], ['parametres', 'Paramètres'], ['showrooms', 'Showrooms'], ['leads', 'Leads'], ['export', 'Exports']
  ];
  var LIBELLES_PARAMS = {
    commission_taux: ['Commission plateforme', 'taux', 'Sur le prix de location, côté fournisseuse (0,15 = 15 %)'],
    frais_service_taux: ['Frais de service cliente', 'taux', 'Ajoutés au panier (0,05 = 5 %)'],
    frais_pressing_cents: ['Frais de pressing', 'euros', 'Par tenue, reversés à la fournisseuse'],
    frais_essayage_cents: ['Frais d\'essayage', 'euros', 'Déduits si la cliente réserve'],
    essayage_validite_jours: ['Validité de la déduction d\'essayage', 'jours', ''],
    caution_taux: ['Taux de caution', 'taux', 'Caution = valeur déclarée × taux'],
    pressing_jours: ['Jours de pressing bloqués', 'jours', 'Avant et après chaque location'],
    delai_reponse_heures: ['Délai de réponse fournisseuse', 'heures', 'Au-delà : annulation automatique'],
    delai_litige_heures: ['Fenêtre de litige après retour', 'heures', ''],
    delai_versement_heures: ['Délai de versement après retour', 'heures', ''],
    seuil_identity_cents: ['Seuil Stripe Identity', 'euros', 'Caution totale au-delà de laquelle l\'identité est vérifiée'],
    empreinte_jours_avant: ['Empreinte de caution', 'jours', 'Nombre de jours avant la remise'],
    seuil_setup_jours: ['Seuil carte enregistrée', 'jours', 'Au-delà, la carte est enregistrée puis l\'empreinte créée plus tard'],
    penalite_fournisseuse_cents: ['Pénalité d\'annulation fournisseuse', 'euros', 'Déduite des prochains versements'],
    penalite_visibilite_points: ['Baisse de visibilité', 'points', 'Sur 100'],
    politique_annulation: ['Politique d\'annulation', 'politique', 'Remboursement de la location selon le nombre de jours avant l\'événement']
  };

  function sb(p) { return p.then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function eur(c) { return L.euros(c || 0); }
  function statut(s) { return h('span', { class: 'statut statut--' + s }, s.replace(/_/g, ' ')); }
  function panneau(titre, contenu, action) { return h('section', { class: 'panneau' }, h('div', { class: 'panneau__tete' }, h('h2', { class: 'panneau__titre' }, titre), action || null), contenu); }
  function kpi(l, v, n) { return h('div', { class: 'kpi' }, h('div', { class: 'kpi__libelle' }, l), h('div', { class: 'kpi__valeur' }, v), n ? h('div', { class: 'kpi__note' }, n) : null); }
  function tableau(entetes, lignes) {
    return h('table', { class: 'table table--defile' }, h('thead', null, h('tr', null, entetes.map(function (e) { return h('th', { class: /montant|€/i.test(e) ? 'num' : null }, e); }))), h('tbody', null, lignes));
  }
  function action(nom, corps, ok) {
    return L.api(nom, corps).then(function (r) { L.ui.toast(ok || 'Enregistré', 'succes'); return r; }).catch(function (e) { L.ui.toast(L.messageErreur(e), 'erreur'); throw e; });
  }

  L.pages.admin = function () {
    var zone = $('[data-admin]');
    L.ui.chargement(zone);
    L.auth.pret.then(function () {
      if (!L.session || !L.profil || !L.profil.est_admin) {
        L.vider(zone).appendChild(h('div', { class: 'vide' }, h('p', null, 'Accès réservé à l\'équipe.'),
          L.session ? null : h('button', { class: 'bouton', type: 'button', onclick: function () { L.ui.authentification('connexion', { ensuite: function () { location.reload(); } }); } }, 'Se connecter')));
        return;
      }
      var nav = h('nav', { class: 'tableau__nav', 'aria-label': 'Back-office' });
      var contenu = h('div');
      var courant = (location.hash || '#tableau').slice(1);
      if (!ONGLETS.some(function (o) { return o[0] === courant; })) courant = 'tableau';
      ONGLETS.forEach(function (o) {
        nav.appendChild(h('a', { href: '#' + o[0], class: 'onglet' + (o[0] === courant ? ' est-actif' : ''), 'data-onglet': o[0], onclick: function (e) { e.preventDefault(); aller(o[0]); } }, o[1]));
      });
      L.vider(zone).appendChild(h('div', null, h('div', { class: 'page-entete', style: { borderBottom: 0, paddingBottom: 0 } }, h('p', { class: 'surtitre' }, 'Back-office'), h('h1', null, 'Pilotage')), h('div', { class: 'tableau' }, nav, contenu)));
      function aller(o) {
        courant = o;
        history.replaceState(null, '', '#' + o);
        $$('.onglet', nav).forEach(function (x) { x.classList.toggle('est-actif', x.dataset.onglet === o); });
        L.ui.chargement(contenu);
        Promise.resolve(VUES[o](contenu, function () { aller(o); })).catch(function (e) { console.error(e); L.ui.etatVide(contenu, L.messageErreur(e)); });
      }
      aller(courant);
      window.addEventListener('hashchange', function () {
        var o = location.hash.slice(1);
        if (o !== courant && ONGLETS.some(function (x) { return x[0] === o; })) aller(o);
      });
    });
  };

  var VUES = {};

  VUES.tableau = function (z) {
    return L.api('admin-stats').then(function (s) {
      L.vider(z);
      z.appendChild(h('div', { class: 'kpis' },
        kpi('Locations payées (6 mois)', String(s.locations)), kpi('Volume de location', eur(s.volume_cents)),
        kpi('Commissions + frais', eur(s.commissions_cents)), kpi('Taux d\'acceptation', s.taux_acceptation == null ? '' : s.taux_acceptation + ' %'),
        kpi('Litiges ouverts', String(s.litiges_ouverts), s.litiges_total + ' au total'), kpi('Annonces à valider', String(s.annonces_en_attente)),
        kpi('Comptes à valider', String(s.comptes_a_valider)), kpi('Remboursements', eur(s.rembourse_cents))));
      var mois = Object.keys(s.mois);
      z.appendChild(panneau('Par mois', tableau(['Mois', 'Locations', 'Volume €', 'Commissions €'], mois.map(function (m) {
        var d = s.mois[m];
        return h('tr', null, h('td', null, L.date(m + '-01', { month: 'long', year: 'numeric' })), h('td', null, String(d.locations)), h('td', { class: 'num' }, eur(d.volume)), h('td', { class: 'num' }, eur(d.commissions)));
      }))));
      z.appendChild(panneau('Réservations par statut', h('div', { class: 'etiquettes' }, Object.keys(s.par_statut).map(function (k) { return h('span', { class: 'etiquette' }, k + ' : ' + s.par_statut[k]); }))));
    });
  };

  VUES.annonces = function (z, recharger) {
    return sb(L.sb.from('tenues').select('*, tenue_photos(type, chemin, ordre), fournisseuse:profils!tenues_fournisseuse_id_fkey(nom_affiche, boutique_nom, type_fournisseuse, compte_valide)').eq('statut', 'en_attente').order('soumise_at')).then(function (liste) {
      L.vider(z);
      if (!liste.length) { L.ui.etatVide(z, 'Aucune annonce en attente.'); return; }
      liste.forEach(function (tn) {
        var photos = (tn.tenue_photos || []).sort(function (a, b) { return a.ordre - b.ordre; });
        var motif = h('input', { class: 'champ__controle', placeholder: 'Motif du refus (envoyé à la fournisseuse)', 'aria-label': 'Motif du refus' });
        z.appendChild(panneau(tn.titre, h('div', { style: { display: 'grid', gap: '12px' } },
          h('div', { class: 'edl__photos', style: { gridTemplateColumns: 'repeat(4, 1fr)' } }, photos.map(function (p) { return h('figure', { style: { margin: 0 } }, h('img', { src: L.img.url(p.chemin), alt: p.type, style: { width: '100%', aspectRatio: '3/4', objectFit: 'cover' } }), h('figcaption', { class: 'champ__aide' }, p.type)); })),
          h('p', { style: { margin: 0 } }, [tn.categorie, tn.ville, tn.taille_indicative, eur(tn.prix_location_cents) + ' / location', 'valeur ' + eur(tn.valeur_declaree_cents)].join(' · ')),
          h('p', { class: 'texte', style: { margin: 0 } }, 'Par ' + ((tn.fournisseuse && (tn.fournisseuse.boutique_nom || tn.fournisseuse.nom_affiche)) || '') + (tn.fournisseuse && !tn.fournisseuse.compte_valide ? ' (compte non validé)' : '')),
          tn.categorie !== 'accessoire' ? h('p', { class: 'champ__aide', style: { margin: 0 } }, 'Mesures : poitrine ' + tn.poitrine_cm + ', taille ' + tn.taille_cm + ', hanches ' + tn.hanches_cm + ', longueur ' + tn.longueur_cm + ', manche ' + tn.manche_cm + ' cm') : null,
          tn.description ? h('p', { style: { margin: 0, whiteSpace: 'pre-line' } }, tn.description) : null,
          motif,
          h('div', { class: 'actions', style: { marginTop: 0 } },
            h('button', { class: 'bouton bouton--emeraude bouton--petit', type: 'button', onclick: function () { action('admin-tenue-statut', { tenue_id: tn.id, statut: 'validee' }, 'Annonce validée').then(recharger); } }, 'Valider'),
            h('button', { class: 'bouton bouton--danger bouton--petit', type: 'button', onclick: function () { if (!motif.value) { motif.focus(); L.ui.toast('Indiquez un motif.', 'erreur'); return; } action('admin-tenue-statut', { tenue_id: tn.id, statut: 'refusee', motif: motif.value }, 'Annonce refusée').then(recharger); } }, 'Refuser'))),
          statut('en_attente')));
      });
    });
  };

  VUES.comptes = function (z, recharger) {
    var recherche = h('input', { class: 'champ__controle', type: 'search', placeholder: 'Rechercher un nom…', 'aria-label': 'Rechercher' });
    var liste = h('div');
    L.vider(z).appendChild(panneau('Comptes', h('div', null, recherche, liste)));
    function charger() {
      var q = L.sb.from('profils').select('id, nom_affiche, boutique_nom, ville, est_fournisseuse, type_fournisseuse, est_partenaire, est_admin, statut_compte, compte_valide, stripe_onboarding_complet, identite_verifiee, score_visibilite, solde_penalites_cents, note_moyenne, nb_avis, created_at').order('compte_valide').order('created_at', { ascending: false }).limit(100);
      if (recherche.value) q = q.ilike('nom_affiche', '%' + recherche.value + '%');
      sb(q).then(function (comptes) {
        L.vider(liste).appendChild(tableau(['Nom', 'Rôles', 'Statut', 'Stripe', 'Identité', 'Score', 'Actions'], comptes.map(function (c) {
          var roles = [c.est_fournisseuse ? c.type_fournisseuse : null, c.est_partenaire ? 'partenaire' : null, c.est_admin ? 'admin' : null].filter(Boolean).join(', ') || 'cliente';
          var boutons = h('div', { class: 'actions', style: { marginTop: 0 } });
          if ((c.est_fournisseuse || c.est_partenaire) && !c.compte_valide) boutons.appendChild(h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function () { action('admin-compte', { user_id: c.id, action: 'valider' }).then(charger); } }, 'Valider'));
          boutons.appendChild(c.statut_compte === 'actif'
            ? h('button', { class: 'bouton bouton--danger bouton--petit', type: 'button', onclick: function () { L.ui.confirmer('Suspendre ' + c.nom_affiche + ' ?', 'Suspendre').then(function (o) { if (o) action('admin-compte', { user_id: c.id, action: 'suspendre' }).then(charger); }); } }, 'Suspendre')
            : h('button', { class: 'bouton bouton--ligne bouton--petit', type: 'button', onclick: function () { action('admin-compte', { user_id: c.id, action: 'reactiver' }).then(charger); } }, 'Réactiver'));
          if (c.score_visibilite < 100) boutons.appendChild(h('button', { class: 'lien', type: 'button', onclick: function () { action('admin-compte', { user_id: c.id, action: 'reinitialiser_score' }).then(charger); } }, 'Score à 100'));
          return h('tr', null, h('td', null, h('strong', null, c.boutique_nom || c.nom_affiche), h('br'), h('small', { class: 'texte' }, (c.ville || '') + ' · ' + L.dateCourte(c.created_at))),
            h('td', null, roles), h('td', null, statut(c.statut_compte), ' ', c.compte_valide ? '' : statut('en_attente')),
            h('td', null, c.est_fournisseuse ? (c.stripe_onboarding_complet ? 'actif' : 'incomplet') : ''), h('td', null, c.identite_verifiee ? 'vérifiée' : ''),
            h('td', null, c.score_visibilite + (c.solde_penalites_cents ? ' · pénalités ' + eur(c.solde_penalites_cents) : '')), h('td', null, boutons));
        })));
      });
    }
    recherche.addEventListener('input', L.debounce(charger, 300));
    charger();
  };

  VUES.reservations = function (z, recharger) {
    var filtre = h('select', { class: 'champ__controle', style: { width: 'auto' }, 'aria-label': 'Statut' }, [''].concat(['demande', 'acceptee', 'payee', 'remise', 'rendue', 'litige', 'cloturee', 'annulee']).map(function (s) { return h('option', { value: s }, s || 'Tous les statuts'); }));
    var liste = h('div');
    L.vider(z).appendChild(panneau('Réservations', h('div', null, filtre, liste)));
    function charger() {
      var q = L.sb.from('reservations').select('*, reservation_lignes(titre_snapshot), cliente:profils!reservations_cliente_id_fkey(nom_affiche), fournisseuse:profils!reservations_fournisseuse_id_fkey(nom_affiche, boutique_nom)').order('created_at', { ascending: false }).limit(150);
      if (filtre.value) q = q.eq('statut', filtre.value);
      sb(q).then(function (resas) {
        L.vider(liste).appendChild(tableau(['Réf.', 'Pièces', 'Parties', 'Dates', 'Statut', 'Caution', 'Montant €', ''], resas.map(function (r) {
          return h('tr', null, h('td', null, r.id.slice(0, 8).toUpperCase()), h('td', null, (r.reservation_lignes || []).map(function (l) { return l.titre_snapshot; }).join(', ')),
            h('td', null, ((r.cliente && r.cliente.nom_affiche) || '') + ' → ' + ((r.fournisseuse && (r.fournisseuse.boutique_nom || r.fournisseuse.nom_affiche)) || '')),
            h('td', null, L.dateCourte(r.date_debut) + ' au ' + L.dateCourte(r.date_fin)), h('td', null, statut(r.statut)),
            h('td', null, r.caution_cents ? eur(r.caution_cents) + ' · ' + r.caution_statut : ''), h('td', { class: 'num' }, eur(r.montant_location_cents)),
            h('td', null, ['demande', 'acceptee', 'payee'].indexOf(r.statut) >= 0 ? h('button', { class: 'lien', type: 'button', onclick: function () {
              L.ui.confirmer('Annuler cette réservation (remboursement intégral de la cliente) ?', 'Annuler').then(function (o) { if (o) action('reservation-annuler', { reservation_id: r.id, motif: 'Annulée par l\'équipe' }, 'Réservation annulée').then(charger); });
            } }, 'Annuler') : null));
        })));
      });
    }
    filtre.addEventListener('change', charger);
    charger();
  };

  VUES.litiges = function (z, recharger) {
    return sb(L.sb.from('litiges').select('*, reservation:reservations(*, reservation_lignes(id, titre_snapshot))').order('created_at', { ascending: false }).limit(50)).then(function (liste) {
      L.vider(z);
      if (!liste.length) { L.ui.etatVide(z, 'Aucun litige.'); return; }
      liste.forEach(function (lt) {
        var r = lt.reservation;
        var photosZone = h('div');
        var corps = h('div', { style: { display: 'grid', gap: '14px' } },
          h('p', { style: { margin: 0 } }, h('strong', null, lt.motif), ' · demandé ' + eur(lt.montant_demande_cents) + ' · caution ' + eur(r.caution_cents) + ' (' + r.caution_statut + ')'),
          h('p', { style: { margin: 0, whiteSpace: 'pre-line' } }, lt.description),
          photosZone);
        // Photos de remise et de retour côte à côte, puis photos du litige
        L.api('admin-reservation-edl', { reservation_id: r.id }).then(function (d) {
          d.lignes.forEach(function (l) {
            var remise = d.etats.find(function (e) { return e.ligne_id === l.id && e.type === 'remise'; }) || {};
            var retour = d.etats.find(function (e) { return e.ligne_id === l.id && e.type === 'retour'; }) || {};
            var grille = h('div', { class: 'edl__comparaison' });
            ['photo_face', 'photo_dos', 'photo_broderies', 'photo_doublure'].forEach(function (c) {
              [['Remise', remise], ['Retour', retour]].forEach(function (x) {
                var img = h('img', { alt: x[0] + ' ' + c });
                if (x[1][c]) L.img.signee('etats-des-lieux', x[1][c]).then(function (u) { if (u) img.src = u; });
                grille.appendChild(h('figure', { style: { margin: 0 } }, img, h('figcaption', null, x[0] + ' · ' + c.replace('photo_', ''))));
              });
            });
            var constat = function (e) { return [e.taches ? 'taches' : null, e.accrocs ? 'accrocs' : null, e.perles_manquantes ? 'perles' : null].filter(Boolean).join(', ') || 'RAS'; };
            photosZone.appendChild(h('div', null, h('p', { class: 'kpi__libelle' }, l.titre_snapshot + ', remise : ' + constat(remise) + ' · retour : ' + constat(retour)), grille));
          });
          if (lt.photos.length) {
            var g = h('div', { class: 'edl__photos', style: { gridTemplateColumns: 'repeat(4, 1fr)' } });
            lt.photos.forEach(function (p) { var img = h('img', { alt: 'photo du litige', style: { width: '100%', aspectRatio: '1', objectFit: 'cover' } }); L.img.signee('litiges', p).then(function (u) { if (u) img.src = u; }); g.appendChild(img); });
            photosZone.appendChild(h('div', null, h('p', { class: 'kpi__libelle' }, 'Photos du signalement'), g));
          }
        });
        if (lt.statut === 'ouvert') {
          var form = h('form', { class: 'formulaire' },
            h('div', { class: 'grille-2' },
              L.ui.champ('capture', 'Retenue sur la caution (€)', { type: 'number', min: '0', step: '0.01', max: String(r.caution_cents / 100), value: String(lt.montant_demande_cents / 100) }),
              L.ui.champ('rembourse', 'Remboursement à la cliente (€)', { type: 'number', min: '0', step: '0.01', value: '0' })),
            L.ui.champ('decision', 'Décision motivée (envoyée aux deux parties)', { tag: 'textarea', required: true, minlength: 10 }),
            h('button', { class: 'bouton', type: 'submit' }, 'Clôturer le litige'));
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!form.checkValidity()) { form.reportValidity(); return; }
            L.ui.confirmer('Capturer ' + eur(Math.round(form.capture.value * 100)) + ' et rembourser ' + eur(Math.round(form.rembourse.value * 100)) + ' ? Cette action est définitive.', 'Clôturer').then(function (o) {
              if (o) action('admin-litige-resoudre', { litige_id: lt.id, capture_cents: Math.round(Number(form.capture.value) * 100), rembourse_cents: Math.round(Number(form.rembourse.value) * 100), decision: form.decision.value }, 'Litige résolu').then(recharger);
            });
          });
          corps.appendChild(form);
        } else {
          corps.appendChild(h('p', { class: 'message' }, 'Résolu le ' + L.dateHeure(lt.resolu_at) + ' : retenue ' + eur(lt.montant_capture_cents) + ', remboursement ' + eur(lt.montant_rembourse_cents) + '. ' + (lt.decision || '')));
        }
        z.appendChild(panneau('Litige ' + r.id.slice(0, 8).toUpperCase() + ', ' + (r.reservation_lignes || []).map(function (l) { return l.titre_snapshot; }).join(', '), corps, statut(lt.statut)));
      });
    });
  };

  VUES.parametres = function (z) {
    return sb(L.sb.from('parametres').select('*').order('cle')).then(function (liste) {
      var lancement = blocLancement(liste, function () { VUES.parametres(z); });
      var form = h('form', { class: 'formulaire' });
      liste = liste.filter(function (p) { return p.cle !== 'reservations_ouvertes' && p.cle !== 'date_ouverture'; });
      liste.forEach(function (p) {
        var def = LIBELLES_PARAMS[p.cle] || [p.cle, 'brut', p.description];
        var champ;
        if (def[1] === 'politique') {
          champ = L.ui.champ(p.cle, def[0], { tag: 'textarea', aide: def[2] + '. Une ligne par palier : « jours_min:pourcentage », par ex. 30:100' });
          $('textarea', champ).value = p.valeur.map(function (x) { return x.jours_min + ':' + x.pct; }).join('\n');
        } else {
          var v = def[1] === 'euros' ? p.valeur / 100 : p.valeur;
          champ = L.ui.champ(p.cle, def[0] + (def[1] === 'euros' ? ' (€)' : def[1] === 'taux' ? '' : ' (' + def[1] + ')'), { type: 'number', step: def[1] === 'taux' ? '0.01' : def[1] === 'euros' ? '0.5' : '1', value: String(v), aide: def[2] });
        }
        champ.dataset.cle = p.cle; champ.dataset.type = def[1];
        form.appendChild(champ);
      });
      form.appendChild(h('button', { class: 'bouton', type: 'submit' }, 'Enregistrer les paramètres'));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var envois = $$('[data-cle]', form).map(function (c) {
          var input = $('input, textarea', c), type = c.dataset.type, valeur;
          if (type === 'politique') valeur = input.value.split('\n').filter(Boolean).map(function (l) { var x = l.split(':'); return { jours_min: Number(x[0]), pct: Number(x[1]) }; });
          else if (type === 'euros') valeur = Math.round(Number(input.value) * 100);
          else valeur = Number(input.value);
          return L.api('admin-parametres', { cle: c.dataset.cle, valeur: valeur }).catch(function (err) { throw new Error(c.dataset.cle + ' : ' + L.messageErreur(err)); });
        });
        Promise.all(envois).then(function () { L.ui.toast('Paramètres enregistrés', 'succes'); }).catch(function (err) { L.ui.toast(err.message, 'erreur'); });
      });
      L.vider(z).appendChild(lancement);
      z.appendChild(panneau('Paramètres métier', form));
    });
  };

  /** Interrupteur de lancement : pré-lancement (rien n'est encaissé) ou réservations ouvertes. */
  function blocLancement(liste, recharger) {
    var val = function (cle, def) { var l = liste.filter(function (p) { return p.cle === cle; })[0]; return l ? l.valeur : def; };
    var ouvert = val('reservations_ouvertes', false) === true;
    var envoyer = function (cle, valeur) { return L.api('admin-parametres', { cle: cle, valeur: valeur }); };
    var bascule = h('button', { class: 'bouton' + (ouvert ? ' bouton--ligne' : ''), type: 'button' }, ouvert ? 'Repasser en pré-lancement' : 'Ouvrir les réservations');
    bascule.addEventListener('click', function () {
      var message = ouvert ? 'Fermer les réservations ? Les commandes déjà payées ne sont pas touchées.' : 'Ouvrir les réservations ? Les clientes pourront réserver et payer, et toutes les inscrites seront prévenues. En mode réel, vérifiez d\'abord que Stripe utilise les clés de production.';
      // Confirmation dans le site (les boîtes natives peuvent être bloquées par Safari sur iPad).
      var valider = h('button', { class: 'bouton', type: 'button' }, ouvert ? 'Oui, repasser en pré-lancement' : 'Oui, ouvrir les réservations');
      var m = L.ui.modale(h('div', { class: 'formulaire' }, h('p', { class: 'texte' }, message),
        h('div', { class: 'actions', style: { margin: 0 } }, valider, h('button', { class: 'bouton bouton--ligne', type: 'button', onclick: function () { m.fermer(); } }, 'Annuler'))), { titre: 'Lancement' });
      valider.addEventListener('click', function () {
        valider.disabled = true;
        envoyer('reservations_ouvertes', !ouvert).then(function () { m.fermer(); L.ui.toast(ouvert ? 'Site repassé en pré-lancement' : 'Réservations ouvertes', 'succes'); recharger(); })
          .catch(function (e) { valider.disabled = false; L.ui.toast(L.messageErreur(e), 'erreur'); });
      });
    });
    return panneau('Lancement', h('div', { class: 'formulaire' },
      h('p', { class: 'message ' + (ouvert ? 'message--succes' : 'message--alerte') }, ouvert
        ? 'Réservations ouvertes : les clientes peuvent réserver et payer.'
        : 'Pré-lancement : comptes, annonces, favoris et messages fonctionnent, mais aucune réservation ni aucun paiement n\'est possible.'),
      h('p', { class: 'champ__aide' }, 'Le site affiche « Coming soon » sans date tant que les réservations sont fermées.'),
      h('div', { class: 'actions', style: { margin: 0 } }, bascule)));
  }

  VUES.showrooms = function (z, recharger) {
    return sb(L.sb.from('showrooms').select('*, showroom_inscriptions(count)').order('debut', { ascending: false })).then(function (liste) {
      L.vider(z);
      var form = h('form', { class: 'formulaire' },
        L.ui.champ('titre', 'Titre', { required: true }),
        h('div', { class: 'grille-2' }, L.ui.champ('ville', 'Ville', { tag: 'select', options: L.config.villes.map(function (v) { return [v, v]; }) }), L.ui.champ('places', 'Places', { type: 'number', min: '1', value: '30' })),
        h('div', { class: 'grille-2' }, L.ui.champ('lieu', 'Lieu', { required: true }), L.ui.champ('adresse', 'Adresse', { required: true })),
        h('div', { class: 'grille-2' }, L.ui.champ('debut', 'Début', { type: 'datetime-local', required: true }), L.ui.champ('fin', 'Fin', { type: 'datetime-local', required: true })),
        h('button', { class: 'bouton', type: 'submit' }, 'Créer le showroom'));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        sb(L.sb.from('showrooms').insert({ titre: form.titre.value, ville: form.ville.value, places: Number(form.places.value), lieu: form.lieu.value, adresse: form.adresse.value, debut: new Date(form.debut.value).toISOString(), fin: new Date(form.fin.value).toISOString() }))
          .then(function () { L.ui.toast('Showroom créé', 'succes'); recharger(); }).catch(function (err) { L.ui.toast(L.messageErreur(err), 'erreur'); });
      });
      z.appendChild(panneau('Showrooms', tableau(['Titre', 'Date', 'Lieu', 'Inscriptions', 'Actif', ''], liste.map(function (s) {
        var nb = (s.showroom_inscriptions && s.showroom_inscriptions[0] && s.showroom_inscriptions[0].count) || 0;
        return h('tr', null, h('td', null, s.titre), h('td', null, L.dateHeure(s.debut)), h('td', null, s.lieu + ', ' + s.ville), h('td', null, nb + ' / ' + s.places), h('td', null, s.actif ? 'oui' : 'non'),
          h('td', null, h('button', { class: 'lien', type: 'button', onclick: function () { sb(L.sb.from('showrooms').update({ actif: !s.actif }).eq('id', s.id)).then(recharger); } }, s.actif ? 'Désactiver' : 'Activer'),
            ' ', h('button', { class: 'lien', type: 'button', onclick: function () { inscrits(s); } }, 'Inscrites')));
      }))));
      z.appendChild(panneau('Nouveau showroom', form));
    });
  };

  function inscrits(s) {
    var c = h('div');
    L.ui.modale(c, { titre: s.titre, large: true });
    L.ui.chargement(c);
    sb(L.sb.from('showroom_inscriptions').select('created_at, tenue_ids, message, profil:profils(nom_affiche)').eq('showroom_id', s.id)).then(function (l) {
      L.vider(c).appendChild(l.length ? tableau(['Cliente', 'Inscrite le', 'Pièces demandées'], l.map(function (i) { return h('tr', null, h('td', null, i.profil ? i.profil.nom_affiche : ''), h('td', null, L.dateCourte(i.created_at)), h('td', null, String(i.tenue_ids.length))); })) : h('p', null, 'Aucune inscription.'));
    });
  }

  VUES.leads = function (z, recharger) {
    return sb(L.sb.from('leads').select('*, partenaire:partenaires(nom, metier, taux_commission)').order('created_at', { ascending: false }).limit(200)).then(function (liste) {
      L.vider(z).appendChild(panneau('Leads du hub mariage', liste.length ? tableau(['Date', 'Partenaire', 'Client', 'Statut', 'Commission €', ''], liste.map(function (l) {
        var sel = h('select', { class: 'champ__controle', style: { minHeight: '34px', fontSize: '13px' }, 'aria-label': 'Statut' }, ['envoye', 'converti', 'commission_due', 'payee'].map(function (s) { return h('option', { value: s, selected: l.statut === s }, s); }));
        var com = h('input', { class: 'champ__controle', type: 'number', step: '0.01', min: '0', value: String(l.montant_commission_cents / 100), style: { minHeight: '34px', width: '100px' }, 'aria-label': 'Commission' });
        return h('tr', null, h('td', null, L.dateCourte(l.created_at)), h('td', null, l.partenaire ? l.partenaire.nom : ''), h('td', null, l.nom, h('br'), h('small', null, l.email)),
          h('td', null, sel), h('td', null, com),
          h('td', null, h('button', { class: 'bouton bouton--petit', type: 'button', onclick: function () {
            sb(L.sb.from('leads').update({ statut: sel.value, montant_commission_cents: Math.round(Number(com.value) * 100) }).eq('id', l.id)).then(function () { L.ui.toast('Lead mis à jour', 'succes'); }).catch(function (e) { L.ui.toast(L.messageErreur(e), 'erreur'); });
          } }, 'OK')));
      })) : h('p', null, 'Aucun lead.')));
    });
  };

  var MOTIFS = { contrefacon: 'Contrefaçon', photos_trompeuses: 'Photos trompeuses', arnaque: 'Arnaque', comportement: 'Comportement', hors_plateforme: 'Paiement hors plateforme', autre: 'Autre' };
  VUES.signalements = function (z, recharger) {
    return sb(L.sb.from('signalements').select('*, auteur:profils!signalements_auteur_id_fkey(nom_affiche)').order('created_at', { ascending: false }).limit(200)).then(function (liste) {
      function lien(s) {
        if (s.cible_type === 'tenue') return h('a', { href: 'tenue.html?id=' + s.cible_id, target: '_blank', rel: 'noopener' }, 'Annonce');
        if (s.cible_type === 'profil') return h('a', { href: 'boutique.html?id=' + s.cible_id, target: '_blank', rel: 'noopener' }, 'Profil');
        return h('button', { class: 'lien', type: 'button', onclick: function () { conversation(s.cible_id); } }, 'Conversation');
      }
      L.vider(z).appendChild(panneau('Signalements', liste.length ? tableau(['Date', 'Par', 'Cible', 'Motif', 'Message', 'Statut', ''], liste.map(function (s) {
        var note = h('input', { class: 'champ__controle', value: s.note_admin || '', placeholder: 'Note interne', style: { minHeight: '34px', fontSize: '13px' }, 'aria-label': 'Note' });
        return h('tr', null, h('td', null, L.dateCourte(s.created_at)), h('td', null, s.auteur ? s.auteur.nom_affiche : ''), h('td', null, lien(s)),
          h('td', null, MOTIFS[s.motif] || s.motif), h('td', { style: { maxWidth: '280px' } }, s.message || ''), h('td', null, statut(s.statut)),
          h('td', null, note, s.statut === 'ouvert' ? h('button', { class: 'bouton bouton--petit', type: 'button', style: { marginTop: '6px' }, onclick: function () {
            sb(L.sb.from('signalements').update({ statut: 'traite', note_admin: note.value || null, traite_at: new Date().toISOString() }).eq('id', s.id)).then(function () { L.ui.toast('Signalement traité', 'succes'); recharger(); }).catch(function (e) { L.ui.toast(L.messageErreur(e), 'erreur'); });
          } }, 'Marquer traité') : null));
      })) : h('p', null, 'Aucun signalement.')));
    });
  };

  /** Lecture d'une conversation signalée (accès réservé à l'administration). */
  function conversation(id) {
    var contenu = h('div');
    L.ui.modale(contenu, { titre: 'Conversation signalée', large: true });
    sb(L.sb.from('messages').select('auteur_id, contenu, masque, created_at, auteur:profils!messages_auteur_id_fkey(nom_affiche)').eq('conversation_id', id).order('created_at')).then(function (m) {
      L.vider(contenu).appendChild(h('div', { class: 'discussion__messages', style: { maxHeight: '60vh' } }, m.map(function (x) {
        return h('div', { class: 'bulle' }, h('strong', null, (x.auteur ? x.auteur.nom_affiche : '?') + ' : '), x.contenu, h('small', null, L.dateHeure(x.created_at) + (x.masque ? ' · coordonnées masquées' : '')));
      })));
    }).catch(function (e) { L.vider(contenu).appendChild(h('p', null, L.messageErreur(e))); });
  }

  function exportDac7() {
    var annee = h('input', { class: 'champ__controle', type: 'number', min: '2024', max: '2100', value: String(new Date().getFullYear() - 1), 'aria-label': 'Année', style: { width: '120px' } });
    var resume = h('div');
    var bouton = h('button', { class: 'bouton', type: 'button', onclick: function () {
      bouton.disabled = true;
      L.api('admin-dac7', { annee: Number(annee.value) }).then(function (r) {
        bouton.disabled = false;
        var a = h('a', { href: URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' })), download: r.nom });
        document.body.appendChild(a); a.click(); a.remove();
        L.vider(resume).appendChild(h('p', { class: r.incompletes ? 'message message--alerte' : 'message message--succes' },
          r.fournisseuses + ' fournisseuse(s) déclarable(s)' + (r.incompletes ? ', dont ' + r.incompletes + ' sans informations fiscales : relancez-les depuis leur compte.' : '.')));
      }).catch(function (e) { bouton.disabled = false; L.ui.toast(L.messageErreur(e), 'erreur'); });
    } }, 'Télécharger la déclaration');
    return panneau('Déclaration DAC7 (annuelle)', h('div', null,
      h('p', { class: 'texte' }, 'Pour chaque fournisseuse payée dans l\'année : identité fiscale, nombre de locations et montants par trimestre. À transmettre au SPF Finances avant le 31 janvier de l\'année suivante (déclaration des opérateurs de plateforme).'),
      h('div', { class: 'actions' }, annee, bouton), resume));
  }

  VUES.export = function (z) {
    var d = new Date(); d.setMonth(d.getMonth() - 1);
    var mois = h('input', { class: 'champ__controle', type: 'month', value: d.toISOString().slice(0, 7), 'aria-label': 'Mois', style: { width: 'auto' } });
    var resume = h('div');
    var bouton = h('button', { class: 'bouton', type: 'button', onclick: function () {
      bouton.disabled = true;
      L.api('admin-export', { mois: mois.value }).then(function (r) {
        bouton.disabled = false;
        var a = h('a', { href: URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' })), download: r.nom });
        document.body.appendChild(a); a.click(); a.remove();
        L.vider(resume).appendChild(h('div', { class: 'etiquettes' }, Object.keys(r.totaux).map(function (k) { return h('span', { class: 'etiquette' }, k + ' : ' + eur(r.totaux[k])); })));
      }).catch(function (e) { bouton.disabled = false; L.ui.toast(L.messageErreur(e), 'erreur'); });
    } }, 'Télécharger le CSV');
    L.vider(z).appendChild(panneau('Export comptable mensuel', h('div', null,
      h('p', { class: 'texte' }, 'Ventes (paiements), commissions et frais de service, transferts aux fournisseuses, remboursements, retenues sur caution et pénalités. Séparateur « ; », montants en euros, compatible Excel.'),
      h('div', { class: 'actions' }, mois, bouton), resume)));
    z.appendChild(exportDac7());
  };
})();
