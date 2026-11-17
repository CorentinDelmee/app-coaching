/* anim.js — le moteur de mouvement de M4 « Ressort ».
   Rien ici ne connaît les écrans : constantes, ressort, horloge, son, et trois primitives
   réutilisables (à porter telles quelles en composables Vue) :
     M4.coque   — un élément qui naît d'un autre (carte -> page, valeur -> sélecteur, bouton -> menu)
     M4.geste   — glisser au doigt avec vélocité (fermer une page, tirer une feuille)
     M4.feuille — feuille du bas (façon Vaul) avec accroches
   Principe : UNE seule variable de progression p (1 = à l'origine, 0 = ouvert) pilote tout
   (clip-path, couleur, fondus, vol des éléments partagés). Ouvrir, fermer et glisser
   utilisent donc exactement le même rendu : tout est interruptible. */
(function () {
  'use strict';
  const M4 = window.M4 = window.M4 || {};
  gsap.registerPlugin(Flip, Draggable, InertiaPlugin, CustomEase);

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  M4.$ = $; M4.$$ = $$; M4.clamp = clamp;
  M4.app = $('#app');

  /* ---------- Mouvement réduit ---------- */
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  M4.reduit = () => RM.matches;

  /* ---------- Ressort : dépassement relatif (0.12 = 12 %), se pose à t = 1 ---------- */
  function ressort(depassement) {
    const r = -Math.log(depassement) / Math.PI, a = 5.2, b = a / r;
    return t => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-a * t) * (Math.cos(b * t) + r * Math.sin(b * t)));
  }
  M4.ressort = ressort;

  /* ---------- Durées et courbes centralisées ---------- */
  M4.T = { page: 0.66, pageFerme: 0.5, feuille: 0.6, feuilleFerme: 0.42, ilot: 0.62, glisse: 0.62, pop: 0.45, fond: 0.25, fondRapide: 0.14 };
  M4.E = {
    sortie: 'power4.out',                                   // décélération forte (entrées de contenu)
    vaul: CustomEase.create('vaul', '.32,.72,0,1'),        // la courbe de Vaul (feuilles, fermetures)
    ressort: ressort(0.12),                                 // rebond discret : pages, îlot
    ressortDoux: ressort(0.07),                             // plus calme : feuilles, glissements
    ressortVif: ressort(0.22)                               // pastilles, « pop »
  };
  M4.D = (d) => (M4.reduit() ? Math.min(d, 0.2) : d);

  /* ---------- Horloge de démo (×10) : tous les chronos lisent M4.horloge.now() ---------- */
  M4.horloge = (function () {
    let base = performance.now(), reel0 = base, v = 1;
    return {
      now() { return base + (performance.now() - reel0) * v; },
      vitesse(x) { base = this.now(); reel0 = performance.now(); v = x; },
      get v() { return v; }
    };
  })();
  M4.fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000 - 1e-6)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- Son (Web Audio) et vibration ---------- */
  M4.son = (function () {
    let ctx = null;
    function init() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (ctx && ctx.state === 'suspended') ctx.resume(); }
    addEventListener('pointerdown', init, { passive: true });
    return {
      bip(freq = 880, duree = 0.12, gain = 0.16) {
        init(); if (!ctx) return;
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + duree + 0.02);
      }
    };
  })();
  M4.vibre = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };

  /* ---------- Mesures ---------- */
  M4.rel = el => {                       // rectangle relatif à #app
    const a = M4.app.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height };
  };
  const sonde = document.createElement('i'); sonde.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'; document.body.appendChild(sonde);
  M4.couleur = nom => { sonde.style.color = 'var(' + nom + ')'; return getComputedStyle(sonde).color; };
  M4.taille = () => ({ w: M4.app.clientWidth, h: M4.app.clientHeight });
  M4.sat = () => { sonde.style.paddingTop = 'var(--sat)'; return parseFloat(getComputedStyle(sonde).paddingTop) || 0; };
  M4.sab = () => { sonde.style.paddingBottom = 'var(--sab)'; return parseFloat(getComputedStyle(sonde).paddingBottom) || 0; };

  /* ---------- Reculer : la page de dessous s'éloigne (scale .94 + voile) ---------- */
  M4.reculer = function (el, a) {
    if (!el) return;
    a = clamp(a, 0, 1);
    let v = el._voile;
    if (!v) { v = document.createElement('div'); v.className = 'voile'; el.appendChild(v); el._voile = v; }
    if (a === 0) { gsap.set(el, { clearProps: 'transform,borderRadius' }); v.style.opacity = 0; return; }
    gsap.set(el, { scale: 1 - 0.06 * a, y: 10 * a, borderRadius: 34 * a });
    v.style.opacity = 0.55 * a;
  };

  M4.hooks = {};                                   // crochets d'ouverture de page : M4.hooks.quest = () => ...
  /* ---------- Confettis (petite célébration) ---------- */
  M4.confettis = function (box, haut, n = 30) {
    const cols = ['--accent', '--sw-bleu', '--sw-violet', '--sw-menthe', '--sw-rose', '--sw-ambre'];
    box.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'), t = 6 + Math.random() * 8;
      p.style.cssText = 'position:absolute;left:50%;top:' + haut + 'px;width:' + t + 'px;height:' + t + 'px;border-radius:' + (i % 3 ? '50%' : '3px') + ';background:var(' + cols[i % cols.length] + ')';
      box.appendChild(p);
      const ang = Math.random() * Math.PI * 2, d = 90 + Math.random() * 190;
      gsap.timeline({ delay: 0.05 })
        .to(p, { x: Math.cos(ang) * d, y: Math.sin(ang) * d * 0.8 - 60, rotate: Math.random() * 720, duration: 0.9, ease: 'power3.out' })
        .to(p, { y: '+=260', opacity: 0, duration: 1.1, ease: 'power1.in' }, 0.7);
    }
  };

  /* ---------- Entrées en cascade ---------- */
  M4.entree = function (items, delai = 0, ecart = 0.06) {
    if (!items || !items.length) return null;
    return M4.reduit()
      ? gsap.fromTo(items, { opacity: 0 }, { opacity: 1, duration: 0.2, delay: delai, clearProps: 'opacity' })
      : gsap.fromTo(items, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, delay: delai, stagger: ecart, ease: M4.E.sortie, clearProps: 'transform,opacity' });
  };
  M4.compter = function (el, vers, o = {}) {
    const obj = { v: o.de || 0 };
    return gsap.to(obj, { v: vers, duration: M4.D(o.duree || 1.1), delay: o.delai || 0, ease: 'power3.out',
      onUpdate() { el.textContent = (o.fmt || Math.round)(obj.v); } });
  };
  M4.toast = function (msg) {
    const t = $('#toast');
    t.textContent = msg; gsap.killTweensOf(t);
    gsap.set(t, { xPercent: -50 });
    gsap.fromTo(t, { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: M4.D(0.5), ease: M4.E.ressortVif });
    gsap.to(t, { opacity: 0, y: -10, delay: 2.2, duration: 0.3 });
  };

  /* =====================================================================
     M4.geste — glisser vertical avec vélocité
     ===================================================================== */
  M4.geste = function (zone, o) {
    zone.style.touchAction = 'none';
    let id = null, x0 = 0, y0 = 0, base = 0, actif = false, echantillons = [], supprime = false;
    function bouge(e) {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!actif) {
        if (Math.hypot(dx, dy) < 7) return;
        if (Math.abs(dy) < Math.abs(dx) || (o.sens && dy * o.sens < 0)) { arreter(); return; }
        if (o.debut && o.debut(e) === false) { arreter(); return; }
        actif = true; base = dy; try { zone.setPointerCapture(id); } catch (err) { }
      }
      echantillons.push({ t: e.timeStamp, v: e.clientY });
      if (echantillons.length > 8) echantillons.shift();
      o.move(dy - base, e);
    }
    function arreter() { id = null; removeEventListener('pointermove', bouge); removeEventListener('pointerup', fin); removeEventListener('pointercancel', fin); }
    function fin(e) {
      if (e.pointerId !== id) return;
      const etaitActif = actif; actif = false;
      const d = e.clientY - y0 - base, fen = echantillons.filter(s => e.timeStamp - s.t < 110);
      arreter();
      if (!etaitActif) return;
      supprime = true; setTimeout(() => { supprime = false; }, 80);
      let vy = 0;
      if (fen.length > 1) { const a = fen[0], b = fen[fen.length - 1]; vy = b.t > a.t ? (b.v - a.v) / (b.t - a.t) * 1000 : 0; }
      o.fin(d, vy);
    }
    zone.addEventListener('pointerdown', e => {
      if (e.button > 0 || e.target.closest('[data-pasgeste]')) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; actif = false; echantillons = [{ t: e.timeStamp, v: e.clientY }];
      addEventListener('pointermove', bouge); addEventListener('pointerup', fin); addEventListener('pointercancel', fin);
    });
    zone.addEventListener('click', e => { if (supprime) { e.stopPropagation(); e.preventDefault(); } }, true);
  };

  /* =====================================================================
     M4.coque — un élément qui naît d'un autre
     options :
       origine()      rectangle {x,y,w,h} (relatif à #app) d'où l'élément naît
       source()       élément à cloner en « peau » (la carte d'origine, qui se fond dans la page)
       couleurDebut() couleur de fond de l'origine
       rayonDebut / rayonFin
       contenu        sélecteurs/éléments dont le contenu apparaît en fondu
       vols()         [{el, depuis(), mode}] éléments partagés qui voyagent (titre, chiffre)
       masquer        sélecteur CSS à cacher dans la peau (l'élément qui voyage)
       dessous()      élément qui recule pendant l'ouverture
       montrer/cacher afficher/masquer l'élément
       surP(p)        crochet appelé à chaque image (ex. voile)
     ===================================================================== */
  M4.coque = function (el, o) {
    const c = { el, p: 1, tw: null, etat: 'ferme' };
    const rf = o.rayonFin || 0;
    let rd = 30, O, F, vols = [], peau = null, interp = null;

    const contenu = () => (o.contenu || []).map(x => typeof x === 'string' ? el.querySelector(x) : x).filter(Boolean);
    const montrer = () => { if (o.montrer) o.montrer(); else el.hidden = false; };
    const cacher = () => { if (o.cacher) o.cacher(); else el.hidden = true; };

    function mesurer() {
      if (o.dessous) M4.reculer(o.dessous(), 0);        // l'origine se mesure sur la page de dessous au repos
      el.style.clipPath = 'none'; el.style.backgroundColor = '';
      contenu().forEach(n => gsap.set(n, { clearProps: 'opacity,transform' }));
      (o.vols ? o.vols() : []).forEach(v => gsap.set(v.el, { clearProps: 'transform' }));
      F = o.plein ? o.plein() : M4.rel(el);
      rd = typeof o.rayonDebut === 'function' ? o.rayonDebut() : (o.rayonDebut == null ? 30 : o.rayonDebut);
      O = (o.origine && o.origine()) || { x: F.x + F.w / 2 - 24, y: F.y + F.h / 2 - 24, w: 48, h: 48 };
      const cDeb = o.couleurDebut ? o.couleurDebut() : null;
      interp = cDeb ? gsap.utils.interpolate(cDeb, getComputedStyle(el).backgroundColor) : null;
      vols = (o.vols ? o.vols() : []).map(v => {
        const s = v.depuis(); if (!s) return null;
        const d = M4.rel(v.el); gsap.set(v.el, { transformOrigin: '0 0' });
        return { el: v.el, dx: s.x - d.x, dy: s.y - d.y, k: (v.mode === 'w' ? s.w / d.w : s.h / d.h) || 1 };
      }).filter(Boolean);
    }
    function retirerPeau() { if (peau) { peau.remove(); peau = null; } }
    function faireNPeau() {
      retirerPeau();
      const src = o.source && o.source(); if (!src) return;
      const cl = src.cloneNode(true);
      cl.removeAttribute('id'); cl.removeAttribute('data-ouvre'); cl.tabIndex = -1; cl.setAttribute('aria-hidden', 'true');
      cl.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      cl.classList.add('peau');
      if (vols.length) { const v = cl.querySelector('[data-vol]'); if (v) v.style.visibility = 'hidden'; }
      if (o.masquer) cl.querySelectorAll(o.masquer).forEach(n => { n.style.visibility = 'hidden'; });
      Object.assign(cl.style, { left: (O.x - F.x) + 'px', top: (O.y - F.y) + 'px', width: O.w + 'px', height: O.h + 'px', margin: '0', transform: 'none' });
      el.appendChild(cl); peau = cl;
    }
    function rendre(p) {
      const q = Math.max(p, -0.3), pc = clamp(p, 0, 1);
      el.style.clipPath = 'inset(' + ((O.y - F.y) * q) + 'px ' + (((F.x + F.w) - (O.x + O.w)) * q) + 'px ' + (((F.y + F.h) - (O.y + O.h)) * q) + 'px ' + ((O.x - F.x) * q) + 'px round ' + Math.max(0, rf + (rd - rf) * q) + 'px)';
      if (interp) el.style.backgroundColor = interp(1 - pc);
      const op = clamp(1 - p / 0.7, 0, 1);
      contenu().forEach(n => gsap.set(n, { opacity: op, y: 22 * pc }));
      if (peau) peau.style.opacity = clamp((p - 0.1) / 0.5, 0, 1);
      const qv = Math.max(p, -0.03);                       // les éléments partagés ne dépassent presque pas
      for (const v of vols) gsap.set(v.el, { x: v.dx * qv, y: v.dy * qv, scale: 1 + (v.k - 1) * qv });
      if (o.dessous) M4.reculer(o.dessous(), Math.max(1 - pc, o.niveauMin ? o.niveauMin() : 0));
      if (o.surP) o.surP(p);
    }
    function nettoyer() {
      el.style.clipPath = ''; el.style.backgroundColor = '';
      contenu().forEach(n => gsap.set(n, { clearProps: 'opacity,transform' }));
      vols.forEach(v => gsap.set(v.el, { clearProps: 'transform' }));
      retirerPeau();
    }
    function jusqua(cible, duree, ease, fin) {
      if (c.tw) c.tw.kill();
      c.tw = gsap.to(c, { p: cible, duration: duree, ease, onUpdate: () => rendre(c.p), onComplete: fin });
    }
    c.rendre = rendre;

    c.ouvrir = function (fini) {
      if (c.etat === 'ouvert' || c.etat === 'ouvre') return;
      const enCours = c.tw && c.tw.isActive(); if (c.tw) c.tw.kill();
      c.etat = 'ouvre'; montrer(); el.style.pointerEvents = 'none';   // pas de tap fantôme pendant l'ouverture
      if (M4.reduit()) {
        c.p = 0; gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: 'opacity', onComplete: () => { c.etat = 'ouvert'; el.style.pointerEvents = ''; fini && fini(); } });
        if (o.surP) o.surP(0); return;
      }
      mesurer(); if (!enCours) c.p = 1;
      faireNPeau(); rendre(c.p);
      jusqua(0, o.duree || M4.T.page, o.ease || M4.E.ressort, () => { c.etat = 'ouvert'; el.style.pointerEvents = ''; nettoyer(); if (o.surP) o.surP(0); fini && fini(); });
    };
    c.fermer = function (fini, opt) {
      if (c.etat === 'ferme' || c.etat === 'ferme-en') return;
      if (c.tw) c.tw.kill();
      c.etat = 'ferme-en'; if (o.sortie) o.sortie(); el.style.pointerEvents = 'none';
      const fin = () => { c.etat = 'ferme'; el.style.pointerEvents = ''; nettoyer(); cacher(); if (o.dessous) M4.reculer(o.dessous(), 0); if (o.surP) o.surP(1); fini && fini(); };
      if (M4.reduit()) { if (o.dessous) M4.reculer(o.dessous(), 0); gsap.to(el, { opacity: 0, duration: 0.16, onComplete: () => { gsap.set(el, { clearProps: 'opacity' }); fin(); } }); return; }
      mesurer(); if (c.p >= 1) c.p = 0; faireNPeau(); rendre(c.p);
      jusqua(1, (opt && opt.duree) || o.dureeFerme || M4.T.pageFerme, (opt && opt.ease) || M4.E.vaul, fin);
    };
    // Tirer vers le bas : la page rétrécit vers sa carte, au rythme du doigt
    c.geste = function (zone) {
      let fin0;
      M4.geste(zone, {
        sens: 1,
        debut() {
          if (c.etat !== 'ouvert' || M4.reduit()) return false;
          if (c.tw) c.tw.kill();
          c.etat = 'glisse'; c.p = 0; mesurer(); faireNPeau(); rendre(0);
        },
        move(dy) { c.p = clamp(dy / (F.h * 0.5), 0, 1); rendre(c.p); },
        fin(dy, vy) {
          const ferme = c.p > 0.28 || vy > 650;
          if (ferme) {
            c.etat = 'ferme-en'; if (o.sortie) o.sortie();
            const reste = 1 - c.p;
            jusqua(1, clamp(0.18 + reste * 0.42 - vy / 9000, 0.16, 0.5), M4.E.vaul, () => { c.etat = 'ferme'; nettoyer(); cacher(); if (o.dessous) M4.reculer(o.dessous(), 0); if (o.surP) o.surP(1); });
          } else {
            jusqua(0, 0.55, M4.E.ressort, () => { c.etat = 'ouvert'; nettoyer(); });
            c.etat = 'ouvre';
          }
        }
      });
    };
    return c;
  };

  /* =====================================================================
     M4.feuille — feuille du bas à accroches, tirée au doigt (façon Vaul)
     ov = conteneur .ov (scrim + feuille). o : snaps() [positions ouvertes, y croissants ; la position fermée est ajoutée],
     poignee, dessous(), fermee(), demandeFermeture()
     ===================================================================== */
  M4.feuille = function (ov, feu, o) {
    const sc = ov.querySelector('.ov-scrim');
    const f = { ov, feu, y: 0, tw: null };
    const H = () => feu.offsetHeight;
    f.prog = y => 1 - clamp(y / H(), 0, 1);
    f.maj = y => {
      f.y = y; gsap.set(feu, { y });
      const pr = f.prog(y); sc.style.opacity = pr;
      if (o.dessous) M4.reculer(o.dessous(), o.recul ? o.recul(y, H()) : pr);
    };
    f.aller = (y, ease, d, fin) => {
      if (f.tw) f.tw.kill();
      const obj = { y: f.y };
      f.tw = gsap.to(obj, { y, duration: M4.D(d || 0.55), ease: ease || M4.E.ressortDoux, onUpdate: () => f.maj(obj.y), onComplete: fin });
    };
    f.montrer = () => { ov.hidden = false; ov.classList.add('actif'); };
    f.cacher = () => { ov.classList.remove('actif'); ov.hidden = true; };
    f.ouvrir = (idx = 0, fini) => {
      f.montrer(); f.maj(H()); f.aller(o.snaps()[idx], M4.E.ressortDoux, M4.T.feuille, fini);
    };
    f.fermer = fini => {
      f.aller(H(), M4.E.vaul, M4.T.feuilleFerme, () => { f.cacher(); if (o.dessous) M4.reculer(o.dessous(), 0); o.fermee && o.fermee(); fini && fini(); });
    };
    f.estOuverte = () => ov.classList.contains('actif');
    sc.addEventListener('click', () => { o.demandeFermeture ? o.demandeFermeture() : f.fermer(); });
    if (o.poignee) {
      let y0 = 0;
      M4.geste(o.poignee, {
        debut() { if (o.peutGlisser && !o.peutGlisser()) return false; if (f.tw) f.tw.kill(); y0 = f.y; },
        move(dy) {
          const snaps = o.snaps(); let y = y0 + dy;
          if (y < snaps[0]) y = snaps[0] + (y - snaps[0]) * 0.18;     // résistance en haut
          f.maj(y);
        },
        fin(dy, vy) {
          const snaps = o.snaps().concat([H()]), proj = f.y + vy * 0.2;
          let cible = snaps[0], best = 1e9;
          snaps.forEach(s => { const d = Math.abs(proj - s); if (d < best) { best = d; cible = s; } });
          if (cible >= H() - 1) f.fermer(); else f.aller(cible, M4.E.ressortDoux, 0.5);
        }
      });
    }
    return f;
  };
})();
