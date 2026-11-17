/* M1 « Atelier » — la séance en cours (le cœur).
   Fonctions de transition : ouvrir (bouton -> séance), allerEtape (slide), ouvrirSerie / fermerSerie (ligne -> série),
   ouvrirSelecteur / validerSelecteur (valeur -> roue), lancerChrono (cercle depuis le bouton), ouvrirTiroir, finir (anneau).
   Les chronos lisent l'horloge (M1.horloge), pas des setInterval. */
(function () {
  'use strict';
  const M1 = window.M1, A = M1.anim, H = M1.horloge, $ = M1.$, $$ = M1.$$, I = M1.ICONES;
  const ec = $('#e-seance');
  const S = M1.seance = {};
  const rm = () => A.rm();
  let st = null;         // état de la séance
  let ch = null;         // chrono actif
  let sel = null;        // sélecteur actif
  let serieOuverte = null;
  let drawer = false;
  const ICO_LISTE = '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>';

  const etapes = () => M1.etapes;
  const W = () => ec.offsetWidth;

  function nouvelEtat() {
    return {
      i: 0, debut: H.now(), volume: 0, nbSeries: 0, records: [], tours: {}, fait: etapes().map(() => false), toast: null,
      series: etapes().map(e => e.type === 'circuit' ? null : Array.from({ length: e.series }, () => ({ fait: false, reps: e.reps, kg: e.kg, duree: e.duree }))),
      stade: etapes().map(() => 'expl')
    };
  }
  const courant = (idx) => st.series[idx].findIndex(s => !s.fait);

  /* ================================================================ Construction */
  function valHTML(e, s) {
    return e.type === 'force' ? '<b>' + s.reps + '</b><i>×</i><b>' + M1.fmt(s.kg) + '</b><small>kg</small>' : '<b>' + s.duree + '</b><small>s</small>';
  }
  function rowHTML(idx, k) {
    const e = etapes()[idx], s = st.series[idx][k], cur = courant(idx);
    const cls = 'rang ' + (s.fait ? 'fait' : k === cur ? 'courant' : 'avenir');
    return '<button class="' + cls + '" type="button" data-s="' + k + '" aria-label="Série ' + (k + 1) + '"><span class="rg-n">' + (k + 1) + '</span><span class="rg-v">' + valHTML(e, s) + '</span><span class="rg-e">' + I.coche + '</span></button>';
  }
  function labelAction(idx) {
    const e = etapes()[idx], cur = courant(idx);
    if (cur < 0) return idx === etapes().length - 1 ? 'Terminer la séance' : 'Exercice suivant';
    return e.type === 'temps' ? 'Lancer la série ' + (cur + 1) : 'Valider la série ' + (cur + 1);
  }
  function panelSerie(e, idx) {
    const meta = e.type === 'force'
      ? '<span><b>' + e.series + '</b> × <b>' + e.reps + '</b>' + (e.par ? ' par jambe' : ' reps') + '</span><span><b>' + M1.fmt(e.kg) + '</b> kg</span><span>repos <b>' + e.repos + '</b> s</span>'
      : '<span><b>' + e.series + '</b> × <b>' + e.duree + '</b> s</span><span>repos <b>' + e.repos + '</b> s</span>';
    const vid = '<a href="https://www.youtube.com/results?search_query=' + encodeURIComponent(e.videoQ + ' technique') + '" target="_blank" rel="noopener">Voir la vidéo</a>';
    return '<div class="panel" data-i="' + idx + '"><div class="p-bloc">' + e.bloc + '</div><h2 class="p-nom">' + e.nom + '</h2>' +
      '<div class="p-meta">' + meta + '</div>' +
      '<div class="p-prec">' + (e.prec ? 'Dernière fois · ' + e.prec + ' · ' : '') + vid + '</div>' +
      '<p class="p-note">' + e.note + '</p>' +
      '<div class="rangs" data-n="' + st.series[idx].length + '">' + st.series[idx].map((_, k) => rowHTML(idx, k)).join('') + '</div>' +
      '<div class="p-action"><button class="gros" type="button" data-act="action">' + labelAction(idx) + '</button></div></div>';
  }
  function stadeHTML(e, idx) {
    const stade = st.stade[idx], amrap = e.mode === 'AMRAP';
    if (stade === 'expl') {
      return '<div class="stade" data-stade="expl"><h2 class="expl-gd"><em>' + e.mode + '</em><br>' + e.minutes + ' minutes</h2>' +
        '<p class="expl-tx">' + e.mode + ' — ' + (amrap ? 'faites le plus de tours possible en ' + e.minutes + ' min.' : 'une minute = un mouvement, puis vous récupérez le temps qu\'il reste.') + '</p>' +
        '<ol class="expl-liste"><li><b>1</b>10 secondes de préparation, non comptées.</li>' +
        (amrap ? '<li><b>2</b>Enchaînez les 3 mouvements dans l\'ordre, sans pause imposée.</li><li><b>3</b>Touchez « +1 tour » à chaque tour complet.</li>'
               : '<li><b>2</b>Minutes impaires : 12 air squats. Minutes paires : 10 pompes.</li><li><b>3</b>Le chrono vous annonce chaque minute.</li>') + '</ol></div>';
    }
    if (stade === 'exos') {
      return '<div class="stade" data-stade="exos"><h2 class="sv-t" style="font-size:25px;margin:6px 0 4px">Les mouvements</h2>' +
        '<p class="sv-s" style="margin-bottom:14px">' + (amrap ? 'Un tour = les 3 mouvements, dans cet ordre.' : 'Minutes impaires puis minutes paires.') + '</p>' +
        '<div class="mv-liste">' + e.exos.map(x => '<div class="mvt"><span class="q">' + x.q + '</span><span class="n">' + x.n + (x.d ? '<small>' + x.d + '</small>' : '') + '</span></div>').join('') + '</div></div>';
    }
    const tours = st.tours[e.id] || 0;
    return '<div class="stade" data-stade="fait"><h2 class="expl-gd">' + (amrap ? 'Circuit<br><em>terminé</em>' : 'Finisher<br><em>terminé</em>') + '</h2>' +
      '<div class="circuit-fait">' + (amrap ? '<b>' + tours + '</b><span>tour' + (tours > 1 ? 's' : '') + ' en ' + e.minutes + ' minutes</span>' : '<b>6</b><span>minutes enchaînées</span>') + '</div></div>';
  }
  function actionCircuit(idx) {
    const e = etapes()[idx], s = st.stade[idx], amrap = e.mode === 'AMRAP';
    if (s === 'expl') return 'Voir les mouvements';
    if (s === 'exos') return 'Lancer ' + (amrap ? 'l\'AMRAP' : 'l\'EMOM');
    return idx === etapes().length - 1 ? 'Terminer la séance' : 'Exercice suivant';
  }
  function panelCircuit(e, idx) {
    return '<div class="panel" data-i="' + idx + '"><div class="p-bloc">' + e.bloc + ' · ' + e.minutes + ' min</div>' +
      '<div class="circuit-p" id="circ-' + idx + '" style="margin-top:6px">' + stadeHTML(e, idx) + '</div>' +
      '<div class="p-action"><button class="gros" type="button" data-act="action">' + actionCircuit(idx) + '</button>' +
      (e.mode === 'EMOM' ? '<button class="lien" type="button" data-act="passer-finisher" style="width:100%">Passer ce finisher</button>' : '') + '</div></div>';
  }
  function construire() {
    ec.innerHTML = '<div class="se">' +
      '<div class="se-haut"><div class="segments" id="segs" data-c>' + etapes().map(() => '<i><b></b></i>').join('') + '</div>' +
      '<div class="se-barre" data-c><button class="rond" type="button" data-act="quitter" aria-label="Quitter la séance">' + I.fermer + '</button>' +
      '<div class="se-titre"><span id="se-nom"></span><br><b id="se-cpt">1</b> sur ' + etapes().length + '</div>' +
      '<button class="rond" type="button" data-act="tiroir" aria-label="Aperçu du workout">' + ICO_LISTE + '</button></div></div>' +
      '<div class="piste-vue" id="pv"><div class="piste" id="piste">' + etapes().map((e, i) => e.type === 'circuit' ? panelCircuit(e, i) : panelSerie(e, i)).join('') + '</div></div>' +
      '<button class="tab-tiroir" type="button" data-act="tiroir" aria-label="Ouvrir l\'aperçu du workout">' + I.gauche + '</button>' +
      '<div class="scrim" id="scrim"></div>' +
      '<aside class="tiroir" id="tiroir" aria-label="Aperçu du workout"><span class="t-poignee"></span><h3>Workout 2</h3><p class="t-sous">Bas du corps + circuit · touchez un exercice pour y aller</p><ol id="t-liste"></ol></aside>' +
      '<div class="sous-couche" id="sc-serie" hidden></div><div class="sous-couche" id="sc-sel" hidden></div>' +
      '<div class="sous-couche chrono" id="sc-chrono" hidden></div><div class="sous-couche fin" id="sc-fin" hidden></div>' +
      '<div class="feuille" id="feuille"><h3>Quitter la séance ?</h3><p>Votre progression de ce workout ne sera pas enregistrée.</p>' +
      '<button class="gros" type="button" data-act="continuer">Continuer la séance</button><button class="gros doux" type="button" data-act="quitter-ok">Quitter</button></div>' +
      '</div>';
    // la cascade d'ouverture concerne aussi le premier panneau
    $$('.panel[data-i="0"] > *', ec).forEach(n => n.setAttribute('data-c', ''));
    gsap.set($('#piste'), { x: 0 }); gsap.set($('#feuille'), { yPercent: 110, visibility: 'hidden' });
    majSegments(true); majTitre(); renderTiroir();
  }

  /* ================================================================ Ouverture / fermeture */
  S.ouvrir = function (btn) {
    stopperTout(); st = nouvelEtat(); construire();
    A.ouvrirPage(ec, btn, { rayon: 22 });
  };
  S.demanderQuitter = function () {
    if (!st) return;
    if (sel) { fermerSelecteur(); return; }
    if (serieOuverte) { fermerSerie(); return; }
    if (drawer) { fermerTiroir(); return; }
    if (ch || $('#sc-fin', ec).hidden === false) return;
    montrerFeuille(true);
  };
  function montrerFeuille(v) {
    const f = $('#feuille'), scrim = $('#scrim');
    scrim.style.pointerEvents = v ? 'auto' : 'none';
    gsap.to(scrim, { opacity: v ? 1 : 0, duration: .3 });
    if (v) gsap.set(f, { visibility: 'visible' });
    gsap.to(f, { yPercent: v ? 0 : 110, duration: v ? .6 : .35, ease: v ? 'expo.out' : 'power3.out', onComplete: () => { if (!v) gsap.set(f, { visibility: 'hidden' }); } });
    f._ouverte = v;
  }
  function quitter() {
    stopperTout();
    A.fermerPage(ec, { onFini: () => { st = null; } });
  }
  function stopperTout() {
    if (ch) { cancelAnimationFrame(ch.raf); ch = null; }
    if (st && st.toast) { st.toast.kill(); }
    sel = null; serieOuverte = null; drawer = false;
    gsap.killTweensOf('#piste');
  }

  /* ================================================================ Segments / titre / navigation */
  function fraction(idx) {
    if (st.fait[idx]) return 1;
    const sr = st.series[idx]; return sr ? sr.filter(s => s.fait).length / sr.length : 0;
  }
  function majSegments(immediat) {
    $$('#segs i', ec).forEach((el, k) => {
      el.classList.toggle('cur', k === st.i);
      gsap.to(el.firstChild, { scaleX: fraction(k), duration: immediat || rm() ? 0 : .8, ease: 'expo.out', overwrite: 'auto' });
    });
  }
  function majTitre() {
    $('#se-nom', ec).textContent = etapes()[st.i].nom;
    $('#se-cpt', ec).textContent = st.i + 1;
  }
  S.allerEtape = function allerEtape(j, opts) {
    opts = opts || {};
    if (j < 0 || j >= etapes().length || !st) return;
    if (st.toast) { st.toast.kill(); st.toast = null; $$('.toast-suite', ec).forEach(n => n.remove()); }
    const dir = j >= st.i ? 1 : -1; st.i = j;
    const piste = $('#piste'), x = -j * W();
    if (rm()) gsap.fromTo(piste, { opacity: 0 }, { opacity: 1, duration: .25, onStart: () => gsap.set(piste, { x }) });
    else gsap.to(piste, { x, duration: opts.duree || 0.75, ease: 'expo.out', overwrite: true });
    majSegments(); majTitre(); renderTiroir();
    if (!rm()) {
      const els = $$('.panel[data-i="' + j + '"] > *', ec);
      gsap.fromTo(els, { x: 50 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: .9, stagger: .05, delay: .08, ease: 'expo.out', clearProps: 'transform,opacity' });
    }
  };
  window.addEventListener('resize', () => { if (st) gsap.set('#piste', { x: -st.i * W() }); });

  /* swipe manuel entre exercices */
  function brancherSwipe() {
    const pv = $('#pv', ec); let d = null; S.glissé = false;
    pv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; d = { x: e.clientX, y: e.clientY, t: performance.now(), mode: null, dx: 0 }; S.glissé = false; });
    pv.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.mode) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) { d.mode = 'h'; try { pv.setPointerCapture(e.pointerId); } catch (_) { /* ok */ } gsap.killTweensOf('#piste'); } else if (Math.abs(dy) > 12) d = null; }
      if (d && d.mode === 'h') {
        S.glissé = true; d.dx = dx;
        const finHaut = (st.i === 0 && dx > 0) || (st.i === etapes().length - 1 && dx < 0);
        gsap.set('#piste', { x: -st.i * W() + dx * (finHaut ? .3 : 1) });
      }
    });
    const lacher = (e) => {
      if (!d) return; const m = d; d = null;
      if (m.mode !== 'h') return;
      const v = m.dx / Math.max(1, performance.now() - m.t);
      let j = st.i;
      if ((m.dx < -W() * .2 || v < -.45) && j < etapes().length - 1) j++;
      else if ((m.dx > W() * .2 || v > .45) && j > 0) j--;
      setTimeout(() => { S.glissé = false; }, 50);
      if (j !== st.i) S.allerEtape(j, { duree: .6 }); else gsap.to('#piste', { x: -st.i * W(), duration: .6, ease: 'expo.out' });
    };
    pv.addEventListener('pointerup', lacher); pv.addEventListener('pointercancel', lacher);
  }

  /* ================================================================ Lignes de séries */
  function majRows(idx) {
    const panel = $('.panel[data-i="' + idx + '"]', ec); if (!panel) return;
    const e = etapes()[idx];
    $$('.rang', panel).forEach((r, k) => {
      const s = st.series[idx][k], cur = courant(idx);
      r.className = 'rang ' + (s.fait ? 'fait' : k === cur ? 'courant' : 'avenir');
      $('.rg-v', r).innerHTML = valHTML(e, s);
    });
    $('[data-act="action"]', panel).textContent = labelAction(idx);
  }
  function pulseRow(idx, k) {
    const r = $('.panel[data-i="' + idx + '"] .rang[data-s="' + k + '"]', ec); if (!r || rm()) return;
    gsap.fromTo($('.rg-e', r), { scale: .3 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.45)', clearProps: 'transform' });
    gsap.fromTo(r, { scale: 1.03 }, { scale: 1, duration: .6, ease: 'expo.out', clearProps: 'transform' });
  }

  /* ================================================================ Validation d'une série */
  function enregistrer(idx, k) {   // met à jour l'état (volume, records) sans interface
    const e = etapes()[idx], s = st.series[idx][k];
    if (s.fait) return; s.fait = true; st.nbSeries++;
    if (e.type === 'force') {
      st.volume += s.reps * s.kg * (e.par ? 2 : 1);
      if (e.rec != null && s.kg > e.rec && !st.records.some(r => r.id === e.id)) st.records.push({ id: e.id, nom: e.nom, kg: s.kg, avant: e.rec });
    }
    if (st.series[idx].every(x => x.fait)) st.fait[idx] = true;
    majRows(idx); majSegments(); renderTiroir();
  }
  function suiteTexte(idx, k) {
    const e = etapes()[idx], derniere = st.series[idx].every(x => x.fait);
    if (!derniere) return 'Ensuite : série ' + (courant(idx) + 1) + ' sur ' + e.series + ' · ' + e.nom;
    const nx = etapes()[idx + 1]; return nx ? 'Ensuite : ' + nx.nom : 'Dernière série !';
  }
  /* Force : valider = un seul geste -> repos automatique. */
  function validerForce(idx, k, src) {
    enregistrer(idx, k); pulseRow(idx, k);
    const e = etapes()[idx], derniere = st.series[idx].every(x => x.fait);
    M1.vibre(25);
    lancerChrono({ ui: 'simple', phases: [{ type: 'repos', dur: e.repos, label: 'Repos', sous: suiteTexte(idx, k) }], onFin: () => apresRepos(idx, derniere) }, src);
  }
  /* Temps : lancer -> préparation 3 s -> travail -> (série validée) -> repos, dans le même chrono. */
  function lancerTemps(idx, k, src) {
    const e = etapes()[idx], s = st.series[idx][k];
    lancerChrono({ ui: 'simple', onFin: () => apresRepos(idx, st.series[idx].every(x => x.fait)), phases: [
      { type: 'prep', dur: 3, label: 'Prêt ?', sous: e.nom + ' · série ' + (k + 1) + ' sur ' + e.series },
      { type: 'travail', dur: s.duree, label: e.nom, sous: 'Série ' + (k + 1) + ' sur ' + e.series + ' · tenez !', apres: () => { enregistrer(idx, k); M1.vibre(200); } },
      { type: 'repos', dur: e.repos, label: 'Repos', sous: '', pre: (ph) => { ph.sous = suiteTexte(idx, k); } }
    ] }, src);
  }
  function apresRepos(idx, derniere) {
    fermerChrono(() => {
      const panel = $('.panel[data-i="' + idx + '"]', ec);
      if (panel && !rm()) { const cur = $('.rang.courant', panel); if (cur) gsap.fromTo(cur, { scale: .96 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.5)', clearProps: 'transform' }); }
      if (derniere && st.i === idx) proposerSuite(idx);
    });
  }
  /* Glissement automatique vers l'exercice suivant, avec « Rester ici ». */
  function proposerSuite(idx) {
    if (idx >= etapes().length - 1) return;
    const nx = etapes()[idx + 1];
    const t = document.createElement('div'); t.className = 'toast-suite';
    t.innerHTML = '<div class="tx">' + nx.nom + '<small>dans 3 secondes</small></div><button type="button" data-act="rester">Rester ici</button><span class="prog"></span>';
    $('.se', ec).appendChild(t);
    const tl = gsap.timeline({ onComplete: () => { t.remove(); st.toast = null; if (st.i === idx) S.allerEtape(idx + 1); } });
    tl.fromTo(t, { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'expo.out' }, 0)
      .fromTo($('.prog', t), { scaleX: 1 }, { scaleX: 0, duration: 3, ease: 'none' }, .1);
    st.toast = { kill: () => { tl.kill(); } };
  }

  /* ================================================================ Série ouverte (ligne -> panneau) */
  function ouvrirSerie(idx, k, rowEl) {
    if (serieOuverte || A.occupe) return;
    const e = etapes()[idx], s = st.series[idx][k], cur = courant(idx);
    serieOuverte = { idx, k, row: rowEl };
    const couche = $('#sc-serie');
    const champs = e.type === 'force'
      ? champHTML('reps', 'Répétitions', s.reps, e.par ? 'par jambe' : 'reps') + champHTML('kg', 'Charge', M1.fmt(s.kg), 'kg')
      : champHTML('duree', 'Durée', s.duree, 'secondes');
    const verbe = k === cur ? (e.type === 'temps' ? 'Lancer la série' : 'Valider la série') : 'Enregistrer';
    couche.innerHTML = '<div class="sc-contenu"><div class="sc-haut" data-c><button class="rond" type="button" data-act="serie-fermer" aria-label="Fermer">' + I.fermer + '</button>' +
      '<span class="lab">Série ' + (k + 1) + ' sur ' + e.series + '<br>' + e.bloc + '</span></div>' +
      '<h3 class="sv-t" data-c>' + e.nom + '</h3><p class="sv-s" data-c>Touchez une valeur pour la modifier.</p>' +
      '<div class="champs" data-c>' + champs + '</div>' +
      '<p class="sv-prec" data-c>' + (e.prec ? 'Dernière fois · ' + e.prec : e.note) + '</p>' +
      '<button class="gros" type="button" data-act="serie-valider" data-c>' + verbe + '</button></div>';
    A.ouvrirRect(couche, rowEl, { rayon: 22 });
  }
  function champHTML(cle, lab, val, unite) {
    return '<button class="champ" type="button" data-champ="' + cle + '"><span class="ch-lab">' + lab + '<em>Modifier</em></span><span class="ch-val"><span class="v">' + val + '</span><small>' + unite + '</small></span></button>';
  }
  function fermerSerie(cb) {
    if (!serieOuverte) return;
    const { idx, k, row } = serieOuverte; serieOuverte = null;
    majRows(idx);
    const r = $('.panel[data-i="' + idx + '"] .rang[data-s="' + k + '"]', ec);
    A.fermerRect($('#sc-serie'), r || row, { onFini: () => { if (cb) cb(); } });
  }
  function validerSerieOuverte(btn) {
    const { idx, k } = serieOuverte, e = etapes()[idx], cur = courant(idx), s = st.series[idx][k];
    const couche = $('#sc-serie');
    if (k !== cur) { fermerSerie(); return; }               // simple enregistrement des valeurs
    serieOuverte = null; majRows(idx);
    const cacher = () => { couche.hidden = true; gsap.set(couche, { clearProps: 'clipPath,opacity' }); };
    if (e.type === 'force') {
      enregistrer(idx, k); M1.vibre(25);
      const derniere = st.series[idx].every(x => x.fait);
      lancerChrono({ ui: 'simple', phases: [{ type: 'repos', dur: e.repos, label: 'Repos', sous: suiteTexte(idx, k) }], onFin: () => apresRepos(idx, derniere), apresOuverture: () => { cacher(); pulseRow(idx, k); } }, btn);
    } else {
      lancerTemps(idx, k, btn); setTimeout(cacher, 800);
    }
  }

  /* ================================================================ Sélecteur (valeur -> roue) */
  const CHAMPS = { reps: { lab: 'Répétitions', min: 1, max: 30, pas: 1, unite: 'reps' }, kg: { lab: 'Charge', min: 0, max: 120, pas: 1, unite: 'kg' }, duree: { lab: 'Durée', min: 10, max: 120, pas: 5, unite: 's' } };
  const CRAN = 104;
  function ouvrirSelecteur(cle, champEl) {
    if (sel || A.occupe) return;
    const { idx, k } = serieOuverte, e = etapes()[idx], s = st.series[idx][k], def = CHAMPS[cle];
    const valeur = s[cle], n = Math.round((def.max - def.min) / def.pas) + 1, index = Math.round((valeur - def.min) / def.pas);
    sel = { cle, idx, k, def, index, champEl, ancienne: valeur };
    const couche = $('#sc-sel');
    let crans = ''; for (let i = 0; i < n; i++) crans += '<div class="cran" data-i="' + i + '">' + M1.fmt(def.min + i * def.pas) + '</div>';
    couche.innerHTML = '<div class="sel"><div class="sc-haut" data-c><button class="rond" type="button" data-act="sel-fermer" aria-label="Annuler">' + I.fermer + '</button>' +
      '<span class="lab">' + def.lab + ' · ' + e.nom + '<br>Série ' + (k + 1) + ' sur ' + e.series + '</span></div>' +
      '<div class="roue-w" data-c><div class="roue" id="roue" tabindex="0" role="spinbutton" aria-label="' + def.lab + '" aria-valuenow="' + valeur + '">' + crans + '</div><div class="roue-cadre"></div><span class="roue-unite">' + (cle === 'reps' && e.par ? '/jambe' : def.unite) + '</span></div>' +
      '<button class="gros" type="button" data-act="sel-valider" data-c>Valider</button></div>';
    A.ouvrirRect(couche, champEl, { rayon: 24 });
    const roue = $('#roue', couche);
    const pad = () => { const h = roue.clientHeight; roue.style.paddingTop = roue.style.paddingBottom = Math.max(0, (h - CRAN) / 2) + 'px'; roue.scrollTop = index * CRAN; majRoue(true); };
    requestAnimationFrame(() => requestAnimationFrame(pad));
    setTimeout(pad, 60);
    brancherRoue(roue);
  }
  function majRoue(force) {
    const roue = $('#roue'); if (!roue || !sel) return;
    const pos = roue.scrollTop / CRAN, items = roue.children, idx = Math.max(0, Math.min(items.length - 1, Math.round(pos)));
    for (let i = Math.max(0, Math.floor(pos) - 5); i < Math.min(items.length, Math.ceil(pos) + 6); i++) {
      const d = i - pos, a = Math.abs(d), sc = 1 / (1 + a * .95), op = 1 / (1 + a * 1.5) - (a > 3 ? .1 : 0);
      items[i].style.transform = 'translateY(' + (-d * CRAN * (1 - sc) * .3).toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')';
      items[i].style.opacity = Math.max(0, op).toFixed(3);
    }
    if (force) { sel.pos0 = true; }
    if (idx !== sel.index) { sel.index = idx; M1.vibre(6); roue.setAttribute('aria-valuenow', sel.def.min + idx * sel.def.pas); }
  }
  function brancherRoue(roue) {
    let raf = 0, drag = null;
    roue.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; majRoue(); }); }, { passive: true });
    const vers = (i) => roue.scrollTo({ top: Math.max(0, Math.min(roue.children.length - 1, i)) * CRAN, behavior: rm() ? 'auto' : 'smooth' });
    // glisser à la souris (sur écran tactile, le défilement natif avec inertie et crans magnétiques suffit)
    roue.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      drag = { y: e.clientY, s: roue.scrollTop, moved: false, t: performance.now(), v: 0, ly: e.clientY, lt: performance.now() };
      roue.classList.add('glisse'); roue.setPointerCapture(e.pointerId);
    });
    roue.addEventListener('pointermove', (e) => {
      if (!drag) return; const dy = e.clientY - drag.y; if (Math.abs(dy) > 4) drag.moved = true;
      const now = performance.now(); drag.v = (e.clientY - drag.ly) / Math.max(1, now - drag.lt); drag.ly = e.clientY; drag.lt = now;
      roue.scrollTop = drag.s - dy;
    });
    const fin = () => {
      if (!drag) return; const d = drag; drag = null; roue.classList.remove('glisse');
      roue._moved = d.moved;
      if (d.moved) vers(Math.round((roue.scrollTop - d.v * 260) / CRAN));
    };
    roue.addEventListener('pointerup', fin); roue.addEventListener('pointercancel', fin);
    roue.addEventListener('click', (e) => {
      const c = e.target.closest('.cran'); if (!c || (e.detail === 0)) return;
      if (roue._moved) { roue._moved = false; return; }
      if (drag) return; if (Math.abs((+c.dataset.i) - roue.scrollTop / CRAN) < .4) return; vers(+c.dataset.i);
    });
    roue.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') { e.preventDefault(); vers(sel.index - 1); } if (e.key === 'ArrowDown') { e.preventDefault(); vers(sel.index + 1); } if (e.key === 'Enter') validerSelecteur(); });
  }
  function fermerSelecteur() {
    if (!sel) return; const { champEl } = sel; sel = null;
    A.fermerRect($('#sc-sel'), champEl, { duree: .42 });
  }
  function validerSelecteur() {
    if (!sel) return;
    const { cle, idx, k, def, index, champEl, ancienne } = sel, v = def.min + index * def.pas; sel = null;
    st.series[idx][k][cle] = v;
    st.series[idx].forEach((s, j) => { if (j > k && !s.fait && s[cle] === ancienne) s[cle] = v; });   // les séries suivantes reprennent la valeur
    const cible = $('.ch-val .v', champEl);
    A.fermerRect($('#sc-sel'), champEl, { duree: .46, onFini: () => { A.compter(cible, ancienne, v, { duree: .9, ease: 'expo.out', fmt: x => M1.fmt(Math.round(x * 2) / 2) }); } });
  }

  /* ================================================================ Tiroir de l'overview */
  function renderTiroir() {
    const l = $('#t-liste', ec); if (!l) return;
    l.innerHTML = etapes().map((e, i) => {
      const sr = st.series[i], det = e.type === 'circuit' ? e.mode + ' ' + e.minutes + ' min' : (e.type === 'force' ? e.series + ' × ' + e.reps + ' · ' + M1.fmt(e.kg) + ' kg' : e.series + ' × ' + e.duree + ' s');
      return '<li class="' + (st.fait[i] ? 'fait ' : '') + (i === st.i ? 'courant' : '') + '"><button type="button" data-goto="' + i + '"><span class="tn">' + (st.fait[i] ? '✓' : i + 1) + '</span><span>' + e.nom + '<small>' + det + '</small></span></button></li>';
    }).join('');
  }
  function ouvrirTiroir() {
    if (drawer || !st) return; drawer = true; renderTiroir();
    const sc = $('#scrim'); sc.style.pointerEvents = 'auto';
    gsap.to(sc, { opacity: 1, duration: .35 });
    gsap.set('#tiroir', { visibility: 'visible' });
    gsap.to('#tiroir', { x: 0, xPercent: 0, duration: rm() ? .2 : .65, ease: 'expo.out', overwrite: true });
    gsap.fromTo('#t-liste li', { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: .6, stagger: .035, delay: .12, ease: 'expo.out', clearProps: 'transform,opacity' });
  }
  function fermerTiroir() {
    if (!drawer) return; drawer = false;
    const sc = $('#scrim'); sc.style.pointerEvents = 'none';
    gsap.to(sc, { opacity: 0, duration: .3 });
    gsap.to('#tiroir', { x: tiroirLarg(), duration: rm() ? .15 : .42, ease: 'power3.out', overwrite: true, onComplete: () => gsap.set('#tiroir', { visibility: 'hidden' }) });
  }
  const tiroirLarg = () => ($('#tiroir', ec).offsetWidth + 30);
  function brancherTiroir() {
    const tir = $('#tiroir', ec); gsap.set(tir, { x: tiroirLarg(), visibility: 'hidden' });
    let d = null;
    tir.addEventListener('pointerdown', (e) => { d = { x: e.clientX, t: performance.now(), dx: 0, on: false, id: e.pointerId }; });
    tir.addEventListener('pointermove', (e) => {
      if (!d) return; const dx = e.clientX - d.x;
      if (!d.on && dx > 10) { d.on = true; try { tir.setPointerCapture(d.id); } catch (_) { /* ok */ } }
      if (d.on) { d.dx = Math.max(0, dx); gsap.set(tir, { x: d.dx }); gsap.set('#scrim', { opacity: 1 - d.dx / tiroirLarg() }); }
    });
    const fin = () => { if (!d) return; const m = d; d = null; if (!m.on) return;
      const v = m.dx / Math.max(1, performance.now() - m.t);
      if (m.dx > 90 || v > .5) fermerTiroir(); else { gsap.to(tir, { x: 0, duration: .5, ease: 'expo.out' }); gsap.to('#scrim', { opacity: 1, duration: .3 }); } };
    tir.addEventListener('pointerup', fin); tir.addEventListener('pointercancel', fin);
    // l'onglet latéral : un coup de pouce vers la gauche l'ouvre aussi
    const tab = $('.tab-tiroir', ec); let t = null;
    tab.addEventListener('pointerdown', (e) => { t = { x: e.clientX, done: false }; });
    tab.addEventListener('pointermove', (e) => { if (t && !t.done && e.clientX - t.x < -14) { t.done = true; ouvrirTiroir(); } });
    tab.addEventListener('pointerup', () => { setTimeout(() => { t = null; }, 0); });
  }

  /* ================================================================ Chrono (repos, séries au temps, AMRAP, EMOM) */
  const SONS = { tic: () => { M1.bip(740, .09, .22); M1.vibre(12); }, go: () => { M1.bip(1180, .22, .28); M1.vibre(60); }, fin: () => { M1.bip(880, .5, .3); setTimeout(() => M1.bip(880, .5, .3), 220); M1.vibre([180, 80, 180]); } };

  function chronoHTML(cfg) {
    const bgs = '<div class="bgs"><i data-ph="prep"></i><i data-ph="travail"></i><i data-ph="repos"></i></div>';
    if (cfg.ui === 'amrap') {
      return bgs + '<div class="ch-contenu"><div class="ch-phase"><span class="ch-pt"></span><span id="ch-ph">Préparation</span></div><p class="ch-sous" id="ch-sous"></p>' +
        '<div class="ch-circuit" style="margin-top:auto"><div class="ch-temps xl" id="ch-t">0:10</div><div class="ch-total" id="ch-total"></div>' +
        '<ul class="liste-mvt">' + cfg.exos.map(x => '<li><b>' + x.q + '</b>' + x.n + (x.d ? ' · ' + x.d : '') + '</li>').join('') + '</ul>' +
        '<div class="ch-tours"><span>Tours</span><b id="ch-tours">' + (st.tours.amrap || 0) + '</b></div></div>' +
        '<div class="ch-bas" style="margin-top:auto"><button class="btn-tour" type="button" id="btn-tour" data-ch="tour" disabled style="opacity:.35">+1 tour</button>' +
        '<div class="rang-btn" id="ch-btns"></div></div></div>';
    }
    if (cfg.ui === 'emom') {
      return bgs + '<div class="ch-contenu"><div class="ch-phase"><span class="ch-pt"></span><span id="ch-ph">Préparation</span></div><p class="ch-sous" id="ch-sous" style="font-family:var(--font-titre);font-size:30px;letter-spacing:-.04em;line-height:1.1;margin-top:14px"></p>' +
        '<div class="ch-anneau" style="width:270px;height:270px"><svg viewBox="0 0 300 300"><circle class="piste-a" cx="150" cy="150" r="136"/><circle class="reste" cx="150" cy="150" r="136"/></svg><div class="ch-temps" id="ch-t" style="font-size:96px">0:10</div></div>' +
        '<div class="ch-total" id="ch-total" style="margin-bottom:16px"></div><div class="ch-bas"><div class="rang-btn" id="ch-btns"></div></div></div>' +
        '<div class="minute-flash" id="m-flash"><div><div class="mf-n" id="mf-n"></div><div class="mf-m" id="mf-m"></div></div></div>';
    }
    return bgs + '<div class="ch-contenu"><div class="ch-phase"><span class="ch-pt"></span><span id="ch-ph"></span></div><p class="ch-sous" id="ch-sous"></p>' +
      '<div class="ch-anneau"><svg viewBox="0 0 300 300"><circle class="piste-a" cx="150" cy="150" r="136"/><circle class="reste" cx="150" cy="150" r="136"/></svg><div class="ch-temps" id="ch-t">0:00</div></div>' +
      '<div class="ch-bas"><div class="rang-btn" id="ch-btns"></div></div></div>';
  }
  function lancerChrono(cfg, src) {
    if (ch) { cancelAnimationFrame(ch.raf); ch = null; }
    const layer = $('#sc-chrono');
    layer.innerHTML = chronoHTML(cfg);
    const c = ch = { cfg, layer, i: -1, t0: 0, sec: null, raf: 0, fini: false, phases: cfg.phases, silence: false };
    c.ring = $('.reste', layer); if (c.ring) A.anneau(c.ring, 1);
    phaseVisuelle(c, c.phases[0], true);
    A.ouvrirCercle(layer, src, { onFini: cfg.apresOuverture || null });
    if (!rm()) gsap.fromTo($('.ch-contenu', layer), { opacity: 0 }, { opacity: 1, duration: .3, delay: .22, ease: 'power1.out' });
    demarrerPhase(c, 0, H.now());
    c.raf = requestAnimationFrame(function boucle() { if (ch !== c) return; tick(c); if (ch === c && !c.fini) c.raf = requestAnimationFrame(boucle); });
  }
  function phaseVisuelle(c, ph, immediat) {
    const l = c.layer, t = ph.type;
    l.style.setProperty('--ph-fg', 'var(--ph-' + t + '-fg)'); l.style.setProperty('--ph-bg-actuel', 'var(--ph-' + t + '-bg)');
    $$('.bgs i', l).forEach(i => gsap.to(i, { opacity: i.dataset.ph === t ? 1 : 0, duration: immediat || rm() ? 0 : .22, overwrite: 'auto' }));
  }
  function boutons(c, ph) {
    const b = $('#ch-btns', c.layer); if (!b) return;
    const cfg = c.cfg;
    if (cfg.ui === 'simple') {
      if (ph.type === 'repos') b.innerHTML = '<button type="button" data-ch="plus">+15 s</button><button type="button" class="plein" data-ch="passer">Passer</button>';
      else if (ph.type === 'travail') b.innerHTML = '<button type="button" class="plein" data-ch="passer">Terminer</button>';
      else b.innerHTML = '<button type="button" class="plein" data-ch="passer">Passer</button>';
    } else if (c.fini) {
      b.innerHTML = '<button type="button" class="plein" data-ch="valider">Valider le circuit</button>';
    } else {
      b.innerHTML = '<button type="button" data-ch="passer">' + (ph.type === 'prep' ? 'Commencer maintenant' : 'Terminer le circuit') + '</button>';
    }
  }
  function demarrerPhase(c, i, t0) {
    const ph = c.phases[i]; c.i = i; c.t0 = t0; c.sec = null;
    if (ph.pre) ph.pre(ph);
    phaseVisuelle(c, ph);
    const L = c.layer, lab = $('#ch-ph', L), sous = $('#ch-sous', L);
    if (c.cfg.ui === 'simple') {
      lab.textContent = ph.type === 'repos' ? 'Repos' : ph.type === 'prep' ? 'Prêt ?' : 'Allez !'; sous.textContent = ph.sous || ph.label;
    } else {
      lab.textContent = ph.label; if (sous) sous.innerHTML = ph.sous || '';
    }
    boutons(c, ph);
    if (c.cfg.ui === 'amrap' && $('#btn-tour', L)) { const b = $('#btn-tour', L); const on = ph.type === 'travail'; b.disabled = !on; b.style.opacity = on ? 1 : .35; }
    if (c.cfg.ui === 'emom' && ph.type === 'travail') flashMinute(c, ph);
    if (ph.type === 'travail' && c.cfg.ui !== 'emom') SONS.go();
    const tt = $('#ch-t', L); if (tt && !rm() && i > 0) gsap.fromTo(tt, { scale: 1.08 }, { scale: 1, duration: .6, ease: 'expo.out' });
  }
  function flashMinute(c, ph) {
    const f = $('#m-flash', c.layer); if (!f) return;
    $('#mf-n', f).textContent = ph.label.toUpperCase(); $('#mf-m', f).textContent = ph.mvt;
    SONS.go();
    if (rm()) { gsap.fromTo(f, { opacity: 0 }, { opacity: 1, duration: .15, yoyo: true, repeat: 1, repeatDelay: .5 }); return; }
    gsap.timeline().fromTo(f, { opacity: 1, clipPath: 'inset(100% 0px 0px 0px)' }, { clipPath: 'inset(0% 0px 0px 0px)', duration: .35, ease: 'expo.out' })
      .fromTo($('.mf-n, .mf-m', f), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .45, stagger: .05, ease: 'expo.out' }, .05)
      .to(f, { clipPath: 'inset(0px 0px 100% 0px)', duration: .45, ease: 'power3.inOut' }, '+=.45').set(f, { opacity: 0, clearProps: 'clipPath' });
  }
  function tick(c) {
    let ph = c.phases[c.i], rest = ph.dur - (H.now() - c.t0) / 1000;
    while (rest <= 0) {
      const ultime = c.i + 1 >= c.phases.length;
      if (!c.silence) { if (ph.type === 'travail' && (c.cfg.ui !== 'emom' || ultime)) SONS.fin(); else if (ph.type === 'repos') SONS.fin(); }
      c.silence = false;
      if (ph.apres) ph.apres();
      if (c.i + 1 >= c.phases.length) { terminerChrono(c); return; }
      const t0 = c.t0 + ph.dur * 1000; demarrerPhase(c, c.i + 1, Math.min(t0, H.now()));
      ph = c.phases[c.i]; rest = ph.dur - (H.now() - c.t0) / 1000;
    }
    const sec = Math.ceil(rest - 1e-6);
    if (sec !== c.sec) {
      c.sec = sec;
      const L = c.layer, tt = $('#ch-t', L);
      if (tt) tt.textContent = M1.mmss(c.cfg.ui === 'emom' && ph.type === 'travail' ? sec : sec);
      if (sec <= 3 && sec >= 1) { SONS.tic(); if (tt && !rm()) gsap.fromTo(tt, { scale: 1.14 }, { scale: 1, duration: .55, ease: 'expo.out' }); }
      const tot = $('#ch-total', L);
      if (tot) {
        if (ph.type === 'prep') tot.textContent = 'Départ dans ' + sec + ' s';
        else if (c.cfg.ui === 'amrap') tot.textContent = 'Tour ' + ((st.tours.amrap || 0) + 1) + ' en cours';
        else tot.textContent = c.cfg.ui === 'emom' ? 'Reste ' + M1.mmss(ph.reste0 - (ph.dur - rest)) + ' au total' : '';
      }
    }
    if (c.ring) A.anneau(c.ring, rest / ph.dur);
  }
  function terminerChrono(c) {
    c.fini = true; cancelAnimationFrame(c.raf);
    if (c.cfg.ui === 'simple') { c.cfg.onFin && c.cfg.onFin(c); return; }
    // circuit terminé : « Temps ! »
    const L = c.layer; phaseVisuelle(c, { type: 'prep' });
    $('#ch-ph', L).textContent = 'Temps !'; $('#ch-t', L).textContent = '0:00';
    const sous = $('#ch-sous', L); if (sous) sous.textContent = c.cfg.ui === 'amrap' ? 'Bien joué. Notez vos tours.' : 'Six minutes enchaînées.';
    const tot = $('#ch-total', L); if (tot) tot.textContent = '';
    if (c.ring) A.anneau(c.ring, 0);
    boutons(c, { type: 'prep' });
    const bt = $('#btn-tour', L); if (bt) { bt.disabled = false; bt.style.opacity = 1; }
    if (!rm()) gsap.fromTo($('#ch-t', L), { scale: 1.2 }, { scale: 1, duration: 1, ease: 'elastic.out(1,.5)' });
  }
  function fermerChrono(cb) {
    const c = ch; if (c) cancelAnimationFrame(c.raf); ch = null;
    A.fermerCercle($('#sc-chrono'), null, { onFini: () => { $('#sc-chrono').innerHTML = ''; if (cb) cb(); } });
  }
  function actionChrono(act) {
    const c = ch; if (!c) return;
    const ph = c.phases[c.i];
    if (act === 'plus') { ph.dur += 15; c.sec = null; if (c.ring) A.anneau(c.ring, 1); M1.bip(1000, .06, .2); const tt = $('#ch-t', c.layer); if (tt && !rm()) gsap.fromTo(tt, { scale: 1.1 }, { scale: 1, duration: .5, ease: 'expo.out' }); }
    else if (act === 'passer') {
      if (c.cfg.ui !== 'simple' && ph.type === 'travail') { terminerChrono(c); return; }   // « Terminer le circuit » : on arrête tout
      c.silence = true; c.t0 = H.now() - ph.dur * 1000 - 1;
    } else if (act === 'tour') {
      st.tours.amrap = (st.tours.amrap || 0) + 1; const b = $('#ch-tours', c.layer); b.textContent = st.tours.amrap;
      M1.vibre(30); M1.bip(1320, .07, .2);
      if (!rm()) { gsap.fromTo(b, { scale: 1.5, y: -8 }, { scale: 1, y: 0, duration: .7, ease: 'elastic.out(1,.45)' }); gsap.fromTo('#btn-tour', { scale: .96 }, { scale: 1, duration: .5, ease: 'back.out(2.5)', clearProps: 'transform' }); }
    } else if (act === 'valider') validerCircuit();
  }
  /* AMRAP / EMOM : écran d'explication -> overview -> chrono plein écran */
  function stadeSuivant(idx) {
    const e = etapes()[idx], zone = $('#circ-' + idx, ec), s = st.stade[idx];
    const nv = s === 'expl' ? 'exos' : 'fait'; st.stade[idx] = nv;
    const ancien = $('.stade', zone), neuf = document.createElement('div'); neuf.innerHTML = stadeHTML(e, idx);
    const n = neuf.firstChild; zone.appendChild(n);
    const btn = $('[data-act="action"]', $('.panel[data-i="' + idx + '"]', ec)); btn.textContent = actionCircuit(idx);
    if (rm()) { ancien.remove(); return; }
    gsap.to(ancien, { x: -60, opacity: 0, duration: .35, ease: 'power3.out', onComplete: () => ancien.remove() });
    gsap.fromTo(n, { x: 70, opacity: 0 }, { x: 0, opacity: 1, duration: .8, ease: 'expo.out', delay: .1, clearProps: 'transform,opacity' });
    gsap.fromTo(n.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .06, ease: 'expo.out', delay: .18, clearProps: 'transform,opacity' });
  }
  function lancerCircuit(idx, src) {
    const e = etapes()[idx];
    if (e.mode === 'AMRAP') {
      lancerChrono({ ui: 'amrap', exos: e.exos, onFin: null, phases: [
        { type: 'prep', dur: 10, label: 'Préparation', sous: 'AMRAP · ' + e.minutes + ' min<br>Prenez votre place.' },
        { type: 'travail', dur: e.minutes * 60, label: 'AMRAP', sous: 'Plus de tours possible, bonne cadence.' }
      ] }, src);
    } else {
      const ph = [{ type: 'prep', dur: 10, label: 'Préparation', sous: 'EMOM · ' + e.minutes + ' min<br>Minute 1 : 12 air squats' }];
      for (let m = 1; m <= e.minutes; m++) {
        const mvt = e.minutes_exos[(m - 1) % 2];
        ph.push({ type: 'travail', dur: 60, label: 'Minute ' + m + ' / ' + e.minutes, mvt, sous: mvt, reste0: (e.minutes - m + 1) * 60 });
      }
      lancerChrono({ ui: 'emom', onFin: null, phases: ph }, src);
    }
  }
  function validerCircuit() {
    const idx = st.i, e = etapes()[idx]; st.fait[idx] = true; st.stade[idx] = 'fait';
    if (e.mode === 'AMRAP') st.nbSeries += 0;
    const panel = $('.panel[data-i="' + idx + '"]', ec), zone = $('#circ-' + idx, ec);
    zone.innerHTML = stadeHTML(e, idx); $('[data-act="action"]', panel).textContent = actionCircuit(idx);
    majSegments(); renderTiroir();
    fermerChrono(() => {
      if (!rm()) gsap.fromTo(zone.firstChild.children, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .1, ease: 'expo.out', clearProps: 'transform,opacity' });
      if (idx < etapes().length - 1) proposerSuite(idx);
    });
  }

  /* ================================================================ Écran de fin : l'aplat se referme en anneau, puis les chiffres comptent */
  function finir(src) {
    const min = Math.max(1, Math.round((H.now() - st.debut) / 60000)); M1.etat.dureeSeance = min;
    const recs = st.records.slice().sort((a, b) => b.kg - a.kg), rec = recs[0];
    const couche = $('#sc-fin');
    couche.innerHTML = '<div class="fin-contenu"><div class="fin-hero"><div class="fin-anneau" id="f-anneau">' +
      '<span style="position:absolute;inset:0;border-radius:50%;background:var(--accent)" id="f-disque"></span><span style="position:absolute;inset:22px;border-radius:50%;background:var(--fond)" id="f-trou"></span>' +
      '<svg class="ok" viewBox="0 0 24 24" id="f-ok"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
      '<div class="fin-t"><h2 id="f-h">Bravo,<br>séance terminée</h2><p id="f-p">Workout 2 · Bas du corps + circuit</p></div>' +
      '<div class="fin-stats"><div class="st"><div class="v"><span id="f-min">0</span><small>min</small></div><div class="l">Durée</div></div>' +
      '<div class="st"><div class="v"><span id="f-vol">0</span><small>kg</small></div><div class="l">Volume</div></div>' +
      '<div class="st"><div class="v"><span id="f-ser">0</span></div><div class="l">Séries</div></div>' +
      '<div class="st"><div class="v"><span id="f-tours">0</span></div><div class="l">Tours AMRAP</div></div>' +
      '<div class="st record" id="f-rec">' + I.coupe + '<div><div class="l">' + (rec ? (recs.length > 1 ? 'Nouveau record · +' + (recs.length - 1) + ' autres' : 'Nouveau record') : 'Belle séance') + '</div><div class="v">' + (rec ? rec.nom + ' · ' + M1.fmt(rec.kg) + ' kg' : 'Régularité récompensée') + '</div></div></div></div>' +
      '<div class="fin-bas"><button class="gros" type="button" data-act="valider-seance">Valider ma séance</button></div></div>' +
      '<div class="aplat" id="f-aplat"></div>';
    gsap.set('#f-h, #f-p, .fin-stats .st, .fin-bas, #f-ok, #f-trou', { opacity: 0 });
    A.ouvrirCercle(couche, src, { duree: .7 });
    setTimeout(() => animFin(min), rm() ? 100 : 560);
  }
  function animFin(min) {
    const L = $('#sc-fin'), aplat = $('#f-aplat'), C = A.centreDe($('#f-anneau'));
    const nombres = () => {
      A.compter($('#f-min'), 0, min, { duree: 1.4, delay: .1 });
      A.compter($('#f-vol'), 0, st.volume, { duree: 2.2, delay: .15, fmt: v => M1.milliers(v) });
      A.compter($('#f-ser'), 0, st.nbSeries, { duree: 1.5, delay: .2 });
      A.compter($('#f-tours'), 0, st.tours.amrap || 0, { duree: 1.3, delay: .25 });
    };
    if (rm()) { gsap.set('#f-h, #f-p, .fin-stats .st, .fin-bas, #f-ok, #f-trou', { opacity: 1 }); aplat.remove(); nombres(); return; }
    const tl = gsap.timeline();
    tl.fromTo(aplat, { clipPath: 'circle(1000px at ' + C.x + 'px ' + C.y + 'px)' }, { clipPath: 'circle(95px at ' + C.x + 'px ' + C.y + 'px)', duration: .95, ease: 'expo.inOut' }, 0)
      .add(() => { aplat.style.display = 'none'; }, '>')
      .set('#f-trou', { opacity: 1, scale: 0 }, '<')
      .to('#f-trou', { scale: 1, duration: .8, ease: 'back.out(1.5)' }, '<')
      .fromTo('#f-ok', { opacity: 1 }, { opacity: 1, duration: .01 }, '<')
      .fromTo('#f-ok path', { strokeDasharray: 40, strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: .6, ease: 'power2.out' }, '<.25')
      .fromTo('#f-anneau', { scale: 1 }, { scale: 1.06, duration: .3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<.3')
      .fromTo('#f-h, #f-p', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .1, ease: 'expo.out', clearProps: 'transform' }, '<.1')
      .fromTo('.fin-stats .st', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .09, ease: 'expo.out', clearProps: 'transform' }, '<.15')
      .add(nombres, '<.1')
      .fromTo('.fin-bas', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'expo.out', clearProps: 'transform' }, '<.5')
      .fromTo('#f-rec', { scale: .9 }, { scale: 1, duration: .9, ease: 'elastic.out(1,.5)' }, '<.2');
  }
  S.terminer = function (btn) {
    // retour au tableau de bord : tout se referme dans la carte « cette semaine », qui passe à 2/3
    M1.etat.seanceFaite = true; stopperTout();
    M1.apresSeance();
    A.viderPile(ec);
    const carte = $('#c-semaine'); ec._src = carte;
    A.fermerPage(ec, { force: true, onFini: () => { st = null; M1.animerSemaine(); } });
  };

  /* ================================================================ Événements */
  function brancher() {
    ec.addEventListener('click', (e) => {
      if (!st) return;
      const act = e.target.closest('[data-act]'), row = e.target.closest('.rang'), champ = e.target.closest('[data-champ]'), go = e.target.closest('[data-goto]'), chb = e.target.closest('[data-ch]');
      if (chb) { M1.deverrouillerSon(); actionChrono(chb.dataset.ch); return; }
      if (go) { S.allerEtape(+go.dataset.goto); fermerTiroir(); return; }
      if (champ && serieOuverte && !sel) { ouvrirSelecteur(champ.dataset.champ, champ); return; }
      if (row && !S.glissé && !serieOuverte && !ch && !drawer) { ouvrirSerie(+e.target.closest('.panel').dataset.i, +row.dataset.s, row); return; }
      if (e.target.id === 'scrim') { if (drawer) fermerTiroir(); else if ($('#feuille')._ouverte) montrerFeuille(false); return; }
      if (!act) return;
      M1.deverrouillerSon();
      const a = act.dataset.act, idx = st.i;
      if (a === 'quitter') { montrerFeuille(true); }
      else if (a === 'continuer') montrerFeuille(false);
      else if (a === 'quitter-ok') quitter();
      else if (a === 'tiroir') ouvrirTiroir();
      else if (a === 'rester') { if (st.toast) { st.toast.kill(); st.toast = null; } $$('.toast-suite', ec).forEach(n => gsap.to(n, { y: 80, opacity: 0, duration: .35, ease: 'power3.out', onComplete: () => n.remove() })); }
      else if (a === 'serie-fermer') fermerSerie();
      else if (a === 'serie-valider') validerSerieOuverte(act);
      else if (a === 'sel-fermer') fermerSelecteur();
      else if (a === 'sel-valider') validerSelecteur();
      else if (a === 'passer-finisher') finir(act);
      else if (a === 'valider-seance') S.terminer(act);
      else if (a === 'action') {
        const e0 = etapes()[idx];
        if (e0.type === 'circuit') {
          const s = st.stade[idx];
          if (s === 'expl') stadeSuivant(idx);
          else if (s === 'exos') lancerCircuit(idx, act);
          else if (idx === etapes().length - 1) finir(act); else S.allerEtape(idx + 1);
        } else {
          const cur = courant(idx);
          if (cur < 0) { if (idx === etapes().length - 1) finir(act); else S.allerEtape(idx + 1); }
          else if (e0.type === 'temps') lancerTemps(idx, cur, act);
          else validerForce(idx, cur, act);
        }
      }
    });
  }
  S.init = function () { brancher(); };
  const ouvrirOrig = S.ouvrir;
  S.ouvrir = function (btn) { ouvrirOrig(btn); brancherSwipe(); brancherTiroir(); };
  M1.seanceDebug = { etat: () => st };
})();
