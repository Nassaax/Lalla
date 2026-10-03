/*
 * LALLAT, visuels d'attente (aucune photo externe).
 * Tant qu'une tenue n'a pas de photo, on affiche un aplat de tissu sobre : la couleur de la pièce,
 * adoucie vers un gris chaud, un reflet satiné très léger et un grain fin. Aucun dessin de vêtement.
 * Spécification : placeholder:<categorie|sous_categorie>:<couleur>:<face|dos|broderie|portee|doublure>:<graine>
 * Exposé en window.LallaVisuels.svg(spec, couleurs) → chaîne SVG.
 */
(function (root) {
  'use strict';

  function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function vers(x) { return '#' + ((1 << 24) + (x[0] << 16) + (x[1] << 8) + x[2]).toString(16).slice(1); }
  /** Mélange deux couleurs : t = 0 donne a, t = 1 donne b. */
  function melange(a, b, t) {
    var x = hex(a), y = hex(b);
    return vers([0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); }));
  }

  var NEUTRE = '#E9E5DF';
  var ANGLES = { face: 18, dos: -14, broderie: 32, portee: 6, doublure: -24 };

  function svg(spec, couleurs) {
    var p = String(spec).split(':');
    var vue = p[3] || 'face', graine = parseInt(p[4] || '0', 10) || 0;
    var brute = (couleurs && couleurs[p[2]]) || '#C9C2B8';
    // Couleur sourde : on garde la teinte de la pièce, sans jamais la crier.
    var base = melange(brute, NEUTRE, 0.58);
    var ombre = melange(base, '#2B2723', 0.16), clair = melange(base, '#FFFFFF', 0.28);
    var angle = (ANGLES[vue] || 0) + (graine % 7) - 3;
    var id = 'v' + graine + (p[2] || 'x').slice(0, 3) + vue.slice(0, 2);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">' +
      '<defs>' +
      '<linearGradient id="' + id + 'r" gradientTransform="rotate(' + angle + ' .5 .5)">' +
      '<stop offset="0" stop-color="' + ombre + '"/><stop offset=".38" stop-color="' + base + '"/>' +
      '<stop offset=".55" stop-color="' + clair + '"/><stop offset=".72" stop-color="' + base + '"/>' +
      '<stop offset="1" stop-color="' + ombre + '"/></linearGradient>' +
      '<filter id="' + id + 'g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="' + (graine % 50) + '"/>' +
      '<feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '</defs>' +
      '<rect width="600" height="800" fill="url(#' + id + 'r)"/>' +
      '<rect width="600" height="800" filter="url(#' + id + 'g)"/></svg>';
  }

  root.LallaVisuels = { svg: svg };
})(typeof window !== 'undefined' ? window : globalThis);
