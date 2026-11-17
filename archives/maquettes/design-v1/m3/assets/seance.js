/* M3 « Tableau » — séance en cours : exercices en whip-pan, série qui s'agrandit, grand sélecteur,
   chrono plein écran (repos / travail / AMRAP / EMOM), tiroir d'overview, fin de séance.
   Transitions : demarrerSeance(), montrerEtape(), ouvrirSerie()/fermerSerie(), ouvrirSelecteur(),
   ouvrirChrono()/fermerChrono(), ouvrirTiroir()/fermerTiroir(), finSeance(), quitterSeance(). */
(function (M3) {
  'use strict';
  var $ = M3.$, $$ = M3.$$, T = M3.T, E = M3.E, D = M3.D, etat = M3.etat;
  var ETAPES = D.exos.map(function (x) { return { kind: 'exo', exo: x }; }).concat([{ kind: 'circuit', c: D.amrap }]);
  var S = null;                        // état de la séance
  var pad2 = function (n) { return ('0' + n).slice(-2); };
  var el = function (cls, html, tag) { var e = document.createElement(tag || 'div'); e.className = cls; e.innerHTML = html || ''; return e; };
  var fmtVal = function (v, unite) { return unite === 'kg' ? String(v).replace('.', ',') : String(v); };

  function nouvelleSeance() {
    S = { i: 0, series: {}, t0: M3.maintenant(), tours: 0, extra: 0, toursEmom: false, busy: false, auto: null, chrono: null, ovOpen: false, fini: false };
    D.exos.forEach(function (x) {
      S.series[x.id] = Array.apply(null, Array(x.series)).map(function () { return { reps: x.reps, kg: x.kg, duree: x.duree, fait: false }; });
    });
  }

  /* =============== Entrée / sortie de séance : volets =============== */
  M3.demarrerSeance = function () {
    if (M3.occupe()) return; M3.occupe(true); nouvelleSeance();
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { S.wake = w; }).catch(function () { }); } catch (e) { }
    M3.volets(function () {
      M3.pile.splice(0).forEach(function (p) { $('#e-' + p.id).style.display = 'none'; });
      $('#e-seance').style.display = 'block'; M3.afficherBoutonMenu(false);
      $('#s-zone').innerHTML = '';
      batirProgression(); montrerEtape(0, 0);
    }, { label: 'Workout 2', fini: function () { M3.occupe(false); } });
  };
  function sortirSeance(maj) {
    if (S && S.wake) { try { S.wake.release(); } catch (e) { } }
    if (S && S.chrono) S.chrono.arreter();
    if (S && S.auto) S.auto.kill();
    M3.occupe(true);
    M3.volets(function () {
      ['#fin', '#chrono', '#e-seance', '#selecteur', '#tiroir', '#voile'].forEach(function (s) { $(s).style.display = 'none'; });
      $('#serie-detail').style.display = 'none';
      M3.pile.splice(0).forEach(function (p) { $('#e-' + p.id).style.display = 'none'; });
      M3.afficherBoutonMenu(true); $('#s-zone').innerHTML = '';
    }, { label: maj ? '2 / 3' : '', rapide: !maj, fini: function () { M3.occupe(false); if (maj) M3.maj2sur3(); } });
  }
  M3.quitterSeance = function () {
    M3.confirmer('Quitter ?', 'Ta séance en cours sera mise de côté, tu pourras la reprendre.', 'Quitter la séance', 'Rester', function () { sortirSeance(false); });
  };

  /* =============== Progression en haut =============== */
  function batirProgression() {
    var pr = $('#s-prog'); pr.innerHTML = '';
    ETAPES.forEach(function (e, k) {
      var b = el('', '<b></b>', 'button'); b.setAttribute('aria-label', 'Aller à l\'étape ' + (k + 1));
      b.onclick = function () { if (k !== S.i) versEtape(k); }; pr.appendChild(b);
    });
  }
  function majProgression() {
    $$('#s-prog button').forEach(function (b, k) {
      b.classList.toggle('cur', k === S.i);
      gsap.to($('b', b), { scaleX: k < S.i ? 1 : 0, duration: M3.rm() ? 0 : 0.5, ease: E.sec });
    });
    $('#s-compte').textContent = (S.i + 1) + '/' + ETAPES.length;
  }

  /* =============== Étape : un exercice plein écran, whip-pan entre deux =============== */
  function versEtape(j) {
    if (S.busy || j < 0 || j >= ETAPES.length || j === S.i) return;
    if (S.auto) { S.auto.kill(); S.auto = null; }
    montrerEtape(j, j > S.i ? 1 : -1);
  }
  function montrerEtape(i, dir) {
    var zone = $('#s-zone'), ancien = $('.panneau', zone);
    S.i = i;
    var p = ETAPES[i].kind === 'exo' ? panneauExo(i) : panneauCircuitExpl(ETAPES[i].c, i);
    zone.appendChild(p); majProgression(); S.busy = true;
    if (!dir) { p.style.display = 'flex'; entreePanneau(p, 0.1); S.busy = false; return; }
    M3.whip(ancien, p, dir, function () { if (ancien) ancien.remove(); S.busy = false; });
    entreePanneau(p, 0.18);
  }
  function entreePanneau(p, d) {
    var nom = $('.ex-nom', p);
    if (nom) { M3.motsDans(nom); $$('.mot', nom).forEach(function (m) { m.style.paddingTop = '.07em'; m.style.marginTop = '-.07em'; }); M3.entreeMots(nom, d); }
    if (M3.rm()) return;
    var texte = $$('.puce, .conseil, .etq, .bloc, .circuit-l, .titre-bloc', p);
    if (texte.length) gsap.from(texte, { x: 60, opacity: 0, duration: 0.55, stagger: 0.04, delay: d + 0.1, ease: E.sec, clearProps: 'transform,opacity' });
    if ($$('.serie', p).length) gsap.from($$('.serie', p), { clipPath: 'inset(0 100% 0 0)', duration: 0.5, stagger: 0.07, delay: d + 0.2, ease: E.sec, clearProps: 'clipPath' });
    var bt = $('.p-bas', p); if (bt) gsap.from(bt, { yPercent: 40, opacity: 0, duration: 0.5, delay: d + 0.25, ease: E.sec, clearProps: 'transform,opacity' });
  }

  function ligneSerie(x, s, k, prochaine) {
    var v = x.type === 'temps' ? s.duree + '<i>S</i>' : s.reps + '<i>×</i>' + fmtVal(s.kg, 'kg') + '<i>KG</i>';
    var pr = x.prec ? 'préc.<br>' + x.prec.reps + ' × ' + x.prec.kg : (x.type === 'temps' ? 'au temps' : (x.parJambe ? 'par<br>jambe' : ''));
    return '<button class="serie' + (s.fait ? ' faite' : '') + (prochaine ? ' prochaine' : '') + '" data-k="' + k + '" aria-label="Série ' + (k + 1) + '"><b class="wipe"></b><span class="n">S' + (k + 1) + '</span><span class="v">' + v + '</span><span class="pr">' + pr + '</span><span class="ck">✓</span></button>';
  }
  function panneauExo(i) {
    var x = ETAPES[i].exo, ser = S.series[x.id], p = el('panneau'); p.dataset.i = i;
    var prochaine = ser.findIndex(function (s) { return !s.fait; });
    var puces = '<span class="puce">' + (x.type === 'temps' ? x.series + ' × ' + x.duree + ' s' : x.series + ' × ' + x.reps + (x.parJambe ? ' / jambe' : '') + ' · ' + x.kg + ' kg') + '</span><span class="puce">Repos ' + x.repos + ' s</span><a class="puce vid" href="' + x.video + '" target="_blank" rel="noopener">▶ Vidéo</a>';
    p.innerHTML = '<div class="defile-p"><span class="etq">' + x.bloc + ' · exercice ' + (i + 1) + ' / ' + D.exos.length + '</span><h2 class="ex-nom">' + x.nom + '</h2><div class="puces">' + puces + '</div><p class="conseil">' + x.conseil + '</p><div class="series">' +
      ser.map(function (s, k) { return ligneSerie(x, s, k, k === prochaine); }).join('') + '</div></div><div class="p-bas" style="margin-right:-18px"></div>';
    $$('.serie', p).forEach(function (r) { r.onclick = function () { ouvrirSerie(+r.dataset.k); }; });
    majBouton(p);
    return p;
  }
  function panneauCourant() { return $('#s-zone .panneau:last-child'); }
  function majBouton(p) {
    var x = ETAPES[S.i].exo, ser = S.series[x.id], k = ser.findIndex(function (s) { return !s.fait; }), bas = $('.p-bas', p);
    bas.innerHTML = '';
    var b = el('btn', '', 'button');
    if (k < 0) { b.className = 'btn sec'; b.innerHTML = 'Exercice suivant <span aria-hidden="true">▸</span>'; b.onclick = function () { versEtape(S.i + 1); }; }
    else if (x.type === 'temps') { b.innerHTML = 'Lancer la série ' + (k + 1) + '/' + ser.length + ' · ' + ser[k].duree + ' s'; b.onclick = function () { lancerTravail(k); }; }
    else { b.innerHTML = 'Valider la série ' + (k + 1) + '/' + ser.length; b.onclick = function () { validerSerie(k); }; }
    bas.appendChild(b); p.classList.remove('suite');
  }
  /* Mise à jour d'une ligne après modification des valeurs */
  function majLigne(x, k) {
    var p = panneauCourant(), r = $$('.serie', p)[k], s = S.series[x.id][k];
    var v = r.querySelector('.v'); v.innerHTML = x.type === 'temps' ? s.duree + '<i>S</i>' : s.reps + '<i>×</i>' + fmtVal(s.kg, 'kg') + '<i>KG</i>';
  }

  /* =============== Valider une série : tampon sur la ligne, puis repos automatique =============== */
  function validerSerie(k, depuisChrono) {
    var x = ETAPES[S.i].exo, ser = S.series[x.id], s = ser[k]; if (s.fait) return;
    s.fait = true; M3.vibre(18);
    var p = panneauCourant(), r = $$('.serie', p)[k], sync = ser.every(function (q) { return q.fait; });
    var wipe = $('.wipe', r);
    if (M3.rm()) { r.classList.add('faite'); gsap.set(wipe, { scaleX: 1 }); }
    else {
      gsap.fromTo(wipe, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: E.sec });
      gsap.delayedCall(0.08, function () { r.classList.add('faite'); r.classList.remove('prochaine'); });
      gsap.fromTo(r, { x: -10 }, { x: 0, duration: 0.4, ease: E.sec, clearProps: 'transform' });
      gsap.fromTo($('.ck', r), { scale: 1.7, rotation: -14 }, { scale: 1, rotation: 0, duration: 0.4, delay: 0.1, ease: E.sec, clearProps: 'transform' });
    }
    M3.bip(1040, 0.07, 0.08);
    var suiv = ser.findIndex(function (q) { return !q.fait; });
    if (suiv >= 0) { var rs = $$('.serie', p)[suiv]; rs && rs.classList.add('prochaine'); majBouton(p); }
    if (!sync) { if (depuisChrono) lancerRepos(x, k); else gsap.delayedCall(M3.rm() ? 0 : 0.45, function () { lancerRepos(x, k); }); }
    else { majBouton(p); if (depuisChrono) fermerChrono(function () { proposerSuite(); }); else gsap.delayedCall(M3.rm() ? 0 : 0.5, proposerSuite); }
  }
  /* Dernière série validée : passage automatique à la suite (3 s) avec « Rester ici » */
  function proposerSuite() {
    if (S.i >= ETAPES.length - 1) return;
    var p = panneauCourant(), bas = $('.p-bas', p), nxt = ETAPES[S.i + 1];
    var nom = nxt.kind === 'exo' ? nxt.exo.nom : 'Circuit ' + nxt.c.kind;
    bas.innerHTML = '<div class="suite-bandeau"><div class="t"><small>Suite dans 3 s</small>' + nom + '</div><button>Rester ici</button><i class="barre"></i></div>';
    var ban = $('.suite-bandeau', bas), barre = $('.barre', bas);
    if (!M3.rm()) gsap.from(ban, { xPercent: -100, duration: 0.45, ease: E.sec });
    var depart = S.i;
    $('button', ban).onclick = function () { if (S.auto) S.auto.kill(); S.auto = null; majBouton(p); };
    S.auto = gsap.fromTo(barre, { scaleX: 1 }, { scaleX: 0, duration: 3, ease: 'none', transformOrigin: '0 50%', onComplete: function () { S.auto = null; if (S.i === depart && !S.busy) versEtape(S.i + 1); } });
  }

  /* =============== Série qui s'agrandit (depuis sa ligne) =============== */
  function champsSerie(x, s) {
    if (x.type === 'temps') return [{ champ: 'duree', etq: 'Durée', un: 's', vals: rng(5, 180, 5), v: s.duree }];
    return [{ champ: 'reps', etq: x.parJambe ? 'Répétitions / jambe' : 'Répétitions', un: 'rép.', vals: rng(1, 40, 1), v: s.reps },
            { champ: 'kg', etq: 'Charge', un: 'kg', vals: rng(0, 150, 0.5), v: s.kg }];
  }
  function rng(a, b, st) { var o = []; for (var v = a; v <= b + 1e-9; v += st) o.push(Math.round(v * 10) / 10); return o; }
  function ouvrirSerie(k) {
    if (S.busy) return; S.busy = true;
    var x = ETAPES[S.i].exo, s = S.series[x.id][k], p = panneauCourant(), row = $$('.serie', p)[k], d = $('#serie-detail');
    var champs = champsSerie(x, s);
    d.innerHTML = '<div class="sd-haut"><div><span class="etq">' + x.nom + '</span><div class="gros">Série ' + (k + 1) + ' / ' + S.series[x.id].length + '</div></div><button class="carre" id="sd-x" aria-label="Fermer">✕</button></div>' +
      '<div class="sd-val">' + champs.map(function (c) { return '<button class="val-case" data-champ="' + c.champ + '"><span class="etq">' + c.etq + '</span><span class="big"><span class="flap"></span></span><span class="un">' + c.un + '</span><span class="edit">CHANGER ▸</span></button>'; }).join('') + '</div>' +
      (x.prec ? '<p class="etq" style="margin:0 0 12px">Précédent : ' + x.prec.reps + ' × ' + x.prec.kg + ' kg</p>' : '') +
      '<button class="btn" id="sd-ok">' + (x.type === 'temps' ? 'Lancer la série · ' + s.duree + ' s' : 'Valider la série') + '</button>';
    d.style.display = 'flex';
    champs.forEach(function (c, n) {
      var cas = $$('.val-case', d)[n], fl = $('.flap', cas); M3.flap(fl, fmtVal(s[c.champ], c.un), null);
      cas.onclick = function () {
        M3.ouvrirSelecteur({ depuis: cas, titre: c.etq, sous: x.nom + ' · série ' + (k + 1), unite: c.un === 'rép.' ? '' : c.un, valeurs: c.vals, valeur: s[c.champ], fmt: function (v) { return fmtVal(v, c.un); },
          onOk: function (v) { var avant = s[c.champ]; s[c.champ] = v; M3.flap(fl, fmtVal(v, c.un), v >= avant ? 'asc' : 'desc'); majLigne(x, k);
            S.series[x.id].forEach(function (q, j) { if (j > k && !q.fait) { q[c.champ] = v; majLigne(x, j); } }); } });
      };
    });
    var fin = function () { S.busy = false; };
    if (M3.rm()) { gsap.fromTo(d, { opacity: 0 }, { opacity: 1, duration: T.fondu, onComplete: fin }); }
    else {
      var tl = gsap.timeline({ onComplete: function () { gsap.set(d, { clearProps: 'clipPath' }); fin(); } });
      tl.fromTo(d, { clipPath: M3.ins(M3.rel(row)) }, { clipPath: M3.PLEIN, duration: T.serie, ease: E.coupe }, 0);
      tl.from($$('.sd-haut > *, .val-case, .etq, #sd-ok', d), { x: -40, opacity: 0, duration: 0.5, stagger: 0.06, ease: E.sec, clearProps: 'transform,opacity' }, 0.3);
      tl.from($$('.val-case .big', d), { yPercent: 40, duration: 0.5, stagger: 0.08, ease: E.sec, clearProps: 'transform' }, 0.35);
    }
    $('#sd-x').onclick = function () { fermerSerie(row); };
    $('#sd-ok').onclick = function () { fermerSerie(row, function () { if (x.type === 'temps') lancerTravail(k); else validerSerie(k); }); };
  }
  function fermerSerie(row, cb) {
    if (S.busy) return; S.busy = true; var d = $('#serie-detail');
    var fin = function () { d.style.display = 'none'; gsap.set(d, { clearProps: 'clipPath,opacity' }); gsap.set(d.children, { clearProps: 'opacity' }); S.busy = false; cb && cb(); };
    if (M3.rm()) return gsap.to(d, { opacity: 0, duration: T.fondu, onComplete: fin });
    var tl = gsap.timeline({ onComplete: fin });
    tl.to(d.children, { opacity: 0, duration: 0.15 }, 0);
    tl.fromTo(d, { clipPath: M3.PLEIN }, { clipPath: M3.ins(M3.rel(row)), duration: T.pageRetour, ease: E.coupe }, 0.06);
  }

  /* =============== Grand sélecteur vertical : roue à crans magnétiques =============== */
  var HI = 104;   // hauteur d'un cran (px)
  M3.ouvrirSelecteur = function (o) {
    var sel = $('#selecteur'), roue = $('#roue'), vals = o.valeurs, idx = Math.max(0, vals.indexOf(o.valeur));
    if (idx < 0) idx = 0;
    $('#sel-titre').textContent = o.titre; $('#sel-sous').textContent = o.sous || ''; $('#sel-unite').textContent = o.unite || '';
    roue.innerHTML = '<div class="roue-pad"></div>' + vals.map(function (v) { return '<div class="roue-item" role="option">' + o.fmt(v) + '</div>'; }).join('') + '<div class="roue-pad"></div>';
    sel.style.display = 'flex';
    var H = roue.clientHeight, pad = Math.max(0, (H - HI) / 2), items = $$('.roue-item', roue);
    $$('.roue-pad', roue).forEach(function (q) { q.style.height = pad + 'px'; });
    roue.scrollTop = idx * HI; var courant = idx, ferme = false, fantomes = [];
    function style() {
      var pos = roue.scrollTop / HI, c = Math.round(pos);
      fantomes.forEach(function (j) { if (Math.abs(j - pos) > 6) { items[j].style.transform = 'scale(.4)'; items[j].style.opacity = '.1'; } });
      fantomes = [];
      for (var j = Math.max(0, c - 6); j <= Math.min(items.length - 1, c + 6); j++) {
        var d = Math.abs(j - pos), sc = Math.max(0.4, 1 - d * 0.27), op = Math.max(0.1, 1 - d * 0.42);
        items[j].style.transform = 'scale(' + sc + ')'; items[j].style.opacity = op; fantomes.push(j);
      }
      c = Math.max(0, Math.min(items.length - 1, c));
      if (c !== courant) { courant = c; M3.cran(); }
    }
    items.forEach(function (it) { it.style.transform = 'scale(.4)'; it.style.opacity = '.1'; });
    style();
    var raf = null; roue.onscroll = function () { if (!raf) raf = requestAnimationFrame(function () { raf = null; style(); }); };
    items.forEach(function (it, j) { it.onclick = function () { roue.scrollTo({ top: j * HI, behavior: M3.rm() ? 'auto' : 'smooth' }); }; });
    roue.onkeydown = function (e) { if (e.key === 'ArrowUp') { e.preventDefault(); roue.scrollTo({ top: Math.max(0, (courant - 1)) * HI, behavior: 'smooth' }); } if (e.key === 'ArrowDown') { e.preventDefault(); roue.scrollTo({ top: Math.min(vals.length - 1, courant + 1) * HI, behavior: 'smooth' }); } if (e.key === 'Enter') ok(); };
    // souris : glisser avec inertie (le tactile utilise le défilement natif + scroll-snap)
    var drag = null;
    roue.onpointerdown = function (e) { if (e.pointerType !== 'mouse') return; drag = { y: e.clientY, st: roue.scrollTop, vy: 0, t: performance.now(), moved: false }; roue.style.scrollSnapType = 'none'; roue.setPointerCapture(e.pointerId); };
    roue.onpointermove = function (e) {
      if (!drag) return; var k = M3.tel.getBoundingClientRect().width / M3.tel.offsetWidth || 1, dy = (e.clientY - drag.y) / k;
      if (Math.abs(dy) > 4) drag.moved = true;
      var nt = drag.st - dy; drag.vy = (nt - roue.scrollTop) / Math.max(1, performance.now() - drag.t) * 16; drag.t = performance.now(); roue.scrollTop = nt;
    };
    roue.onpointerup = function () {
      if (!drag) return; var vy = drag.vy, moved = drag.moved; drag = null;
      var cible = Math.max(0, Math.min(vals.length - 1, Math.round((roue.scrollTop + vy * 14) / HI)));
      var obj = { t: roue.scrollTop };
      if (!moved) { roue.style.scrollSnapType = ''; return; }
      gsap.to(obj, { t: cible * HI, duration: 0.6, ease: E.sec, onUpdate: function () { roue.scrollTop = obj.t; }, onComplete: function () { roue.style.scrollSnapType = ''; } });
    };
    $('#sel-x').onclick = function () { fermer(false); };
    $('#sel-ok').onclick = ok;
    function ok() { fermer(true); }
    function fermer(valide) {
      if (ferme) return; ferme = true;
      var v = vals[Math.max(0, Math.min(vals.length - 1, Math.round(roue.scrollTop / HI)))];
      var fin = function () { sel.style.display = 'none'; gsap.set(sel, { clearProps: 'clipPath,opacity' }); gsap.set(sel.children, { clearProps: 'opacity' }); if (valide) o.onOk(v); };
      if (valide) M3.bip(1200, 0.06, 0.08);
      if (M3.rm()) return gsap.to(sel, { opacity: 0, duration: T.fondu, onComplete: fin });
      var tl = gsap.timeline({ onComplete: fin });
      tl.to(sel.children, { opacity: 0, duration: 0.15 }, 0);
      tl.fromTo(sel, { clipPath: M3.PLEIN }, { clipPath: M3.ins(M3.rel(o.depuis)), duration: 0.5, ease: E.coupe }, 0.05);
    }
    if (M3.rm()) return gsap.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: T.fondu });
    var tl = gsap.timeline({ onComplete: function () { gsap.set(sel, { clearProps: 'clipPath' }); } });
    tl.fromTo(sel, { clipPath: M3.ins(M3.rel(o.depuis)) }, { clipPath: M3.PLEIN, duration: T.selecteur, ease: E.coupe }, 0);
    tl.from('#selecteur .sel-haut > *', { x: -40, opacity: 0, duration: 0.45, stagger: 0.06, ease: E.sec, clearProps: 'transform,opacity' }, 0.3);
    tl.from('#sel-unite', { x: 40, opacity: 0, duration: 0.45, ease: E.sec, clearProps: 'transform,opacity' }, 0.4);
    tl.from('#sel-ok', { yPercent: 100, duration: 0.45, ease: E.sec, clearProps: 'transform' }, 0.35);
  };

  /* =============== Chrono plein écran : une seule vue, le fond change selon la phase =============== */
  var C = { base: 'repos', cfg: null };
  function ouvrirChrono(cfg) {
    var c = $('#chrono'), deja = c.style.display === 'flex';
    C.cfg = cfg; C.base = cfg.phase; c.dataset.phase = cfg.phase;
    c.classList.toggle('amrap', !!cfg.amrap);
    $('#ch-etiq').textContent = cfg.etiq; $('#ch-sous').textContent = cfg.sous || '';
    $('#ch-droite').innerHTML = cfg.droite || '';
    $('#ch-digits').style.fontSize = cfg.amrap || cfg.droite ? '150px' : '';
    var bas = $('#ch-bas'); bas.innerHTML = (cfg.info ? '<div class="' + (cfg.amrap ? 'etq' : 'prochaine-l') + '">' + cfg.info + '</div>' : '');
    (cfg.boutons || []).forEach(function (b) { var e = el('btn ' + (b.cls || ''), b.txt, 'button'); e.onclick = b.fn; bas.appendChild(e); });
    var rangee = $$('.btn.moy.duo-b', bas); if (rangee.length > 1) { var r = el('rang-btn'); rangee.forEach(function (b) { r.appendChild(b); }); bas.appendChild(r); }
    var s = Math.ceil(cfg.duree); M3.flap($('#fl-m'), pad2(Math.floor(s / 60)), null); M3.flap($('#fl-s'), pad2(s % 60), null);
    gsap.set('#ch-barre', { scaleX: 1, transformOrigin: '0 50%' });
    M3.afficherBoutonMenu(false); S.alerteS = -1;
    if (cfg.tours) { M3.flap($('#fl-tours'), pad2(S.tours), null); }
    if (!deja) {
      c.style.display = 'flex';
      if (M3.rm()) gsap.fromTo(c, { opacity: 0 }, { opacity: 1, duration: T.fondu });
      else {
        gsap.fromTo(c, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: E.sec, clearProps: 'clipPath' });
        gsap.from($$('#chrono .ch-haut > *, #chrono .ch-ligne, #chrono .ch-droite > *, #chrono .ch-barre, #chrono .ch-bas > *'), { y: 50, opacity: 0, duration: 0.5, stagger: 0.04, delay: 0.15, ease: E.sec, clearProps: 'transform,opacity' });
      }
    } else if (!M3.rm()) {   // changement de phase : coupe franche + les chiffres tombent par crans
      gsap.fromTo($$('#chrono .ch-digits, #chrono .ch-haut .gros'), { y: 30, opacity: 0.2 }, { y: 0, opacity: 1, duration: 0.3, ease: 'steps(3)', clearProps: 'transform,opacity' });
    }
  }
  function majChrono(info) {
    var rest = info.restant, s = Math.ceil(rest / 1000), c = $('#chrono'), cfg = C.cfg;
    if (cfg.minuteEmom) { s = Math.ceil((60000 - (info.ecoule % 60000)) / 1000); rest = 60000 - (info.ecoule % 60000); }
    M3.flap($('#fl-m'), pad2(Math.floor(s / 60)), 'desc'); M3.flap($('#fl-s'), pad2(s % 60), 'desc');
    var tot = cfg.minuteEmom ? 60000 : info.duree;
    gsap.set('#ch-barre', { scaleX: Math.max(0, Math.min(1, rest / tot)) });
    var alerte = rest > 0 && rest <= 3000 && cfg.alerte !== false;
    c.dataset.phase = alerte ? 'alerte' : C.base;
    if (alerte && s !== S.alerteS) { S.alerteS = s; M3.bip(880, 0.1, 0.12); M3.vibre(30); }
    if (!alerte) S.alerteS = -1;
    return s;
  }
  function fermerChrono(cb) {
    var c = $('#chrono'); if (S.chrono) { S.chrono.arreter(); S.chrono = null; }
    var fin = function () { c.style.display = 'none'; gsap.set(c, { clearProps: 'clipPath,opacity' }); cb && cb(); };
    if (c.style.display !== 'flex') return fin();
    if (M3.rm()) return gsap.to(c, { opacity: 0, duration: T.fondu, onComplete: fin });
    gsap.fromTo(c, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.42, ease: E.sec, onComplete: fin });
  }
  function bandeau(txt, couleur) {   // bandeau plein écran bref (changement de minute, « Temps ! »)
    var b = el('bandeau', txt); b.style.cssText = 'position:absolute;left:0;right:0;top:34%;height:32%;z-index:9;display:flex;align-items:center;padding:0 18px;background:var(' + (couleur || '--encre') + ');color:var(--c-craie);font:600 96px/.88 var(--font-titre);text-transform:uppercase;border-top:3px solid var(--c-craie);border-bottom:3px solid var(--c-craie)';
    $('#chrono').appendChild(b);
    if (M3.rm()) { gsap.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.1 }); gsap.to(b, { opacity: 0, duration: 0.2, delay: 0.8, onComplete: function () { b.remove(); } }); return; }
    gsap.timeline({ onComplete: function () { b.remove(); } }).fromTo(b, { xPercent: -100 }, { xPercent: 0, duration: 0.25, ease: E.sec }).to({}, { duration: 0.6 }).to(b, { xPercent: 100, duration: 0.25, ease: E.sec });
  }

  /* ---- Repos automatique après une série ---- */
  function lancerRepos(x, k) {
    var ser = S.series[x.id], suiv = ser[k + 1], total = x.repos;
    var info = suiv ? 'Prochaine : série ' + (k + 2) + '/' + ser.length + (x.type === 'temps' ? ' · ' + suiv.duree + ' s' : ' · ' + suiv.reps + ' × ' + fmtVal(suiv.kg, 'kg') + ' kg') : '';
    ouvrirChrono({ phase: 'repos', etiq: 'Repos', sous: x.nom + ' · série ' + (k + 1) + '/' + ser.length + ' faite', duree: total, info: info,
      boutons: [{ txt: '+15 s', cls: 'clair moy duo-b', fn: function () { S.chrono && S.chrono.ajouter(15000); M3.bip(700, 0.05, 0.08); } }, { txt: 'Passer ▸', cls: 'moy duo-b', fn: finRepos }] });
    S.chrono = M3.creerChrono({ duree: total * 1000, onTick: majChrono, onFin: function () { M3.bip(1320, 0.4, 0.14); M3.vibre([80, 60, 80]); finRepos(); } });
    function finRepos() {
      if (S.chrono) { S.chrono.arreter(); S.chrono = null; }
      fermerChrono(function () { var p = panneauCourant(); majBouton(p); if (!M3.rm()) gsap.fromTo($('.serie.prochaine', p), { x: 14 }, { x: 0, duration: 0.5, ease: E.sec, clearProps: 'transform' }); });
    }
  }
  /* ---- Série au temps : chrono de travail, bip à la fin, puis repos ---- */
  function lancerTravail(k) {
    var x = ETAPES[S.i].exo, ser = S.series[x.id], dur = ser[k].duree;
    ouvrirChrono({ phase: 'travail', etiq: 'Travail', sous: x.nom + ' · série ' + (k + 1) + '/' + ser.length, duree: dur, alerte: true,
      boutons: [{ txt: 'Terminé ✓', fn: function () { finir(true); } }] });
    S.chrono = M3.creerChrono({ duree: dur * 1000, onTick: majChrono, onFin: function () { M3.bip(1320, 0.2, 0.14); setTimeout(function () { M3.bip(1320, 0.2, 0.14); }, 260); setTimeout(function () { M3.bip(1760, 0.5, 0.14); }, 520); M3.vibre([200, 80, 200]); finir(false); } });
    function finir(tot) { if (S.chrono) { S.chrono.arreter(); S.chrono = null; } validerSerie(k, true); }
  }

  /* =============== Circuit : explication → overview → chrono plein écran =============== */
  function panneauCircuitExpl(c, i) {
    var p = el('panneau'); p.dataset.i = i;
    p.innerHTML = '<div class="defile-p"><span class="etq">Circuit · ' + c.kind + ' ' + c.minutes + ' min</span><h2 class="ex-nom" style="font-size:150px">' + c.titre + '</h2>' +
      '<div class="bloc acc-bloc"><span class="etq">Objectif</span><p style="font:600 40px/.95 var(--font-titre);text-transform:uppercase;margin-top:6px">' + c.expl.replace('Faites', 'Fais') + '</p></div>' +
      '<div class="bloc"><span class="etq">Comment ça marche</span><p style="margin-top:6px">' + c.detail + '</p></div>' +
      '<div class="bloc"><span class="etq">Préparation</span><p style="margin-top:6px">Un compte à rebours de 10 s démarre avant. Il n\'est pas compté dans ton temps.</p></div></div>' +
      '<div class="p-bas" style="margin-right:-18px"><button class="btn">Voir les exercices ▸</button></div>';
    $('.btn', p).onclick = function () { if (S.busy) return; S.busy = true; var o = panneauCircuitOver(c); $('#s-zone').appendChild(o); M3.whip(p, o, 1, function () { p.remove(); S.busy = false; }); entreePanneau(o, 0.15); };
    return p;
  }
  function panneauCircuitOver(c) {
    var p = el('panneau');
    p.innerHTML = '<div class="defile-p"><span class="etq">' + c.kind + ' ' + c.minutes + ' min · ' + c.exos.length + ' exercices</span><h2 class="ex-nom" style="font-size:72px">À chaque tour</h2>' +
      '<div class="circuit-l"><div class="entete"><b>' + c.kind + ' ' + c.minutes + '\'</b><span class="etq">Vidéos accessibles</span></div>' +
      c.exos.map(function (x, k) { return '<div class="exo-l"><span class="i">' + (k + 1) + '</span><div class="tx"><b>' + x.nom + '</b><span>' + x.note + '</span></div><a class="vid" href="' + x.video + '" target="_blank" rel="noopener" aria-label="Voir la vidéo : ' + x.nom + '">▶</a></div>'; }).join('') + '</div></div>' +
      '<div class="p-bas" style="margin-right:-18px"><button class="btn">Lancer · prépa 10 s</button><button class="btn sec moy" data-retour-c>◂ Explication</button></div>';
    $('.btn', p).onclick = function () { lancerCircuit(c); };
    $('[data-retour-c]', p).onclick = function () { if (S.busy) return; S.busy = true; var e = panneauCircuitExpl(c, S.i); $('#s-zone').appendChild(e); M3.whip(p, e, -1, function () { p.remove(); S.busy = false; }); entreePanneau(e, 0.15); };
    return p;
  }
  function lancerCircuit(c) {
    // 1) préparation 10 s (non comptée) 2) chrono du circuit
    ouvrirChrono({ phase: 'prepa', etiq: 'Prêt ?', sous: c.kind + ' · prépa non comptée', duree: 10, alerte: false,
      boutons: [{ txt: 'Annuler', cls: 'clair moy', fn: function () { if (S.chrono) { S.chrono.arreter(); S.chrono = null; } fermerChrono(); } }] });
    var dernierS = 11;
    S.chrono = M3.creerChrono({ duree: 10000, onTick: function (i) { var s = majChrono(i); if (s !== dernierS && s <= 3 && s > 0) { dernierS = s; } }, onFin: function () { M3.bip(1320, 0.5, 0.14); M3.vibre(120); circuitTravail(c); } });
  }
  function circuitTravail(c) {
    var amrap = c.kind === 'AMRAP', dureeMs = c.duree * 1000;
    if (amrap) S.tours = 0;
    var droite = amrap ? '<span class="etq">Tours</span><span class="num tours" style="font-size:72px;line-height:1"><span id="fl-tours"></span></span>' :
      '<span class="etq">Minute</span><span class="num" style="font-size:58px;line-height:1"><span id="fl-min-e"></span></span><span class="gros" id="emom-exo" style="font-size:34px;line-height:.9"></span>';
    var boutons = amrap ? [{ txt: '+1 tour', cls: 'geant', fn: plusUn }, { txt: '− 1', cls: 'clair moy', fn: function () { if (S.tours > 0) { S.tours--; M3.flap($('#fl-tours'), pad2(S.tours), 'desc'); } } }]
      : [{ txt: 'Arrêter', cls: 'clair moy', fn: function () { M3.confirmer('Arrêter ?', 'L\'EMOM sera arrêté ici.', 'Arrêter', 'Continuer', function () { finCircuit(c); }); } }];
    ouvrirChrono({ phase: 'travail', etiq: c.kind + ' ' + c.minutes + '\'', sous: amrap ? 'Fais le plus de tours possible' : 'Une série par minute', duree: amrap ? c.duree : 60, droite: droite, amrap: amrap, tours: amrap, minuteEmom: !amrap,
      info: amrap ? '10 swings · 8 burpees · 12 mountain climbers' : '', boutons: boutons });
    var rm = M3.rm();
    var minute = -1;
    if (!amrap) M3.flap($('#fl-min-e'), '1/6', null);
    S.alerteS = -1;
    S.chrono = M3.creerChrono({ duree: dureeMs,
      onTick: function (i) {
        if (!amrap) {
          var m = Math.min(5, Math.floor(i.ecoule / 60000));
          if (m !== minute) {
            minute = m; var txt = (m % 2 === 0) ? c.exos[0].nom : c.exos[1].nom;
            $('#emom-exo').textContent = txt; M3.flap($('#fl-min-e'), (m + 1) + '/6', 'asc');
            bandeau('Minute ' + (m + 1) + ' · ' + txt, '--encre'); M3.bip(m % 2 ? 660 : 990, 0.3, 0.12);
          }
        }
        majChrono(i);
      },
      onFin: function () { M3.bip(1760, 0.8, 0.16); M3.vibre([300, 100, 300]); bandeau('Temps !', '--c-rouge'); setTimeout(function () { finCircuit(c); }, 1000); } });
    function plusUn() {
      S.tours++; M3.flap($('#fl-tours'), pad2(S.tours), 'asc'); M3.bip(1100, 0.06, 0.08); M3.vibre(15);
      var b = $('#ch-bas .geant'); if (b && !rm) gsap.fromTo(b, { scale: 0.97 }, { scale: 1, duration: 0.35, ease: E.sec, clearProps: 'transform' });
    }
  }
  function finCircuit(c) {
    if (S.chrono) { S.chrono.arreter(); S.chrono = null; }
    var amrap = c.kind === 'AMRAP';
    fermerChrono(function () {
      M3.afficherBoutonMenu(false);
      var zone = $('#s-zone'), ancien = $('.panneau', zone), p = el('panneau');
      var extra = { reps: 0 };
      p.innerHTML = '<div class="defile-p"><span class="etq">' + c.kind + ' ' + c.minutes + ' min · terminé</span><h2 class="ex-nom">Temps !</h2>' +
        (amrap ? '<div class="bloc acc-bloc"><span class="etq">Tes tours</span><div class="num" style="font-size:118px;line-height:1"><span id="fl-bilan"></span></div></div>' +
          '<button class="val-case" id="v-extra" style="height:190px;flex:none"><span class="etq">Répétitions en plus</span><span class="big"><span class="flap" id="fl-extra"></span></span><span class="un">rép.</span><span class="edit">CHANGER ▸</span></button>'
          : '<div class="bloc acc-bloc"><span class="etq">EMOM terminé</span><p style="font:600 44px/.95 var(--font-titre);text-transform:uppercase;margin-top:6px">6 minutes bouclées. Bien joué.</p></div>') + '</div>' +
        '<div class="p-bas" style="margin-right:-18px">' + (amrap && !S.toursEmom ? '<button class="btn sec moy" id="b-emom">Option : enchaîner l\'EMOM 6 min</button>' : '') + '<button class="btn" id="b-fin">Terminer la séance</button></div>';
      zone.appendChild(p); S.busy = true;
      M3.whip(ancien, p, 1, function () { if (ancien) ancien.remove(); S.busy = false; });
      entreePanneau(p, 0.1);
      if (amrap) {
        M3.flap($('#fl-bilan', p), '00', null); M3.flap($('#fl-extra', p), '00', null);
        gsap.delayedCall(0.4, function () { M3.flap($('#fl-bilan', p), pad2(S.tours), 'asc'); });
        $('#v-extra', p).onclick = function () {
          M3.ouvrirSelecteur({ depuis: $('#v-extra', p), titre: 'Répétitions en plus', sous: 'Dans ton dernier tour', unite: 'rép.', valeurs: rng(0, 30, 1), valeur: extra.reps, fmt: function (v) { return String(v); },
            onOk: function (v) { M3.flap($('#fl-extra', p), pad2(v), v >= extra.reps ? 'asc' : 'desc'); extra.reps = v; S.extra = v; } });
        };
      }
      var be = $('#b-emom', p);
      if (be) be.onclick = function () {
        if (S.busy) return; S.busy = true; S.toursEmom = true;
        var e = panneauCircuitExpl(D.emom, S.i); $('#s-zone').appendChild(e); M3.whip(p, e, 1, function () { p.remove(); S.busy = false; }); entreePanneau(e, 0.15);
      };
      $('#b-fin', p).onclick = function () { finSeance(); };
    });
  }

  /* =============== Tiroir de l'overview : se tire du bord droit =============== */
  var tiroirOuvert = false;
  function majTiroir() {
    var t = $('#t-corps'); t.innerHTML = M3.htmlBlocs();
    $$('.exo-l[data-exo]', t).forEach(function (l) {
      var i = +l.dataset.exo, x = D.exos[i], fait = S.series[x.id].every(function (s) { return s.fait; });
      if (fait) l.classList.add('faite'); if (i === S.i && ETAPES[S.i].kind === 'exo') l.classList.add('courant');
      l.addEventListener('click', function (e) { if (e.target.closest('a')) return; fermerTiroir(function () { versEtape(i); }); });
    });
  }
  function ouvrirTiroir() {
    if (tiroirOuvert || S.busy) return; tiroirOuvert = true; majTiroir();
    var t = $('#tiroir'), v = $('#voile'); t.style.display = 'flex'; v.style.display = 'block';
    gsap.fromTo(v, { opacity: 0 }, { opacity: 0.55, duration: 0.3 });
    gsap.fromTo(t, { xPercent: M3.rm() ? 0 : 100, opacity: M3.rm() ? 0 : 1 }, { xPercent: 0, opacity: 1, duration: T.tiroir, ease: 'power4.out' });
    if (!M3.rm()) gsap.from($$('#t-corps .titre-bloc, #t-corps .exo-l, #t-corps .circuit-l'), { x: 40, opacity: 0, duration: 0.5, stagger: 0.03, delay: 0.15, ease: E.sec, clearProps: 'transform,opacity' });
  }
  function fermerTiroir(cb) {
    if (!tiroirOuvert) return cb && cb(); tiroirOuvert = false;
    var t = $('#tiroir'), v = $('#voile');
    gsap.to(v, { opacity: 0, duration: 0.25, onComplete: function () { v.style.display = 'none'; } });
    gsap.to(t, { xPercent: M3.rm() ? 0 : 100, opacity: M3.rm() ? 0 : 1, duration: 0.4, ease: 'power4.out', onComplete: function () { t.style.display = 'none'; gsap.set(t, { clearProps: 'transform,opacity' }); cb && cb(); } });
  }
  function initTiroir() {
    $('#lang-tiroir').onclick = ouvrirTiroir; $('#t-fermer').onclick = function () { fermerTiroir(); }; $('#voile').onclick = function () { fermerTiroir(); };
    var t = $('#tiroir'), d = null, k = 1;   // tirer vers la droite pour fermer, avec la vitesse du geste
    t.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && !e.target.closest('.t-haut')) return; k = M3.tel.getBoundingClientRect().width / M3.tel.offsetWidth || 1; d = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, go: false }; });
    t.addEventListener('pointermove', function (e) {
      if (!d) return; var dx = (e.clientX - d.x) / k, dy = (e.clientY - d.y) / k;
      if (!d.go && dx > 10 && dx > Math.abs(dy) * 1.5) { d.go = true; t.setPointerCapture(e.pointerId); }
      if (d.go) { d.dx = Math.max(0, dx); gsap.set(t, { x: d.dx }); }
    });
    var fin = function () { if (!d) return; var dd = d; d = null; if (!dd.go) return; var v = dd.dx / Math.max(1, performance.now() - dd.t); if (dd.dx > 110 || v > 0.5) { gsap.set(t, { x: 0 }); fermerTiroir(); } else gsap.to(t, { x: 0, duration: 0.4, ease: E.sec }); };
    t.addEventListener('pointerup', fin); t.addEventListener('pointercancel', fin);
  }

  /* =============== Swipe manuel entre exercices =============== */
  function initSwipe() {
    var z = $('#s-zone'), d = null;
    z.addEventListener('pointerdown', function (e) { if (e.target.closest('a')) return; d = { x: e.clientX, y: e.clientY }; });
    z.addEventListener('pointerup', function (e) {
      if (!d) return; var dx = e.clientX - d.x, dy = e.clientY - d.y; d = null;
      var k = M3.tel.getBoundingClientRect().width / M3.tel.offsetWidth || 1; dx /= k; dy /= k;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && ETAPES[S.i].kind === 'exo' && !tiroirOuvert && $('#serie-detail').style.display !== 'flex') versEtape(S.i + (dx < 0 ? 1 : -1));
    });
  }

  /* =============== Fin de séance : on récompense =============== */
  function stats() {
    var vol = 0, nser = 0, rec = null;
    D.exos.forEach(function (x) {
      S.series[x.id].forEach(function (s) {
        if (!s.fait) return; nser++;
        if (x.type === 'reps') vol += s.reps * s.kg * (x.parJambe ? 2 : 1);
        if (x.prec && s.kg > x.prec.kg && (!rec || s.kg - x.prec.kg > rec.gain)) rec = { nom: x.nom, kg: s.kg, gain: s.kg - x.prec.kg };
      });
    });
    var dur = Math.round((M3.maintenant() - S.t0) / 1000);
    return { vol: Math.round(vol), nser: nser, rec: rec, dur: dur };
  }
  function finSeance() {
    if (S.fini) return; S.fini = true;
    if (S.chrono) { S.chrono.arreter(); S.chrono = null; }
    var st = stats(), f = $('#fin'); M3.occupe(true);
    M3.volets(function () {
      f.style.display = 'flex'; $('#chrono').style.display = 'none';
      var dd = pad2(Math.floor(st.dur / 60)) + ':' + pad2(st.dur % 60);
      ['#f-duree', '#f-volume', '#f-series', '#f-tours'].forEach(function (s) { M3.flap($(s), '00', null); });
      M3.flap($('#f-duree'), '00:00', null); M3.flap($('#f-volume'), '0000', null);
      var tx = $('#f-record-t'); tx.textContent = st.rec ? st.rec.nom + ' · ' + String(st.rec.kg).replace('.', ',') + ' kg (+' + String(st.rec.gain).replace('.', ',') + ')' : 'Séance régulière · série validée';
      $('#f-record .etq').textContent = st.rec ? 'Record perso' : 'Régularité';
      $('#fin-t')._l = null; $('#f-valider').disabled = false;
      st.dd = dd;
    }, { rapide: true, fini: function () {
      M3.occupe(false);
      var tt = $('#fin-t'); M3.entreeLettres(tt, 0);
      gsap.delayedCall(0.2, function () { M3.flap($('#f-duree'), pad2(Math.floor(st.dur / 60)) + ':' + pad2(st.dur % 60), 'asc'); });
      M3.flapMontee($('#f-volume'), 0, st.vol, 1.6, 0.4, 4);
      M3.flapMontee($('#f-series'), 0, st.nser, 1.0, 0.5, 2);
      M3.flapMontee($('#f-tours'), 0, S.tours, 1.0, 0.6, 2);
      if (!M3.rm()) {
        gsap.from('#stats > div', { clipPath: 'inset(0 100% 0 0)', duration: 0.5, stagger: 0.1, ease: E.sec, clearProps: 'clipPath' });
        gsap.from('#f-record', { scale: 1.9, rotation: -9, opacity: 0, duration: 0.55, delay: 1.1, ease: E.sec, clearProps: 'transform,opacity' });   // tampon
        gsap.from('.fin-bas', { yPercent: 100, duration: 0.5, delay: 0.5, ease: E.sec, clearProps: 'transform' });
        M3.fete($('#fete'), 14);
      }
      [0, 140, 280, 560].forEach(function (d, k) { setTimeout(function () { M3.bip([660, 880, 1100, 1480][k], k === 3 ? 0.5 : 0.12, 0.1); }, d); });
      M3.vibre([60, 40, 60, 40, 200]);
    } });
  }

  /* =============== Branchements =============== */
  function initSeance() {
    $('#s-quitter').onclick = function () { M3.quitterSeance(); };
    $('#f-valider').onclick = function () { this.disabled = true; sortirSeance(true); };
    initTiroir(); initSwipe();
  }
  M3.initSeance = initSeance;
  M3._debug = { get S() { return S; }, versEtape: versEtape, finSeance: finSeance };
})(window.M3);
