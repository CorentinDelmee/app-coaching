/* Données d'exemple (identiques dans toutes les maquettes) */
window.REX = window.REX || {};
REX.DATA = {
  client: 'Fabien',
  coaching: { jour: 'mardi 27 octobre', heure: '18 h 30', lieu: 'à domicile', tarif: 35 },
  // Séance W2 : « Bas du corps + circuit » (environ 50 min)
  exos: [
    { id: 'mob', type: 'temps', nom: 'Mobilité hanches', bloc: 'Échauffement', series: 2, dur: 45, repos: 20,
      note: 'Respire profondément, amplitude progressive.', prec: null },
    { id: 'gob', type: 'charge', nom: 'Goblet squat', bloc: 'Bloc A · 1/2', series: 4, reps: 10, kg: 16, repos: 90,
      note: 'Descends lentement, <b>3 secondes</b>. On garde 2 répétitions en réserve.', prec: 'Dernière fois : 10 × 14 kg' },
    { id: 'fen', type: 'charge', nom: 'Fente bulgare', bloc: 'Bloc A · 2/2', series: 3, reps: 8, kg: 10, repos: 75, parJambe: true,
      note: 'Genou avant dans l’axe du pied. 8 par jambe.', prec: 'Dernière fois : 8 × 8 kg' },
    { id: 'hip', type: 'charge', nom: 'Hip thrust', bloc: 'Bloc B · 1/2', series: 3, reps: 12, kg: 40, repos: 90,
      note: 'Pause d’une seconde en haut, bassin verrouillé.', prec: 'Dernière fois : 12 × 35 kg' },
    { id: 'gai', type: 'temps', nom: 'Gainage ventral', bloc: 'Bloc B · 2/2', series: 3, dur: 40, repos: 30,
      note: 'Ventre serré, respiration calme. Ne cambre pas.', prec: 'Dernière fois : 3 × 35 s' },
    { id: 'amrap', type: 'circuit', format: 'AMRAP', nom: 'AMRAP 8 min', bloc: 'Circuit', minutes: 8,
      texte: 'Fais le plus de tours possible en 8 minutes.',
      points: ['Un tour = les trois exercices à la suite.', 'Touche « +1 tour » à chaque tour terminé.', '10 secondes de préparation avant le départ.'],
      items: [{ q: '10', n: 'Kettlebell swings', s: '16 kg' }, { q: '8', n: 'Burpees', s: 'poids du corps' }, { q: '12', n: 'Mountain climbers', s: 'poids du corps' }] },
    { id: 'emom', type: 'circuit', format: 'EMOM', nom: 'EMOM 6 min', bloc: 'Finisher', minutes: 6,
      texte: 'Chaque minute, tu fais ton exercice puis tu récupères jusqu’à la minute suivante.',
      points: ['Minutes impaires : 12 air squats.', 'Minutes paires : 10 pompes.', '10 secondes de préparation avant le départ.'],
      items: [{ q: '12', n: 'Air squats', s: 'minutes 1, 3, 5' }, { q: '10', n: 'Pompes', s: 'minutes 2, 4, 6' }],
      minuteExo: function (m) { return m % 2 ? '12 air squats' : '10 pompes'; },
      minuteSuite: function (m) { return m % 2 ? '10 pompes' : '12 air squats'; } }
  ],
  // Mois d'octobre 2026
  fait: [5, 7, 9, 12, 14, 16, 19],
  semaineCourante: [19, 20, 21, 22, 23, 24, 25],
  coachingJour: 27
};
