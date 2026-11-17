/* Données de démo (mêmes que les maquettes V1, structure en blocs comme src/data/demo).
   Un workout = des blocs (A, B, C…) ; un bloc contient des exercices ou un circuit ; l'option est un circuit facultatif. */
window.REX = window.REX || {};
REX.DATA = {
  client: { prenom: 'Fabien', nom: 'Fabien Vincent' },
  date: 'Mardi 20 octobre',
  semaine: { faites: 1, total: 3 },
  coaching: { jour: 'mardi 27 octobre', heure: '18 h 30', lieu: 'à domicile', tarif: 35 },

  exos: {
    mob: { id: 'mob', type: 'temps', nom: 'Mobilité hanches', series: 2, dur: 45, repos: 20, video: 'mobilité hanches',
      note: 'Respirez profondément, amplitude progressive.', prec: null },
    gob: { id: 'gob', type: 'charge', nom: 'Goblet squat', series: 4, reps: 10, kg: 16, repos: 90, video: 'goblet squat',
      note: 'Descendez lentement, <b>3 secondes</b>. Gardez 2 répétitions en réserve.', prec: '10 × 14 kg' },
    fen: { id: 'fen', type: 'charge', nom: 'Fente bulgare', series: 3, reps: 8, kg: 10, repos: 75, parJambe: true, video: 'fente bulgare',
      note: 'Genou avant dans l’axe du pied. 8 par jambe.', prec: '8 × 8 kg' },
    hip: { id: 'hip', type: 'charge', nom: 'Hip thrust', series: 3, reps: 12, kg: 40, repos: 90, video: 'hip thrust',
      note: 'Pause d’une seconde en haut, bassin verrouillé.', prec: '12 × 35 kg' },
    gai: { id: 'gai', type: 'temps', nom: 'Gainage ventral', series: 3, dur: 40, repos: 30, video: 'gainage ventral',
      note: 'Ventre serré, respiration calme. Ne cambrez pas.', prec: '3 × 35 s' },
    amrap: { id: 'amrap', type: 'circuit', format: 'AMRAP', nom: 'AMRAP 8 min', minutes: 8,
      but: 'Faites le plus de tours possible en 8 minutes.',
      etapes: ['10 secondes de préparation, non comptées.', '8 minutes : enchaînez les 3 exercices dans l’ordre, sans pause imposée.', 'Touchez « +1 tour » à chaque tour terminé, puis notez les répétitions en plus.'],
      items: [{ q: 10, u: 'reps', n: 'Kettlebell swing', d: '16 kg · hanches qui claquent', video: 'kettlebell swing' },
              { q: 8, u: 'reps', n: 'Burpees', d: 'poids du corps · poitrine au sol', video: 'burpee' },
              { q: 12, u: 'reps', n: 'Mountain climbers', d: 'poids du corps · 6 par jambe', video: 'mountain climbers' }],
      note: 'Un tour = les 3 exercices, dans cet ordre. Visez 4 à 5 tours.' },
    emom: { id: 'emom', type: 'circuit', format: 'EMOM', option: true, nom: 'EMOM 6 min', minutes: 6,
      but: 'Au début de chaque minute, faites l’exercice demandé ; le reste de la minute, vous récupérez.',
      etapes: ['10 secondes de préparation, non comptées.', 'Minutes impaires : 12 air squats. Minutes paires : 10 pompes.', 'Le chrono annonce chaque nouvelle minute.'],
      items: [{ q: 12, u: 'reps', n: 'Air squats', d: 'minutes 1, 3, 5', video: 'air squat' },
              { q: 10, u: 'reps', n: 'Pompes', d: 'minutes 2, 4, 6 · sur les genoux si besoin', video: 'pompes' }],
      minute: function (m) { return m % 2 ? '12 air squats' : '10 pompes'; },
      note: 'Facultatif : une dernière dose, si vous avez encore de l’énergie.' }
  },

  /* Workout du jour : sections Bloc A / B / C + option */
  workouts: {
    w2: { id: 'w2', code: 'W2', etiq: 'Workout 2 · aujourd’hui', titre: 'Bas du corps<br>+ circuit', sous: '≈ 50 min · 5 exercices · 1 circuit + 1 option', etat: 'afaire',
      consigne: '« Descendez lentement sur le squat, 3 secondes. On garde 2 répétitions en réserve. »',
      blocs: [
        { lettre: 'É', nom: 'Échauffement', duree: '5 min', exos: ['mob'] },
        { lettre: 'A', nom: 'Bloc A', duree: '≈ 15 min', exos: ['gob', 'fen'] },
        { lettre: 'B', nom: 'Bloc B', duree: '≈ 12 min', exos: ['hip', 'gai'] },
        { lettre: 'C', nom: 'Bloc C', duree: '8 min', circuit: 'amrap' },
        { lettre: '+', nom: 'Option', duree: '6 min', circuit: 'emom', option: true }
      ] },
    /* Séance faite lundi : on affiche CE QUI A ÉTÉ RÉALISÉ (correction du bug « récap de la semaine ») */
    w1: { id: 'w1', code: 'W1', etiq: 'Workout 1 · fait lundi 19 octobre', titre: 'Haut du<br>corps', sous: 'Fait en 47 min · 13 séries · 3 120 kg soulevés', etat: 'fait',
      blocs: [
        { lettre: 'A', nom: 'Bloc A', exosFaits: [
          { nom: 'Développé couché', series: ['8 × 50', '8 × 50', '8 × 50', '7 × 50'], unite: 'kg', record: false },
          { nom: 'Rowing haltère un bras', series: ['10 × 20', '10 × 20', '10 × 22'], unite: 'kg', record: true }] },
        { lettre: 'B', nom: 'Bloc B', exosFaits: [
          { nom: 'Développé épaules', series: ['10 × 14', '10 × 14', '9 × 14'], unite: 'kg' },
          { nom: 'Tractions assistées', series: ['6', '6', '5'], unite: 'reps' }] }
      ] },
    /* Séance à venir : le template */
    w3: { id: 'w3', code: 'W3', etiq: 'Workout 3 · à placer cette semaine', titre: 'Corps<br>entier', sous: '≈ 40 min · 2 exercices · 1 circuit', etat: 'avenir',
      blocs: [
        { lettre: 'A', nom: 'Bloc A', exosTemplate: [{ nom: 'Soulevé de terre jambes tendues', presc: '3 × 10 · 40 kg' }, { nom: 'Pompes', presc: '3 × 12' }] },
        { lettre: 'B', nom: 'Bloc B', exosTemplate: [{ nom: 'Finisher AMRAP 8 min', presc: 'burpees, squat sauté, mountain climbers' }] }
      ] }
  },

  // Mois d'octobre 2026
  fait: [5, 7, 9, 12, 14, 16, 19],
  semaineCourante: [19, 20, 21, 22, 23, 24, 25],
  coachingJour: 27
};
/* Ordre des pages de la séance (une page entière par exercice ou par circuit) */
REX.DATA.etapes = (function () {
  var w = REX.DATA.workouts.w2, out = [];
  w.blocs.forEach(function (b) {
    if (b.circuit) { out.push({ id: b.circuit, bloc: b }); return; }
    b.exos.forEach(function (id, k) { out.push({ id: id, bloc: b, rang: k + 1, nb: b.exos.length }); });
  });
  return out;
})();
