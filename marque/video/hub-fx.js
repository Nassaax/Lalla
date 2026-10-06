// LALLAT, reels « Hub fêtes & mariages » : outils communs (motifs, particules, grain, transitions, écran final).
// Chaque vidéo construit une timeline GSAP en pause ; scripts/rendre-video.mjs la positionne image par image.
window.FX = (() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (nom, attrs, parent) => { const e = document.createElementNS(NS, nom); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const etoile = (R, rot = 0, cx = 0, cy = 0) => { const p = []; for (let i = 0; i < 16; i++) { const a = (i * 22.5 + rot - 90) * Math.PI / 180, r = i % 2 ? R * 0.7654 : R; p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); } return p.join(' '); };
  const octogone = (R, cx, cy) => { const p = []; for (let i = 0; i < 8; i++) { const a = (i * 45 + 22.5) * Math.PI / 180; p.push((cx + R * Math.cos(a)).toFixed(1) + ',' + (cy + R * Math.sin(a)).toFixed(1)); } return p.join(' '); };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const doux = (v) => v * v * (3 - 2 * v);
  const graine = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const OR = ['#F7E3A3', '#E9C77A', '#FFF6D8', '#D9B25F', '#FFFFFF'];
  const ARCHE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 528' preserveAspectRatio='none'%3E%3Cpath d='M0 528V236C0 118 74 40 200 0C326 40 400 118 400 236V528Z'/%3E%3C/svg%3E\")";

  function installer() {
    document.documentElement.style.setProperty('--arche', ARCHE);
    const defs = document.createElement('div');
    defs.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>
      <pattern id="zellige" width="150" height="150" patternUnits="userSpaceOnUse"><g fill="none" stroke="#E9C77A" stroke-width="1.6">
        <polygon points="${etoile(54, 0, 75, 75)}"/><polygon points="${octogone(26, 75, 75)}"/>
        <path d="M75 0V22M75 128V150M0 75H22M128 75H150M0 0L37 37M150 0L113 37M0 150L37 113M150 150L113 113"/></g></pattern>
      <linearGradient id="dore" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3CF"/><stop offset=".5" stop-color="#E2BC6E"/><stop offset="1" stop-color="#9E7432"/></linearGradient>
    </defs></svg>`;
    document.body.prepend(defs.firstChild);
  }

  // ---------------------------------------------------------------- particules (déterministes)
  const particules = [];
  const rafale = (o) => {
    const r = graine(o.graine);
    for (let i = 0; i < o.n; i++) {
      const a = o.angle ? o.angle[0] + r() * (o.angle[1] - o.angle[0]) : r() * Math.PI * 2;
      const v = o.v[0] + r() * (o.v[1] - o.v[0]);
      particules.push({ x0: o.x + (r() - .5) * (o.dx || 0), y0: o.y + (r() - .5) * (o.dy || 0), vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        g: o.g ?? 300, frein: o.frein ?? 2.2, t0: o.t0 + r() * (o.etale || 0), vie: o.vie[0] + r() * (o.vie[1] - o.vie[0]),
        taille: o.taille[0] + r() * (o.taille[1] - o.taille[0]), c: o.couleurs[Math.floor(r() * o.couleurs.length)],
        type: o.types[Math.floor(r() * o.types.length)], rot: r() * 6.28, vr: (r() - .5) * 14, ph: r() * 6.28, oscille: o.oscille ? 20 + r() * 40 : 0, lumiere: o.lumiere !== false });
    }
  };
  const pluie = (o) => {
    const r = graine(o.graine);
    for (let i = 0; i < o.n; i++) {
      const vy = o.v[0] + r() * (o.v[1] - o.v[0]);
      particules.push({ x0: r() * 1080, y0: -40 - r() * 300, vx: (r() - .5) * 60, vy, g: 0, frein: 0, t0: o.t0 + r() * o.etale, vie: 2300 / vy,
        taille: o.taille[0] + r() * (o.taille[1] - o.taille[0]), c: o.couleurs[Math.floor(r() * o.couleurs.length)], type: o.types[Math.floor(r() * o.types.length)],
        rot: r() * 6.28, vr: (r() - .5) * 10, ph: r() * 6.28, oscille: 20 + r() * 50, lumiere: true });
    }
  };
  // Poussière dorée qui flotte en continu (profondeur)
  const poussiere = (o) => {
    const r = graine(o.graine);
    for (let i = 0; i < o.n; i++) particules.push({ flotte: true, x0: r() * 1080, y0: r() * 1920, vx: (r() - .5) * 30, vy: -20 - r() * 40, t0: o.t0, vie: o.t1 - o.t0,
      taille: 1.5 + r() * 3, c: OR[Math.floor(r() * OR.length)], type: 'point', ph: r() * 6.28, lumiere: true, alpha: o.alpha ?? .5 });
  };
  let ctx;
  const dessinerParticules = (t) => {
    ctx.clearRect(0, 0, 1080, 1920);
    for (const p of particules) {
      const tau = t - p.t0;
      if (tau < 0 || tau > p.vie) continue;
      let x, y, alpha;
      if (p.flotte) {
        x = p.x0 + p.vx * tau + Math.sin(tau * .8 + p.ph) * 18; y = ((p.y0 + p.vy * tau) % 1920 + 1920) % 1920;
        alpha = p.alpha * Math.min(1, tau / .5, (p.vie - tau) / .5) * (.6 + .4 * Math.sin(tau * 3 + p.ph));
      } else {
        const f = p.frein ? (1 - Math.exp(-p.frein * tau)) / p.frein : tau;
        x = p.x0 + p.vx * f + Math.sin(tau * 3 + p.ph) * p.oscille;
        y = p.y0 + p.vy * f + .5 * p.g * tau * tau;
        const vieRel = tau / p.vie;
        alpha = Math.min(1, tau / .06) * (vieRel > .6 ? 1 - (vieRel - .6) / .4 : 1);
      }
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.globalCompositeOperation = p.lumiere && (p.type === 'point' || p.type === 'etoile') ? 'lighter' : 'source-over';
      if (p.type === 'point') {
        const s = p.taille, gr = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
        gr.addColorStop(0, p.c); gr.addColorStop(.35, p.c + 'AA'); gr.addColorStop(1, p.c + '00');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * 3, 0, 6.283); ctx.fill();
      } else if (p.type === 'etoile') {
        const s = p.taille * 3.2 * (.65 + .35 * Math.sin(tau * 14 + p.ph));
        ctx.fillStyle = p.c; ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot * .2); ctx.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? s * .16 : s, ang = k * Math.PI / 4; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (p.type === 'piece') {
        const s = p.taille, tour = Math.cos(tau * 8 + p.ph);
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot * .3); ctx.scale(Math.max(.1, Math.abs(tour)), 1);
        const gr = ctx.createLinearGradient(-s, -s, s, s);
        gr.addColorStop(0, '#FFF3CF'); gr.addColorStop(.45, tour > 0 ? '#E2BC6E' : '#C9A050'); gr.addColorStop(1, '#8A6528');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(122,82,32,.9)'; ctx.lineWidth = s * .12; ctx.beginPath(); ctx.arc(0, 0, s * .76, 0, 6.283); ctx.stroke();
        ctx.restore();
      } else {
        const w = p.taille * 1.7, h = p.taille * .8;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + p.vr * tau); ctx.scale(Math.cos(tau * 9 + p.ph), 1);
        ctx.fillStyle = p.c; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };

  // ---------------------------------------------------------------- grain de film (quatre trames qui alternent)
  const trames = [];
  const preparerGrain = () => {
    const r = graine(99);
    for (let k = 0; k < 4; k++) {
      const c = document.createElement('canvas'); c.width = 540; c.height = 960;
      const g = c.getContext('2d'), img = g.createImageData(540, 960);
      for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0); trames.push(c.toDataURL('image/png'));
    }
  };
  const grain = (t) => { const g = $('#grain'); if (g) g.style.backgroundImage = `url(${trames[Math.floor(t * 24) % 4]})`; };

  // ---------------------------------------------------------------- aides de timeline
  const outils = (tl) => ({
    montrer: (id, t) => tl.set(id, { visibility: 'visible' }, t),
    cacher: (id, t) => tl.set(id, { visibility: 'hidden' }, t),
    entrer: (sel, t, d = .55, ease = 'power4.out') => { gsap.set(sel, { yPercent: 115 }); tl.to(sel, { yPercent: 0, duration: d, ease }, t); },
    sortir: (sel, t, d = .3) => tl.to(sel, { yPercent: -115, duration: d, ease: 'power3.in' }, t),
    brillance: (sel, t, d = 1) => tl.fromTo(sel, { backgroundPosition: '100% 50%' }, { backgroundPosition: '0% 50%', duration: d, ease: 'power1.inOut', immediateRender: false }, t),
    tracer: (sel, t, d) => $$(sel).forEach((p) => { const l = p.getTotalLength(); gsap.set(p, { strokeDasharray: l, strokeDashoffset: l }); tl.to(p, { strokeDashoffset: 0, duration: d, ease: 'power2.inOut' }, t); }),
    eclair: (t, force = .8, d = .5) => { tl.to('#flash', { opacity: force, duration: d * .3, ease: 'power2.out' }, t); tl.to('#flash', { opacity: 0, duration: d * .7, ease: 'power2.in' }, t + d * .3); },
    secousse: (t, force = 14, d = .35) => { tl.to('#camera', { keyframes: [{ x: force, y: -force * .6 }, { x: -force * .8, y: force * .5 }, { x: force * .5, y: force * .3 }, { x: -force * .25, y: -force * .2 }, { x: 0, y: 0 }], duration: d, ease: 'none' }, t); },
    // Mots qui apparaissent lettre par lettre avec un léger flou
    lettres: (sel, t, d = .5, pas = .03) => $$(sel).forEach((bloc) => {
      const txt = bloc.textContent; bloc.textContent = '';
      const spans = [...txt].map((c) => { const s = document.createElement('span'); s.textContent = c === ' ' ? ' ' : c; s.style.display = 'inline-block'; bloc.appendChild(s); return s; });
      spans.forEach((s, i) => tl.fromTo(s, { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: d, ease: 'power3.out', immediateRender: true }, t + i * pas));
    })
  });

  // ---------------------------------------------------------------- écran final commun
  const finale = (tl, t0, o) => {
    const f = $('#fin');
    f.innerHTML = `<svg class="motif" id="motif-fin"><rect width="100%" height="100%" fill="url(#zellige)" opacity=".1"/></svg>
      <svg class="rosace" viewBox="0 0 1080 1920"><g id="rosace" transform="translate(540 598)" fill="none" stroke="#E9C77A"></g></svg>
      <div class="anneau" id="anneau-fin"></div>
      <svg class="arche" viewBox="0 0 400 528"><path id="arche-f" d="M32 524 V240 C32 128 96 53 200 10 C304 53 368 128 368 240 V524" fill="none" stroke="#E9C77A" stroke-width="6"/><path id="arche-fb" d="M54 524 V246 C54 142 110 76 200 36 C290 76 346 142 346 246 V524" fill="none" stroke="#E9C77A" stroke-width="2" opacity=".7"/></svg>
      <div class="centre L serif">L</div>
      <div class="centre nom serif">${[...'LALLAT'].map((c) => `<span class="or">${c}</span>`).join('')}</div>
      <div class="centre slogan ital">${o.slogan}</div>
      <div class="centre cta"><span>${o.cta}</span></div>
      <div class="centre bas">${o.bas}</div>`;
    const ro = $('#rosace');
    [[220, 0, 2.4, .9], [220, 22.5, 1.4, .7], [380, 11.25, 1.8, .55], [540, 0, 1.2, .4], [700, 22.5, 1, .28]].forEach(([R, r, w, op]) => el('polygon', { points: etoile(R, r), 'stroke-width': w, opacity: op }, ro));
    for (let i = 0; i < 32; i++) { const a = i * 11.25 * Math.PI / 180; el('line', { x1: (240 * Math.cos(a)).toFixed(1), y1: (240 * Math.sin(a)).toFixed(1), x2: (980 * Math.cos(a)).toFixed(1), y2: (980 * Math.sin(a)).toFixed(1), 'stroke-width': .8, opacity: .22 }, ro); }
    const u = outils(tl), fin = o.duree;
    u.montrer('#fin', t0 - .05);
    tl.to('#fin', { clipPath: 'circle(150% at 50% 47%)', duration: .55, ease: 'power3.inOut' }, t0);
    tl.fromTo('#anneau-fin', { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: .55, ease: 'power3.inOut', immediateRender: false }, t0);
    tl.fromTo('#motif-fin', { rotation: 0, scale: 1.1 }, { rotation: 6, scale: 1, duration: fin - t0, ease: 'none', immediateRender: false }, t0);
    tl.fromTo('#fin .rosace', { opacity: 0 }, { opacity: 1, duration: .6, immediateRender: false }, t0 + .15);
    tl.fromTo('#rosace', { scale: .25, rotation: -30, svgOrigin: '540 598' }, { scale: 1, rotation: 0, duration: 1.3, ease: 'power3.out', svgOrigin: '540 598', immediateRender: false }, t0 + .15);
    tl.to('#rosace', { rotation: 14, duration: Math.max(.5, fin - t0 - 1.45), ease: 'none', svgOrigin: '540 598' }, t0 + 1.45);
    u.tracer('#arche-f, #arche-fb', t0 + .25, .8);
    tl.fromTo('#fin .L', { opacity: 0, y: 30, scale: .9 }, { opacity: 1, y: 0, scale: 1, duration: .6, immediateRender: false }, t0 + .6);
    u.eclair(t0 + .58, .9, .6);
    $$('#fin .nom span').forEach((s, i) => tl.fromTo(s, { opacity: 0, y: 70, rotationX: -70 }, { opacity: 1, y: 0, rotationX: 0, duration: .55, ease: 'back.out(1.6)', immediateRender: false }, t0 + .85 + i * .07));
    u.brillance('#fin .nom span', t0 + 1.5, 1.2);
    tl.fromTo('#fin .slogan', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .6, immediateRender: false }, t0 + 1.35);
    tl.fromTo('#fin .cta', { opacity: 0, scale: .7 }, { opacity: 1, scale: 1, duration: .55, ease: 'back.out(2)', immediateRender: false }, t0 + 1.8);
    tl.fromTo('#fin .bas', { opacity: 0 }, { opacity: 1, duration: .6, immediateRender: false }, t0 + 2.1);
    rafale({ graine: 500, t0: t0 + .6, x: 540, y: 598, n: 180, v: [300, 1600], vie: [1.1, 2.0], taille: [2, 7], couleurs: OR, types: ['point', 'etoile', 'confetti'], g: 220, etale: .12 });
    pluie({ graine: 501, t0: t0 + .9, n: 90, etale: fin - t0 - 1, v: [260, 520], taille: [4, 9], couleurs: OR, types: ['confetti', 'etoile', 'point'] });
  };

  // ---------------------------------------------------------------- lancement
  const demarrer = (tl, duree, chaqueImage) => {
    tl.to({}, { duration: .01 }, duree);
    ctx = $('#paillettes').getContext('2d');
    preparerGrain();
    window.duree = duree;
    window.positionner = (t) => { tl.time(t, false); if (chaqueImage) chaqueImage(t); dessinerParticules(t); grain(t); };
    window.pret = document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).then(() => window.positionner(0));
    // Aperçu dans un navigateur : ?t=secondes pour figer une image, sinon lecture en boucle
    const p = new URLSearchParams(location.search);
    if (p.has('lecture')) { const t0 = performance.now(); const boucle = () => { window.positionner(((performance.now() - t0) / 1000) % duree); requestAnimationFrame(boucle); }; window.pret.then(boucle); }
  };

  return { $, $$, el, etoile, octogone, clamp, doux, graine, OR, installer, rafale, pluie, poussiere, outils, finale, demarrer };
})();
