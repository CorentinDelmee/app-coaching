/* M1 « Atelier » — données d'exemple, horloge, son, utilitaires.
   Namespace global : window.M1 (un développeur Vue le portera en composables). */
(function () {
  'use strict';
  const M1 = window.M1 = {};

  /* ---------- Données (identiques dans toutes les maquettes) ---------- */
  M1.client = { prenom: 'Fabien', nom: 'Vincent' };
  M1.aujourdhui = { jour: 'Mardi 20 octobre', court: 'mardi 20 octobre 2026' };
  M1.programme = { nom: 'Force & cardio', semaine: 3, total: 8, parSemaine: 3 };
  M1.coaching = { date: 'mardi 27 octobre', heure: '18 h 30', lieu: 'à domicile', prix: 35, ceMois: 3, rang: 4,
    mot: 'Belle semaine Fabien ! Mardi on attaque le travail de hanches, prévois une bouteille d\'eau.' };
  M1.consigne = 'Descends lentement sur le squat, 3 secondes. On garde 2 répétitions en réserve.';

  /* Étapes de la séance W2 (une étape = un « écran » de la séance). */
  M1.etapes = [
    { id: 'echauf', type: 'temps', nom: 'Mobilité hanches', bloc: 'Échauffement', series: 2, duree: 45, repos: 20, videoQ: 'mobilité hanches échauffement',
      note: 'Cercles amples, respire. Rien ne doit tirer fort.' },
    { id: 'goblet', type: 'force', nom: 'Goblet squat', bloc: 'Bloc A · 1 sur 2', series: 4, reps: 10, kg: 16, repos: 90, prec: '10 × 14 kg', videoQ: 'goblet squat',
      note: M1.consigne, rec: 14 },
    { id: 'fente', type: 'force', nom: 'Fente bulgare', bloc: 'Bloc A · 2 sur 2', series: 3, reps: 8, kg: 10, repos: 75, prec: '8 × 8 kg', par: 'par jambe', videoQ: 'fente bulgare',
      note: 'Buste droit, le genou avant suit la pointe du pied.', rec: 8 },
    { id: 'hip', type: 'force', nom: 'Hip thrust', bloc: 'Bloc B · 1 sur 2', series: 3, reps: 12, kg: 40, repos: 90, prec: '12 × 37,5 kg', videoQ: 'hip thrust',
      note: 'Pause d\'une seconde en haut, fessiers bien serrés.', rec: 37.5 },
    { id: 'gainage', type: 'temps', nom: 'Gainage ventral', bloc: 'Bloc B · 2 sur 2', series: 3, duree: 40, repos: 30, videoQ: 'gainage ventral',
      note: 'Bassin neutre, on ne creuse pas le dos.' },
    { id: 'amrap', type: 'circuit', mode: 'AMRAP', nom: 'Circuit AMRAP', bloc: 'Circuit', minutes: 8,
      explication: 'Faites le plus de tours possible en 8 minutes.',
      exos: [ { q: '10', n: 'Kettlebell swings', d: '16 kg' }, { q: '8', n: 'Burpees', d: '' }, { q: '12', n: 'Mountain climbers', d: '' } ] },
    { id: 'emom', type: 'circuit', mode: 'EMOM', nom: 'Finisher EMOM', bloc: 'Option · finisher', minutes: 6,
      explication: 'Chaque minute, vous faites le mouvement demandé puis vous récupérez le temps qu\'il reste.',
      minutes_exos: ['12 air squats', '10 pompes'],
      exos: [ { q: '12', n: 'Air squats', d: 'minutes impaires' }, { q: '10', n: 'Pompes', d: 'minutes paires' } ] }
  ];

  /* ---------- Horloge (accélérable pour la démo) ---------- */
  const H = M1.horloge = {
    vitesse: 1, _ref: performance.now(), _base: 0,
    now() { return this._base + (performance.now() - this._ref) * this.vitesse; },
    regler(v) { this._base = this.now(); this._ref = performance.now(); this.vitesse = v; }
  };

  /* ---------- Son (Web Audio) + vibration ---------- */
  let ctx = null;
  M1.deverrouillerSon = function () {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* pas de son : tant pis */ }
  };
  M1.bip = function (freq, duree, vol) {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine'; o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (duree || 0.18));
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + (duree || 0.18) + 0.05);
    } catch (e) { /* ignore */ }
  };
  M1.vibre = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

  /* ---------- Utilitaires ---------- */
  M1.$ = (s, r) => (r || document).querySelector(s);
  M1.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  M1.fmt = function (n) { return String(n).replace('.', ','); };
  M1.mmss = function (s) {
    s = Math.max(0, Math.ceil(s - 1e-6)); const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  };
  M1.milliers = function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  M1.ICONES = {
    retour: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    fermer: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    coche: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    fleche: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    gauche: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    lecture: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',
    coupe: '<svg viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8"/></svg>'
  };
})();
