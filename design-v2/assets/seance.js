/* Maquette V2 — la séance : UNE PAGE ENTIÈRE par exercice (lisibilité M1), glissement entre exercices (M2),
   ligne -> série (M1), valeur -> grand sélecteur glissant (M1, tel quel), chrono : décompte en roulette + petite
   phrase (M2), son de fin (M1), temps total en haut (M4). Les circuits sont dans circuit.js.
   Fonctions de transition : ouvrirSeance, allerEtape, ouvrirSerie / fermerSerie, Selecteur.ouvrir / valider,
   Chrono (ouvrir / phase / fermer), proposerSuite, ouvrirTiroir / fermerTiroir, finir. */
(function () {
  'use strict';
  var REX = window.REX, $ = REX.$, $$ = REX.$$, E = REX.E, T = REX.T, REDUIT = REX.REDUIT, H = REX.horloge, DATA = REX.DATA;
  var P = function () { return REX.PHRASES; };
  var ec = $('#e-seance');
  var S = REX.seance = {};
  var st = null, serieOuverte = null, chrono = null, tiroirOuvert = false, toast = null;
  var CHECK = '<svg class="ic"><use href="#i-check"/></svg>';
  var etapes = DATA.etapes;
  var exo = function (i) { return DATA.exos[etapes[i].id]; };
  var W = function () { return $('#pv').clientWidth; };

  function nouvelEtat() {
    return {
      i: 0, debut: H.now(), volume: 0, nbSeries: 0, fait: etapes.map(function () { return false; }), vu: {},
      series: etapes.map(function (e) { var x = DATA.exos[e.id]; return x.type === 'circuit' ? null : Array.from({ length: x.series }, function () { return { fait: false, reps: x.reps, kg: x.kg, dur: x.dur }; }); }),
      resultats: {}
    };
  }
  var courante = function (i) { return st.series[i] ? st.series[i].findIndex(function (s) { return !s.fait; }) : -1; };

  /* ================================================================ Construction des pages */
  function valHTML(x, s) {
    return x.type === 'temps' ? '<b>' + s.dur + '</b><small>s</small>' : '<b>' + s.reps + '</b><i>×</i><b>' + REX.fr(s.kg) + '</b><small>kg</small>';
  }
  function rangHTML(i, k) {
    var x = exo(i), s = st.series[i][k], cur = courante(i);
    var cls = 'rang ' + (s.fait ? 'fait' : k === cur ? 'courant' : 'avenir');
    return '<button class="' + cls + '" data-s="' + k + '" aria-label="Série ' + (k + 1) + ' : ' + (x.type === 'temps' ? s.dur + ' secondes' : s.reps + ' répétitions à ' + s.kg + ' kilos') + (s.fait ? ', faite' : '') + '">' +
      '<span class="rg-n">' + (k + 1) + '</span><span class="rg-v">' + valHTML(x, s) + '</span><span class="rg-e">' + CHECK + '</span></button>';
  }
  function libelleAction(i) {
    var x = exo(i), cur = courante(i);
    if (cur < 0) return i === etapes.length - 1 ? 'Terminer la séance' : 'Exercice suivant';
    return x.type === 'temps' ? 'Lancer la série ' + (cur + 1) : 'Valider la série ' + (cur + 1);
  }
  function enteteBloc(e) {
    if (e.bloc.circuit) return e.bloc.option ? 'Option · facultatif' : e.bloc.nom + ' · circuit';
    return e.bloc.nom + (e.nb > 1 ? ' · ' + e.rang + ' sur ' + e.nb : '');
  }
  function panelExo(i) {
    var x = exo(i), e = etapes[i];
    var meta = x.type === 'temps'
      ? '<span><b>' + x.series + ' × ' + x.dur + '</b> s</span><span>repos <b>' + REX.mmss(x.repos) + '</b></span>'
      : '<span><b>' + x.series + ' × ' + x.reps + '</b> ' + (x.parJambe ? 'par jambe' : 'reps') + '</span><span><b>' + REX.fr(x.kg) + '</b> kg</span><span>repos <b>' + REX.mmss(x.repos) + '</b></span>';
    return '<article class="panel" data-i="' + i + '">' +
      '<div class="p-tete"><span class="p-bloc">' + enteteBloc(e) + '</span><a class="p-video" href="' + REX.youtube(x.video) + '" target="_blank" rel="noopener"><svg class="ic"><use href="#i-play"/></svg>Vidéo</a></div>' +
      '<h2 class="p-nom">' + x.nom + '</h2>' +
      '<div class="p-meta">' + meta + '</div>' +
      (x.prec ? '<p class="p-prec">Dernière fois · <b>' + x.prec + '</b></p>' : '') +
      '<p class="p-note">' + x.note + '</p>' +
      '<div class="rangs">' + st.series[i].map(function (_, k) { return rangHTML(i, k); }).join('') + '</div>' +
      '<div class="p-action"><button class="btn btn-prim gros" data-act="action">' + libelleAction(i) + '</button></div></article>';
  }
  REX.panelCircuitHTML = function (i) {
    var c = exo(i), e = etapes[i], r = st.resultats[c.id];
    var actions;
    if (r) actions = '<button class="btn btn-prim gros" data-act="suivant">' + (i === etapes.length - 1 ? 'Terminer la séance' : 'Exercice suivant') + '</button>';
    else if (c.option) actions = '<button class="btn btn-prim gros" data-act="circuit">Faire l’option<svg class="ic"><use href="#i-fleche"/></svg></button><button class="btn btn-sec" data-act="sans-option">Terminer sans l’option</button>';
    else actions = '<button class="btn btn-prim gros" data-act="circuit">Découvrir le circuit<svg class="ic"><use href="#i-fleche"/></svg></button>';
    var res = r ? '<div class="p-resultat">' + CHECK + '<span><b>' + r.titre + '</b>' + r.sous + '</span></div>' : '';
    return '<article class="panel panel-circuit' + (c.option ? ' panel-option' : '') + (r ? ' fait' : '') + '" data-i="' + i + '">' +
      '<div class="p-tete"><span class="p-bloc">' + enteteBloc(e) + '</span><span class="tag-format">' + c.format + '</span></div>' +
      '<h2 class="p-nom p-nom-circuit">' + c.format + '<br><span>' + c.minutes + ' minutes</span></h2>' +
      '<p class="p-note p-but">' + (c.option ? c.note : c.but) + '</p>' +
      REX.circuitDetailHTML(c) + res +
      '<div class="p-action">' + actions + '</div></article>';
  };
  function construire() {
    $('#segs').innerHTML = etapes.map(function () { return '<i><b></b></i>'; }).join('');
    $('#piste').innerHTML = etapes.map(function (e, i) { return exo(i).type === 'circuit' ? REX.panelCircuitHTML(i) : panelExo(i); }).join('');
    renderTiroir();
  }
  S.majPanel = function (i) {
    var vieux = $('.panel[data-i="' + i + '"]'), tmp = document.createElement('div');
    tmp.innerHTML = exo(i).type === 'circuit' ? REX.panelCircuitHTML(i) : panelExo(i);
    tmp.firstChild.inert = i !== st.i; vieux.replaceWith(tmp.firstChild);
    majSegments(); renderTiroir();
    return $('.panel[data-i="' + i + '"]');
  };
  S.etat = function () { return st; };

  /* ================================================================ Ouverture (M1 : la page naît de l'élément touché) */
  var ticker = null;
  function majTotal() {
    if (!st) return;
    var t = REX.mmss((H.now() - st.debut) / 1000);
    var a = $('#se-total'); if (a.textContent !== t) a.textContent = t;
    $$('.ch-total-v', ec).forEach(function (b) { if (b.textContent !== t) b.textContent = t; });
  }
  REX.ouvrirSeance = function (src, depart) {
    if (REX.estOccupe()) return;
    REX.setOccupe(true);
    st = nouvelEtat(); construire();
    st.i = depart || 0;
    var page = ec; page.hidden = false; REX.empiler(page);
    gsap.set('#piste', { x: -st.i * W() });
    $$('.panel').forEach(function (p, k) { p.inert = k !== st.i; gsap.set(p, { scale: k === st.i ? 1 : .92, opacity: k === st.i ? 1 : .35 }); });
    majSegments(true); majTitre();
    if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(function () {});
    if (!ticker) { ticker = function () { majTotal(); }; gsap.ticker.add(ticker); }
    var cible = $('.panel[data-i="' + st.i + '"]'); st.vu[st.i] = true;
    var entree = [$('#se-haut')].concat($$('.panel[data-i="' + st.i + '"] > *'));
    var fin = function () { gsap.set(page, { clearProps: 'clipPath,opacity' }); REX.setOccupe(false); var b = $('[data-act]', cible); b && b.focus({ preventScroll: true }); };
    if (REDUIT || !src) {
      gsap.timeline({ onComplete: fin }).fromTo(page, { opacity: 0 }, { opacity: 1, duration: .25 }).fromTo(entree, { opacity: 0 }, { opacity: 1, duration: .2 }, 0);
      return;
    }
    // 1. la page s'ouvre en clip-path depuis le rectangle touché ; 2. un voile de sa couleur (avec son clone) se relève ;
    // 3. le contenu monte en cascade (M1 « transitions au démarrage »).
    var box = page.getBoundingClientRect(), q = src.getBoundingClientRect(), cs = getComputedStyle(src);
    var v = document.createElement('div'); v.className = 'voile';
    v.style.background = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : 'var(--surface)';
    var c = src.cloneNode(true); c.removeAttribute('id');
    c.style.cssText = 'position:absolute;margin:0;transform:none;left:' + (q.left - box.left) + 'px;top:' + (q.top - box.top) + 'px;width:' + q.width + 'px;height:' + q.height + 'px;border-radius:' + cs.borderRadius + ';color:' + cs.color;
    v.appendChild(c); page.appendChild(v);
    gsap.set(entree, { opacity: 0 });
    var r = 'round ' + (parseFloat(cs.borderRadius) || 22) + 'px';
    gsap.timeline({ onComplete: function () { v.remove(); fin(); } })
      .fromTo(page, { clipPath: 'inset(' + (q.top - box.top) + 'px ' + (box.right - q.right) + 'px ' + (box.bottom - q.bottom) + 'px ' + (q.left - box.left) + 'px ' + r + ')' },
        { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: T.page, ease: E.page }, 0)
      .to(c, { opacity: 0, duration: .25 }, .2)
      .fromTo(v, { clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: 'inset(0px 0px ' + box.height + 'px 0px)', duration: .62, ease: E.page }, T.page * .46)
      .fromTo(entree, { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .06, ease: E.sortie, clearProps: 'transform,opacity' }, T.page * .42);
  };
  function fermerSeance(cb) {
    stopperTout();
    REX.setOccupe(true);
    var page = ec, src = $('#btn-demarrer');
    var fin = function () { page.hidden = true; gsap.set(page, { clearProps: 'all' }); REX.depiler(page); REX.setOccupe(false); if (ticker) { gsap.ticker.remove(ticker); ticker = null; } cb && cb(); };
    if (REDUIT || !src || !src.offsetParent) { gsap.to(page, { opacity: 0, duration: .22, onComplete: fin }); return; }
    var box = page.getBoundingClientRect(), q = src.getBoundingClientRect();
    gsap.to(page, { clipPath: 'inset(' + (q.top - box.top) + 'px ' + (box.right - q.right) + 'px ' + (box.bottom - q.bottom) + 'px ' + (q.left - box.left) + 'px round 22px)', duration: .55, ease: E.fermer, onComplete: fin });
  }
  function stopperTout() {
    if (chrono) { chrono.stop(); chrono = null; }
    if (toast) { toast.kill(); toast = null; $('#toast-suite').hidden = true; }
    ['#sc-serie', '#sc-sel', '#sc-chrono', '#sc-circuit'].forEach(function (s) { var el = $(s); el.hidden = true; el.innerHTML = ''; gsap.set(el, { clearProps: 'all' }); });
    REX.circuit && REX.circuit.reset();
  }

  /* ================================================================ Barre du haut, segments */
  function fraction(i) { if (st.fait[i]) return 1; var sr = st.series[i]; return sr ? sr.filter(function (s) { return s.fait; }).length / sr.length : 0; }
  function majSegments(immediat) {
    $$('#segs i').forEach(function (el, k) {
      el.classList.toggle('cur', k === st.i);
      gsap.to(el.firstChild, { scaleX: fraction(k), duration: immediat || REDUIT ? 0 : .8, ease: E.sortie, overwrite: 'auto' });
    });
  }
  function majTitre() {
    var e = etapes[st.i];
    $('#se-bloc').textContent = e.bloc.circuit ? (e.bloc.option ? 'Option' : e.bloc.nom + ' · circuit') : e.bloc.nom;
    $('#se-cpt').textContent = (st.i + 1) + ' sur ' + etapes.length;
  }

  /* ================================================================ Glissement entre exercices (M2) */
  function introPanel(i) {
    var p = $('.panel[data-i="' + i + '"]'); if (!p || st.vu[i]) return;
    st.vu[i] = true;
    if (REDUIT) return;
    var nom = $('.p-nom', p), autres = $$(':scope > *', p).filter(function (n) { return n !== nom; });
    REX.lignes(nom, { duree: 1.05, stagger: .12 });
    gsap.fromTo(autres, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .06, delay: .18, ease: E.sortie, clearProps: 'transform,opacity' });
  }
  S.allerEtape = function (j, o) {
    o = o || {};
    if (!st || j < 0 || j >= etapes.length) return;
    annulerToast();
    var dir = j >= st.i ? 1 : -1; st.i = j;
    var dur = REDUIT ? 0 : (o.duree || T.slide);
    gsap.to('#piste', { x: -j * W(), duration: dur, ease: o.ease || E.page, overwrite: true });
    $$('.panel').forEach(function (p, k) { p.inert = k !== j; gsap.to(p, { scale: k === j ? 1 : .92, opacity: k === j ? 1 : .35, duration: dur, ease: E.page, overwrite: 'auto' }); });
    majSegments(); majTitre(); renderTiroir();
    if (!REDUIT) gsap.delayedCall(.38, function () { introPanel(j); }); else introPanel(j);
  };
  function brancherSwipe() {
    var pv = $('#pv'), dd = null;
    pv.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; if (e.target.closest('.p-action, a')) return; dd = { x: e.clientX, y: e.clientY, t: performance.now(), mode: null, dx: 0 }; });
    pv.addEventListener('pointermove', function (e) {
      if (!dd) return;
      var dx = e.clientX - dd.x, dy = e.clientY - dd.y;
      if (!dd.mode) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) { dd.mode = 'h'; try { pv.setPointerCapture(e.pointerId); } catch (_) {} gsap.killTweensOf('#piste'); annulerToast(); } else if (Math.abs(dy) > 12) dd = null; }
      if (dd && dd.mode === 'h') {
        dd.dx = dx; S.glisse = true;
        var bout = (st.i === 0 && dx > 0) || (st.i === etapes.length - 1 && dx < 0);
        gsap.set('#piste', { x: -st.i * W() + dx * (bout ? .3 : 1) });
      }
    });
    var lacher = function () {
      if (!dd) return; var m = dd; dd = null;
      if (m.mode !== 'h') return;
      var v = m.dx / Math.max(1, performance.now() - m.t), j = st.i;
      if ((m.dx < -W() * .2 || v < -.25) && j < etapes.length - 1) j++;
      else if ((m.dx > W() * .2 || v > .25) && j > 0) j--;
      setTimeout(function () { S.glisse = false; }, 50);
      if (j !== st.i) S.allerEtape(j, { duree: .6, ease: E.sortie });
      else gsap.to('#piste', { x: -st.i * W(), duration: .5, ease: E.ressort });   // retour léger, rebond mesuré (M4)
    };
    pv.addEventListener('pointerup', lacher); pv.addEventListener('pointercancel', lacher);
    window.addEventListener('resize', function () { if (st) gsap.set('#piste', { x: -st.i * W() }); });
  }

  /* ================================================================ Séries */
  function majRangs(i) {
    var p = $('.panel[data-i="' + i + '"]'); if (!p) return;
    $('.rangs', p).innerHTML = st.series[i].map(function (_, k) { return rangHTML(i, k); }).join('');
    $('[data-act="action"]', p).textContent = libelleAction(i);
    majSegments(); renderTiroir();
  }
  function pulseRang(i, k) {
    var r = $('.panel[data-i="' + i + '"] .rang[data-s="' + k + '"]');
    if (r && !REDUIT) gsap.fromTo(r, { scale: .97 }, { scale: 1, duration: .3, ease: E.ressort, clearProps: 'transform' });
    var e = r && $('.rg-e', r); if (e && !REDUIT) gsap.fromTo(e, { scale: .7 }, { scale: 1, duration: .35, ease: E.pop, clearProps: 'transform' });
  }
  function enregistrer(i, k) {
    var x = exo(i), s = st.series[i][k];
    s.fait = true; st.nbSeries++;
    if (x.type === 'charge') st.volume += s.reps * s.kg * (x.parJambe ? 2 : 1);
    REX.SONS.valide();
  }
  function suiteTexte(i) {
    var cur = courante(i), x = exo(i);
    if (cur < 0) return i < etapes.length - 1 ? '<span>Ensuite</span><b>' + DATA.exos[etapes[i + 1].id].nom + '</b>' : '<span>Ensuite</span><b>Fin de séance</b>';
    var s = st.series[i][cur];
    return '<span>Prochaine série · ' + (cur + 1) + ' sur ' + x.series + '</span><b>' + (x.type === 'temps' ? s.dur + ' s' : s.reps + ' × ' + REX.fr(s.kg) + ' kg') + '</b>';
  }
  function valider(i, k, src) {
    var x = exo(i);
    if (x.type === 'temps') { lancerTemps(i, k, src); return; }
    enregistrer(i, k); majRangs(i); pulseRang(i, k);
    var derniere = courante(i) < 0;
    ouvrirChrono({ label: 'Repos · ' + x.nom, phases: [{ type: 'repos', dur: x.repos, extra: suiteTexte(i) }],
      onFin: function () { fermerChrono(src, function () { if (derniere) proposerSuite(i); }); } }, src);
  }
  function lancerTemps(i, k, src) {
    var x = exo(i), s = st.series[i][k];
    var derniere = k === x.series - 1;
    var phases = [
      { type: 'prep', dur: 5, extra: '<span>Série ' + (k + 1) + ' sur ' + x.series + '</span><b>' + s.dur + ' secondes</b>' },
      { type: 'travail', dur: s.dur, extra: '<span>' + x.nom + '</span><b>Série ' + (k + 1) + ' sur ' + x.series + '</b>',
        apres: function () { enregistrer(i, k); majRangs(i); } }
    ];
    if (!derniere) phases.push({ type: 'repos', dur: x.repos, extra: '', pre: function (ph) { ph.extra = suiteTexte(i); } });
    ouvrirChrono({ label: x.nom, phases: phases, onFin: function () { fermerChrono(src, function () { pulseRang(i, k); if (derniere) proposerSuite(i); }); } }, src);
  }
  function action(i, btn) {
    var x = exo(i), cur = courante(i);
    if (x.type === 'circuit') return;
    if (cur < 0) { if (i === etapes.length - 1) S.finir(btn); else S.allerEtape(i + 1); return; }
    valider(i, cur, btn);
  }

  /* Série ouverte : la ligne s'agrandit en panneau (M1) */
  function ouvrirSerie(i, k, row) {
    if (serieOuverte || S.glisse) return;
    var x = exo(i), s = st.series[i][k], cur = courante(i);
    serieOuverte = { i: i, k: k, row: row };
    var champs = x.type === 'charge'
      ? champHTML('reps', 'Répétitions', s.reps, x.parJambe ? 'par jambe' : 'reps') + champHTML('kg', 'Charge', REX.fr(s.kg), 'kg')
      : champHTML('dur', 'Durée', s.dur, 'secondes');
    var verbe = k === cur ? (x.type === 'temps' ? 'Lancer la série' : 'Valider la série') : 'Enregistrer';
    var c = $('#sc-serie');
    c.innerHTML = '<div class="sc-contenu"><div class="sc-haut" data-c><button class="s-icone" data-act="serie-fermer" aria-label="Fermer">' + '<svg class="ic"><use href="#i-fermer"/></svg></button>' +
      '<span class="lab">Série ' + (k + 1) + ' sur ' + x.series + '<br>' + enteteBloc(etapes[i]) + '</span></div>' +
      '<h3 class="sv-t" data-c>' + x.nom + '</h3><p class="sv-s" data-c>Touchez une valeur pour la modifier.</p>' +
      '<div class="champs" data-c>' + champs + '</div>' +
      '<p class="sv-prec" data-c>' + (x.prec ? 'Dernière fois · ' + x.prec : x.note) + '</p>' +
      '<button class="btn btn-prim gros" data-act="serie-valider" data-c>' + verbe + '</button></div>';
    REX.ouvrirRect(c, row, { rayon: 22 });
  }
  function champHTML(cle, lab, val, unite) {
    return '<button class="champ" data-champ="' + cle + '"><span class="ch-lab">' + lab + '<em>Modifier</em></span><span class="ch-val"><span class="v">' + val + '</span><small>' + unite + '</small></span></button>';
  }
  function fermerSerie(cb) {
    if (!serieOuverte) return;
    var o = serieOuverte; serieOuverte = null;
    majRangs(o.i);
    var r = $('.panel[data-i="' + o.i + '"] .rang[data-s="' + o.k + '"]');
    REX.fermerRect($('#sc-serie'), r || o.row, { onFini: cb });
  }
  function validerSerieOuverte(btn) {
    var o = serieOuverte, x = exo(o.i);
    if (o.k !== courante(o.i)) { fermerSerie(); return; }
    serieOuverte = null;
    var c = $('#sc-serie');
    valider(o.i, o.k, btn);
    gsap.delayedCall(.75, function () { c.hidden = true; c.innerHTML = ''; });
  }

  /* ================================================================ Grand sélecteur (M1, gardé tel quel : défilement natif,
     inertie et crans magnétiques, vibration à chaque cran ; glisser à la souris émulé) */
  var CHAMPS = { reps: { lab: 'Répétitions', min: 1, max: 40, pas: 1, unite: 'reps' }, kg: { lab: 'Charge', min: 0, max: 150, pas: .5, unite: 'kg' },
    dur: { lab: 'Durée', min: 5, max: 180, pas: 5, unite: 's' }, plus: { lab: 'Répétitions en plus', min: 0, max: 60, pas: 1, unite: 'reps' } };
  var sel = null;
  var Selecteur = REX.Selecteur = {
    ouvrir: function (cfg) {
      if (sel) return;
      var def = cfg.def, n = Math.round((def.max - def.min) / def.pas) + 1, index = Math.round((cfg.val - def.min) / def.pas);
      sel = { cfg: cfg, def: def, index: index, ancienne: cfg.val };
      var c = $('#sc-sel'), crans = '';
      for (var i = 0; i < n; i++) crans += '<div class="cran" data-i="' + i + '">' + REX.fr(+(def.min + i * def.pas).toFixed(1)) + '</div>';
      c.innerHTML = '<div class="sel"><div class="sc-haut" data-c><button class="s-icone" data-act="sel-fermer" aria-label="Annuler"><svg class="ic"><use href="#i-fermer"/></svg></button>' +
        '<span class="lab">' + def.lab + '<br>' + cfg.sous + '</span></div>' +
        '<div class="roue-w" data-c><div class="roue" id="roue" tabindex="0" role="spinbutton" aria-label="' + def.lab + '" aria-valuenow="' + cfg.val + '" aria-valuemin="' + def.min + '" aria-valuemax="' + def.max + '">' + crans + '</div><div class="roue-cadre"></div><span class="roue-unite">' + (cfg.unite || def.unite) + '</span></div>' +
        '<button class="btn gros btn-encre" data-act="sel-valider" data-c>Valider</button></div>';
      REX.ouvrirRect(c, cfg.champ, { rayon: 24 });
      var roue = $('#roue', c);
      var pad = function () {
        var h = roue.clientHeight, cran = roue.children[0].offsetHeight; sel.cran = cran;
        roue.style.paddingTop = roue.style.paddingBottom = Math.max(0, (h - cran) / 2) + 'px'; roue.scrollTop = index * cran; majRoue();
      };
      requestAnimationFrame(function () { requestAnimationFrame(pad); });
      setTimeout(pad, 60);
      brancherRoue(roue);
    },
    fermer: function () { if (!sel) return; var ch = sel.cfg.champ; sel = null; REX.fermerRect($('#sc-sel'), ch, { duree: .42 }); },
    valider: function () {
      if (!sel) return;
      var s = sel, v = +(s.def.min + s.index * s.def.pas).toFixed(1); sel = null;
      s.cfg.onValider(v, s.ancienne);
      var cible = $('.ch-val .v', s.cfg.champ);
      REX.fermerRect($('#sc-sel'), s.cfg.champ, { duree: .46, onFini: function () {
        if (cible) { if (REDUIT) cible.textContent = REX.fr(v); else REX.rouler(cible, REX.fr(v), { sens: v >= s.ancienne ? 1 : -1, duree: .9, stagger: .05 }); }
      } });
      REX.SONS.choix();
    },
    ouvert: function () { return !!sel; }
  };
  function majRoue() {
    var roue = $('#roue'); if (!roue || !sel) return;
    var CR = sel.cran || 104, pos = roue.scrollTop / CR, items = roue.children, idx = Math.max(0, Math.min(items.length - 1, Math.round(pos)));
    for (var i = Math.max(0, Math.floor(pos) - 5); i < Math.min(items.length, Math.ceil(pos) + 6); i++) {
      var dd = i - pos, a = Math.abs(dd), sc = 1 / (1 + a * .95), op = 1 / (1 + a * 1.5) - (a > 3 ? .1 : 0);
      items[i].style.transform = 'translateY(' + (-dd * CR * (1 - sc) * .3).toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')';
      items[i].style.opacity = Math.max(0, op).toFixed(3);
    }
    if (idx !== sel.index) { sel.index = idx; REX.vibrer(6); REX.bip(1900, .02, .03); roue.setAttribute('aria-valuenow', +(sel.def.min + idx * sel.def.pas).toFixed(1)); }
  }
  function brancherRoue(roue) {
    var raf = 0, drag = null;
    roue.addEventListener('scroll', function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; majRoue(); }); }, { passive: true });
    var vers = function (i) { var CR = sel.cran || 104; roue.scrollTo({ top: Math.max(0, Math.min(roue.children.length - 1, i)) * CR, behavior: REDUIT ? 'auto' : 'smooth' }); };
    roue.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      drag = { y: e.clientY, s: roue.scrollTop, moved: false, v: 0, ly: e.clientY, lt: performance.now() };
      roue.classList.add('glisse'); roue.setPointerCapture(e.pointerId);
    });
    roue.addEventListener('pointermove', function (e) {
      if (!drag) return; var dy = e.clientY - drag.y; if (Math.abs(dy) > 4) drag.moved = true;
      var now = performance.now(); drag.v = (e.clientY - drag.ly) / Math.max(1, now - drag.lt); drag.ly = e.clientY; drag.lt = now;
      roue.scrollTop = drag.s - dy;
    });
    var fin = function () {
      if (!drag) return; var m = drag; drag = null; roue.classList.remove('glisse'); roue._moved = m.moved;
      if (m.moved) vers(Math.round((roue.scrollTop - m.v * 260) / (sel.cran || 104)));
    };
    roue.addEventListener('pointerup', fin); roue.addEventListener('pointercancel', fin);
    roue.addEventListener('click', function (e) {
      var c = e.target.closest('.cran'); if (!c || e.detail === 0) return;
      if (roue._moved) { roue._moved = false; return; }
      vers(+c.dataset.i);
    });
    roue.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); vers(sel.index - 1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); vers(sel.index + 1); }
      if (e.key === 'Enter') Selecteur.valider();
    });
  }
  function ouvrirSelecteurSerie(cle, champ) {
    var o = serieOuverte, x = exo(o.i), s = st.series[o.i][o.k];
    Selecteur.ouvrir({ def: CHAMPS[cle], val: s[cle], champ: champ, unite: cle === 'reps' && x.parJambe ? '/jambe' : null,
      sous: x.nom + ' · série ' + (o.k + 1) + ' sur ' + x.series,
      onValider: function (v, ancienne) {
        s[cle] = v;
        st.series[o.i].forEach(function (t, j) { if (j > o.k && !t.fait && t[cle] === ancienne) t[cle] = v; });   // les séries suivantes suivent
      } });
  }
  REX.CHAMPS = CHAMPS;

  /* ================================================================ Chrono (repos, séries au temps) :
     décompte en roulette + petite phrase au-dessus (M2), couleur d'écran par phase (M1), son de fin (M1), temps total (M4) */
  REX.Chrono = function (couche, cfg) {
    var c = { cfg: cfg, i: -1, t0: 0, sec: null, fini: false, phases: cfg.phases, silence: false, actif: true };
    var L = couche;
    L.innerHTML = '<div class="bgs"><i data-ph="prep"></i><i data-ph="travail"></i><i data-ph="repos"></i></div>' +
      '<div class="ch-contenu">' +
        '<div class="ch-haut"><span class="ch-label">' + (cfg.label || '') + '</span><span class="ch-total">Séance <b class="ch-total-v">0:00</b></span></div>' +
        '<p class="ch-phrase" aria-live="polite"></p>' +
        '<div class="ch-corps">' + (cfg.corps || '<div class="ch-anneau"><svg viewBox="0 0 320 320" aria-hidden="true"><circle class="piste-a" cx="160" cy="160" r="150"/><circle class="arc" cx="160" cy="160" r="150"/></svg><div class="ch-temps" role="timer"></div></div>') + '</div>' +
        '<div class="ch-extra"></div>' +
        '<div class="ch-actions"></div>' +
      '</div><div class="ch-bandeau" aria-hidden="true"><b></b><span></span></div>';
    var temps = $('.ch-temps', L), arc = $('.arc', L), C = 2 * Math.PI * 150;
    if (arc) { arc.style.strokeDasharray = C; arc.style.strokeDashoffset = 0; }
    REX.mesurerChiffres(temps);
    function phrase(txt, anim) {
      var p = $('.ch-phrase', L); if (p.textContent === txt) return;
      p.textContent = txt;
      if (anim !== false && !REDUIT) { gsap.killTweensOf(p); gsap.fromTo(p, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .6, ease: E.sortie }); }
    }
    c.phrase = phrase;
    /* changement de couleur de phase : la nouvelle couleur balaie l'écran du bas vers le haut (pas de fondu : un
       jaune qui se fond dans l'encre donnerait un kaki terne). Le texte change de couleur à mi-balayage. */
    var zb = 1;
    function visuel(type, immediat) {
      var cible = $('.bgs i[data-ph="' + type + '"]', L), autres = $$('.bgs i', L).filter(function (b) { return b !== cible; });
      if (immediat || REDUIT || L.dataset.phase === type) {
        L.dataset.phase = type; gsap.set(cible, { opacity: 1, clipPath: 'none', zIndex: ++zb }); gsap.set(autres, { opacity: 0 }); return;
      }
      gsap.set(cible, { opacity: 1, zIndex: ++zb });
      gsap.fromTo(cible, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .6, ease: E.page,
        onComplete: function () { gsap.set(autres, { opacity: 0 }); gsap.set(cible, { clearProps: 'clipPath' }); } });
      gsap.delayedCall(.28, function () { L.dataset.phase = type; });
    }
    c.visuel = visuel;
    function boutons(ph) {
      var b = $('.ch-actions', L); b.innerHTML = ''; b.classList.remove('duo');
      var acts = cfg.actions ? cfg.actions(ph, c) : (ph.type === 'repos' ? [{ t: '+15 s', cls: 'sec', fn: function () { c.plus(15); } }, { t: 'Passer', fn: function () { c.passer(); } }]
        : ph.type === 'travail' ? [{ t: 'Terminer la série', fn: function () { c.passer(); } }] : [{ t: 'Commencer maintenant', cls: 'sec', fn: function () { c.passer(); } }]);
      if (acts.length === 2 && !acts.some(function (a) { return a.cls === 'geant'; })) b.classList.add('duo');
      acts.forEach(function (a) { var x = document.createElement('button'); x.className = 'btn-ch ' + (a.cls || ''); x.textContent = a.t; if (a.id) x.id = a.id; x.addEventListener('click', a.fn); b.appendChild(x); });
    }
    function demarrer(i, t0) {
      var ph = c.phases[i]; c.i = i; c.t0 = t0; c.sec = null;
      ph.pre && ph.pre(ph);
      visuel(ph.type, i === 0);
      phrase(ph.phrase || P()[ph.type], i > 0);
      var ex = $('.ch-extra', L); ex.innerHTML = ph.extra || '';
      if (i > 0 && !REDUIT) gsap.fromTo(ex.children, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .05, ease: E.sortie });
      boutons(ph);
      if (temps) temps.dataset.val = '';
      if (ph.type === 'travail' && !cfg.sansGo) { REX.SONS.go(); phrase(P().go); gsap.delayedCall(1.2, function () { if (c.i === i && c.actif) phrase(ph.phrase || P().travail); }); }
      cfg.onPhase && cfg.onPhase(ph, i, c);
    }
    function tick() {
      if (!c.actif || c.fini) return;
      var ph = c.phases[c.i], rest = ph.dur - (H.now() - c.t0) / 1000;
      while (rest <= 0) {
        if (!c.silence) REX.SONS.fin();
        c.silence = false;
        ph.apres && ph.apres();
        if (c.i + 1 >= c.phases.length) { c.fini = true; gsap.ticker.remove(tick); if (arc) arc.style.strokeDashoffset = C; if (temps) REX.rouler(temps, '0', { sens: -1, duree: .5, stagger: 0 }); phrase(cfg.phraseFin || P().fin); cfg.onFin && cfg.onFin(c); return; }
        demarrer(c.i + 1, Math.min(c.t0 + ph.dur * 1000, H.now()));
        ph = c.phases[c.i]; rest = ph.dur - (H.now() - c.t0) / 1000;
      }
      var sec = Math.ceil(rest - 1e-6);
      if (sec !== c.sec) {
        var prev = c.sec; c.sec = sec;
        var aff = ph.cycle ? ((sec - 1) % ph.cycle) + 1 : sec;
        if (temps) REX.rouler(temps, aff >= 60 ? REX.mmss(aff) : String(aff), { sens: -1, duree: Math.min(.6, .7 / H.vitesse), stagger: 0, immediat: prev === null && c.i === 0 && REDUIT });
        if (aff <= 3 && aff >= 1 && prev !== null) {
          REX.SONS.tic();
          if (temps && !REDUIT) gsap.fromTo(temps, { scale: 1.1 }, { scale: 1, duration: .5, ease: E.sortie });
          if (ph.type === 'repos') phrase(P().reposFin);
        }
        cfg.onSeconde && cfg.onSeconde(ph, sec, c);
      }
      if (arc) { var cyc = ph.cycle, r = cyc ? rest - cyc * Math.floor((rest - 1e-6) / cyc) : rest; arc.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(1, r / (cyc || ph.dur)))); }
    }
    c.plus = function (s) { c.phases[c.i].dur += s; c.sec = null; REX.SONS.tick(); if (temps && !REDUIT) gsap.fromTo(temps, { scale: 1.08 }, { scale: 1, duration: .5, ease: E.ressort }); };
    c.passer = function () { var ph = c.phases[c.i]; c.silence = true; c.t0 = H.now() - ph.dur * 1000 - 1; };
    c.terminer = function () { c.silence = true; c.i = c.phases.length - 1; c.t0 = H.now() - c.phases[c.i].dur * 1000 - 1; };
    c.stop = function () { c.actif = false; gsap.ticker.remove(tick); };
    c.bandeau = function (titre, sous) {
      var b = $('.ch-bandeau', L); $('b', b).textContent = titre; $('span', b).textContent = sous;
      if (REDUIT) { gsap.fromTo(b, { opacity: 0 }, { opacity: 1, duration: .15, yoyo: true, repeat: 1, repeatDelay: .7 }); return; }
      gsap.timeline().set(b, { opacity: 1 }).fromTo(b, { clipPath: 'inset(100% 0px 0px 0px)' }, { clipPath: 'inset(0% 0px 0px 0px)', duration: .35, ease: E.sortie })
        .fromTo(b.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .45, stagger: .05, ease: E.sortie }, .05)
        .to(b, { clipPath: 'inset(0px 0px 100% 0px)', duration: .45, ease: 'power3.inOut' }, '+=.55').set(b, { opacity: 0, clearProps: 'clipPath' });
    };
    demarrer(0, H.now());
    gsap.ticker.add(tick); tick();
    return c;
  };
  /* largeur d'une cellule de la roulette = largeur d'un chiffre dans la police courante (chiffres tabulaires) */
  REX.mesurerChiffres = function (el) {
    if (!el) return;
    var cs = getComputedStyle(el), cv = REX._cv || (REX._cv = document.createElement('canvas')), x = cv.getContext('2d');
    x.font = cs.fontWeight + ' 100px ' + cs.fontFamily;
    var w = Math.max.apply(null, '0123456789'.split('').map(function (n) { return x.measureText(n).width; }));
    el.style.setProperty('--rl-w', (w / 100).toFixed(3) + 'em');
  };
  function ouvrirChrono(cfg, src) {
    if (chrono) chrono.stop();
    var L = $('#sc-chrono');
    L.hidden = false;
    chrono = REX.Chrono(L, cfg);
    majTotal();
    REX.ouvrirCercle(L, src, { duree: T.repos, ease: 'expo.out' });   // action fréquente : part vite du bouton
    if (!REDUIT) gsap.fromTo($('.ch-contenu', L), { opacity: 0 }, { opacity: 1, duration: .3, delay: .2 });
  }
  function fermerChrono(vers, cb) {
    var c = chrono; if (c) c.stop(); chrono = null;
    gsap.delayedCall(REDUIT ? 0 : .5, function () {
      REX.fermerCercle($('#sc-chrono'), vers && vers.isConnected ? vers : null, { onFini: function () { $('#sc-chrono').innerHTML = ''; cb && cb(); } });
    });
  }
  REX.surConfig(function () { $$('.ch-temps, .cc-temps').forEach(REX.mesurerChiffres); });

  /* ================================================================ Exercice suivant automatique (« Rester ici ») */
  function annulerToast() { if (toast) { toast.kill(); toast = null; } $('#toast-suite').hidden = true; }
  function proposerSuite(i) {
    if (i >= etapes.length - 1 || st.i !== i) return;
    var t = $('#toast-suite'); $('#ts-nom').textContent = DATA.exos[etapes[i + 1].id].nom; t.hidden = false;
    toast = gsap.timeline({ onComplete: function () { t.hidden = true; toast = null; if (st && st.i === i) S.allerEtape(i + 1); } });
    toast.fromTo(t, { y: REDUIT ? 0 : 60, opacity: 0 }, { y: 0, opacity: 1, duration: REDUIT ? .2 : .45, ease: E.ressort })
      .fromTo('#ts-prog', { scaleX: 1 }, { scaleX: 0, duration: 3, ease: 'none' }, .1);
  }
  S.proposerSuite = proposerSuite;

  /* ================================================================ Tiroir : toute la séance, par bloc */
  function renderTiroir() {
    if (!st) return;
    var h = '', blocPrec = null;
    etapes.forEach(function (e, i) {
      if (e.bloc !== blocPrec) { h += '<li class="ti-bloc">' + (e.bloc.option ? 'Option' : e.bloc.nom) + '</li>'; blocPrec = e.bloc; }
      var x = exo(i), f = fraction(i) === 1 || st.fait[i];
      var sous = x.type === 'circuit' ? x.format + ' · ' + x.minutes + ' min' : x.type === 'temps' ? x.series + ' × ' + x.dur + ' s' : x.series + ' × ' + x.reps + ' · ' + REX.fr(x.kg) + ' kg';
      h += '<li><button class="ti-i' + (i === st.i ? ' cur' : '') + (f ? ' fait' : '') + '" data-aller="' + i + '"><span class="tn">' + (f ? CHECK : i + 1) + '</span><span class="tt">' + x.nom + '<small>' + sous + '</small></span></button></li>';
    });
    $('#ti-liste').innerHTML = h;
  }
  function ouvrirTiroir() {
    if (tiroirOuvert) return; tiroirOuvert = true;
    var t = $('#tiroir'), s = $('#scrim-tiroir');
    gsap.set(t, { visibility: 'visible' }); s.style.pointerEvents = 'auto';
    gsap.to(s, { opacity: .55, duration: .3 });
    gsap.to(t, { x: 0, xPercent: 0, duration: REDUIT ? .2 : .55, ease: E.vaul });
    if (!REDUIT) gsap.fromTo($$('#ti-liste li', t), { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: .6, stagger: .03, ease: E.sortie, delay: .1 });
  }
  function fermerTiroir(cb) {
    if (!tiroirOuvert) return; tiroirOuvert = false;
    var t = $('#tiroir'), s = $('#scrim-tiroir'); s.style.pointerEvents = 'none';
    gsap.to(s, { opacity: 0, duration: .25 });
    gsap.to(t, { xPercent: 105, duration: REDUIT ? .15 : .3, ease: E.fermer, onComplete: function () { gsap.set(t, { visibility: 'hidden' }); cb && cb(); } });
  }
  gsap.set('#tiroir', { xPercent: 105, x: 0 });

  /* ================================================================ Quitter, fin */
  function feuille(v) {
    var f = $('#feuille-quitter'), s = $('#scrim-tiroir');
    s.style.pointerEvents = v ? 'auto' : 'none';
    gsap.to(s, { opacity: v ? .55 : 0, duration: .3 });
    if (v) { f.hidden = false; gsap.fromTo(f, { yPercent: 110 }, { yPercent: 0, duration: REDUIT ? .2 : .6, ease: E.vaul }); $('#fq-continuer').focus({ preventScroll: true }); }
    else gsap.to(f, { yPercent: 110, duration: .28, ease: E.fermer, onComplete: function () { f.hidden = true; } });
    S.feuilleOuverte = v;
  }
  S.finir = function (src) {
    if (!st) return;
    stopperTout();
    var duree = Math.max(49 * 60, (H.now() - st.debut) / 1000);   // plancher démo : la maquette se joue en quelques minutes
    var page = $('#e-fin'); REX.empiler(page); page.hidden = false;
    $('#f-series').textContent = '0'; $('#f-volume').textContent = '0';
    var fin = function () {
      REX.compter($('#f-duree'), duree / 60, { duree: 1.4, format: function (v) { return Math.round(v) + ' min'; } });
      REX.compter($('#f-volume'), st.volume || 1840, { duree: 1.6, delai: .1, format: function (v) { return Math.round(v).toLocaleString('fr-FR'); } });
      REX.compter($('#f-series'), st.nbSeries || 15, { duree: 1.2, delai: .2 });
      REX.confettis($('#confettis'), 46); REX.SONS.fete();
    };
    if (REDUIT) { gsap.fromTo(page, { opacity: 0 }, { opacity: 1, duration: .25, onComplete: fin }); return; }
    REX.ouvrirCercle(page, src, { duree: .8 });
    gsap.fromTo('#fin-badge', { scale: .7, opacity: 0 }, { scale: 1, opacity: 1, duration: .8, ease: E.pop, delay: .45 });
    REX.lignes($('#fin-titre'), { delai: .5, duree: 1.1 });
    gsap.fromTo('#fin-grille .tuile, .fin-mot, #btn-valider-seance', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .07, ease: E.sortie, delay: .7, clearProps: 'transform,opacity', onStart: fin });
  };
  function validerSeance() {
    var e = ec; e.hidden = true; REX.depiler(e); gsap.set(e, { clearProps: 'all' });
    if (ticker) { gsap.ticker.remove(ticker); ticker = null; }
    st = null;
    REX.retourRacine('#c-semaine', function () { REX.PAGES['e-dash'].apresSeance(); });
  }

  /* ================================================================ Branchements */
  REX.PAGES['e-seance'] = {
    init: function () {
      brancherSwipe();
      $('#btn-demarrer').addEventListener('click', function () { REX.ouvrirSeance(this, 0); });
      // Choisir un exercice depuis l'overview : la séance s'ouvre depuis l'encart et arrive sur cet exercice (M2)
      $('#wo-blocs').addEventListener('click', function (e) {
        var b = e.target.closest('[data-aller]'); if (!b || REX.workoutCourant !== 'w2' || REX.etat.w2Fait) return;
        var i = etapes.findIndex(function (x) { return x.id === b.dataset.aller; });
        REX.ouvrirSeance(b.closest('.ex'), Math.max(0, i));
      });
      $('#piste').addEventListener('click', function (e) {
        if (S.glisse) return;
        var p = e.target.closest('.panel'); if (!p) return;
        var i = +p.dataset.i;
        if (i !== st.i) { S.allerEtape(i); return; }
        var a = e.target.closest('[data-act]');
        if (a) {
          var act = a.dataset.act;
          if (act === 'action') action(i, a);
          else if (act === 'circuit') REX.circuit.ouvrir(i, a);
          else if (act === 'sans-option') S.finir(a);
          else if (act === 'suivant') { if (i === etapes.length - 1) S.finir(a); else S.allerEtape(i + 1); }
          return;
        }
        var r = e.target.closest('.rang'); if (r) ouvrirSerie(i, +r.dataset.s, r);
      });
      $('#sc-serie').addEventListener('click', function (e) {
        var a = e.target.closest('[data-act]');
        if (a && a.dataset.act === 'serie-fermer') { fermerSerie(); return; }
        if (a && a.dataset.act === 'serie-valider') { validerSerieOuverte(a); return; }
        var ch = e.target.closest('.champ'); if (ch) ouvrirSelecteurSerie(ch.dataset.champ, ch);
      });
      $('#sc-sel').addEventListener('click', function (e) {
        var a = e.target.closest('[data-act]'); if (!a) return;
        if (a.dataset.act === 'sel-fermer') Selecteur.fermer(); else if (a.dataset.act === 'sel-valider') Selecteur.valider();
      });
      $('#tab-tiroir').addEventListener('click', ouvrirTiroir);
      $('#ti-fermer').addEventListener('click', function () { fermerTiroir(); });
      $('#scrim-tiroir').addEventListener('click', function () { if (S.feuilleOuverte) feuille(false); else fermerTiroir(); });
      $('#ti-liste').addEventListener('click', function (e) { var b = e.target.closest('[data-aller]'); if (b) fermerTiroir(function () { S.allerEtape(+b.dataset.aller); }); });
      $('#ts-rester').addEventListener('click', annulerToast);
      $('#se-quitter').addEventListener('click', function () { feuille(true); });
      $('#fq-continuer').addEventListener('click', function () { feuille(false); });
      $('#fq-quitter').addEventListener('click', function () { feuille(false); fermerSeance(); });
      $('#btn-valider-seance').addEventListener('click', validerSeance);
      REX.surEscape = function () {
        if (ec.hidden) return false;
        if (Selecteur.ouvert()) { Selecteur.fermer(); return true; }
        if (serieOuverte) { fermerSerie(); return true; }
        if (tiroirOuvert) { fermerTiroir(); return true; }
        if (S.feuilleOuverte) { feuille(false); return true; }
        if (!$('#sc-chrono').hidden || !$('#sc-circuit').hidden) return true;
        feuille(true); return true;
      };
    }
  };
})();
