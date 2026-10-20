/* M5 « Profondeur » — la séance : paquet de cartes en 3D, série agrandie, roue, repos, circuits, tiroir, fin. */
(function () {
  'use strict';
  var REX = window.REX, $ = REX.$, $$ = REX.$$, T = REX.T, E = REX.E, d = REX.d, REDUIT = REX.REDUIT, DATA = REX.DATA, H = REX.horloge;
  var CHECK = '<svg class="ic"><use href="#i-check"/></svg>';
  var PLAY = '<svg class="ic"><use href="#i-play"/></svg>';
  var CIRC = 2 * Math.PI * 148;
  var pad = function (n) { return ('0' + n).slice(-2); };
  var yt = function (n) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(n); };

  var S = { i: 0, exos: [], cartes: [], drags: [], debut: 0, occupe: false, mode: '', serie: null, tiroir: false, wake: null, tick: null, dernierSec: -1 };

  /* ================= CONSTRUCTION ================= */
  function nouvelleSeance() {
    S.exos = DATA.exos.map(function (e) {
      var o = Object.assign({}, e); o.sets = []; o.fait = false;
      for (var k = 0; k < (e.series || 0); k++) o.sets.push({ reps: e.reps, kg: e.kg, dur: e.dur, fait: false });
      return o;
    });
    S.i = 0; S.occupe = false; S.debut = H.now();
    var seg = $('#segments'); seg.innerHTML = S.exos.map(function () { return '<i><b></b></i>'; }).join('');
    var pq = $('#paquet'); pq.innerHTML = ''; S.cartes = [];
    S.drags.forEach(function (x) { x.kill(); }); S.drags = [];
    S.exos.forEach(function (e, i) {
      var c = document.createElement('article'); c.className = 'xcarte'; c.innerHTML = htmlCarte(e, i); pq.appendChild(c); S.cartes.push(c);
      if (e.type === 'circuit') gsap.set($('.f2', c), { rotationY: 180 });
      majRows(i);
    });
    S.cartes.forEach(function (c, i) {
      S.drags.push(Draggable.create(c, { type: 'x', trigger: c, dragClickables: true, minimumMovement: 10, zIndexBoost: false,
        onPress: function () { if (i !== S.i || S.occupe || ovOuvert()) this.endDrag(); },
        onDrag: function () { gsap.set(c, { rotationY: this.x / -16, rotationZ: this.x / 38 }); },
        onRelease: function () {
          if (i !== S.i) return;
          var x = this.x, v = InertiaPlugin.getVelocity(c, 'x');
          if ((x < -80 || v < -700) && S.i < S.exos.length - 1) aller(S.i + 1);
          else if ((x > 80 || v > 700) && S.i > 0) aller(S.i - 1);
          else gsap.to(c, { x: 0, rotationY: 0, rotationZ: 0, duration: .6, ease: E.sortie });
        } })[0]);
    });
    placer(false); majSegments(false); majTitre(); majActions(false);
  }
  function htmlCarte(e, i) {
    var N = S.exos.length, tete = '<div class="xc-tete"><span class="etiq">' + e.bloc + '</span><span class="xc-n">' + pad(i + 1) + ' / ' + pad(N) + '</span></div>';
    if (e.type === 'circuit') {
      var f1 = '<div class="face f1">' + tete + '<div class="circ-big">' + e.format + '</div><div class="circ-min">' + e.minutes + '<i>minutes</i></div>' +
        '<p class="circ-texte">' + e.texte + '</p><ul class="circ-liste">' + e.points.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul><span class="xc-ghost" aria-hidden="true">' + pad(e.minutes) + '</span></div>';
      var f2 = '<div class="face f2"><div class="xc-tete"><span class="etiq">' + e.format + ' · les exercices</span><span class="xc-n">' + pad(i + 1) + ' / ' + pad(N) + '</span></div>' +
        '<h2 class="xc-nom">' + (e.format === 'AMRAP' ? 'Un tour, dans l’ordre' : 'Une minute, un exercice') + '</h2>' +
        '<ul class="circ-exos">' + e.items.map(function (it) { return '<li><span class="q">' + it.q + '</span><span class="t">' + it.n + '<small>' + it.s + '</small></span><a class="xc-video" href="' + yt(it.n) + '" target="_blank" rel="noopener" aria-label="Vidéo : ' + it.n + '">' + PLAY + '</a></li>'; }).join('') + '</ul>' +
        '<p class="xc-note"><b>Prêt ?</b> Un compte à rebours de 10 s précède le départ, il n’est pas compté.</p></div>';
      return f1 + f2 + '<div class="voile"></div>';
    }
    var meta = e.type === 'temps' ? e.series + ' séries · ' + e.dur + ' s' : e.series + ' séries · ' + e.reps + (e.parJambe ? ' par jambe' : ' reps') + ' · ' + e.kg + ' kg';
    var rows = e.sets.map(function (s, k) { return '<li><button class="serie" data-k="' + k + '"><span class="sn">' + (k + 1) + '</span><span class="sv"></span><span class="se"></span></button></li>'; }).join('');
    return '<div class="face f1">' + tete + '<h2 class="xc-nom">' + e.nom + '</h2>' +
      '<div class="xc-meta"><span>' + meta + '</span><a class="xc-video" href="' + yt(e.nom) + '" target="_blank" rel="noopener">' + PLAY + 'Vidéo</a></div>' +
      '<ul class="series">' + rows + '</ul><span class="xc-ghost" aria-hidden="true">' + pad(i + 1) + '</span><p class="xc-termine">' + CHECK + 'Exercice terminé</p>' +
      '<p class="xc-note"><b>Coach</b> · ' + e.note + (e.prec ? '<br><span style="opacity:.8">' + e.prec + '</span>' : '') + '</p></div><div class="voile"></div>';
  }
  function serieCourante(e) { for (var k = 0; k < e.sets.length; k++) if (!e.sets[k].fait) return k; return -1; }
  function valHtml(e, s) {
    return e.type === 'temps' ? s.dur + '<i>s</i>' : s.reps + '<em>×</em>' + s.kg + '<i>kg</i>';
  }
  function majRows(i) {
    var e = S.exos[i], c = S.cartes[i]; if (e.type === 'circuit') return;
    var cur = serieCourante(e);
    $$('.serie', c).forEach(function (b, k) {
      var s = e.sets[k];
      b.className = 'serie' + (s.fait ? ' fait' : '') + (k === cur ? ' cur' : '');
      $('.sv', b).innerHTML = valHtml(e, s);
      $('.se', b).innerHTML = s.fait ? CHECK : '';
    });
    c.classList.toggle('fini', cur < 0);
  }

  /* ================= LE PAQUET ================= */
  /* Place chaque carte selon son rang : devant, puis empilées derrière (plus petites, plus sombres). */
  function placer(anime) {
    S.cartes.forEach(function (c, i) {
      var rel = i - S.i, p = REX.poseRel(rel), v = $('.voile', c);
      var cible = { x: p.x, y: p.y, z: p.z, rotationX: p.rotationX, rotationY: p.rotationY, rotationZ: p.rotationZ, autoAlpha: p.autoAlpha };
      c.style.pointerEvents = rel === 0 ? 'auto' : 'none';
      c.style.zIndex = 20 - Math.abs(rel);
      c.classList.toggle('arriere', rel > 0);
      if (!anime) { gsap.set(c, cible); gsap.set(v, { opacity: p.voile }); return; }
      if (REDUIT) { gsap.to(c, { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, autoAlpha: rel === 0 ? 1 : 0, duration: .25, overwrite: 'auto' }); return; }
      gsap.set(c, { willChange: 'transform' });
      gsap.to(c, Object.assign({ duration: rel < 0 ? .62 : .95, ease: rel < 0 ? 'power3.out' : E.sortie, delay: rel > 0 ? .04 * rel : 0, overwrite: 'auto',
        onComplete: function () { c.style.willChange = ''; } }, cible));
      gsap.to(v, { opacity: p.voile, duration: .7, ease: E.sortie, overwrite: 'auto' });
    });
  }
  function aller(i) {
    if (i < 0 || i >= S.exos.length || S.occupe) return;
    S.occupe = true; S.i = i; REX.vibrer(10);
    placer(true); majSegments(true); majTitre(); majActions(true);
    gsap.delayedCall(.55, function () { S.occupe = false; });
  }
  function majSegments(anime) {
    $$('#segments i').forEach(function (s, i) {
      var e = S.exos[i], p;
      if (e.type === 'circuit') p = e.fait ? 1 : 0; else p = e.sets.filter(function (x) { return x.fait; }).length / e.sets.length;
      s.classList.toggle('cur', i === S.i);
      gsap.to($('b', s), { scaleX: p, duration: anime ? d(.6) : 0, ease: E.sortie });
    });
  }
  function majTitre() { var e = S.exos[S.i]; $('#s-titre').textContent = e.bloc + (e.type === 'circuit' ? '' : ' · ' + (S.i + 1) + '/' + S.exos.length); }

  /* ================= BOUTON PRINCIPAL ================= */
  function dernierExo() { return S.i === S.exos.length - 1; }
  function majActions(anime) {
    var e = S.exos[S.i], c = S.cartes[S.i], t, mode, second = false;
    if (e.type === 'circuit') {
      if (e.fait) { mode = 'suivant'; }
      else if (!c._verso) { t = 'Voir les exercices'; mode = 'voir'; }
      else { t = 'Lancer l’' + e.format; mode = 'lancer'; second = true; }
    } else {
      var k = serieCourante(e);
      if (k < 0) mode = 'suivant';
      else if (e.type === 'temps') { t = 'Lancer la série · ' + e.sets[k].dur + ' s'; mode = 'lancer-s'; }
      else { t = 'Valider la série ' + (k + 1) + ' sur ' + e.sets.length; mode = 'valider'; }
    }
    if (mode === 'suivant') t = dernierExo() ? 'Terminer la séance' : 'Exercice suivant';
    S.mode = mode;
    var tx = $('#btn-principal-t');
    if (tx.textContent !== t) {
      tx.textContent = t;
      if (anime && !REDUIT) gsap.fromTo(tx, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: E.sortie });
    }
    var s = $('#btn-second');
    if (s.hidden === second) { s.hidden = !second; if (second && !REDUIT) gsap.fromTo(s, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: .5, ease: E.sortie }); }
  }
  function clicPrincipal() {
    if (S.occupe) return;
    var btn = $('#btn-principal');
    switch (S.mode) {
      case 'valider': validerSerie(serieCourante(S.exos[S.i]), btn); break;
      case 'lancer-s': lancerSerieTemps(serieCourante(S.exos[S.i]), btn); break;
      case 'voir': retourner(true); break;
      case 'lancer': lancerCircuit(btn); break;
      case 'suivant': dernierExo() ? terminerSeance(btn) : aller(S.i + 1); break;
    }
  }
  function retourner(verso) {
    var c = S.cartes[S.i]; c._verso = verso;
    if (REDUIT) { gsap.to($('.f1', c), { rotationY: verso ? -180 : 0, duration: .01 }); gsap.to($('.f2', c), { rotationY: verso ? 0 : 180, duration: .01 }); majActions(true); return; }
    S.occupe = true; gsap.delayedCall(.9, function () { S.occupe = false; });
    gsap.to($('.f1', c), { rotationY: verso ? -180 : 0, duration: .95, ease: E.page });
    gsap.to($('.f2', c), { rotationY: verso ? 0 : 180, duration: .95, ease: E.page });
    gsap.timeline().to(c, { z: 90, duration: .45, ease: 'power2.out' }).to(c, { z: 0, duration: .55, ease: 'power2.inOut' });
    majActions(true);
  }

  /* ================= SÉRIE AGRANDIE ================= */
  function champsHtml(e, s) {
    function ch(cle, lab, val, unite) {
      return '<button class="champ" data-champ="' + cle + '"><span class="etiq">' + lab + '</span><span class="edit">Modifier</span><span class="valeur"><b>' + val + '</b>' + (unite ? '<i>' + unite + '</i>' : '') + '</span></button>';
    }
    return e.type === 'temps' ? ch('dur', 'Durée', s.dur, 's') : ch('reps', e.parJambe ? 'Répétitions par jambe' : 'Répétitions', s.reps, '') + ch('kg', 'Charge', s.kg, 'kg');
  }
  function ouvrirSerie(btn) {
    if (S.occupe || ovOuvert()) return;
    var e = S.exos[S.i], k = +btn.dataset.k, s = e.sets[k];
    S.serie = { e: e, k: k, src: btn };
    $('#os-etiq').textContent = 'Série ' + (k + 1) + ' sur ' + e.sets.length;
    $('#os-nom').textContent = e.nom;
    $('#os-champs').innerHTML = champsHtml(e, s);
    $('#os-prec').textContent = e.prec || '';
    majBoutonSerie();
    var ov = $('#o-serie');
    REX.reveler(ov, btn, { duree: .8, rayonFin: REX.RAYON, ease: E.page });
    if (!REDUIT) {
      gsap.to('#paquet', { scale: .94, z: -80, duration: .8, ease: E.page });
      gsap.fromTo(ov.children, { y: 36, opacity: 0, z: -120 }, { y: 0, opacity: 1, z: 0, duration: .8, stagger: .07, ease: E.sortie, delay: .3, clearProps: 'transform,opacity' });
    }
  }
  function majBoutonSerie() {
    var sr = S.serie; if (!sr) return;
    $('#os-valider').textContent = sr.e.sets[sr.k].fait ? 'Enregistrer' : (sr.e.type === 'temps' ? 'Lancer la série' : 'Valider la série');
  }
  function fermerSerie(sansAnim) {
    var ov = $('#o-serie'); if (ov.hidden) return;
    gsap.to('#paquet', { scale: 1, z: 0, duration: sansAnim ? 0 : .7, ease: E.page, clearProps: sansAnim ? 'transform' : '' });
    if (sansAnim) { gsap.killTweensOf(ov); ov.hidden = true; gsap.set(ov, { clearProps: 'all' }); }
    else REX.refermer(ov, S.serie && S.serie.src, { duree: .65 });
  }
  function initSerie() {
    $('#os-fermer').addEventListener('click', function () { fermerSerie(); });
    $('#os-champs').addEventListener('click', function (ev) {
      var b = ev.target.closest('.champ'); if (!b || !S.serie) return;
      var sr = S.serie, cle = b.dataset.champ, s = sr.e.sets[sr.k];
      var cfg = { reps: { min: 1, max: 60, pas: 1, unite: 'reps', etiq: 'Répétitions' }, kg: { min: 0, max: 200, pas: .5, unite: 'kg', etiq: 'Charge' }, dur: { min: 5, max: 300, pas: 5, unite: 's', etiq: 'Durée' } }[cle];
      ouvrirRoue(b, Object.assign({ valeur: s[cle], onValider: function (v) {
        s[cle] = v; majRows(S.i);
        var nb = $('b', b); nb.textContent = v;
        if (!REDUIT) gsap.fromTo(nb, { scale: 1.3, z: 60 }, { scale: 1, z: 0, duration: .7, ease: E.sortie, delay: .35 });
      } }, cfg));
    });
    $('#os-valider').addEventListener('click', function () {
      var sr = S.serie; if (!sr) return;
      if (sr.e.sets[sr.k].fait) { fermerSerie(); return; }
      if (sr.e.type === 'temps') lancerSerieTemps(sr.k, $('#os-valider'));
      else validerSerie(sr.k, $('#os-valider'));
    });
    $('#paquet').addEventListener('click', function (ev) {
      var b = ev.target.closest('.serie'); if (b && b.closest('.xcarte') === S.cartes[S.i]) ouvrirSerie(b);
    });
  }

  /* ================= GRAND SÉLECTEUR (roue 3D) ================= */
  var roue = { drag: null, items: [], vals: [], cur: -1, cfg: null, src: null, ouvert: false };
  var HI = 64;
  function fmt(v) { return (Math.round(v * 100) / 100).toString().replace('.', ','); }
  function ouvrirRoue(src, cfg) {
    var ov = $('#o-roue'), liste = $('#roue-liste'), box = $('#roue');
    roue.cfg = cfg; roue.src = src; roue.ouvert = true; roue.items = []; roue.vals = []; roue.cur = -1;
    $('#orr-etiq').textContent = cfg.etiq + ' · ' + S.serie.e.nom + ' · série ' + (S.serie.k + 1);
    $('#orr-unite').textContent = cfg.unite;
    var frag = document.createDocumentFragment();
    for (var v = cfg.min; v <= cfg.max + 1e-9; v = Math.round((v + cfg.pas) * 100) / 100) {
      var it = document.createElement('div'); it.className = 'ri'; it.textContent = fmt(v); it.dataset.i = roue.vals.length; frag.appendChild(it); roue.items.push(it); roue.vals.push(v);
    }
    liste.innerHTML = ''; liste.appendChild(frag);
    REX.reveler(ov, src, { duree: .75, rayonFin: REX.RAYON, ease: E.page });
    var n = roue.vals.length, hh = box.clientHeight;
    liste.style.top = (hh / 2 - HI / 2) + 'px';
    var i0 = 0; roue.vals.forEach(function (x, i) { if (Math.abs(x - cfg.valeur) < Math.abs(roue.vals[i0] - cfg.valeur)) i0 = i; });
    gsap.set(liste, { y: -i0 * HI });
    roue.drag = Draggable.create(liste, { type: 'y', trigger: box, inertia: true, bounds: { minY: -(n - 1) * HI, maxY: 0 }, edgeResistance: .8, minimumMovement: 3, zIndexBoost: false,
      snap: { y: function (y) { return Math.round(y / HI) * HI; } },
      onDrag: majRoue, onThrowUpdate: majRoue, onThrowComplete: majRoue })[0];
    majRoue(true);
    if (!REDUIT) gsap.fromTo(ov.children, { y: 30, opacity: 0, z: -140 }, { y: 0, opacity: 1, z: 0, duration: .8, stagger: .07, ease: E.sortie, delay: .3, clearProps: 'transform,opacity' });
  }
  function majRoue(silence) {
    var liste = $('#roue-liste'), y = gsap.getProperty(liste, 'y'), f = -y / HI, ci = Math.max(0, Math.min(roue.vals.length - 1, Math.round(f)));
    for (var i = Math.max(0, ci - 5); i <= Math.min(roue.vals.length - 1, ci + 5); i++) {
      var dd = i - f, a = Math.abs(dd);
      gsap.set(roue.items[i], { rotationX: -dd * 26, z: -a * 30, scale: 1 - Math.min(a, 3) * .08, opacity: Math.max(0, 1 - a * .3), color: '' });
    }
    if (ci !== roue.cur) {
      roue.cur = ci;
      var lec = $('#orr-val'); lec.textContent = fmt(roue.vals[ci]); lec.classList.toggle('long', lec.textContent.length > 3);
      if (silence !== true) { REX.vibrer(5); REX.bip(1500, .025, .035); }
    }
  }
  function fermerRoue(valider) {
    if (!roue.ouvert) return; roue.ouvert = false;
    var v = roue.vals[roue.cur];
    if (roue.drag) { roue.drag.kill(); roue.drag = null; }
    REX.refermer($('#o-roue'), roue.src, { duree: .65 });
    if (valider) roue.cfg.onValider(v);
  }
  function initRoue() {
    $('#orr-valider').addEventListener('click', function () { fermerRoue(true); });
    $('#orr-fermer').addEventListener('click', function () { fermerRoue(false); });
    $('#roue-liste').addEventListener('click', function (ev) {
      var it = ev.target.closest('.ri'); if (!it || (roue.drag && roue.drag.isDragging)) return;
      gsap.to('#roue-liste', { y: -(+it.dataset.i) * HI, duration: .5, ease: E.sortie, onUpdate: majRoue });
    });
    $('#roue').addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var y = gsap.getProperty('#roue-liste', 'y') - Math.sign(ev.deltaY) * HI;
      y = Math.max(-(roue.vals.length - 1) * HI, Math.min(0, Math.round(y / HI) * HI));
      gsap.to('#roue-liste', { y: y, duration: .3, ease: E.sortie, onUpdate: majRoue, overwrite: true });
    }, { passive: false });
  }

  /* ================= REPOS / TRAVAIL ================= */
  var R = { chrono: null, phase: '', ouvert: false, dernier: false, rester: false, fermeture: null };
  function fonds(ov, phase, instant) {
    ov.dataset.phase = phase;
    ['prep', 'travail', 'repos'].forEach(function (k) { gsap.to($('.f-' + k, ov), { opacity: k === phase ? 1 : 0, duration: instant ? 0 : .3, overwrite: true }); });
  }
  function flash(ov) { if (!REDUIT) gsap.fromTo($('.f-flash', ov), { opacity: .45 }, { opacity: 0, duration: .5, ease: 'power2.out' }); }
  function pulse(el) { if (!REDUIT) gsap.fromTo(el, { scale: 1.1 }, { scale: 1, duration: .45, ease: E.sortie }); }
  function srcFermeture() { return $('#btn-principal'); }

  function ouvrirChrono(src, phaseInitiale) {
    var ov = $('#o-repos'); if (R.ouvert) return;
    gsap.set('#anneau3d', { clearProps: 'transform' });
    fonds(ov, phaseInitiale, true);
    REX.reveler(ov, src, { duree: .8, rayonFin: 0 });
    if (!REDUIT) gsap.fromTo(['#o-repos .oc-haut', '#anneau3d', '#or-suite', '#or-bas'], { y: 40, opacity: 0, z: -220 }, { y: 0, opacity: 1, z: 0, duration: .9, stagger: .06, ease: E.sortie, delay: .35, clearProps: 'transform,opacity' });
    R.ouvert = true;
  }
  function phase(nom, ms, o) {
    var ov = $('#o-repos');
    R.phase = nom; fonds(ov, nom);
    $('#or-phase').textContent = nom === 'travail' ? 'Travail' : 'Repos';
    $('#or-sous').textContent = nom === 'travail' ? 'secondes de travail' : 'secondes de repos';
    $('#or-suite').innerHTML = o.suite || '';
    $('#or-plus').hidden = nom === 'travail';
    $('#or-passer').textContent = nom === 'travail' ? 'Terminer' : 'Passer';
    $('#or-rester').hidden = !(nom === 'repos' && R.dernier);
    $('#or-rester').textContent = 'Rester ici';
    if (R.chrono) R.chrono.stop();
    S.dernierSec = -1;
    var val = $('#a-val'), tmp = $('#or-temps');
    if (!REDUIT) gsap.fromTo('#or-suite', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: E.sortie });
    flash(ov);
    R.chrono = REX.chrono(ms, {
      onTick: function (reste, ec, total) {
        val.style.strokeDashoffset = (CIRC * (1 - reste / total)).toFixed(1);
        var s = Math.ceil(reste / 1000);
        if (s !== S.dernierSec) {
          S.dernierSec = s; tmp.textContent = REX.formatTemps(reste);
          if (s <= 3 && s > 0) { pulse(tmp); REX.bip(1000, .1, .14); REX.vibrer(20); flash(ov); }
        }
      },
      onFin: function () { o.onFin && o.onFin(); }
    });
  }
  function spin3d() {
    if (REDUIT) return;
    gsap.timeline().fromTo('#anneau3d', { rotationY: 0, scale: 1 }, { rotationY: 360, scale: 1.08, duration: 1.1, ease: 'expo.inOut' }).to('#anneau3d', { scale: 1, duration: .4, ease: E.sortie }, '-=.3');
  }
  /* Valider une série : la série se coche, le repos démarre. */
  function validerSerie(k, src) {
    if (S.occupe || k == null || k < 0) return;
    var e = S.exos[S.i], s = e.sets[k]; if (s.fait) return;
    s.fait = true; REX.vibrer(18);
    terminerSerie(e, k, src, false);
  }
  function terminerSerie(e, k, src, depuisTravail) {
    var panneau = !$('#o-serie').hidden;
    majRows(S.i); majSegments(true);
    var dernier = serieCourante(e) < 0;
    if (dernier) e.fait = true;
    R.dernier = dernier; R.rester = false;
    var suite;
    if (dernier) suite = '<small>Exercice terminé</small>' + (S.i < S.exos.length - 1 ? 'Ensuite : ' + S.exos[S.i + 1].nom : 'Bien joué');
    else { var nk = serieCourante(e); suite = '<small>Prochaine série</small>' + (nk + 1) + ' sur ' + e.sets.length + ' · ' + valTexte(e, e.sets[nk]); }
    if (!depuisTravail) ouvrirChrono(src, 'repos');
    phase('repos', e.repos * 1000, { suite: suite, onFin: finRepos });
    gsap.delayedCall(.85, function () { if (panneau) fermerSerie(true); majActions(true); });
  }
  function valTexte(e, s) { return e.type === 'temps' ? s.dur + ' s' : s.reps + ' × ' + s.kg + ' kg'; }
  /* Série au temps : le chrono de travail, bip à la fin, puis repos automatique. */
  function lancerSerieTemps(k, src) {
    if (S.occupe || k == null || k < 0) return;
    var e = S.exos[S.i], s = e.sets[k];
    R.dernier = false; R.rester = false;
    ouvrirChrono(src, 'travail');
    phase('travail', s.dur * 1000, {
      suite: '<small>' + e.nom + '</small>Série ' + (k + 1) + ' sur ' + e.sets.length,
      onFin: function () {
        REX.bip(520, .5, .2); REX.vibrer([60, 40, 60]); spin3d();
        s.fait = true;
        gsap.delayedCall(REDUIT ? .2 : .9, function () { terminerSerie(e, k, null, true); });
      }
    });
    gsap.delayedCall(.85, function () { fermerSerie(true); });
  }
  function finRepos() {
    REX.bip(880, .35, .18); REX.vibrer([40, 30, 40]); spin3d();
    gsap.delayedCall(REDUIT ? .1 : .85, fermerRepos);
  }
  function fermerRepos() {
    if (!R.ouvert) return; R.ouvert = false;
    if (R.chrono) R.chrono.stop();
    var avance = R.dernier && !R.rester;
    REX.refermer($('#o-repos'), srcFermeture(), { duree: .7 });
    if (avance && !dernierExo()) gsap.delayedCall(.3, function () { S.occupe = false; aller(S.i + 1); });
    else majActions(true);
  }
  function initRepos() {
    $('#or-plus').addEventListener('click', function () { if (R.chrono) { R.chrono.ajouter(15000); REX.bip(700, .06, .1); pulse('#or-temps'); } });
    $('#or-passer').addEventListener('click', function () {
      if (R.phase === 'travail') { if (R.chrono) R.chrono.ajouter(-R.chrono.reste()); return; }
      fermerRepos();
    });
    $('#or-quitter').addEventListener('click', function () { R.rester = true; fermerRepos(); });
    $('#or-rester').addEventListener('click', function () {
      R.rester = true; this.textContent = 'Tu restes sur cet exercice'; this.disabled = true; gsap.delayedCall(.6, function () { $('#or-rester').hidden = true; $('#or-rester').disabled = false; });
    });
  }

  /* ================= CIRCUITS : AMRAP / EMOM ================= */
  var C = { e: null, chrono: null, tours: 0, plus: 0, minute: 0, ouvert: false, phase: '' };
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  function lancerCircuit(src) {
    if (S.occupe) return;
    var e = S.exos[S.i], ov = $('#o-circuit'), amrap = e.format === 'AMRAP';
    C = { e: e, chrono: null, tours: 0, plus: 0, minute: 0, ouvert: true, phase: 'prep', amrap: amrap };
    $('#oci-phase').textContent = e.format + ' · ' + e.minutes + ' min';
    $('#oci-bilan').hidden = true;
    $('#oci-tour').hidden = !amrap; $('#oci-minutes').hidden = amrap;
    $('#oci-lab').textContent = amrap ? 'Tours' : 'Première minute'; $('#oci-tours').classList.toggle('txt', !amrap);
    $('#oci-tours').textContent = amrap ? '0' : e.minuteExo(1);
    if (!amrap) $('#oci-minutes').innerHTML = Array.apply(null, Array(e.minutes)).map(function (x, k) { return '<i>' + (k + 1) + '</i>'; }).join('');
    $('#oci-recette').textContent = e.items.map(function (x) { return x.q + ' ' + x.n.toLowerCase(); }).join(' · ');
    gsap.set('#oci-bandeau', { xPercent: -101 });
    gsap.set('#oci-barre', { scaleX: 1 });
    fonds(ov, 'prep', true);
    REX.reveler(ov, src, { duree: .85, rayonFin: 0 });
    if (!REDUIT) gsap.fromTo(['#o-circuit .oc-haut', '#oci-digits', '#oci-ligne', '#oci-milieu', '#oci-recette', C.amrap ? '#oci-tour' : '#oci-minutes'], { y: 40, opacity: 0, z: -200 }, { y: 0, opacity: 1, z: 0, duration: .9, stagger: .06, ease: E.sortie, delay: .35, clearProps: 'transform,opacity' });
    cPrep();
  }
  function cPrep() {
    var ov = $('#o-circuit'), dg = $('#oci-digits'); C.phase = 'prep'; fonds(ov, 'prep');
    $('#oci-ligne').textContent = 'Prépare-toi · départ dans…';
    var last = -1;
    gsap.set('#oci-barre', { scaleX: 1 });
    C.chrono = REX.chrono(10000, {
      onTick: function (reste, ec, total) {
        gsap.set('#oci-barre', { scaleX: reste / total });
        var s = Math.ceil(reste / 1000);
        if (s !== last) { last = s; dg.textContent = mmss(reste); if (s <= 3 && s > 0) { pulse(dg); flash(ov); REX.bip(900, .1, .14); REX.vibrer(20); } }
      },
      onFin: function () { REX.bip(1320, .45, .2); REX.vibrer(120); cTravail(); }
    });
  }
  function cTravail() {
    var ov = $('#o-circuit'), dg = $('#oci-digits'), e = C.e;
    C.phase = 'travail'; fonds(ov, 'travail'); flash(ov);
    var N = e.minutes, last = -1, derniere = -1;
    if (C.amrap) $('#oci-ligne').textContent = 'Fais le plus de tours possible';
    C.chrono = REX.chrono(N * 60000, {
      onTick: function (reste, ec, total) {
        gsap.set('#oci-barre', { scaleX: reste / total });
        var s, shown;
        if (C.amrap) { s = Math.ceil(reste / 1000); shown = reste; }
        else {
          var m = Math.min(N, Math.floor(ec / 60000) + 1);
          if (m !== C.minute) { C.minute = m; emomMinute(m); }
          shown = 60000 - (ec % 60000); if (reste <= 0) shown = 0; s = Math.ceil(shown / 1000);
        }
        if (s !== last) {
          last = s; dg.textContent = mmss(shown);
          if (s <= 3 && s > 0) { pulse(dg); flash(ov); REX.bip(1000, .1, .14); REX.vibrer(20); }
        }
      },
      onFin: function () { REX.bip(660, .7, .22); REX.vibrer([100, 50, 100]); cBilan(); }
    });
  }
  function emomMinute(m) {
    var ov = $('#o-circuit'), e = C.e, N = e.minutes;
    $('#oci-lab').textContent = 'Cette minute'; $('#oci-ligne').textContent = 'Minute ' + m + ' sur ' + N;
    $('#oci-tours').textContent = e.minuteExo(m);
    $$('#oci-minutes i').forEach(function (x, k) { x.className = k + 1 < m ? 'fait' : (k + 1 === m ? 'cur' : ''); });
    if (!REDUIT) gsap.fromTo('#oci-tours', { y: 24, opacity: 0, z: -120 }, { y: 0, opacity: 1, z: 0, duration: .6, ease: E.sortie });
    $('#oci-recette').textContent = m < N ? 'Ensuite : ' + e.minuteSuite(m) : 'Dernière minute, tout donner !';
    var impair = m % 2 === 1; fonds(ov, impair ? 'travail' : 'repos');
    if (m > 1) { REX.bip(1100, .2, .16); REX.vibrer(60); bandeau('Minute ' + m); }
  }
  function bandeau(txt) {
    var b = $('#oci-bandeau'); $('span', b).textContent = txt;
    if (REDUIT) { gsap.fromTo(b, { xPercent: 0, opacity: 0 }, { opacity: 1, duration: .15, yoyo: true, repeat: 1, repeatDelay: .5 }); return; }
    gsap.timeline().set(b, { xPercent: -101, opacity: 1 }).to(b, { xPercent: 0, duration: .25, ease: 'expo.out' }).to(b, { xPercent: 101, duration: .35, ease: 'power3.out' }, '+=.45');
  }
  function cBilan() {
    var bl = $('#oci-bilan'), e = C.e; C.phase = 'bilan';
    if (C.amrap) {
      $('#ob-titre').textContent = C.tours + (C.tours > 1 ? ' tours' : ' tour');
      $('#ob-p').textContent = 'Combien de répétitions en plus dans le tour commencé ?';
      $('.stepper', bl).hidden = false; C.plus = 0; $('#ob-val').textContent = '0'; $('#ob-valider').textContent = 'Valider le résultat';
    } else {
      $('#ob-titre').textContent = e.minutes + ' / ' + e.minutes;
      $('#ob-p').textContent = 'Toutes les minutes sont faites. Belle régularité !';
      $('.stepper', bl).hidden = true; $('#ob-valider').textContent = 'Terminer le circuit';
    }
    REX.reveler(bl, $('#oci-digits'), { duree: .8, rayonFin: 0, ease: E.page });
    if (!REDUIT) gsap.fromTo(bl.children, { y: 40, opacity: 0, z: -220 }, { y: 0, opacity: 1, z: 0, duration: .9, stagger: .07, ease: E.sortie, delay: .3, clearProps: 'transform,opacity' });
  }
  function fermerCircuit(valide) {
    if (!C.ouvert) return; C.ouvert = false;
    if (C.chrono) C.chrono.stop();
    var e = C.e;
    if (valide) { e.fait = true; e.resultat = { tours: C.tours, plus: C.plus }; }
    majSegments(true);
    var dernierE = dernierExo();
    REX.refermer($('#o-circuit'), srcFermeture(), { duree: .75, onEnd: function () { $('#oci-bilan').hidden = true; } });
    if (valide && !dernierE) gsap.delayedCall(.35, function () { S.occupe = false; aller(S.i + 1); });
    else majActions(true);
  }
  function initCircuit() {
    $('#oci-tour').addEventListener('click', function () {
      if (C.phase !== 'travail') return;
      C.tours++; var t = $('#oci-tours'); t.textContent = C.tours; REX.bip(560 + C.tours * 20, .08, .14); REX.vibrer(18);
      if (!REDUIT) gsap.fromTo(t, { scale: 1.25 }, { scale: 1, duration: .4, ease: E.sortie });
    });
    $('#ob-moins').addEventListener('click', function () { C.plus = Math.max(0, C.plus - 1); $('#ob-val').textContent = C.plus; });
    $('#ob-plus').addEventListener('click', function () { C.plus++; $('#ob-val').textContent = C.plus; pulse('#ob-val'); });
    $('#ob-valider').addEventListener('click', function () { fermerCircuit(true); });
    $('#oci-quitter').addEventListener('click', function () { fermerCircuit(false); });
  }

  /* ================= TIROIR (overview à tout moment) ================= */
  var tiroirDrag = null;
  function ouvrirTiroir() {
    if (S.tiroir || ovOuvert()) return; S.tiroir = true;
    var li = $('#ti-liste');
    li.innerHTML = S.exos.map(function (e, i) {
      var fait = e.type === 'circuit' ? e.fait : serieCourante(e) < 0;
      var txt = e.type === 'circuit' ? e.format + ' · ' + e.minutes + ' min' : (e.type === 'temps' ? e.series + ' × ' + e.dur + ' s' : e.series + ' × ' + e.reps + ' · ' + e.kg + ' kg');
      return '<li><button class="ti-i' + (fait ? ' fait' : '') + (i === S.i ? ' cur' : '') + '" data-i="' + i + '"><span class="tn">' + (fait ? CHECK : i + 1) + '</span><span class="tt">' + e.nom + '<small>' + txt + '</small></span></button></li>';
    }).join('');
    var tr = $('#tiroir'), sc = $('#scrim-tiroir');
    tr.style.visibility = 'visible'; sc.style.pointerEvents = 'auto';
    gsap.set(tr, { xPercent: 105, x: 0 });
    gsap.to(sc, { opacity: .6, duration: .5, ease: E.sortie });
    gsap.to(tr, { xPercent: 0, duration: .65, ease: E.vaul });
    if (!REDUIT) {
      gsap.to(['#paquet', '#actions'], { x: -34, scale: .95, duration: .65, ease: E.vaul });
      gsap.fromTo($$('.ti-i', tr), { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: .6, stagger: .04, ease: E.sortie, delay: .12 });
    }
    tiroirDrag = Draggable.create(tr, { type: 'x', trigger: tr, bounds: { minX: 0, maxX: 360 }, zIndexBoost: false, minimumMovement: 8,
      onRelease: function () { if (this.x > 90 || InertiaPlugin.getVelocity(tr, 'x') > 500) fermerTiroir(); else gsap.to(tr, { x: 0, duration: .4, ease: E.vaul }); } })[0];
  }
  function fermerTiroir(cb) {
    if (!S.tiroir) return; S.tiroir = false;
    var tr = $('#tiroir'), sc = $('#scrim-tiroir');
    if (tiroirDrag) { tiroirDrag.kill(); tiroirDrag = null; }
    gsap.to(sc, { opacity: 0, duration: .45, ease: E.sortie, onComplete: function () { sc.style.pointerEvents = 'none'; } });
    gsap.to(tr, { xPercent: 105, x: 0, duration: .55, ease: E.vaul, onComplete: function () { tr.style.visibility = 'hidden'; cb && cb(); } });
    gsap.to(['#paquet', '#actions'], { x: 0, scale: 1, duration: .55, ease: E.vaul, clearProps: 'transform' });
  }
  function initTiroir() {
    $('#tab-tiroir').addEventListener('click', ouvrirTiroir);
    $('#ti-fermer').addEventListener('click', function () { fermerTiroir(); });
    $('#scrim-tiroir').addEventListener('click', function () { fermerTiroir(); });
    $('#ti-liste').addEventListener('click', function (ev) {
      var b = ev.target.closest('.ti-i'); if (!b) return;
      var i = +b.dataset.i; fermerTiroir(function () { if (i !== S.i) aller(i); });
    });
  }
  function ovOuvert() { return $$('#seance .ov').some(function (o) { return !o.hidden; }) || S.tiroir; }

  /* ================= FIN DE SÉANCE ================= */
  function terminerSeance(src) {
    REX.ouvrirCarte(src, 'e-fin', { teinte: 'accent' });
  }
  function stats() {
    var vol = 0, series = 0, rec = null;
    S.exos.forEach(function (e) {
      if (e.type === 'circuit') return;
      e.sets.forEach(function (s) {
        if (!s.fait) return; series++;
        if (e.type === 'charge') vol += s.reps * s.kg * (e.parJambe ? 2 : 1);
      });
      if (e.id === 'gob') { var best = e.sets.filter(function (s) { return s.fait; }).sort(function (a, b) { return b.kg - a.kg; })[0]; if (best && best.kg > 14) rec = { n: 'Goblet squat', p: fmt(best.kg) + ' kg × ' + best.reps }; }
    });
    var ms = Math.max(H.now() - S.debut, 49 * 60000 + 12000);  // démo : durée plancher réaliste
    return { vol: vol, series: series, rec: rec, ms: ms };
  }
  REX.PAGES['e-fin'] = {
    init: function () {
      $('#btn-valider-seance').addEventListener('click', function () {
        REX.retourRacine('#c-aujourdhui', function () { REX.PAGES['e-dash'].apresSeance(); });
      });
    },
    avant: function () {
      var st = stats();
      $('#f-duree').textContent = '0:00'; $('#f-volume').textContent = '0'; $('#f-series').textContent = '0';
      $('#f-record').textContent = st.rec ? st.rec.n : 'Régularité'; $('#f-record-p').textContent = st.rec ? st.rec.p : 'Séance complète';
      $('#fin-mot').value = '';
      REX.PAGES['e-fin']._st = st;
    },
    entrer: function (page) {
      var st = REX.PAGES['e-fin']._st;
      var tuiles = $$('.tuile', page), titre = $('#fin-titre');
      var go = function () {
        REX.compter($('#f-duree'), st.ms, { duree: 1.8, delai: .5, format: function (v) { var m = Math.floor(v / 60000), s = Math.floor(v / 1000) % 60; return m + ':' + pad(s); } });
        REX.compter($('#f-volume'), st.vol, { duree: 1.8, delai: .6, format: function (v) { return Math.round(v).toLocaleString('fr-FR'); } });
        REX.compter($('#f-series'), st.series, { duree: 1.4, delai: .7 });
        REX.bip(523, .12, .12); setTimeout(function () { REX.bip(659, .12, .12); }, 120); setTimeout(function () { REX.bip(784, .3, .12); }, 240);
        REX.vibrer([40, 40, 40]);
      };
      if (REDUIT) { gsap.fromTo(page.querySelector('.fin'), { opacity: 0 }, { opacity: 1, duration: .3 }); go(); return; }
      gsap.fromTo('#fin-badge', { rotationY: -200, scale: .3, z: -400, opacity: 0 }, { rotationY: 0, scale: 1, z: 0, opacity: 1, duration: 1.3, ease: E.sortie, delay: .1 });
      gsap.fromTo(titre, { y: 60, z: -300, opacity: 0, rotationX: -30 }, { y: 0, z: 0, opacity: 1, rotationX: 0, duration: 1.1, ease: E.sortie, delay: .25, clearProps: 'transform' });
      gsap.fromTo(tuiles, { z: -420, y: 120, rotationX: 35, rotationY: function (i) { return i % 2 ? 25 : -25; }, opacity: 0 }, { z: 0, y: 0, rotationX: 0, rotationY: 0, opacity: 1, duration: 1.1, stagger: .09, ease: E.sortie, delay: .4, clearProps: 'transform' });
      gsap.fromTo('.fin-mot, #btn-valider-seance', { y: 50, opacity: 0, z: -150 }, { y: 0, opacity: 1, z: 0, duration: .9, stagger: .1, ease: E.sortie, delay: .85, clearProps: 'transform' });
      gsap.delayedCall(.3, go);
      gsap.delayedCall(.5, function () { REX.confettis($('#confettis'), 34); });
    }
  };

  /* ================= PAGE SÉANCE : entrée / sortie ================= */
  function lierWake(on) {
    try {
      if (on && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { S.wake = w; }).catch(function () {});
      else if (!on && S.wake) { S.wake.release(); S.wake = null; }
    } catch (e) {}
  }
  function nettoyer() {
    if (R.chrono) R.chrono.stop(); if (C.chrono) C.chrono.stop();
    R.ouvert = false; C.ouvert = false;
    if (roue.drag) { roue.drag.kill(); roue.drag = null; roue.ouvert = false; }
    if (tiroirDrag) { tiroirDrag.kill(); tiroirDrag = null; }
    S.tiroir = false; gsap.ticker.remove(S.tick); S.tick = null; lierWake(false);
    $$('#seance .ov').forEach(function (o) { o.hidden = true; gsap.set(o, { clearProps: 'all' }); });
    gsap.set(['#paquet', '#actions'], { clearProps: 'transform' });
  }
  REX.PAGES['e-seance'] = {
    init: function () {
      initSerie(); initRoue(); initRepos(); initCircuit(); initTiroir();
      $('#btn-principal').addEventListener('click', clicPrincipal);
      $('#btn-second').addEventListener('click', function () { retourner(false); });
      $('#s-fermer').addEventListener('click', function () { REX.fermerCarte(); });
      $('#btn-demarrer').addEventListener('click', function () { REX.ouvrirCarte(this, 'e-seance'); });
    },
    avant: function () {
      nettoyer(); nouvelleSeance();
      gsap.set('#seance', { opacity: 0 });
      lierWake(true);
    },
    entrer: function () {
      gsap.set('#seance', { opacity: 1 });
      var last = '';
      S.tick = function () { var t = REX.formatTemps(H.now() - S.debut); if (t !== last) { last = t; $('#s-temps').textContent = t; } };
      gsap.ticker.add(S.tick);
      if (REDUIT) return;
      gsap.from('.s-haut', { y: -30, opacity: 0, duration: .8, ease: E.sortie, delay: .1 });
      gsap.from('#actions', { y: 70, opacity: 0, z: -200, duration: .9, ease: E.sortie, delay: .5 });
      gsap.from('#tab-tiroir', { x: 30, duration: .7, ease: E.sortie, delay: .8 });
      S.cartes.slice(0, 4).forEach(function (c, i) {
        var p = REX.poseRel(i);
        gsap.from(c, { z: p.z - 420, y: p.y + 140, rotationX: 28, autoAlpha: 0, duration: 1.15, ease: E.sortie, delay: .22 + i * .1 });
      });
    },
    sortie: function () { nettoyer(); }
  };
  REX.surEscape = function () {
    if (roue.ouvert) { fermerRoue(false); return true; }
    if (!$('#o-serie').hidden) { fermerSerie(); return true; }
    if (S.tiroir) { fermerTiroir(); return true; }
    return false;
  };
  REX.PAGES['e-quiz'].init = REX.initQuiz;
})();
