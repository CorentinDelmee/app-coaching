/* Maquette V2 — écrans : accueil (aplat jaune), programme, coaching, questionnaires, profil (réglages), overview du workout. */
(function () {
  'use strict';
  var REX = window.REX, $ = REX.$, $$ = REX.$$, T = REX.T, E = REX.E, d = REX.d, REDUIT = REX.REDUIT, DATA = REX.DATA;
  var CHECK = '<svg class="ic"><use href="#i-check"/></svg>';
  var PLAY = '<svg class="ic"><use href="#i-play"/></svg>';
  var FLECHE = '<svg class="ic"><use href="#i-fleche"/></svg>';
  REX.youtube = function (q) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q + ' technique'); };

  /* ================= ACCUEIL ================= */
  var dash = { split: null, pret: false };
  function etatAccueil() { var n = REX.etat.seances; return n >= 3 ? 'boucle' : REX.etat.w2Fait ? 'apres' : 'avant'; }
  function texteAccueil() {
    var m = REX.ACCUEIL[REX.CONFIG.accueil] || REX.ACCUEIL.pret, t = m[etatAccueil()];
    var rep = function (s) { return s.replace('{prenom}', DATA.client.prenom).replace('{date}', DATA.date).replace('{reste}', 3 - REX.etat.seances); };
    if (dash.split) { dash.split.revert(); dash.split = null; }
    $('#salut-p').innerHTML = rep(t.p);
    var h = $('#salut-h'); h.innerHTML = rep(t.h); h.classList.toggle('long', !!t.long);
  }
  function animerSalut(delai) {
    var h = $('#salut-h');
    if (dash.split) { dash.split.revert(); dash.split = null; }
    if (REDUIT) { gsap.fromTo(h, { opacity: 0 }, { opacity: 1, duration: .3 }); return; }
    dash.split = SplitText.create(h, { type: 'words,chars', charsClass: 'car' });
    gsap.fromTo(dash.split.chars, { opacity: 0, z: -360, y: 60, rotationX: -80 },
      { opacity: 1, z: 0, y: 0, rotationX: 0, duration: 1.05, stagger: .035, ease: E.sortie, delay: delai || 0 });
  }
  REX.PAGES['e-dash'] = {
    init: function () {
      texteAccueil();
      REX.surConfig(function () { if (!dash.pret) return; texteAccueil(); animerSalut(0); });
    },
    entrer: function (page) {
      dash.pret = false;
      texteAccueil();
      var tl = gsap.timeline({ onComplete: function () { dash.pret = true; } });
      var cartes = $$('.grille .carte', page), hero = $('#c-aujourdhui');
      if (REDUIT) {
        tl.fromTo([$('.aplat', page), cartes], { opacity: 0 }, { opacity: 1, duration: .3 });
      } else {
        // l'aplat jaune descend du haut comme un rideau (bord bas arrondi), puis le texte et les cartes
        tl.fromTo('.aplat', { clipPath: 'inset(0px 0px 100% 0px round 0px 0px 34px 34px)' }, { clipPath: 'inset(0px 0px 0% 0px round 0px 0px 34px 34px)', duration: 1, ease: E.page, clearProps: 'clipPath' }, 0)
          .fromTo('.aplat-fond span', { opacity: 0, y: 80, z: -300 }, { opacity: 1, y: 0, z: 0, duration: 1.8, ease: E.sortie }, .2)
          .fromTo('.haut', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: .8, ease: E.sortie }, .35)
          .fromTo('#salut-p', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .8, ease: E.sortie }, .45)
          .add(function () { animerSalut(0); }, .4)
          .fromTo(hero, { opacity: 0, y: 70, z: -200, rotationX: 16 }, { opacity: 1, y: 0, z: 0, rotationX: 0, duration: 1.1, ease: E.sortie, clearProps: 'transform' }, .55);
        cartes.forEach(function (c, i) {
          var k = +c.dataset.couche;
          tl.fromTo(c, { opacity: 0, z: -200 - k * 80, y: 60 + k * 36, rotationX: 18 },
            { opacity: 1, z: 0, y: 0, rotationX: 0, duration: .85 + k * .14, ease: E.sortie, clearProps: 'transform' }, .7 + i * .08);
        });
      }
      var n = REX.etat.seances, val = $('#as-val');
      tl.fromTo(val, { strokeDashoffset: 314.16 }, { strokeDashoffset: 314.16 * (1 - n / 3), duration: d(1.4), ease: E.sortie }, .9);
      tl.add(function () { REX.compter($('#as-n'), n, { duree: 1.1, de: 0 }); }, .9);
      if (!REX.etat.questFait) tl.fromTo('#pastille-quest', { scale: .8, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: E.pop }, 1.3);
    },
    /* Retour d'une séance validée : l'anneau passe de 1/3 à 2/3, le message d'accueil change */
    apresSeance: function () {
      REX.etat.w2Fait = true;
      var n = Math.min(3, REX.etat.seances + 1); REX.etat.seances = n;
      $('#c-etat').textContent = 'Fait'; $('#c-etat').classList.add('fait');
      $('#c-semaine-txt').textContent = n >= 3 ? 'Semaine bouclée !' : (3 - n) + (3 - n > 1 ? ' séances' : ' séance') + ' à faire';
      gsap.to('#as-val', { strokeDashoffset: 314.16 * (1 - n / 3), duration: d(1.5), ease: 'expo.out' });
      REX.compter($('#as-n'), n, { duree: 1, de: n - 1 });
      texteAccueil(); animerSalut(.1);
      if (!REDUIT) gsap.fromTo('#c-semaine', { scale: 1 }, { scale: 1.05, duration: .3, yoyo: true, repeat: 1, ease: 'power2.out', delay: .1 });
    },
    apresQuestionnaire: function () {
      if (!REDUIT) gsap.to('#pastille-quest', { scale: .8, opacity: 0, duration: .25, ease: E.doux });
      else $('#pastille-quest').style.opacity = 0;
      $('#c-quest-t').textContent = 'Check-in fait, merci';
    }
  };

  /* ================= PROGRAMME (M5) — correction : chaque jour ouvre SON workout ================= */
  var prog = { vue: 'semaine', place: false };
  var JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  function construireProgramme() {
    var cols = $('#cols'); cols.innerHTML = '';
    DATA.semaineCourante.forEach(function (n, i) {
      var c = document.createElement('div'); c.className = 'col' + (n === 20 ? ' auj' : ''); c.dataset.j = i;
      var zone = '<span class="vide"></span>', stt = '';
      if (n === 19) { zone = '<button class="w-chip fait" data-ouvre="e-workout" data-workout="w1" data-teinte-page="surface" aria-label="Workout 1, fait lundi">W1</button>'; stt = '<span class="stt">' + CHECK + '</span>'; }
      if (n === 20) { zone = '<button class="w-chip" data-ouvre="e-workout" data-workout="w2" data-teinte-page="encre" aria-label="Workout 2, aujourd’hui">W2</button>'; stt = '<span class="stt">Auj.</span>'; }
      c.innerHTML = '<span class="j">' + JOURS[i] + '</span><span class="n">' + n + '</span><div class="zone">' + zone + '</div>' + (stt || '<span class="stt"></span>');
      cols.appendChild(c);
    });
    $('#wl').innerHTML =
      '<li><button class="wli auj" data-ouvre="e-workout" data-workout="w2" data-teinte-page="encre"><span class="w-chip">W2</span><span class="wli-t">Bas du corps + circuit<small>Prévu aujourd’hui · ≈ 50 min</small></span><span class="wli-a">' + FLECHE + '</span></button></li>' +
      '<li><div class="wli" id="wli3"><button class="w-chip w-chip-b" id="chip-w3" data-ouvre="e-workout" data-workout="w3" data-teinte-page="surface" aria-label="Voir le workout 3">W3</button><button class="wli-t wli-lien" data-ouvre="e-workout" data-workout="w3" data-teinte-page="surface" id="wli3-t">Corps entier<small>À placer cette semaine</small></button><button class="placer" id="btn-placer">Jeu. 22</button></div></li>' +
      '<li class="etiq wl-sep">Fait</li>' +
      '<li><button class="wli fait" data-ouvre="e-workout" data-workout="w1" data-teinte-page="surface"><span class="w-chip fait">W1</span><span class="wli-t">Haut du corps<small>Fait lundi 19 octobre · voir le détail</small></span><span class="wli-a">' + CHECK + '</span></button></li>';
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
  function placerW3() {
    if (prog.place) return; prog.place = true;
    var chip = $('#chip-w3'), zone = $('.col[data-j="3"] .zone');
    var etat = Flip.getState(chip);
    zone.innerHTML = ''; zone.appendChild(chip);
    $('#btn-placer').remove();
    $('#wli3-t').innerHTML = 'Corps entier<small>Placé jeudi 22 octobre</small>';
    chip.classList.remove('w-chip-b');
    Flip.from(etat, { duration: d(.9), ease: E.page, scale: true, zIndex: 20 });
    var c = $('.col[data-j="3"]'); if (!REDUIT) gsap.fromTo(c, { y: 0 }, { y: -10, duration: .3, yoyo: true, repeat: 1, delay: .6, ease: 'power2.out' });
    REX.SONS.choix();
  }
  function basculerVue(v) {
    if (v === prog.vue) return;
    var sem = $('#vue-semaine'), mois = $('#vue-mois'), de = v === 'mois' ? sem : mois, vers = v === 'mois' ? mois : sem;
    prog.vue = v;
    $$('#seg-vue button').forEach(function (b) { b.classList.toggle('on', b.dataset.vue === v); });
    var seg = $('#seg-vue');
    gsap.to('.seg-i', { x: v === 'mois' ? seg.clientWidth / 2 - 5 : 0, duration: d(.55), ease: E.vaul });
    var sens = v === 'mois' ? 1 : -1;
    gsap.timeline()
      .to(de, { opacity: 0, rotationX: REDUIT ? 0 : -38 * sens, y: REDUIT ? 0 : -24 * sens, z: REDUIT ? 0 : -220, duration: d(.32), ease: 'power3.out' })
      .add(function () { de.hidden = true; vers.hidden = false; })
      .fromTo(vers, { opacity: 0, rotationX: REDUIT ? 0 : 38 * sens, y: REDUIT ? 0 : 28 * sens, z: REDUIT ? 0 : -220 }, { opacity: 1, rotationX: 0, y: 0, z: 0, duration: d(.75), ease: E.sortie, clearProps: 'transform' })
      .add(function () {
        gsap.set(de, { clearProps: 'all' });
        if (v === 'mois' && !REDUIT) gsap.fromTo('#mois-grille .jour', { opacity: 0, z: -140, rotationX: 40 }, { opacity: 1, z: 0, rotationX: 0, duration: .7, stagger: { each: .012 }, ease: E.sortie, clearProps: 'transform' });
        if (v === 'semaine' && !REDUIT) gsap.fromTo('#cols .col', { opacity: 0, z: -160 }, { opacity: 1, z: 0, duration: .6, stagger: .04, ease: E.sortie, clearProps: 'transform' });
      }, '<.05');
  }
  REX.PAGES['e-prog'] = {
    init: construireProgramme,
    avant: function () {
      if (prog.vue !== 'semaine') { prog.vue = 'semaine'; $('#vue-semaine').hidden = false; $('#vue-mois').hidden = true; $$('#seg-vue button').forEach(function (b) { b.classList.toggle('on', b.dataset.vue === 'semaine'); }); gsap.set('.seg-i', { x: 0 }); }
      var w2 = $('.col.auj .w-chip'); if (REX.etat.w2Fait && w2) { w2.classList.add('fait'); }
    },
    entrer: function (page) {
      REX.cascade(page);
      if (REDUIT) return;
      gsap.fromTo($$('#cols .col'), { opacity: 0, z: -280, rotationX: -30, y: 50 },
        { opacity: 1, z: function (i, el) { return el.classList.contains('auj') ? 40 : 0; }, rotationX: 0, y: 0, duration: 1, stagger: .06, ease: E.sortie, delay: .12 });
      gsap.fromTo('.wli', { opacity: 0, z: -140, y: 30 }, { opacity: 1, z: 0, y: 0, duration: .8, stagger: .08, ease: E.sortie, delay: .35, clearProps: 'transform' });
    }
  };

  /* ================= COACHING (M5) ================= */
  REX.PAGES['e-coach'] = {
    init: function () {
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

  /* ================= QUESTIONNAIRES (liste) / SUIVI ================= */
  REX.PAGES['e-quest'] = { entrer: function (p) { REX.cascade(p); } };
  REX.PAGES['e-suivi'] = {
    entrer: function (p) {
      REX.cascade(p);
      if (REDUIT) return;
      var c = $$('.pile3d i', p);
      gsap.fromTo(c, { z: -300, y: 80, rotationX: 50, opacity: 0 }, { z: function (i) { return i * 40; }, y: function (i) { return -i * 12; }, rotationX: 18, rotationY: function (i) { return -10 + i * 2; }, opacity: 1, duration: 1.4, stagger: .12, ease: E.sortie });
    }
  };

  /* ================= PROFIL : ambiance + Grand affichage (réglages du client) ================= */
  var FONDS = { clair: '#E3E5E8', sombre: '#202224', bleu: '#141B33' };
  function majProfil() {
    $$('#pr-amb button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.amb === REX.CONFIG.ambiance)); });
    $('#pr-grand').setAttribute('aria-checked', String(!!REX.CONFIG.grand));
  }
  REX.PAGES['e-profil'] = {
    init: function () {
      REX.surConfig(majProfil); majProfil();
      // Changer d'ambiance : la nouvelle couleur de fond se répand depuis la vignette touchée, puis le thème bascule.
      $('#pr-amb').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b || b.dataset.amb === REX.CONFIG.ambiance) return;
        var v = $('#voile-amb'), page = $('#e-profil'), box = page.getBoundingClientRect(), r = b.getBoundingClientRect();
        var x = r.left + r.width / 2 - box.left, y = r.top + r.height / 2 - box.top, R = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
        REX.SONS.choix();
        if (REDUIT) { REX.regler('ambiance', b.dataset.amb); return; }
        v.style.background = FONDS[b.dataset.amb]; v.style.display = 'block';
        gsap.timeline()
          .fromTo(v, { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)', opacity: 1 }, { clipPath: 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)', duration: .6, ease: 'power3.inOut' })
          .add(function () { REX.regler('ambiance', b.dataset.amb); })
          .to(v, { opacity: 0, duration: .35, ease: 'power1.out', onComplete: function () { v.style.display = 'none'; gsap.set(v, { clearProps: 'clipPath,opacity' }); } })
          .fromTo('#profil-corps > *', { y: 14 }, { y: 0, duration: .6, stagger: .03, ease: E.sortie, clearProps: 'transform' }, '<');
      });
      $('#pr-grand').addEventListener('click', function () {
        REX.SONS.choix();
        REX.regler('grand', !REX.CONFIG.grand);
        if (!REDUIT) gsap.fromTo('#pr-ap-n', { scale: REX.CONFIG.grand ? .84 : 1.18 }, { scale: 1, duration: .55, ease: E.ressort });
      });
      $$('[data-switch]').forEach(function (s) { s.addEventListener('click', function () { s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true')); REX.SONS.choix(); }); });
    },
    entrer: function (p) { REX.cascade(p); }
  };

  /* ================= OVERVIEW DU WORKOUT : sections Bloc A / B / C, encart exercice retravaillé ================= */
  function presc(x) {
    if (x.type === 'temps') return '<span class="ex-p"><b>' + x.series + '</b><i>séries</i></span><span class="ex-p"><b>' + x.dur + '</b><i>sec.</i></span><span class="ex-p"><b>' + REX.mmss(x.repos) + '</b><i>repos</i></span>';
    return '<span class="ex-p"><b>' + x.series + '×' + x.reps + '</b><i>' + (x.parJambe ? 'reps / jambe' : 'reps') + '</i></span><span class="ex-p"><b>' + REX.fr(x.kg) + '</b><i>kg</i></span><span class="ex-p"><b>' + REX.mmss(x.repos) + '</b><i>repos</i></span>';
  }
  function encart(x, code) {
    return '<li class="ex" data-exo="' + x.id + '">' +
      '<button class="ex-go" data-aller="' + x.id + '" aria-label="Commencer par ' + x.nom + '">' +
        '<span class="ex-code">' + code + '</span>' +
        '<span class="ex-nom">' + x.nom + '</span>' +
        '<span class="ex-presc">' + presc(x) + '</span>' +
        (x.prec ? '<span class="ex-prec">Dernière fois : ' + x.prec + '</span>' : '') +
      '</button>' +
      '<a class="ex-video" href="' + REX.youtube(x.video) + '" target="_blank" rel="noopener" aria-label="Vidéo : ' + x.nom + '">' + PLAY + '</a></li>';
  }
  REX.circuitDetailHTML = function (c) {
    // niveau de détail M4 : quantité, exercice, charge / consigne, vidéo
    return '<ol class="ci-liste">' + c.items.map(function (it, k) {
      return '<li><span class="ci-q">' + it.q + '</span><span class="ci-n">' + it.n + '<small>' + it.d + '</small></span>' +
        '<a class="ci-v" href="' + REX.youtube(it.video) + '" target="_blank" rel="noopener" aria-label="Vidéo : ' + it.n + '">' + PLAY + '</a></li>';
    }).join('') + '</ol>';
  };
  function sectionHTML(b) {
    var X = DATA.exos;
    if (b.circuit) {
      var c = X[b.circuit];
      var emom = c.format === 'EMOM' ? '<div class="emom-min">' + Array.from({ length: c.minutes }, function (_, i) { return '<span><b>' + (i + 1) + '</b>' + (i % 2 ? 'pompes' : 'squats') + '</span>'; }).join('') + '</div>' : '';
      return '<section class="bloc ' + (b.option ? 'bloc-option' : 'bloc-circuit') + '" data-entree>' +
        '<header class="bloc-tete"><span class="bloc-l">' + b.lettre + '</span><span class="bloc-n">' + (b.option ? 'Option' : b.nom) + '<small>' + (b.option ? 'Facultatif · si vous avez encore de l’énergie' : 'Circuit · ' + b.duree) + '</small></span><span class="tag-format">' + c.format + ' · ' + c.minutes + ' min</span></header>' +
        '<p class="bloc-but">' + c.but + '</p>' + REX.circuitDetailHTML(c) + emom + '<p class="bloc-note">' + c.note + '</p></section>';
    }
    return '<section class="bloc" data-entree><header class="bloc-tete"><span class="bloc-l">' + b.lettre + '</span><span class="bloc-n">' + b.nom + '<small>' + b.exos.length + ' exercice' + (b.exos.length > 1 ? 's' : '') + ' · ' + b.duree + '</small></span></header>' +
      '<ol class="ex-liste">' + b.exos.map(function (id, k) { return encart(X[id], (b.lettre === 'É' ? 'É' : b.lettre) + (k + 1)); }).join('') + '</ol></section>';
  }
  function sectionFaite(b) {
    return '<section class="bloc" data-entree><header class="bloc-tete"><span class="bloc-l">' + b.lettre + '</span><span class="bloc-n">' + b.nom + '<small>Réalisé</small></span></header><ol class="ex-liste">' +
      b.exosFaits.map(function (x) {
        return '<li class="ex ex-fait"><div class="ex-go"><span class="ex-nom">' + x.nom + (x.record ? ' <span class="tag-rec">Record</span>' : '') + '</span><span class="ex-series">' +
          x.series.map(function (s) { return '<span><i>' + CHECK + '</i>' + s + (x.unite === 'kg' ? '<small>kg</small>' : '<small>reps</small>') + '</span>'; }).join('') + '</span></div></li>';
      }).join('') + '</ol></section>';
  }
  function sectionTemplate(b) {
    return '<section class="bloc" data-entree><header class="bloc-tete"><span class="bloc-l">' + b.lettre + '</span><span class="bloc-n">' + b.nom + '<small>Prévu</small></span></header><ol class="ex-liste">' +
      b.exosTemplate.map(function (x) { return '<li class="ex"><div class="ex-go"><span class="ex-nom">' + x.nom + '</span><span class="ex-prec">' + x.presc + '</span></div></li>'; }).join('') + '</ol></section>';
  }
  REX.workoutCourant = 'w2';
  function rendreWorkout(id) {
    var w = DATA.workouts[id] || DATA.workouts.w2; REX.workoutCourant = w.id;
    $('#wo-etiq').innerHTML = w.etiq; $('#wo-titre').innerHTML = w.titre; $('#wo-sous').innerHTML = w.sous;
    var h = '';
    if (w.consigne) h += '<div class="consigne" data-entree><span class="etiq">Consigne de Corentin</span><p>' + w.consigne + '</p></div>';
    if (w.etat === 'fait') h += '<div class="bandeau-fait" data-entree>' + CHECK + '<span>Séance faite lundi 19 octobre. Voici ce que vous avez réalisé.</span></div>';
    if (w.etat === 'avenir') h += '<div class="bandeau-fait bandeau-avenir" data-entree><span>Séance à venir : voici ce que Corentin a prévu.</span></div>';
    h += w.blocs.map(function (b) { return w.etat === 'fait' ? sectionFaite(b) : w.etat === 'avenir' ? sectionTemplate(b) : sectionHTML(b); }).join('');
    $('#wo-blocs').innerHTML = h;
    var bas = $('#wo-bas'); bas.hidden = w.etat !== 'afaire' || REX.etat.w2Fait;
    $('#wo-corps').scrollTop = 0;
  }
  REX.PAGES['e-workout'] = {
    avant: function (page, opt, src) { rendreWorkout((opt && opt.workout) || (src && src.dataset.workout) || 'w2'); },
    entrer: function (page) {
      REX.cascade(page);
      if (REDUIT) return;
      gsap.fromTo($$('.ex, .ci-liste li', page), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .8, stagger: .05, ease: E.sortie, delay: .3, clearProps: 'transform,opacity' });
      gsap.fromTo($$('.bloc-l', page), { scale: .85, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, stagger: .08, ease: E.pop, delay: .25, clearProps: 'transform,opacity' });
    }
  };
})();
