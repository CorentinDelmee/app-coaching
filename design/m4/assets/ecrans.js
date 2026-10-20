/* ecrans.js — accueil, navigation (carte -> page), menu, coaching, programme, workout. */
(function () {
  const M4 = window.M4, $ = M4.$, $$ = M4.$$, clamp = M4.clamp, E = M4.E, T = M4.T, ic = M4.icones;
  const accueil = $('#accueil');

  /* ==================== NAVIGATION : carte -> page ==================== */
  const defs = {
    coaching: { sel: '#p-coaching', carte: '#c-coaching', ilot: 'rdv' },
    programme: { sel: '#p-programme', carte: '#c-programme', ilot: 'rdv' },
    workout: { sel: '#p-workout', carte: '#c-aujourdhui', ilot: 'demarrer' },
    quest: { sel: '#p-quest', carte: '#c-quest', ilot: 'quest' },
    suivi: { sel: '#p-suivi', carte: null, ilot: 'rdv' },
    profil: { sel: '#p-profil', carte: '#c-profil', ilot: 'rdv' }
  };
  const pile = [];                                   // noms des pages ouvertes, la dernière est dessus
  const visible = s => s && s.isConnected && !s.closest('[hidden]') && s.getClientRects().length > 0;
  const topEl = () => (pile.length ? $(defs[pile[pile.length - 1]].sel) : accueil);
  const etatIlotPour = () => (pile.length ? defs[pile[pile.length - 1]].ilot : 'rdv');

  function fondDe(el) {
    if (el.matches && el.matches('.ic')) return M4.couleur('--ilot');
    const c = getComputedStyle(el).backgroundColor;
    return /rgba\(.*,\s*0\)$|transparent/.test(c) ? M4.couleur('--surface') : c;
  }
  function coqueDe(nom) {
    const d = defs[nom]; if (d.coque) return d.coque;
    const el = $(d.sel);
    const src = () => { const s = d.cur && d.cur.source; return visible(s) ? s : (d.carte ? $(d.carte) : $('#dock')); };
    d.coque = M4.coque(el, {
      origine: () => M4.rel(src()),
      source: () => src(),
      couleurDebut: () => fondDe(src()),
      rayonDebut: () => parseFloat(getComputedStyle(src()).borderTopLeftRadius) || 28,
      contenu: ['.p-corps', '.p-fermer'],
      vols: () => {
        const mine = el.querySelector('[data-vol]'), s = src(), theirs = s && s.querySelector('[data-vol]');
        return mine && theirs ? [{ el: mine, depuis: () => M4.rel(theirs) }] : [];
      },
      dessous: () => d.cur.dessous,
      niveauMin: () => d.cur.min || 0,
      sortie() { pile.splice(pile.lastIndexOf(nom), 1); M4.ilot.aller(etatIlotPour()); }
    });
    d.coque.geste($('.p-tete', el));
    $('.p-corps', el).addEventListener('scroll', ev => $('.p-tete', el).classList.toggle('fond', ev.target.scrollTop > 6), { passive: true });
    $('.p-fermer', el).addEventListener('click', () => nav.fermer());
    return d.coque;
  }

  const nav = M4.nav = {
    pile, topEl,
    /* ouvrirPage('coaching', élément touché) */
    ouvrir(nom, source, opt) {
      const d = defs[nom]; if (!d || pile.includes(nom)) return;
      const co = coqueDe(nom), el = $(d.sel);
      d.cur = { source, dessous: topEl(), min: opt && opt.depuisMenu ? 1 : 0 };
      pile.push(nom);
      if (opt && opt.depuisMenu) el.style.zIndex = 55;
      M4.hooks[nom] && M4.hooks[nom]();
      co.ouvrir(() => { d.cur.min = 0; el.style.zIndex = ''; if (opt && opt.fini) opt.fini(); });
      M4.entree($$('[data-ent]', el), M4.reduit() ? 0 : 0.16);
      gsap.delayedCall(M4.reduit() ? 0 : 0.22, () => { if (pile.includes(nom)) M4.ilot.aller(d.ilot); });
    },
    fermer() { if (!pile.length) return; coqueDe(pile[pile.length - 1]).fermer(); },
    /* retour direct à l'accueil sans animation de page (fin de séance) */
    vider() {
      pile.slice().forEach(n => { const d = defs[n]; if (d.coque) { d.coque.etat = 'ferme'; d.coque.p = 1; if (d.coque.tw) d.coque.tw.kill(); } $(d.sel).hidden = true; $(d.sel).style.clipPath = ''; M4.reculer($(d.sel), 0); });
      pile.length = 0;
    },
    etatIlotPour
  };

  /* Les éléments [data-ouvre] ouvrent une page depuis eux-mêmes */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ouvre]');
    if (!b || b.closest('.peau')) return;
    nav.ouvrir(b.dataset.ouvre, b);
  });
  M4.ilot.cont.rdv.addEventListener('click', () => nav.ouvrir('coaching', M4.ilot.cont.rdv));

  /* ==================== MENU : feuille du bas née du bouton ==================== */
  const iconeSvg = {
    accueil: '<path d="M4 11.5L12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>',
    programme: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    coaching: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
    quest: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 10l1.8 1.8L14.5 8M9 16h6"/>',
    suivi: '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"/>',
    profil: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="10" r="2.6"/><path d="M7 17c1.2-2 3-3 5-3s3.8 1 5 3"/>'
  };
  const tuiles = [
    ['accueil', 'Accueil', 'Aujourd’hui'], ['programme', 'Programme', 'Semaine 3 sur 8'], ['coaching', 'Coaching', 'Mar. 27 oct.'],
    ['quest', 'Questionnaires', '1 à remplir'], ['suivi', 'Suivi', 'Bientôt'], ['profil', 'Profil', 'Mes infos']
  ];
  $('#tuiles').innerHTML = tuiles.map(t =>
    '<button class="tuile' + (t[0] === 'accueil' ? ' on' : '') + '" data-aller="' + t[0] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + iconeSvg[t[0]] + '</svg><span><b' + (t[0] === 'quest' ? '' : ' data-vol') + '>' + t[1] + '</b><small>' + t[2] + '</small></span>' + (t[0] === 'quest' ? '<span class="pastille" id="tuile-pastille">1</span>' : '') + '</button>').join('');

  const ovMenu = $('#ov-menu'), fMenu = $('#f-menu'), scMenu = $('.ov-scrim', ovMenu);
  let menuCoque;
  const menuF = M4.feuille(ovMenu, fMenu, {
    snaps: () => [0], poignee: fMenu, dessous: topEl,
    peutGlisser: () => menuCoque.etat === 'ouvert',
    demandeFermeture: () => menuCoque.fermer(),
    fermee() { menuCoque.etat = 'ferme'; menuCoque.p = 1; }
  });
  menuCoque = M4.coque(fMenu, {
    origine: () => M4.rel($('#dock')), source: () => $('#dock'), couleurDebut: () => M4.couleur('--texte'), rayonDebut: 32,
    contenu: ['.f-titre', '.tuiles'], dessous: topEl,
    montrer: () => menuF.montrer(), cacher: () => menuF.cacher(),
    surP: p => { scMenu.style.opacity = 1 - clamp(p, 0, 1); }
  });
  $('#dock').addEventListener('click', () => {
    menuCoque.ouvrir();
    M4.entree($$('.tuile', fMenu), M4.reduit() ? 0 : 0.22, 0.045);
  });
  $('#tuiles').addEventListener('click', e => {
    const t = e.target.closest('.tuile'); if (!t || menuCoque.etat !== 'ouvert') return;
    const nom = t.dataset.aller;
    if (nom === 'accueil') { menuCoque.fermer(); return; }
    nav.ouvrir(nom, t, { depuisMenu: true, fini() { // la page recouvre le menu : on le range sans animation
      menuF.cacher(); menuCoque.etat = 'ferme'; menuCoque.p = 1; scMenu.style.opacity = 0; fMenu.style.clipPath = ''; } });
  });

  /* ==================== COACHING ==================== */
  const txtWA = a => 'https://wa.me/?text=' + encodeURIComponent(a);
  $('#co-modifier').href = txtWA('Bonjour Corentin, je voudrais modifier ma séance du mardi 27 octobre à 18 h 30.');
  $('#co-annuler').href = txtWA('Bonjour Corentin, je dois annuler ma séance du mardi 27 octobre à 18 h 30.');
  $('#co-mot').href = txtWA('Bonjour Corentin, ');
  $$('#p-coaching a.btn').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });

  /* ==================== WORKOUT (overview) ==================== */
  const playSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
  function ligneExo(x) {
    const pres = x.type === 'temps' ? x.series + ' × ' + x.duree + ' s' : x.series + ' × ' + x.reps;
    const sous = x.type === 'temps' ? 'repos ' + x.repos + ' s' : x.kg + ' kg' + (x.par || '');
    const det = x.type === 'temps' ? 'précédent ' + x.prec : 'repos ' + x.repos + ' s · précédent ' + x.prec;
    return '<div class="exo"><div class="n"><b>' + x.nom + '</b><small>' + det + '</small></div><div class="pres">' + pres + '<small>' + sous + '</small></div><a class="vid" href="' + x.video + '" target="_blank" rel="noopener" aria-label="Voir la vidéo : ' + x.nom + '">' + playSvg + '</a></div>';
  }
  function renderWorkout() {
    const s = M4.data.seance, g = id => s.find(x => x.id === id), c = g('amrap');
    $('#w-corps').innerHTML =
      '<p class="petit" data-ent>Bas du corps + circuit</p>' +
      '<div class="w-meta" data-ent><span>Mardi 20 octobre</span><span>≈ 50 min</span><span>5 exercices + circuit</span></div>' +
      '<div class="consigne" data-ent><span class="micro">Consigne de Corentin</span>« Descends lentement sur le squat, 3 secondes. On garde 2 répétitions en réserve. »</div>' +
      '<div class="bloc" data-ent><div class="bloc-t"><b>Échauffement</b><span class="petit">5 min</span></div>' + ligneExo(g('mob')) + '</div>' +
      '<div class="bloc" data-ent><div class="bloc-t"><b>Bloc A</b><span class="petit">2 exercices</span></div>' + ligneExo(g('squat')) + ligneExo(g('bulg')) + '</div>' +
      '<div class="bloc" data-ent><div class="bloc-t"><b>Bloc B</b><span class="petit">2 exercices</span></div>' + ligneExo(g('hip')) + ligneExo(g('gain')) + '</div>' +
      '<div class="bloc circuit" data-ent><div class="bloc-t"><b>Circuit AMRAP · 8 min</b><span class="petit">le plus de tours</span></div>' +
      c.exos.map(x => '<div class="exo"><div class="n"><b>' + x.nom + '</b><small>' + x.det + '</small></div><div class="pres">' + x.nb + '<small>reps</small></div><a class="vid" href="' + x.video + '" target="_blank" rel="noopener" aria-label="Voir la vidéo : ' + x.nom + '">' + playSvg + '</a></div>').join('') + '</div>' +
      '<div class="bloc option" data-ent><div class="bloc-t"><b>Option · EMOM 6 min</b><span class="petit">si tu as du jus</span></div>' +
      '<div class="exo"><div class="n"><b>Minutes impaires</b><small>12 air squats</small></div></div><div class="exo"><div class="n"><b>Minutes paires</b><small>10 pompes</small></div></div></div>';
  }
  renderWorkout();

  /* ==================== PROGRAMME ==================== */
  const vSem = $('#v-semaine'), vMois = $('#v-mois');
  const nomJour = { 22: 'jeudi 22 octobre', 23: 'vendredi 23 octobre', 24: 'samedi 24 octobre' };
  function renderSemaine() {
    const et = M4.etat;
    vSem.innerHTML = '<div class="cols">' + M4.data.jours.map(j => {
      let chip = '<div class="chip vide">·</div>', cl = '';
      if (j.etat === 'fait') chip = '<button class="chip fait" data-toast="W1 fait lundi 19 octobre">' + ic.check + '<span>W1</span></button>';
      if (j.etat === 'auj') { cl = ' auj'; chip = et.seanceFaite ? '<button class="chip fait" data-toast="W2 fait aujourd’hui">' + ic.check + '<span>W2</span></button>' : '<button class="chip auj" data-ouvre="workout" aria-label="Ouvrir le workout 2">' + ic.play + '<span>W2</span></button>'; }
      if (et.w3Jour === j.d) chip = '<button class="chip place" id="chip-w3"><span>W3</span></button>';
      return '<div class="col' + cl + '" data-flip-id="j' + j.d + '"><span class="l">' + j.l + '</span><span class="d">' + j.d + '</span>' + chip + '</div>';
    }).join('') + '</div>';
  }
  function renderMois() {
    const jours = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], cells = [];
    for (let i = 0; i < 35; i++) {
      let n = i < 3 ? 28 + i : (i - 2 <= 31 ? i - 2 : 1), hors = i < 3 || i > 33;
      const faits = M4.data.moisFaits, prevus = M4.data.moisPrevus.concat(M4.etat.w3Jour ? [M4.etat.w3Jour] : []);
      const sem = !hors && n >= 19 && n <= 25, auj = !hors && n === 20;
      let pt = '';
      if (!hors && faits.indexOf(n) >= 0) pt = '<i class="fait"></i>';
      if (auj) pt = M4.etat.seanceFaite ? '<i class="fait"></i>' : '<i></i>';
      if (!hors && prevus.indexOf(n) >= 0) pt = '<i class="prevu"></i>';
      cells.push('<div class="cel' + (hors ? ' hors' : '') + (sem ? ' sem' : '') + (auj ? ' auj' : '') + '"' + (sem ? ' data-flip-id="j' + n + '"' : '') + '>' + n + pt + '</div>');
    }
    vMois.innerHTML = '<div class="mois-tete">' + jours.map(j => '<span>' + j + '</span>').join('') + '</div><div class="mois-grille">' + cells.join('') + '</div>';
  }
  function renderListes() {
    const et = M4.etat;
    const w2 = '<button class="fiche auj" data-ouvre="workout"><span class="wn">' + (et.seanceFaite ? ic.check : 'W2') + '</span><span class="ft"><b>Bas du corps + circuit</b><small>' + (et.seanceFaite ? 'Fait aujourd’hui · bravo' : 'Prévu aujourd’hui · 50 min') + '</small></span></button>';
    const w3 = et.w3Jour
      ? '<div class="fiche"><span class="wn">W3</span><span class="ft"><b>Full body</b><small>Placé ' + nomJour[et.w3Jour] + '</small></span></div>'
      : '<div class="fiche" id="fiche-w3"><span class="wn">W3</span><span class="ft"><b>Full body</b><small>À placer cette semaine</small></span><span class="jours"><button data-place="22" aria-label="Placer jeudi">Jeu 22</button><button data-place="23" aria-label="Placer vendredi">Ven 23</button><button data-place="24" aria-label="Placer samedi">Sam 24</button></span></div>';
    $('#afaire').innerHTML = w2 + w3;
    const pts = '<span class="pts"><i class="on"></i><i class="on"></i><i class="on"></i></span>';
    $('#histo').innerHTML = '<div class="histo-l"><span><b>Semaine 2</b> <span class="petit">12 – 18 oct.</span></span>' + pts + '</div><div class="histo-l"><span><b>Semaine 1</b> <span class="petit">5 – 11 oct.</span></span>' + pts + '</div>';
  }
  M4.rendreProgramme = () => { renderSemaine(); renderMois(); renderListes(); };
  M4.rendreProgramme();

  let vue = 'semaine';
  function basculer(v) {
    if (v === vue) return; vue = v;
    const cibleV = v === 'mois' ? vMois : vSem, vieuxV = v === 'mois' ? vSem : vMois;
    const etat = Flip.getState($$('[data-flip-id]', vieuxV).concat($$('.h3,#afaire,#histo', $('#pg-corps'))), { props: 'opacity' });
    $$('#bascule button').forEach(b => b.classList.toggle('on', b.dataset.vue === v));
    gsap.to('.b-pouce', { xPercent: v === 'mois' ? 100 : 0, duration: M4.D(0.6), ease: E.ressort });
    vieuxV.hidden = true; cibleV.hidden = false;
    $('#pg-legende').textContent = v === 'mois' ? 'Octobre 2026' : 'Semaine en cours · 3 sur 8 · 19 – 25 oct.';
    const flips = $$('[data-flip-id]', cibleV);
    Flip.from(etat, { targets: flips.concat($$('.h3,#afaire,#histo', $('#pg-corps'))), duration: M4.D(0.8), ease: E.ressort, scale: true, nested: false, absolute: false, simple: true });
    const autres = $$('.mois-tete span,.cel:not([data-flip-id]),.col > *', cibleV);
    gsap.fromTo(autres, { opacity: 0, y: M4.reduit() ? 0 : 10 }, { opacity: 1, y: 0, duration: M4.D(0.5), stagger: 0.008, delay: 0.12, ease: E.sortie, clearProps: 'transform,opacity' });
  }
  $('#bascule').addEventListener('click', e => { const b = e.target.closest('button'); if (b) basculer(b.dataset.vue); });
  $('#pg-corps').addEventListener('click', e => {
    const t = e.target.closest('[data-toast]'); if (t) M4.toast(t.dataset.toast);
    const p = e.target.closest('[data-place]');
    if (p) {                                          // W3 voyage de la liste vers la colonne
      const depuis = p.getBoundingClientRect(), j = +p.dataset.place;
      M4.etat.w3Jour = j; M4.rendreProgramme(); if (vue === 'mois') { vSem.hidden = true; vMois.hidden = false; }
      const chip = $('#chip-w3');
      if (chip && !M4.reduit()) {
        const c = chip.getBoundingClientRect();
        gsap.fromTo(chip, { x: depuis.left + depuis.width / 2 - (c.left + c.width / 2), y: depuis.top + depuis.height / 2 - (c.top + c.height / 2), scale: depuis.width / c.width, transformOrigin: '50% 50%' },
          { x: 0, y: 0, scale: 1, duration: 0.85, ease: E.ressort, clearProps: 'transform', onStart: () => { chip.style.zIndex = 5; }, onComplete: () => { chip.style.zIndex = ''; } });
      }
      M4.toast('W3 placé ' + nomJour[j].split(' ')[0]);
    }
  });

  /* ==================== ACCUEIL : mises à jour et entrée ==================== */
  const anneau = $('#anneau-val');
  function majSemaine(anime) {
    const n = M4.etat.seanceFaite ? 2 : 1, off = 100 - n / 3 * 100;
    if (!anime) { gsap.set(anneau, { strokeDashoffset: off }); $('#sem-n').textContent = n; return; }
    gsap.to(anneau, { strokeDashoffset: off, duration: M4.D(1.4), ease: 'power3.out' });
    $('#sem-n').textContent = n;
    gsap.fromTo('#sem-n', { scale: 1.5 }, { scale: 1, duration: 0.7, ease: E.ressortVif });
    gsap.fromTo('#c-semaine', { scale: 1.05 }, { scale: 1, duration: 0.8, ease: E.ressortVif, delay: 0.1 });
  }
  M4.majAccueil = function (anime) {
    const h = $('#c-aujourdhui'), f = M4.etat.seanceFaite;
    h.classList.toggle('fait', f);
    $('.micro', h).textContent = f ? 'Aujourd’hui · fait' : 'Aujourd’hui';
    $('.hero-sous', h).textContent = f ? 'Bravo Fabien, séance validée' : 'Bas du corps + circuit';
    $('.hero-go', h).innerHTML = f ? ic.check.replace('width="18" height="18"', 'width="26" height="26"') : '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
    $('#sem-txt').textContent = f ? 'plus qu’une séance' : 'séances faites';
    $('.segments .cur').className = 'cur';
    if (M4.etat.questFait) {
      $('#q-sous').textContent = 'Fait aujourd’hui'; $('#q-pastille').hidden = true; $('#tuile-pastille') && ($('#tuile-pastille').hidden = true);
      M4.ilot.texte('#ic-q-n', '5/5');
    }
    majSemaine(anime);
    if (anime && f) gsap.fromTo(h, { scale: 0.94 }, { scale: 1, duration: 0.9, ease: E.ressortVif });
  };
  M4.pastilleDisparait = function () {                // la pastille « 1 » s'efface avec un ressort
    const p = $('#q-pastille');
    gsap.to(p, { scale: 0.5, opacity: 0, duration: M4.D(0.35), ease: 'power3.out', onComplete: () => { p.hidden = true; gsap.set(p, { clearProps: 'transform,opacity' }); } });
    $('#q-sous').textContent = 'Fait aujourd’hui'; M4.etat.questFait = true;
    const tp = $('#tuile-pastille'); if (tp) tp.hidden = true;
  };
  M4.entreeAccueil = function () {
    const cartes = $$('.carte', accueil);
    gsap.set(anneau, { strokeDashoffset: 100 });
    if (M4.reduit()) {
      gsap.from(accueil.children, { opacity: 0, duration: 0.3 }); M4.ilot.aller('rdv'); majSemaine(true); return;
    }
    const tl = gsap.timeline();
    tl.from('.salut > *', { y: 28, opacity: 0, duration: 0.8, stagger: 0.08, ease: E.sortie }, 0)
      .from(cartes, { y: 120, scale: 0.86, opacity: 0, rotate: (i) => (i % 2 ? 2.5 : -2.5), duration: 1, stagger: 0.09, ease: E.ressort, clearProps: 'transform,opacity' }, 0.1)
      .from('.dock', { y: 110, scale: 0.7, opacity: 0, duration: 0.9, ease: E.ressort, clearProps: 'transform,opacity' }, 0.55)
      .add(() => M4.ilot.aller('rdv'), 0.25)
      .add(() => { majSemaine(true); M4.compter($('.a-txt b'), 1, { duree: 0.8 }); }, 0.7)
      .from('.segments i', { scaleX: 0, transformOrigin: '0 50%', duration: 0.5, stagger: 0.05, ease: E.sortie, clearProps: 'transform' }, 0.8)
      .from('#q-pastille', { scale: .6, opacity: 0, duration: 0.6, ease: E.ressortVif, clearProps: 'transform' }, 1.1);
    return tl;
  };
})();
