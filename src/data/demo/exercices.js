// 80 exercices courants, en français, sans vidéo (Corentin complète les liens dans la bibliothèque).
// [nom, catégories, description]
const LISTE = [
  // Jambes
  ['Squat', ['jambes'], 'Pieds largeur d\'épaules, descendre les hanches en arrière et en bas, dos droit, puis remonter en poussant dans les talons.'],
  ['Squat gobelet', ['jambes'], 'Squat en tenant une charge contre la poitrine, coudes serrés, buste droit.'],
  ['Squat bulgare', ['jambes'], 'Pied arrière surélevé, descendre à la verticale sur la jambe avant, genou aligné avec le pied.'],
  ['Fentes avant', ['jambes'], 'Grand pas en avant, descendre le genou arrière vers le sol, puis revenir en poussant.'],
  ['Fentes marchées', ['jambes'], 'Enchaîner les fentes en avançant d\'un pas à chaque répétition.'],
  ['Fentes arrière', ['jambes'], 'Reculer d\'un pas et descendre le genou arrière vers le sol ; plus doux pour les genoux.'],
  ['Presse à cuisses', ['jambes'], 'Pousser le plateau sans verrouiller les genoux, dos plaqué contre le dossier.'],
  ['Soulevé de terre jambes tendues', ['jambes', 'tirage'], 'Pencher le buste en gardant le dos plat et les jambes presque tendues ; sentir l\'arrière des cuisses.'],
  ['Soulevé de terre', ['jambes', 'tirage'], 'Barre au sol, dos neutre, pousser le sol avec les jambes puis étendre les hanches.'],
  ['Hip thrust', ['jambes'], 'Haut du dos sur un banc, pousser les hanches vers le haut en serrant les fessiers.'],
  ['Pont fessier', ['jambes'], 'Allongé, pieds au sol, monter le bassin en contractant les fessiers.'],
  ['Montées sur banc', ['jambes'], 'Monter un pied sur un banc, pousser avec la jambe d\'appui, redescendre en contrôle.'],
  ['Leg curl', ['jambes'], 'Fléchir les genoux contre la résistance pour travailler l\'arrière des cuisses.'],
  ['Leg extension', ['jambes'], 'Tendre les genoux contre la résistance pour travailler l\'avant des cuisses.'],
  ['Mollets debout', ['jambes'], 'Monter sur la pointe des pieds, marquer une pause en haut, redescendre lentement.'],
  ['Squat sauté', ['jambes', 'cardio'], 'Squat suivi d\'un saut explosif, réception souple.'],
  ['Chaise murale', ['jambes', 'gainage'], 'Dos contre le mur, cuisses parallèles au sol, tenir la position.'],
  // Poussée
  ['Pompes', ['poussee'], 'Mains sous les épaules, corps gainé, poitrine vers le sol puis pousser.'],
  ['Pompes sur les genoux', ['poussee'], 'Version facilitée des pompes, genoux au sol, corps aligné.'],
  ['Pompes déclinées', ['poussee'], 'Pieds surélevés, accent sur le haut de la poitrine et les épaules.'],
  ['Développé couché', ['poussee'], 'Allongé sur le banc, descendre la barre à la poitrine puis pousser.'],
  ['Développé incliné haltères', ['poussee'], 'Banc incliné, pousser les haltères au-dessus de la poitrine.'],
  ['Développé épaules', ['poussee'], 'Debout ou assis, pousser les charges au-dessus de la tête sans cambrer.'],
  ['Élévations latérales', ['poussee'], 'Bras légèrement fléchis, monter les haltères sur les côtés jusqu\'aux épaules.'],
  ['Écartés poitrine', ['poussee'], 'Ouvrir et refermer les bras en arc de cercle, coudes souples.'],
  ['Dips sur banc', ['poussee'], 'Mains sur un banc derrière soi, fléchir les coudes puis pousser.'],
  ['Dips aux barres', ['poussee'], 'Descendre en contrôle entre deux barres parallèles, puis remonter.'],
  ['Extension triceps', ['poussee'], 'Tendre les bras contre la résistance en gardant les coudes fixes.'],
  ['Pompes diamant', ['poussee'], 'Mains rapprochées sous la poitrine pour cibler les triceps.'],
  // Tirage
  ['Tractions', ['tirage'], 'Suspendu à la barre, monter le menton au-dessus en tirant les coudes vers les côtes.'],
  ['Tractions assistées', ['tirage'], 'Traction avec un élastique ou une machine qui allège la charge.'],
  ['Rowing barre', ['tirage'], 'Buste penché, dos plat, tirer la barre vers le ventre.'],
  ['Rowing haltère un bras', ['tirage'], 'Un genou et une main sur le banc, tirer l\'haltère vers la hanche.'],
  ['Rowing élastique', ['tirage'], 'Tirer l\'élastique vers soi en serrant les omoplates.'],
  ['Tirage vertical', ['tirage'], 'Tirer la barre à la poitrine en gardant le buste stable.'],
  ['Tirage horizontal', ['tirage'], 'Assis, tirer la poignée vers le ventre en serrant le dos.'],
  ['Face pull', ['tirage', 'mobilite'], 'Tirer la corde vers le visage, coudes hauts, pour l\'arrière des épaules.'],
  ['Curl biceps haltères', ['tirage'], 'Fléchir les coudes sans balancer le buste.'],
  ['Curl marteau', ['tirage'], 'Curl avec les paumes face à face pour l\'avant-bras.'],
  ['Tirage poitrine inversé', ['tirage'], 'Sous une barre basse, corps gainé, tirer la poitrine vers la barre.'],
  ['Oiseau haltères', ['tirage'], 'Buste penché, ouvrir les bras sur les côtés pour l\'arrière des épaules.'],
  ['Superman', ['tirage', 'gainage'], 'À plat ventre, lever bras et jambes ensemble, serrer le bas du dos.'],
  // Gainage
  ['Planche', ['gainage'], 'Sur les avant-bras, corps aligné de la tête aux talons, ventre serré.'],
  ['Planche latérale', ['gainage'], 'Sur un avant-bras, hanches hautes, corps aligné sur le côté.'],
  ['Gainage dynamique', ['gainage'], 'Passer de la planche sur les avant-bras à la planche sur les mains, sans balancer.'],
  ['Dead bug', ['gainage'], 'Sur le dos, bras et jambes opposés s\'étendent lentement, bas du dos plaqué.'],
  ['Bird dog', ['gainage'], 'À quatre pattes, tendre le bras et la jambe opposés, bassin stable.'],
  ['Relevé de jambes', ['gainage'], 'Allongé, lever les jambes tendues puis les redescendre sans toucher le sol.'],
  ['Crunch', ['gainage'], 'Enrouler le haut du dos vers le bassin, mains légères derrière la tête.'],
  ['Russian twist', ['gainage'], 'Assis, buste incliné, tourner le tronc d\'un côté à l\'autre.'],
  ['Mountain climbers', ['gainage', 'cardio'], 'En planche, ramener les genoux vers la poitrine en alternance.'],
  ['Roue abdominale', ['gainage'], 'À genoux, rouler vers l\'avant en gardant le dos plat puis revenir.'],
  ['Pallof press', ['gainage'], 'Résister à la rotation en tendant un élastique devant soi.'],
  ['Gainage ours', ['gainage'], 'À quatre pattes, genoux décollés de quelques centimètres, tenir.'],
  ['Hollow body', ['gainage'], 'Sur le dos, bras et jambes tendus, bas du dos plaqué, tenir en « banane ».'],
  ['Levée de genoux suspendu', ['gainage'], 'Suspendu, monter les genoux vers la poitrine sans élan.'],
  // Cardio
  ['Corde à sauter', ['cardio'], 'Sauts légers sur l\'avant-pied, poignets qui tournent la corde.'],
  ['Jumping jacks', ['cardio'], 'Sauter en écartant jambes et bras, puis revenir.'],
  ['Burpees', ['cardio'], 'Pompe au sol, ramener les pieds, sauter les bras en l\'air.'],
  ['Skipping', ['cardio'], 'Course sur place, genoux hauts, bras actifs.'],
  ['Talons-fesses', ['cardio'], 'Course sur place en ramenant les talons vers les fessiers.'],
  ['Course', ['cardio'], 'Course à allure régulière, dehors ou sur tapis.'],
  ['Rameur', ['cardio'], 'Pousser avec les jambes, puis tirer avec le dos et les bras ; revenir en sens inverse.'],
  ['Vélo', ['cardio'], 'Pédalage à intensité réglée par la résistance et le rythme.'],
  ['Corde ondulatoire', ['cardio'], 'Onduler deux cordes lourdes en alternance ou ensemble.'],
  ['Kettlebell swing', ['cardio', 'jambes'], 'Projeter la kettlebell avec les hanches jusqu\'à hauteur de poitrine.'],
  ['Box jump', ['cardio', 'jambes'], 'Sauter sur une boîte, réception souple, redescendre en marchant.'],
  ['Shadow boxing', ['cardio'], 'Enchaîner des coups de poing dans le vide, garde haute, appuis mobiles.'],
  ['Thruster', ['cardio', 'jambes'], 'Squat avec charge puis développé au-dessus de la tête en un seul mouvement.'],
  ['Wall ball', ['cardio', 'jambes'], 'Squat puis lancer un ballon lesté contre un mur en hauteur.'],
  // Mobilité
  ['Étirement des fléchisseurs de hanche', ['mobilite'], 'Fente basse, bassin rentré, sentir l\'avant de la hanche.'],
  ['Étirement des ischio-jambiers', ['mobilite'], 'Jambe tendue devant, pencher le buste dos plat.'],
  ['Cat-cow', ['mobilite'], 'À quatre pattes, alterner dos creux et dos rond avec la respiration.'],
  ['Rotation thoracique', ['mobilite'], 'À quatre pattes, une main derrière la tête, ouvrir le coude vers le plafond.'],
  ['Pigeon', ['mobilite'], 'Jambe pliée devant, l\'autre tendue derrière, relâcher le bassin vers le sol.'],
  ['Position du squat profond', ['mobilite'], 'Tenir le fond du squat, coudes qui poussent les genoux vers l\'extérieur.'],
  ['Cercles d\'épaules', ['mobilite'], 'Grands cercles lents avec les bras pour échauffer les épaules.'],
  ['Posture de l\'enfant', ['mobilite'], 'À genoux, fesses sur les talons, bras tendus devant, respirer.'],
  ['Chien tête en bas', ['mobilite'], 'Hanches hautes, talons vers le sol, dos long.'],
  ['Mobilité de cheville au mur', ['mobilite'], 'Pied face à un mur, pousser le genou vers le mur sans décoller le talon.'],
]

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const EXERCICES = LISTE.map(([nom, categories, description]) => ({
  id: `ex-${slug(nom)}`, nom, description, lienVideo: null, categories
}))

/** id d'exercice à partir de son nom (pour écrire les séances de démo). */
export const exId = (nom) => {
  const e = EXERCICES.find((x) => x.nom === nom)
  if (!e) throw new Error(`Exercice de démo inconnu : ${nom}`)
  return e.id
}
