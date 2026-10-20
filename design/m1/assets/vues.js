/* M1 « Atelier » — écrans (accueil, menu, coaching, programme, workout, questionnaire, à venir)
   et navigation. La séance est dans seance.js. Une fonction par transition. */
(function () {
  'use strict';
  const M1 = window.M1, A = M1.anim, $ = M1.$, $$ = M1.$$, I = M1.ICONES;

  /* État de l'application (une seule source de vérité, comme un store Pinia) */
  const etat = M1.etat = { semaine: 1, seanceFaite: false, questFait: false, dureeSeance: 0, rubrique: 'accueil' };
  const el = {
    accueil: $('#e-accueil'), coaching: $('#e-coaching'), programme: $('#e-programme'), workout: $('#e-workout'),
    quest: $('#e-questionnaire'), avenir: $('#e-avenir'), seance: $('#e-seance')
  };

  const retourBtn = '<button class="rond" type="button" data-retour aria-label="Retour">' + I.retour + '</button>';
  const wa = (txt) => 'https://wa.me/?text=' + encodeURIComponent(txt);

  /* =========================================================== ACCUEIL */
  function renderAccueil() {
    const prog = M1.programme, segs = Array.from({ length: prog.total }, (_, i) => '<i class="' + (i < prog.semaine ? 'on' : '') + '"></i>').join('');
    el.accueil.innerHTML =
      '<div class="accueil">' +
      '<header class="a-haut"><p class="jour">' + M1.aujourdhui.jour + '</p><h1 class="salut">Bonjour ' + M1.client.prenom + '</h1></header>' +
      '<div class="bento">' +
      '<article class="carte hero" id="c-aujourdhui" role="button" tabindex="0" aria-label="Aujourd\'hui, Workout 2">' +
        '<div class="c-lab" id="h-lab">Aujourd\'hui</div>' +
        '<span class="hero-w" id="h-w">Workout 2</span><span class="hero-sous" id="h-sous">Bas du corps + circuit</span>' +
        '<ul class="hero-meta" id="h-meta"><li>≈ 50 min</li><li>5 exercices</li><li>1 circuit</li></ul>' +
        '<span class="fleche">' + I.fleche + '</span></article>' +
      '<div class="rang2">' +
        '<article class="carte semaine" id="c-semaine" role="button" tabindex="0" aria-label="Cette semaine">' +
          '<div class="c-lab">Cette semaine</div>' +
          '<div class="anneau-w"><svg viewBox="0 0 108 108"><circle class="piste-a" cx="54" cy="54" r="48"/><circle class="rempli" id="an-semaine" cx="54" cy="54" r="48"/></svg>' +
          '<div class="centre"><span><b class="n" id="sem-n" style="font-weight:400">' + etat.semaine + '</b><small>/3</small></span></div></div></article>' +
        '<article class="carte coaching" id="c-coaching" role="button" tabindex="0" aria-label="Prochaine séance de coaching">' +
          '<div class="c-lab">Coaching</div>' +
          '<div class="co-date">Mar. 27<br>octobre</div><div class="co-heure">18 h 30</div><div class="co-lieu">à domicile</div></article>' +
      '</div>' +
      '<div class="rang3">' +
        '<article class="carte prog" id="c-programme" role="button" tabindex="0" aria-label="Mon programme">' +
          '<div class="c-lab">Mon programme</div><div class="pg-nom">' + prog.nom + '</div>' +
          '<div class="pg-s">Semaine ' + prog.semaine + ' sur ' + prog.total + '</div><div class="segs">' + segs + '</div></article>' +
        '<article class="carte quest" id="c-quest" role="button" tabindex="0" aria-label="Questionnaires">' +
          '<span class="pastille" id="pastille">1</span>' +
          '<div class="q-t">Questionnaires</div><div class="q-s">Check-in du jour · 2 min</div></article>' +
      '</div></div></div>';
    A.anneau($('#an-semaine'), etat.semaine / 3);
  }

  /* Entrée de l'accueil : mots qui montent, cartes révélées en clip-path, anneau + compteurs. */
  A.entreeAccueil = function (rapide) {
    const cartes = $$('.carte', el.accueil);
    if (A.rm()) { gsap.fromTo(cartes, { opacity: 0 }, { opacity: 1, duration: .3, clearProps: 'opacity' }); return; }
    A.motsMontent($('.salut', el.accueil), rapide ? 0 : .05);
    gsap.fromTo('.a-haut .jour', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .8, delay: .05, ease: 'expo.out' });
    gsap.fromTo(cartes, { clipPath: 'inset(100% 0px 0px 0px round 26px)', y: 36 },
      { clipPath: 'inset(0% 0px 0px 0px round 26px)', y: 0, duration: 1.1, stagger: .1, ease: 'expo.out', delay: rapide ? 0 : .12, clearProps: 'clipPath,transform' });
    gsap.fromTo('#h-w, #h-sous, #h-meta li, #h-lab', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .06, ease: 'expo.out', delay: .4, clearProps: 'transform,opacity' });
    A.animerAnneau($('#an-semaine'), 0, etat.semaine / 3, { duree: 1.6, delay: .7 });
    A.compter($('#sem-n'), 0, etat.semaine, { duree: 1.2, delay: .7 });
    gsap.fromTo('#pastille', { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .8, delay: 1.1, ease: 'back.out(2.4)', clearProps: 'transform,opacity' });
    gsap.fromTo('#btn-menu', { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .8, delay: .5, ease: 'back.out(2)' });
  };

  /* Après la séance : la carte héros change d'état, l'anneau passe à 2/3 avec un petit ressort. */
  function majHeroFait() {
    $('#h-lab').textContent = 'Terminé · ' + M1.etat.dureeSeance + ' min';
    $('#h-w').textContent = 'Bravo Fabien';
    $('#h-sous').textContent = 'Workout 2 est dans la boîte';
    $('#h-meta').innerHTML = '<li>Prochain : Workout 3</li><li>Full body</li>';
    $('#c-aujourdhui').classList.add('fait');
    $('#c-aujourdhui').setAttribute('aria-label', 'Workout 2 terminé');
  }
  M1.apresSeance = function () {
    majHeroFait();
    A.anneau($('#an-semaine'), 1 / 3);
    $('#sem-n').textContent = 1;
  };
  M1.animerSemaine = function () {
    etat.semaine = 2;
    A.animerAnneau($('#an-semaine'), 1 / 3, 2 / 3, { duree: 1.5, ease: 'expo.out' });
    A.compter($('#sem-n'), 1, 2, { duree: 1.1 });
    if (!A.rm()) gsap.fromTo('.anneau-w', { scale: .88 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1,.55)', clearProps: 'transform' });
    gsap.fromTo('#c-aujourdhui .hero-w, #c-aujourdhui .hero-sous, #c-aujourdhui .hero-meta', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .08, ease: 'expo.out', clearProps: 'transform,opacity' });
  };

  /* =========================================================== MENU */
  const RUBRIQUES = [
    { id: 'accueil', n: '01', t: 'Accueil' }, { id: 'programme', n: '02', t: 'Programme' }, { id: 'coaching', n: '03', t: 'Coaching' },
    { id: 'questionnaires', n: '04', t: 'Questionnaires' }, { id: 'suivi', n: '05', t: 'Suivi' }, { id: 'profil', n: '06', t: 'Profil' }
  ];
  function renderMenu() {
    $('#menu').innerHTML = '<p class="m-sur">Menu</p><ul>' + RUBRIQUES.map(r =>
      '<li><button class="m-item" type="button" data-rub="' + r.id + '" aria-current="' + (r.id === etat.rubrique) + '"><span class="n">' + r.n +
      '</span><span class="t">' + r.t + (r.id === 'questionnaires' && !etat.questFait ? '<span class="bulle">1</span>' : '') + '</span><span class="pt"></span></button></li>').join('') +
      '</ul><p class="m-pied">' + M1.client.prenom + ' ' + M1.client.nom + ' · ' + M1.programme.nom + '</p>';
  }
  function rubriqueCourante() {
    const b = M1.pile[0]; if (!b) return 'accueil';
    return { 'e-coaching': 'coaching', 'e-programme': 'programme', 'e-workout': 'programme', 'e-questionnaire': 'questionnaires', 'e-avenir': b.dataset.rub || 'suivi', 'e-seance': 'programme' }[b.id] || 'accueil';
  }
  M1.basculerMenu = function () {
    if (A.menuOuvert()) { A.fermerMenu(); return; }
    etat.rubrique = rubriqueCourante(); renderMenu(); A.ouvrirMenu();
  };

  /* Entre rubriques : le rideau d'accent balaie, puis cascade. */
  function aller(rub) {
    if (rub === etat.rubrique) { A.fermerMenu(); return; }
    etat.rubrique = rub;
    if (rub === 'accueil') {
      A.balayerVers(() => { A.viderPile(); $$('.carte', el.accueil).forEach(c => { c.style.opacity = 0; }); }, null);
      setTimeout(() => { $$('.carte', el.accueil).forEach(c => { c.style.opacity = ''; }); A.entreeAccueil(true); }, A.rm() ? 150 : 650);
      return;
    }
    const cible = rub === 'programme' ? prepProgramme() : rub === 'coaching' ? prepCoaching() : rub === 'questionnaires' ? prepQuestionnaire() : prepAvenir(rub);
    A.balayerVers(() => { A.viderPile(); A.montrerInstant(cible); }, cible);
  }

  /* =========================================================== COACHING */
  function prepCoaching() {
    const c = M1.coaching;
    el.coaching.innerHTML = '<div class="defile">' +
      '<div class="p-top" data-c>' + retourBtn + '<span class="sur-titre">Coaching</span></div>' +
      '<div class="p-entete" data-c><p class="sur-titre">Votre séance</p><h2 class="co-grand" style="margin-top:10px">' + c.date.replace(' ', '&nbsp;') + '<br><em>' + c.heure + '</em><br>' + c.lieu + '</h2></div>' +
      '<div class="bloc" data-c><div class="co-actions"><a class="petit-btn" href="' + wa('Bonjour Corentin, je voudrais modifier ma séance du mardi 27 octobre à 18 h 30.') + '" target="_blank" rel="noopener">Modifier</a>' +
        '<a class="petit-btn" href="' + wa('Bonjour Corentin, je dois annuler ma séance du mardi 27 octobre à 18 h 30.') + '" target="_blank" rel="noopener">Annuler</a></div>' +
        '<p class="co-regle"><span>↺</span><span><b>Annulation gratuite</b> jusqu\'à 24 h avant la séance. On en parle sur WhatsApp.</span></p></div>' +
      '<div class="bloc mot-coach" data-c><p class="sur-titre" style="margin-bottom:10px">Le mot de Corentin</p><blockquote>« ' + c.mot + ' »</blockquote>' +
        '<a class="petit-btn plein" href="' + wa('Bonjour Corentin, ') + '" target="_blank" rel="noopener">M\'envoyer un mot</a></div>' +
      '<div class="duo" data-c><div class="bloc"><div class="stat-grand"><span id="co-rang">0</span><small>e</small></div><p class="stat-leg">C\'est votre 4e séance du mois</p></div>' +
        '<div class="bloc"><div class="stat-grand"><span id="co-nb">0</span></div><p class="stat-leg">séances déjà faites en octobre</p></div></div>' +
      '<div class="bloc" data-c><p class="sur-titre" style="margin-bottom:10px">Ce mois</p>' +
        '<p class="recap-calc"><span id="co-n3">0</span> séances × ' + c.prix + ' € = <span id="co-tot" style="color:var(--accent-lisible)">0</span> €</p></div>' +
      '</div>';
    el.coaching._entree = () => {
      A.compter($('#co-rang'), 0, 4, { duree: 1.2, delay: .15 }); A.compter($('#co-nb'), 0, 3, { duree: 1.2, delay: .2 });
      A.compter($('#co-n3'), 0, 3, { duree: 1.1, delay: .3 }); A.compter($('#co-tot'), 0, 105, { duree: 1.5, delay: .3 });
    };
    return el.coaching;
  }

  /* =========================================================== PROGRAMME */
  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  function colonnes() {
    return JOURS.map((j, i) => {
      const d = 19 + i; let chip = '<span class="vide"></span>';
      if (i === 0) chip = '<div class="chip-w fait" aria-label="W1 fait lundi 19"><span>' + I.coche + '</span><span>W1</span><small>fait<br>lun. 19</small></div>';
      if (i === 1 && etat.seanceFaite) chip = '<div class="chip-w fait" aria-label="W2 fait aujourd&#39;hui"><span>' + I.coche + '</span><span>W2</span><small>fait<br>auj.</small></div>';
      else if (i === 1) chip = '<button class="chip-w prevu" type="button" data-ouvre-w aria-label="W2 prévu aujourd\'hui"><span>W2</span><span></span><small>auj.</small></button>';
      return '<div class="col' + (i === 1 ? ' auj' : '') + '"><span class="j">' + j + '</span><span class="d">' + d + '</span>' + chip + '</div>';
    }).join('');
  }
  function moisHTML() {
    // octobre 2026 : le 1er est un jeudi. Semaines du lundi, du 28 sept. au 1er nov.
    const faits = [5, 7, 9, 12, 14, 16, 19], prevus = [26, 28, 30];
    let h = '<div class="mois-grille"><div class="bande-semaine" id="bande"></div>' + JOURS.map(j => '<div class="mois-j">' + j[0] + '</div>').join('');
    for (let k = 0; k < 35; k++) {
      const hors = k < 3 || k === 34, lab = k < 3 ? 28 + k : k === 34 ? 1 : k - 2;
      let pt = '<span class="pt" style="opacity:0"></span>', cls = 'cel' + (hors ? ' hors' : '');
      if (!hors) {
        if (lab === 20) { cls += ' auj'; pt = '<span class="pt auj"></span>'; }
        else if (faits.indexOf(lab) >= 0) pt = '<span class="pt fait"></span>';
        else if (lab === 27) pt = '<span class="pt coach"></span>';
        else if (prevus.indexOf(lab) >= 0) pt = '<span class="pt prevu"></span>';
      }
      h += '<div class="' + cls + '"><span>' + lab + '</span>' + pt + '</div>';
    }
    return h + '</div><div class="legende"><span><i class="pt fait"></i>Fait</span><span><i class="pt prevu"></i>Prévu</span><span><i class="pt coach"></i>Coaching</span></div>';
  }
  function prepProgramme() {
    const p = M1.programme;
    el.programme.innerHTML = '<div class="defile">' +
      '<div class="p-top" data-c>' + retourBtn + '<span class="sur-titre">Programme</span></div>' +
      '<div class="p-entete" data-c><p class="sur-titre">' + p.nom + ' · semaine ' + p.semaine + ' sur ' + p.total + '</p><h2 class="titre-page">Programme<br>Fabien Vincent</h2></div>' +
      '<div class="bascule" data-c role="group" aria-label="Affichage"><span class="curseur" id="b-curseur"></span><button type="button" data-vue="semaine" aria-pressed="true">Semaine</button><button type="button" data-vue="mois" aria-pressed="false">Mois</button></div>' +
      '<div class="vues">' +
        '<div class="vue-semaine" id="v-semaine">' +
          '<div class="semaine-t" data-c><b>Semaine 3 · 19 – 25 oct.</b><span class="tag-cours">En cours</span></div>' +
          '<div class="cols" data-c>' + colonnes() + '</div>' +
          '<div class="a-faire" data-c><h3>Cette semaine</h3>' +
            '<div class="ligne-w"><span class="wn">W1</span><span class="wt">Haut du corps<small>Fait lundi 19 octobre</small></span><span class="etat" style="color:var(--bien)">' + '✓ fait</span></div>' +
            (etat.seanceFaite ? '<div class="ligne-w"><span class="wn">W2</span><span class="wt">Bas du corps + circuit<small>Fait aujourd&#39;hui · ' + etat.dureeSeance + ' min</small></span><span class="etat" style="color:var(--bien)">✓ fait</span></div>' : '<button class="ligne-w cliquable" type="button" data-ouvre-w style="width:100%;text-align:left"><span class="wn">W2</span><span class="wt">Bas du corps + circuit<small>Prévu aujourd\'hui · ≈ 50 min</small></span><span class="rond" style="width:44px;height:44px;background:var(--accent-texte);color:var(--accent)">' + I.fleche + '</span></button>') + '</div>' +
          '<div class="a-faire" data-c style="margin-top:12px"><h3>À faire cette semaine</h3>' +
            '<div class="ligne-w"><span class="wn">W3</span><span class="wt">Full body<small>À placer · ≈ 45 min</small></span><span class="etat">à placer</span></div></div>' +
        '</div>' +
        '<div class="vue-mois" id="v-mois">' + moisHTML() + '</div>' +
      '</div></div>';
    el.programme._entree = () => {
      const col = $('.col.auj .chip-w', el.programme);
      if (col && !A.rm()) gsap.fromTo(col, { scale: .8 }, { scale: 1, duration: 1, delay: .5, ease: 'elastic.out(1,.5)', clearProps: 'transform' });
    };
    return el.programme;
  }
  /* Bascule semaine <-> mois : le sélecteur glisse, la vue sort par le haut, le mois se révèle en clip-path. */
  let vueProg = 'semaine';
  function basculerVue(vers) {
    if (vers === vueProg) return; vueProg = vers;
    const vs = $('#v-semaine'), vm = $('#v-mois'), cur = $('#b-curseur');
    $$('.bascule button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vue === vers)));
    gsap.to(cur, { xPercent: vers === 'mois' ? 100 : 0, duration: .6, ease: 'expo.out' });
    const rapide = A.rm();
    if (vers === 'mois') {
      gsap.to(vs.children, { y: -24, opacity: 0, duration: rapide ? .15 : .3, stagger: .03, ease: 'power2.out', onComplete: () => {
        vs.style.display = 'none'; vm.style.display = 'block';
        const cels = $$('.cel', vm), bande = $('#bande');
        const g = $('.mois-grille', vm), ligne = cels[21];   // 4e ligne = semaine en cours
        const y0 = ligne.offsetTop, h = ligne.offsetHeight;
        Object.assign(bande.style, { top: y0 + 'px', height: h + 'px' });
        if (rapide) { gsap.fromTo(vm, { opacity: 0 }, { opacity: 1, duration: .2 }); return; }
        gsap.fromTo(vm, { clipPath: 'inset(0px 0px 100% 0px round 24px)' }, { clipPath: 'inset(0px 0px 0% 0px round 24px)', duration: .9, ease: 'expo.out', clearProps: 'clipPath' });
        gsap.fromTo(cels, { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, stagger: { each: .014, from: 'start' }, ease: 'back.out(1.8)', clearProps: 'transform,opacity', onComplete: () => { $$('.cel.hors', vm).forEach(c => { c.style.opacity = ''; }); } });
        gsap.fromTo(bande, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: .9, delay: .35, ease: 'expo.out' });
        gsap.fromTo('.legende', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .7, delay: .5, ease: 'expo.out' });
      } });
    } else {
      gsap.to(vm, { y: -20, opacity: 0, duration: rapide ? .15 : .22, ease: 'power2.out', onComplete: () => {
        vm.style.display = 'none'; gsap.set(vm, { clearProps: 'transform,opacity' }); vs.style.display = '';
        gsap.fromTo(vs.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .07, ease: 'expo.out', clearProps: 'transform,opacity' });
        gsap.fromTo($$('.col', vs), { scaleY: .85, transformOrigin: 'bottom' }, { scaleY: 1, duration: .8, stagger: .04, ease: 'expo.out', clearProps: 'transform' });
      } });
    }
  }

  /* =========================================================== WORKOUT (overview) */
  function exoLigne(nom, det, q) {
    return '<div class="w-exo"><div><div class="nom">' + nom + '</div><div class="det">' + det + '</div></div>' +
      '<a class="vid" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener" aria-label="Voir la vidéo : ' + nom + '">' + I.lecture + '</a></div>';
  }
  function prepWorkout() {
    el.workout.innerHTML = '<div class="defile">' +
      '<div class="w-tete" data-c-tete>' +
        '<div class="p-top" data-c>' + retourBtn + '<span class="sur-titre">Aujourd\'hui · mardi 20</span></div>' +
        '<div data-c><h2 class="gros-titre">Workout 2</h2><p class="sous">Bas du corps + circuit</p>' +
        '<ul class="hero-meta"><li>≈ 50 min</li><li>5 exercices</li><li>1 circuit</li></ul></div></div>' +
      '<div class="w-corps">' +
      '<section class="w-bloc" data-c><h3>Échauffement</h3>' + exoLigne('Mobilité hanches', '<b>2 × 45 s</b> · repos 20 s', 'mobilité hanches échauffement') + '</section>' +
      '<section class="w-bloc" data-c><h3>Bloc A <span>2 exercices</span></h3>' +
        exoLigne('Goblet squat', '<b>4 × 10</b> à <b>16 kg</b> · repos 90 s<br>Dernière fois : 10 × 14 kg', 'goblet squat technique') +
        exoLigne('Fente bulgare', '<b>3 × 8</b> par jambe à <b>10 kg</b> · repos 75 s', 'fente bulgare technique') + '</section>' +
      '<section class="w-bloc" data-c><h3>Bloc B <span>2 exercices</span></h3>' +
        exoLigne('Hip thrust', '<b>3 × 12</b> à <b>40 kg</b> · repos 90 s', 'hip thrust technique') +
        exoLigne('Gainage ventral', '<b>3 × 40 s</b> · repos 30 s', 'gainage ventral technique') + '</section>' +
      '<section class="w-circuit" data-c><div class="mode"><b>AMRAP</b><span class="sur-titre">8 min · à fond</span></div><ul>' +
        '<li><b>10</b>Kettlebell swings · 16 kg</li><li><b>8</b>Burpees</li><li><b>12</b>Mountain climbers</li></ul></section>' +
      '<section class="w-circuit option" data-c><div class="mode"><b>EMOM</b><span class="sur-titre">6 min · option</span></div><ul>' +
        '<li><b>12</b>Air squats · minutes impaires</li><li><b>10</b>Pompes · minutes paires</li></ul></section>' +
      '<div class="consigne" data-c>' + M1.consigne + '<small>Le mot de Corentin pour ce workout</small></div>' +
      '</div></div>' +
      '<div class="dock-bas" data-c><button class="gros" type="button" id="btn-demarrer">Démarrer la séance</button></div>';
  }

  /* =========================================================== QUESTIONNAIRE */
  const QUESTIONS = [
    { id: 'sommeil', type: 'curseur', t: 'Votre sommeil cette nuit', aide: 'De 0 (très mauvais) à 10 (parfait).', a: 'Très mauvais', b: 'Parfait', def: 7 },
    { id: 'energie', type: 'curseur', t: 'Votre énergie ce matin', aide: 'De 0 (à plat) à 10 (en pleine forme).', a: 'À plat', b: 'En forme', def: 6 },
    { id: 'humeur', type: 'emojis', t: 'Et votre humeur du jour ?', aide: 'Choisissez celle qui vous ressemble.' },
    { id: 'douleur', type: 'choix', t: 'Une douleur ou une gêne ?', aide: 'On adapte la séance si besoin.', options: [['Aucune', 'Tout va bien'], ['Légère', 'Je la sens, sans souci'], ['Gênante', 'À surveiller pendant la séance'], ['Forte', 'Prévenez Corentin']] },
    { id: 'eau', type: 'choix', t: 'Hydratation d\'hier', aide: 'Eau, thé, tisanes : tout compte.', options: [['Moins d\'1 litre', 'On vise mieux'], ['Entre 1 et 2 litres', 'Pas mal'], ['2 litres ou plus', 'Parfait']] }
  ];
  const EMOJIS = [['😞', 'Bas'], ['😕', 'Moyen'], ['😐', 'Neutre'], ['🙂', 'Bien'], ['😄', 'Au top']];
  const rep = {}; let qi = 0, qOccupe = false;

  function prepQuestionnaire() {
    qi = 0; qOccupe = false; Object.keys(rep).forEach(k => delete rep[k]);
    if (etat.questFait) { el.quest._entree = null; el.quest.innerHTML = '<div class="qz"></div>'; finQuestionnaire(true); return el.quest; }
    el.quest.innerHTML = '<div class="qz"><div class="qz-haut" data-c><button class="rond" type="button" data-retour aria-label="Fermer">' + I.fermer + '</button>' +
      '<div class="qz-barre"><b id="qz-b"></b></div><span class="qz-n" id="qz-n">1/5</span></div><div class="qz-scene" id="qz-scene"></div></div>';
    el.quest._entree = () => { montrerQuestion(0, 0); };
    return el.quest;
  }
  function montrerQuestion(i, dir) {
    const sc = $('#qz-scene'), q = QUESTIONS[i], vieux = $('.qz-q', sc);
    const n = document.createElement('div'); n.className = 'qz-q'; n.dataset.i = i;
    let corps = '';
    if (q.type === 'curseur') {
      corps = '<div class="curseur-val"><span class="v">' + q.def + '</span><small>/10</small></div>' +
        '<div class="range-w" style="margin-left:26px;margin-right:26px"><div class="rail"></div><div class="plein"></div><div class="crans">' + '<i></i>'.repeat(11) + '</div><div class="poignee"></div></div>' +
        '<div class="curseur-ech"><span>' + q.a + '</span><span>' + q.b + '</span></div>';
    } else if (q.type === 'emojis') {
      corps = '<div class="emojis">' + EMOJIS.map((e, k) => '<button class="emoji" type="button" data-e="' + k + '" aria-pressed="false" aria-label="' + e[1] + '"><span>' + e[0] + '</span></button>').join('') + '</div><div class="emoji-lab" id="emoji-lab">&nbsp;</div>';
    } else {
      corps = '<div class="choix">' + q.options.map((o, k) => '<button type="button" data-k="' + k + '" aria-pressed="false"><span>' + o[0] + '<small>' + o[1] + '</small></span><span class="coche"></span></button>').join('') + '</div>';
    }
    const bas = q.type === 'curseur' ? '<div class="qz-bas"><button class="gros" type="button" data-q-suivant>Continuer</button></div>' : '<div class="qz-bas" style="min-height:12px"></div>';
    n.innerHTML = '<h2>' + q.t + '</h2><p class="aide">' + q.aide + '</p><div class="qz-corps">' + corps + '</div>' + bas;
    sc.appendChild(n);
    $('#qz-n').textContent = (i + 1) + '/' + QUESTIONS.length;
    const rapide = A.rm();
    gsap.to('#qz-b', { scaleX: (i + 1) / QUESTIONS.length, duration: rapide ? .2 : .9, ease: 'back.out(1.6)' });
    if (vieux) {
      qOccupe = true;
      gsap.to(vieux, { x: rapide ? 0 : -70, opacity: 0, duration: rapide ? .2 : .38, ease: 'power3.out', onComplete: () => vieux.remove() });
    }
    const corpsEls = [$('.aide', n), $('.qz-corps', n), $('.qz-bas', n)];
    if (rapide) { gsap.fromTo(n, { opacity: 0 }, { opacity: 1, duration: .25, onComplete: () => { qOccupe = false; } }); }
    else {
      gsap.fromTo(n, { x: vieux ? 90 : 0, opacity: vieux ? 0 : 1 }, { x: 0, opacity: 1, duration: .8, ease: 'expo.out', clearProps: 'transform', delay: vieux ? .12 : 0, onComplete: () => { qOccupe = false; } });
      A.motsMontent($('h2', n), vieux ? .18 : .05);
      gsap.fromTo(corpsEls, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .09, ease: 'expo.out', delay: vieux ? .25 : .15, clearProps: 'transform,opacity' });
    }
    if (q.type === 'curseur') brancherCurseur(n, q);
    if (q.type === 'emojis') $$('.emoji', n).forEach(b => b.addEventListener('click', () => {
      if (qOccupe) return;
      $$('.emoji', n).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const k = +b.dataset.e; rep.humeur = k; $('#emoji-lab').textContent = EMOJIS[k][1];
      if (!rapide) gsap.fromTo(b.firstChild, { scale: .5, rotate: -20 }, { scale: 1.35, rotate: 0, duration: .7, ease: 'elastic.out(1,.4)' });
      setTimeout(() => questionSuivante(), 750);
    }));
    if (q.type === 'choix') $$('.choix button', n).forEach(b => b.addEventListener('click', () => {
      if (qOccupe) return;
      $$('.choix button', n).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      rep[q.id] = +b.dataset.k;
      setTimeout(() => questionSuivante(), 650);
    }));
    const suiv = $('[data-q-suivant]', n); if (suiv) suiv.addEventListener('click', () => questionSuivante());
  }
  function brancherCurseur(n, q) {
    const w = $('.range-w', n), poi = $('.poignee', n), plein = $('.plein', n), val = $('.v', n);
    let v = q.def, largeur = 0, bouge = false;
    const place = (anim) => {
      largeur = w.clientWidth;
      gsap.to(poi, { x: v / 10 * largeur, duration: anim ? .45 : 0, ease: 'expo.out' });
      gsap.to(plein, { scaleX: v / 10, duration: anim ? .45 : 0, ease: 'expo.out' });
    };
    requestAnimationFrame(() => place(false));
    rep[q.id] = v;
    const set = (nv) => {
      if (nv === v) return; v = nv; rep[q.id] = v; val.textContent = v; M1.vibre(6);
      if (!A.rm()) gsap.fromTo(val, { scale: 1.06 }, { scale: 1, duration: .35, ease: 'expo.out' });
      place(true);
    };
    const depuis = (e) => { const r = w.getBoundingClientRect(); set(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 10)); };
    w.addEventListener('pointerdown', (e) => { w.setPointerCapture(e.pointerId); bouge = true; depuis(e); if (!A.rm()) gsap.to(poi, { scale: 1.18, duration: .3, ease: 'back.out(2)' }); });
    w.addEventListener('pointermove', (e) => { if (bouge) depuis(e); });
    const fin = () => { bouge = false; gsap.to(poi, { scale: 1, duration: .5, ease: 'back.out(2)' }); };
    w.addEventListener('pointerup', fin); w.addEventListener('pointercancel', fin);
  }
  function questionSuivante() {
    if (qOccupe) return;
    if (qi >= QUESTIONS.length - 1) { finQuestionnaire(false); return; }
    qi++; montrerQuestion(qi, 1);
  }
  /* Fin : célébration (aplat d'accent depuis le bas, confettis), puis retour à la carte. */
  function finQuestionnaire(dejaFait) {
    const qz = $('.qz', el.quest);
    const f = document.createElement('div'); f.className = 'qz-fin';
    const humeur = rep.humeur != null ? EMOJIS[rep.humeur][0] : '🙂';
    f.innerHTML = '<div class="rond-ok">' + I.coche.replace('<svg', '<svg class="trait"') + '</div>' +
      '<div class="gd">' + (dejaFait ? 'Déjà fait<br>aujourd\'hui' : 'Merci<br>' + M1.client.prenom + ' !') + '</div>' +
      '<p>' + (dejaFait ? 'Votre check-in du jour est envoyé. À demain !' : 'Corentin a bien reçu votre check-in. Il adaptera la séance si besoin.') + '</p>' +
      (dejaFait ? '' : '<div class="resume"><span>Sommeil ' + rep.sommeil + '/10</span><span>Énergie ' + rep.energie + '/10</span><span>' + humeur + '</span></div>') +
      '<button class="gros" type="button" data-q-fini>Retour à l\'accueil</button>';
    qz.appendChild(f);
    etat.questFait = true;
    const rapide = A.rm();
    if (rapide) { gsap.from(f, { opacity: 0, duration: .25 }); }
    else {
      gsap.fromTo(f, { clipPath: 'circle(0px at 50% 62%)' }, { clipPath: 'circle(900px at 50% 62%)', duration: dejaFait ? .1 : .9, ease: 'expo.inOut', clearProps: 'clipPath' });
      gsap.from($$('.rond-ok, .gd, p, .resume span, .gros', f), { y: 50, opacity: 0, duration: .9, stagger: .08, ease: 'expo.out', delay: .45, clearProps: 'transform,opacity' });
      gsap.fromTo($('.rond-ok', f), { scale: .5 }, { scale: 1, duration: 1, delay: .55, ease: 'elastic.out(1,.5)' });
      if (!dejaFait) confettis(f);
    }
    f.querySelector('[data-q-fini]').addEventListener('click', () => {
      $('#pastille') && ($('#pastille').style.display = 'none');
      $('#c-quest').classList.add('fait'); $('.q-s', $('#c-quest')).textContent = 'Fait aujourd\'hui, merci !';
      const t = A.fermerPage(el.quest, { onFini: () => { if (!A.rm()) gsap.fromTo('#c-quest .q-t', { scale: 1.15, transformOrigin: 'left center' }, { scale: 1, duration: .8, ease: 'elastic.out(1,.5)' }); } });
      if (!t) return;
      if (etat.rubrique === 'questionnaires') etat.rubrique = rubriqueCourante();
    });
  }
  function confettis(f) {
    const couleurs = ['var(--accent-texte)', '#ffffff', 'var(--accent-texte)'];
    for (let k = 0; k < 26; k++) {
      const c = document.createElement('i'); c.className = 'confetti';
      c.style.background = couleurs[k % 3]; c.style.top = '34%';
      c.style.width = (8 + Math.random() * 10) + 'px'; c.style.height = (8 + Math.random() * 10) + 'px';
      c.style.borderRadius = k % 2 ? '50%' : '3px'; f.appendChild(c);
      const ang = Math.random() * Math.PI * 2, d = 90 + Math.random() * 190;
      gsap.fromTo(c, { x: 0, y: 0, scale: .4, rotate: 0, opacity: 1 },
        { x: Math.cos(ang) * d, y: Math.sin(ang) * d - 40, scale: 1, rotate: Math.random() * 540, duration: .9 + Math.random() * .4, delay: .6, ease: 'expo.out' });
      gsap.to(c, { y: '+=' + (160 + Math.random() * 120), opacity: 0, duration: 1.1, delay: 1.35 + Math.random() * .3, ease: 'power2.in', onComplete: () => c.remove() });
    }
  }

  /* =========================================================== À VENIR (Suivi, Profil) */
  function prepAvenir(rub) {
    const titre = rub === 'profil' ? 'Profil' : 'Suivi';
    const txt = rub === 'profil' ? 'Vos informations, vos préférences et l\'apparence de l\'application arriveront ici.' : 'Vos mesures, vos records et vos progrès arriveront ici, semaine après semaine.';
    el.avenir.dataset.rub = rub;
    el.avenir.innerHTML = '<div class="avenir"><div class="p-top" data-c>' + retourBtn + '<span class="sur-titre">' + titre + '</span></div>' +
      '<div class="centre"><div class="formes" data-c aria-hidden="true"><i style="left:6px;top:30px;width:110px;height:110px;border-radius:50%;background:var(--accent)"></i>' +
      '<i style="left:104px;top:70px;width:96px;height:96px;border-radius:24px;background:var(--surface-2);transform:rotate(14deg)"></i>' +
      '<i style="left:200px;top:18px;width:84px;height:84px;border-radius:50%;box-shadow:inset 0 0 0 10px var(--accent-lisible)"></i></div>' +
      '<h2 class="grand" data-c>' + titre + '<br>bientôt.</h2><p data-c>' + txt + '</p></div></div>';
    el.avenir._entree = () => {
      if (A.rm()) return;
      $$('.formes i', el.avenir).forEach((f, k) => gsap.to(f, { y: (k % 2 ? -1 : 1) * 14, rotate: '+=' + (k % 2 ? -12 : 12), duration: 2.4 + k * .4, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
    };
    return el.avenir;
  }

  /* =========================================================== NAVIGATION */
  function fermerHaut() {
    const top = A.haut(); if (!top || A.occupe) return;
    if (top === el.seance) { M1.seance && M1.seance.demanderQuitter(); return; }
    if (top === el.quest && $('.qz-fin', top) === null && etat.rubrique === 'questionnaires') etat.rubrique = 'accueil';
    A.fermerPage(top, { onFini: () => { if (!A.haut()) etat.rubrique = 'accueil'; } });
  }
  M1.fermerHaut = fermerHaut;

  function ouvrirDepuis(carte) {
    if (A.occupe || A.menuOuvert()) return;
    const id = carte.id;
    if (id === 'c-aujourdhui') { if (etat.seanceFaite) { ouvrirProgramme(carte); return; } prepWorkout(); el.workout._entree = null; A.ouvrirPage(el.workout, carte); }
    else if (id === 'c-semaine' || id === 'c-programme') ouvrirProgramme(carte);
    else if (id === 'c-coaching') A.ouvrirPage(prepCoaching(), carte);
    else if (id === 'c-quest') A.ouvrirPage(prepQuestionnaire(), carte);
  }
  function ouvrirProgramme(src) { vueProg = 'semaine'; A.ouvrirPage(prepProgramme(), src); }

  M1.initVues = function () {
    renderAccueil();
    $('#pages').addEventListener('click', (e) => {
      const carte = e.target.closest('.carte[id]');
      if (carte && el.accueil.contains(carte)) { ouvrirDepuis(carte); return; }
      if (e.target.closest('[data-retour]')) { fermerHaut(); return; }
      const w = e.target.closest('[data-ouvre-w]');
      if (w && !A.occupe) { prepWorkout(); A.ouvrirPage(el.workout, w); return; }
      const v = e.target.closest('[data-vue]'); if (v) { basculerVue(v.dataset.vue); return; }
      if (e.target.closest('#btn-demarrer') && !A.occupe) { M1.deverrouillerSon(); M1.seance.ouvrir($('#btn-demarrer')); return; }
    });
    $('#pages').addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.carte[id]')) { e.preventDefault(); ouvrirDepuis(e.target); }
    });
    $('#btn-menu').addEventListener('click', M1.basculerMenu);
    $('#menu').addEventListener('click', (e) => { const b = e.target.closest('[data-rub]'); if (b) aller(b.dataset.rub); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (A.menuOuvert()) A.fermerMenu(); else fermerHaut();
    });
  };
})();
