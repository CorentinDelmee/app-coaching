/* M5 « Profondeur » — noyau : outils, horloge, son, thème, menu « push back », carte -> page.
   Une fonction par transition ; durées et courbes centralisées (T, E). Portage Vue : chaque fonction
   devient une méthode d'un composable (useTransitions), les constantes un fichier motion.js. */
(function () {
  'use strict';
  var REX = window.REX = window.REX || {};
  gsap.registerPlugin(Flip, Draggable, InertiaPlugin, CustomEase, SplitText);
  CustomEase.create('vaul', '.32,.72,0,1');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUIT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- constantes de mouvement (centralisées) ---------- */
  var T = { rapide: .25, base: .5, depart: .6, menu: .85, page: .85, rideau: .7 };
  var E = { sortie: 'expo.out', page: 'expo.inOut', doux: 'power3.out', ressort: 'back.out(1.7)', vaul: 'vaul' };
  var MENU = { x: 0.7, scale: 0.82, rot: -14 };           // pose du plan quand le menu est ouvert
  var RAYON = 28;
  var d = function (t) { return REDUIT ? Math.min(t, .25) : t; };

  Object.assign(REX, { $: $, $$: $$, REDUIT: REDUIT, T: T, E: E, RAYON: RAYON, d: d, PAGES: {} });

  /* ---------- horloge virtuelle (performance.now, accélérable ×10) ---------- */
  var horloge = REX.horloge = {
    vitesse: 1, v: 0, r: performance.now(),
    now: function () { var r = performance.now(); this.v += (r - this.r) * this.vitesse; this.r = r; return this.v; }
  };
  /* Chrono basé sur l'horloge : jamais de setInterval qui compte. onTick(resteMs, ecouleMs, totalMs) */
  REX.chrono = function (dureeMs, o) {
    var debut = horloge.now(), fin = debut + dureeMs, total = dureeMs, actif = true, nbFin = false;
    function tick() {
      if (!actif) return;
      var n = horloge.now(), reste = Math.max(0, fin - n);
      o.onTick && o.onTick(reste, n - debut, total);
      if (reste <= 0 && !nbFin) { nbFin = true; stop(); o.onFin && o.onFin(); }
    }
    function stop() { actif = false; gsap.ticker.remove(tick); }
    gsap.ticker.add(tick); tick();
    return {
      stop: stop,
      ajouter: function (ms) { fin += ms; total += ms; },
      reste: function () { return Math.max(0, fin - horloge.now()); },
      actif: function () { return actif; }
    };
  };

  /* ---------- son & vibration ---------- */
  var ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  REX.bip = function (f, dur, vol) {
    var c = audio(); if (!c) return;
    f = f || 880; dur = dur || .12; vol = vol == null ? .16 : vol;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .03);
  };
  REX.vibrer = function (ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } };
  document.addEventListener('pointerdown', function () { audio(); }, { once: true, passive: true });

  /* ---------- thème : ambiances + accents (variables CSS), mémorisé ---------- */
  var ACCENTS = [
    { id: 'bleu', nom: 'Bleu électrique', c: '#4C6FFF', t: '#FFFFFF' },
    { id: 'vert', nom: 'Vert d’eau', c: '#3FD8BC', t: '#0B2A24' },
    { id: 'rose', nom: 'Rose vif', c: '#FF3D8B', t: '#FFFFFF' },
    { id: 'jaune', nom: 'Jaune pâle', c: '#F2E27A', t: '#26230A' },
    { id: 'violet', nom: 'Violet', c: '#9B6BFF', t: '#FFFFFF' },
    { id: 'cerise', nom: 'Rouge cerise', c: '#E5173F', t: '#FFFFFF' }
  ];
  var CLE = 'rex-m5';
  var reglage = { amb: 'sombre', acc: 'bleu' };
  try { Object.assign(reglage, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) {}
  function appliquerTheme() {
    var a = ACCENTS.filter(function (x) { return x.id === reglage.acc; })[0] || ACCENTS[0];
    var r = document.documentElement;
    r.dataset.ambiance = reglage.amb;
    r.style.setProperty('--accent', a.c); r.style.setProperty('--accent-texte', a.t);
    $$('#rg-amb button').forEach(function (b) { b.classList.toggle('on', b.dataset.amb === reglage.amb); });
    $$('#rg-acc button').forEach(function (b) { b.classList.toggle('on', b.dataset.acc === reglage.acc); });
    var fond = getComputedStyle(r).getPropertyValue('--fond').trim();
    var m = $('meta[name="theme-color"]'); if (m && fond) m.setAttribute('content', fond);
    try { localStorage.setItem(CLE, JSON.stringify(reglage)); } catch (e) {}
  }
  function initReglages() {
    var box = $('#rg-acc');
    ACCENTS.forEach(function (a) {
      var b = document.createElement('button'); b.dataset.acc = a.id; b.style.setProperty('--c', a.c); b.setAttribute('aria-label', a.nom); box.appendChild(b);
    });
    $('#btn-reglages').addEventListener('click', function () {
      var p = $('#reglages'), ouvert = p.hidden;
      p.hidden = !ouvert; this.setAttribute('aria-expanded', ouvert);
      if (ouvert && !REDUIT) gsap.fromTo(p, { opacity: 0, y: 12, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .3, ease: E.sortie });
    });
    $('#reglages').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.amb) reglage.amb = b.dataset.amb;
      if (b.dataset.acc) reglage.acc = b.dataset.acc;
      appliquerTheme();
    });
    $('#btn-vitesse').addEventListener('click', function () {
      horloge.now(); horloge.vitesse = horloge.vitesse === 1 ? 10 : 1;
      this.setAttribute('aria-pressed', horloge.vitesse === 10);
    });
    appliquerTheme();
  }

  /* ---------- révélation depuis un rectangle (patron M3 : clip-path inset) ---------- */
  function insetDepuis(src, box, rayon) {
    var t = Math.max(0, src.top - box.top), l = Math.max(0, src.left - box.left);
    var r = Math.max(0, box.right - src.right), b = Math.max(0, box.bottom - src.bottom);
    return 'inset(' + t + 'px ' + r + 'px ' + b + 'px ' + l + 'px round ' + rayon + 'px)';
  }
  /* Ouvre `el` en le faisant grandir depuis `srcEl`. Retourne la tween. */
  REX.reveler = function (el, srcEl, o) {
    o = o || {};
    var duree = o.duree || T.page, rayonFin = o.rayonFin == null ? 0 : o.rayonFin, ease = o.ease || E.page;
    gsap.killTweensOf(el); el.hidden = false;
    if (REDUIT || !srcEl) {
      return gsap.fromTo(el, { opacity: 0, clipPath: 'none' }, { opacity: 1, duration: .25, onComplete: function () { gsap.set(el, { clearProps: 'clipPath,opacity' }); o.onEnd && o.onEnd(); } });
    }
    var box = el.getBoundingClientRect(), s = srcEl.getBoundingClientRect();
    gsap.set(el, { opacity: 1 });
    return gsap.fromTo(el, { clipPath: insetDepuis(s, box, RAYON) },
      { clipPath: 'inset(0px 0px 0px 0px round ' + rayonFin + 'px)', duration: duree, ease: ease,
        onComplete: function () { gsap.set(el, { clearProps: 'clipPath' }); o.onEnd && o.onEnd(); } });
  };
  /* Referme `el` vers `srcEl` (rectangle mesuré à nouveau). */
  REX.refermer = function (el, srcEl, o) {
    o = o || {};
    var duree = o.duree || .7, ease = o.ease || E.page;
    gsap.killTweensOf(el);
    var fin = function () { el.hidden = true; gsap.set(el, { clearProps: 'clipPath,opacity' }); o.onEnd && o.onEnd(); };
    if (REDUIT || !srcEl || !srcEl.getBoundingClientRect().width) {
      return gsap.to(el, { opacity: 0, duration: .22, onComplete: fin });
    }
    var box = el.getBoundingClientRect(), s = srcEl.getBoundingClientRect();
    return gsap.to(el, { clipPath: insetDepuis(s, box, RAYON), duration: duree, ease: ease, onComplete: fin });
  };

  /* ---------- pile de pages & carte -> page ---------- */
  var pile = REX.pile = [];       // [{el, src}] ; pile[0] = rubrique racine
  var occupe = false, z = 20, menuOuvert = false;
  REX.estOccupe = function () { return occupe || menuOuvert; };
  REX.setOccupe = function (v) { occupe = v; };
  function haut() { return pile[pile.length - 1]; }
  REX.pageCourante = function () { return haut().el; };

  function cascade(page, extra) {
    var els = $$('[data-entree]', page);
    if (extra) els = els.concat(extra);
    if (!els.length) return;
    gsap.fromTo(els, { opacity: 0, y: REDUIT ? 0 : 40, z: REDUIT ? 0 : -160, rotationX: REDUIT ? 0 : 14 },
      { opacity: 1, y: 0, z: 0, rotationX: 0, duration: d(.95), stagger: REDUIT ? 0 : .07, ease: E.sortie, clearProps: 'transform,opacity' });
  }
  REX.cascade = cascade;

  function bandeRideau(page) {
    var h = $('.page-haut', page);
    return h ? h.offsetHeight : (+page.dataset.bande || 0);
  }
  function retirerRideau(page) {
    var r = $('.rideau', page); if (!r) return;
    var H = page.clientHeight, rd = 'round 0px 0px ' + RAYON + 'px ' + RAYON + 'px';
    if (REDUIT) { gsap.to(r, { opacity: 0, duration: .25, onComplete: function () { r.style.display = 'none'; gsap.set(r, { clearProps: 'opacity' }); } }); return; }
    gsap.fromTo(r, { clipPath: 'inset(0px 0px 0px 0px ' + rd + ')' },
      { clipPath: 'inset(0px 0px ' + (H - bandeRideau(page)) + 'px 0px ' + rd + ')', duration: T.rideau, ease: E.page,
        onComplete: function () { r.style.display = 'none'; gsap.set(r, { clearProps: 'clipPath' }); } });
  }

  /* La carte se soulève (translateZ + ombre), puis s'étend en page ; le plan du dessous recule. */
  REX.ouvrirCarte = function (src, id, opt) {
    if (occupe || menuOuvert) return;
    var page = $('#' + id); if (!page) return;
    occupe = true; opt = opt || {};
    var dessous = haut().el, P = REX.PAGES[id] || {};
    page.dataset.teinte = opt.teinte || (src && src.dataset.teinte) || page.dataset.teinteDefaut || 'surface';
    page.dataset.mode = 'retour';
    page.style.zIndex = ++z;
    P.avant && P.avant(page, opt);
    var rideau = $('.rideau', page);
    var pleine = page.classList.contains('pleine');
    if (rideau && !pleine) { rideau.style.display = 'block'; gsap.set(rideau, { clipPath: 'none', opacity: 1 }); }
    gsap.set(page, { opacity: 0 }); page.hidden = false;
    var ent = $$('[data-entree]', page); if (ent.length) gsap.set(ent, { opacity: 0 });
    pile.push({ el: page, src: src });
    var tl = gsap.timeline({ onComplete: function () { occupe = false; } });
    var lever = src && !REDUIT, t0 = lever ? .2 : 0;
    if (lever) {
      gsap.set(src, { willChange: 'transform' });
      tl.to(src, { '--lev': 1, z: 70, scale: 1.04, duration: .22, ease: 'power2.out' }, 0);
    }
    tl.add(function () {
      REX.reveler(page, src, { duree: T.page, rayonFin: 0, onEnd: function () {
        if (src) gsap.set(src, { clearProps: 'willChange,scale,z,--lev' });
      } });
    }, t0);
    if (!REDUIT) tl.to(dessous, { scale: .92, duration: T.page, ease: E.page }, t0);
    tl.add(function () { if (!pleine) retirerRideau(page); }, t0 + (REDUIT ? .1 : .57));
    tl.add(function () { if (P.entrer) P.entrer(page, opt); else cascade(page); }, t0 + (REDUIT ? .15 : .69));
    tl.add(function () { }, t0 + (REDUIT ? .35 : .95));
    return tl;
  };

  /* Fermeture : le rideau de couleur remonte, puis la page se replie dans la carte d'origine. */
  REX.fermerCarte = function (opt) {
    if (occupe || menuOuvert || pile.length < 2) return;
    occupe = true; opt = opt || {};
    var e = pile.pop(), page = e.el, src = opt.src || e.src, dessous = haut().el, P = REX.PAGES[page.id] || {};
    P.sortie && P.sortie(page);
    var rideau = $('.rideau', page), pleine = page.classList.contains('pleine');
    var tl = gsap.timeline({ onComplete: function () {
      page.hidden = true; page.style.zIndex = ''; gsap.set(page, { clearProps: 'opacity,clipPath' }); occupe = false;
      if (src) gsap.set(src, { clearProps: 'willChange,scale,z,--lev' });
      opt.apres && opt.apres();
      P.apresSortie && P.apresSortie(page);
    } });
    var t1 = 0;
    if (rideau && !pleine && !REDUIT) {
      rideau.style.display = 'block';
      var H = page.clientHeight, rd = 'round 0px 0px ' + RAYON + 'px ' + RAYON + 'px';
      tl.fromTo(rideau, { clipPath: 'inset(0px 0px ' + (H - bandeRideau(page)) + 'px 0px ' + rd + ')' }, { clipPath: 'inset(0px 0px 0px 0px ' + rd + ')', duration: .38, ease: 'expo.out' }, 0);
      t1 = .34;
    }
    if (src && !REDUIT) { gsap.set(src, { willChange: 'transform' }); tl.set(src, { '--lev': 1, z: 70, scale: 1.04 }, 0); }
    tl.add(function () { REX.refermer(page, src, { duree: .72 }); }, t1);
    if (!REDUIT) tl.to(dessous, { scale: 1, duration: .72, ease: E.page }, t1);
    if (src && !REDUIT) tl.to(src, { '--lev': 0, z: 0, scale: 1, duration: .5, ease: E.sortie }, t1 + .3);
    tl.add(function () { }, t1 + (REDUIT ? .3 : .75));
    return tl;
  };

  /* Retour direct à la racine (fin de séance, fin de questionnaire) vers la carte `src`. */
  REX.retourRacine = function (srcSel, apres) {
    if (occupe || menuOuvert) return;
    while (pile.length > 2) { var p = pile.splice(1, 1)[0]; var PP = REX.PAGES[p.el.id]; PP && PP.sortie && PP.sortie(p.el); p.el.hidden = true; p.el.style.zIndex = ''; gsap.set(p.el, { clearProps: 'all' }); }
    var src = srcSel ? $(srcSel) : null;
    pile[pile.length - 1].src = src || pile[pile.length - 1].src;
    REX.fermerCarte({ src: src, apres: apres });
  };

  /* ---------- menu « push back » ---------- */
  var cadre, plan;
  function marquerRub() {
    var id = pile[0].el.id;
    $$('.m-item').forEach(function (b) { b.classList.toggle('on', b.dataset.rub === id); });
    $('#m-pastille').hidden = REX.etat.questFait;
  }
  REX.etat = { questFait: false, seances: 1 };

  function ouvrirMenu() {
    if (occupe || menuOuvert || pile.length > 1) return;
    menuOuvert = true; occupe = true;
    var W = cadre.clientWidth;
    $('#menu').hidden = false; marquerRub();
    plan.classList.add('menu-ouvert');
    var items = $$('.m-item'), autres = [$('.m-entete'), $('.m-pied')];
    gsap.set(plan, { willChange: 'transform' });
    var tl = gsap.timeline({ onComplete: function () { gsap.set(plan, { willChange: 'auto' }); } });
    tl.add(function () { occupe = false; }, .45);
    if (REDUIT) {
      tl.to(plan, { x: W * MENU.x, duration: .25 }, 0).fromTo(items.concat(autres), { opacity: 0 }, { opacity: 1, duration: .25 }, 0);
    } else {
      tl.to(plan, { x: W * MENU.x, scale: MENU.scale, rotationY: MENU.rot, duration: T.menu, ease: E.sortie }, 0)
        .fromTo(items, { x: -80, z: -340, rotationY: 42, opacity: 0 }, { x: 0, z: 0, rotationY: 0, opacity: 1, duration: .95, stagger: .055, ease: E.sortie }, .05)
        .fromTo(autres, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6, stagger: .1, ease: E.sortie }, .3);
    }
  }
  function fermerMenu(cb) {
    if (!menuOuvert) return;
    occupe = true;
    var tl = gsap.timeline({ onComplete: function () {
      $('#menu').hidden = true; plan.classList.remove('menu-ouvert'); menuOuvert = false; occupe = false;
      gsap.set(plan, { clearProps: 'transform,willChange' }); cb && cb();
    } });
    gsap.set(plan, { willChange: 'transform' });
    if (REDUIT) tl.to(plan, { x: 0, duration: .25 }, 0);
    else tl.to(plan, { x: 0, scale: 1, rotationY: 0, duration: .75, ease: E.sortie }, 0).to($$('.m-item'), { opacity: 0, x: -30, z: -120, duration: .3, stagger: .015, ease: 'power2.out' }, 0);
  }
  /* Choisir une rubrique : l'ancien plan part, le nouveau revient au premier plan depuis la profondeur. */
  function allerRubrique(id) {
    if (!menuOuvert || occupe) return;
    if (pile[0].el.id === id) { fermerMenu(); return; }
    occupe = true;
    var W = cadre.clientWidth, ancien = pile[0].el, nouveau = $('#' + id), P = REX.PAGES[id] || {};
    var items = $$('.m-item');
    var tl = gsap.timeline();
    if (REDUIT) {
      tl.to(plan, { opacity: 0, duration: .15 });
    } else {
      tl.to(items, { opacity: 0, x: -30, z: -120, duration: .3, stagger: .012, ease: 'power2.out' }, 0)
        .to(plan, { x: W * 1.08, rotationY: -26, duration: .38, ease: 'power3.out' }, 0);
    }
    tl.add(function () {
      ancien.hidden = true; nouveau.hidden = false; nouveau.dataset.mode = 'menu';
      pile[0] = { el: nouveau }; menuOuvert = false;
      $('#menu').hidden = true; plan.classList.remove('menu-ouvert');
      P.avant && P.avant(nouveau, {});
      gsap.set(plan, { x: 0, rotationY: 0, scale: 1, z: REDUIT ? 0 : -520, opacity: 0 });
    });
    tl.add(function () { gsap.delayedCall(.5, function () { occupe = false; }); });
    tl.to(plan, { z: 0, opacity: 1, duration: d(.9), ease: E.sortie, onStart: function () {
      if (P.entrer) P.entrer(nouveau, {}); else cascade(nouveau);
    }, onComplete: function () { gsap.set(plan, { clearProps: 'transform,opacity,willChange' }); } });
  }

  function initNavigation() {
    cadre = $('#cadre'); plan = $('#plan');
    pile.push({ el: $('#e-dash') });
    document.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) {
        var sec = nav.closest('.ecran');
        if (sec.dataset.mode === 'menu') { menuOuvert ? fermerMenu() : ouvrirMenu(); }
        else REX.fermerCarte();
        return;
      }
      var rub = e.target.closest('.m-item');
      if (rub) { allerRubrique(rub.dataset.rub); return; }
      if (e.target.id === 'plan-voile') { fermerMenu(); return; }
      var c = e.target.closest('[data-ouvre]');
      if (c && haut().el.contains(c)) { REX.ouvrirCarte(c, c.dataset.ouvre); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (menuOuvert) fermerMenu(); else if (REX.surEscape && REX.surEscape()) return; else REX.fermerCarte(); }
    });
  }

  REX.demarrer = function () {
    initReglages();
    initNavigation();
    var run = function () {
      Object.keys(REX.PAGES).forEach(function (k) { REX.PAGES[k].init && REX.PAGES[k].init(); });
      REX.PAGES['e-dash'].entrer($('#e-dash'), { premiere: true });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
  };
})();
