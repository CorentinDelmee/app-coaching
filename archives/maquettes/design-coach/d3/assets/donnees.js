/* Données factices (inventées) — maquette d3 Studio */
window.ST_DATA = (function () {
  var MUSCLES = [
    { id: 'jambes', nom: 'Jambes' }, { id: 'dos', nom: 'Dos' }, { id: 'pecs', nom: 'Pectoraux' },
    { id: 'epaules', nom: 'Épaules' }, { id: 'bras', nom: 'Bras' }, { id: 'gainage', nom: 'Gainage' },
    { id: 'mobilite', nom: 'Mobilité' }, { id: 'cardio', nom: 'Cardio' }
  ];
  // [nom, muscle, secondaires, mouvement, catégorie]
  var BASES = [
    ['Squat', 'jambes', ['gainage'], 'squat', 'Renforcement'], ['Squat sumo', 'jambes', ['gainage'], 'squat', 'Renforcement'],
    ['Assis-debout chaise', 'jambes', [], 'squat', 'Seniors'], ['Fente avant', 'jambes', ['gainage'], 'fente', 'Renforcement'],
    ['Fente arrière', 'jambes', [], 'fente', 'Renforcement'], ['Montée de marche', 'jambes', ['cardio'], 'fente', 'Seniors'],
    ['Soulevé de terre jambes tendues', 'jambes', ['dos'], 'charniere', 'Renforcement'], ['Pont fessier', 'jambes', ['gainage'], 'gainage', 'Renforcement'],
    ['Good morning', 'dos', ['jambes'], 'charniere', 'Renforcement'], ['Rowing un bras', 'dos', ['bras'], 'tirage', 'Renforcement'],
    ['Tirage horizontal', 'dos', ['bras'], 'tirage', 'Renforcement'], ['Tirage vertical', 'dos', ['bras'], 'tirage', 'Renforcement'],
    ['Superman', 'dos', ['gainage'], 'gainage', 'Renforcement'], ['Face pull', 'epaules', ['dos'], 'tirage', 'Renforcement'],
    ['Pompe', 'pecs', ['bras', 'gainage'], 'pompe', 'Renforcement'], ['Pompe au mur', 'pecs', ['bras'], 'pompe', 'Seniors'],
    ['Développé couché', 'pecs', ['bras'], 'pousse', 'Renforcement'], ['Écarté', 'pecs', [], 'pousse', 'Renforcement'],
    ['Développé militaire', 'epaules', ['bras'], 'pousse', 'Renforcement'], ['Élévation latérale', 'epaules', [], 'pousse', 'Renforcement'],
    ['Curl biceps', 'bras', [], 'tirage', 'Renforcement'], ['Extension triceps', 'bras', [], 'pousse', 'Renforcement'],
    ['Dips sur chaise', 'bras', ['pecs'], 'pompe', 'Renforcement'], ['Planche', 'gainage', [], 'gainage', 'Gainage'],
    ['Planche latérale', 'gainage', [], 'gainage', 'Gainage'], ['Dead bug', 'gainage', [], 'gainage', 'Gainage'],
    ['Bird dog', 'gainage', ['dos'], 'gainage', 'Gainage'], ['Pallof press', 'gainage', [], 'pousse', 'Gainage'],
    ['Rotation thoracique', 'mobilite', ['dos'], 'charniere', 'Mobilité'], ['Ouverture de hanche', 'mobilite', ['jambes'], 'fente', 'Mobilité'],
    ['Chat-vache', 'mobilite', ['dos'], 'gainage', 'Mobilité'], ['Équilibre unipodal', 'mobilite', ['jambes'], 'fente', 'Seniors'],
    ['Marche talon-pointe', 'mobilite', [], 'fente', 'Seniors'], ['Jumping jack', 'cardio', ['jambes'], 'cardio', 'Cardio'],
    ['Montée de genoux', 'cardio', ['jambes'], 'cardio', 'Cardio'], ['Burpee', 'cardio', ['pecs', 'jambes'], 'cardio', 'Cardio'],
    ['Corde à sauter', 'cardio', [], 'cardio', 'Cardio'], ['Mountain climber', 'cardio', ['gainage'], 'pompe', 'Cardio'],
    ['Swing kettlebell', 'jambes', ['dos', 'cardio'], 'charniere', 'Renforcement'], ['Gobelet squat', 'jambes', [], 'squat', 'Renforcement']
  ];
  var VARIANTES = [['', 'Poids du corps'], [' haltères', 'Haltères'], [' élastique', 'Élastique'], [' kettlebell', 'Kettlebell'], [' lesté', 'Gilet lesté'], [' tempo lent', 'Poids du corps']];
  var MATERIELS = ['Poids du corps', 'Haltères', 'Élastique', 'Kettlebell', 'Gilet lesté', 'Chaise', 'Tapis'];
  var NIVEAUX = ['Débutant', 'Intermédiaire', 'Confirmé'];
  var ex = [], id = 1;
  for (var v = 0; v < VARIANTES.length; v++) {
    for (var b = 0; b < BASES.length; b++) {
      var B = BASES[b], V = VARIANTES[v];
      if (v > 0 && (B[4] === 'Mobilité' || B[4] === 'Cardio') && v !== 2) continue;
      var n = id * 7;
      ex.push({
        id: id, v: v, nom: B[0] + V[0], muscle: B[1], secondaires: B[2], mv: B[3], categorie: B[4],
        materiel: B[0].indexOf('chaise') > -1 || B[0].indexOf('Assis') === 0 ? 'Chaise' : V[1],
        niveau: NIVEAUX[(n + b) % 3],
        video: n % 27 === 0 ? 'propose' : (n % 5 === 0 ? 'aucune' : 'valide'),
        photo: false,
        duree: '0:' + String(20 + (n % 40)).padStart(2, '0'),
        tempo: ['3-1-1', '2-0-2', '3-0-1', '2-1-2'][n % 4], repos: [45, 60, 75, 90][n % 4],
        seances: (n * 3) % 23,
        consignes: 'Dos neutre, regard devant. Descendre en contrôlant sur 3 temps, remonter en expirant. Garder les genoux dans l\'axe des pieds.',
        erreurs: 'Genoux qui rentrent vers l\'intérieur ; talons qui décollent ; dos qui s\'arrondit en fin de mouvement.',
        facile: 'Amplitude réduite, appui sur une chaise', dur: 'Tempo lent 4 s, pause en bas',
        notes: ''
      });
      id++;
      if (ex.length >= 200) break;
    }
    if (ex.length >= 200) break;
  }
  ex[2].video = 'propose'; ex[3].video = 'propose';
  ex.sort(function (a, b) { return a.v - b.v || a.nom.localeCompare(b.nom, 'fr'); });

  var CLIENTS = [
    ['Hélène Marchal', 68, 'Remise en forme · 3/sem', 'jambes', 72, 'Séance 14 h'],
    ['Bernard Lefèvre', 74, 'Équilibre & chutes · 2/sem', 'mobilite', 45, 'Douleur genou signalée'],
    ['Sophie Garnier', 41, 'Renforcement · 2/sem', 'dos', 88, 'Check-in : forme 8/10'],
    ['Julien Perrot', 36, 'Préparation trail · 3/sem', 'cardio', 61, 'Programme se termine dimanche'],
    ['Monique Roux', 81, 'Mobilité douce · 1/sem', 'epaules', 30, 'Pas de séance depuis 12 jours'],
    ['Karim Benali', 52, 'Perte de poids · 2/sem', 'bras', 54, 'Réservation demain 9 h'],
    ['Claire Dumas', 47, 'Dos & posture · 2/sem', 'gainage', 77, 'Questionnaire rempli'],
    ['Pierre Vasseur', 63, 'Après prothèse hanche · 2/sem', 'pecs', 40, 'Bilan à prévoir']
  ].map(function (c, i) {
    var p = c[0].split(' ');
    return { id: i + 1, nom: c[0], age: c[1], suivi: c[2], m: c[3], prog: c[4], info: c[5], ini: p[0][0] + p[1][0] };
  });
  return { MUSCLES: MUSCLES, MATERIELS: MATERIELS, NIVEAUX: NIVEAUX, EXERCICES: ex, CLIENTS: CLIENTS };
})();
