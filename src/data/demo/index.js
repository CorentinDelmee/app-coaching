// Données factices, générées RELATIVEMENT à `now` (la démo reste vivante quel que soit le jour du premier lancement).
import { ajouterJours, jourLocal, jourSemaine, lundiDe } from '../../domain/dates.js'
import { mettreAJourTemplate } from '../../domain/realisations.js'
import { EXERCICES, exId } from './exercices.js'
import { QUESTIONNAIRES } from './questionnaires.js'

export { EXERCICES } from './exercices.js'
export { QUESTIONNAIRES } from './questionnaires.js'

export const COMPTES_DEMO = [
  { identifiant: 'corentin', code: 'COACH2026', role: 'coach' },
  { identifiant: 'fabien.vincent', code: 'DEMO2024', role: 'client' },
  { identifiant: 'lea.martin', code: 'DEMO2024', role: 'client' },
  { identifiant: 'thomas.bernard', code: 'DEMO2024', role: 'client' }
]

const JOUR_MS = 86400000

// --- Fabriques de blocs --------------------------------------------------------------------------

const CHAMPS_CHARGE = (modifiable = true) => [{ cle: 'poids', modifiableParClient: modifiable }, { cle: 'reps', modifiableParClient: true }]
const CHAMPS_REPS = [{ cle: 'reps', modifiableParClient: true }]
const CHAMPS_TEMPS = [{ cle: 'tempsTravail', modifiableParClient: false }]

/** Bloc exercice : `n` séries identiques. */
function bloc(id, nom, n, serie, { repos = 90, champs, consignes } = {}) {
  const defaut = 'poids' in serie ? CHAMPS_CHARGE() : 'tempsTravail' in serie ? CHAMPS_TEMPS : CHAMPS_REPS
  const b = { type: 'exercice', id, exerciceId: exId(nom), champs: champs || defaut, series: Array.from({ length: n }, () => ({ ...serie })), repos }
  if (consignes) b.consignes = consignes
  return b
}
const superset = (id, repos, exos) => ({ type: 'superset', id, repos, exercices: exos })
const circuit = (id, nom, format, params, exercices) => ({ type: 'circuit', id, nom, format, params, exercices })
const exSimple = (nom, reps) => ({ exerciceId: exId(nom), ...(reps ? { reps } : {}) })

function workout(id, clientId, nom, blocs, consignes) {
  return { id, clientId, nom, blocs, ...(consignes ? { consignes } : {}) }
}

// --- Séances ---------------------------------------------------------------------------------------

function workoutsFabien(c) {
  const w1 = workout('w-fabien-1', c, 'Workout 1 — Bas du corps', [
    bloc('w1-b1', 'Squat', 4, { poids: 60, reps: 8 }, { repos: 120, consignes: 'Descends jusqu\'à ce que les cuisses soient parallèles au sol.' }),
    bloc('w1-b2', 'Fentes arrière', 3, { poids: 12, reps: 10 }, { repos: 90 }),
    bloc('w1-b3', 'Hip thrust', 3, { poids: 50, reps: 12 }, { repos: 90 }),
    bloc('w1-b4', 'Planche', 3, { tempsTravail: 30 }, { repos: 45 })
  ], 'Échauffe-toi 5 minutes avant de commencer. Qualité des mouvements avant la charge.')
  const w2 = workout('w-fabien-2', c, 'Workout 2 — Haut du corps', [
    bloc('w2-b1', 'Développé couché', 4, { poids: 50, reps: 8 }, { repos: 120 }),
    bloc('w2-b2', 'Rowing haltère un bras', 3, { poids: 20, reps: 10 }),
    bloc('w2-b3', 'Développé épaules', 3, { poids: 14, reps: 10 }),
    superset('w2-b4', 75, [
      bloc('w2-b4a', 'Curl marteau', 3, { poids: 10, reps: 12 }),
      bloc('w2-b4b', 'Extension triceps', 3, { poids: 15, reps: 12 })
    ].map(({ type, repos, ...x }) => ({ ...x }))),
    bloc('w2-b5', 'Tractions assistées', 3, { reps: 6 }, { repos: 90 })
  ])
  const w3 = workout('w-fabien-3', c, 'Workout 3 — Corps entier', [
    bloc('w3-b1', 'Soulevé de terre jambes tendues', 3, { poids: 40, reps: 10 }, { repos: 90 }),
    bloc('w3-b2', 'Pompes', 3, { reps: 12 }, { repos: 60 }),
    circuit('w3-b3', 'Finisher AMRAP', 'amrap', { duree: 8 * 60 }, [exSimple('Burpees', 5), exSimple('Squat sauté', 10), exSimple('Mountain climbers', 20)]),
    circuit('w3-b4', 'Finisher EMOM', 'emom', { minutes: 6, exercices: ['Kettlebell swing', 'Pompes'] }, [exSimple('Kettlebell swing', 12), exSimple('Pompes', 10)])
  ])
  // Séance d'essai : un circuit de chaque autre format (hors programme).
  const wc = workout('w-fabien-circuits', c, 'Circuits — essai de tous les formats', [
    circuit('wc-b1', 'For Time', 'fortime', { cap: 12 * 60 }, [exSimple('Burpees', 20), exSimple('Squat', 30), exSimple('Pompes', 20)]),
    circuit('wc-b2', 'Time cap', 'timecap', { cap: 8 * 60 }, [exSimple('Fentes avant', 40), exSimple('Corde à sauter', 100)]),
    circuit('wc-b3', 'Death by', 'deathby', {}, [exSimple('Burpees')]),
    circuit('wc-b4', 'Tabata', 'tabata', {}, [exSimple('Squat sauté'), exSimple('Mountain climbers')]),
    circuit('wc-b5', 'Intervalles', 'intervalles', { tours: 5, travail: 40, repos: 20 }, [exSimple('Rameur')]),
    circuit('wc-b6', 'Superset', 'superset', { tours: 3, repos: 60, exercices: ['Pompes', 'Rowing élastique'] }, [exSimple('Pompes', 12), exSimple('Rowing élastique', 12)])
  ])
  return [w1, w2, w3, wc]
}

function workoutsSimples(prefixe, c, noms) {
  // Séances de 3 exercices pour les autres clients : [[nom, poids, reps], ...] par séance
  return noms.map(([titre, exos], i) => workout(`${prefixe}-${i + 1}`, c, titre,
    exos.map(([nom, poids, reps], j) => bloc(`${prefixe}-${i + 1}-b${j + 1}`, nom, 3, poids ? { poids, reps } : { reps }, { repos: 75 }))))
}

// --- Réalisations ----------------------------------------------------------------------------------

function realisation(clientId, w, date, progression, extra = {}) {
  const valeurs = {}
  let volume = 0
  const items = w.blocs.flatMap((b) => (b.type === 'exercice' ? [b] : b.type === 'superset' ? b.exercices : []))
  for (const b of items) {
    valeurs[b.id] = {
      exerciceId: b.exerciceId,
      series: b.series.map((s) => {
        const v = { ...s }
        if (typeof v.poids === 'number') v.poids = v.poids + progression * 2.5
        if (typeof v.poids === 'number' && typeof v.reps === 'number') volume += v.poids * v.reps
        return v
      })
    }
  }
  return {
    id: `real-${clientId}-${date}-${w.id}`, clientId, workoutId: w.id, programmeId: `prog-${clientId}`, date, semaine: lundiDe(date),
    valeurs, circuits: {}, dureeSec: 3000 + progression * 60, volume, seriesFaites: items.reduce((n, b) => n + b.series.length, 0),
    termineLe: new Date(`${date}T18:00:00`).getTime(), ...extra
  }
}

// --- Questionnaires remplis ------------------------------------------------------------------------

function checkin(clientId, date, i, douleur = 1) {
  return {
    id: `rep-${clientId}-${date}`, clientId, questionnaireId: 'q-checkin-quotidien', frequence: 'quotidien', date,
    valeurs: { sommeil: 6 + (i % 4), energie: ['😐', '🙂', '🙂', '🤩'][i % 4], stress: 3 + (i % 3), douleur, faim: 'Normale', hydratation: 1.5 + (i % 3) * 0.5 }
  }
}

// --- Génération ------------------------------------------------------------------------------------

export function genererDemo(now) {
  const aujourdhui = jourLocal(now)
  const jour = (delta) => ajouterJours(aujourdhui, delta)
  const lundi = lundiDe(aujourdhui)
  const ts = (delta) => now + delta * JOUR_MS

  const coach = {
    id: 'coach-corentin', role: 'coach', identifiant: 'corentin', nom: 'Corentin Delmée', archive: false, creeLe: ts(-90),
    preferences: { son: true, vibration: true, unite: 'kg' }
  }
  const client = (id, identifiant, nom, tarif, lieuDefaut, modules, creeLe) => ({
    id, role: 'client', identifiant, nom, tarif, lieuDefaut, modules, archive: false, creeLe,
    preferences: { son: true, vibration: true, unite: 'kg' }, consentementLe: null
  })
  const fabien = client('client-fabien-vincent', 'fabien.vincent', 'Fabien Vincent', 35, 'domicile', { habitudes: true, photosRepas: false, calories: false }, ts(-30))
  const lea = client('client-lea-martin', 'lea.martin', 'Léa Martin', 50, 'salle', { habitudes: true, photosRepas: true, calories: true }, ts(-20))
  const thomas = client('client-thomas-bernard', 'thomas.bernard', 'Thomas Bernard', 35, 'domicile', { habitudes: false, photosRepas: false, calories: false }, ts(-40))

  // Fabien : programme répété, 3 workouts / semaine, commencé il y a 3 semaines (semaine 4 en cours).
  const wF = workoutsFabien(fabien.id)
  const progF = {
    id: `prog-${fabien.id}`, clientId: fabien.id, nom: 'Programme Fabien Vincent', mode: 'repete', debut: ajouterJours(lundi, -21),
    workouts: ['w-fabien-1', 'w-fabien-2', 'w-fabien-3']
  }
  const realisations = []
  for (let semaine = 0; semaine < 4; semaine++) {
    wF.slice(0, 3).forEach((w, k) => {
      const date = ajouterJours(progF.debut, semaine * 7 + [0, 2, 4][k])
      if (date > aujourdhui) return
      const extra = semaine === 2 && k === 1 ? { commentaire: 'Épaule droite un peu sensible sur le développé.' } : {}
      realisations.push(realisation(fabien.id, w, date, semaine, extra))
    })
  }

  // Léa : programme « par semaine » de 4 semaines, 2 séances par semaine, commencé la semaine dernière.
  const wL = workoutsSimples('w-lea', lea.id, [
    ['Semaine 1 — Séance A', [['Squat gobelet', 16, 12], ['Pompes sur les genoux', 0, 10], ['Rowing élastique', 0, 12]]],
    ['Semaine 1 — Séance B', [['Fentes avant', 8, 10], ['Développé épaules', 8, 12], ['Pont fessier', 0, 15]]],
    ['Semaine 2 — Séance A', [['Squat gobelet', 18, 12], ['Pompes sur les genoux', 0, 12], ['Tirage horizontal', 25, 12]]],
    ['Semaine 2 — Séance B', [['Fentes avant', 10, 10], ['Développé épaules', 10, 10], ['Hip thrust', 40, 12]]],
    ['Semaine 3 — Séance A', [['Squat', 30, 10], ['Pompes', 0, 8], ['Rowing haltère un bras', 12, 10]]],
    ['Semaine 3 — Séance B', [['Fentes marchées', 10, 12], ['Développé incliné haltères', 10, 10], ['Hip thrust', 45, 12]]],
    ['Semaine 4 — Séance A', [['Squat', 35, 10], ['Pompes', 0, 10], ['Tirage vertical', 30, 10]]],
    ['Semaine 4 — Séance B', [['Fentes marchées', 12, 12], ['Développé épaules', 12, 10], ['Hip thrust', 50, 12]]]
  ])
  const progL = {
    id: `prog-${lea.id}`, clientId: lea.id, nom: 'Programme Léa Martin', mode: 'parSemaine', debut: ajouterJours(lundi, -7), nbSemaines: 4,
    semaines: [['w-lea-1', 'w-lea-2'], ['w-lea-3', 'w-lea-4'], ['w-lea-5', 'w-lea-6'], ['w-lea-7', 'w-lea-8']]
  }
  wL.slice(0, 2).forEach((w, k) => realisations.push(realisation(lea.id, w, ajouterJours(progL.debut, [1, 3][k]), 0)))

  // Thomas : programme répété à 2 séances, peu actif.
  const wT = workoutsSimples('w-thomas', thomas.id, [
    ['Full body A', [['Squat gobelet', 20, 10], ['Pompes', 0, 8], ['Rowing élastique', 0, 12]]],
    ['Full body B', [['Fentes avant', 10, 10], ['Développé épaules', 10, 10], ['Pont fessier', 0, 12]]]
  ])
  const progT = {
    id: `prog-${thomas.id}`, clientId: thomas.id, nom: 'Programme Thomas Bernard', mode: 'repete', debut: ajouterJours(lundi, -14), workouts: ['w-thomas-1', 'w-thomas-2']
  }
  wT.forEach((w, k) => realisations.push(realisation(thomas.id, w, ajouterJours(progT.debut, [1, 3][k]), 0)))

  // Templates : dernières valeurs réellement validées, rejouées dans l'ordre.
  const templates = [fabien, lea, thomas].map((c) => {
    let t = null
    for (const r of realisations.filter((x) => x.clientId === c.id).sort((a, b) => a.date.localeCompare(b.date))) t = mettreAJourTemplate(t, r)
    return t
  })

  // Séances de coaching
  const seancesCoaching = []
  const seance = (c, date, heure, statut, id) => seancesCoaching.push({
    id: id || `sc-${c.id}-${date}`, clientId: c.id, date, heure, lieu: c.lieuDefaut, statut, tarif: c.tarif
  })
  for (let d = -21; d <= -1; d++) if (jourSemaine(jour(d)) === 1) seance(fabien, jour(d), '18:30', 'faite') // mardis passés
  seance(fabien, jour(-12), '17:00', 'annulee')
  seance(fabien, jour(2), '18:30', 'prevue')
  seance(fabien, jour(9), '18:30', 'prevue')
  seance(lea, jour(-9), '10:00', 'faite')
  seance(lea, jour(-2), '10:00', 'faite')
  seance(lea, jour(3), '10:00', 'prevue')
  seance(thomas, jour(-10), '19:00', 'faite') // aucune séance prévue ensuite

  // Questionnaires remplis : Fabien (douleur 7 hier), Léa (à jour), Thomas (dernier check-in il y a 4 jours)
  const reponses = []
  for (let i = 5; i >= 0; i--) reponses.push(checkin(fabien.id, jour(-i), i, i === 1 ? 7 : 1))
  for (let i = 4; i >= 0; i--) reponses.push(checkin(lea.id, jour(-i), i))
  reponses.push(checkin(thomas.id, jour(-4), 4), checkin(thomas.id, jour(-5), 5))

  const mesures = [
    { id: 'm-f-1', clientId: fabien.id, date: jour(-21), poids: 82.4, mensurations: { tourDeTaille: 90 } },
    { id: 'm-f-2', clientId: fabien.id, date: jour(-14), poids: 82, mensurations: { tourDeTaille: 89.5 } },
    { id: 'm-f-3', clientId: fabien.id, date: jour(-7), poids: 81.5, mensurations: { tourDeTaille: 89 } },
    { id: 'm-f-4', clientId: fabien.id, date: jour(0), poids: 81.1, mensurations: { tourDeTaille: 88.5 } },
    { id: 'm-l-1', clientId: lea.id, date: jour(-3), poids: 63.2, mensurations: { tourDeTaille: 71 } }
  ]
  const douleurs = [
    { id: 'd-f-1', clientId: fabien.id, zone: 'epaule-droite', intensite: 4, date: jour(-4) },
    { id: 'd-f-2', clientId: fabien.id, zone: 'genou-gauche', intensite: 2, date: jour(-10) }
  ]
  const nutrition = [
    { id: 'n-f-1', clientId: fabien.id, date: jour(-1), type: 'habitude', valeur: { nom: 'Boire 2 L d\'eau', fait: true } },
    { id: 'n-f-2', clientId: fabien.id, date: jour(0), type: 'habitude', valeur: { nom: 'Boire 2 L d\'eau', fait: false } },
    { id: 'n-l-1', clientId: lea.id, date: jour(-1), type: 'calories', valeur: { kcal: 1850 } },
    { id: 'n-l-2', clientId: lea.id, date: jour(0), type: 'calories', valeur: { kcal: 1720 } }
  ]
  const motsDuCoach = [{ id: 'mot-fabien', clientId: fabien.id, texte: 'Belle régularité ces dernières semaines, on garde le cap ! — Corentin', date: jour(-3) }]

  return {
    profils: [coach, fabien, lea, thomas],
    exercices: EXERCICES.map((e) => ({ ...e })),
    workouts: [...wF, ...wL, ...wT],
    programmes: [progF, progL, progT],
    realisations,
    templates,
    seancesCoaching,
    motsDuCoach,
    questionnaires: QUESTIONNAIRES.map((q) => structuredClone(q)),
    reponses, mesures, douleurs, nutrition,
    alertesVues: [],
    comptes: Object.fromEntries(COMPTES_DEMO.map((c) => {
      const p = [coach, fabien, lea, thomas].find((x) => x.identifiant === c.identifiant)
      return [c.identifiant, { id: p.id, code: c.code }]
    }))
  }
}
