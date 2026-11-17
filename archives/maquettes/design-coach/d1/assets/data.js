/* Données factices (inventées) — maquette d1 « Atelier ». Aucun vrai client. */
window.AT_DATA = (() => {
  const E = (id, nom, cat, pose, prim, sec, mat, niv, video, dur, usage, extra = {}) => ({
    id, nom, cat, pose, prim, sec, mat, niv, video, dur, usage,
    tempo: extra.tempo || '3-1-1-0', repos: extra.repos || '90 s',
    consignes: extra.consignes || 'Pieds largeur de hanches, dos neutre.\nDescendre en contrôlant, remonter en poussant dans le sol.\nExpirer à l\'effort.',
    erreurs: extra.erreurs || 'Genoux qui rentrent vers l\'intérieur\nTalons qui décollent',
    facile: extra.facile || '', dur_var: extra.dur_var || '',
    notes: extra.notes || '', photo: null, maj: extra.maj || 'il y a 3 j',
    par: extra.par || 'Corentin'
  });
  // Vidéos YouTube réelles reprises de serveur/donnees/bibliotheque-videos.json (vérifiées par oEmbed le 2026-10-26)
  const VIDEOS = {"1":["mKREc_xl_j8","Your House Fitness"],"2":["Zz8DrsAUIZo","NATURAZONE"],"4":["8A7YKYByzwE","Drey.coaching"],"5":["pf2rQT3LvIQ","Your House Fitness"],"6":["qRUioGwKRCY","MUST COACH"],"8":["dOukQ7QBSQs","BeComplete"],"11":["CE9KiCPFw0E","Olymp'Fit"],"13":["RkcZ1BzYl_M","Jack Vanbergen"],"14":["sSOz4NMosWA","Your House Fitness"],"15":["bxn9FBrt4-A","NASM"]};
  const exercices = [
    E(1, 'Squat gobelet', 'Force', 'squat', ['Quadriceps', 'Fessiers'], ['Gainage'], ['Haltère', 'Kettlebell'], 'Débutant', 'validee', '0:42', 14,
      { facile: 'Squat sur chaise (assis-debout)', dur_var: 'Squat gobelet tempo 4-2-1', notes: 'Mireille : limiter l\'amplitude (genou droit).' }),
    E(2, 'Fente arrière', 'Force', 'lunge', ['Quadriceps', 'Fessiers'], ['Ischios'], ['Poids du corps'], 'Intermédiaire', 'proposee', '0:58', 6,
      { facile: 'Fente arrière avec appui au mur', dur_var: 'Fente arrière déficit', par: 'Claude', maj: 'il y a 2 h' }),
    E(3, 'Pompes inclinées', 'Force', 'push', ['Pectoraux', 'Triceps'], ['Épaules'], ['Banc'], 'Débutant', 'validee', '0:35', 11,
      { consignes: 'Mains sous les épaules, corps gainé.\nPoitrine vers le banc, coudes à 45°.', erreurs: 'Bassin qui s\'affaisse\nCoudes trop ouverts', facile: 'Pompes au mur', dur_var: 'Pompes au sol' }),
    E(4, 'Rowing élastique', 'Force', 'pull', ['Dorsaux', 'Rhomboïdes'], ['Biceps'], ['Élastique'], 'Débutant', 'validee', '0:47', 9),
    E(5, 'Soulevé de terre roumain', 'Force', 'hinge', ['Ischios', 'Fessiers'], ['Lombaires'], ['Haltère'], 'Intermédiaire', 'proposee', '1:04', 5,
      { par: 'Claude', maj: 'il y a 2 h', consignes: 'Genoux légèrement fléchis.\nPousser les hanches vers l\'arrière, dos plat.', erreurs: 'Dos rond\nBarre loin des jambes' }),
    E(6, 'Planche ventrale', 'Gainage', 'plank', ['Abdominaux'], ['Épaules', 'Fessiers'], ['Tapis'], 'Débutant', 'validee', '0:30', 17, { tempo: 'Tenue 30 s', repos: '45 s' }),
    E(7, 'Pont fessier', 'Mobilité', 'bridge', ['Fessiers'], ['Ischios'], ['Tapis'], 'Débutant', 'aucune', '', 12, { tempo: '2-2-1-0', repos: '60 s' }),
    E(8, 'Tirage poitrine élastique', 'Force', 'pull', ['Dorsaux'], ['Biceps'], ['Élastique'], 'Débutant', 'proposee', '0:51', 3, { par: 'Claude', maj: 'hier' }),
    E(9, 'Marche rapide avec montées de genoux', 'Cardio', 'march', ['Cardio'], ['Hanches'], ['Poids du corps'], 'Débutant', 'validee', '0:40', 8, { tempo: '30 s', repos: '30 s' }),
    E(10, 'Équilibre unipodal', 'Équilibre', 'balance', ['Chevilles'], ['Gainage'], ['Poids du corps'], 'Débutant', 'validee', '0:28', 15, { tempo: 'Tenue 20 s', repos: '30 s', notes: 'Toujours près d\'un appui pour les seniors.' }),
    E(11, 'Développé épaules assis', 'Force', 'press', ['Épaules'], ['Triceps'], ['Haltère', 'Chaise'], 'Débutant', 'validee', '0:44', 7),
    E(12, 'Rotation thoracique', 'Mobilité', 'rotate', ['Dos'], ['Épaules'], ['Tapis'], 'Débutant', 'aucune', '', 10, { tempo: 'Lent', repos: '—' }),
    E(13, 'Kettlebell swing', 'Cardio', 'hinge', ['Fessiers', 'Ischios'], ['Cardio'], ['Kettlebell'], 'Avancé', 'validee', '0:55', 4),
    E(14, 'Step-up sur marche', 'Force', 'step', ['Quadriceps', 'Fessiers'], ['Équilibre'], ['Marche'], 'Débutant', 'validee', '0:39', 9),
    E(15, 'Dead bug', 'Gainage', 'deadbug', ['Abdominaux'], ['Coordination'], ['Tapis'], 'Intermédiaire', 'proposee', '0:33', 2, { par: 'Claude', maj: 'hier' }),
    E(16, 'Farmer walk', 'Force', 'march', ['Avant-bras', 'Trapèzes'], ['Gainage'], ['Kettlebell'], 'Intermédiaire', 'validee', '0:36', 6),
    E(17, 'Assis-debout chaise', 'Force', 'squat', ['Quadriceps'], ['Fessiers'], ['Chaise'], 'Débutant', 'validee', '0:31', 13),
    E(18, 'Étirement ischios', 'Mobilité', 'hinge', ['Ischios'], [], ['Tapis'], 'Débutant', 'aucune', '', 11, { tempo: 'Tenue 30 s', repos: '—' })
  ];

  exercices.forEach((e) => { const v = VIDEOS[e.id]; if (v) { e.yt = v[0]; e.chaine = v[1]; } });

  const clients = [
    { id: 1, nom: 'Mireille L.', age: 71, h: 28, objectif: 'Équilibre et autonomie', prog: 'Reprise en douceur', sem: 3, assid: 96, statut: 'actif', dernier: 'Check-in ce matin', alerte: '', poids: [72.4, 72.1, 71.8, 71.9, 71.2, 70.9, 70.6], forme: [6, 6, 7, 7, 8, 7, 8] },
    { id: 2, nom: 'Thomas R.', age: 42, h: 210, objectif: 'Perte de poids', prog: 'Recomposition 12 sem.', sem: 7, assid: 81, statut: 'actif', dernier: 'Séance hier', alerte: 'Douleur au genou signalée', poids: [94.0, 93.1, 92.6, 91.8, 91.9, 90.7, 90.2], forme: [5, 6, 6, 5, 4, 6, 6] },
    { id: 3, nom: 'Claire D.', age: 35, h: 330, objectif: 'Préparer un 10 km', prog: 'Course & renfo', sem: 2, assid: 100, statut: 'actif', dernier: 'Check-in hier', alerte: '', poids: [61.2, 61.0, 61.1, 60.8, 60.9, 60.6, 60.5], forme: [7, 8, 8, 8, 9, 8, 9] },
    { id: 4, nom: 'Bernard M.', age: 78, h: 150, objectif: 'Mobilité après opération', prog: 'Mobilité hanche', sem: 5, assid: 74, statut: 'attention', dernier: 'Aucun check-in depuis 9 j', alerte: 'Inactif depuis 9 jours', poids: [81, 81.2, 81.1, 81.4, 81.3, 81.6, 81.5], forme: [5, 5, 4, 5, 4, 4, 4] },
    { id: 5, nom: 'Sophie G.', age: 48, h: 12, objectif: 'Renforcement dos', prog: 'Dos solide', sem: 4, assid: 88, statut: 'actif', dernier: 'Séance lundi', alerte: '', poids: [66, 65.8, 65.9, 65.5, 65.4, 65.2, 65.1], forme: [6, 7, 7, 7, 8, 8, 8] },
    { id: 6, nom: 'Jean-Paul V.', age: 67, h: 190, objectif: 'Garder la forme', prog: 'Entretien senior', sem: 10, assid: 92, statut: 'actif', dernier: 'Check-in hier', alerte: '', poids: [77, 76.8, 77.1, 76.6, 76.9, 76.4, 76.5], forme: [7, 7, 7, 8, 7, 8, 8] },
    { id: 7, nom: 'Nadia B.', age: 29, h: 300, objectif: 'Prise de force', prog: 'Force 3×/sem.', sem: 1, assid: 100, statut: 'nouveau', dernier: 'Questionnaire reçu', alerte: 'Questionnaire à lire', poids: [58, 58.2, 58.1, 58.4, 58.3, 58.6, 58.8], forme: [8, 8, 7, 8, 9, 8, 9] },
    { id: 8, nom: 'Henri P.', age: 83, h: 60, objectif: 'Prévenir les chutes', prog: 'Équilibre plus', sem: 6, assid: 90, statut: 'actif', dernier: 'Séance hier', alerte: '', poids: [70, 70.1, 69.8, 69.9, 69.7, 69.8, 69.6], forme: [6, 6, 6, 7, 7, 7, 7] }
  ];

  const seancesJour = [
    { h: '09:00', fin: '10:00', client: 'Henri P.', lieu: 'Domicile · Rambouillet', titre: 'Équilibre plus — S6', etat: 'fait' },
    { h: '11:30', fin: '12:30', client: 'Mireille L.', lieu: 'Domicile · Rambouillet', titre: 'Force bas du corps — S3', etat: 'prochaine' },
    { h: '14:00', fin: '15:00', client: 'Thomas R.', lieu: 'Parc du château', titre: 'Recomposition — S7 J2', etat: 'avenir' },
    { h: '18:30', fin: '19:30', client: 'Claire D.', lieu: 'Visio', titre: 'Course & renfo — S2', etat: 'avenir' }
  ];

  const programme = {
    semaines: 8, active: 3,
    jours: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    seances: { 0: 'Force bas du corps', 2: 'Équilibre & mobilité', 4: 'Force haut du corps' },
    blocs: [
      { id: 'b1', type: 'exercice', items: [{ ex: 9, s: '1', r: '5 min', note: 'Échauffement' }] },
      { id: 'b2', type: 'superset', items: [{ ex: 17, s: '3', r: '10' }, { ex: 4, s: '3', r: '12' }] },
      { id: 'b3', type: 'exercice', items: [{ ex: 1, s: '3', r: '10', note: 'RPE 7' }] },
      { id: 'b4', type: 'circuit', tours: 2, items: [{ ex: 10, s: '', r: '20 s' }, { ex: 7, s: '', r: '12' }, { ex: 6, s: '', r: '30 s' }] },
      { id: 'b5', type: 'exercice', items: [{ ex: 12, s: '1', r: '8 / côté', note: 'Retour au calme' }] }
    ]
  };

  return { exercices, clients, seancesJour, programme };
})();
