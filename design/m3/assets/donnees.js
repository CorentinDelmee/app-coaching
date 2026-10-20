/* Données d'exemple (identiques dans toutes les maquettes). */
window.M3 = window.M3 || {};
M3.D = (function () {
  var yt = function (q) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); };
  var exos = [
    { id: 'mob', bloc: 'Échauffement', nom: 'Mobilité hanches', type: 'temps', series: 2, duree: 45, repos: 15, video: yt('mobilité hanches échauffement'), conseil: 'Cercles lents, amplitude maximale, respire.' },
    { id: 'gob', bloc: 'Bloc A', nom: 'Goblet squat', type: 'reps', series: 4, reps: 10, kg: 16, repos: 90, prec: { reps: 10, kg: 14 }, video: yt('goblet squat'), conseil: 'Descends lentement, 3 secondes. On garde 2 répétitions en réserve.' },
    { id: 'bul', bloc: 'Bloc A', nom: 'Fente bulgare', type: 'reps', series: 3, reps: 8, kg: 10, repos: 75, parJambe: true, video: yt('fente bulgare'), conseil: 'Buste droit, genou avant dans l\'axe du pied.' },
    { id: 'hip', bloc: 'Bloc B', nom: 'Hip thrust', type: 'reps', series: 3, reps: 12, kg: 40, repos: 90, video: yt('hip thrust'), conseil: 'Bassin haut, pause d\'une seconde en contraction.' },
    { id: 'gai', bloc: 'Bloc B', nom: 'Gainage ventral', type: 'temps', series: 3, duree: 40, repos: 30, video: yt('gainage ventral'), conseil: 'Dos plat, fessiers serrés, respire calmement.' }
  ];
  var amrap = { id: 'amrap', kind: 'AMRAP', titre: 'AMRAP', minutes: 8, duree: 480,
    expl: 'Faites le plus de tours possible en 8 minutes.',
    detail: 'Enchaîne les 3 exercices sans t\'arrêter. Chaque tour terminé = un appui sur « +1 tour ». À la fin, tu notes les répétitions du tour en cours.',
    exos: [
      { nom: '10 kettlebell swings', note: '16 kg', video: yt('kettlebell swing') },
      { nom: '8 burpees', note: 'poitrine au sol', video: yt('burpee') },
      { nom: '12 mountain climbers', note: 'rythme soutenu', video: yt('mountain climbers') }
    ] };
  var emom = { id: 'emom', kind: 'EMOM', titre: 'EMOM', minutes: 6, duree: 360,
    expl: 'Chaque minute, tu fais l\'exercice demandé puis tu te reposes jusqu\'à la minute suivante.',
    detail: 'Minutes impaires : 12 air squats. Minutes paires : 10 pompes. Plus tu es rapide, plus tu récupères.',
    exos: [
      { nom: '12 air squats', note: 'minutes impaires', video: yt('air squat') },
      { nom: '10 pompes', note: 'minutes paires', video: yt('pompes') }
    ] };
  return {
    client: 'Fabien',
    coach: { consigne: 'Descends lentement sur le squat, 3 secondes. On garde 2 répétitions en réserve.',
             mot: 'Belle semaine Fabien ! Mardi on attaque le travail de hanches, prévois une bouteille d\'eau.' },
    exos: exos, amrap: amrap, emom: emom,
    questions: [
      { id: 'sommeil', type: 'curseur', titre: 'Comment as-tu dormi ?', aide: '0 = nuit blanche · 10 = nuit parfaite', defaut: 7 },
      { id: 'energie', type: 'curseur', titre: 'Ton niveau d\'énergie ?', aide: '0 = à plat · 10 = pile', defaut: 6 },
      { id: 'humeur', type: 'emojis', titre: 'Ton humeur du jour ?', choix: [['😣', 'Au plus bas'], ['😕', 'Bof'], ['😐', 'Neutre'], ['🙂', 'Plutôt bien'], ['😄', 'Au top']] },
      { id: 'douleur', type: 'choix', titre: 'Une douleur ?', choix: [['Aucune', 'RAS'], ['Légère', 'ça passe'], ['Gênante', 'je surveille'], ['Forte', 'à signaler']] },
      { id: 'eau', type: 'choix', titre: 'Hydratation d\'hier ?', choix: [['Moins de 1 L', ''], ['1 à 2 L', ''], ['Plus de 2 L', '']] }
    ]
  };
})();
