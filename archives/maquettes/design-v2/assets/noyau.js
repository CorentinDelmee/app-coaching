/* Maquette V2 — noyau : outils, horloge, sons, mouvement, menu « push back » (M5), carte -> page (M5),
   révélations depuis un élément (M1 : rectangle, cercle, page), roulette de chiffres (M2), lignes masquées.
   Portage Vue : T/E -> src/anim/constantes.js ; chaque fonction de transition -> src/anim/transitions.js. */
(function () {
  'use strict';
  var REX = window.REX = window.REX || {};
  gsap.registerPlugin(Flip, CustomEase, SplitText);
  CustomEase.create('vaul', '.32,.72,0,1');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUIT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- constantes de mouvement (une seule source) ----------
     Rebonds M4 « avec mesure » : back.out 1.4 à 1.8 (jamais elastic sur l'interface courante). */
  var T = { appui: .14, rapide: .25, base: .5, page: .85, menu: .85, rideau: .7, slide: .7, rect: .55, cercle: .72, repos: .5, fermer: .42 };
  var E = { sortie: 'expo.out', page: 'expo.inOut', doux: 'power3.out', ressort: 'back.out(1.4)', pop: 'back.out(1.7)', vaul: 'vaul', fermer: 'power3.out' };
  var MENU = { x: 0.7, scale: 0.82, rot: -14 };
  var RAYON = 28;
  var d = function (t) { return REDUIT ? Math.min(t, .25) : t; };
  Object.assign(REX, { $: $, $$: $$, REDUIT: REDUIT, T: T, E: E, RAYON: RAYON, d: d, PAGES: {} });

  /* ---------- formats ---------- */
  REX.mmss = function (s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };
  REX.fr = function (n) { return String(n).replace('.', ','); };

  /* ---------- horloge virtuelle (performance.now, ×10 pour la démo) ---------- */
  var horloge = REX.horloge = {
    vitesse: 1, v: 0, r: performance.now(),
    now: function () { var r = performance.now(); this.v += (r - this.r) * this.vitesse; this.r = r; return this.v; }
  };

  /* ---------- son (Web Audio) & vibration ----------
     Son de fin = M1 (deux bips 880 Hz de 0,5 s espacés de 220 ms) ; tic des 3 dernières secondes = M1 ;
     petit « tick » des valeurs (curseur, roulette) = M2. */
  var ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  REX.journalSons = [];
  REX.bip = function (f, dur, vol) {
    REX.journalSons.push(f);
    if (!REX.CONFIG.son) return;
    var c = audio(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .03);
  };
  REX.vibrer = function (ms) { if (REX.CONFIG.vibration && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } };
  REX.SONS = {
    tic: function () { REX.bip(740, .09, .22); REX.vibrer(12); },                    // 3 dernières secondes (M1)
    go: function () { REX.bip(1180, .22, .28); REX.vibrer(60); },                    // départ du travail (M1)
    fin: function () { REX.bip(880, .5, .3); setTimeout(function () { REX.bip(880, .5, .3); }, 220); REX.vibrer([180, 80, 180]); }, // fin (M1)
    tick: function () { REX.bip(1900, .03, .05); REX.vibrer(6); },                   // cran de valeur (M2)
    choix: function () { REX.bip(1320, .07, .14); REX.vibrer(10); },                 // choix validé
    valide: function () { REX.bip(660, .09, .16); REX.vibrer(18); },                 // série validée (M2)
    fete: function () { [660, 880, 1320].forEach(function (f, i) { setTimeout(function () { REX.bip(f, .18, .18); }, i * 110); }); REX.vibrer([20, 40, 20]); }
  };
  document.addEventListener('pointerdown', function () { audio(); }, { once: true, passive: true });

  /* ---------- géométrie : rectangle / cercle d'un élément, relatif à une couche ---------- */
  function insetDepuis(src, box, rayon) {
    var t = Math.max(0, src.top - box.top), l = Math.max(0, src.left - box.left);
    var r = Math.max(0, box.right - src.right), b = Math.max(0, box.bottom - src.bottom);
    return 'inset(' + t + 'px ' + r + 'px ' + b + 'px ' + l + 'px round ' + rayon + 'px)';
  }
  var PLEIN = 'inset(0px 0px 0px 0px round 0px)';
  function cercle(r, x, y) { return 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'; }
  function centre(src, box) { var s = src.getBoundingClientRect(); return { x: s.left + s.width / 2 - box.left, y: s.top + s.height / 2 - box.top }; }
  function rayonMax(c, box) { return Math.hypot(Math.max(c.x, box.width - c.x), Math.max(c.y, box.height - c.y)) + 4; }
  /* clone de l'élément touché, posé dans un voile de sa couleur (M1 : « le voile fait le lien ») */
  function voileDe(couche, src) {
    var v = $(':scope > .voile', couche);
    if (!v) { v = document.createElement('div'); v.className = 'voile'; couche.appendChild(v); }
    v.innerHTML = ''; v.style.display = ''; v.style.opacity = 1; v.style.clipPath = '';
    var cs = getComputedStyle(src), box = couche.getBoundingClientRect(), q = src.getBoundingClientRect(), col = cs.backgroundColor;
    v.style.background = (col && col !== 'rgba(0, 0, 0, 0)' && col !== 'transparent') ? col : 'var(--surface)';
    var c = src.cloneNode(true); c.removeAttribute('id'); $$('[id]', c).forEach(function (n) { n.removeAttribute('id'); });
    c.style.cssText = 'position:absolute;margin:0;transition:none;transform:none;opacity:1;left:' + (q.left - box.left) + 'px;top:' + (q.top - box.top) + 'px;width:' + q.width + 'px;height:' + q.height + 'px;border-radius:' + (cs.borderRadius || '22px') + ';color:' + cs.color;
    v.appendChild(c);
    return v;
  }

  /* M5 : révéler / refermer depuis un rectangle (pages, feuilles) */
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
  REX.refermer = function (el, srcEl, o) {
    o = o || {};
    gsap.killTweensOf(el);
    var fin = function () { el.hidden = true; gsap.set(el, { clearProps: 'clipPath,opacity' }); o.onEnd && o.onEnd(); };
    if (REDUIT || !srcEl || !srcEl.getBoundingClientRect().width) return gsap.to(el, { opacity: 0, duration: .22, onComplete: fin });
    var box = el.getBoundingClientRect(), s = srcEl.getBoundingClientRect();
    return gsap.to(el, { clipPath: insetDepuis(s, box, RAYON), duration: o.duree || .7, ease: o.ease || E.page, onComplete: fin });
  };

  /* M1 : rectangle depuis un élément (ligne de série -> panneau, valeur -> sélecteur) */
  REX.ouvrirRect = function (couche, src, o) {
    o = o || {};
    if (couche._tl) couche._tl.kill();
    couche.hidden = false; couche._src = src;
    var v = voileDe(couche, src), els = $$('[data-c]', couche); gsap.set(els, { opacity: 0 });
    var fin = function () { gsap.set(couche, { clearProps: 'clipPath,opacity' }); v.style.display = 'none'; o.onFini && o.onFini(); };
    if (REDUIT) {
      couche._tl = gsap.timeline({ onComplete: fin }).fromTo(couche, { opacity: 0 }, { opacity: 1, duration: .2 }, 0).to(v, { opacity: 0, duration: .15 }, 0).to(els, { opacity: 1, duration: .2 }, 0);
      return couche._tl;
    }
    var box = couche.getBoundingClientRect();
    couche._tl = gsap.timeline({ onComplete: fin })
      .fromTo(couche, { clipPath: insetDepuis(src.getBoundingClientRect(), box, o.rayon || 22) }, { clipPath: PLEIN, duration: o.duree || T.rect, ease: E.doux }, 0)
      .fromTo(v, { clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: 'inset(0px 0px ' + box.height + 'px 0px)', duration: .5, ease: E.page, immediateRender: false }, .3)
      .fromTo(els, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .06, ease: E.sortie, clearProps: 'transform,opacity' }, .3);
    return couche._tl;
  };
  REX.fermerRect = function (couche, src, o) {
    o = o || {};
    if (couche._tl) couche._tl.kill();
    src = src || couche._src;
    var fin = function () { couche.hidden = true; gsap.set(couche, { clearProps: 'clipPath,opacity' }); o.onFini && o.onFini(); };
    if (REDUIT || !src || !src.isConnected) { couche._tl = gsap.to(couche, { opacity: 0, duration: .18, onComplete: fin }); return couche._tl; }
    var v = voileDe(couche, src); v.style.opacity = 0;
    couche._tl = gsap.timeline({ onComplete: fin })
      .to(v, { opacity: 1, duration: .18 }, 0)
      .to(couche, { clipPath: insetDepuis(src.getBoundingClientRect(), couche.getBoundingClientRect(), o.rayon || 22), duration: o.duree || .42, ease: E.fermer }, .05);
    return couche._tl;
  };

  /* M1 : cercle depuis un bouton (chrono, section circuit) */
  REX.ouvrirCercle = function (couche, src, o) {
    o = o || {};
    if (couche._tl) couche._tl.kill();
    couche.hidden = false;
    var box = couche.getBoundingClientRect(), c = src ? centre(src, box) : { x: box.width / 2, y: box.height * .82 };
    couche._centre = c;
    var fin = function () { gsap.set(couche, { clearProps: 'clipPath,opacity' }); o.onFini && o.onFini(); };
    if (REDUIT) { couche._tl = gsap.fromTo(couche, { opacity: 0 }, { opacity: 1, duration: .2, onComplete: fin }); return couche._tl; }
    couche._tl = gsap.fromTo(couche, { clipPath: cercle(src ? 26 : 0, c.x, c.y) },
      { clipPath: cercle(rayonMax(c, box), c.x, c.y), duration: o.duree || T.cercle, ease: o.ease || 'power4.inOut', onComplete: fin });
    return couche._tl;
  };
  REX.fermerCercle = function (couche, vers, o) {
    o = o || {};
    if (couche._tl) couche._tl.kill();
    var box = couche.getBoundingClientRect();
    var c = vers && vers.isConnected && vers.getBoundingClientRect().width ? centre(vers, box) : (couche._centre || { x: box.width / 2, y: box.height * .82 });
    var fin = function () { couche.hidden = true; gsap.set(couche, { clearProps: 'clipPath,opacity' }); o.onFini && o.onFini(); };
    if (REDUIT) { couche._tl = gsap.to(couche, { opacity: 0, duration: .18, onComplete: fin }); return couche._tl; }
    couche._tl = gsap.fromTo(couche, { clipPath: cercle(rayonMax(c, box), c.x, c.y) },
      { clipPath: cercle(26, c.x, c.y), duration: o.duree || T.fermer + .1, ease: E.fermer, onComplete: fin, immediateRender: false });
    return couche._tl;
  };

  /* ---------- M2 : roulette de chiffres (chaque chiffre = colonne 0-9-0-9 qui défile, transform seul)
     sens +1 : le chiffre monte (compteur) ; sens -1 : il descend (compte à rebours). ---------- */
  var COL = Array.from({ length: 20 }, function (_, i) { return '<i>' + (i % 10) + '</i>'; }).join('');
  REX.rouler = function (el, texte, o) {
    o = o || {}; texte = String(texte);
    var duree = o.duree || 1.3, sens = o.sens || 1, stagger = o.stagger == null ? .08 : o.stagger;
    var prev = el.dataset.val || '';
    el.dataset.val = texte; el.setAttribute('aria-label', texte); el.classList.add('rl-wrap');
    gsap.killTweensOf(el.querySelectorAll('.rl-c'));
    if (REDUIT || o.immediat) { el.textContent = texte; el.classList.remove('rl-wrap'); return null; }
    el.textContent = '';
    var A = texte.split(''), P = prev.split('');
    var tl = gsap.timeline({ delay: o.delai || 0 });
    A.forEach(function (c, i) {
      if (!/\d/.test(c)) { var s = document.createElement('span'); s.className = 'rl-s'; s.textContent = c; s.setAttribute('aria-hidden', 'true'); el.appendChild(s); return; }
      var j = A.length - 1 - i, pc = P[P.length - 1 - j], dd = +c;
      var cell = document.createElement('span'); cell.className = 'rl'; cell.setAttribute('aria-hidden', 'true');
      var col = document.createElement('span'); col.className = 'rl-c'; col.innerHTML = COL;
      cell.appendChild(col); el.appendChild(cell);
      var a, b;
      if (/\d/.test(pc || '')) { var p = +pc; if (sens > 0) { a = p; b = dd >= p ? dd : dd + 10; } else { a = 10 + p; b = dd <= p ? 10 + dd : dd; } }
      else if (sens > 0) { a = 0; b = 10 + dd; } else { a = 19; b = dd; }
      gsap.set(col, { yPercent: -a * 5 });
      if (a !== b) tl.to(col, { yPercent: -b * 5, duration: sens > 0 && !pc ? duree : Math.min(duree, .6 + Math.abs(b - a) * .06), ease: E.sortie }, i * stagger);
    });
    return tl;
  };

  /* ---------- lignes de titre qui montent dans leur masque (M2) / mots (M1) ---------- */
  REX.lignes = function (el, o) {
    o = o || {};
    if (!el) return;
    if (REDUIT) { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .25, delay: o.delai || 0 }); return; }
    if (el._split) { el._split.revert(); }
    el._split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'ligne' });
    gsap.set(el, { opacity: 1 });
    gsap.fromTo(el._split.lines, { yPercent: 105 }, { yPercent: 0, duration: o.duree || 1, stagger: o.stagger || .1, delay: o.delai || 0, ease: E.sortie,
      onComplete: function () { if (el._split) { el._split.revert(); el._split = null; } } });
  };
  REX.compter = function (el, vers, o) {
    o = o || {}; var obj = { v: o.de || 0 }, fmt = o.format || function (v) { return Math.round(v); };
    if (REDUIT) { el.textContent = fmt(vers); return null; }
    return gsap.to(obj, { v: vers, duration: o.duree || 1.4, delay: o.delai || 0, ease: 'expo.out', onUpdate: function () { el.textContent = fmt(obj.v); } });
  };
  REX.confettis = function (box, n) {
    if (REDUIT) return;
    box.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i'); box.appendChild(p);
      var dx = gsap.utils.random(-170, 170), hau = gsap.utils.random(150, 330), rot = gsap.utils.random(-540, 540);
      gsap.timeline({ delay: gsap.utils.random(0, .25), onComplete: (function (el) { return function () { el.remove(); }; })(p) })
        .set(p, { x: 0, y: 0, rotation: 0, scale: gsap.utils.random(.6, 1.2), opacity: 1 })
        .to(p, { x: dx, y: -hau, rotation: rot / 2, duration: .7, ease: 'power3.out' })
        .to(p, { x: dx * 1.25, y: 520, rotation: rot, opacity: 0, duration: 1.5, ease: 'power1.in' });
    }
  };
  /* appui : géré en CSS (enfoncement 100 ms, relâchement rebondi 300 ms, interruptible) — voir v2.css */

  /* ---------- pile de pages & carte -> page (M5) ---------- */
  var pile = REX.pile = [];
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
  function bandeRideau(page) { var h = $('.page-haut', page); return h ? h.offsetHeight : 0; }
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
    page.dataset.teinte = opt.teinte || (src && (src.dataset.teintePage || src.dataset.teinte)) || page.dataset.teinteDefaut || 'surface';
    page.dataset.mode = 'retour';
    page.style.zIndex = ++z;
    P.avant && P.avant(page, opt, src);
    var rideau = $('.rideau', page), pleine = page.classList.contains('pleine');
    if (rideau && !pleine) { rideau.style.display = 'block'; gsap.set(rideau, { clipPath: 'none', opacity: 1 }); }
    gsap.set(page, { opacity: 0 }); page.hidden = false;
    var ent = $$('[data-entree]', page); if (ent.length) gsap.set(ent, { opacity: 0 });
    pile.push({ el: page, src: src });
    var tl = gsap.timeline({ onComplete: function () { occupe = false; } });
    var lever = src && !REDUIT, t0 = lever ? .2 : 0;
    if (lever) { gsap.set(src, { willChange: 'transform' }); tl.to(src, { '--lev': 1, z: 70, scale: 1.04, duration: .22, ease: 'power2.out' }, 0); }
    tl.add(function () {
      REX.reveler(page, src, { duree: T.page, rayonFin: 0, onEnd: function () { if (src) gsap.set(src, { clearProps: 'willChange,scale,z,--lev' }); } });
    }, t0);
    if (!REDUIT) tl.to(dessous, { scale: .92, duration: T.page, ease: E.page }, t0);
    tl.add(function () { if (!pleine) retirerRideau(page); }, t0 + (REDUIT ? .1 : .57));
    tl.add(function () { if (P.entrer) P.entrer(page, opt); else cascade(page); }, t0 + (REDUIT ? .15 : .69));
    return tl;
  };
  /* Fermeture : le rideau de couleur redescend, puis la page se replie dans la carte d'origine. */
  REX.fermerCarte = function (opt) {
    if (occupe || menuOuvert || pile.length < 2) return;
    occupe = true; opt = opt || {};
    var e = pile.pop(), page = e.el, src = opt.src || e.src, dessous = haut().el, P = REX.PAGES[page.id] || {};
    P.sortie && P.sortie(page);
    var rideau = $('.rideau', page), pleine = page.classList.contains('pleine');
    var tl = gsap.timeline({ onComplete: function () {
      page.hidden = true; page.style.zIndex = ''; gsap.set(page, { clearProps: 'opacity,clipPath' }); occupe = false;
      if (src) gsap.set(src, { clearProps: 'willChange,scale,z,--lev' });
      opt.apres && opt.apres(); P.apresSortie && P.apresSortie(page);
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
  /* Retour direct à la racine (fin de séance, fin de questionnaire) vers la carte `srcSel`. */
  REX.retourRacine = function (srcSel, apres) {
    if (occupe || menuOuvert) return;
    while (pile.length > 2) { var p = pile.splice(1, 1)[0]; var PP = REX.PAGES[p.el.id]; PP && PP.sortie && PP.sortie(p.el); p.el.hidden = true; p.el.style.zIndex = ''; gsap.set(p.el, { clearProps: 'all' }); }
    var src = srcSel ? $(srcSel) : null;
    gsap.set(pile[0].el, { scale: .92 });
    pile[pile.length - 1].src = src || pile[pile.length - 1].src;
    REX.fermerCarte({ src: src, apres: apres });
  };
  /* Page ouverte depuis un élément de la page courante, façon M1 (séance : depuis « Démarrer » ou un exercice) */
  REX.empiler = function (page) { pile.push({ el: page }); page.style.zIndex = ++z; };
  REX.depiler = function (page) { var i = pile.findIndex(function (x) { return x.el === page; }); if (i > 0) pile.splice(i, 1); };

  /* ---------- menu « push back » (M5, gardé tel quel) ---------- */
  var cadre, plan;
  REX.etat = { questFait: false, seances: 1, w2Fait: false };
  function marquerRub() {
    var id = pile[0].el.id;
    $$('.m-item').forEach(function (b) { b.classList.toggle('on', b.dataset.rub === id); if (b.dataset.rub === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('#m-pastille').hidden = REX.etat.questFait;
  }
  function ouvrirMenu() {
    if (occupe || menuOuvert || pile.length > 1) return;
    menuOuvert = true; occupe = true;
    var W = cadre.clientWidth;
    $('#menu').hidden = false; marquerRub();
    plan.classList.add('menu-ouvert');
    var items = $$('.m-item'), autres = [$('.m-entete'), $('.m-pied')];
    gsap.set(plan, { willChange: 'transform' });
    var tl = gsap.timeline({ onComplete: function () { gsap.set(plan, { willChange: 'auto' }); var on = $('.m-item.on'); on && on.focus({ preventScroll: true }); } });
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
  REX.fermerMenu = fermerMenu;
  function allerRubrique(id) {
    if (!menuOuvert || occupe) return;
    if (pile[0].el.id === id) { fermerMenu(); return; }
    occupe = true;
    var W = cadre.clientWidth, ancien = pile[0].el, nouveau = $('#' + id), P = REX.PAGES[id] || {};
    var tl = gsap.timeline();
    if (REDUIT) tl.to(plan, { opacity: 0, duration: .15 });
    else tl.to($$('.m-item'), { opacity: 0, x: -30, z: -120, duration: .3, stagger: .012, ease: 'power2.out' }, 0)
      .to(plan, { x: W * 1.08, rotationY: -26, duration: .38, ease: 'power3.out' }, 0);
    tl.add(function () {
      var PA = REX.PAGES[ancien.id]; PA && PA.sortie && PA.sortie(ancien);
      ancien.hidden = true; nouveau.hidden = false; nouveau.dataset.mode = 'menu';
      if (nouveau.dataset.teinteDefaut) nouveau.dataset.teinte = nouveau.dataset.teinteDefaut;
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
      if (c && haut().el.contains(c)) { REX.ouvrirCarte(c, c.dataset.ouvre, { workout: c.dataset.workout }); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (menuOuvert) fermerMenu(); else if (REX.surEscape && REX.surEscape()) return; else REX.fermerCarte(); }
    });
  }
  REX.demarrer = function () {
    REX.initPanneau();
    initNavigation();
    $('#btn-vitesse').addEventListener('click', function () {
      horloge.now(); horloge.vitesse = horloge.vitesse === 1 ? 10 : 1;
      this.setAttribute('aria-pressed', String(horloge.vitesse === 10));
    });
    var run = function () {
      Object.keys(REX.PAGES).forEach(function (k) { REX.PAGES[k].init && REX.PAGES[k].init(); });
      REX.PAGES['e-dash'].entrer($('#e-dash'), { premiere: true });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
  };
})();
