/* M2 « Carnet » — outils partagés : horloge, son, chiffres qui roulent, vol de titre, révélations.
   Pensé pour être porté en Vue 3 : chaque fonction est autonome, les durées et courbes sont des constantes. */
'use strict';

gsap.registerPlugin(Flip, Draggable, InertiaPlugin, SplitText);

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---- Constantes de mouvement (une seule source) ---- */
const EASE = { sortie: 'expo.out', entree: 'expo.inOut', doux: 'power3.out', ressort: 'back.out(1.6)', appui: 'power2.out' };
const DUREE = { page: .95, retour: .8, vol: .95, rev: .9, cercle: .85, menu: .85, roule: 1.3, slide: .85 };
const CLIP_PLEIN = 'inset(0px 0px 0px 0px round 0px 0px 0px 0px)';

/* ---- Horloge virtuelle : tous les chronos lisent ceci (performance.now), jamais un compteur de setInterval ---- */
const Horloge = {
  v: 0, dernier: performance.now(), vitesse: 1,
  now() { const p = performance.now(); this.v += (p - this.dernier) * this.vitesse; this.dernier = p; return this.v; },
  x10(on) { this.now(); this.vitesse = on ? 10 : 1; document.querySelectorAll('[data-x10]').forEach(b => b.classList.toggle('on', on)); },
};

/* ---- Son (Web Audio) et vibration ---- */
const prefs = { son: true, vibration: true };
const Son = {
  ctx: null, journal: [],
  ouvrir() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* pas de son */ } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  bip(f = 880, d = .14, v = .16) {
    this.journal.push([f, d]);
    if (!this.ctx || !prefs.son) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .03);
  },
  tick() { this.bip(1900, .03, .04); },
};
document.addEventListener('pointerdown', () => Son.ouvrir(), { passive: true });
const vibrer = ms => { if (prefs.vibration && navigator.vibrate) navigator.vibrate(ms); };

/* ---- Formats ---- */
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fr = n => String(n).replace('.', ',');
const milliers = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ---- Roulette de chiffres : chaque chiffre est une colonne 0-9-0-9 qui défile (transform seul) ----
   sens +1 : le chiffre monte (compteur) ; sens -1 : il descend (compte à rebours). */
const COL = Array.from({ length: 20 }, (_, i) => '<i>' + (i % 10) + '</i>').join('');
function rouler(el, texte, { duree = DUREE.roule, delai = 0, sens = 1, stagger = .08 } = {}) {
  texte = String(texte);
  const prev = el.dataset.val || '';
  el.dataset.val = texte; el.setAttribute('aria-label', texte); el.classList.add('rl-wrap');
  gsap.killTweensOf(el.querySelectorAll('.rl-c'));
  if (RM) { el.textContent = texte; el.classList.remove('rl-wrap'); gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .25, delay: delai, clearProps: 'opacity' }); return; }
  el.textContent = '';
  const A = [...texte], P = [...prev];
  const tl = gsap.timeline({ delay: delai });
  A.forEach((c, i) => {
    if (!/\d/.test(c)) { const s = document.createElement('span'); s.className = 'rl-s'; s.textContent = c; s.setAttribute('aria-hidden', 'true'); el.appendChild(s); return; }
    const j = A.length - 1 - i, pc = P[P.length - 1 - j], d = +c;
    const cell = document.createElement('span'); cell.className = 'rl'; cell.setAttribute('aria-hidden', 'true');
    const col = document.createElement('span'); col.className = 'rl-c'; col.innerHTML = COL;
    cell.appendChild(col); el.appendChild(cell);
    let s, e;
    if (/\d/.test(pc || '')) {
      const p = +pc;
      if (sens > 0) { s = p; e = d >= p ? d : d + 10; } else { s = 10 + p; e = d <= p ? 10 + d : d; }
    } else if (sens > 0) { s = 0; e = 10 + d; } else { s = 19; e = d; }
    gsap.set(col, { yPercent: -s * 5 });
    if (s !== e) tl.to(col, { yPercent: -e * 5, duration: sens > 0 && !pc ? duree : Math.min(duree, .6 + Math.abs(e - s) * .06), ease: EASE.sortie }, i * stagger);
  });
  return tl;
}

/* ---- Vol de titre : un double du texte quitte l'élément source et se pose sur la destination (même police,
   mise à l'échelle uniforme, transform seul). C'est la signature du carnet : la typographie est partagée. ---- */
const appEl = () => $('#app');
function rectApp(el) {
  const a = appEl().getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height };
}
const volsActifs = new Set();
function voler(src, dst, { duree = DUREE.vol, ease = EASE.entree, delai = 0, montrerSrc = false, onFin } = {}) {
  if (!src || !dst) return null;
  const rs = rectApp(src), rd = rectApp(dst);
  if (RM || !rs.w || !rd.w) {
    dst.style.visibility = ''; if (montrerSrc) src.style.visibility = '';
    gsap.fromTo(dst, { opacity: 0 }, { opacity: 1, duration: .3, delay: delai, clearProps: 'opacity', onComplete: onFin });
    return null;
  }
  const cs = getComputedStyle(src), cd = getComputedStyle(dst);
  const big = parseFloat(cs.fontSize) >= parseFloat(cd.fontSize) ? cs : cd;
  const c = document.createElement('span'); c.className = 'vol-clone'; c.textContent = dst.textContent;
  Object.assign(c.style, {
    fontFamily: big.fontFamily, fontWeight: big.fontWeight, fontStyle: big.fontStyle, fontSize: big.fontSize,
    letterSpacing: big.letterSpacing, fontVariationSettings: big.fontVariationSettings, lineHeight: big.lineHeight, color: cs.color,
  });
  $('#vol').appendChild(c);
  const w0 = c.offsetWidth || 1;
  gsap.set(c, { x: rs.x, y: rs.y, scale: rs.w / w0 });
  src.style.visibility = 'hidden'; dst.style.visibility = 'hidden';
  const tw = gsap.to(c, {
    x: rd.x, y: rd.y, scale: rd.w / w0, color: cd.color, duration: duree, ease, delay: delai,
    onComplete() { dst.style.visibility = ''; if (montrerSrc) src.style.visibility = ''; c.remove(); volsActifs.delete(tw); if (onFin) onFin(); },
  });
  volsActifs.add(tw);
  return tw;
}
function rendreTitres() { $$('.vt').forEach(e => { e.style.visibility = ''; }); $$('.vol-clone').forEach(e => e.remove()); volsActifs.forEach(t => t.kill()); volsActifs.clear(); }

/* ---- Rectangle d'un élément → clip-path inset (patron « la carte devient la page ») ---- */
function clipDepuis(el, rayon = 26, ref = appEl()) {
  const a = ref.getBoundingClientRect(), r = el.getBoundingClientRect();
  return `inset(${r.top - a.top}px ${a.right - r.right}px ${a.bottom - r.bottom}px ${r.left - a.left}px round ${rayon}px ${rayon}px ${rayon}px ${rayon}px)`;
}
function cercleDepuis(el, rayon) {
  const a = appEl().getBoundingClientRect(), r = el.getBoundingClientRect();
  const x = r.left - a.left + r.width / 2, y = r.top - a.top + r.height / 2;
  const R = Math.hypot(Math.max(x, a.width - x), Math.max(y, a.height - y)) + 4;
  return { x, y, R, depart: `circle(${rayon ?? 0}px at ${x}px ${y}px)`, plein: `circle(${R}px at ${x}px ${y}px)` };
}

/* ---- Révélations ---- */
function revealer(items, { delai = 0, y = 36, stagger = .07, duree = DUREE.rev } = {}) {
  if (!items || (items.length === 0)) return null;
  if (RM) return gsap.fromTo(items, { opacity: 0 }, { opacity: 1, duration: .3, delay: delai, stagger: .02, clearProps: 'opacity' });
  return gsap.fromTo(items, { y, opacity: 0 }, { y: 0, opacity: 1, duration: duree, delay: delai, stagger, ease: EASE.sortie, clearProps: 'transform,opacity' });
}
/* Lignes masquées qui montent (SplitText) */
function lignes(el, { delai = 0, duree = 1.05, stagger = .1 } = {}) {
  if (!el) return null;
  if (RM) return gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .3, delay: delai, clearProps: 'opacity' });
  const s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'ligne' });
  return gsap.from(s.lines, { yPercent: 112, duration: duree, stagger, delay: delai, ease: EASE.sortie, onComplete: () => s.revert() });
}
/* Trait qui se dessine (stroke-dashoffset, pathLength = 1) */
function tracer(path, { duree = .8, delai = 0, ease = 'power2.inOut' } = {}) {
  if (!path) return null;
  if (RM) { gsap.set(path, { strokeDashoffset: 0 }); return null; }
  return gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: duree, delay: delai, ease });
}

function toast(txt) {
  const t = $('#toast'); t.textContent = txt;
  gsap.killTweensOf(t);
  gsap.fromTo(t, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .35, ease: EASE.sortie });
  gsap.to(t, { opacity: 0, y: 8, duration: .3, delay: 2, ease: 'power2.out' });
}

/* ---- Données d'exemple (identiques dans toutes les maquettes) ---- */
const SEQ = [
  { id: 'mob', type: 'temps', nom: 'Mobilité hanches', bloc: 'Échauffement', series: 2, tps: 45, repos: 20, video: 'mobilité hanches', cons: 'Va doucement, amplitude maximale sans douleur.', prev: null },
  { id: 'gob', type: 'charge', nom: 'Goblet squat', bloc: 'Bloc A', series: 4, reps: 10, kg: 16, repos: 90, video: 'goblet squat', cons: 'Descends lentement, 3 secondes. On garde 2 répétitions en réserve.', prev: '10 × 14 kg', prevKg: 14 },
  { id: 'fen', type: 'charge', nom: 'Fente bulgare', bloc: 'Bloc A', series: 3, reps: 8, kg: 10, repos: 75, video: 'fente bulgare', par: 'par jambe', cons: 'Buste droit, genou avant dans l’axe du pied.', prev: null },
  { id: 'hip', type: 'charge', nom: 'Hip thrust', bloc: 'Bloc B', series: 3, reps: 12, kg: 40, repos: 90, video: 'hip thrust', cons: 'Pause d’une seconde en haut, bassin verrouillé.', prev: null },
  { id: 'gai', type: 'temps', nom: 'Gainage ventral', bloc: 'Bloc B', series: 3, tps: 40, repos: 30, video: 'gainage ventral', cons: 'Du talon à la tête, une seule ligne.', prev: null },
  { id: 'amrap', type: 'circuit', format: 'AMRAP', nom: 'Circuit AMRAP', bloc: 'Circuit', duree: 480, minutes: 8,
    explication: 'Fais le plus de tours possible en 8 minutes. À chaque tour fini, tu touches « +1 tour ».',
    exos: [{ nb: 10, nm: 'kettlebell swings', det: '16 kg', video: 'kettlebell swing' }, { nb: 8, nm: 'burpees', det: '', video: 'burpee' }, { nb: 12, nm: 'mountain climbers', det: '', video: 'mountain climbers' }] },
  { id: 'emom', type: 'circuit', format: 'EMOM', nom: 'Option EMOM', bloc: 'Option', duree: 360, minutes: 6,
    explication: 'À chaque minute qui démarre, tu fais l’exercice demandé. Ce qui reste de la minute, tu le récupères.',
    exos: [{ nb: 12, nm: 'air squats', det: 'minutes impaires', video: 'air squat' }, { nb: 10, nm: 'pompes', det: 'minutes paires', video: 'pompes' }] },
];
const youtube = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
