/*
 * LALLA, visuels d'illustration générés (aucune photo externe).
 * Rendu « photo studio » : tissu satiné, broderies et passementerie dorées, éclairage doux.
 * Spécification : placeholder:<categorie|sous_categorie>:<couleur>:<face|dos|broderie|portee|doublure>:<graine>
 * Exposé en window.LallaVisuels.svg(spec, couleurs) → chaîne SVG.
 */
(function (root) {
  'use strict';

  function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function vers(r, g, b) { return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
  /** Éclaircit (f > 0) ou assombrit (f < 0) une couleur ; l'ombre tire vers un brun chaud plutôt que le noir. */
  function teinte(c, f) {
    var x = hex(c), cible = f < 0 ? [28, 20, 16] : [255, 250, 242], a = Math.abs(f);
    return vers(Math.round(x[0] + (cible[0] - x[0]) * a), Math.round(x[1] + (cible[1] - x[1]) * a), Math.round(x[2] + (cible[2] - x[2]) * a));
  }
  function lum(c) { var x = hex(c); return (0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]) / 255; }
  function alea(graine) {
    var s = (graine * 9301 + 49297) % 233280 || 1;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  function miroir(d) { return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, function (m, x, y) { return (600 - parseFloat(x)) + ' ' + y; }); }

  var OR = ['#7A5B2B', '#C9A961', '#F3E3B5', '#B08A45', '#E8D49C', '#7E5F2E'];

  function defs(id, coul, r) {
    var clair = lum(coul) > 0.62;
    var sombre = teinte(coul, clair ? -0.32 : -0.55), mi = coul, haut = teinte(coul, clair ? 0.5 : 0.32), eclat = teinte(coul, clair ? 0.85 : 0.6);
    // Plis satinés : alternance d'ombres et de reflets, décalés selon la graine.
    var d = r() * 0.08, stops = [[0, sombre], [0.14 + d, mi], [0.3 + d, haut], [0.42 + d, eclat], [0.52 + d, haut], [0.64 + d, mi], [0.8 + d, sombre], [0.9, mi], [1, sombre]];
    var plis = stops.map(function (s) { return '<stop offset="' + Math.min(1, s[0]).toFixed(3) + '" stop-color="' + s[1] + '"/>'; }).join('');
    return '<defs>' +
      '<radialGradient id="' + id + 'fond" cx="50%" cy="34%" r="78%"><stop offset="0" stop-color="#FBF7F0"/><stop offset=".55" stop-color="#EFE6D8"/><stop offset="1" stop-color="#D6C7AF"/></radialGradient>' +
      '<linearGradient id="' + id + 'plis" x1="0" y1="0" x2="1" y2="0">' + plis + '</linearGradient>' +
      '<linearGradient id="' + id + 'volume" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>' +
      '<linearGradient id="' + id + 'or" x1="0" y1="0" x2="1" y2="1">' + OR.map(function (c, i) { return '<stop offset="' + (i / (OR.length - 1)).toFixed(2) + '" stop-color="' + c + '"/>'; }).join('') + '</linearGradient>' +
      '<linearGradient id="' + id + 'orv" x1="0" y1="0" x2="0" y2="1">' + OR.map(function (c, i) { return '<stop offset="' + (i / (OR.length - 1)).toFixed(2) + '" stop-color="' + c + '"/>'; }).join('') + '</linearGradient>' +
      '<filter id="' + id + 'flou" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>' +
      '<filter id="' + id + 'ombre" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>' +
      '<filter id="' + id + 'grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="' + Math.round(r() * 50) + '"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .05 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '</defs>';
  }

  // Silhouettes (moitié gauche, la droite est obtenue par symétrie). Repère 600 × 800.
  var FORMES = {
    caftan: {
      corps: 'M272 118C257 124 236 130 212 146C220 200 226 250 228 310C230 345 232 365 232 385C220 520 168 660 112 768Q300 792 488 768C432 660 380 520 368 385C368 365 370 345 372 310C374 250 380 200 388 146C364 130 343 124 328 118C315 136 285 136 272 118Z',
      manche: 'M212 146C176 172 128 320 96 494Q140 518 186 506C200 420 212 330 230 254C228 214 222 176 212 146Z',
      poignet: 'M100 478Q142 502 188 492', ourlet: 'M124 742Q300 768 476 742', taille: 372
    },
    homme: {
      corps: 'M272 112C256 118 232 126 208 142C210 220 214 300 214 380C212 520 206 650 200 760Q300 772 400 760C394 650 388 520 386 380C386 300 390 220 392 142C368 126 344 118 328 112C316 128 284 128 272 112Z',
      manche: 'M208 142C178 160 150 260 136 420Q164 436 192 430C198 360 206 290 216 230C214 196 212 168 208 142Z',
      poignet: 'M138 404Q166 420 194 414', ourlet: 'M204 736Q300 748 396 736', taille: null
    }
  };

  function silhouette(id, cat, coul, r, vue) {
    var f = cat === 'homme' ? FORMES.homme : FORMES.caftan;
    var corps = f.corps, mg = f.manche, md = miroir(f.manche);
    var s = '';
    // Ombre portée au sol et ombre douce derrière la tenue
    s += '<ellipse cx="300" cy="778" rx="210" ry="16" fill="#2A1F18" opacity=".32" filter="url(#' + id + 'ombre)"/>';
    s += '<path d="' + corps + '" transform="translate(10 14)" fill="#2A1F18" opacity=".22" filter="url(#' + id + 'ombre)"/>';
    // Corps : satin + volume
    s += '<path d="' + corps + '" fill="url(#' + id + 'plis)"/>';
    // Drapés : reflets qui partent de la taille et s'ouvrent vers l'ourlet
    for (var i = 0; i < 7; i++) {
      var x0 = 246 + i * 18 + r() * 8, x1 = 130 + i * 56 + r() * 16, l = 14 + r() * 16;
      s += '<path d="M' + x0.toFixed(0) + ' 400C' + (x0 - 2).toFixed(0) + ' 540 ' + (x1 + 4).toFixed(0) + ' 660 ' + x1.toFixed(0) + ' 766L' + (x1 + l).toFixed(0) + ' 768C' + (x1 + l + 4).toFixed(0) + ' 660 ' + (x0 + 8).toFixed(0) + ' 540 ' + (x0 + 6).toFixed(0) + ' 400Z" fill="' + (i % 2 ? '#000' : '#fff') + '" opacity="' + (i % 2 ? '.2' : '.24') + '" filter="url(#' + id + 'flou)"/>';
    }
    s += '<path d="' + corps + '" fill="url(#' + id + 'volume)"/>';
    // Takchita : robe de dessus ouverte, la robe de dessous apparaît au centre
    if ((cat === 'takchita' || cat === 'mariee') && vue !== 'dos') {
      var dessous = teinte(coul, lum(coul) > 0.62 ? -0.12 : 0.42);
      s += '<path d="M286 140C282 260 268 430 238 770Q300 778 362 770C332 430 318 260 314 140Z" fill="' + dessous + '" opacity=".92"/>';
      s += '<path d="M286 140C282 260 268 430 238 770Q300 778 362 770C332 430 318 260 314 140Z" fill="url(#' + id + 'volume)"/>';
      s += '<path d="M286 140C282 260 268 430 238 770M314 140C318 260 332 430 362 770" fill="none" stroke="url(#' + id + 'orv)" stroke-width="7"/>';
      s += '<path d="M286 140C282 260 268 430 238 770M314 140C318 260 332 430 362 770" fill="none" stroke="#FFF6DA" stroke-width="1" opacity=".55" stroke-dasharray="2 6"/>';
    }
    // Manches
    [mg, md].forEach(function (m) {
      s += '<path d="' + m + '" fill="url(#' + id + 'plis)"/><path d="' + m + '" fill="url(#' + id + 'volume)"/>';
      s += '<path d="' + m + '" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="1.2"/>';
    });
    // Passementerie : poignets et ourlet
    [f.poignet, miroir(f.poignet)].forEach(function (p) {
      s += '<path d="' + p + '" fill="none" stroke="url(#' + id + 'or)" stroke-width="16" stroke-linecap="round"/>';
      s += '<path d="' + p + '" fill="none" stroke="#FFF3CF" stroke-width="1.2" stroke-dasharray="1 5" opacity=".8"/>';
    });
    s += '<path d="' + f.ourlet + '" fill="none" stroke="url(#' + id + 'or)" stroke-width="' + (cat === 'mariee' ? 26 : 14) + '"/>';
    s += '<path d="' + f.ourlet + '" fill="none" stroke="#FFF3CF" stroke-width="1.2" stroke-dasharray="1 6" opacity=".7" transform="translate(0 -3)"/>';
    // Encolure
    s += '<path d="M270 118C285 136 315 136 330 118" fill="none" stroke="url(#' + id + 'or)" stroke-width="7" stroke-linecap="round"/>';
    if (vue === 'dos') {
      s += '<path d="M300 132V752" stroke="#000" stroke-opacity=".12" stroke-width="1.5"/>';
    } else if (cat !== 'takchita' && cat !== 'mariee') {
      // Sfifa centrale et boutons (aakad)
      var bas = cat === 'homme' ? 420 : 760;
      s += '<path d="M300 134V' + bas + '" stroke="url(#' + id + 'orv)" stroke-width="10"/>';
      for (var y = 146; y < (cat === 'homme' ? 420 : 380); y += 13) {
        s += '<circle cx="300" cy="' + y + '" r="3.6" fill="url(#' + id + 'or)"/><circle cx="299" cy="' + (y - 1) + '" r="1.1" fill="#FFF6DA"/>';
      }
    }
    // Ceinture (mdamma)
    if ((cat === 'takchita' || cat === 'mariee') && f.taille) {
      var t = f.taille;
      s += '<path d="M228 ' + (t - 16) + 'Q300 ' + (t - 8) + ' 372 ' + (t - 16) + 'L372 ' + (t + 16) + 'Q300 ' + (t + 24) + ' 228 ' + (t + 16) + 'Z" fill="url(#' + id + 'or)"/>';
      s += '<path d="M226 ' + (t - 9) + 'Q300 ' + (t - 1) + ' 374 ' + (t - 9) + 'M226 ' + (t + 9) + 'Q300 ' + (t + 17) + ' 374 ' + (t + 9) + '" fill="none" stroke="#5E4520" stroke-width=".8" opacity=".6"/>';
      for (var k = 0; k < 4; k++) {
        var bx = [246, 268, 332, 354][k];
        s += '<rect x="' + (bx - 5) + '" y="' + (t - 1) + '" width="10" height="10" transform="rotate(45 ' + bx + ' ' + (t + 4) + ')" fill="none" stroke="#5E4520" stroke-width=".9" opacity=".7"/>';
      }
      s += '<ellipse cx="300" cy="' + (t + 4) + '" rx="24" ry="20" fill="url(#' + id + 'or)" stroke="#5E4520" stroke-width="1"/>';
      s += '<ellipse cx="300" cy="' + (t + 4) + '" rx="10" ry="9" fill="' + teinte(coul === '#FFFFFF' || lum(coul) > 0.62 ? '#1F5E4B' : coul, -0.1) + '"/><ellipse cx="297" cy="' + (t) + '" rx="3" ry="2" fill="#fff" opacity=".7"/>';
    }
    // Mariée : paillettes et perles
    if (cat === 'mariee') {
      for (var e = 0; e < 70; e++) {
        var px = 150 + r() * 300, py = 160 + r() * 600;
        s += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (0.8 + r() * 1.6).toFixed(1) + '" fill="#FFF4D2" opacity="' + (0.35 + r() * 0.5).toFixed(2) + '"/>';
      }
    }
    // Cintre discret au-dessus de l'encolure
    s += '<path d="M300 118V96Q300 84 310 84Q318 84 318 92" fill="none" stroke="#8C7A62" stroke-width="2.4" stroke-linecap="round"/>';
    s += '<path d="M230 126Q300 100 370 126" fill="none" stroke="#8C7A62" stroke-width="2.4" opacity=".5"/>';
    return s;
  }

  function broderie(id, coul, r) {
    var s = '<rect width="600" height="800" fill="url(#' + id + 'plis)"/><rect width="600" height="800" fill="url(#' + id + 'volume)"/>';
    var or = 'url(#' + id + 'or)';
    // Étoile à huit branches (khatam) entrelacée, anneaux de perles, cadre de losanges.
    s += '<g transform="translate(300 400) rotate(' + Math.round(r() * 30) + ')">';
    [150, 104, 62].forEach(function (a, n) {
      s += '<rect x="' + (-a) + '" y="' + (-a) + '" width="' + (2 * a) + '" height="' + (2 * a) + '" fill="none" stroke="' + or + '" stroke-width="' + (n ? 3 : 7) + '"/>';
      s += '<rect x="' + (-a) + '" y="' + (-a) + '" width="' + (2 * a) + '" height="' + (2 * a) + '" transform="rotate(45)" fill="none" stroke="' + or + '" stroke-width="' + (n ? 3 : 7) + '"/>';
    });
    s += '<circle r="196" fill="none" stroke="' + or + '" stroke-width="2.5"/><circle r="182" fill="none" stroke="' + or + '" stroke-width="1" opacity=".7"/>';
    for (var p = 0; p < 48; p++) {
      var g = p / 48 * Math.PI * 2;
      s += '<circle cx="' + (Math.cos(g) * 189).toFixed(1) + '" cy="' + (Math.sin(g) * 189).toFixed(1) + '" r="3.2" fill="#F6E7BE"/>';
    }
    for (var q = 0; q < 8; q++) {
      s += '<path d="M0 -150L10 -122L0 -100L-10 -122Z" fill="' + or + '" transform="rotate(' + (q * 45 + 22.5) + ')"/>';
    }
    s += '<circle r="30" fill="' + or + '"/><circle r="14" fill="' + teinte(coul, -0.2) + '"/><circle cx="-4" cy="-5" r="4" fill="#fff" opacity=".6"/></g>';
    s += '<rect x="34" y="34" width="532" height="732" fill="none" stroke="' + or + '" stroke-width="3"/><rect x="48" y="48" width="504" height="704" fill="none" stroke="' + or + '" stroke-width="1"/>';
    for (var k = 0; k < 20; k++) {
      var y = 70 + k * 35;
      s += '<path d="M41 ' + y + 'l5 7l-5 7l-5 -7z M559 ' + y + 'l5 7l-5 7l-5 -7z" fill="#F6E7BE"/>';
    }
    return s;
  }

  function accessoire(id, cat, coul, r) {
    var gemme = lum(coul) > 0.7 || coul.toUpperCase() === '#C3A35A' ? '#1F5E4B' : coul;
    var s = '<ellipse cx="300" cy="610" rx="220" ry="26" fill="#2A1F18" opacity=".28" filter="url(#' + id + 'ombre)"/>';
    function pierre(x, y, rx, ry) {
      return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (rx + 4) + '" ry="' + (ry + 4) + '" fill="url(#' + id + 'or)"/>' +
        '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + gemme + '"/>' +
        '<ellipse cx="' + (x - rx * 0.35) + '" cy="' + (y - ry * 0.4) + '" rx="' + (rx * 0.35) + '" ry="' + (ry * 0.22) + '" fill="#fff" opacity=".65"/>';
    }
    if (cat === 'mdamma') {
      s += '<path d="M40 330Q300 290 560 330L560 450Q300 410 40 450Z" fill="url(#' + id + 'orv)"/>';
      s += '<path d="M40 330Q300 290 560 330L560 450Q300 410 40 450Z" fill="none" stroke="#5E4520" stroke-width="1.5"/>';
      s += '<path d="M40 348Q300 308 560 348M40 432Q300 392 560 432" fill="none" stroke="#5E4520" stroke-width="1" opacity=".6"/>';
      for (var i = 0; i < 11; i++) {
        var x = 70 + i * 46; if (Math.abs(x - 300) < 60) continue;
        var y = 390 - Math.sin((x - 40) / 520 * Math.PI) * 20;
        s += '<rect x="' + (x - 13) + '" y="' + (y - 13) + '" width="26" height="26" transform="rotate(45 ' + x + ' ' + y + ')" fill="none" stroke="#5E4520" stroke-width="1.4" opacity=".75"/>' + pierre(x, y, 5, 5);
      }
      s += '<rect x="230" y="300" width="140" height="160" rx="14" fill="url(#' + id + 'or)" stroke="#5E4520" stroke-width="1.5"/>';
      s += '<rect x="244" y="314" width="112" height="132" rx="8" fill="none" stroke="#5E4520" stroke-width="1" opacity=".7"/>';
      s += pierre(300, 380, 26, 32);
    } else if (cat === 'couronne') {
      s += '<path d="M90 560Q300 610 510 560L500 500Q300 545 100 500Z" fill="url(#' + id + 'orv)" stroke="#5E4520" stroke-width="1.2"/>';
      for (var j = 0; j < 9; j++) {
        var cx = 110 + j * 47.5, h = 140 + (4 - Math.abs(4 - j)) * 34, base = 512 + Math.sin(j / 8 * Math.PI) * 30;
        s += '<path d="M' + (cx - 26) + ' ' + base + 'Q' + cx + ' ' + (base - h * 0.55) + ' ' + cx + ' ' + (base - h) + 'Q' + cx + ' ' + (base - h * 0.55) + ' ' + (cx + 26) + ' ' + base + 'Z" fill="url(#' + id + 'or)" stroke="#5E4520" stroke-width="1"/>';
        s += pierre(cx, base - h + 6, 7, 9) + pierre(cx, base - 34, 6, 6);
      }
      for (var q = 0; q < 18; q++) s += '<circle cx="' + (104 + q * 23) + '" cy="' + (548 + Math.sin(q / 17 * Math.PI) * 26) + '" r="3.5" fill="#FFF3CF" opacity=".9"/>';
    } else {
      s += '<path d="M120 200Q300 600 480 200" fill="none" stroke="url(#' + id + 'or)" stroke-width="5"/>';
      s += '<path d="M150 200Q300 540 450 200" fill="none" stroke="url(#' + id + 'or)" stroke-width="3"/>';
      for (var k = 0; k < 11; k++) {
        var tt = 0.08 + k * 0.084, bx = (1 - tt) * (1 - tt) * 120 + 2 * (1 - tt) * tt * 300 + tt * tt * 480, by = (1 - tt) * (1 - tt) * 200 + 2 * (1 - tt) * tt * 600 + tt * tt * 200;
        s += '<path d="M' + bx.toFixed(1) + ' ' + by.toFixed(1) + 'l-14 30l14 26l14 -26z" fill="url(#' + id + 'or)" stroke="#5E4520" stroke-width="1"/>' + pierre(bx.toFixed(1), (by + 30).toFixed(1), 6, 8);
      }
      s += pierre(300, 440, 22, 28);
    }
    return s;
  }

  function svg(spec, couleurs) {
    var p = String(spec).split(':');
    var cat = p[1] || 'caftan', vue = p[3] || 'face', graine = parseInt(p[4] || '0', 10) || 0;
    var coul = (couleurs && couleurs[p[2]]) || '#1F5E4B';
    var r = alea(graine + 7);
    var id = 'v' + graine + cat.slice(0, 2);
    var corps = '';
    if (cat === 'mdamma' || cat === 'bijoux' || cat === 'couronne' || cat === 'accessoire') corps = accessoire(id, cat === 'accessoire' ? 'mdamma' : cat, coul, r);
    else if (vue === 'broderie') corps = broderie(id, coul, r);
    else if (vue === 'doublure') corps = '<rect width="600" height="800" fill="url(#' + id + 'plis)"/><rect width="600" height="800" fill="url(#' + id + 'volume)"/>';
    else {
      corps = silhouette(id, cat, coul, r, vue);
      if (cat === 'enfant') corps = '<g transform="translate(84 190) scale(.72)">' + corps + '</g>';
      if (vue === 'portee') corps = '<g transform="translate(-165 -70) scale(1.55)">' + corps + '</g>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">' + defs(id, coul, r) +
      '<rect width="600" height="800" fill="url(#' + id + 'fond)"/>' + corps +
      '<rect width="600" height="800" filter="url(#' + id + 'grain)" opacity=".9"/></svg>';
  }

  root.LallaVisuels = { svg: svg, teinte: teinte };
})(typeof window !== 'undefined' ? window : globalThis);
