/* Maquette V2 — check-in du jour. Modèle M2 (petits bruits, chiffres qui passent au-dessus / en dessous,
   humeur), polices M5, animations du questionnaire M1 (mots qui montent, question qui glisse, barre rebondie,
   avance automatique après un choix, célébration en cercle + confettis). Vouvoiement, comme l'app. */
(function () {
  'use strict';
  var REX = window.REX, $ = REX.$, $$ = REX.$$, E = REX.E, REDUIT = REX.REDUIT;
  var QS = [
    { t: 'curseur', cle: 'sommeil', q: 'Comment avez-vous <em>dormi</em> cette nuit ?', aide: 'De 0 (très mal) à 10 (parfaitement).', b: ['Très mal', 'Parfait'], def: 7 },
    { t: 'emoji', cle: 'energie', q: 'Et votre <em>énergie</em> aujourd’hui ?', aide: 'Choisissez celle qui vous ressemble.', o: [['😫', 'À plat'], ['😕', 'Un peu bas'], ['😐', 'Correcte'], ['🙂', 'En forme'], ['🤩', 'Au top']] },
    { t: 'curseur', cle: 'stress', q: 'Votre niveau de <em>stress</em> ?', aide: '0 = zen, 10 = au maximum.', b: ['Zen', 'Au maximum'], def: 3 },
    { t: 'choix', cle: 'douleur', q: 'Une <em>douleur</em> quelque part ?', aide: 'Choisissez ce qui s’en approche le plus.', o: ['Aucune', 'Légère, ça passe', 'Gênante', 'Forte'] },
    { t: 'nombre', cle: 'eau', q: 'Combien d’<em>eau</em> avez-vous bu hier ?', aide: 'Eau, thé, tisanes : tout compte.', def: 1.5, pas: .25, min: 0, max: 5, unite: 'L' }
  ];
  var Q = { i: 0, rep: {}, occupe: false };
  var COCHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="trait" pathLength="1" d="M5 12.5l4.5 4.5L19 7"/></svg>';

  function mots(el, delai) {
    if (REDUIT) return;
    var sp = SplitText.create(el, { type: 'words', mask: 'words', wordsClass: 'qmot' });
    gsap.fromTo(sp.words, { yPercent: 110 }, { yPercent: 0, duration: .9, stagger: .05, delay: delai, ease: E.sortie, onComplete: function () { sp.revert(); } });
  }
  function ecran(i) {
    var q = QS[i], el = document.createElement('div'); el.className = 'q-ecran'; el.dataset.i = i;
    var zone;
    if (q.t === 'curseur') zone = '<div class="cv-val"><span class="cv" aria-live="polite"></span><small>/10</small></div>' +
      '<div class="curs" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="10" aria-valuenow="' + q.def + '" aria-label="' + q.cle + '"><div class="curs-rail"></div><div class="curs-plein"></div><div class="curs-ticks">' + '<i></i>'.repeat(11) + '</div><div class="curs-pion"></div></div>' +
      '<div class="curs-bornes"><span>' + q.b[0] + '</span><span>' + q.b[1] + '</span></div>';
    else if (q.t === 'emoji') zone = '<div class="emojis">' + q.o.map(function (o, k) { return '<button class="emoji" data-k="' + k + '" aria-pressed="false" aria-label="' + o[1] + '"><span>' + o[0] + '</span></button>'; }).join('') + '</div><p class="emoji-l">&nbsp;</p>';
    else if (q.t === 'choix') zone = '<div class="choix">' + q.o.map(function (o, k) { return '<button data-k="' + k + '" aria-pressed="false"><span>' + o + '</span><span class="coche">' + COCHE + '</span></button>'; }).join('') + '</div>';
    else zone = '<div class="nb"><button class="nb-b" data-d="-1" aria-label="Moins"><svg class="ic"><use href="#i-moins"/></svg></button><div class="nb-v"><span class="nbv" aria-live="polite"></span><small>' + q.unite + '</small></div><button class="nb-b" data-d="1" aria-label="Plus"><svg class="ic"><use href="#i-plus"/></svg></button></div><p class="nb-aide">Par quart de litre</p>';
    var auto = q.t === 'emoji' || q.t === 'choix';
    el.innerHTML = '<div class="q-n">' + String(i + 1).padStart(2, '0') + '</div><h2 class="q-q">' + q.q + '</h2><p class="q-aide">' + q.aide + '</p><div class="q-zone">' + zone + '</div>' +
      '<div class="q-bas">' + (auto ? '<p class="q-auto">Touchez une réponse pour continuer</p>' : '<button class="btn btn-prim gros">' + (i === QS.length - 1 ? 'Terminer' : 'Continuer') + '</button>') + '</div>';
    return el;
  }
  function aller(i, premiere) {
    var sc = $('#q-scene'), vieux = $('.q-ecran', sc), el = ecran(i);
    sc.appendChild(el); Q.i = i; Q.occupe = true;
    $('#q-compte').textContent = (i + 1) + ' / ' + QS.length;
    gsap.to('#q-barre', { scaleX: (i + 1) / QS.length, duration: REDUIT ? .2 : .9, ease: REDUIT ? 'none' : 'back.out(1.6)' });
    if (vieux) gsap.to(vieux, { xPercent: REDUIT ? 0 : -28, opacity: 0, scale: REDUIT ? 1 : .94, duration: REDUIT ? .2 : .55, ease: 'power3.inOut', onComplete: function () { vieux.remove(); } });
    var corps = [$('.q-aide', el), $('.q-zone', el), $('.q-bas', el)];
    if (REDUIT) { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .25, onComplete: function () { Q.occupe = false; } }); }
    else {
      gsap.fromTo(el, { xPercent: vieux ? 100 : 0 }, { xPercent: 0, duration: .85, ease: E.page, clearProps: 'transform', onComplete: function () { Q.occupe = false; } });
      gsap.fromTo($('.q-n', el), { yPercent: 50, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, delay: premiere ? .1 : .35, ease: E.sortie });
      mots($('.q-q', el), premiere ? .1 : .4);
      gsap.fromTo(corps, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .09, ease: E.sortie, delay: premiere ? .2 : .5, clearProps: 'transform,opacity' });
    }
    var q = QS[i];
    if (q.t === 'curseur') curseur(el, q);
    if (q.t === 'emoji') emoji(el, q);
    if (q.t === 'choix') choix(el, q);
    if (q.t === 'nombre') nombre(el, q);
    var b = $('.q-bas .btn', el); if (b) b.addEventListener('click', suivant);
  }
  function suivant() { if (Q.occupe) return; if (Q.i >= QS.length - 1) fin(); else aller(Q.i + 1); }

  /* curseur 0-10 : le chiffre roule vers le haut ou le bas (M2), tick à chaque cran */
  function curseur(el, q) {
    var w = $('.curs', el), pion = $('.curs-pion', el), plein = $('.curs-plein', el), cv = $('.cv', el), v = q.def, rect = null;
    Q.rep[q.cle] = v;
    var place = function (anim) {
      var L = w.clientWidth;
      gsap.to(pion, { x: v / 10 * L, duration: anim ? .45 : 0, ease: E.ressort, overwrite: 'auto' });
      gsap.to(plein, { scaleX: v / 10, duration: anim ? .45 : 0, ease: E.sortie, overwrite: 'auto' });
    };
    var set = function (nv) {
      if (nv === v) return;
      REX.rouler(cv, nv, { duree: .5, sens: nv > v ? 1 : -1, stagger: 0 });
      v = nv; Q.rep[q.cle] = v; w.setAttribute('aria-valuenow', v); REX.SONS.tick(); place(true);
    };
    cv.textContent = v; cv.dataset.val = '';
    requestAnimationFrame(function () { place(false); });
    REX.rouler(cv, v, { duree: 1.3, delai: .5 });
    var depuis = function (cx) { return Math.round(Math.max(0, Math.min(1, (cx - rect.left) / rect.width)) * 10); };
    w.addEventListener('pointerdown', function (e) { rect = w.getBoundingClientRect(); w.setPointerCapture(e.pointerId); if (!REDUIT) gsap.to(pion, { scale: 1.18, duration: .25, ease: E.sortie }); set(depuis(e.clientX)); });
    w.addEventListener('pointermove', function (e) { if (w.hasPointerCapture(e.pointerId)) set(depuis(e.clientX)); });
    var lacher = function () { gsap.to(pion, { scale: 1, duration: .4, ease: E.ressort }); };
    w.addEventListener('pointerup', lacher); w.addEventListener('pointercancel', lacher);
    w.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(Math.min(10, v + 1)); } if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(Math.max(0, v - 1)); } });
  }
  /* humeur : l'émoji choisi grandit en rebond (M2), les autres reculent ; avance automatique (M1) */
  function emoji(el, q) {
    var bs = $$('.emoji', el), lab = $('.emoji-l', el);
    bs.forEach(function (b) { b.addEventListener('click', function () {
      if (Q.occupe) return;
      var k = +b.dataset.k; Q.rep[q.cle] = k;
      bs.forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b)); x.classList.toggle('on', x === b);
        if (!REDUIT) gsap.to(x, { scale: x === b ? 1.4 : .86, y: x === b ? -8 : 0, duration: .55, ease: x === b ? 'back.out(2)' : E.sortie });
      });
      lab.textContent = q.o[k][1];
      if (!REDUIT) gsap.fromTo(lab, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: E.sortie });
      REX.SONS.choix();
      Q.occupe = true; setTimeout(function () { Q.occupe = false; suivant(); }, 850);
    }); });
  }
  /* choix unique : la coche se trace (M2), avance automatique (M1) */
  function choix(el, q) {
    var bs = $$('.choix button', el);
    bs.forEach(function (b) { b.addEventListener('click', function () {
      if (Q.occupe) return;
      bs.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); x.classList.toggle('on', x === b); });
      var p = $('.trait', b); if (!REDUIT) gsap.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .45, ease: 'power2.out' });
      Q.rep[q.cle] = +b.dataset.k; REX.SONS.choix();
      Q.occupe = true; setTimeout(function () { Q.occupe = false; suivant(); }, 700);
    }); });
  }
  /* nombre : − / + ; les chiffres passent au-dessus (+) ou en dessous (−) (M2) */
  function nombre(el, q) {
    var v = q.def, nb = $('.nbv', el);
    var fmt = function (x) { return REX.fr(x.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')); };
    nb.dataset.val = ''; REX.rouler(nb, fmt(v), { duree: 1.2, delai: .5 });
    Q.rep[q.cle] = v;
    $$('.nb-b', el).forEach(function (b) { b.addEventListener('click', function () {
      var s = +b.dataset.d, nv = Math.max(q.min, Math.min(q.max, +(v + s * q.pas).toFixed(2)));
      if (nv === v) { if (!REDUIT) gsap.fromTo(nb, { x: s * 6 }, { x: 0, duration: .4, ease: 'elastic.out(1,.3)' }); return; }
      REX.rouler(nb, fmt(nv), { sens: s, duree: .55, stagger: .03 });
      v = nv; Q.rep[q.cle] = v; REX.SONS.tick();
    }); });
  }

  /* fin : l'aplat jaune se répand en cercle (M1), la coche se dessine (M2), confettis */
  function fin() {
    Q.occupe = true;
    var sc = $('#q-scene'), vieux = $('.q-ecran', sc);
    var f = document.createElement('div'); f.className = 'q-fete';
    var r = Q.rep, emo = r.energie != null ? QS[1].o[r.energie][0] : '🙂';
    var rayons = ''; for (var k = 0; k < 12; k++) { var a = k / 12 * Math.PI * 2; rayons += '<line class="rayon" x1="' + (100 + Math.cos(a) * 78) + '" y1="' + (100 + Math.sin(a) * 78) + '" x2="' + (100 + Math.cos(a) * 94) + '" y2="' + (100 + Math.sin(a) * 94) + '"/>'; }
    f.innerHTML = '<svg class="fete-svg" viewBox="0 0 200 200" aria-hidden="true"><circle class="cercle" cx="100" cy="100" r="62" pathLength="1"/>' + rayons + '<path class="coche" pathLength="1" d="M72 102 l19 19 l38 -42"/></svg>' +
      '<h2>Merci, Fabien.</h2><p>Check-in enregistré. Corentin le lira avant votre prochaine séance.</p>' +
      '<div class="resume"><span>Sommeil ' + r.sommeil + '/10</span><span>Énergie ' + emo + '</span><span>Eau ' + REX.fr(r.eau) + ' L</span></div>' +
      '<button class="btn btn-encre gros" id="q-retour">Retour à l’accueil</button><div class="confettis" aria-hidden="true"></div>';
    $('.quiz').appendChild(f);
    $('#q-compte').textContent = 'fini';
    gsap.to('#q-barre', { scaleX: 1, duration: .6, ease: 'back.out(1.6)' });
    REX.SONS.fete(); REX.etat.questFait = true;
    if (REDUIT) { gsap.fromTo(f, { opacity: 0 }, { opacity: 1, duration: .25 }); $$('.cercle, .coche', f).forEach(function (p) { p.style.strokeDashoffset = 0; }); Q.occupe = false; }
    else {
      gsap.timeline({ onComplete: function () { Q.occupe = false; } })
        .fromTo(f, { clipPath: 'circle(0px at 50% 60%)' }, { clipPath: 'circle(900px at 50% 60%)', duration: .9, ease: E.page, clearProps: 'clipPath' }, 0)
        .to($('.cercle', f), { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' }, .5)
        .to($('.coche', f), { strokeDashoffset: 0, duration: .5, ease: 'power2.out' }, 1.15)
        .fromTo($$('.rayon', f), { scale: .6, opacity: 0, transformOrigin: '100px 100px' }, { scale: 1, opacity: 1, duration: .5, stagger: .03, ease: 'back.out(2)' }, 1.4)
        .fromTo($$('h2, p, .resume span, .btn', f), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .08, ease: E.sortie, clearProps: 'transform,opacity' }, .6)
        .add(function () { REX.confettis($('.confettis', f), 40); }, .9);
    }
    $('#q-retour', f).addEventListener('click', function () {
      REX.retourRacine('#c-quest', function () { REX.PAGES['e-dash'].apresQuestionnaire(); $('#m-pastille').hidden = true; $('#pastille-quest2').hidden = true; });
    });
  }

  REX.PAGES['e-quiz'] = {
    avant: function () { Q.i = 0; Q.rep = {}; $('#q-scene').innerHTML = ''; var f = $('.q-fete'); f && f.remove(); gsap.set('#q-barre', { scaleX: 0 }); },
    entrer: function () { aller(0, true); },
    init: function () { $('#q-fermer').addEventListener('click', function () { if (!Q.occupe || $('.q-fete')) REX.fermerCarte(); }); },
    sortie: function () { }
  };
})();
