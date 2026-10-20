/* M3 « Tableau » — moteur : constantes de mouvement, utilitaires, compteur split-flap, horloge,
   volets (stores), whip-pan, audio. Aucune logique d'écran ici. */
window.M3 = window.M3 || {};
(function (M3) {
  'use strict';

  /* ---- Durées et courbes centralisées ---- */
  M3.T = {
    page: 0.78, pageRetour: 0.62, volet: 0.32, voletStagger: 0.05, voletRapide: 0.24,
    whipSort: 0.3, whipEntre: 0.46, menu: 0.5, menuStagger: 0.07, cascade: 0.06,
    tiroir: 0.5, selecteur: 0.62, serie: 0.6, fondu: 0.18
  };
  M3.E = { sec: 'power4.out', coupe: 'power4.inOut', sortie: 'power3.in', cran: 'steps(3)' };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  M3.$ = $; M3.$$ = $$;

  /* ---- Mouvement réduit : fondus courts, pas de déplacement ---- */
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  M3.rm = function () { return mq.matches; };

  /* ---- Géométrie relative au cadre téléphone (marche aussi quand le cadre est mis à l'échelle) ---- */
  M3.tel = $('#tel');
  M3.rel = function (el) {
    var r = el.getBoundingClientRect(), t = M3.tel.getBoundingClientRect(), k = t.width / M3.tel.offsetWidth || 1;
    var ox = M3.tel.clientLeft, oy = M3.tel.clientTop;
    return { top: (r.top - t.top) / k - oy, left: (r.left - t.left) / k - ox, right: (r.right - t.left) / k - ox, bottom: (r.bottom - t.top) / k - oy, w: r.width / k, h: r.height / k };
  };
  M3.ins = function (r) {
    var W = M3.tel.clientWidth, H = M3.tel.clientHeight;
    return 'inset(' + r.top + 'px ' + (W - r.right) + 'px ' + (H - r.bottom) + 'px ' + r.left + 'px)';
  };
  M3.PLEIN = 'inset(0px 0px 0px 0px)';
  M3.ajuster = function () {   // ordinateur : le cadre rétrécit si la fenêtre est basse
    var t = M3.tel;
    if (window.innerWidth >= 500 && window.innerHeight < 880) t.style.transform = 'scale(' + ((window.innerHeight - 30) / 850) + ')';
    else t.style.transform = '';
  };
  window.addEventListener('resize', M3.ajuster); M3.ajuster();

  /* ---- Typographie cinétique : lettres / mots ---- */
  M3.lettres = function (el) {
    var txt = el.textContent; el.setAttribute('aria-label', txt); el.innerHTML = '';
    var out = [];
    txt.split(' ').forEach(function (m, i, tab) {
      var mot = document.createElement('span'); mot.className = 'mot'; mot.setAttribute('aria-hidden', 'true');
      m.split('').forEach(function (c) {
        var l = document.createElement('span'); l.className = 'lettre';
        var ii = document.createElement('i'); ii.textContent = c; l.appendChild(ii); mot.appendChild(l); out.push(ii);
      });
      el.appendChild(mot); if (i < tab.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return out;
  };
  M3.entreeLettres = function (el, delay) {   // les lettres glissent depuis le bas, serrées
    var ls = el._l || (el._l = M3.lettres(el));
    if (M3.rm()) return gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: M3.T.fondu, delay: delay || 0 });
    gsap.killTweensOf(ls);
    return gsap.fromTo(ls, { yPercent: 108 }, { yPercent: 0, duration: 0.7, stagger: 0.022, delay: delay || 0, ease: M3.E.sec });
  };
  M3.entreeMots = function (el, delay) {      // un nom d'exercice : chaque mot arrive en glissant de la droite
    var mots = $$('.mot', el);
    if (M3.rm()) return gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: M3.T.fondu, delay: delay || 0 });
    return gsap.fromTo(mots.map(function (m) { return m.firstElementChild; }), { xPercent: 105 }, { xPercent: 0, duration: 0.65, stagger: 0.1, delay: delay || 0, ease: M3.E.sec });
  };
  M3.motsDans = function (el) {   // enveloppe chaque mot d'un titre pour glisser dedans
    var mots = el.textContent.split(' '); el.setAttribute('aria-label', el.textContent); el.innerHTML = '';
    mots.forEach(function (m, k) { var s = document.createElement('span'); s.className = 'mot'; var i = document.createElement('i'); i.style.display = 'inline-block'; i.textContent = m; s.appendChild(i); el.appendChild(s); if (k < mots.length - 1) el.appendChild(document.createTextNode(' ')); });
  };

  /* ---- Compteur mécanique « split-flap » : chaque chiffre roule par crans ----
     flap(el, "07", 'desc'|'asc'|null)  → null = pose immédiate sans animation. */
  function bati(cont, texte) {
    cont.classList.add('flap'); cont.innerHTML = ''; var cells = [];
    texte.split('').forEach(function (ch) {
      var s = document.createElement('span');
      if (/\d/.test(ch)) {
        s.className = 'fl'; var b = document.createElement('span'); b.className = 'fl-b';
        for (var k = 0; k < 20; k++) { var d = document.createElement('b'); d.textContent = k % 10; b.appendChild(d); }
        s.appendChild(b); cells.push({ strip: b, pos: 0, digit: true });
      } else { s.className = 'fl-s'; s.textContent = ch; cells.push({ digit: false }); }
      cont.appendChild(s);
    });
    cont._f = { len: texte.length, cells: cells };
  }
  M3.flap = function (cont, texte, sens) {
    texte = String(texte);
    if (!cont._f || cont._f.len !== texte.length) { bati(cont, texte); sens = null; }
    cont.setAttribute('role', 'text'); cont.setAttribute('aria-label', texte);
    cont._f.cells.forEach(function (c, i) {
      var ch = texte[i]; if (!c.digit) return;
      var d = +ch, cur = c.pos % 10;
      if (sens == null) { c.pos = d; gsap.killTweensOf(c.strip); gsap.set(c.strip, { yPercent: -d * 5 }); return; }
      if (cur === d && !gsap.isTweening(c.strip)) return;
      gsap.killTweensOf(c.strip);
      var pos = c.pos, target;
      if (M3.rm()) { c.pos = d; gsap.set(c.strip, { yPercent: -d * 5 }); return; }
      if (sens === 'asc') { if (pos >= 10) { pos -= 10; } target = pos + ((d - (pos % 10) + 10) % 10); }
      else { if (pos < 10) { pos += 10; } target = pos - (((pos % 10) - d + 10) % 10); }
      gsap.set(c.strip, { yPercent: -pos * 5 });
      var n = Math.abs(target - pos); if (!n) { c.pos = target; return; }
      c.pos = target;
      gsap.to(c.strip, { yPercent: -target * 5, duration: Math.min(0.9, 0.09 * n + 0.1), ease: 'steps(' + n + ')', overwrite: true });
    });
  };
  M3.flapMontee = function (cont, de, vers, duree, delay, pad) {  // 0 → 105 : défile puis s'arrête en douceur
    var o = { v: de }, fmt = function (v) { var s = String(Math.round(v)); while (pad && s.length < pad) s = '0' + s; return s; };
    M3.flap(cont, fmt(de), null);
    var dernier = fmt(de);
    return gsap.to(o, { v: vers, duration: duree || 1.2, delay: delay || 0, ease: 'power3.out', onUpdate: function () {
      var s = fmt(o.v); if (s !== dernier) { M3.flap(cont, s, 'asc'); dernier = s; }
    } });
  };

  /* ---- Horloge de démonstration : temps réel (performance.now) × vitesse (« ×10 ») ---- */
  var vit = 1, virt = 0, dernier = performance.now();
  M3.maintenant = function () { var n = performance.now(); virt += (n - dernier) * vit; dernier = n; return virt; };
  M3.setVitesse = function (v) {
    M3.maintenant(); vit = v;
    $$('.x10').forEach(function (b) { b.classList.toggle('on', v > 1); b.setAttribute('aria-pressed', v > 1); });
    var r = $('#reg-x10'); if (r) r.classList.toggle('on', v > 1);
  };
  M3.vitesse = function () { return vit; };

  /* Chrono : l'écoulé est calculé sur l'horloge, jamais en comptant les ticks. */
  M3.creerChrono = function (o) {
    var t0 = M3.maintenant(), extra = 0, fini = false;
    var id = setInterval(tick, 50);
    function ecoule() { return M3.maintenant() - t0; }
    function tick() {
      if (fini) return;
      var e = ecoule(), rest = Math.max(0, o.duree + extra - e);
      o.onTick && o.onTick({ ecoule: e, restant: rest, duree: o.duree + extra });
      if (rest <= 0) { stop(); o.onFin && o.onFin(); }
    }
    function stop() { fini = true; clearInterval(id); }
    tick();
    return { ajouter: function (ms) { extra += ms; }, arreter: stop, ecoule: ecoule, actif: function () { return !fini; } };
  };

  /* ---- Audio (Web Audio) + vibration ---- */
  var ac;
  M3.audio = function () {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { }
    return ac;
  };
  M3.bip = function (f, d, v) {
    var a = M3.audio(); if (!a) return;
    try {
      var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = 'square'; o.frequency.value = f || 880;
      g.gain.setValueAtTime(v || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + (d || 0.12));
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + (d || 0.12) + 0.02);
    } catch (e) { }
    M3.bips = (M3.bips || 0) + 1;
  };
  M3.cran = function () { M3.bip(1500, 0.02, 0.05); if (navigator.vibrate) navigator.vibrate(6); };
  M3.vibre = function (p) { if (navigator.vibrate) navigator.vibrate(p); };
  document.addEventListener('pointerdown', function () { M3.audio(); }, { once: true, capture: true });

  /* ---- Volets : bandes pleines qui glissent d'un écran à l'autre ----
     volets(cb, {label, rapide}) : couvre, appelle cb (échange d'écran à couvert), puis découvre. */
  M3.volets = function (cb, opt) {
    opt = opt || {};
    var el = $('#volets'), bandes = $$('#volets i'), lab = $('#volets .vol-label'), T = M3.T;
    el.style.display = 'flex'; el.style.pointerEvents = 'auto'; lab.innerHTML = opt.label ? '<span>' + opt.label + '</span>' : '';
    var fin = function () { el.style.display = 'none'; el.style.pointerEvents = 'none'; opt.fini && opt.fini(); };
    if (M3.rm()) {
      gsap.set(bandes, { xPercent: 0 });
      return gsap.timeline({ onComplete: fin }).fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.12 })
        .add(function () { cb && cb(); }).to(el, { opacity: 0, duration: 0.2 }).set(el, { opacity: 1 });
    }
    var s = opt.rapide ? 0.03 : T.voletStagger, d = opt.rapide ? T.voletRapide : T.volet;
    gsap.set(bandes, { xPercent: -101 }); gsap.set(lab, { opacity: 0, x: -80 });
    var tl = gsap.timeline({ onComplete: fin });
    tl.to(bandes, { xPercent: 0, duration: d, stagger: s, ease: M3.E.sec })
      .add(function () { cb && cb(); });
    if (opt.label) tl.to(lab, { opacity: 1, x: 0, duration: 0.3, ease: M3.E.sec }).to({}, { duration: 0.22 }).to(lab, { opacity: 0, x: 60, duration: 0.14, ease: M3.E.sec });
    tl.to(bandes, { xPercent: 101, duration: d, stagger: s, ease: M3.E.sec });
    return tl;
  };

  /* ---- Whip-pan : l'ancien panneau file en s'étirant, le nouveau arrive en se rétractant ---- */
  M3.whip = function (sortant, entrant, dir, fin) {
    dir = dir || 1;                       // 1 : vers la gauche (suivant), -1 : vers la droite (précédent)
    var T = M3.T, tl = gsap.timeline({ onComplete: function () { if (sortant) { sortant.style.display = 'none'; gsap.set(sortant, { clearProps: 'transform,opacity,transformOrigin' }); } gsap.set(entrant, { clearProps: 'transform,opacity,transformOrigin' }); fin && fin(); } });
    entrant.style.display = 'flex';
    if (M3.rm()) {
      tl.fromTo(entrant, { opacity: 0 }, { opacity: 1, duration: T.fondu });
      if (sortant) tl.to(sortant, { opacity: 0, duration: T.fondu }, 0);
      return tl;
    }
    if (sortant) tl.to(sortant, { xPercent: -100 * dir, scaleX: 1.28, opacity: 0.35, transformOrigin: dir > 0 ? '100% 50%' : '0% 50%', duration: T.whipSort, ease: M3.E.sortie }, 0);
    tl.fromTo(entrant, { xPercent: 100 * dir, scaleX: 1.28, opacity: 0.35, transformOrigin: dir > 0 ? '0% 50%' : '100% 50%' },
      { xPercent: 0, scaleX: 1, opacity: 1, duration: T.whipEntre, ease: M3.E.sec }, sortant ? 0.12 : 0);
    var st = $('#streak');
    st.style.display = 'block'; st.style.background = '';
    tl.fromTo(st, { x: dir > 0 ? M3.tel.offsetWidth + 20 : -40 }, { x: dir > 0 ? -40 : M3.tel.offsetWidth + 20, duration: 0.42, ease: M3.E.sec, onComplete: function () { st.style.display = 'none'; } }, 0.04);
    return tl;
  };

  /* ---- Toast & modale ---- */
  var toastTl;
  M3.toast = function (msg) {
    var t = $('#toast'); t.textContent = msg; t.style.display = 'block';
    if (toastTl) toastTl.kill();
    toastTl = gsap.timeline({ onComplete: function () { t.style.display = 'none'; } });
    toastTl.fromTo(t, { y: M3.rm() ? 0 : 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: M3.E.sec }).to(t, { opacity: 0, duration: 0.25, delay: 2 });
  };
  M3.confirmer = function (titre, texte, oui, non, onOui) {
    var m = $('#modal'); m.innerHTML = '<div class="m-boite"><h3>' + titre + '</h3><p>' + texte + '</p><button class="btn" data-oui>' + oui + '</button><button class="btn sec moy" data-non>' + non + '</button></div>';
    m.style.display = 'flex';
    var b = $('.m-boite', m);
    gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.15 });
    gsap.fromTo(b, { yPercent: M3.rm() ? 0 : 100 }, { yPercent: 0, duration: 0.4, ease: M3.E.sec });
    function ferme(cb) { gsap.to(b, { yPercent: M3.rm() ? 0 : 100, duration: 0.25, ease: M3.E.sec }); gsap.to(m, { opacity: 0, duration: 0.2, onComplete: function () { m.style.display = 'none'; cb && cb(); } }); }
    $('[data-oui]', m).onclick = function () { ferme(onOui); };
    $('[data-non]', m).onclick = function () { ferme(); };
  };
})(window.M3);
