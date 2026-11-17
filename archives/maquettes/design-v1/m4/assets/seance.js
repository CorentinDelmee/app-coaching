/* seance.js — le cœur : séance en cours.
   Exercices en plein écran (swipe Draggable + Inertia), séries qui s'agrandissent,
   repos porté par l'îlot, circuit AMRAP avec chrono plein écran, tiroir, écran de fin. */
(function () {
  const M4 = window.M4, $ = M4.$, $$ = M4.$$, E = M4.E, T = M4.T, clamp = M4.clamp, ic = M4.icones, ilot = M4.ilot;
  const page = $('#p-seance'), piste = $('#piste'), vue = $('#vue'), accueil = $('#accueil');
  const fmtKg = v => String(v).replace('.', ',');
  const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const precKg = { squat: 14, bulg: 8, hip: 37.5 };

  let S = null;                          // état de la séance en cours (null = pas de séance)
  const rest = { actif: false, fin: 0, total: 0 };
  let swipe = null, W = 390, dessousSeance = null, finDessous = null;

  /* ==================== ÉTAT ==================== */
  function nouvelleSeance() {
    S = {
      i: 0, debut: M4.horloge.now(), lastS: -1, retour: false, auto: null, pane: 0, circuitFait: false,
      amrap: { tours: 0, extra: 0 },
      ex: M4.data.seance.map(x => Object.assign({}, x, {
        fini: false,
        serie: x.type === 'circuit' ? null : Array.from({ length: x.series }, () => ({ fait: false, kg: x.kg, reps: x.reps, s: x.duree }))
      }))
    };
  }
  const courante = x => x.serie.findIndex(s => !s.fait);          // index de la série à faire (-1 = toutes faites)

  /* ==================== SLIDES ==================== */
  function rowHTML(x, s, j) {
    const vals = x.type === 'charge'
      ? '<span class="v-kg">' + fmtKg(s.kg) + '</span><i>kg</i>×<span class="v-reps">' + s.reps + '</span><i>reps</i>'
      : '<span class="v-s">' + s.s + '</span><i>s</i>';
    return '<button class="serie" data-j="' + j + '"><span class="no">' + (j + 1) + '</span><span class="vals">' + vals + '</span><span class="etat">' + ic.check + '</span></button>';
  }
  function slideHTML(x, k) {
    if (x.type === 'circuit') {
      return '<article class="slide circuit" data-k="' + k + '" style="position:relative;overflow:hidden;padding:0">' +
        '<div class="pane p0"><p class="micro">Circuit final</p><p class="ci-grand">' + x.format + '<br>8 min</p>' +
        '<p class="ci-txt">' + x.format + ' : fais le plus de tours possible en 8 minutes. Tu enchaînes les trois exercices, puis tu recommences.</p>' +
        '<div class="ci-liste"><div class="l"><b>Préparation de 10 s<small>elle n’est pas comptée dans les 8 minutes</small></b></div><div class="l"><b>Un bouton « +1 tour »<small>tape-le à chaque tour terminé</small></b></div></div></div>' +
        '<div class="pane p1"><p class="micro">À chaque tour</p><h2 class="sl-nom" style="font-size:34px">Les 3 exercices</h2><div class="ci-liste">' +
        x.exos.map(e => '<div class="l"><span class="nb">' + e.nb + '</span><b>' + e.nom + '<small>' + e.det + '</small></b><a class="vid" href="' + e.video + '" target="_blank" rel="noopener" aria-label="Vidéo : ' + e.nom + '">' + ic.play + '</a></div>').join('') +
        '</div><button class="btn-mini" id="ci-retour" style="margin-top:6px">Revoir l’explication</button></div></article>';
    }
    const same = S.ex.filter(e => e.bloc === x.bloc), rang = same.indexOf(x) + 1;
    const pres = x.type === 'temps' ? x.series + ' × ' + x.duree + ' s' : x.series + ' × ' + x.reps + (x.par || '');
    const note = x.consigne || x.conseil;
    return '<article class="slide" data-k="' + k + '"><p class="micro">' + x.bloc + (same.length > 1 ? ' · ' + rang + ' sur ' + same.length : '') + '</p>' +
      '<h2 class="sl-nom">' + x.nom + '</h2>' +
      '<div class="sl-ligne"><a class="lien-vid" href="' + x.video + '" target="_blank" rel="noopener">' + ic.play + 'Vidéo</a><span class="prec">Précédent<b>' + x.prec + '</b></span><span class="pres-g">' + pres + '</span></div>' +
      '<div class="series">' + x.serie.map((s, j) => rowHTML(x, s, j)).join('') + '</div>' +
      (note ? '<div class="consigne petite"><span class="micro">' + (x.consigne ? 'Consigne de Corentin' : 'Conseil') + '</span>' + note + '</div>' : '') + '</article>';
  }
  function construire() {
    W = vue.clientWidth;
    piste.innerHTML = S.ex.map(slideHTML).join('');
    $$('.slide', piste).forEach(s => { s.style.width = W + 'px'; });
    piste.style.width = (W * S.ex.length) + 'px';
    $('#segs').innerHTML = S.ex.map(() => '<span class="seg"><i></i></span>').join('');
    S.ex.forEach((x, k) => majSlide(k));
    $$('.pane.p1', piste).forEach(el => gsap.set(el, { xPercent: 100, opacity: 0 }));
    if (swipe) swipe.kill();
    gsap.set(piste, { x: 0 });
    swipe = Draggable.create(piste, {
      type: 'x', inertia: true, edgeResistance: 0.85, lockAxis: true, minimumMovement: 9,
      bounds: { minX: -(S.ex.length - 1) * W, maxX: 0 },
      snap: { x: v => -clamp(Math.round(-v / W), S.i - 1, S.i + 1) * W },
      onPress() { gsap.killTweensOf(piste); },
      onDragStart() { annulerAuto(); },
      onThrowComplete() { const i = clamp(Math.round(-this.x / W), 0, S.ex.length - 1); if (i !== S.i) arriver(i); }
    })[0];
  }
  function majSlide(k) {
    const x = S.ex[k], el = piste.children[k]; if (!el || x.type === 'circuit') return;
    const cur = courante(x);
    $$('.serie', el).forEach((r, j) => {
      const s = x.serie[j];
      r.classList.toggle('fait', s.fait); r.classList.toggle('cur', j === cur);
      if (x.type === 'charge') { $('.v-kg', r).textContent = fmtKg(s.kg); $('.v-reps', r).textContent = s.reps; } else { $('.v-s', r).textContent = s.s; }
    });
  }
  function majSegs() {
    S.ex.forEach((x, k) => {
      const f = x.type === 'circuit' ? (x.fini ? 1 : 0) : x.serie.filter(s => s.fait).length / x.serie.length;
      gsap.to($$('.seg i')[k], { scaleX: f, duration: M4.D(0.7), ease: E.ressort, overwrite: true });
    });
    const x = S.ex[S.i];
    $('#sean-bloc').textContent = 'Workout 2'; $('#sean-pos').textContent = (S.i + 1) + ' / ' + S.ex.length;
    ilot.texte('#ic-s-n', (S.i + 1) + '/' + S.ex.length);
  }

  /* ==================== NAVIGATION ENTRE EXERCICES ==================== */
  function allerA(i, anime = true) {
    i = clamp(i, 0, S.ex.length - 1);
    S.i = i; majSegs(); rafraichirFace();
    gsap.killTweensOf(piste);
    if (!anime) { gsap.set(piste, { x: -i * W }); swipe.update(); return; }
    gsap.to(piste, { x: -i * W, duration: M4.D(T.glisse), ease: E.ressortDoux, onUpdate: () => swipe.update() });
    const sl = piste.children[i]; if (sl && !M4.reduit()) gsap.from($$('.sl-nom,.sl-ligne,.serie,.consigne,.pane > *', sl), { y: 26, opacity: 0, duration: 0.7, stagger: 0.05, delay: 0.12, ease: E.sortie, clearProps: 'transform,opacity' });
  }
  function arriver(i) {               // arrivé par swipe manuel
    S.i = i; majSegs(); rafraichirFace();
    const sl = piste.children[i]; if (sl) sl.scrollTop = 0;
  }

  /* ==================== BARRE D'ACTION : bouton -> repos -> suite ==================== */
  const faces = { bouton: $('.f-bouton'), repos: $('.f-repos'), suivant: $('.f-suivant') };
  let faceCur = 'bouton';
  gsap.set(faces.bouton, { autoAlpha: 1 });
  function libelle() {
    const x = S.ex[S.i];
    if (x.type === 'circuit') return x.fini ? 'Terminer la séance' : (S.pane === 0 ? 'Voir les exercices' : 'Lancer l’AMRAP');
    if (x.fini) return S.i === S.ex.length - 1 ? 'Terminer la séance' : 'Exercice suivant';
    const j = courante(x);
    return x.type === 'charge' ? 'Valider la série ' + (j + 1) + ' sur ' + x.serie.length : 'Lancer la série · ' + x.serie[j].s + ' s';
  }
  function afficherFace(nom) {
    if (nom === faceCur) return;
    const a = faces[faceCur], b = faces[nom]; faceCur = nom;
    gsap.killTweensOf([a, b]);
    gsap.to(a, { autoAlpha: 0, y: M4.reduit() ? 0 : 10, scale: M4.reduit() ? 1 : 0.97, duration: 0.14 });
    gsap.fromTo(b, { autoAlpha: 0, y: M4.reduit() ? 0 : 20, scale: M4.reduit() ? 1 : 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: M4.D(0.55), delay: 0.06, ease: E.ressort });
  }
  function rafraichirFace() {
    if (!S) return;
    $('#btn-lib').textContent = libelle();
    afficherFace(S.auto ? 'suivant' : rest.actif ? 'repos' : 'bouton');
  }
  $('#btn-principal').addEventListener('click', actionPrincipale);
  function actionPrincipale() {
    const x = S.ex[S.i];
    if (x.type === 'circuit') {
      if (x.fini) return ouvrirFin();
      if (S.pane === 0) return paneCircuit(1);
      return lancerChrono({ titre: 'AMRAP 8 min', mode: 'amrap', prep: 10, duree: 480000, onFin: finAmrap });
    }
    if (x.fini) return S.i === S.ex.length - 1 ? ouvrirFin() : allerA(S.i + 1);
    const j = courante(x);
    if (x.type === 'charge') validerSerie(S.i, j);
    else lancerSerieTemps(S.i, j);
  }
  function paneCircuit(n) {
    S.pane = n; rafraichirFace();
    const el = piste.children[S.i], p0 = $('.p0', el), p1 = $('.p1', el);
    gsap.to(p0, { xPercent: n ? -30 : 0, opacity: n ? 0 : 1, duration: M4.D(0.55), ease: E.ressortDoux });
    gsap.to(p1, { xPercent: n ? 0 : 100, opacity: n ? 1 : 0, duration: M4.D(0.55), ease: E.ressortDoux });
    if (n && !M4.reduit()) gsap.from($$('.l', p1), { y: 24, opacity: 0, stagger: 0.07, delay: 0.15, duration: 0.6, ease: E.sortie });
  }

  /* ==================== SÉRIES ==================== */
  function validerSerie(k, j) {
    const x = S.ex[k], s = x.serie[j]; if (s.fait) return;
    s.fait = true; M4.vibre(18);
    majSlide(k);
    const row = $$('.serie', piste.children[k])[j];
    if (row && !M4.reduit()) {
      gsap.fromTo($('.etat', row), { scale: 0.2 }, { scale: 1, duration: 0.6, ease: E.ressortVif });
      const suite = $$('.serie', piste.children[k])[courante(x)];
      if (suite) gsap.fromTo(suite, { y: 10 }, { y: 0, duration: 0.7, ease: E.ressortVif });
    }
    if (x.serie.every(t => t.fait)) x.fini = true;
    majSegs();
    const restant = x.serie.filter(t => !t.fait).length;
    const apres = x.fini ? (S.ex[k + 1] ? 'Ensuite : ' + S.ex[k + 1].nom : 'Ensuite : le circuit') : 'Ensuite : ' + x.nom + ', série ' + (courante(x) + 1);
    demarrerRepos(x.repos, apres);
    if (x.fini && k === S.i && k < S.ex.length - 1) demarrerAuto();
    else rafraichirFace();
    if (restant === 0 && !x.fini) x.fini = true;
  }

  /* Passage automatique à l'exercice suivant, avec « Rester ici » */
  function demarrerAuto() {
    annulerAuto();
    const barre = $('#sv-barre');
    S.auto = gsap.delayedCall(3, () => { S.auto = null; allerA(S.i + 1); });
    $('#sv-t').textContent = 'Suivant : ' + S.ex[S.i + 1].nom;
    gsap.fromTo(barre, { scaleX: 1 }, { scaleX: 0, duration: 3, ease: 'none', overwrite: true });
    rafraichirFace();
  }
  function annulerAuto() { if (S && S.auto) { S.auto.kill(); S.auto = null; rafraichirFace(); } }
  $('#sv-rester').addEventListener('click', () => { annulerAuto(); M4.toast('On reste sur cet exercice'); });

  /* ---------- Détail d'une série : la rangée s'agrandit ---------- */
  const ovD = $('#ov-detail'), fD = $('#f-detail'), scD = $('.ov-scrim', ovD);
  let det = null, coqueD = null;
  function getCoqueD() {
    if (coqueD) return coqueD;
    coqueD = M4.coque(fD, {
      origine: () => M4.rel(det.row),
      couleurDebut: () => getComputedStyle(det.row).backgroundColor,
      source: () => det.row,
      rayonDebut: 28, rayonFin: 34,
      contenu: ['.micro', '.dt-titre', '.dt-champs', '.dt-prec', '#dt-valider'],
      montrer() { ovD.hidden = false; ovD.classList.add('actif'); },
      cacher() { ovD.classList.remove('actif'); ovD.hidden = true; },
      surP(p) { scD.style.opacity = 1 - clamp(p, 0, 1); }
    });
    coqueD.geste($('.f-poignee', fD));
    scD.addEventListener('click', () => coqueD.fermer());
    return coqueD;
  }
  function champHTML(cle, lab, val, unite, seul) {
    return '<button class="champ' + (seul ? ' seul' : '') + '" data-champ="' + cle + '"><span class="micro">' + lab + '</span><span class="val"><b>' + val + '</b><i>' + unite + '</i></span></button>';
  }
  function ouvrirDetail(k, j, row) {
    const x = S.ex[k], s = x.serie[j]; det = { k, j, row };
    $('#dt-sur').textContent = x.nom;
    $('#dt-titre').textContent = 'Série ' + (j + 1) + ' sur ' + x.serie.length;
    $('#dt-champs').innerHTML = x.type === 'charge'
      ? champHTML('kg', 'Poids', fmtKg(s.kg), 'kg') + champHTML('reps', 'Répétitions', s.reps, 'reps')
      : champHTML('s', 'Durée', s.s, 's', true);
    $('#dt-prec').textContent = 'Séance précédente : ' + x.prec;
    $('#dt-valider span').textContent = x.type === 'temps' && !s.fait ? 'Lancer la série' : s.fait ? 'Enregistrer' : 'Valider la série';
    getCoqueD().ouvrir();
    M4.entree($$('.champ', fD), M4.reduit() ? 0 : 0.25, 0.06);
  }
  page.addEventListener('click', e => {
    const row = e.target.closest('.serie'); if (!row || !S) return;
    ouvrirDetail(+row.closest('.slide').dataset.k, +row.dataset.j, row);
  });
  $('#dt-champs').addEventListener('click', e => {
    const ch = e.target.closest('.champ'); if (!ch) return;
    const x = S.ex[det.k], s = x.serie[det.j], c = ch.dataset.champ;
    const conf = {
      kg: { sur: 'Poids · ' + x.nom, valeur: s.kg, min: 0, max: 200, pas: 0.5, unite: 'kg' },
      reps: { sur: 'Répétitions · ' + x.nom, valeur: s.reps, min: 1, max: 50, pas: 1, unite: 'reps' },
      s: { sur: 'Durée · ' + x.nom, valeur: s.s, min: 5, max: 300, pas: 5, unite: 's' }
    }[c];
    M4.selecteur.ouvrir(Object.assign(conf, { source: ch, onValide(v) { s[c] = v; $('.val b', ch).textContent = fmtKg(v); majSlide(det.k); } }));
  });
  $('#dt-valider').addEventListener('click', () => {
    const { k, j } = det, x = S.ex[k], s = x.serie[j], aLancer = x.type === 'temps' && !s.fait;
    coqueD.fermer(() => {
      if (aLancer) { if (k === S.i) lancerSerieTemps(k, j); }
      else if (!s.fait) validerSerie(k, j);
    });
  });

  /* ==================== REPOS : porté par l'îlot ==================== */
  const rTxt = ['#rp-temps', '#ic-r-t', '#pl-temps'], rAnn = ['#rp-val', '#ic-r-val', '#pl-val'];
  let derniereSec = -1;
  function demarrerRepos(sec, apres) {
    rest.actif = true; rest.total = sec * 1000; rest.fin = M4.horloge.now() + rest.total; derniereSec = -1;
    $('#pl-apres').textContent = apres;
    ilot.aller('repos'); majRepos(rest.total);
  }
  function majRepos(reste) {
    const sec = Math.ceil(reste / 1000);
    if (sec !== derniereSec) {
      derniereSec = sec;
      rTxt.forEach(id => { $(id).textContent = M4.fmt(reste); });
      if (sec <= 3 && sec > 0) { M4.son.bip(700, 0.08); M4.vibre(20); }
    }
    const off = 100 * (1 - clamp(reste / rest.total, 0, 1));
    rAnn.forEach(id => { $(id).style.strokeDashoffset = off; });
  }
  function finRepos(naturel) {
    rest.actif = false;
    if (naturel) { M4.son.bip(988, 0.35, 0.2); M4.vibre([180, 80, 180]); }
    ilot.aller('seance'); if (naturel) setTimeout(() => ilot.pop(), 420);
    rafraichirFace();
  }
  $('#rp-plus').addEventListener('click', ajouter15);
  $('#pl-plus').addEventListener('click', ajouter15);
  function ajouter15() { if (!rest.actif) return; rest.fin += 15000; rest.total += 15000; majRepos(rest.fin - M4.horloge.now()); ilot.pop(); gsap.fromTo('#rp-temps', { scale: 1.12 }, { scale: 1, duration: 0.5, ease: E.ressortVif }); }
  $('#rp-passer').addEventListener('click', () => rest.actif && finRepos(false));
  $('#pl-passer').addEventListener('click', () => rest.actif && finRepos(false));
  ilot.cont.repos.addEventListener('click', () => { if (rest.actif) ilot.aller('plein'); });
  $('#pl-reduire').addEventListener('click', () => { if (rest.actif) ilot.aller('repos'); });

  /* ==================== CHRONO PLEIN ÉCRAN (série au temps, AMRAP) ==================== */
  const chEl = $('#p-chrono'), ch = { actif: false, phase: null, sec: -1 };
  const chCoque = M4.coque(chEl, {
    origine: () => M4.rel($('#btn-principal')), couleurDebut: () => M4.couleur('--accent'), rayonDebut: 36,
    contenu: ['.ch-phase', '.ch-titre', '.ch-centre', '.ch-bas'], dessous: () => page
  });
  function lancerChrono(cfg) {
    ch.cfg = cfg; ch.actif = true; ch.phase = 'prep'; ch.sec = -1; ch.tours = 0;
    ch.finPhase = M4.horloge.now() + cfg.prep * 1000; ch.totalPhase = cfg.prep * 1000;
    chEl.dataset.phase = 'prep';
    $('#ch-phase').textContent = 'Préparation'; $('#ch-titre').textContent = cfg.titre;
    $('#ch-temps').textContent = cfg.prep; $('#ch-sous').textContent = 'Le chrono démarre dans quelques secondes';
    $('#ch-val').style.strokeDashoffset = 0;
    $('#ch-tour').hidden = true; $('#ch-tour').classList.remove('saisie'); $('#ch-tours').hidden = true; $('#ch-n').textContent = '0';
    $('#ch-stop').hidden = false; $('#ch-stop').textContent = 'Annuler';
    chCoque.ouvrir();
  }
  function afficherChrono(reste) {
    const sec = Math.ceil(reste / 1000);
    if (sec !== ch.sec) {
      ch.sec = sec;
      $('#ch-temps').textContent = ch.phase === 'prep' ? String(sec) : M4.fmt(reste);
      if (sec <= 3 && sec > 0) {               // 3 dernières secondes : bip, vibration, pulsation
        M4.son.bip(ch.phase === 'prep' ? 660 : 880, 0.1, 0.2); M4.vibre(30);
        if (!M4.reduit()) gsap.fromTo('#ch-temps', { scale: 1.14 }, { scale: 1, duration: 0.6, ease: E.ressortVif });
      }
    }
    $('#ch-val').style.strokeDashoffset = 100 * (1 - clamp(reste / ch.totalPhase, 0, 1));
  }
  function tickChrono(now) {
    const reste = ch.finPhase - now;
    if (ch.phase === 'prep') {
      if (reste > 0) return afficherChrono(reste);
      ch.phase = 'travail'; ch.finPhase = ch.finPhase + ch.cfg.duree; ch.totalPhase = ch.cfg.duree; ch.sec = -1;
      chEl.dataset.phase = 'travail'; $('#ch-phase').textContent = 'Travail';
      $('#ch-stop').textContent = ch.cfg.mode === 'amrap' ? 'Terminer maintenant' : 'Arrêter la série';
      $('#ch-sous').textContent = ch.cfg.mode === 'amrap' ? 'Chaque tour : 10 swings, 8 burpees, 12 mountain climbers' : 'Tiens bon, respire';
      M4.son.bip(1320, 0.5, 0.22); M4.vibre(120);
      if (ch.cfg.mode === 'amrap') {
        $('#ch-tour').hidden = false; $('#ch-tours').hidden = false; $('#ch-tour span').textContent = '+1 tour';
        if (!M4.reduit()) gsap.from(['#ch-tour', '#ch-tours'], { y: 60, opacity: 0, duration: 0.7, ease: E.ressort, stagger: 0.06, clearProps: 'transform,opacity' });
      }
      gsap.fromTo('#ch-temps', { scale: 0.85 }, { scale: 1, duration: 0.7, ease: E.ressortVif });
      return afficherChrono(ch.finPhase - now);
    }
    if (ch.phase === 'travail') {
      if (reste > 0) return afficherChrono(reste);
      ch.phase = 'fin'; M4.son.bip(520, 0.9, 0.25); M4.vibre([300, 120, 300]);
      $('#ch-temps').textContent = '0:00'; $('#ch-val').style.strokeDashoffset = 100;
      if (ch.cfg.mode === 'temps') return setTimeout(() => fermerChrono(true), 500);
      chEl.dataset.phase = 'repos'; $('#ch-phase').textContent = 'Temps écoulé'; $('#ch-stop').hidden = true;
      $('#ch-sous').textContent = ch.tours + ' tour' + (ch.tours > 1 ? 's' : '') + ' complet' + (ch.tours > 1 ? 's' : '');
      $('#ch-tour span').textContent = 'Répétitions en plus'; $('#ch-tour').classList.add('saisie'); ch.attenteExtra = true;
    }
  }
  $('#ch-tour').addEventListener('click', () => {
    if (ch.phase === 'fin' && ch.attenteExtra) {            // saisie des répétitions en plus (le bouton devient la valeur)
      M4.selecteur.ouvrir({ sur: 'Répétitions en plus', valeur: S.amrap.extra, min: 0, max: 60, pas: 1, unite: 'reps', source: $('#ch-tour'),
        onValide(v) { S.amrap.extra = v; ch.attenteExtra = false; $('#ch-tour span').textContent = 'Enregistrer : ' + ch.tours + ' tours + ' + v; ch.pret = true; } });
      return;
    }
    if (ch.phase === 'fin' && ch.pret) { ch.pret = false; return fermerChrono(true); }
    if (ch.phase !== 'travail') return;
    ch.tours++; S.amrap.tours = ch.tours; M4.vibre(25); M4.son.bip(1000, 0.06, 0.12);
    $('#ch-n').textContent = ch.tours;
    gsap.fromTo('#ch-n', { scale: 1.8, y: -6 }, { scale: 1, y: 0, duration: 0.6, ease: E.ressortVif });
  });
  $('#ch-stop').addEventListener('click', () => {
    if (ch.phase === 'prep') return fermerChrono(false);
    if (ch.cfg.mode === 'temps') return fermerChrono(true);
    ch.finPhase = M4.horloge.now();                          // AMRAP arrêté : on passe à la saisie
  });
  function fermerChrono(ok) {
    ch.actif = false;
    chCoque.fermer(() => { if (ok) ch.cfg.onFin(); else rafraichirFace(); });
  }

  function lancerSerieTemps(k, j) {
    const x = S.ex[k];
    lancerChrono({ titre: x.nom + ' · série ' + (j + 1), mode: 'temps', prep: 5, duree: x.serie[j].s * 1000, onFin: () => validerSerie(k, j) });
  }
  function finAmrap() {
    const x = S.ex[S.ex.length - 1]; x.fini = true; S.circuitFait = true; majSegs(); rafraichirFace();
    M4.vibre(40);
    gsap.delayedCall(0.2, ouvrirFin);
  }

  /* ==================== TIROIR : l'overview de la séance ==================== */
  const ovT = $('#ov-tiroir'), fT = $('#f-tiroir');
  const tiroir = M4.feuille(ovT, fT, {
    snaps: () => [0, Math.max(0, fT.offsetHeight - M4.taille().h * 0.6)],
    poignee: $('.tiroir-zone', fT), dessous: () => page
  });
  function renderTiroir() {
    $('#ti-corps').innerHTML = S.ex.map((x, k) => {
      const fait = x.fini, n = x.serie ? x.serie.filter(s => s.fait).length : 0;
      const det = x.type === 'circuit' ? 'AMRAP 8 min · ' + (x.fini ? S.amrap.tours + ' tours' : 'à la fin')
        : x.type === 'charge' ? x.series + ' × ' + x.reps + ' · ' + fmtKg(x.kg) + ' kg · ' + n + '/' + x.series : x.series + ' × ' + x.duree + ' s · ' + n + '/' + x.series;
      return '<button class="ti-l' + (fait ? ' fait' : '') + (k === S.i ? ' cur' : '') + '" data-k="' + k + '"><span class="ti-p">' + (fait ? ic.check : k + 1) + '</span><span class="ti-n"><b>' + x.nom + '</b><small>' + x.bloc + ' · ' + det + '</small></span></button>';
    }).join('') + '<button class="btn-mini" id="ti-quitter" style="margin:14px 0 0;justify-self:start">Quitter la séance</button>';
  }
  $('#onglet').addEventListener('click', () => {
    if (!S || tiroir.estOuverte()) return;
    renderTiroir(); tiroir.ouvrir(1);
    M4.entree($$('.ti-l', fT), M4.reduit() ? 0 : 0.2, 0.04);
  });
  $('#ti-corps').addEventListener('click', e => {
    if (e.target.closest('#ti-quitter')) { tiroir.fermer(() => quitter()); return; }
    const l = e.target.closest('.ti-l'); if (!l) return;
    const k = +l.dataset.k; tiroir.fermer(); if (k !== S.i) allerA(k);
  });

  /* ==================== FIN DE SÉANCE ==================== */
  const finEl = $('#p-fin');
  const finCoque = M4.coque(finEl, {
    origine: () => S && S.retour ? M4.rel($('#c-semaine')) : (() => { const t = M4.taille(); return { x: t.w / 2 - 50, y: 190, w: 100, h: 100 }; })(),
    source: () => S && S.retour ? $('#c-semaine') : null,
    couleurDebut: () => S && S.retour ? getComputedStyle($('#c-semaine')).backgroundColor : M4.couleur('--accent'),
    rayonDebut: () => S && S.retour ? 30 : 50,
    contenu: ['.fin-corps'], dessous: () => finDessous
  });
  function ouvrirFin() {
    if (finCoque.etat !== 'ferme') return;
    annulerAuto();
    const dur = M4.horloge.now() - S.debut;
    let vol = 0, nb = 0, rec = null;
    S.ex.forEach(x => { if (x.serie) x.serie.forEach(s => { if (s.fait) { nb++; if (x.type === 'charge') vol += s.kg * s.reps; } }); });
    S.ex.forEach(x => { if (x.type === 'charge') { const m = Math.max.apply(null, x.serie.filter(s => s.fait).map(s => s.kg).concat([0])); if (m > (precKg[x.id] || 1e9) && (!rec || m - precKg[x.id] > rec.d)) rec = { nom: x.nom, kg: m, d: m - precKg[x.id] }; } });
    finDessous = page;
    $('#fin-grille').innerHTML =
      '<div class="stat"><p class="micro">Durée</p><p class="stat-n" id="f-dur">0</p><small>minutes</small></div>' +
      '<div class="stat"><p class="micro">Volume</p><p class="stat-n" id="f-vol">0</p><small>kg soulevés</small></div>' +
      '<div class="stat"><p class="micro">Séries</p><p class="stat-n" id="f-ser">0</p><small>validées</small></div>' +
      '<div class="stat"><p class="micro">AMRAP</p><p class="stat-n" id="f-tours">0</p><small>tours + ' + S.amrap.extra + ' reps</small></div>';
    $('#fin-record').innerHTML = rec ? ic.check.replace('width="18" height="18"', 'width="30" height="30"') + '<span><b>Nouveau record : ' + rec.nom + ' ' + fmtKg(rec.kg) + ' kg</b><small>+' + fmtKg(rec.d) + ' kg par rapport à la dernière fois</small></span>'
      : ic.check.replace('width="18" height="18"', 'width="30" height="30"') + '<span><b>Séance régulière</b><small>3 séances sur 3 dans le programme cette semaine, ça se construit.</small></span>';
    $('#fin-com').value = '';
    ilot.aller('cache');
    finCoque.ouvrir(() => { chEl.hidden = true; });
    const t0 = M4.reduit() ? 0 : 0.45;
    gsap.delayedCall(t0, () => {
      M4.compter($('#f-dur'), Math.max(1, Math.round(dur / 60000)), { duree: 1 });
      M4.compter($('#f-vol'), vol, { duree: 1.4, fmt: v => Math.round(v).toLocaleString('fr-FR') });
      M4.compter($('#f-ser'), nb, { duree: 1 });
      M4.compter($('#f-tours'), S.amrap.tours, { duree: 1 });
      if (!M4.reduit()) {
        gsap.from('#fin-rond', { scale: 0.3, rotate: -40, duration: 1, ease: E.ressortVif });
        gsap.from('#fin-titre,.fin-sous', { y: 30, opacity: 0, duration: 0.8, stagger: 0.08, ease: E.sortie });
        gsap.from('.fin-grille .stat,#fin-record,#fin-com,#fin-valider', { y: 60, opacity: 0, scale: 0.94, duration: 0.9, stagger: 0.08, delay: 0.15, ease: E.ressort, clearProps: 'transform,opacity' });
        M4.confettis($('#fin-confetti'), 200);
      }
    });
    M4.son.bip(784, 0.15, 0.15); setTimeout(() => M4.son.bip(1046, 0.25, 0.15), 140);
  }
  $('#fin-valider').addEventListener('click', () => {
    M4.etat.seanceFaite = true; S.retour = true;
    // le dashboard est « dessous » : on range workout/séance/chrono sans animation et la page de fin rétrécit vers la carte « Cette semaine »
    M4.nav.vider(); page.hidden = true; chEl.hidden = true; page.style.clipPath = '';
    finDessous = accueil;
    finCoque.fermer(() => {
      M4.majAccueil(true); M4.rendreProgramme && M4.rendreProgramme();
      S = null; rest.actif = false; ilot.aller('rdv');
      [coque, chCoque].forEach(c => { c.etat = 'ferme'; c.p = 1; });
    });
    ilot.aller('rdv');
  });

  /* ==================== ENTRÉE / SORTIE ==================== */
  const coque = M4.coque(page, {
    origine: () => S && S.retour ? M4.rel($('#c-aujourdhui')) : M4.rel(ilot.cont.demarrer),
    source: () => S && S.retour ? $('#c-aujourdhui') : null,
    couleurDebut: () => S && S.retour ? getComputedStyle($('#c-aujourdhui')).backgroundColor : M4.couleur('--accent'),
    rayonDebut: 37,
    contenu: ['.sean-haut', '.vue-piste', '.onglet', '.barre-action'],
    dessous: () => dessousSeance
  });
  function demarrer() {
    if (S) return;
    nouvelleSeance(); dessousSeance = $('#p-workout'); rest.actif = false;
    page.hidden = false; construire(); majSegs(); rafraichirFace();
    faceCur = 'bouton'; gsap.set(faces.bouton, { autoAlpha: 1, y: 0, scale: 1 }); gsap.set([faces.repos, faces.suivant], { autoAlpha: 0 });
    $('#btn-lib').textContent = libelle();
    coque.ouvrir(() => { /* prêt */ });
    gsap.delayedCall(M4.reduit() ? 0 : 0.2, () => ilot.aller('seance'));
    M4.entree($$('.slide:first-child > *', piste), M4.reduit() ? 0 : 0.35, 0.07);
    M4.entree($$('.seg'), 0.25, 0.04);
    gsap.from('.onglet', { x: 40, duration: 0.8, delay: 0.6, ease: E.ressort, clearProps: 'transform' });
    try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
  }
  ilot.cont.demarrer.addEventListener('click', demarrer);
  function quitter() {
    if (!S) return;
    S.retour = true; rest.actif = false; ch.actif = false; annulerAuto();
    M4.nav.vider(); dessousSeance = accueil; ilot.aller('rdv');
    coque.fermer(() => { S = null; M4.toast('Séance mise de côté'); });
  }
  addEventListener('resize', () => {
    if (!S || page.hidden) return;
    W = vue.clientWidth; $$('.slide', piste).forEach(s => { s.style.width = W + 'px'; }); piste.style.width = (W * S.ex.length) + 'px';
    swipe.applyBounds({ minX: -(S.ex.length - 1) * W, maxX: 0 }); gsap.set(piste, { x: -S.i * W }); swipe.update();
  });

  /* ==================== HORLOGE ==================== */
  gsap.ticker.add(() => {
    if (!S) return;
    const now = M4.horloge.now();
    const s = Math.floor((now - S.debut) / 1000);
    if (s !== S.lastS) { S.lastS = s; ilot.texte('#ic-s-t', mmss(now - S.debut)); }
    if (rest.actif) { const reste = rest.fin - now; if (reste <= 0) finRepos(true); else majRepos(reste); }
    if (ch.actif) tickChrono(now);
  });

  M4.seance = { demarrer, etat: () => S, allerA, ouvrirDetail, ouvrirFin, rest, ch,
    /* utilisé par la démo : saute à un exercice */
    debug: () => S };
  piste.addEventListener('click', e => { if (e.target.closest('#ci-retour')) paneCircuit(0); });
})();
