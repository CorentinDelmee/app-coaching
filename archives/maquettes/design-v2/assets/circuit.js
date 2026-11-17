/* Maquette V2 — circuits. Un circuit qui démarre OUVRE UNE NOUVELLE SECTION (cercle depuis le bouton, l'écran change
   de couleur : M1), déroulé M2 (« Découvrir le circuit » -> exercices -> chrono -> bilan), niveau de détail M4
   (quantité, charge/consigne, vidéo ; EMOM minute par minute). La section SE REFERME à la fin, dans le bouton du circuit.
   « Faire l'option » (M2) : l'option est un CIRCUIT FACULTATIF en fin de séance (EMOM 6 min) ; « Terminer sans l'option »
   termine la séance. Fonctions : ouvrir, etape, lancer, bilan, valider, fermer. */
(function () {
  'use strict';
  var REX = window.REX, $ = REX.$, $$ = REX.$$, E = REX.E, REDUIT = REX.REDUIT, DATA = REX.DATA;
  var L = $('#sc-circuit');
  var cc = { i: -1, btn: null, etape: 1, chrono: null, plus: 0, tours: 0 };
  var FLECHE = '<svg class="ic"><use href="#i-fleche"/></svg>';

  function etapeLi(n, t) { return '<li><b>0' + n + '</b><span>' + t + '</span></li>'; }
  function construire(c, e) {
    var emom = c.format === 'EMOM'
      ? '<div class="emom-min cc-emom">' + Array.from({ length: c.minutes }, function (_, k) { return '<span><b>' + (k + 1) + '</b>' + (k % 2 ? 'pompes' : 'squats') + '</span>'; }).join('') + '</div>' : '';
    L.dataset.teinte = 'inverse';
    L.innerHTML =
      '<div class="cc-haut"><button class="s-icone cc-retour" data-cc="retour" aria-label="Retour"><svg class="ic"><use href="#i-retour"/></svg></button>' +
        '<span class="cc-pos">' + (c.option ? 'Option' : e.bloc.nom) + ' · ' + c.format + '</span>' +
        '<span class="cc-total">Séance <b class="ch-total-v">0:00</b></span></div>' +
      '<div class="cc-scenes">' +
        '<div class="cc-s cc-s1">' +
          '<p class="cc-kicker">' + (c.option ? 'Option facultative' : 'Circuit') + ' · ' + c.minutes + ' minutes</p>' +
          '<h1 class="cc-h1">' + c.format + '</h1>' +
          '<p class="cc-but">' + c.but + '</p>' +
          '<ol class="cc-etapes">' + c.etapes.map(function (t, k) { return etapeLi(k + 1, t); }).join('') + '</ol>' +
          '<div class="cc-cta"><button class="btn gros btn-encre-inv" data-cc="voir">Voir les exercices' + FLECHE + '</button></div>' +
        '</div>' +
        '<div class="cc-s cc-s2">' +
          '<p class="cc-kicker">' + c.format + ' · ' + c.minutes + ' min</p>' +
          '<h2 class="cc-h2">Les exercices</h2>' +
          REX.circuitDetailHTML(c) + emom +
          '<p class="cc-note">' + c.note + '</p>' +
          '<div class="cc-cta"><button class="btn btn-prim gros" data-cc="pret">Je suis prêt</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="sous-couche chrono cc-chrono" hidden></div>' +
      '<div class="voile cc-voile"></div>';
  }

  /* 1. Ouvrir la section depuis le bouton : cercle + voile jaune qui s'efface = changement de couleur (M1/M2) */
  function ouvrir(i, btn) {
    if (REX.estOccupe()) return;
    var c = DATA.exos[DATA.etapes[i].id];
    cc = { i: i, btn: btn, etape: 1, chrono: null, plus: 0, tours: 0, c: c };
    construire(c, DATA.etapes[i]);
    var s1 = $('.cc-s1', L), s2 = $('.cc-s2', L), v = $('.cc-voile', L);
    gsap.set(s2, { xPercent: 100 }); gsap.set(s1, { xPercent: 0 });
    REX.setOccupe(true);
    REX.SONS.choix();
    if (REDUIT) { v.remove(); L.hidden = false; gsap.fromTo(L, { opacity: 0 }, { opacity: 1, duration: .25, onComplete: function () { REX.setOccupe(false); } }); return; }
    v.style.background = 'var(--accent)';
    REX.ouvrirCercle(L, btn, { duree: .85, onFini: function () { REX.setOccupe(false); } });
    gsap.timeline()
      .fromTo(v, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: .7, ease: E.page, onComplete: function () { v.remove(); } }, .42)
      .fromTo('.cc-haut', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: .7, ease: E.sortie }, .55)
      .add(function () { REX.lignes($('.cc-h1', L), { duree: 1.1 }); }, .5)
      .fromTo([$('.cc-kicker', s1), $('.cc-but', s1), $('.cc-etapes', s1), $('.cc-cta', s1)], { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .09, ease: E.sortie, clearProps: 'transform,opacity' }, .62);
  }
  /* 2. Explication -> exercices (glissement M2 ; les quantités roulent) */
  function etape(n) {
    cc.etape = n;
    var s1 = $('.cc-s1', L), s2 = $('.cc-s2', L);
    if (REDUIT) { gsap.set(s2, { xPercent: n === 2 ? 0 : 100 }); gsap.set(s1, { opacity: n === 2 ? 0 : 1 }); return; }
    gsap.to(s1, { xPercent: n === 2 ? -26 : 0, opacity: n === 2 ? .25 : 1, scale: n === 2 ? .94 : 1, duration: .8, ease: E.page });
    gsap.to(s2, { xPercent: n === 2 ? 0 : 100, duration: .8, ease: E.page });
    if (n === 2) {
      REX.lignes($('.cc-h2', s2), { delai: .35 });
      gsap.fromTo($$('.ci-liste li, .cc-emom span, .cc-note, .cc-cta', s2), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .05, delay: .42, ease: E.sortie, clearProps: 'transform,opacity' });
      $$('.ci-q', s2).forEach(function (q, k) { REX.rouler(q, q.textContent, { delai: .5 + k * .08, duree: 1.1 }); });
    }
  }
  /* 3. Chrono : préparation (10 s, non comptée) puis l'écran passe au JAUNE pour le travail */
  function lancer(btn) {
    var c = cc.c, couche = $('.cc-chrono', L);
    couche.dataset.mode = c.format.toLowerCase();
    var phases = [{ type: 'prep', dur: 10, extra: '<span>On commence par</span><b>' + c.items[0].q + ' ' + c.items[0].n.toLowerCase() + '</b>' }];
    if (c.format === 'AMRAP') {
      phases.push({ type: 'travail', dur: c.minutes * 60, extra: '<div class="cc-tours"><b class="cc-tours-n">0</b><span>tours complets</span></div>' });
    } else {
      for (var m = 1; m <= c.minutes; m++) {
        phases.push({ type: 'travail', dur: 60, minute: m, phrase: REX.PHRASES.travail,
          extra: '<span>Minute ' + m + ' sur ' + c.minutes + '</span><b>' + c.minute(m) + '</b><small>' + (m < c.minutes ? 'ensuite : ' + c.minute(m + 1) : 'dernière minute') + '</small>' });
      }
    }
    couche.hidden = false;
    cc.chrono = REX.Chrono(couche, {
      label: c.format + ' · ' + c.minutes + ' min', phases: phases, sansGo: c.format === 'EMOM',
      actions: function (ph, ch) {
        if (ph.type === 'prep') return [{ t: 'Commencer maintenant', cls: 'sec', fn: function () { ch.passer(); } }];
        if (c.format === 'AMRAP') return [{ t: '+1 tour', cls: 'geant', id: 'cc-plus1', fn: plusUnTour }, { t: 'Terminer maintenant', cls: 'petit', fn: function () { ch.terminer(); } }];
        return [{ t: 'Terminer maintenant', cls: 'petit', fn: function () { ch.terminer(); } }];
      },
      onPhase: function (ph, i, ch) {
        if (ph.minute) { REX.SONS.go(); ch.bandeau('Minute ' + ph.minute, 'sur ' + c.minutes + ' · ' + c.minute(ph.minute)); }
        if (ph.type === 'travail' && c.format === 'AMRAP') { var n = $('.cc-tours-n', couche); n.dataset.val = ''; REX.rouler(n, cc.tours, { duree: .6 }); }
      },
      onFin: function () { bilan(); }
    });
    REX.ouvrirCercle(couche, btn, { duree: .6, ease: 'expo.out' });
  }
  function plusUnTour() {
    cc.tours++;
    var n = $('.cc-tours-n', L); REX.rouler(n, cc.tours, { duree: .7, stagger: .04 });
    REX.bip(1320, .07, .2); REX.vibrer(30);
    var b = $('#cc-plus1'); 
  }
  /* 4. Bilan : tours qui roulent + répétitions en plus (grand sélecteur M1) */
  function bilan() {
    var c = cc.c, couche = $('.cc-chrono', L), amrap = c.format === 'AMRAP';
    cc.chrono.visuel('prep');
    var corps = $('.ch-corps', couche), ex = $('.ch-extra', couche);
    corps.innerHTML = amrap
      ? '<div class="cc-bilan"><div class="cc-b-n"><b class="cc-b-tours">0</b><span>tours<br>complets</span></div>' +
        '<button class="champ champ-bilan" data-cc="plus"><span class="ch-lab">Répétitions en plus<em>Modifier</em></span><span class="ch-val"><span class="v">' + cc.plus + '</span><small>reps</small></span></button></div>'
      : '<div class="cc-bilan"><div class="cc-b-n"><b class="cc-b-tours">0</b><span>minutes<br>enchaînées</span></div></div>';
    ex.innerHTML = '<span>' + c.format + ' · ' + c.minutes + ' min</span><b>' + (amrap ? 'Bien joué. Notez vos tours.' : 'Option terminée. Bravo.') + '</b>';
    var a = $('.ch-actions', couche); a.classList.remove('duo');
    a.innerHTML = '<button class="btn-ch" data-cc="valider">Valider le circuit</button>';
    REX.rouler($('.cc-b-tours', couche), amrap ? cc.tours : c.minutes, { delai: .3, duree: 1.4 });
    if (!REDUIT) gsap.fromTo([corps, ex, a], { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .08, ease: E.sortie, clearProps: 'transform,opacity' });
  }
  /* 5. Valider : la section se referme dans le bouton du circuit, la page affiche le résultat */
  function valider() {
    var c = cc.c, st = REX.seance.etat(), i = cc.i;
    st.fait[i] = true;
    st.resultats[c.id] = c.format === 'AMRAP'
      ? { titre: cc.tours + ' tours' + (cc.plus ? ' + ' + cc.plus + ' reps' : ''), sous: 'AMRAP · 8 minutes' }
      : { titre: c.minutes + ' minutes', sous: 'EMOM terminé' };
    if (cc.chrono) { cc.chrono.stop(); cc.chrono = null; }
    var panel = REX.seance.majPanel(i), cible = $('[data-act]', panel);
    REX.SONS.fete();
    REX.fermerCercle(L, cible, { duree: .7, onFini: function () {
      L.innerHTML = '';
      if (!REDUIT) gsap.fromTo($('.p-resultat', panel), { scale: .9, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, ease: E.pop, clearProps: 'transform,opacity' });
      REX.seance.proposerSuite(i);
    } });
  }
  function fermer() {
    if (cc.chrono) { cc.chrono.stop(); cc.chrono = null; }
    REX.fermerCercle(L, cc.btn, { duree: .6, onFini: function () { L.innerHTML = ''; } });
  }

  L.addEventListener('click', function (e) {
    var a = e.target.closest('[data-cc]'); if (!a) return;
    var k = a.dataset.cc;
    if (k === 'voir') etape(2);
    else if (k === 'retour') { if (cc.etape === 2) etape(1); else fermer(); }
    else if (k === 'pret') lancer(a);
    else if (k === 'valider') valider();
    else if (k === 'plus') REX.Selecteur.ouvrir({ def: REX.CHAMPS.plus, val: cc.plus, champ: a, sous: 'Dernier tour incomplet', onValider: function (v) { cc.plus = v; } });
  });
  REX.circuit = { ouvrir: ouvrir, reset: function () { if (cc.chrono) { cc.chrono.stop(); cc.chrono = null; } } };
})();
