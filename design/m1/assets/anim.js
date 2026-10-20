/* M1 « Atelier » — toutes les transitions, une fonction par transition.
   Signature de la maison : la RÉVÉLATION PAR CLIP-PATH depuis l'élément touché.
   Durées et courbes centralisées ici (T, E). Fermetures = inverse, plus rapides.
   Anime transform / opacity / clip-path (+ un trait d'anneau SVG, voir DESIGN.md). */
(function () {
  'use strict';
  const M1 = window.M1, $ = M1.$, $$ = M1.$$;
  const A = M1.anim = {};

  /* ---------- Constantes de mouvement ---------- */
  const T = A.T = {
    ouvre: .85,      // carte -> page (clip-path)
    ferme: .52,      // page -> carte
    cascade: .07,    // décalage entre éléments de la cascade
    menuOuvre: .78,  // cercle du menu
    menuFerme: .46,
    rideau: .72,     // rideau d'accent entre rubriques
    cercleOuvre: .72, // chrono, repos, fin : cercle depuis le bouton
    cercleFerme: .46,
    slide: .75       // glissement entre exercices
  };
  const E = A.E = {
    ouvre: 'expo.inOut', sortie: 'expo.out', ferme: 'power4.inOut',
    ressort: 'back.out(1.8)', rideau: 'power4.inOut', slide: 'expo.out',
    rect: 'power3.out',      // série / valeur : réponse immédiate, pose douce (action fréquente)
    cercle: 'power4.inOut'   // chrono, repos, fin : part tout de suite du bouton
  };
  const PLEIN = 'inset(0px 0px 0px 0px round 0px)';
  A.PLEIN = PLEIN;

  const rm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  A.rm = rm;

  /* ---------- Géométrie (coordonnées dans le téléphone, mise à l'échelle comprise) ---------- */
  const tel = $('#tel');
  function geo() {
    const r = tel.getBoundingClientRect();
    return { r, W: tel.offsetWidth, H: tel.offsetHeight, k: r.width / tel.offsetWidth };
  }
  A.rectDe = function (el) {
    const g = geo(), b = el.getBoundingClientRect();
    return { t: (b.top - g.r.top) / g.k, l: (b.left - g.r.left) / g.k, r: (b.right - g.r.left) / g.k, b: (b.bottom - g.r.top) / g.k,
      w: b.width / g.k, h: b.height / g.k, W: g.W, H: g.H };
  };
  A.insetDe = function (el, rayon) {
    const q = A.rectDe(el);
    return 'inset(' + q.t + 'px ' + (q.W - q.r) + 'px ' + (q.H - q.b) + 'px ' + q.l + 'px round ' + (rayon == null ? 26 : rayon) + 'px)';
  };
  A.centreDe = function (el) { const q = A.rectDe(el); return { x: (q.l + q.r) / 2, y: (q.t + q.b) / 2 }; };
  function rayonMax(x, y) { const g = geo(); return Math.hypot(Math.max(x, g.W - x), Math.max(y, g.H - y)) + 4; }
  const cercle = (r, x, y) => 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)';

  /* ---------- Cascade d'entrée du contenu d'une couche ---------- */
  A.cascade = function (ec, opts) {
    opts = opts || {};
    if (ec._entree) ec._entree(ec);
    const els = $$('[data-c]', ec);
    if (!els.length) return null;
    if (rm()) return gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: .25, clearProps: 'opacity' });
    return gsap.fromTo(els, { y: 46, opacity: 0 },
      { y: 0, opacity: 1, duration: .9, stagger: T.cascade, ease: E.sortie, delay: opts.delay || 0, clearProps: 'transform,opacity' });
  };

  /* ---------- Pile des pages ouvertes ---------- */
  const pile = M1.pile = [];
  A.occupe = false;
  A.haut = () => pile[pile.length - 1] || null;

  function preparerVoile(ec, src) {
    let v = $(':scope > .voile', ec);
    if (!v) { v = document.createElement('div'); v.className = 'voile'; ec.appendChild(v); }
    v.innerHTML = ''; v.style.opacity = 1; v.style.display = ''; v.style.clipPath = '';
    if (!src) { v.style.background = 'var(--fond)'; return v; }
    const cs = getComputedStyle(src), q = A.rectDe(src);
    const col = cs.backgroundColor;
    v.style.background = (col && col !== 'rgba(0, 0, 0, 0)' && col !== 'transparent') ? col : 'var(--surface)';
    const c = src.cloneNode(true);
    c.removeAttribute('id'); $$('[id]', c).forEach(n => n.removeAttribute('id'));
    c.style.cssText = 'position:absolute;margin:0;transition:none;transform:none;opacity:1;left:' + q.l + 'px;top:' + q.t + 'px;width:' + q.w + 'px;height:' + q.h + 'px;border-radius:' + (cs.borderRadius || '26px');
    $$('[data-c]', c).forEach(n => { n.style.opacity = 1; n.style.transform = 'none'; });
    v.appendChild(c);
    return v;
  }
  function majMenuBtn() {
    const top = A.haut(), cache = top && top.hasAttribute('data-sans-menu');
    gsap.to('#btn-menu', { autoAlpha: cache ? 0 : 1, scale: cache ? .6 : 1, duration: .3, ease: 'power2.out', overwrite: 'auto' });
  }
  A.majMenuBtn = majMenuBtn;

  /* ---------- 1. Carte -> page : ouvrirPage(ec, src) ----------
     La page naît du rectangle de l'élément touché (inset arrondi -> plein écran),
     un voile de la couleur de la carte (avec son clone) fait le lien, puis le contenu monte en cascade. */
  A.ouvrirPage = function (ec, src, opts) {
    opts = opts || {};
    if (ec._tl) ec._tl.kill();
    ec.hidden = false; ec._src = src || null; ec._origine = opts.origine || null;
    if (pile.indexOf(ec) < 0) pile.push(ec);
    ec.style.zIndex = 10 + pile.length; ec.style.pointerEvents = 'none';
    const v = preparerVoile(ec, src);
    $$('[data-c]', ec).forEach(n => { n.style.opacity = 0; });
    majMenuBtn();
    const fin = () => { ec.style.pointerEvents = ''; gsap.set(ec, { clearProps: 'clipPath,opacity' }); v.style.display = 'none'; A.occupe = false; if (opts.onFini) opts.onFini(); };
    A.occupe = true;
    if (rm() || (!src && !opts.depuis)) {
      ec._tl = gsap.timeline({ onComplete: fin })
        .fromTo(ec, { opacity: 0 }, { opacity: 1, duration: .25 }, 0)
        .to(v, { opacity: 0, duration: .2 }, 0)
        .add(() => A.cascade(ec), .05);
      return ec._tl;
    }
    const dep = src ? A.insetDe(src, opts.rayon) : opts.depuis;
    ec._tl = gsap.timeline({ onComplete: fin })
      .fromTo(ec, { clipPath: dep }, { clipPath: PLEIN, duration: T.ouvre, ease: E.ouvre }, 0)
      .fromTo(v, { clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: 'inset(0px 0px ' + tel.offsetHeight + 'px 0px)', duration: .62, ease: 'expo.inOut', immediateRender: false }, T.ouvre * .46)
      .add(() => A.cascade(ec), T.ouvre * .4);
    return ec._tl;
  };

  /* ---------- 2. Page -> carte : fermerPage(ec) (plus rapide, asymétrique) ---------- */
  A.fermerPage = function (ec, opts) {
    opts = opts || {};
    if (A.occupe && !opts.force) return null;
    if (ec._tl) ec._tl.kill();
    const src = ec._src && ec._src.isConnected && ec._src.offsetParent !== null ? ec._src : null;
    const i = pile.indexOf(ec); if (i >= 0) pile.splice(i, 1);
    A.occupe = true; ec.style.pointerEvents = 'none';
    const fin = () => { ec.hidden = true; ec.style.pointerEvents = ''; gsap.set(ec, { clearProps: 'clipPath,opacity,zIndex' }); A.occupe = false; majMenuBtn(); if (opts.onFini) opts.onFini(); };
    if (rm()) { ec._tl = gsap.timeline({ onComplete: fin }).to(ec, { opacity: 0, duration: .2 }); return ec._tl; }
    const v = preparerVoile(ec, src); v.style.opacity = 0;
    let vers, depart = PLEIN;
    if (src) vers = A.insetDe(src);
    else if (ec._origine === 'menu') { const c = A.centreDe($('#btn-menu')); vers = cercle(26, c.x, c.y); depart = cercle(rayonMax(c.x, c.y), c.x, c.y); }
    else vers = 'inset(' + tel.offsetHeight + 'px 0px 0px 0px round 26px)';
    ec._tl = gsap.timeline({ onComplete: fin })
      .to(v, { opacity: src ? 1 : 0, duration: .12, ease: 'power1.out' }, 0)   // sans carte cible : on garde la page visible
      .fromTo(ec, { clipPath: depart }, { clipPath: vers, duration: T.ferme, ease: src ? E.ferme : 'power3.inOut', immediateRender: false }, .06);
    majMenuBtn();
    return ec._tl;
  };

  /* Fermer toutes les pages d'un coup (sans animation) — sous un rideau ou un écran plein. */
  A.viderPile = function (sauf) {
    pile.slice().forEach(ec => {
      if (ec === sauf) return;
      if (ec._tl) ec._tl.kill();
      ec.hidden = true; gsap.set(ec, { clearProps: 'clipPath,opacity,zIndex' });
      pile.splice(pile.indexOf(ec), 1);
    });
  };
  /* Affiche une page instantanément (derrière un rideau). */
  A.montrerInstant = function (ec, origine) {
    if (ec._tl) ec._tl.kill();
    ec.hidden = false; ec._src = null; ec._origine = origine || 'menu';
    if (pile.indexOf(ec) < 0) pile.push(ec);
    ec.style.zIndex = 10 + pile.length;
    const v = $(':scope > .voile', ec); if (v) { v.style.display = 'none'; }
    gsap.set(ec, { clearProps: 'clipPath,opacity' });
    $$('[data-c]', ec).forEach(n => { n.style.opacity = 0; });
    majMenuBtn();
  };

  /* ---------- 3. Menu : jaillit en cercle depuis le bouton ---------- */
  const menu = $('#menu'), btnMenu = $('#btn-menu');
  let menuOuvert = false, menuTl = null;
  A.menuOuvert = () => menuOuvert;

  A.ouvrirMenu = function () {
    if (menuOuvert || A.occupe) return;
    menuOuvert = true; if (menuTl) menuTl.kill();
    const c = A.centreDe(btnMenu), R = rayonMax(c.x, c.y);
    menu.hidden = false; menu.style.pointerEvents = '';
    btnMenu.classList.add('ouvert'); btnMenu.setAttribute('aria-expanded', 'true'); btnMenu.setAttribute('aria-label', 'Fermer le menu');
    const items = $$('.m-item .t, .m-item .n, .m-item .pt, .m-sur, .m-pied', menu);
    menuTl = gsap.timeline();
    if (rm()) {
      menuTl.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: .2 });
    } else {
      menuTl.fromTo(menu, { clipPath: cercle(28, c.x, c.y) }, { clipPath: cercle(R, c.x, c.y), duration: T.menuOuvre, ease: 'expo.inOut' }, 0)
        .fromTo(items, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .85, stagger: .045, ease: E.sortie }, .22)
        .to(btnMenu.children[0], { y: 0, rotate: 45, duration: .5, ease: E.sortie }, 0)
        .to(btnMenu.children[1], { y: 0, rotate: -45, duration: .5, ease: E.sortie }, 0);
    }
    if (rm()) menuTl.to(btnMenu.children[0], { y: 0, rotate: 45, duration: .2 }, 0).to(btnMenu.children[1], { y: 0, rotate: -45, duration: .2 }, 0);
  };
  function resetBurger(dur) {
    gsap.to(btnMenu.children[0], { y: -4.5, rotate: 0, duration: dur, ease: 'power3.out' });
    gsap.to(btnMenu.children[1], { y: 4.5, rotate: 0, duration: dur, ease: 'power3.out' });
    btnMenu.classList.remove('ouvert'); btnMenu.setAttribute('aria-expanded', 'false'); btnMenu.setAttribute('aria-label', 'Ouvrir le menu');
  }
  A.fermerMenu = function () {
    if (!menuOuvert) return; menuOuvert = false; if (menuTl) menuTl.kill();
    const c = A.centreDe(btnMenu), R = rayonMax(c.x, c.y);
    resetBurger(.35);
    const fin = () => { menu.hidden = true; gsap.set(menu, { clearProps: 'clipPath,opacity' }); };
    if (rm()) { menuTl = gsap.to(menu, { opacity: 0, duration: .18, onComplete: fin }); return; }
    menuTl = gsap.timeline({ onComplete: fin })
      .to($$('.m-item .t, .m-item .n', menu), { opacity: 0, duration: .16 }, 0)
      .fromTo(menu, { clipPath: cercle(R, c.x, c.y) }, { clipPath: cercle(28, c.x, c.y), duration: T.menuFerme, ease: E.ferme, immediateRender: false }, .04);
  };

  /* ---------- 4. Entre rubriques : le rideau d'accent balaie, puis cascade ----------
     Le menu (aplat d'accent) reste plein écran pendant que la page change dessous,
     puis il se relève comme un rideau (le bord bas monte) et le contenu arrive en cascade. */
  A.balayerVers = function (preparer, cible) {
    if (A.occupe) return;
    A.occupe = true; menuOuvert = false; if (menuTl) menuTl.kill();
    preparer();                           // change la page derrière le rideau
    resetBurger(.5);
    const fin = () => { menu.hidden = true; gsap.set(menu, { clearProps: 'clipPath,opacity' }); A.occupe = false; };
    if (rm()) { menuTl = gsap.to(menu, { opacity: 0, duration: .2, onComplete: fin }); if (cible) A.cascade(cible); return; }
    menuTl = gsap.timeline({ onComplete: fin })
      .to($$('.m-item .t, .m-item .n, .m-sur, .m-pied', menu), { yPercent: -60, opacity: 0, duration: .45, stagger: .02, ease: 'power2.out' }, .12)
      .fromTo(menu, { clipPath: 'inset(0px 0px 0px 0px round 0px 0px 44px 44px)' },
        { clipPath: 'inset(0px 0px ' + tel.offsetHeight + 'px 0px round 0px 0px 44px 44px)', duration: T.rideau, ease: E.rideau, immediateRender: false }, .22)
      .add(() => { if (cible) A.cascade(cible); }, .62);
  };

  /* ---------- 5. Cercle depuis un bouton (chrono, repos, fin, sélecteur…) ---------- */
  A.ouvrirCercle = function (couche, src, opts) {
    opts = opts || {};
    if (couche._tl) couche._tl.kill();
    couche.hidden = false;
    const c = src ? A.centreDe(src) : { x: 195, y: 700 };
    couche._centre = c;
    const R = rayonMax(c.x, c.y);
    const fin = () => { gsap.set(couche, { clearProps: 'clipPath,opacity' }); if (opts.onFini) opts.onFini(); };
    if (rm()) { couche._tl = gsap.fromTo(couche, { opacity: 0 }, { opacity: 1, duration: .2, onComplete: fin }); return couche._tl; }
    couche._tl = gsap.fromTo(couche, { clipPath: cercle(src ? 26 : 0, c.x, c.y) },
      { clipPath: cercle(R, c.x, c.y), duration: opts.duree || T.cercleOuvre, ease: E.cercle, onComplete: fin });
    return couche._tl;
  };
  A.fermerCercle = function (couche, vers, opts) {
    opts = opts || {};
    if (couche._tl) couche._tl.kill();
    const c = vers ? A.centreDe(vers) : (couche._centre || { x: 195, y: 700 });
    const R = rayonMax(c.x, c.y);
    const fin = () => { couche.hidden = true; gsap.set(couche, { clearProps: 'clipPath,opacity' }); if (opts.onFini) opts.onFini(); };
    if (rm()) { couche._tl = gsap.to(couche, { opacity: 0, duration: .18, onComplete: fin }); return couche._tl; }
    couche._tl = gsap.fromTo(couche, { clipPath: cercle(R, c.x, c.y) },
      { clipPath: cercle(26, c.x, c.y), duration: opts.duree || T.cercleFerme, ease: E.ferme, onComplete: fin, immediateRender: false });
    return couche._tl;
  };

  /* ---------- 6. Rectangle depuis un élément (série, valeur -> sélecteur) ---------- */
  A.ouvrirRect = function (couche, src, opts) {
    opts = opts || {};
    if (couche._tl) couche._tl.kill();
    couche.hidden = false; couche._src = src;
    const v = $(':scope > .voile', couche) || (function () { const n = document.createElement('div'); n.className = 'voile'; couche.appendChild(n); return n; })();
    v.innerHTML = ''; v.style.display = ''; v.style.opacity = 1; v.style.clipPath = '';
    const cs = getComputedStyle(src), q = A.rectDe(src), col = cs.backgroundColor;
    v.style.background = (col && col !== 'rgba(0, 0, 0, 0)') ? col : 'var(--surface)';
    const cl = src.cloneNode(true); cl.removeAttribute('id'); $$('[id]', cl).forEach(n => n.removeAttribute('id'));
    cl.style.cssText = 'position:absolute;margin:0;transition:none;transform:none;left:' + q.l + 'px;top:' + q.t + 'px;width:' + q.w + 'px;height:' + q.h + 'px;border-radius:' + (cs.borderRadius || '22px');
    v.appendChild(cl);
    const els = $$('[data-c]', couche); gsap.set(els, { opacity: 0 });
    const fin = () => { gsap.set(couche, { clearProps: 'clipPath,opacity' }); v.style.display = 'none'; if (opts.onFini) opts.onFini(); };
    if (rm()) { couche._tl = gsap.timeline({ onComplete: fin }).fromTo(couche, { opacity: 0 }, { opacity: 1, duration: .2 }, 0).to(v, { opacity: 0, duration: .15 }, 0).to(els, { opacity: 1, duration: .2 }, 0); return couche._tl; }
    couche._tl = gsap.timeline({ onComplete: fin })
      .fromTo(couche, { clipPath: A.insetDe(src, opts.rayon || 24) }, { clipPath: PLEIN, duration: opts.duree || .62, ease: E.rect }, 0)
      .fromTo(v, { clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: 'inset(0px 0px ' + tel.offsetHeight + 'px 0px)', duration: .5, ease: 'expo.inOut', immediateRender: false }, .3)
      .fromTo(els, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .06, ease: E.sortie, clearProps: 'transform,opacity' }, .3);
    return couche._tl;
  };
  A.fermerRect = function (couche, src, opts) {
    opts = opts || {};
    if (couche._tl) couche._tl.kill();
    src = src || couche._src;
    const fin = () => { couche.hidden = true; gsap.set(couche, { clearProps: 'clipPath,opacity' }); if (opts.onFini) opts.onFini(); };
    if (rm() || !src || !src.isConnected) { couche._tl = gsap.to(couche, { opacity: 0, duration: .18, onComplete: fin }); return couche._tl; }
    const v = $(':scope > .voile', couche);
    if (v) {   // le voile reprend la couleur et le contenu de l'élément cible (état actuel)
      v.innerHTML = ''; v.style.display = ''; v.style.opacity = 0; v.style.clipPath = '';
      const cs = getComputedStyle(src), q = A.rectDe(src), col = cs.backgroundColor;
      v.style.background = (col && col !== 'rgba(0, 0, 0, 0)') ? col : 'var(--surface)';
      const cl = src.cloneNode(true); cl.removeAttribute('id'); $$('[id]', cl).forEach(n => n.removeAttribute('id'));
      cl.style.cssText = 'position:absolute;margin:0;transition:none;transform:none;left:' + q.l + 'px;top:' + q.t + 'px;width:' + q.w + 'px;height:' + q.h + 'px;border-radius:' + (cs.borderRadius || '22px');
      v.appendChild(cl);
    }
    couche._tl = gsap.timeline({ onComplete: fin });
    if (v) couche._tl.to(v, { opacity: 1, duration: .18 }, 0);
    couche._tl.to(couche, { clipPath: A.insetDe(src, opts.rayon || 24), duration: opts.duree || .42, ease: 'power3.inOut' }, .05);
    return couche._tl;
  };

  /* ---------- Compteurs : défilent puis décélèrent (jamais d'arrêt net) ---------- */
  A.compter = function (el, de, a, opts) {
    opts = opts || {};
    const fmt = opts.fmt || (v => String(Math.round(v)));
    el.textContent = fmt(de);
    if (rm()) { el.textContent = fmt(a); return null; }
    const o = { v: de };
    return gsap.to(o, { v: a, duration: opts.duree || 1.4, delay: opts.delay || 0, ease: opts.ease || 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); }, onComplete: () => { el.textContent = fmt(a); } });
  };

  /* ---------- Anneau SVG (trait de l'anneau : seul "paint" du prototype, 1 élément) ---------- */
  A.anneau = function (circ, p) {
    const r = parseFloat(circ.getAttribute('r')), C = 2 * Math.PI * r;
    circ.style.strokeDasharray = C; circ.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(1, p)));
  };
  A.animerAnneau = function (circ, de, a, opts) {
    opts = opts || {};
    A.anneau(circ, de);
    if (rm()) { A.anneau(circ, a); return null; }
    const o = { p: de };
    return gsap.to(o, { p: a, duration: opts.duree || 1.2, delay: opts.delay || 0, ease: opts.ease || 'expo.out', onUpdate: () => A.anneau(circ, o.p), onComplete: () => A.anneau(circ, a) });
  };

  /* ---------- Titres : mots qui montent dans leur masque ---------- */
  A.decouperMots = function (el) {
    if (el.dataset.decoupe) return $$('.mot > span', el);
    el.dataset.decoupe = '1';
    const walk = (node) => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(w => {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
            const m = document.createElement('span'); m.className = 'mot'; const s = document.createElement('span'); s.textContent = w; m.appendChild(s); frag.appendChild(m);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    return $$('.mot > span', el);
  };
  A.motsMontent = function (el, delay) {
    const mots = A.decouperMots(el);
    if (rm()) return gsap.fromTo(mots, { opacity: 0 }, { opacity: 1, duration: .25, delay: delay || 0 });
    return gsap.fromTo(mots, { yPercent: 115 }, { yPercent: 0, duration: 1.05, stagger: .07, ease: 'expo.out', delay: delay || 0 });
  };

  /* ---------- Ressort discret sur les boutons ---------- */
  document.addEventListener('pointerup', function (e) {
    const b = e.target.closest && e.target.closest('.gros, .petit-btn, .rond, .emoji, .choix button, .btn-tour');
    if (!b || rm() || b.dataset.sansRessort) return;
    gsap.fromTo(b, { scale: .955 }, { scale: 1, duration: .6, ease: 'back.out(2.6)', overwrite: 'auto', clearProps: 'transform' });
  }, true);
})();
