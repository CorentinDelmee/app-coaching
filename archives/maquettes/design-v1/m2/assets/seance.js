/* M2 « Carnet » — la séance : slides d'exercices, série qui s'agrandit, roue de chiffres, chronos plein écran,
   circuits (AMRAP / EMOM), tiroir d'aperçu, couverture de fin.
   Fonctions de transition : demarrerSeance, allerA, ouvrirSerie / fermerSerie, ouvrirSelecteur / fermerSelecteur,
   chronoOuvrir / chronoFermer, ouvrirCircuit, ouvrirTiroir / fermerTiroir, finirSeance, validerSeance. */
'use strict';

const Seance = { exos: [], i: 0, debut: 0, record: null, actif: false, auto: null };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PLAY = '<svg class="lire" viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z"/></svg>';
const COCHE_S = COCHE.replace('<svg ', '<svg class="coche" ');

/* =============== Construction =============== */
function initSeance() {
  Seance.exos = SEQ.map(x => x.type === 'circuit'
    ? { ...x, fait: false, tours: 0, plus: 0 }
    : { ...x, sets: Array.from({ length: x.series }, () => ({ reps: x.reps, kg: x.kg, tps: x.tps, fait: false })) });
  Seance.i = 0; Seance.record = null; Seance.actif = true;
  const n = Seance.exos.length;
  $('#segs').innerHTML = Seance.exos.map(() => '<span class="seg"><i></i></span>').join('');
  const track = $('#track');
  track.innerHTML = Seance.exos.map((x, i) => exoHTML(x, i, n)).join('');
  track.style.width = (n * 100) + '%';
  $$('.exo', track).forEach(a => { a.style.width = (100 / n) + '%'; });
  construireTiroir();
  creerDragSlides();
  $$('.exo', track).forEach((a, k) => { gsap.set(a, { scale: k ? .92 : 1, opacity: k ? .35 : 1 }); gsap.set($$('.anim', a), { opacity: 0 }); });
  majSegs();
}
function nomDeux(nom) { const p = nom.split(' '), d = p.pop(); return (p.length ? p.join(' ') + '<br>' : '') + `<em>${d}</em>`; }
function exoHTML(x, i, n) {
  const pos = x.bloc;
  if (x.type === 'circuit') {
    const opt = x.id === 'emom';
    return `<article class="exo exo-circuit" data-i="${i}"><div><p class="kicker exo-pos anim">${pos}</p><h2 class="exo-nom serif anim">${x.format}<br><em>${x.minutes} minutes</em></h2>
      <p class="exo-cons anim">${x.exos.length} exercices à enchaîner. ${opt ? 'Facultatif : une dernière dose, si tu es en forme.' : 'Tout ce que tu peux, proprement.'}</p></div>
      <div class="gros-c num anim">${x.minutes}<small>min</small></div>
      <div class="anim" style="display:grid;gap:10px"><button class="btn gros" data-circuit="${i}">${opt ? 'Faire l’option' : 'Découvrir le circuit'} <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><use href="#i-fleche"/></svg></button>
      ${opt ? '<button class="btn gros sec" data-passer-option>Terminer sans l’option</button>' : ''}</div></article>`;
  }
  const temps = x.type === 'temps';
  const meta = temps
    ? `<span><b>${x.series}</b> séries</span><span><b>${x.tps} s</b> chacune</span><span>repos <b>${mmss(x.repos)}</b></span>`
    : `<span><b>${x.series}</b> séries</span><span><b>${x.reps}</b> reps${x.par ? ' ' + x.par : ''}</span><span><b>${fr(x.kg)} kg</b></span><span>repos <b>${mmss(x.repos)}</b></span>`;
  const rows = x.sets.map((s, k) => serieHTML(x, s, k)).join('');
  return `<article class="exo" data-i="${i}"><div><p class="kicker exo-pos anim">${pos}</p><h2 class="exo-nom serif anim">${nomDeux(x.nom)}</h2>
    <div class="exo-meta anim">${meta}</div><p class="exo-cons anim">${x.cons}</p>
    <div class="exo-liens anim"><a class="lien-v" href="${youtube(x.video)}" target="_blank" rel="noopener">${ICONE_LIRE} Voir la vidéo</a>${x.prev ? `<span class="exo-prec">Dernière fois : ${x.prev}</span>` : ''}</div></div>
    <div class="exo-prog num anim" aria-hidden="true"><span class="ep-n">0</span><small>/${x.series}</small></div>
    <ol class="series anim">${rows}</ol></article>`;
}
function serieHTML(x, s, k) {
  const temps = x.type === 'temps';
  const vals = temps
    ? `<span class="v"><b class="vt num" data-ch="tps">${s.tps}</b><small>s</small></span>`
    : `<span class="v"><b class="vt num" data-ch="reps">${s.reps}</b><small>reps</small></span><span class="x">×</span><span class="v"><b class="vt num" data-ch="kg">${fr(s.kg)}</b><small>kg</small></span>`;
  return `<li class="serie${temps ? ' temps' : ''}" data-s="${k}"><b class="vt sn num" data-ch="n">${k + 1}</b><span class="sv">${vals}</span><button class="sok" aria-label="${temps ? 'Lancer la série' : 'Valider la série'}">${temps ? PLAY : ''}${COCHE_S}</button></li>`;
}
function majExo(ei, { tracerSi = null } = {}) {
  const x = Seance.exos[ei], art = $(`.exo[data-i="${ei}"]`);
  if (x.type === 'circuit') { art.classList.toggle('fait-c', x.fait); majSegs(); majTiroir(); return; }
  const lis = $$('.serie', art), suiv = x.sets.findIndex(s => !s.fait);
  lis.forEach((li, k) => {
    const s = x.sets[k], etaitFait = li.classList.contains('fait');
    li.classList.toggle('fait', s.fait); li.classList.toggle('suiv', k === suiv);
    const p = $('.trait', li);
    if (s.fait && !etaitFait) tracer(p, { duree: .45, ease: 'power2.out' });
    if (!s.fait && etaitFait) gsap.set(p, { clearProps: 'strokeDashoffset' });
    if (tracerSi === k && !RM) gsap.fromTo(li, { scale: .97 }, { scale: 1, duration: .5, ease: 'back.out(3)', clearProps: 'transform' });
    majValeursLigne(li, x, s);
  });
  const ep = $('.ep-n', art), nf = x.sets.filter(s => s.fait).length;
  if (ep && +(ep.dataset.val || 0) !== nf) rouler(ep, nf, { duree: 1, delai: .1 });
  majSegs(); majTiroir();
}
function majValeursLigne(li, x, s) {
  $$('[data-ch]', li).forEach(b => { const k = b.dataset.ch; if (k !== 'n') b.textContent = k === 'kg' ? fr(s.kg) : s[k]; });
}
function fractionExo(x) { return x.type === 'circuit' ? (x.fait ? 1 : 0) : x.sets.filter(s => s.fait).length / x.sets.length; }
function majSegs() {
  $$('#segs .seg').forEach((sg, k) => {
    sg.classList.toggle('cur', k === Seance.i);
    gsap.to($('i', sg), { scaleX: fractionExo(Seance.exos[k]), duration: RM ? .2 : .7, ease: EASE.sortie });
  });
  $('#s-compteur').textContent = String(Seance.i + 1).padStart(2, '0') + ' / ' + String(Seance.exos.length).padStart(2, '0');
}

/* =============== Démarrage : le bouton accent déborde et devient la séance =============== */
function demarrerSeance() {
  if (Nav.occupe) return;
  Nav.occupe = true;
  initSeance();
  const e = $('#e-seance'), btn = $('#wk-demarrer'), c = cercleDepuis(btn, 0);
  e.style.zIndex = ++Nav.z; e.classList.add('visible');
  Nav.pile.push({ id: 'e-seance', mode: 'cercle' }); setChrome('e-seance');
  Seance.debut = Horloge.now();
  if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
  const voile = document.createElement('div'); voile.className = 'voile'; voile.style.background = 'var(--accent)'; e.appendChild(voile);
  const fin = () => { gsap.set(e, { clearProps: 'clipPath' }); voile.remove(); Nav.occupe = false; };
  allerA(0, { immediat: true });
  if (RM) { gsap.fromTo(e, { opacity: 0 }, { opacity: 1, duration: .3, onComplete: fin }); introExo(0); return; }
  gsap.set(e, { clipPath: c.depart });
  gsap.timeline({ onComplete: fin })
    .to(e, { clipPath: c.plein, duration: .95, ease: EASE.entree })
    .to(voile, { opacity: 0, duration: .5, ease: 'power1.out' }, .45)
    .add(() => introExo(0), .55)
    .fromTo('.s-haut, .languette', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: .7, ease: EASE.sortie, clearProps: 'all' }, .6);
}

/* =============== Slides horizontaux =============== */
let dragSlides = null;
const largeur = () => $('#slides').clientWidth;
function creerDragSlides() {
  if (dragSlides) dragSlides.kill();
  const track = $('#track'), W = largeur(), n = Seance.exos.length;
  gsap.set(track, { x: 0 });
  dragSlides = Draggable.create(track, {
    type: 'x', trigger: '#slides', lockAxis: true, edgeResistance: .9, minimumMovement: 10, inertia: true,
    bounds: { minX: -(n - 1) * W, maxX: 0 },
    snap: { x: v => clamp(Math.round(v / largeur()), Seance.i - 1, Seance.i + 1) * largeur() },
    onDragStart() { killAuto(); },
    onThrowComplete() { const k = clamp(Math.round(-this.x / largeur()), 0, n - 1); if (k !== Seance.i) arriveeA(k); },
  })[0];
}
function allerA(i, { immediat = false } = {}) {
  const n = Seance.exos.length; i = clamp(i, 0, n - 1);
  killAuto();
  const W = largeur();
  if (dragSlides) dragSlides.vars.bounds = { minX: -(n - 1) * W, maxX: 0 };
  gsap.to('#track', { x: -i * W, duration: immediat || RM ? 0 : DUREE.slide, ease: EASE.entree, overwrite: true, onComplete: () => dragSlides && dragSlides.update() });
  arriveeA(i, { immediat, delai: .42 });
}
function arriveeA(i, { immediat = false, delai = .1 } = {}) {
  Seance.i = i;
  $$('.exo').forEach((a, k) => gsap.to(a, { scale: k === i ? 1 : .92, opacity: k === i ? 1 : .35, duration: immediat || RM ? 0 : DUREE.slide, ease: EASE.entree }));
  majSegs();
  if (!immediat) gsap.delayedCall(RM ? 0 : delai, () => introExo(i));
}
/* Le texte « s'écrit » à l'arrivée : nom en lignes masquées, puis le reste en cascade (une seule fois par exercice) */
function introExo(i) {
  const a = $(`.exo[data-i="${i}"]`); if (!a || a.dataset.vu) return;
  a.dataset.vu = 1;
  const nom = $('.exo-nom', a), autres = $$('.anim', a).filter(e => e !== nom);
  gsap.set(nom, { opacity: 1 });
  lignes(nom, { delai: .05, duree: 1.1, stagger: .12 });
  revealer(autres, { y: 26, stagger: .07, delai: .2, duree: .9 });
}
window.addEventListener('resize', () => { if (Seance.actif && dragSlides) { creerDragSlides(); gsap.set('#track', { x: -Seance.i * largeur() }); dragSlides.update(); } });

/* Exercice suivant automatique, avec « Rester ici » */
function autoSuivant(ei) {
  const next = ei + 1; if (next >= Seance.exos.length) return;
  killAuto();
  const bloc = $('#auto-suiv'), barre = $('#as-barre');
  $('#as-nom').textContent = Seance.exos[next].nom;
  bloc.style.display = 'flex';
  const tl = gsap.timeline({ onComplete: () => { bloc.style.display = 'none'; allerA(next); } });
  tl.fromTo(bloc, { y: 90, opacity: 0 }, { y: 0, opacity: 1, duration: RM ? .2 : .6, ease: EASE.sortie })
    .fromTo(barre, { scaleX: 1 }, { scaleX: 0, duration: 3, ease: 'none' }, .2);
  Seance.auto = tl;
}
function killAuto() { if (Seance.auto) { Seance.auto.kill(); Seance.auto = null; } $('#auto-suiv').style.display = 'none'; }
$('#as-rester').addEventListener('click', killAuto);

/* =============== Interactions sur les séries =============== */
$('#track').addEventListener('click', e => {
  const bc = e.target.closest('[data-circuit]');
  if (bc) { ouvrirCircuit(+bc.dataset.circuit, bc); return; }
  if (e.target.closest('[data-passer-option]')) { finirSeance(); return; }
  const li = e.target.closest('.serie'); if (!li) return;
  const ei = +li.closest('.exo').dataset.i, si = +li.dataset.s;
  if (e.target.closest('.sok')) actionSerie(ei, si, li); else ouvrirSerie(ei, si, li);
});
function actionSerie(ei, si, li) {
  const x = Seance.exos[ei], s = x.sets[si];
  if (s.fait) { s.fait = false; majExo(ei); return; }
  if (x.type === 'temps') lancerTravail(ei, si, $('.sok', li)); else validerSerie(ei, si, $('.sok', li));
}
function validerSerie(ei, si, origine) {
  const x = Seance.exos[ei], s = x.sets[si];
  s.fait = true; Son.bip(660, .09); vibrer(15);
  if (x.id === 'gob' && s.kg > x.prevKg && (!Seance.record || s.kg > Seance.record.kg)) Seance.record = { nom: x.nom, kg: s.kg, prev: x.prevKg };
  majExo(ei, { tracerSi: si });
  if (x.sets.every(t => t.fait)) autoSuivant(ei); else repos(ei, origine);
}

/* =============== Série ouverte : la ligne s'agrandit en feuille =============== */
const SP = { ouvert: false, ei: 0, si: 0, li: null };
const CHAMPS = {
  reps: { label: 'Répétitions', unite: 'reps', min: 1, max: 50, pas: 1 },
  kg: { label: 'Charge', unite: 'kg', min: 0, max: 200, pas: .5 },
  tps: { label: 'Durée', unite: 's', min: 5, max: 300, pas: 5 },
};
function champHTML(k, val, unite) { return `<button class="champ" data-champ="${k}"><span class="kicker">${CHAMPS[k].label}</span><span class="champ-v"><b class="vt champ-n num" data-ch="${k}">${val}</b><i class="champ-u">${unite}</i></span><span class="edit">Toucher</span></button>`; }
function ouvrirSerie(ei, si, li) {
  if (SP.ouvert || Nav.occupe) return;
  SP.ouvert = true; Object.assign(SP, { ei, si, li });
  const x = Seance.exos[ei], s = x.sets[si], p = $('#serie-panel');
  $('#sp-exo').textContent = x.nom; $('#sp-num').textContent = si + 1; $('#sp-tot').textContent = '/ ' + x.series;
  $('#sp-champs').innerHTML = x.type === 'temps' ? champHTML('tps', s.tps, 's')
    : champHTML('reps', s.reps, x.par ? 'reps / jambe' : 'reps') + champHTML('kg', fr(s.kg), 'kg');
  $('#sp-prec').textContent = x.prev ? 'Dernière fois : ' + x.prev : 'Première fois sur cet exercice : prends ce qui te convient.';
  $('#sp-valider').textContent = x.type === 'temps' ? 'Lancer la série' : (s.fait ? 'Enregistrer' : 'Valider la série');
  p.style.display = 'flex';
  const items = [$('.sp-haut', p), $('.sp-titre', p), ...$$('.champ', p), $('#sp-prec'), $('#sp-valider')];
  gsap.to('#scrim', { opacity: 1, duration: .5 });
  $('#scrim').style.pointerEvents = 'auto';
  const rep = RM;
  if (rep) { gsap.fromTo(p, { opacity: 0 }, { opacity: 1, duration: .25 }); return; }
  gsap.set(items, { opacity: 0 });
  gsap.fromTo(p, { clipPath: clipDepuis(li, 22, p) }, { clipPath: 'inset(0px 0px 0px 0px round 34px 34px 0px 0px)', duration: .85, ease: EASE.entree, clearProps: 'clipPath' });
  voler($('[data-ch="n"]', li), $('#sp-num'), { duree: .85 });
  $$('.champ [data-ch]', p).forEach(d => voler($(`[data-ch="${d.dataset.ch}"]`, li), d, { duree: .85 }));
  gsap.to(items, { opacity: 1, duration: .5, delay: .55, stagger: .05 });
  gsap.from($$('.champ', p), { y: 24, duration: .9, delay: .5, stagger: .07, ease: EASE.sortie, clearProps: 'transform' });
}
function fermerSerie(cb) {
  if (!SP.ouvert) { if (cb) cb(); return; }
  const p = $('#serie-panel'), { li, ei, si } = SP, x = Seance.exos[ei], s = x.sets[si];
  majValeursLigne(li, x, s);
  const fin = () => { p.style.display = 'none'; gsap.set(p, { clearProps: 'all' }); $('#scrim').style.pointerEvents = 'none'; SP.ouvert = false; $$('.vt', li).forEach(v => { v.style.visibility = ''; }); if (cb) cb(); };
  gsap.to('#scrim', { opacity: 0, duration: .5 });
  if (RM) { gsap.to(p, { opacity: 0, duration: .25, onComplete: fin }); return; }
  gsap.to($$('.sp-haut,.sp-titre,.champ,#sp-prec,#sp-valider', p), { opacity: 0, duration: .2 });
  voler($('#sp-num'), $('[data-ch="n"]', li), { duree: .7, delai: .1 });
  $$('.champ [data-ch]', p).forEach(d => voler(d, $(`[data-ch="${d.dataset.ch}"]`, li), { duree: .7, delai: .1 }));
  gsap.fromTo(p, { clipPath: 'inset(0px 0px 0px 0px round 34px 34px 0px 0px)' }, { clipPath: () => clipDepuis(li, 22, p), duration: .7, delay: .1, ease: EASE.entree, onComplete: fin });
}
$('#sp-fermer').addEventListener('click', () => fermerSerie());
$('#scrim').addEventListener('click', () => { if (SP.ouvert) fermerSerie(); else fermerTiroir(); });
$('#sp-valider').addEventListener('click', () => {
  const { ei, si, li } = SP, x = Seance.exos[ei];
  fermerSerie(() => { if (x.type === 'temps') lancerTravail(ei, si, $('.sok', li)); else if (!x.sets[si].fait) validerSerie(ei, si, $('.sok', li)); });
});
$('#sp-champs').addEventListener('click', e => {
  const c = e.target.closest('.champ'); if (!c) return;
  const k = c.dataset.champ, s = Seance.exos[SP.ei].sets[SP.si];
  ouvrirSelecteur({ ...CHAMPS[k], unite: k === 'reps' && Seance.exos[SP.ei].par ? 'reps' : CHAMPS[k].unite, val: s[k], clef: k, champ: c, onValider: v => { s[k] = v; } });
});

/* =============== Sélecteur : roue de chiffres serif (Draggable + Inertia, crans magnétiques) =============== */
const Sel = { cfg: null, items: [], N: 0, PX: 60, pos: 0, drag: null, vis: new Set(), dernier: -1, ouvert: false, champ: null, lock: false, p: { v: 0 } };
const fmtVal = v => fr(Number.isInteger(v) ? v : +v.toFixed(2));
function selRendre(pos) {
  const lo = Math.max(0, Math.floor(pos) - 3), hi = Math.min(Sel.N - 1, Math.ceil(pos) + 3);
  Sel.vis.forEach(k => { if (k < lo || k > hi) { Sel.items[k].style.display = 'none'; Sel.vis.delete(k); } });
  for (let k = lo; k <= hi; k++) {
    const el = Sel.items[k], d = k - pos, ad = Math.abs(d);
    const y = Math.sign(d) * (ad < 1 ? ad * 128 : 128 + (ad - 1) * 62);
    const sc = ad < 1 ? 1 - .66 * ad : Math.max(.2, .34 - (ad - 1) * .09);
    const op = ad < 1 ? 1 - .62 * ad : Math.max(0, .38 - (ad - 1) * .18);
    if (!Sel.vis.has(k)) { el.style.display = 'block'; Sel.vis.add(k); }
    gsap.set(el, { y, scale: sc, opacity: op });
  }
}
function selMaj() {
  const idx = clamp(Math.round(Sel.pos), 0, Sel.N - 1);
  if (idx !== Sel.dernier) { if (Sel.dernier >= 0) { Son.tick(); vibrer(5); } Sel.dernier = idx; }
  selRendre(Sel.pos);
}
function selAller(idx, duree = .45) {
  idx = clamp(idx, 0, Sel.N - 1);
  Sel.p.v = Sel.pos;
  gsap.to(Sel.p, { v: idx, duration: RM ? .1 : duree, ease: EASE.sortie, overwrite: true, onUpdate() { Sel.pos = Sel.p.v; gsap.set('#sel-proxy', { y: -Sel.pos * Sel.PX }); Sel.drag.update(); selMaj(); } });
}
function ouvrirSelecteur(cfg) {
  if (Sel.ouvert) return;
  Sel.ouvert = true; Sel.cfg = cfg; Sel.champ = cfg.champ;
  const sel = $('#selecteur'), { min, max, pas } = cfg;
  Sel.N = Math.round((max - min) / pas) + 1;
  $('#sel-items').innerHTML = Array.from({ length: Sel.N }, (_, k) => `<div class="sel-i"><span class="vt num">${fmtVal(min + k * pas)}</span></div>`).join('');
  Sel.items = $$('.sel-i', sel); Sel.vis = new Set();
  $('#sel-titre').textContent = cfg.label; $('#sel-unite').textContent = cfg.unite;
  const idx = clamp(Math.round((cfg.val - min) / pas), 0, Sel.N - 1);
  Sel.pos = idx; Sel.dernier = idx;
  gsap.set('#sel-proxy', { y: -idx * Sel.PX });
  sel.style.display = 'flex';
  selRendre(idx);
  Sel.drag = Draggable.create('#sel-proxy', {
    type: 'y', trigger: '#sel-roue', inertia: true, minimumMovement: 2, edgeResistance: .85,
    bounds: { minY: -(Sel.N - 1) * Sel.PX, maxY: 0 },
    snap: { y: v => Math.round(v / Sel.PX) * Sel.PX },
    onDrag() { Sel.pos = -this.y / Sel.PX; selMaj(); },
    onThrowUpdate() { Sel.pos = -this.y / Sel.PX; selMaj(); },
    onThrowComplete() { Sel.pos = Math.round(-this.y / Sel.PX); selMaj(); },
  })[0];
  const centre = $('.vt', Sel.items[idx]), src = $('.champ-n', cfg.champ);
  if (RM) { gsap.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: .25 }); return; }
  gsap.fromTo(sel, { clipPath: clipDepuis(cfg.champ, 20) }, { clipPath: CLIP_PLEIN, duration: .85, ease: EASE.entree, clearProps: 'clipPath' });
  voler(src, centre, { duree: .85 });
  gsap.fromTo('.sel-filet', { scaleX: 0 }, { scaleX: 1, duration: 1, delay: .5, ease: EASE.sortie });
  gsap.fromTo('#sel-unite, .sel-pt, .sel-ind, .sel-haut', { opacity: 0 }, { opacity: 1, duration: .5, delay: .6, stagger: .05 });
  gsap.fromTo('.sel-bas > *', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .5, stagger: .06, ease: EASE.sortie, clearProps: 'transform,opacity' });
}
function fermerSelecteur(valide) {
  if (!Sel.ouvert || Sel.lock) return;
  Sel.lock = true;
  const sel = $('#selecteur'), cfg = Sel.cfg;
  const idx = clamp(Math.round(Sel.pos), 0, Sel.N - 1);
  const v = valide ? +(cfg.min + idx * cfg.pas).toFixed(2) : cfg.val;
  const n = $('.champ-n', cfg.champ);
  n.textContent = fmtVal(v);
  const centre = $('.vt', Sel.items[idx]);
  const fin = () => {
    sel.style.display = 'none'; gsap.set(sel, { clearProps: 'all' }); if (Sel.drag) Sel.drag.kill(); Sel.drag = null;
    n.style.visibility = ''; $$('.vt', sel).forEach(e => { e.style.visibility = ''; });
    Sel.ouvert = false; Sel.lock = false; if (valide && cfg.onValider) cfg.onValider(v);
  };
  Sel.drag.disable();
  if (RM) { gsap.to(sel, { opacity: 0, duration: .25, onComplete: fin }); return; }
  voler(centre, n, { duree: .7, delai: .05 });
  gsap.to('.sel-bas > *, .sel-haut, #sel-unite, .sel-pt, .sel-ind, .sel-filet', { opacity: 0, duration: .25 });
  gsap.fromTo(sel, { clipPath: CLIP_PLEIN }, { clipPath: () => clipDepuis(cfg.champ, 20), duration: .7, delay: .05, ease: EASE.entree, onComplete: fin });
}
$('#sel-ok').addEventListener('click', () => fermerSelecteur(true));
$('#sel-fermer').addEventListener('click', () => fermerSelecteur(false));
$('#sel-moins').addEventListener('click', () => selAller(Math.round(Sel.pos) - 1, .35));
$('#sel-plus').addEventListener('click', () => selAller(Math.round(Sel.pos) + 1, .35));
$('#sel-roue').addEventListener('wheel', e => { e.preventDefault(); if (Sel.lock) return; const t = performance.now(); if (t - (Sel.wt || 0) < 90) return; Sel.wt = t; selAller(Math.round(Sel.pos) + Math.sign(e.deltaY), .3); }, { passive: false });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (Sel.ouvert) fermerSelecteur(false); else if (SP.ouvert) fermerSerie(); else if (Menu.ouvert) fermerMenu(); }
  if (Sel.ouvert && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); selAller(Math.round(Sel.pos) + (e.key === 'ArrowUp' ? -1 : 1), .3); }
  if (Sel.ouvert && e.key === 'Enter') fermerSelecteur(true);
});

/* =============== Chrono plein écran (repos, travail, préparation, circuits) =============== */
const Chrono = { cfg: null, fin: 0, total: 1, raf: 0, run: false, derniere: null, done: false, ouvert: false, origine: null };
const C_CH = 2 * Math.PI * 150;
const fmtT = s => s >= 60 ? mmss(s) : String(s);
function chronoConfigurer(cfg) {
  const el = $('#chrono');
  Chrono.cfg = cfg; Chrono.done = false; Chrono.derniere = null;
  el.dataset.phase = cfg.phase; el.dataset.mode = cfg.mode;
  $('#ch-label').textContent = cfg.label; $('#ch-phase').innerHTML = cfg.phaseTxt;
  $('#ch-extra').innerHTML = cfg.extra || '';
  $('#ch-anneau').style.display = cfg.sansChrono ? 'none' : '';
  const acts = $('#ch-actions'); acts.innerHTML = ''; acts.classList.toggle('duo', cfg.actions.length === 2 && !cfg.actions.some(a => a.cls === 'geant'));
  cfg.actions.forEach(a => { const b = document.createElement('button'); b.className = 'btn-ch ' + (a.cls || ''); b.textContent = a.txt; b.addEventListener('click', a.fn); acts.appendChild(b); });
  const arc = $('#ch-arc'); arc.style.strokeDasharray = C_CH; arc.style.strokeDashoffset = 0;
  const t = $('#ch-temps'); t.dataset.val = '';
  gsap.fromTo([$('#ch-phase'), $('#ch-extra'), acts], { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .15, stagger: .06, ease: EASE.sortie, clearProps: 'transform,opacity' });
  cancelAnimationFrame(Chrono.raf);
  if (cfg.sansChrono) { Chrono.run = false; return; }
  Chrono.total = cfg.duree; Chrono.fin = Horloge.now() + cfg.duree * 1000; Chrono.run = true;
  Chrono.raf = requestAnimationFrame(chronoBoucle);
}
function chronoBoucle() {
  if (!Chrono.run) return;
  const cfg = Chrono.cfg, r = Math.max(0, (Chrono.fin - Horloge.now()) / 1000), sec = Math.ceil(r);
  const cyc = cfg.cycle;
  const rc = cyc ? r - cyc * Math.floor((r - 1e-6) / cyc) : r;
  $('#ch-arc').style.strokeDashoffset = C_CH * (1 - clamp(rc / (cyc || Chrono.total), 0, 1));
  if (sec !== Chrono.derniere) {
    const prev = Chrono.derniere; Chrono.derniere = sec;
    const eff = cyc ? ((sec - 1) % cyc) + 1 : sec;
    rouler($('#ch-temps'), fmtT(Math.max(eff, 0)), { sens: -1, duree: .6, stagger: 0 });
    if (prev !== null && eff <= 3 && sec > 0) { Son.bip(740, .1); vibrer(20); chronoPouls(); }
    if (cfg.onTick) cfg.onTick(sec, r);
  }
  if (r <= 0 && !Chrono.done) {
    Chrono.done = true; Chrono.run = false; Son.bip(1040, .6, .22); vibrer([60, 40, 60]); chronoPouls();
    if (cfg.onFin) cfg.onFin();
    return;
  }
  Chrono.raf = requestAnimationFrame(chronoBoucle);
}
function chronoPouls() { if (!RM) gsap.fromTo('#ch-temps', { scale: 1 }, { scale: 1.1, duration: .16, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: true }); }
function chronoOuvrir(cfg, origine) {
  const el = $('#chrono'); Chrono.ouvert = true; Chrono.origine = origine;
  el.style.display = 'flex';
  chronoConfigurer(cfg);
  if (RM) { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .25 }); return; }
  const c = cercleDepuis(origine, 0);
  gsap.fromTo(el, { clipPath: c.depart }, { clipPath: c.plein, duration: .8, ease: EASE.entree, clearProps: 'clipPath' });
}
function chronoFermer(versEl, cb) {
  const el = $('#chrono'); Chrono.run = false; cancelAnimationFrame(Chrono.raf);
  const fin = () => { el.style.display = 'none'; gsap.set(el, { clearProps: 'all' }); Chrono.ouvert = false; if (cb) cb(); };
  if (RM || !versEl) { gsap.to(el, { opacity: 0, duration: .25, onComplete: fin }); return; }
  const c = cercleDepuis(versEl, 0);
  gsap.to('#chrono > *', { opacity: 0, duration: .2 });
  gsap.fromTo(el, { clipPath: c.plein }, { clipPath: c.depart, duration: .7, ease: EASE.entree, onComplete: () => { gsap.set('#chrono > *', { clearProps: 'opacity' }); fin(); } });
}
Chrono.plus = s => { Chrono.fin += s * 1000; Chrono.total += s; Chrono.derniere = null; Son.tick(); };
Chrono.terminerTot = () => { if (!Chrono.run) return; Chrono.fin = Horloge.now(); };

/* Repos automatique après une série */
function repos(ei, origine) {
  const x = Seance.exos[ei], k = x.sets.findIndex(s => !s.fait), s = x.sets[k];
  const txt = x.type === 'temps' ? `${s.tps} s` : `${s.reps} × ${fr(s.kg)} kg`;
  chronoOuvrir(cfgRepos(x, k, txt, ei), origine);
}
function cfgRepos(x, k, txt, ei) {
  return {
    mode: 'repos', phase: 'repos', duree: x.repos, label: 'Repos · ' + x.nom, phaseTxt: 'Respire.',
    extra: `<p class="ch-emom-min">Prochaine série · ${k + 1} sur ${x.series}</p><p class="ch-emom-nom">${txt}</p>`,
    actions: [{ txt: '+15 s', cls: 'sec', fn: () => Chrono.plus(15) }, { txt: 'Passer', fn: () => finRepos(ei) }],
    onFin: () => { $('#ch-phase').textContent = 'C’est reparti.'; gsap.delayedCall(.9, () => { if (Chrono.ouvert && Chrono.cfg.mode === 'repos') finRepos(ei); }); },
  };
}
function finRepos(ei) {
  const x = Seance.exos[ei], k = x.sets.findIndex(s => !s.fait);
  const li = $(`.exo[data-i="${ei}"] .serie[data-s="${k}"]`);
  chronoFermer(li ? $('.sok', li) : null, () => { if (li && !RM) gsap.fromTo(li, { scale: 1.04 }, { scale: 1, duration: .8, ease: 'back.out(3)', clearProps: 'transform' }); });
}
/* Série au temps : chrono de travail, bip à la fin, puis repos automatique dans le même écran */
function lancerTravail(ei, si, origine) {
  const x = Seance.exos[ei], s = x.sets[si];
  const fin = () => {
    s.fait = true; majExo(ei, { tracerSi: si }); vibrer(30);
    const k = x.sets.findIndex(t => !t.fait);
    if (k < 0) { chronoFermer($(`.exo[data-i="${ei}"] .serie[data-s="${si}"] .sok`), () => autoSuivant(ei)); return; }
    gsap.delayedCall(.5, () => { if (Chrono.ouvert) chronoConfigurer(cfgRepos(x, k, `${x.sets[k].tps} s`, ei)); });
  };
  chronoOuvrir({
    mode: 'travail', phase: 'travail', duree: s.tps, label: `${x.nom} · série ${si + 1} / ${x.series}`, phaseTxt: 'Tiens bon.',
    extra: '', actions: [{ txt: 'Terminer', fn: Chrono.terminerTot }], onFin: fin,
  }, origine);
}

/* =============== Circuits =============== */
let circuitIdx = 0, circuitBtn = null;
function etape(n, t) { return `<li><b>0${n}</b><span>${t}</span></li>`; }
function ouvrirCircuit(ci, btn) {
  if (Nav.occupe) return;
  circuitIdx = ci; circuitBtn = btn;
  const x = Seance.exos[ci], e = $('#e-circuit'), s1 = $('#ci-s1'), s2 = $('#ci-s2');
  $('#ci-pos').textContent = `${x.bloc} · ${x.format}`;
  s1.innerHTML = `<p class="kicker">Circuit · ${x.minutes} minutes</p><h1 class="serif">${x.format}</h1><p class="grand-t">${x.explication}</p>
    <ol class="etapes">${etape(1, 'Préparation de 10 secondes, non comptée.')}${etape(2, `${x.minutes} minutes de chrono, tu enchaînes ${x.exos.length} exercices.`)}${etape(3, x.format === 'AMRAP' ? 'À la fin, tu notes tes tours (et les répétitions en plus).' : 'À chaque minute, un nouvel exercice t’est annoncé.')}</ol>
    <div class="cta"><button class="btn gros" id="ci-voir">Voir les exercices <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><use href="#i-fleche"/></svg></button></div>`;
  s2.innerHTML = `<p class="kicker">${x.format} · ${x.minutes} min</p><h2 class="serif">Les <em>exercices</em></h2>
    <div>${x.exos.map(c => `<div class="circ-ex"><span class="nb num">${c.nb}</span><span class="nm">${c.nm}<small>${c.det || ''}${c.det ? ' · ' : ''}<a class="lien-v" href="${youtube(c.video)}" target="_blank" rel="noopener">${ICONE_LIRE} vidéo</a></small></span></div>`).join('')}</div>
    <p class="st-note">${x.format === 'AMRAP' ? 'Un tour = les trois exercices, dans l’ordre.' : 'Minutes impaires : squats. Minutes paires : pompes.'}</p>
    <div class="cta"><button class="btn gros" id="ci-pret">Je suis prêt</button></div>`;
  gsap.set(s2, { xPercent: 100 }); gsap.set(s1, { xPercent: 0, opacity: 1, scale: 1 });
  Nav.occupe = true;
  e.style.zIndex = ++Nav.z; e.classList.add('visible');
  const c = cercleDepuis(btn, 0);
  const fin = () => { gsap.set(e, { clearProps: 'clipPath' }); Nav.occupe = false; };
  const voile = document.createElement('div'); voile.className = 'voile'; voile.style.background = 'var(--accent)'; e.appendChild(voile);
  if (RM) { gsap.fromTo(e, { opacity: 0 }, { opacity: 1, duration: .25, onComplete: () => { voile.remove(); fin(); } }); return; }
  gsap.set(e, { clipPath: c.depart });
  gsap.timeline({ onComplete: () => { voile.remove(); fin(); } })
    .to(e, { clipPath: c.plein, duration: .85, ease: EASE.entree })
    .to(voile, { opacity: 0, duration: .45 }, .4)
    .add(() => { lignes($('h1', s1), { duree: 1.2 }); revealer([$('.kicker', s1), $('.grand-t', s1), $('.etapes', s1), $('.cta', s1)], { y: 30, delai: .15, stagger: .1 }); }, .5);
}
$('#ci-s1').addEventListener('click', e => { if (e.target.closest('#ci-voir')) circuitEtape(2); });
$('#ci-s2').addEventListener('click', e => { if (e.target.closest('#ci-pret')) lancerCircuit(circuitIdx, e.target.closest('#ci-pret')); });
$('#ci-retour').addEventListener('click', () => {
  if (circuitEtapeCourante === 2) { circuitEtape(1); return; }
  const e = $('#e-circuit'), c = cercleDepuis(circuitBtn, 0);
  Nav.occupe = true;
  const fin = () => { e.classList.remove('visible'); gsap.set(e, { clearProps: 'all' }); Nav.occupe = false; };
  if (RM) { fin(); return; }
  gsap.fromTo(e, { clipPath: c.plein }, { clipPath: c.depart, duration: .75, ease: EASE.entree, onComplete: fin });
});
let circuitEtapeCourante = 1;
function circuitEtape(n) {
  circuitEtapeCourante = n;
  const s1 = $('#ci-s1'), s2 = $('#ci-s2');
  if (RM) { gsap.set(s2, { xPercent: n === 2 ? 0 : 100 }); return; }
  gsap.to(s1, { xPercent: n === 2 ? -26 : 0, opacity: n === 2 ? .3 : 1, scale: n === 2 ? .94 : 1, duration: .8, ease: EASE.entree });
  gsap.to(s2, { xPercent: n === 2 ? 0 : 100, duration: .8, ease: EASE.entree });
  if (n === 2) { revealer($$('.circ-ex, .st-note, .cta', s2), { y: 30, delai: .45, stagger: .08 }); lignes($('h2', s2), { delai: .4 }); rouler($('.circ-ex .nb', s2), $('.circ-ex .nb', s2).textContent, { delai: .5 }); }
  $('#ci-pos').textContent = n === 2 ? 'Exercices du circuit' : `${Seance.exos[circuitIdx].bloc} · ${Seance.exos[circuitIdx].format}`;
}
function lancerCircuit(ci, btn) {
  const x = Seance.exos[ci], premier = x.exos[0];
  chronoOuvrir({
    mode: 'prep', phase: 'prep', duree: 10, label: `${x.format} · ${x.minutes} min`, phaseTxt: 'Prépare-toi.',
    extra: `<p class="ch-emom-min">On commence par</p><p class="ch-emom-nom">${premier.nb} ${premier.nm}</p>`,
    actions: [{ txt: 'Passer la préparation', cls: 'petit', fn: Chrono.terminerTot }],
    onFin: () => circuitTravail(ci),
  }, btn);
  gsap.delayedCall(.9, () => { if (Chrono.ouvert) { const e = $('#e-circuit'); e.classList.remove('visible'); gsap.set(e, { clearProps: 'all' }); circuitEtapeCourante = 1; } });
}
function circuitTravail(ci) {
  const x = Seance.exos[ci];
  if (x.format === 'AMRAP') {
    chronoConfigurer({
      mode: 'amrap', phase: 'travail', duree: x.duree, label: `AMRAP · ${x.minutes} min`, phaseTxt: 'Go.',
      extra: '<div class="ch-tours num" id="ch-tours">0</div><div class="ch-tours-l">tours complets</div>',
      actions: [{ txt: '+1 tour', cls: 'geant', fn: () => plusUnTour(ci) }, { txt: 'Terminer maintenant', cls: 'petit', fn: Chrono.terminerTot }],
      onFin: () => circuitBilan(ci),
    });
    x.tours = 0; rouler($('#ch-tours'), 0, { delai: .3 });
  } else {
    const nomMin = m => { const c = x.exos[m % 2 ? 0 : 1]; return `${c.nb} ${c.nm}`; };
    let minute = 0;
    chronoConfigurer({
      mode: 'emom', phase: 'travail', duree: x.duree, cycle: 60, label: `EMOM · ${x.minutes} min`, phaseTxt: 'Go.',
      extra: `<p class="ch-emom-min">Minute <span id="em-m">1</span> sur ${x.minutes}</p><p class="ch-emom-nom" id="em-nom">${nomMin(1)}</p><p class="kicker" style="color:inherit;opacity:.7;margin-top:6px" id="em-next">ensuite : ${nomMin(2)}</p>`,
      actions: [{ txt: 'Terminer maintenant', cls: 'petit', fn: Chrono.terminerTot }],
      onTick: sec => {
        const m = Math.min(x.minutes, Math.floor((x.duree - sec) / 60) + 1);
        if (m === minute) return;
        minute = m;
        $('#em-m').textContent = m; $('#em-nom').textContent = nomMin(m); $('#em-next').textContent = m < x.minutes ? 'ensuite : ' + nomMin(m + 1) : 'dernière minute';
        if (m > 1) annoncerMinute(m, x.minutes, nomMin(m));
      },
      onFin: () => circuitBilan(ci),
    });
  }
}
function annoncerMinute(m, total, nom) {
  const b = $('#ch-bandeau'); $('b', b).textContent = 'Minute ' + m; $('span', b).textContent = `sur ${total} · ${nom}`;
  Son.bip(520, .2); vibrer(40);
  gsap.timeline().fromTo(b, { xPercent: -101 }, { xPercent: 0, duration: .4, ease: 'power3.out' }).to(b, { xPercent: 101, duration: .4, delay: .55, ease: 'power3.inOut' });
}
function plusUnTour(ci) {
  const x = Seance.exos[ci]; x.tours++;
  rouler($('#ch-tours'), x.tours, { duree: .8, stagger: .05 });
  Son.bip(990, .06, .1); vibrer(25);
}
function circuitBilan(ci) {
  const x = Seance.exos[ci], amrap = x.format === 'AMRAP';
  const bilan = amrap
    ? `<div class="bilan"><p class="kicker" style="color:inherit">Temps écoulé</p><h2 class="serif">Temps<em>.</em></h2><div class="ligne-b"><span class="num" id="b-tours">0</span><span>tours complets</span></div>
       <button class="champ" data-champ="plus" style="color:inherit"><span class="kicker" style="color:inherit">Répétitions en plus</span><span class="champ-v"><b class="vt champ-n num">${x.plus}</b><i class="champ-u">reps</i></span><span class="edit">Toucher</span></button></div>`
    : `<div class="bilan"><p class="kicker">Terminé</p><h2 class="serif">${x.minutes} minutes<em>.</em></h2><div class="ligne-b"><span class="num" id="b-tours">${x.minutes}</span><span>minutes validées</span></div></div>`;
  chronoConfigurer({ mode: 'fin', phase: 'fin', label: `${x.format} terminé`, phaseTxt: '', sansChrono: true, extra: bilan,
    actions: [{ txt: x.id === 'amrap' ? 'Terminer le circuit' : 'Terminer la séance', fn: () => finCircuit(ci) }] });
  if (amrap) rouler($('#b-tours'), x.tours, { delai: .4, duree: 1.4 });
  lignes($('.bilan h2'), { delai: .2 });
}
$('#ch-extra').addEventListener('click', e => {
  const c = e.target.closest('.champ[data-champ="plus"]'); if (!c) return;
  const x = Seance.exos[circuitIdx];
  ouvrirSelecteur({ label: 'Répétitions en plus', unite: 'reps', min: 0, max: 60, pas: 1, val: x.plus, champ: c, onValider: v => { x.plus = v; } });
});
function finCircuit(ci) {
  const x = Seance.exos[ci]; x.fait = true; majExo(ci);
  const btn = $(`.exo[data-i="${ci}"] [data-circuit]`);
  if (ci >= Seance.exos.length - 1) { chronoFermer(null, finirSeance); return; }
  chronoFermer(btn, () => allerA(ci + 1));
}

/* =============== Tiroir d'aperçu (feuilleté au doigt) =============== */
let dragTiroir = null;
function construireTiroir() {
  const l = $('#tiroir-liste');
  l.innerHTML = Seance.exos.map((x, i) => `<button class="tg" data-k="${i}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="nm">${x.nom}<span class="dt">${x.type === 'circuit' ? x.format + ' · ' + x.minutes + ' min' : detExo(x)}</span></span><span class="pr num"></span></button>`).join('');
  majTiroir();
}
function majTiroir() {
  $$('#tiroir-liste .tg').forEach((b, i) => {
    const x = Seance.exos[i], f = fractionExo(x);
    b.classList.toggle('ok', f === 1); b.classList.toggle('cur', i === Seance.i);
    $('.pr', b).textContent = x.type === 'circuit' ? (x.fait ? '✓' : '') : `${x.sets.filter(s => s.fait).length}/${x.sets.length}`;
  });
}
function ouvrirTiroir() {
  const t = $('#tiroir'); if (t.style.display === 'flex') return;
  majTiroir(); t.style.display = 'flex'; $('#scrim').style.pointerEvents = 'auto';
  gsap.to('#scrim', { opacity: 1, duration: .45 });
  gsap.fromTo(t, { xPercent: 100 }, { xPercent: 0, duration: RM ? .2 : .75, ease: 'expo.out' });
  if (!RM) gsap.from($$('#tiroir > p, #tiroir > h2, .tg', t), { x: 40, opacity: 0, duration: .8, delay: .1, stagger: .035, ease: EASE.sortie, clearProps: 'transform,opacity' });
  if (dragTiroir) dragTiroir.kill();
  dragTiroir = Draggable.create(t, {
    type: 'x', bounds: { minX: 0, maxX: 400 }, lockAxis: true, minimumMovement: 8, allowNativeTouchScrolling: true,
    onDragEnd() { if (this.x > 90 || this.getVelocity('x') > 500) fermerTiroir(); else gsap.to(t, { x: 0, duration: .5, ease: EASE.sortie }); },
  })[0];
}
function fermerTiroir(cb) {
  const t = $('#tiroir'); if (t.style.display !== 'flex') return;
  if (dragTiroir) { dragTiroir.kill(); dragTiroir = null; }
  gsap.to('#scrim', { opacity: 0, duration: .4 }); $('#scrim').style.pointerEvents = 'none';
  gsap.to(t, { xPercent: 100, x: 0, duration: RM ? .2 : .55, ease: 'expo.in', onComplete: () => { t.style.display = 'none'; gsap.set(t, { clearProps: 'all' }); t.style.display = 'none'; if (cb) cb(); } });
}
$('#languette').addEventListener('click', ouvrirTiroir);
$('#tiroir-liste').addEventListener('click', e => { const b = e.target.closest('.tg'); if (b) fermerTiroir(() => allerA(+b.dataset.k)); });

/* =============== Quitter =============== */
$('#s-quitter').addEventListener('click', () => { const m = $('#modale'); m.style.display = 'flex'; gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: .25 }); gsap.fromTo('.boite', { y: 120 }, { y: 0, duration: .6, ease: EASE.sortie }); });
$('#mo-reprendre').addEventListener('click', () => { gsap.to('#modale', { opacity: 0, duration: .2, onComplete: () => { $('#modale').style.display = 'none'; } }); });
$('#mo-quitter').addEventListener('click', () => { $('#modale').style.display = 'none'; quitterSeance(); });
function quitterSeance() {
  Chrono.run = false; killAuto(); Seance.actif = false;
  const e = $('#e-seance'), c = cercleDepuis($('#carte-hero'), 0);
  Nav.occupe = true;
  toutFermerSansAnim(); e.classList.add('visible');
  const fin = () => { e.classList.remove('visible'); gsap.set(e, { clearProps: 'all' }); Nav.occupe = false; rendreTitres(); };
  gsap.fromTo(e, { clipPath: c.plein }, { clipPath: c.depart, duration: RM ? .1 : .9, ease: EASE.entree, onComplete: fin });
}
$('#wk-demarrer').addEventListener('click', demarrerSeance);

/* =============== Fin : couverture de magazine =============== */
function rideau(milieu, fin) {
  const r = $('#rideau');
  if (RM) { milieu(); if (fin) fin(); return; }
  gsap.timeline()
    .fromTo(r, { yPercent: 101 }, { yPercent: 0, duration: .5, ease: 'power3.inOut' })
    .add(milieu)
    .to(r, { yPercent: -101, duration: .8, ease: 'power3.out' })
    .add(() => { gsap.set(r, { yPercent: 101 }); if (fin) fin(); });
}
function finirSeance() {
  Chrono.run = false; killAuto(); Seance.actif = false;
  const minutes = Math.max(1, Math.round((Horloge.now() - Seance.debut) / 60000));
  let volume = 0, series = 0;
  Seance.exos.forEach(x => { if (x.sets) x.sets.forEach(s => { if (s.fait) { series++; if (x.type === 'charge') volume += s.reps * s.kg; } }); });
  const tours = (Seance.exos.find(x => x.id === 'amrap') || {}).tours || 0;
  const reco = Seance.record;
  $('#f-record').innerHTML = reco ? `<em>Record&nbsp;·</em> ${reco.nom} à ${fr(reco.kg)}&nbsp;kg <em>(avant&nbsp;: ${reco.prev}&nbsp;kg).</em>` : '<em>Pas de record aujourd’hui.</em> La régularité, c’est ce qui construit tout le reste.';
  ['f-duree', 'f-volume', 'f-series', 'f-tours'].forEach(id => { const e = $('#' + id); e.dataset.val = ''; e.textContent = '0'; });
  rideau(() => {
    const e = $('#e-fin'); toutFermerSansAnim(); $('#chrono').style.display = 'none'; gsap.set('#chrono', { clearProps: 'all' });
    $('#e-seance').classList.remove('visible'); $('#e-circuit').classList.remove('visible');
    e.style.zIndex = ++Nav.z; e.classList.add('visible'); setChrome('e-fin');
    Nav.pile = [{ id: 'e-fin', mode: 'fin' }];
    gsap.set(['#f-titre', '.fin-trait', '.fin-stats > div', '#f-record', '.fin-bas', '.fin-haut'], { opacity: 0 });
    gsap.set('#tampon', { opacity: 0 });
  }, () => animFin({ minutes, volume, series, tours }));
}
function animFin({ minutes, volume, series, tours }) {
  const tl = gsap.timeline();
  tl.fromTo('.fin-fili', { xPercent: 40, opacity: 0 }, { xPercent: 0, opacity: .06, duration: 2, ease: EASE.sortie, clearProps: 'opacity,transform' }, 0)
    .fromTo('.fin-haut', { opacity: 0 }, { opacity: 1, duration: .6 }, 0)
    .set('#f-titre', { opacity: 1 }, .1)
    .add(() => lignes($('#f-titre'), { duree: 1.3, stagger: .16 }), .1)
    .set('.fin-trait', { opacity: 1 }, .9)
    .add(() => tracer($('#f-trait path'), { duree: 1.2 }), .9)
    .fromTo('.fin-stats > div', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .8, stagger: .12, ease: EASE.sortie, clearProps: 'transform' }, .9)
    .add(() => {
      rouler($('#f-duree'), minutes, { duree: 1.8, delai: 0 });
      rouler($('#f-volume'), milliers(volume), { duree: 2.1, delai: .12 });
      rouler($('#f-series'), series, { duree: 1.6, delai: .24 });
      rouler($('#f-tours'), tours, { duree: 1.6, delai: .36 });
    }, 1.0)
    .fromTo('#f-record', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .9, ease: EASE.sortie, clearProps: 'transform' }, 2.0)
    .fromTo('.fin-bas', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .9, ease: EASE.sortie, clearProps: 'transform' }, 2.2);
  if (RM) { tl.set('#tampon', { opacity: 1, rotate: -12 }, 1); return; }
  tl.fromTo('#tampon', { scale: 2.4, rotate: -34, opacity: 0 }, { scale: 1, rotate: -12, opacity: 1, duration: .38, ease: 'power4.in' }, 2.35)
    .add(() => { Son.bip(160, .18, .3); vibrer(40); }, 2.73)
    .fromTo('#cadre', { x: 0 }, { x: 0, duration: .01 }, 2.73)
    .fromTo('.fin-corps', { y: 0 }, { y: 5, duration: .06, yoyo: true, repeat: 3, ease: 'none', clearProps: 'transform' }, 2.73);
}
$('#f-valider').addEventListener('click', validerSeance);
function validerSeance() {
  if (Nav.occupe) return;
  Nav.occupe = true; S.w2Fait = true;
  construireCal(); majDash({ anim: true });
  const e = $('#e-fin'), c = cercleDepuis($('#sem-anneau'), 0);
  toutFermerSansAnimSauf('e-fin');
  const fin = () => { e.classList.remove('visible'); gsap.set(e, { clearProps: 'all' }); Nav.pile = []; Nav.occupe = false; rendreTitres(); setChrome('e-dash'); animerSemaineMiseAJour(); };
  setChrome('e-dash');
  if (RM) { gsap.to(e, { opacity: 0, duration: .3, onComplete: fin }); return; }
  gsap.fromTo(e, { clipPath: c.plein }, { clipPath: c.depart, duration: 1.05, ease: EASE.entree, onComplete: fin });
}
function toutFermerSansAnimSauf(id) {
  ['e-programme', 'e-coaching', 'e-workout', 'e-seance', 'e-circuit', 'e-quest', 'e-avenir'].forEach(i => $('#' + i).classList.remove('visible'));
  void id;
}
gsap.set('#rideau', { yPercent: 101 });
gsap.set('#ch-bandeau', { xPercent: -101 });
