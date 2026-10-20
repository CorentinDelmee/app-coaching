// Modèle de données (JSDoc) + validateurs. Chaque `valider*` renvoie { ok, erreurs }
// avec des messages lisibles : « Exercice : le champ « nom » est obligatoire ».
import { estJour } from './dates.js'

export const ROLES = ['coach', 'client']
export const LIEUX = ['domicile', 'salle']
export const MODES_PROGRAMME = ['repete', 'parSemaine']
export const STATUTS_SEANCE = ['prevue', 'faite', 'annulee']
export const FREQUENCES = ['quotidien', 'hebdo', 'ponctuel']
export const TYPES_QUESTION = ['curseur', 'choixUnique', 'choixMultiple', 'emojis', 'nombre', 'texte', 'photo']
export const FORMATS_CIRCUIT = ['amrap', 'emom', 'fortime', 'timecap', 'deathby', 'tabata', 'intervalles', 'superset']
export const TYPES_NUTRITION = ['habitude', 'repas', 'calories']

/**
 * Catalogue des champs d'un exercice (CDC §5). Un champ personnalisé a une clé « perso:xxx ».
 * `pas` = incrément du grand sélecteur. Valeurs numériques en unités de base (kg, secondes).
 */
export const CHAMPS = {
  poids: { label: 'Poids', unite: 'kg', type: 'nombre', pas: 0.5, min: 0 },
  reps: { label: 'Répétitions', unite: 'reps', type: 'nombre', pas: 1, min: 0 },
  fourchetteReps: { label: 'Fourchette de répétitions', type: 'texte' },
  repsAuMax: { label: 'Max de répétitions', type: 'booleen' },
  poidsDuCorps: { label: 'Poids du corps', type: 'booleen' },
  rpe: { label: 'RPE', unite: '/10', type: 'nombre', pas: 0.5, min: 1, max: 10 },
  tempo: { label: 'Tempo', type: 'texte' },
  pourcent1rm: { label: '% du 1RM', unite: '%', type: 'nombre', pas: 1, min: 0, max: 100 },
  repos: { label: 'Temps de repos', unite: 's', type: 'nombre', pas: 5, min: 0 },
  tempsTravail: { label: 'Temps de travail', unite: 's', type: 'nombre', pas: 5, min: 0 },
  dureeTotale: { label: 'Durée totale', unite: 's', type: 'nombre', pas: 5, min: 0 },
  resistance: { label: 'Résistance', type: 'nombre', pas: 1, min: 0 },
  niveau: { label: 'Niveau', type: 'choix', choix: ['facile', 'moyen', 'difficile'] },
  bpm: { label: 'BPM', unite: 'bpm', type: 'nombre', pas: 1, min: 0 },
  bpmMax: { label: 'BPM max', unite: 'bpm', type: 'nombre', pas: 1, min: 0 }
}

/**
 * Entités (tous les `id` sont des chaînes) :
 * - Profil { id, role, identifiant, nom, tarif?, lieuDefaut?, modules?{habitudes,photosRepas,calories}, archive,
 *   preferences?{son,vibration,unite:'kg'|'lb'}, consentementLe?, creeLe }
 * - Exercice { id, nom, description?, lienVideo?, categories[] }
 * - Workout { id, clientId|null, nom, consignes?, blocs[] } ; blocs :
 *   { type:'exercice', id, exerciceId, champs:[{cle, modifiableParClient}], series:[{poids:60, reps:8…}], repos?, consignes? }
 *   { type:'superset', id, repos?, exercices:[{id, exerciceId, champs, series}] }   (A/B enchaînés, repos après le passage)
 *   { type:'circuit', id, nom?, format, params, exercices:[{exerciceId, reps?, consignes?}] }
 * - Programme { id, clientId, nom, mode:'repete'|'parSemaine', debut:'AAAA-MM-JJ', nbSemaines?, workouts?[] (repete),
 *   semaines?[[workoutId]] (parSemaine), joursFixes?{workoutId: 0-6 (0 = lundi)} }
 * - Realisation { id, clientId, workoutId, programmeId?, date, semaine (lundi), valeurs:{blocId:{exerciceId, series[]}},
 *   circuits?{blocId: resultat}, dureeSec, volume, seriesFaites?, commentaire?, termineLe }
 * - TemplateClient { id (= clientId), valeurs:{workoutId:{blocId: series[]}} }  (dernières valeurs saisies)
 * - SeanceCoaching { id, clientId, date, heure:'HH:MM', lieu, statut:'prevue'|'faite'|'annulee', tarif (figé à la création) }
 * - MotDuCoach { id, clientId, texte, date } · Questionnaire { id, clientId|null, nom, frequence, questions[{cle, libelle, type…}] }
 * - Reponse { id, clientId, questionnaireId, frequence, date, valeurs:{cleQuestion: valeur} }
 * - Mesure { id, clientId, date, poids?(kg), mensurations?{zone: cm} } · Douleur { id, clientId, zone, intensite 0-10, date }
 * - EntreeNutrition { id, clientId, date, type, valeur } · AlerteVue { id (clé d'alerte), clientId, vueLe }
 */

const typeDe = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v)
const ETIQUETTES = { string: 'du texte', number: 'un nombre', boolean: 'vrai/faux', array: 'une liste', object: 'un objet' }
const vide = (v) => v === undefined || v === null || v === ''

/**
 * Valide un objet selon un schéma { champ: { type, optionnel?, enum?, min?, max?, date? } }.
 * `extra(obj, msg)` permet des vérifications spécifiques.
 */
function valider(entite, schema, obj, extra) {
  const erreurs = []
  const msg = (champ, texte) => erreurs.push(`${entite} : le champ « ${champ} » ${texte}`)
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, erreurs: [`${entite} : objet attendu`] }
  }
  for (const [champ, spec] of Object.entries(schema)) {
    const v = obj[champ]
    if (vide(v)) {
      if (!spec.optionnel) msg(champ, 'est obligatoire')
      continue
    }
    if (typeDe(v) !== spec.type) {
      msg(champ, `doit être ${ETIQUETTES[spec.type]}`)
      continue
    }
    if (spec.enum && !spec.enum.includes(v)) msg(champ, `doit valoir l'une de ces valeurs : ${spec.enum.join(', ')}`)
    if (spec.date && !estJour(v)) msg(champ, 'doit être une date AAAA-MM-JJ')
    if (spec.min !== undefined && v < spec.min) msg(champ, `doit être au moins ${spec.min}`)
    if (spec.max !== undefined && v > spec.max) msg(champ, `doit être au plus ${spec.max}`)
  }
  if (extra && erreurs.length === 0) extra(obj, msg)
  return { ok: erreurs.length === 0, erreurs }
}

const S = (opts = {}) => ({ type: 'string', ...opts })
const N = (opts = {}) => ({ type: 'number', ...opts })
const B = (opts = {}) => ({ type: 'boolean', ...opts })
const A = (opts = {}) => ({ type: 'array', ...opts })
const O = (opts = {}) => ({ type: 'object', ...opts })

export function validerProfil(p) {
  return valider('Profil', {
    id: S(), role: S({ enum: ROLES }), identifiant: S(), nom: S(), creeLe: N(),
    archive: B({ optionnel: true }), tarif: N({ optionnel: true, min: 0 }),
    lieuDefaut: S({ optionnel: true, enum: LIEUX }), modules: O({ optionnel: true }), preferences: O({ optionnel: true }),
    consentementLe: N({ optionnel: true })
  }, p, (o, msg) => {
    if (o.role === 'client') {
      if (o.tarif === undefined) msg('tarif', 'est obligatoire pour un client')
      if (!o.lieuDefaut) msg('lieuDefaut', 'est obligatoire pour un client')
      if (!o.modules) msg('modules', 'est obligatoire pour un client')
    }
  })
}

export const validerExercice = (e) =>
  valider('Exercice', { id: S(), nom: S(), description: S({ optionnel: true }), lienVideo: S({ optionnel: true }), categories: A() }, e)

function validerChampsEtSeries(item, ou, msg) {
  if (item.champs !== undefined) {
    if (!Array.isArray(item.champs)) return msg(`${ou}.champs`, 'doit être une liste')
    for (const c of item.champs) {
      if (!c || !c.cle) msg(`${ou}.champs`, 'contient un champ sans « cle »')
      else if (typeof c.modifiableParClient !== 'boolean') msg(`${ou}.champs.${c.cle}`, 'doit préciser « modifiableParClient » (vrai/faux)')
    }
  }
  if (!Array.isArray(item.series) || item.series.length === 0) msg(`${ou}.series`, 'doit contenir au moins une série')
}

export function validerWorkout(w) {
  return valider('Workout', { id: S(), nom: S(), clientId: S({ optionnel: true }), consignes: S({ optionnel: true }), blocs: A() }, w, (o, msg) => {
    o.blocs.forEach((b, i) => {
      const ou = `blocs[${i}]`
      if (!b || !b.id) return msg(ou, 'doit avoir un « id »')
      if (b.type === 'exercice') {
        if (!b.exerciceId) msg(`${ou}.exerciceId`, 'est obligatoire')
        validerChampsEtSeries(b, ou, msg)
      } else if (b.type === 'superset') {
        if (!Array.isArray(b.exercices) || b.exercices.length < 2) return msg(`${ou}.exercices`, 'doit contenir au moins 2 exercices')
        b.exercices.forEach((x, j) => {
          if (!x.id || !x.exerciceId) msg(`${ou}.exercices[${j}]`, 'doit avoir « id » et « exerciceId »')
          validerChampsEtSeries(x, `${ou}.exercices[${j}]`, msg)
        })
      } else if (b.type === 'circuit') {
        if (!FORMATS_CIRCUIT.includes(b.format)) msg(`${ou}.format`, `doit valoir l'une de ces valeurs : ${FORMATS_CIRCUIT.join(', ')}`)
        if (!Array.isArray(b.exercices)) msg(`${ou}.exercices`, 'doit être une liste')
      } else msg(`${ou}.type`, 'doit valoir exercice, superset ou circuit')
    })
  })
}

export const validerProgramme = (p) =>
  valider('Programme', {
    id: S(), clientId: S(), nom: S(), mode: S({ enum: MODES_PROGRAMME }), debut: S({ date: true }),
    nbSemaines: N({ optionnel: true, min: 1 }), workouts: A({ optionnel: true }), semaines: A({ optionnel: true }), joursFixes: O({ optionnel: true })
  }, p, (o, msg) => {
    if (o.mode === 'repete' && !o.workouts) msg('workouts', 'est obligatoire en mode « repete »')
    if (o.mode === 'parSemaine' && !o.semaines) msg('semaines', 'est obligatoire en mode « parSemaine »')
  })

export const validerRealisation = (r) =>
  valider('Réalisation', {
    id: S(), clientId: S(), workoutId: S(), date: S({ date: true }), semaine: S({ date: true }), valeurs: O(),
    dureeSec: N({ min: 0 }), volume: N({ min: 0 }), commentaire: S({ optionnel: true }), programmeId: S({ optionnel: true })
  }, r)

export const validerTemplateClient = (t) => valider('Template client', { id: S(), valeurs: O() }, t)

export const validerSeanceCoaching = (s) =>
  valider('Séance de coaching', {
    id: S(), clientId: S(), date: S({ date: true }), heure: S(), lieu: S({ enum: LIEUX }), statut: S({ enum: STATUTS_SEANCE }), tarif: N({ min: 0 })
  }, s, (o, msg) => { if (!/^\d{2}:\d{2}$/.test(o.heure)) msg('heure', 'doit être au format HH:MM') })

export const validerMotDuCoach = (m) => valider('Mot du coach', { id: S(), clientId: S(), texte: S(), date: S({ date: true }) }, m)

export const validerQuestionnaire = (q) =>
  valider('Questionnaire', { id: S(), nom: S(), frequence: S({ enum: FREQUENCES }), clientId: S({ optionnel: true }), questions: A() }, q, (o, msg) => {
    o.questions.forEach((qu, i) => {
      if (!qu.cle || !qu.libelle) msg(`questions[${i}]`, 'doit avoir « cle » et « libelle »')
      else if (!TYPES_QUESTION.includes(qu.type)) msg(`questions[${i}].type`, `doit valoir l'une de ces valeurs : ${TYPES_QUESTION.join(', ')}`)
    })
  })

export const validerReponse = (r) =>
  valider('Réponse', { id: S(), clientId: S(), questionnaireId: S(), frequence: S({ enum: FREQUENCES }), date: S({ date: true }), valeurs: O() }, r)

export const validerMesure = (m) =>
  valider('Mesure', { id: S(), clientId: S(), date: S({ date: true }), poids: N({ optionnel: true, min: 0 }), mensurations: O({ optionnel: true }) }, m)

export const validerDouleur = (d) =>
  valider('Douleur', { id: S(), clientId: S(), zone: S(), intensite: N({ min: 0, max: 10 }), date: S({ date: true }) }, d)

export const validerEntreeNutrition = (e) =>
  valider('Entrée nutrition', { id: S(), clientId: S(), date: S({ date: true }), type: S({ enum: TYPES_NUTRITION }) }, e)

export const validerAlerteVue = (a) => valider('Alerte vue', { id: S(), clientId: S(), vueLe: N() }, a)
