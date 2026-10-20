/* donnees.js — données d'exemple (identiques dans toutes les maquettes) + état de la démo */
(function () {
  const M4 = window.M4;
  const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

  M4.data = {
    client: 'Fabien',
    seance: [
      { id: 'mob', nom: 'Mobilité hanches', bloc: 'Échauffement', type: 'temps', series: 2, duree: 45, repos: 20, prec: '45 s', conseil: 'Cercles lents, amplitude maximale. Respire par le nez.', video: yt('mobilité hanches échauffement') },
      { id: 'squat', nom: 'Goblet squat', bloc: 'Bloc A', type: 'charge', series: 4, reps: 10, kg: 16, repos: 90, prec: '10 × 14 kg', consigne: 'Descends lentement sur le squat, 3 secondes. On garde 2 répétitions en réserve.', video: yt('goblet squat technique') },
      { id: 'bulg', nom: 'Fente bulgare', bloc: 'Bloc A', type: 'charge', series: 3, reps: 8, kg: 10, repos: 75, par: ' par jambe', prec: '8 × 8 kg', video: yt('fente bulgare technique') },
      { id: 'hip', nom: 'Hip thrust', bloc: 'Bloc B', type: 'charge', series: 3, reps: 12, kg: 40, repos: 90, prec: '12 × 37,5 kg', video: yt('hip thrust technique') },
      { id: 'gain', nom: 'Gainage ventral', bloc: 'Bloc B', type: 'temps', series: 3, duree: 40, repos: 30, prec: '35 s', conseil: 'Bassin aligné, serre les fessiers, ne retiens pas ton souffle.', video: yt('gainage ventral technique') },
      { id: 'amrap', nom: 'Circuit AMRAP', bloc: 'Circuit', type: 'circuit', format: 'AMRAP', duree: 480,
        exos: [
          { nb: 10, nom: 'Kettlebell swings', det: '16 kg', video: yt('kettlebell swing technique') },
          { nb: 8, nom: 'Burpees', det: 'poitrine au sol', video: yt('burpee technique') },
          { nb: 12, nom: 'Mountain climbers', det: 'rythme soutenu', video: yt('mountain climbers technique') }
        ] }
    ],
    jours: [
      { l: 'L', d: 19, etat: 'fait', w: 'W1' }, { l: 'M', d: 20, etat: 'auj', w: 'W2' }, { l: 'M', d: 21 }, { l: 'J', d: 22 },
      { l: 'V', d: 23 }, { l: 'S', d: 24 }, { l: 'D', d: 25 }
    ],
    moisFaits: [5, 7, 9, 12, 14, 16, 19],
    moisPrevus: [26, 28, 30]
  };

  /* État vivant de la démo (remis à zéro par « Rejouer ») */
  M4.etat = { seanceFaite: false, questFait: false, w3Jour: null, semaine: 1 };
  M4.icones = {
    check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>'
  };
})();
