/* M5 « Profondeur » — écrans : accueil, programme, coaching, workout, questionnaire. */
(function () {
  'use strict';
  var REX = window.REX, $ = REX.$, $$ = REX.$$, T = REX.T, E = REX.E, d = REX.d, REDUIT = REX.REDUIT, DATA = REX.DATA;
  var CHECK = '<svg class="ic"><use href="#i-check"/></svg>';
  var PLAY = '<svg class="ic"><use href="#i-play"/></svg>';

  /* ---------- outils partagés ---------- */
  // Pose d'une carte dans le paquet selon son rang (0 = devant). Sert à la séance et au questionnaire.
  var Y = [0, -52, -96, -128], Z = [0, -80, -160, -240], VOILE = [0, .2, .38, .52];
  REX.poseRel = function (rel) {
    if (rel < 0) return { x: -480, y: 0, z: -60, rotationY: 32, rotationZ: -7, rotationX: 0, autoAlpha: 0, voile: 0 };
    var k = Math.min(rel, 3);
    return { x: 0, y: Y[k], z: Z[k], rotationY: 0, rotationZ: 0, rotationX: k * 1.5, autoAlpha: rel > 3 ? 0 : 1, voile: VOILE[k] };
  };
  REX.compter = function (el, vers, o) {
    o = o || {}; var obj = { v: o.de || 0 }, fmt = o.format || function (v) { return Math.round(v); };
    return gsap.to(obj, { v: vers, duration: d(o.duree || 1.4), delay: o.delai || 0, ease: 'expo.out',
      onUpdate: function () { el.textContent = fmt(obj.v); } });
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
  REX.formatTemps = function (ms, avecHeure) {
    var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60);
    return m + ':' + ('0' + (s % 60)).slice(-2);
  };

  /* ================= ACCUEIL ================= */
  var dash = { split: null, pret: false, tilts: null };
  REX.PAGES['e-dash'] = {
    init: function () {
      var h = $('#salut-h');
      dash.split = SplitText.create(h, { type: 'chars', charsClass: 'car' });
      var page = $('#e-dash');
      // parallaxe douce à la souris : cartes qui s'inclinent, décor qui glisse en sens inverse
      page.addEventListener('pointermove', function (e) {
        if (!dash.pret || e.pointerType === 'touch' || REDUIT) return;
        var r = page.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        if (!dash.tilts) {
          dash.tilts = $$('.carte', page).map(function (c) {
            return { qy: gsap.quickTo(c, 'rotationY', { duration: .6, ease: 'power3.out' }), qx: gsap.quickTo(c, 'rotationX', { duration: .6, ease: 'power3.out' }), k: +c.dataset.couche };
          });
          dash.deco = $$('.deco [data-depth]', page).map(function (el) {
            return { qx: gsap.quickTo(el, 'x', { duration: 1, ease: 'power3.out' }), qy: gsap.quickTo(el, 'y', { duration: 1, ease: 'power3.out' }), k: +el.dataset.depth };
          });
        }
        dash.tilts.forEach(function (t) { t.qy(px * 7 * (1 + t.k * .3)); t.qx(-py * 6 * (1 + t.k * .3)); });
        dash.deco.forEach(function (t) { t.qx(-px * 26 * t.k); t.qy(-py * 22 * t.k); });
      });
      page.addEventListener('pointerleave', function () {
        if (!dash.tilts) return;
        dash.tilts.forEach(function (t) { t.qy(0); t.qx(0); }); dash.deco.forEach(function (t) { t.qx(0); t.qy(0); });
      });
    },
    entrer: function (page, o) {
      dash.pret = false;
      var tl = gsap.timeline({ onComplete: function () { dash.pret = true; } });
      var cartes = $$('.carte', page);
      if (REDUIT) {
        tl.fromTo([page.querySelector('.haut'), page.querySelector('.salut'), cartes], { opacity: 0 }, { opacity: 1, duration: .3, stagger: 0 });
      } else {
        tl.fromTo('.deco-n', { opacity: 0, y: 90, z: -400 }, { opacity: 1, y: 0, z: 0, duration: 1.8, ease: E.sortie }, 0)
          .fromTo('.deco-o1, .deco-o2', { opacity: 0, scale: .5 }, { opacity: 1, scale: 1, duration: 2, ease: E.sortie }, 0)
          .fromTo('.haut', { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: .8, ease: E.sortie }, .05)
          .fromTo('.salut-p, .salut-date', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .8, stagger: .1, ease: E.sortie }, .1)
          .fromTo(dash.split.chars, { opacity: 0, z: -360, y: 70, rotationX: -80 },
            { opacity: 1, z: 0, y: 0, rotationX: 0, duration: 1.1, stagger: .055, ease: E.sortie }, .08);
        cartes.forEach(function (c, i) {
          var k = +c.dataset.couche;       // couche 1 = loin, 3 = près : vitesses et distances différentes
          tl.fromTo(c, { opacity: 0, z: -200 - k * 80, y: 60 + k * 36, rotationX: 18, rotationY: 0 },
            { opacity: 1, z: 0, y: 0, rotationX: 0, duration: .85 + k * .14, ease: E.sortie }, .12 + i * .08);
        });
      }
      // l'anneau se remplit et le chiffre compte
      var n = REX.etat.seances, val = $('#as-val');
      tl.fromTo(val, { strokeDashoffset: 314.16 }, { strokeDashoffset: 314.16 * (1 - n / 3), duration: d(1.4), ease: E.sortie }, .5);
      tl.add(function () { REX.compter($('#as-n'), n, { duree: 1.1, de: 0 }); }, .5);
      if (!REX.etat.questFait) tl.fromTo('#pastille-quest', { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: E.ressort }, 1.1);
    },
    /* Retour d'une séance validée : l'anneau passe de 1/3 à 2/3 */
    apresSeance: function () {
      var n = Math.min(3, REX.etat.seances + 1); REX.etat.seances = n;
      var val = $('#as-val'), nEl = $('#as-n');
      $('#c-etat').textContent = 'Fait'; $('#c-etat').classList.add('fait');
      $('#c-semaine-txt').textContent = n >= 3 ? 'Semaine bouclée !' : (3 - n) + ' séance à faire';
      gsap.to(val, { strokeDashoffset: 314.16 * (1 - n / 3), duration: d(1.5), ease: 'expo.out' });
      REX.compter(nEl, n, { duree: 1, de: n - 1 });
      if (!REDUIT) gsap.fromTo('#c-semaine', { scale: 1 }, { scale: 1.06, z: 40, duration: .35, yoyo: true, repeat: 1, ease: 'power2.out', delay: .1 });
    }
  };

  /* ================= PROGRAMME ================= */
  var prog = { vue: 'semaine', place: false };
  var JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  function construireProgramme() {
    var cols = $('#cols'); cols.innerHTML = '';
    DATA.semaineCourante.forEach(function (n, i) {
      var c = document.createElement('div'); c.className = 'col' + (n === 20 ? ' auj' : ''); c.dataset.j = i;
      var zone = '<span class="vide"></span>', stt = '';
      if (n === 19) { zone = '<span class="w-chip fait">W1</span>'; stt = '<span class="stt">' + CHECK + '</span>'; }
      if (n === 20) { zone = '<span class="w-chip">W2</span>'; stt = '<span class="stt">Aujourd’hui</span>'; }
      c.innerHTML = '<span class="j">' + JOURS[i] + '</span><span class="n">' + n + '</span><div class="zone">' + zone + '</div>' + (stt || '<span class="stt"></span>');
      cols.appendChild(c);
    });
    var wl = $('#wl'); wl.innerHTML = '';
    wl.innerHTML =
      '<li><button class="wli auj" data-teinte="accent" data-ouvre="e-workout"><span class="w-chip">W2</span><span class="wli-t">Bas du corps + circuit<small>Prévu aujourd’hui · 50 min</small></span><span class="wli-a"><svg class="ic"><use href="#i-fleche"/></svg></span></button></li>' +
      '<li><div class="wli" id="wli3"><span class="w-chip" id="chip-w3">W3</span><span class="wli-t" id="wli3-t">Full body<small>À placer cette semaine</small></span><button class="placer" id="btn-placer">Jeu. 22</button></div></li>' +
      '<li class="etiq wl-sep">Fait</li>' +
      '<li><div class="wli fait"><span class="w-chip fait">W1</span><span class="wli-t">Haut du corps<small>Fait lundi 19 octobre</small></span><span class="wli-a">' + CHECK + '</span></div></li>';
    // mois
    var g = $('#mois-grille'); g.innerHTML = '';
    var cases = [28, 29, 30]; for (var i = 1; i <= 31; i++) cases.push(i); cases.push(1);
    cases.forEach(function (n, idx) {
      var hors = (idx < 3) || (idx === cases.length - 1);
      var el = document.createElement('div'); el.className = 'jour';
      var inner = String(n);
      if (hors) el.classList.add('hors');
      else {
        if (DATA.semaineCourante.indexOf(n) >= 0) el.classList.add('sem');
        if (n === 20) { el.classList.add('auj'); inner += '<small>W2</small>'; }
        else if (DATA.fait.indexOf(n) >= 0) { inner += '<span class="pt">' + CHECK + '</span>'; }
        if (n === DATA.coachingJour) el.classList.add('coach');
      }
      el.innerHTML = inner; g.appendChild(el);
    });
    $('#btn-placer').addEventListener('click', placerW3);
    $$('#seg-vue button').forEach(function (b) { b.addEventListener('click', function () { basculerVue(b.dataset.vue); }); });
  }
  /* W3 vole de la liste jusqu'à la colonne du jeudi (Flip) */
  function placerW3() {
    if (prog.place) return; prog.place = true;
    var chip = $('#chip-w3'), zone = $('.col[data-j="3"] .zone');
    var etat = Flip.getState(chip);
    zone.innerHTML = ''; zone.appendChild(chip);
    $('#btn-placer').remove();
    $('#wli3-t').innerHTML = 'Full body<small>Placé jeudi 22 octobre</small>';
    chip.id = '';
    Flip.from(etat, { duration: d(.9), ease: E.page, scale: true, zIndex: 20, absolute: false });
    var c = $('.col[data-j="3"]'); if (!REDUIT) gsap.fromTo(c, { z: 0 }, { z: 50, duration: .4, yoyo: true, repeat: 1, delay: .55, ease: 'power2.out' });
  }
  function basculerVue(v) {
    if (v === prog.vue) return;
    var sem = $('#vue-semaine'), mois = $('#vue-mois'), de = v === 'mois' ? sem : mois, vers = v === 'mois' ? mois : sem;
    prog.vue = v;
    $$('#seg-vue button').forEach(function (b) { b.classList.toggle('on', b.dataset.vue === v); });
    var seg = $('#seg-vue'), w = seg.clientWidth / 2 - 5 + 0;
    gsap.to('.seg-i', { x: v === 'mois' ? seg.clientWidth / 2 - 5 : 0, duration: d(.55), ease: E.vaul });
    var sens = v === 'mois' ? 1 : -1;
    gsap.timeline()
      .to(de, { opacity: 0, rotationX: REDUIT ? 0 : -38 * sens, y: REDUIT ? 0 : -24 * sens, z: REDUIT ? 0 : -220, duration: d(.32), ease: 'power3.out' })
      .add(function () { de.hidden = true; vers.hidden = false; })
      .fromTo(vers, { opacity: 0, rotationX: REDUIT ? 0 : 38 * sens, y: REDUIT ? 0 : 28 * sens, z: REDUIT ? 0 : -220 }, { opacity: 1, rotationX: 0, y: 0, z: 0, duration: d(.75), ease: E.sortie, clearProps: 'transform' })
      .add(function () {
        gsap.set(de, { clearProps: 'all' });
        if (v === 'mois' && !REDUIT) gsap.fromTo('#mois-grille .jour', { opacity: 0, z: -140, rotationX: 40 }, { opacity: 1, z: 0, rotationX: 0, duration: .7, stagger: { each: .012, from: 'start' }, ease: E.sortie, clearProps: 'transform' });
        if (v === 'semaine' && !REDUIT) gsap.fromTo('#cols .col', { opacity: 0, z: -160 }, { opacity: 1, z: 0, duration: .6, stagger: .04, ease: E.sortie, clearProps: 'transform' });
      }, '<.05');
  }
  REX.PAGES['e-prog'] = {
    init: construireProgramme,
    avant: function (page, o) {
      // toujours repartir en vue semaine
      if (prog.vue !== 'semaine') { prog.vue = 'semaine'; $('#vue-semaine').hidden = false; $('#vue-mois').hidden = true; $$('#seg-vue button').forEach(function (b) { b.classList.toggle('on', b.dataset.vue === 'semaine'); }); gsap.set('.seg-i', { x: 0 }); }
    },
    entrer: function (page) {
      REX.cascade(page);
      var cols = $$('#cols .col');
      if (REDUIT) return;
      gsap.fromTo(cols, { opacity: 0, z: -280, rotationX: -30, y: 50 },
        { opacity: 1, z: function (i, el) { return el.classList.contains('auj') ? 40 : 0; }, rotationX: 0, y: 0, duration: 1, stagger: .06, ease: E.sortie, delay: .12 });
      gsap.fromTo('.wli', { opacity: 0, z: -140, y: 30 }, { opacity: 1, z: 0, y: 0, duration: .8, stagger: .08, ease: E.sortie, delay: .35, clearProps: 'transform' });
    }
  };

  /* ================= COACHING ================= */
  REX.PAGES['e-coach'] = {
    init: function () {
      // feuille WhatsApp : naît du bouton touché
      var MSG = {
        modifier: { t: 'Demander une modification', m: 'Bonjour Corentin, je voudrais modifier ma séance du mardi 27 octobre à 18 h 30. Serait-il possible de la décaler ?' },
        annuler: { t: 'Annuler la séance', m: 'Bonjour Corentin, je dois annuler ma séance du mardi 27 octobre à 18 h 30. Désolé pour le dérangement !' },
        mot: { t: 'Envoyer un mot', m: 'Bonjour Corentin, ' }
      };
      var sheet = $('#o-wa'), srcBtn = null;
      function ouvrir(b) {
        var k = b.dataset.wa, m = MSG[k]; srcBtn = b;
        $('#wa-titre').textContent = m.t; $('#wa-msg').textContent = m.m;
        $('#wa-etiq').textContent = k === 'annuler' ? 'Annulation gratuite · plus de 24 h avant' : 'WhatsApp';
        $('#wa-lien').href = 'https://wa.me/?text=' + encodeURIComponent(m.m);
        REX.reveler(sheet, b, { duree: .7, rayonFin: REX.RAYON, ease: E.sortie });
        if (!REDUIT) gsap.fromTo(sheet.children, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .06, ease: E.sortie, delay: .12 });
      }
      REX.fermerWa = function () { if (sheet.hidden) return false; REX.refermer(sheet, srcBtn, { duree: .5, ease: E.page }); return true; };
      $$('[data-wa]').forEach(function (b) { b.addEventListener('click', function () { ouvrir(b); }); });
      $('#wa-fermer').addEventListener('click', REX.fermerWa);
    },
    entrer: function (page) {
      REX.cascade(page);
      var s = $$('.stat b', page);
      if (s[1]) REX.compter(s[1], 105, { duree: 1.6, delai: .5, format: function (v) { return Math.round(v) + ' €'; } });
    },
    sortie: function () { REX.fermerWa && REX.fermerWa(); }
  };

  /* ================= QUESTIONNAIRES (liste) / À VENIR ================= */
  REX.PAGES['e-quest'] = { entrer: function (p) { REX.cascade(p); } };
  ['e-suivi', 'e-profil'].forEach(function (id) {
    REX.PAGES[id] = {
      entrer: function (p) {
        REX.cascade(p);
        if (REDUIT) return;
        var c = $$('.pile3d i', p);
        gsap.fromTo(c, { z: -300, y: 80, rotationX: 50, opacity: 0 }, { z: function (i) { return i * 40; }, y: function (i) { return -i * 12; }, rotationX: 18, rotationY: function (i) { return -10 + i * 2; }, opacity: 1, duration: 1.4, stagger: .12, ease: E.sortie });
        gsap.to(c, { rotationY: '+=16', y: '-=8', duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .2, delay: 1.5 });
      },
      sortie: function (p) { gsap.killTweensOf($$('.pile3d i', p)); }
    };
  });

  /* ================= WORKOUT (overview) ================= */
  function construireWorkout() {
    var X = DATA.exos, b = $('#wo-blocs'), yt = function (n) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(n); };
    function exo(e, texte) {
      return '<div class="exo"><span class="exo-t">' + e.nom + '<small>' + texte + '</small></span><a class="exo-v" href="' + yt(e.nom) + '" target="_blank" rel="noopener" aria-label="Vidéo : ' + e.nom + '">' + PLAY + '</a></div>';
    }
    function bloc(titre, dur, html) { return '<div class="bloc" data-entree><div class="bloc-t"><span class="etiq">' + titre + '</span><span>' + dur + '</span></div>' + html + '</div>'; }
    var h = '';
    h += bloc('Échauffement', '3 min', exo(X[0], '2 × 45 s · repos 20 s'));
    h += bloc('Bloc A', '18 min', exo(X[1], '4 × 10 · 16 kg · repos 90 s · avant : 10 × 14 kg') + exo(X[2], '3 × 8 par jambe · 10 kg · repos 75 s'));
    h += bloc('Bloc B', '14 min', exo(X[3], '3 × 12 · 40 kg · repos 90 s') + exo(X[4], '3 × 40 s · repos 30 s'));
    h += bloc('Circuit', '8 min',
      '<div class="exo circuit"><span class="exo-t">AMRAP 8 min<small>10 swings (16 kg) · 8 burpees · 12 mountain climbers</small></span><span class="exo-v">' + PLAY + '</span></div>');
    h += bloc('Option · finisher', '6 min',
      '<div class="exo"><span class="exo-t">EMOM 6 min<small>Impair : 12 air squats · pair : 10 pompes</small></span><span class="exo-v">' + PLAY + '</span></div>');
    b.innerHTML = h;
  }
  REX.PAGES['e-workout'] = {
    init: construireWorkout,
    avant: function (page) { page.querySelector('#wo-corps').scrollTop = 0; },
    entrer: function (page) {
      REX.cascade(page);
    }
  };

  /* ================= QUESTIONNAIRE ================= */
  var QS = [
    { t: 'curseur', cle: 'Sommeil', q: 'Comment as-tu dormi cette nuit ?', min: 'Très mal', max: 'Très bien', v: 7 },
    { t: 'curseur', cle: 'Énergie', q: 'Quel est ton niveau d’énergie ce matin ?', min: 'À plat', max: 'Au top', v: 6 },
    { t: 'emoji', cle: 'Humeur', q: 'Et ton humeur du moment ?', o: [['😣', 'Très bas'], ['😕', 'Bof'], ['😐', 'Neutre'], ['🙂', 'Bien'], ['😄', 'Super']] },
    { t: 'choix', cle: 'Douleur', q: 'Une douleur ou une gêne aujourd’hui ?', o: [['Aucune', 'Tout va bien'], ['Légère', 'Je la sens à peine'], ['Gênante', 'Elle me limite'], ['Forte', 'J’en parle à Corentin']] },
    { t: 'choix', cle: 'Hydratation', q: 'Combien d’eau as-tu bu hier ?', o: [['Moins d’un litre', ''], ['Entre 1 et 2 litres', ''], ['Plus de 2 litres', '']] }
  ];
  var quiz = { i: 0, cartes: [], rep: [], occupe: false, sliders: [], fini: false };
  function construireQuiz() {
    var pile = $('#q-pile'); pile.innerHTML = ''; quiz.cartes = []; quiz.rep = QS.map(function (q) { return q.v == null ? null : q.v; }); quiz.i = 0; quiz.fini = false;
    QS.forEach(function (q, i) {
      var c = document.createElement('article'); c.className = 'qc';
      var corps = '';
      if (q.t === 'curseur') {
        corps = '<div class="q-val"><span class="qv">' + q.v + '</span><i>/10</i></div><div class="q-ext"><span>' + q.min + '</span><span>' + q.max + '</span></div>' +
          '<div class="sl"><div class="sl-piste"><i></i></div><div class="sl-pouce"></div></div>';
      } else if (q.t === 'emoji') {
        corps = '<p class="q-lib" aria-live="polite">Touche un visage</p><div class="emojis">' + q.o.map(function (o, k) { return '<button class="emoji" data-k="' + k + '" aria-label="' + o[1] + '">' + o[0] + '</button>'; }).join('') + '</div>';
      } else {
        corps = '<div class="choix">' + q.o.map(function (o, k) { return '<button data-k="' + k + '"><span>' + o[0] + '</span><small>' + o[1] + '</small></button>'; }).join('') + '</div>';
      }
      c.innerHTML = '<span class="etiq">' + q.cle + ' · ' + (i + 1) + ' sur ' + QS.length + '</span><h2>' + q.q + '</h2>' + corps + '<div class="voile"></div>';
      pile.appendChild(c); quiz.cartes.push(c);
    });
    // réponses : emoji et choix avancent tout seuls
    $$('.emoji', pile).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.closest('.qc'), i = quiz.cartes.indexOf(c); if (i !== quiz.i) return;
        $$('.emoji', c).forEach(function (x) { x.classList.toggle('on', x === b); });
        quiz.rep[i] = +b.dataset.k; $('.q-lib', c).textContent = QS[i].o[+b.dataset.k][1];
        if (!REDUIT) gsap.fromTo(b, { scale: 1 }, { scale: 1.22, duration: .2, yoyo: true, repeat: 1, ease: 'power2.out' });
        majBoutonQuiz(); setTimeout(function () { if (quiz.i === i) quizSuivant(); }, 650);
      });
    });
    $$('.choix button', pile).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.closest('.qc'), i = quiz.cartes.indexOf(c); if (i !== quiz.i) return;
        $$('.choix button', c).forEach(function (x) { x.classList.toggle('on', x === b); });
        quiz.rep[i] = +b.dataset.k; majBoutonQuiz(); setTimeout(function () { if (quiz.i === i) quizSuivant(); }, 600);
      });
    });
  }
  function initSliders() {
    quiz.sliders.forEach(function (s) { s.kill(); }); quiz.sliders = [];
    QS.forEach(function (q, i) {
      if (q.t !== 'curseur') return;
      var c = quiz.cartes[i], sl = $('.sl', c), pouce = $('.sl-pouce', c), fill = $('.sl-piste i', c), val = $('.qv', c);
      var W = sl.clientWidth, pas = (W - 56) / 10, dernier = q.v;
      function maj(v, anime) {
        val.textContent = v; quiz.rep[i] = v;
        gsap.set(fill, { scaleX: (v * pas + 28) / W });
        if (v !== dernier) { dernier = v; REX.vibrer(6); REX.bip(1300 + v * 60, .03, .035); if (!REDUIT) gsap.fromTo(val, { scale: 1.05 }, { scale: 1, duration: .25, ease: 'power3.out' }); }
      }
      gsap.set(pouce, { x: q.v * pas }); maj(q.v);
      quiz.sliders.push(Draggable.create(pouce, { type: 'x', bounds: { minX: 0, maxX: W - 56 }, trigger: sl, liveSnap: { x: function (x) { return Math.round(x / pas) * pas; } },
        zIndexBoost: false, onDrag: function () { maj(Math.round(this.x / pas)); }, onPress: function () { gsap.to(pouce, { scale: 1.12, duration: .2 }); }, onRelease: function () { gsap.to(pouce, { scale: 1, duration: .35, ease: E.ressort }); },
        onPressInit: function () { }, minimumMovement: 2 })[0]);
      // un appui sur la piste déplace le pouce
      $('.sl-piste', c).addEventListener('pointerdown', function (e) {
        var r = sl.getBoundingClientRect(), v = Math.max(0, Math.min(10, Math.round(((e.clientX - r.left) - 28) / pas)));
        gsap.to(pouce, { x: v * pas, duration: .35, ease: 'expo.out', onUpdate: function () { sliderSync(i, pouce, pas, fill, val); } }); maj(v);
      });
    });
  }
  function sliderSync(i, pouce, pas, fill, val) { }
  function majBoutonQuiz() {
    var b = $('#q-suivant'), last = quiz.i === QS.length - 1;
    var txt = last ? 'Terminer' : 'Suivant';
    if (b.textContent !== txt) b.textContent = txt;
    var q = QS[quiz.i], besoin = q.t !== 'curseur' && quiz.rep[quiz.i] == null;
    b.disabled = besoin; b.style.opacity = besoin ? .45 : 1;
  }
  function poserQuiz(anime, dir) {
    quiz.cartes.forEach(function (c, i) {
      var rel = i - quiz.i, p = REX.poseRel(rel), v = $('.voile', c);
      var cible = { x: p.x, y: p.y, z: p.z, rotationX: p.rotationX, rotationY: p.rotationY, rotationZ: p.rotationZ, autoAlpha: p.autoAlpha };
      c.style.pointerEvents = rel === 0 ? 'auto' : 'none';
      if (anime) {
        gsap.to(c, Object.assign({ duration: rel < 0 ? d(.6) : d(.85), ease: E.sortie, overwrite: 'auto' }, REDUIT ? { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0 } : cible));
        gsap.to(v, { opacity: p.voile, duration: .6, ease: E.sortie });
      } else { gsap.set(c, cible); gsap.set(v, { opacity: p.voile }); }
      c.style.zIndex = 10 - Math.abs(rel);
    });
    $('#q-compte').textContent = (Math.min(quiz.i + 1, QS.length)) + ' / ' + QS.length;
    gsap.to('#q-barre', { scaleX: (quiz.i + 1) / QS.length, duration: d(.7), ease: 'expo.out' });
    majBoutonQuiz();
  }
  function quizSuivant() {
    if (quiz.fini || quiz.i < 0) return;
    if (quiz.i >= QS.length - 1) { quizFin(); return; }
    quiz.i++; poserQuiz(true);
  }
  function quizFin() {
    quiz.fini = true;
    var fete = $('#q-fete'), badge = $('#q-badge');
    REX.etat.questFait = true;
    REX.reveler(fete, $('#q-suivant'), { duree: .85, rayonFin: REX.RAYON });
    if (!REDUIT) {
      gsap.fromTo(badge, { rotationY: -180, scale: .4, z: -300, opacity: 0 }, { rotationY: 0, scale: 1, z: 0, opacity: 1, duration: 1.1, ease: E.sortie, delay: .45 });
      gsap.fromTo($$('#q-fete h2, #q-fete p, #q-retour'), { y: 40, opacity: 0, z: -120 }, { y: 0, opacity: 1, z: 0, duration: .9, stagger: .1, ease: E.sortie, delay: .65 });
      gsap.delayedCall(.9, function () { REX.confettis($('#q-confettis'), 26); REX.bip(660, .1, .12); setTimeout(function () { REX.bip(990, .18, .12); }, 110); REX.vibrer([30, 40, 30]); });
    }
  }
  REX.PAGES['e-quiz'] = {
    avant: function (page) {
      $('#q-fete').hidden = true; construireQuiz(); gsap.set($('#q-barre'), { scaleX: .2 });
      gsap.set($$('.quiz > *', page), { clearProps: 'opacity' });
    },
    entrer: function (page) {
      initSliders(); poserQuiz(false);
      if (REDUIT) return;
      quiz.cartes.forEach(function (c, i) {
        var p = REX.poseRel(i);
        gsap.fromTo(c, { z: p.z - 300, y: p.y + 90, rotationX: 24, autoAlpha: 0 }, { z: p.z, y: p.y, rotationX: p.rotationX, autoAlpha: 1, duration: 1, ease: E.sortie, delay: .1 + i * .06 });
      });
      gsap.fromTo('.q-haut, .q-bas', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .1, ease: E.sortie, clearProps: 'transform,opacity' });
    },
    sortie: function () { quiz.sliders.forEach(function (s) { s.kill(); }); quiz.sliders = []; }
  };
  REX.initQuiz = function () {
    $('#q-suivant').addEventListener('click', quizSuivant);
    $('#q-fermer').addEventListener('click', function () { REX.fermerCarte(); });
    $('#q-retour').addEventListener('click', function () {
      REX.retourRacine(REX.pile[0].el.id === 'e-dash' ? '#c-quest' : '#q-item-checkin', function () {
        $('#pastille-quest').hidden = true; $('#pastille-quest2').hidden = true; $('#m-pastille').hidden = true;
        $('#c-quest-t').textContent = 'Check-in fait';
        var it = $('#q-item-checkin'); it.querySelector('.qi-s').textContent = 'Fait aujourd’hui'; it.dataset.teinte = 'surface'; it.removeAttribute('data-ouvre');
      });
      gsap.to('#pastille-quest', { scale: .5, opacity: 0, duration: .4, ease: 'power3.out' });
    });
  };
})();
