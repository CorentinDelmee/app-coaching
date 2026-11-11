// Génère programme.json + exercices-utilises.json pour Ludo, et estime les durées.
import fs from 'node:fs';
const OUT = 'C:/Users/coren/Documents/REXV2/Projets/app-coaching/programmes/ludo/';
const lib = JSON.parse(fs.readFileSync(new URL('./ex.json', import.meta.url))).exercices;
const libByNom = new Map(lib.map(e => [e.nom, e]));
const aCreer = JSON.parse(fs.readFileSync(OUT + 'exercices-a-creer.json', 'utf8'));
const nomsACreer = new Set(aCreer.map(e => e.nom));

const REPS = { P: ['8-10', '6-8', '5-7'], S: ['10-12', '8-10', '8-10'], I: ['12-15', '10-12', '12-15'] };
// RPE par semaine du bloc (1..3) ; semaine 4 = allégée (RPE 6)
const RPE = { P: [[7, 8, 8.5], [8, 8.5, 9], [8, 8.5, 9]], S: [[7, 8, 8.5], [8, 8.5, 9], [8, 8.5, 9]], I: [[7.5, 8.5, 9], [8.5, 9, 9.5], [8.5, 9, 9.5]] };

// ex(nom, role, series, opts) ; opts : tempo, repos [b1,b2,b3], reps (fixe), b3 (nom de remplacement bloc 3), c (consignes), uni (unilatéral), drop
const ex = (nom, role, series, o = {}) => ({ nom, role, series, ...o });
const ss = (repos, ...exs) => ({ ss: exs, repos });
// Activation épaules + gainage (épaules fragiles) : fait partie de l'échauffement (compté dans les 9 min)
const PREP = () => ({ warm: true, ss: [
  ex('Band External Rotation + Press', 'W', 2, { reps: 12, tempo: '2-0-1-1', c: 'Activation de la coiffe : élastique léger, coude à hauteur d\'épaule, tourne l\'avant-bras vers le haut puis pousse. Lent, sans douleur.' }),
  ex('Shoulder Wall Slide', 'W', 2, { reps: 10, tempo: '2-0-2-1', c: 'Dos et avant-bras contre le mur, côtes basses : glisse les bras vers le haut en gardant le contact, omoplates qui descendent et se resserrent.' }),
  ex('Dead Bug', 'W', 2, { reps: 8, tempo: '2-1-1-0', c: 'Reps par côté. Bas du dos plaqué au sol, expire en tendant bras et jambe opposés. Gainage pour la posture.' })], repos: 0 });
const DOULEUR = ' Douleur à l\'épaule (pas la brûlure musculaire) = on retire l\'exercice et on prévient Corentin.';
const liss = (nom, mins, c) => ({ cardio: 'liss', nom, mins, c });

const LISS_TAPIS = 'Marche inclinée : pente 10-12 %, 5-6 km/h, sans se tenir aux barres. Zone 2 : tu peux parler en phrases courtes (≈ 65-75 % FC max).';
const LISS_STAIR = 'Allure régulière, zone 2 (tu peux parler en phrases courtes), sans brûlure dans les fessiers : demain, c\'est la séance ischios-fessiers. Ne pas s\'appuyer sur les rampes.';

const SEANCES = [
  {
    jour: 'lundi', nom: 'Lundi — Haut du corps (force)',
    consignes: 'Échauffement 8-9 min : 2 min rameur facile, puis le 1er bloc (activation des épaules et gainage, 2 tours sans repos), puis 2-3 séries de montée en charge au développé haltères et 1 série légère de tractions (non comptées). Focus : charges lourdes, technique propre, omoplates serrées sur toutes les poussées. Note tes charges à chaque série.' + DOULEUR,
    blocs: [
      PREP(),
      ex('Développé couché haltères prise neutre', 'P', 4, { sh: true, tempo: '3-1-1-0', repos: [150, 150, 150], c: 'Paumes face à face, coudes à 30-45° du buste, omoplates serrées et basses. Descente contrôlée en 3 s jusqu\'à l\'étirement confortable de l\'épaule (pas plus bas), pause 1 s, poussée. Amène et repose les haltères par les cuisses.' }),
      ex('Pull Ups (Neutral Grip)', 'P', 4, { tempo: '2-0-1-1', repos: [120, 120, 120], c: 'Prise neutre, départ bras tendus, poitrine vers les poignées, 1 s en haut. Si tu n\'arrives plus à faire le bas de la fourchette proprement, finis la série au tirage vertical (Danse&Fitness Lat Pulldown), même nombre de reps. Au-delà du haut de la fourchette au poids du corps : ajoute un lest (ceinture ou haltère entre les pieds).' }),
      ss(90,
        ex('Landmine Press', 'S', 3, { tempo: '2-0-1-0', c: 'À genoux ou debout, extrémité de la barre tenue à deux mains devant la poitrine, côtes basses : pousse vers l\'avant et le haut. Trajectoire en arc, plus douce pour l\'épaule qu\'un développé vertical. Si les 2 postes sont loin : fais les 2 exercices à la suite, repos 90 s.' }),
        ex('DB Seal Row', 'S', 3, { tempo: '2-0-1-1', c: 'Allongé ventre sur banc incliné bas, tire les coudes vers les hanches, 1 s de contraction, sans décoller la poitrine.' })),
      ss(60,
        ex('Élévations latérales haltères', 'I', 3, { tempo: '2-0-1-1', drop: true, c: 'Buste légèrement penché, monte jusqu\'à l\'horizontale en menant avec les coudes, pas d\'élan.' }),
        ex('Inclined Biceps Curl', 'I', 3, { tempo: '3-0-1-0', b3: 'Standing Alternate Rotating Bicep Curls', c: 'Banc à 45-60°, coudes immobiles derrière le buste, supination complète en haut.' }),
        ex('Hanging Leg Raises', 'A', 3, { reps: '10-15', tempo: '2-0-1-1', c: 'Enroule le bassin (genoux vers la poitrine), sans balancer. Trop facile : jambes tendues.' })),
      liss('Walking - Treadmill', [10, 12, 12], LISS_TAPIS),
    ],
  },
  {
    jour: 'mardi', nom: 'Mardi — Bas du corps (quadriceps)',
    consignes: 'Échauffement 6-7 min : 3 min vélo ou marche inclinée, 10 squats au poids du corps, 10 fentes, puis 3 séries de montée en charge au squat (barre à vide, 50 %, 70 %). Focus : amplitude complète, genoux dans l\'axe des pieds. Cardio léger en fin de séance (jambes fatiguées : pas de fractionné).',
    blocs: [
      ex('Back squat barre', 'P', 4, { tempo: '3-0-1-0', repos: [150, 150, 150], c: 'Barre haute, gainage avant la descente, descends au moins cuisses parallèles en gardant le dos neutre, pousse le sol. Sécurités du rack réglées juste sous le point bas.' }),
      ex('Danse&Fitness Inclined Leg Press', 'S', 3, { tempo: '3-0-1-0', repos: [120, 120, 105], c: 'Pieds largeur de hanches, milieu du plateau. Descends tant que le bas du dos reste collé au dossier, ne verrouille pas les genoux en haut.' }),
      ex('Squat bulgare haltères', 'S', 3, { tempo: '2-0-1-0', repos: [90, 90, 75], uni: true, c: 'Reps indiquées par jambe. Pied arrière sur banc, buste légèrement penché, genou avant qui avance au-dessus des orteils. Commence par la jambe la plus faible.' }),
      ss(75,
        ex('Danse&Fitness Leg Extension', 'I', 3, { tempo: '2-0-1-1', drop: true, c: 'Dossier réglé pour que le genou soit aligné avec l\'axe de la machine, 1 s contracté en haut.' }),
        ex('Danse&Fitness Seated LegCurl', 'I', 3, { tempo: '2-0-1-1', c: 'Bassin collé au siège, buste légèrement penché en avant pour étirer les ischios.' })),
      ex('Danse&Fitness Standing Calves Raises', 'I', 3, { tempo: '2-2-1-1', repos: [45, 45, 45], c: 'Pause 2 s étiré en bas, monte le plus haut possible, 1 s en haut. Pas de rebond.' }),
      liss('Walking - Treadmill', [10, 10, 10], LISS_TAPIS),
    ],
  },
  {
    jour: 'mercredi', nom: 'Mercredi — Push (pecs, épaules, triceps)',
    consignes: 'Échauffement 8-9 min : 2 min rameur facile, puis le 1er bloc (activation des épaules et gainage, 2 tours sans repos), puis 2 séries de montée en charge sur la presse inclinée. Focus : haut des pecs et deltoïdes latéraux, amplitude contrôlée sur toutes les poussées. Cardio : fractionné au rameur, la seule séance intense de la semaine.' + DOULEUR,
    blocs: [
      PREP(),
      ex('Danse&Fitness Incline ChestPress', 'P', 4, { sh: true, tempo: '3-0-1-0', repos: [120, 120, 120], c: 'Siège réglé pour que les poignées arrivent au haut des pecs, omoplates serrées, ne pas décoller les épaules du dossier. Amplitude contrôlée : les mains ne reculent pas derrière la ligne de la poitrine.' }),
      ex('Danse&Fitness Shoulder Press', 'S', 3, { oh: true, tempo: '2-0-1-0', repos: [120, 120, 105], c: 'Épaules fragiles : RPE 8 maximum, jamais moins de 8 reps. Dos collé au dossier, prise neutre si la machine le permet, sans verrouiller les coudes. Monte d\'un cran seulement après 2 séances au haut de la fourchette.' }),
      ss(60,
        ex('Danse&Fitness Pec-Deck Butterfly', 'I', 3, { tempo: '2-0-1-1', drop: true, c: 'Coudes légèrement fléchis et fixes, poitrine sortie, 1 s de contraction mains jointes. Au retour, les coudes ne passent pas derrière la ligne des épaules.' }),
        ex('Élévations latérales à la poulie', 'I', 3, { tempo: '2-0-1-1', uni: true, c: 'Reps par bras. Poulie basse, câble derrière le corps, monte jusqu\'à l\'horizontale. Tension continue. Si la poulie est loin du pec-deck : fais les 2 exercices à la suite, repos 60 s.' })),
      ss(75,
        ex('Danse&Fitness Dips Machine', 'S', 3, { tempo: '2-0-1-0', c: 'Buste droit, coudes serrés, épaules basses. Amplitude contrôlée : arrête la descente coudes à 90°, pas de dips profonds. Extension complète en bas.' }),
        ex('Tricep Extension (Rope)', 'I', 3, { tempo: '2-0-1-1', b3: 'Standing Dumbbell Overhead Tricep Extension', drop: true, c: 'Coudes collés au corps, écarte la corde en bas, 1 s de contraction.' })),
      { cardio: 'hiit', nom: 'Rameur', tours: [6, 8, 10], travail: 30, repos: [60, 60, 45] },
    ],
  },
  {
    jour: 'jeudi', nom: 'Jeudi — Pull (dos, arrière d\'épaule, biceps)',
    consignes: 'Échauffement 8-9 min : 2 min rameur facile, puis le 1er bloc (activation des épaules et gainage, 2 tours sans repos), puis 2 séries de montée en charge au tirage vertical. Focus : largeur du dos et posture (omoplates qui descendent et se resserrent à chaque tirage), tirer avec les coudes, pas avec les mains.' + DOULEUR,
    blocs: [
      PREP(),
      ex('Danse&Fitness Lat Pulldown', 'P', 4, { tempo: '2-0-1-1', repos: [120, 120, 120], c: 'Cuisses bloquées, buste légèrement incliné en arrière, barre vers le haut de la poitrine, coudes vers les hanches, 1 s en bas.' }),
      ex('Danse&Fitness High Row', 'S', 3, { tempo: '2-0-1-1', repos: [120, 120, 105], c: 'Poitrine collée au support, tire les coudes vers l\'arrière et le bas, serre les omoplates 1 s.' }),
      ex('Danse&Fitness Seated Cable Row', 'S', 3, { tempo: '2-0-1-1', repos: [90, 90, 75], c: 'Dos neutre, sans balancer le buste, poignée vers le nombril, étire bien les dorsaux au retour.' }),
      ss(60,
        ex('Danse&Fitness Reverse ButterFly', 'I', 3, { tempo: '2-0-1-1', drop: true, c: 'Bras presque tendus, ouvre vers l\'arrière en pensant « écarter », pas « serrer les omoplates ».' }),
        ex('Face pull à la poulie', 'I', 3, { tempo: '2-0-1-1', c: 'Posture : poulie à hauteur du front, corde vers le visage, coudes hauts, finis en rotation externe (mains près des oreilles), 1 s omoplates serrées. Charge légère, la qualité prime.' })),
      ss(60,
        ex('Danse&Fitness Preacher Curl Machine', 'I', 3, { tempo: '3-0-1-0', drop: true, c: 'Aisselles calées sur le pupitre, extension presque complète en bas sans relâcher.' }),
        ex('Standing Hammer Curls', 'I', 3, { tempo: '2-0-1-0', c: 'Prise marteau, coudes fixes le long du corps, sans élan.' })),
      liss('Stairmaster', [10, 12, 15], LISS_STAIR),
    ],
  },
  {
    jour: 'vendredi', nom: 'Vendredi — Bas du corps (ischios, fessiers) + abdos',
    consignes: 'Échauffement 6-7 min : 3 min marche inclinée, 10 good mornings à vide, 10 ponts fessiers, puis 3 séries de montée en charge au soulevé de terre roumain. Focus : charnière de hanche, dos neutre. Cardio léger en fin de séance.',
    blocs: [
      ex('Soulevé de terre roumain barre', 'P', 4, { tempo: '3-0-1-0', repos: [135, 135, 135], c: 'Genoux légèrement fléchis, barre qui glisse le long des cuisses, fesses vers l\'arrière jusqu\'à l\'étirement des ischios (mi-tibia environ), dos neutre. Sangles autorisées.' }),
      ex('Danse&Fitness - Hip Thrust', 'S', 3, { tempo: '2-0-1-2', repos: [120, 120, 105], c: 'Menton rentré, bassin en rétroversion en haut, pause 2 s fessiers serrés.' }),
      ex('Danse&Fitness Lying LegCurl', 'S', 3, { tempo: '3-0-1-0', repos: [75, 75, 60], drop: true, c: 'Bassin plaqué sur le banc, descente lente en 3 s.' }),
      ss(60,
        ex('Danse&Fitness Leg Extension', 'I', 3, { tempo: '2-0-1-1', c: 'Même réglage que mardi.' }),
        ex('Danse&Fitness Adductors /Abductors Machine Seating', 'I', 3, { tempo: '2-0-1-1', c: 'Réglage adducteurs (serrer les jambes), grande amplitude contrôlée.' })),
      ss(60,
        ex('Seated Calf Raises', 'I', 3, { tempo: '2-2-1-1', c: 'Pause 2 s étiré en bas, pas de rebond.' }),
        ex('Abs Weel', 'A', 3, { reps: '8-12', tempo: '3-0-1-0', b3: 'Cable Woodchopper', b3reps: '10-12', b3c: 'Reps par côté. Rotation venue du buste, bras tendus, bassin fixe.', c: 'À genoux, bassin en rétroversion, ne pas creuser le bas du dos. Va seulement aussi loin que tu restes gainé.' })),
      liss('Walking - Treadmill', [10, 12, 12], LISS_TAPIS),
    ],
  },
];

function exBloc(e, b, w, inSS) {
  const deload = w === 3;
  const nom = b === 2 && e.b3 ? e.b3 : e.nom;
  if (e.role === 'W') return { nom: e.nom, series: e.series, reps: e.reps, tempo: e.tempo, consignes: e.c };
  let reps = b === 2 && e.b3reps ? e.b3reps : (e.reps || REPS[e.role][b]);
  // Épaules fragiles : développés jamais sous 6 reps (sh), poussées au-dessus de la tête jamais sous 8 reps ni au-delà de RPE 8 (oh)
  if (e.sh && reps === '5-7') reps = '6-8';
  if (e.oh && (reps === '6-8' || reps === '5-7')) reps = '8-10';
  const role = e.role === 'A' ? 'I' : e.role;
  let rpe = deload ? 6 : RPE[role][b][w];
  if (e.oh) rpe = Math.min(rpe, 8);
  const series = deload ? Math.max(2, Math.round(e.series * 0.6)) : e.series;
  let c = b === 2 && e.b3c ? e.b3c : e.c;
  if (deload) c = 'SEMAINE ALLÉGÉE : charges −10 à −15 % par rapport à la semaine précédente, mêmes reps, 3-4 reps en réserve. ' + c;
  else if (e.drop && b === 1 && w >= 1) c = 'Dernière série : drop set (enchaîne -25 % de charge jusqu\'à RPE 9-10). ' + c;
  const o = { nom, series, reps, rpe, tempo: e.tempo };
  if (!inSS && e.repos) o.repos = e.repos[b];
  o.consignes = c.slice(0, 500);
  return o;
}

function cardioBloc(cb, b, w) {
  const deload = w === 3;
  if (cb.cardio === 'liss') {
    const mins = deload ? 10 : cb.mins[b];
    return { exercice: { nom: cb.nom, series: 1, reps: 0, tempsTravail: mins * 60, consignes: `Cardio ${mins} min. ` + cb.c } };
  }
  const tours = deload ? 6 : cb.tours[b];
  const repos = deload ? 60 : cb.repos[b];
  const rpe = deload ? 'RPE 7 (semaine allégée)' : 'RPE 8-9';
  return { circuit: { nom: 'Cardio fractionné rameur', format: 'intervalles', tours, travail: cb.travail, repos,
    exercices: [{ nom: cb.nom, consignes: `2 min facile avant. ${tours} × (${cb.travail} s fort à ${rpe} / ${repos} s très facile), 26-30 coups/min. Quadriceps encore très courbaturés d'hier : mêmes tours mais à RPE 7.` }] } };
}

const semaines = [];
const est = {};
const errsTot = [];
for (let s = 0; s < 12; s++) {
  const b = Math.floor(s / 4), w = s % 4;
  const seances = SEANCES.map(se => {
    const blocs = se.blocs.map(x => {
      if (x.cardio) return cardioBloc(x, b, w);
      if (x.warm) return { superset: { exercices: x.ss.map(e => exBloc(e, b, w, true)), repos: 0 } };
      if (x.ss) return { superset: { exercices: x.ss.map(e => exBloc(e, b, w, true)), repos: b === 2 ? Math.max(45, x.repos - 15) : x.repos } };
      return { exercice: exBloc(x, b, w, false) };
    });
    // Estimation de durée (secondes), méthode de la revue : tempo compté.
    // Échauffement 9 min ; série = reps moyennes × durée du tempo + 10 s (unilatéral : ×2 + 15 s) ;
    // superset : 30 s de transition entre exercices ; 90 s de changement de poste par bloc ;
    // +40 s par drop set ; cardio + 1 min d'installation (+ 2 min facile avant le fractionné).
    const repsMoy = r => typeof r === 'number' ? r : r.split('-').map(Number).reduce((a, v) => a + v, 0) / 2;
    const tempoS = tp => tp.split('-').reduce((a, v) => a + (/x/i.test(v) ? 1 : Number(v)), 0);
    const serie = (e, spec) => { const d = repsMoy(e.reps) * tempoS(e.tempo) + 10; return spec.uni ? 2 * d + 15 : d; };
    const drop = e => e.consignes.startsWith('Dernière série : drop set') ? 40 : 0;
    let t = 9 * 60;
    for (const [i, x] of se.blocs.entries()) {
      const bl = blocs[i];
      if (x.warm) continue; // compris dans les 9 min d'échauffement
      if (x.cardio === 'liss') { t += bl.exercice.tempsTravail + 60; continue; }
      if (x.cardio === 'hiit') { t += 60 + 120 + bl.circuit.tours * (bl.circuit.travail + bl.circuit.repos); continue; }
      t += 90;
      if (x.ss) {
        const exs = bl.superset.exercices; const n = exs[0].series;
        const tour = exs.reduce((a, e, k) => a + serie(e, x.ss[k]), 0) + 30 * (exs.length - 1);
        t += n * tour + (n - 1) * bl.superset.repos + exs.reduce((a, e) => a + drop(e), 0);
      } else {
        const e = bl.exercice;
        t += e.series * serie(e, x) + (e.series - 1) * e.repos + drop(e);
      }
    }
    (est[se.nom] ||= [])[s] = Math.round(t / 60);
    let consignes = se.consignes;
    if (w === 3) consignes += ' SEMAINE ALLÉGÉE : charges −10 à −15 %, mêmes reps, séries réduites. Récupère, on repart plus fort la semaine suivante.';
    if (s === 11 && se.jour === 'lundi') consignes += ' BILAN : après tes séries, 1 série au développé couché et 1 aux tractions (ou tirage vertical) à la charge de S11, reps max à RPE 9. Note les reps.';
    if ((s === 5 || s === 6) && se.jour === 'vendredi') consignes = 'JOUR FÉRIÉ (' + (s === 5 ? '25/12' : '01/01') + ') : à faire le samedi. ' + consignes;
    if (consignes.length > 1000) errsTot.push('consignes séance > 1000 : ' + se.nom + ' S' + (s + 1));
    return { nom: se.nom, jour: se.jour, consignes, blocs };
  });
  semaines.push({ seances });
}

const notes = fs.readFileSync(new URL('./notes.txt', import.meta.url), 'utf8').trim();
const prog = { client: 'Ludo', nom: 'Ludo — Hypertrophie & sèche 12 semaines', debut: '2026-11-16', notes, semaines };

// ---- vérifications
const errs = [...errsTot];
for (const [k, v] of Object.entries(est)) v.forEach((m, i) => { if (m > 70) errs.push(`durée > 70 min : ${k} S${i + 1} (${m})`); });
const rePat = /^\d{1,3}\s*[-–]\s*\d{1,3}$/, tPat = /^[\dXx]-[\dXx]-[\dXx](-[\dXx])?$/;
if (notes.length > 5000) errs.push('notes ' + notes.length);
const noms = new Map();
function chkEx(e, where) {
  noms.set(e.nom, (noms.get(e.nom) || 0) + 1);
  if (!libByNom.has(e.nom) && !nomsACreer.has(e.nom)) errs.push('nom inconnu ' + e.nom);
  if (e.consignes && e.consignes.length > 500) errs.push('consignes ex >500 ' + where);
  if (typeof e.reps === 'string' && !rePat.test(e.reps)) errs.push('reps ' + where);
  if (e.tempo && !tPat.test(e.tempo)) errs.push('tempo ' + where);
  if (e.rpe && (e.rpe < 1 || e.rpe > 10)) errs.push('rpe ' + where);
}
semaines.forEach((sm, i) => sm.seances.forEach(se => {
  const w = `S${i + 1} ${se.nom}`;
  if (se.consignes.length > 1000) errs.push('consignes séance ' + w);
  if (se.blocs.length > 40) errs.push('blocs ' + w);
  for (const bl of se.blocs) {
    if (bl.exercice) chkEx(bl.exercice, w);
    if (bl.superset) { if (bl.superset.exercices.length < 2 || bl.superset.exercices.length > 4) errs.push('ss ' + w); bl.superset.exercices.forEach(e => chkEx(e, w)); }
    if (bl.circuit) bl.circuit.exercices.forEach(e => { noms.set(e.nom, 1); if (e.consignes.length > 300) errs.push('circuit consignes ' + w); if (!libByNom.has(e.nom)) errs.push('nom inconnu ' + e.nom); });
  }
}));
for (const a of aCreer) if (libByNom.has(a.nom)) console.log('déjà créé dans la bibliothèque : ' + a.nom);

fs.writeFileSync(OUT + 'programme.json', JSON.stringify(prog, null, 2) + '\n');
const utilises = [...noms.keys()].sort().map(nom => {
  const l = libByNom.get(nom);
  return { nom, existe: !!l, creePourLudo: nomsACreer.has(nom), machineSalle: nom.startsWith('Danse&Fitness'), video: l && l.video ? l.video.statut : 'aucune' };
});
fs.writeFileSync(OUT + 'exercices-utilises.json', JSON.stringify(utilises, null, 2) + '\n');

console.log('notes', notes.length, 'car.');
console.log('Durées estimées (min) S1..S12 :');
for (const [k, v] of Object.entries(est)) console.log(k.padEnd(52), v.join(' '));
console.log('exercices', utilises.length, 'dont machines', utilises.filter(u => u.machineSalle).length, 'à créer', utilises.filter(u => !u.existe).length);
console.log(errs.length ? 'ERREURS\n' + errs.join('\n') : 'OK : aucune erreur');
