// Import MyPTHub, étape 1 (sur le PC) : export brut -> JSON normalisé au format de l'app (voir importer.js).
// Fonctions pures : aucune lecture de fichier, aucune date « maintenant » (la date de référence est celle de l'export).
// Les formes de l'API MyPTHub ne sont pas documentées : la lecture est tolérante (plusieurs noms de champs possibles)
// et tout champ rencontré mais non converti est compté dans le rapport (noms de champs seulement, jamais de valeurs).
import { secondes } from '../util.js'

export const JOURS_INACTIF = 30
// Données de paiement : jamais importées (retirées avant toute lecture).
const estPaiement = (k) => /stripe|payment|billing|iban|invoice|last_?four/i.test(k) || /(^|_)[Cc]ards?(_|$|[A-Z])/.test(k)
// Champs techniques ignorés sans être signalés.
const TECHNIQUES = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'createdAt', 'updatedAt', 'uuid', 'order', 'position', 'sort', 'sort_order', 'customer_id', 'contact_id', 'trainer_id', 'user_id', 'workout_id', 'exercise_id', 'pivot', 'links', 'meta', 'image', 'thumbnail', 'thumb', 'video', 'video_url', 'media', 'icon', 'avatar', 'photo_url'])

// --- Outils ------------------------------------------------------------------------------------------------------
/** Copie sans aucune clé de paiement (à toute profondeur) ; `retires` compte les noms retirés. */
export function sansPaiement(v, retires = {}) {
  if (Array.isArray(v)) return v.map((x) => sansPaiement(x, retires))
  if (!v || typeof v !== 'object') return v
  const out = {}
  for (const [k, x] of Object.entries(v)) {
    if (estPaiement(k)) { retires[k] = (retires[k] || 0) + 1; continue }
    out[k] = sansPaiement(x, retires)
  }
  return out
}

const texte = (v) => (typeof v === 'string' ? v.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim() : typeof v === 'number' ? String(v) : '')
const premier = (o, cles) => { for (const k of cles) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return undefined }
const nombre = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'))
  return undefined
}
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n

/** Date tolérante -> 'AAAA-MM-JJ' (ISO, « AAAA-MM-JJ HH:MM:SS », JJ/MM/AAAA, timestamp s ou ms) ; null si illisible. */
export function jourDe(v) {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'object') return jourDe(v.date ?? v.datetime)
  if (typeof v === 'number' || /^\d{9,13}$/.test(String(v))) {
    const n = Number(v)
    const d = new Date(n < 1e11 ? n * 1000 : n)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
const ecartJours = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
const lundiDe = (j) => { const d = new Date(`${j}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const jourSemaine = (j) => (new Date(`${j}T00:00:00Z`).getUTCDay() + 6) % 7

/** Données « utiles » d'une réponse d'API : déballe { data: … } (pagination Laravel, ressources). */
const deballer = (v) => {
  let x = v
  for (let i = 0; i < 3 && x && typeof x === 'object' && !Array.isArray(x) && 'data' in x && Object.keys(x).every((k) => ['data', 'meta', 'links', 'message', 'success', 'status'].includes(k)); i++) x = x.data
  return x
}
/** Première liste d'objets trouvée (la valeur elle-même, ou une clé parmi `cles`, ou la seule liste de l'objet). */
function liste(v, cles = []) {
  const x = deballer(v)
  if (Array.isArray(x)) return x.filter((e) => e && typeof e === 'object')
  if (!x || typeof x !== 'object') return []
  for (const k of cles) if (Array.isArray(deballer(x[k]))) return liste(x[k])
  const listes = Object.values(x).map(deballer).filter((y) => Array.isArray(y) && y.some((e) => e && typeof e === 'object'))
  return listes.length === 1 ? listes[0].filter((e) => e && typeof e === 'object') : []
}

/** Réponse d'API d'un client dont le chemin vérifie `test` (regex) ; renvoie la première trouvée. */
const apiDe = (brut, test) => { for (const [chemin, v] of Object.entries(brut?.api || {})) if (test.test(chemin)) return { chemin, v: deballer(v) }; return null }

// Rapport : champs non convertis, par « famille » (ex. workout.exercises[].tempo) -> nombre d'occurrences.
function nonConvertis(rapport, famille, obj, utilises) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return
  for (const k of Object.keys(obj)) {
    if (utilises.includes(k) || TECHNIQUES.has(k)) continue
    const v = obj[k]
    if (v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    rapport[`${famille}.${k}`] = (rapport[`${famille}.${k}`] || 0) + 1
  }
}

// --- Profil -----------------------------------------------------------------------------------------------------
const SEXES = { m: 'homme', male: 'homme', man: 'homme', homme: 'homme', f: 'femme', female: 'femme', woman: 'femme', femme: 'femme' }

function profilDe(contact, brut, rapport) {
  const fiche = apiDe(brut, /\/v4\/customers\/\d+$/)?.v || {}
  const c5 = apiDe(brut, /\/v5\/contacts\/\d+$/)?.v || {}
  const prenom = texte(premier(contact, ['first_name']) ?? premier(fiche, ['first_name']))
  const nomFamille = texte(premier(contact, ['last_name']) ?? premier(fiche, ['last_name']))
  const nom = texte(premier(contact, ['full_name'])) || [prenom, nomFamille].filter(Boolean).join(' ') || texte(fiche.name)
  const tel = premier(fiche, ['phone', 'mobile', 'phone_number', 'mobile_number', 'telephone', 'tel']) ?? premier(c5, ['phone', 'mobile', 'phone_number'])
  const sexe = String(premier(contact, ['gender']) ?? premier(fiche, ['gender', 'sex']) ?? '').toLowerCase()
  const adresse = ['address', 'address_1', 'address_line_1', 'address_2', 'city', 'postcode', 'zip', 'country'].map((k) => texte(fiche[k])).filter(Boolean).join(', ')
  nonConvertis(rapport, 'customer', fiche, ['first_name', 'last_name', 'name', 'full_name', 'email', 'phone', 'mobile', 'phone_number', 'mobile_number', 'telephone', 'tel', 'gender', 'sex', 'dob', 'date_of_birth', 'birthday', 'address', 'address_1', 'address_line_1', 'address_2', 'city', 'postcode', 'zip', 'country', 'last_seen', 'active', 'disabled'])
  const out = {
    nom, prenom, nomFamille,
    email: texte(premier(contact, ['email']) ?? fiche.email).toLowerCase() || null,
    telephone: texte(tel) || null,
    dateNaissance: jourDe(premier(contact, ['dob']) ?? premier(fiche, ['dob', 'date_of_birth', 'birthday'])),
    sexe: SEXES[sexe] || (sexe || null),
    adresse: adresse || null,
    objectifs: objectifsDe(c5, brut)
  }
  return out
}

function objectifsDe(c5, brut) {
  const goals = c5.goals ?? apiDe(brut, /goals/)?.v
  const l = Array.isArray(goals) ? goals : liste(goals, ['goals'])
  const vus = (Array.isArray(goals) ? goals : l).map((g) => (typeof g === 'string' ? g : texte(premier(g, ['name', 'title', 'goal', 'label', 'description', 'text'])))).filter(Boolean)
  if (!vus.length && typeof goals === 'string') vus.push(texte(goals))
  return vus
}

// --- Mesures ----------------------------------------------------------------------------------------------------
const ZONES = { waist: 'tourDeTaille', hips: 'tourDeHanches', hip: 'tourDeHanches', chest: 'tourDePoitrine', arm: 'tourDeBras', arms: 'tourDeBras', bicep: 'tourDeBras', biceps: 'tourDeBras', thigh: 'tourDeCuisse', thighs: 'tourDeCuisse', calf: 'tourDeMollet', calves: 'tourDeMollet', neck: 'tourDeCou', shoulders: 'tourDEpaules', shoulder: 'tourDEpaules', forearm: 'tourDAvantBras', abdomen: 'tourDAbdomen', stomach: 'tourDAbdomen', belly: 'tourDAbdomen', glutes: 'tourDeFessiers', bust: 'tourDePoitrine', wrist: 'tourDePoignet' }
const COTES = { l: 'Gauche', left: 'Gauche', r: 'Droit', right: 'Droit' }
/** circ_arm_l -> tourDeBrasGauche ; circ_waist -> tourDeTaille ; zone inconnue -> tourDe<Zone>. */
export function cleMensuration(champ) {
  const m = champ.match(/^circ(?:umference)?_([a-z_]+?)(?:_(l|r|left|right))?$/i)
  if (!m) return null
  const zone = m[1].toLowerCase()
  const base = ZONES[zone] || `tourDe${zone.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())}`
  return base + (m[2] ? COTES[m[2].toLowerCase()] : '')
}
// Valeurs de bilan (hors poids et tours) : clé MyPTHub (regex) -> clé de l'app + libellé.
export const BILAN = [
  { re: /^height(_cm)?$/i, cle: 'taille', libelle: 'Taille (cm)' },
  { re: /body_?fat|fat_?perc|^bf$/i, cle: 'masseGrasse', libelle: 'Masse grasse (%)' },
  { re: /^(blood_?pressure|bp)$/i, cle: 'tension', libelle: 'Tension artérielle' },
  { re: /systolic/i, cle: 'tensionSystolique', libelle: 'Tension systolique (mmHg)' },
  { re: /diastolic/i, cle: 'tensionDiastolique', libelle: 'Tension diastolique (mmHg)' },
  { re: /rest(ing)?_?(heart_?rate|hr|pulse)|^rhr$/i, cle: 'fcRepos', libelle: 'FC au repos (bpm)' },
  { re: /muscle_?mass/i, cle: 'masseMusculaire', libelle: 'Masse musculaire' },
  { re: /visceral/i, cle: 'graisseViscerale', libelle: 'Graisse viscérale' },
  { re: /^bmi$/i, cle: 'imc', libelle: 'IMC' },
  { re: /water/i, cle: 'eau', libelle: 'Eau corporelle (%)' }
]

function mesuresDe(brut, rapport) {
  const r = apiDe(brut, /metrics/)
  const lignes = r ? liste(r.v, ['customer_metrics', 'metrics', 'items']) : []
  const parJour = new Map() // une mesure par jour (règle de l'app) ; deux lignes le même jour -> fusion
  const bilans = new Map()
  for (const l of lignes) {
    const date = jourDe(premier(l, ['date', 'recorded_at', 'measured_at', 'created_at']))
    if (!date) { rapport['metrics.(sans date)'] = (rapport['metrics.(sans date)'] || 0) + 1; continue }
    const m = parJour.get(date) || { date }
    const b = bilans.get(date) || { date, valeurs: {} }
    const utilises = ['date', 'recorded_at', 'measured_at', 'created_at']
    const unite = String(premier(l, ['weight_unit', 'unit', 'units']) ?? '').toLowerCase()
    if (unite) utilises.push('weight_unit', 'unit', 'units')
    for (const [k, v] of Object.entries(l)) {
      if (/^weight(_kg)?$/i.test(k) && nombre(v) !== undefined) {
        m.poids = arrondi(/lb/.test(unite) ? nombre(v) * 0.45359237 : nombre(v), 1); utilises.push(k); continue
      }
      const zone = cleMensuration(k)
      if (zone && nombre(v) !== undefined) { (m.mensurations ||= {})[zone] = nombre(v); utilises.push(k); continue }
      const bi = BILAN.find((x) => x.re.test(k))
      if (bi && (nombre(v) !== undefined || (typeof v === 'string' && v.trim()))) { b.valeurs[bi.cle] = nombre(v) ?? v.trim(); utilises.push(k) }
    }
    nonConvertis(rapport, 'metrics', l, utilises)
    if (m.poids !== undefined || m.mensurations) parJour.set(date, m)
    if (Object.keys(b.valeurs).length) bilans.set(date, b)
  }
  const tri = (a, b) => a.date.localeCompare(b.date)
  return { mesures: [...parJour.values()].sort(tri), bilans: [...bilans.values()].sort(tri), source: !!r }
}

// --- PAR-Q -------------------------------------------------------------------------------------------------------
// Questions du PAR-Q standard (et quelques ajouts fréquents) : mots-clés anglais -> libellé français.
const PARQ_FR = [
  [/heart condition.*(recommended|doctor)|doctor.*heart condition.*physical activity/i, 'Un médecin vous a-t-il déjà dit que vous aviez un problème cardiaque et que vous ne deviez pratiquer qu\'une activité physique recommandée par un médecin ?'],
  [/past month.*chest pain|chest pain.*(not|when you were not).*physical/i, 'Au cours du dernier mois, avez-vous ressenti une douleur à la poitrine en dehors d\'une activité physique ?'],
  [/pain in (your )?chest.*physical activity|chest pain.*physical activity/i, 'Ressentez-vous une douleur à la poitrine lors d\'une activité physique ?'],
  [/balance|dizziness|consciousness/i, 'Perdez-vous l\'équilibre à cause d\'étourdissements, ou avez-vous déjà perdu connaissance ?'],
  [/bone|joint/i, 'Avez-vous un problème osseux ou articulaire qui pourrait être aggravé par un changement de votre activité physique ?'],
  [/(drugs|medication|prescrib).*(blood pressure|heart)/i, 'Un médecin vous prescrit-il actuellement des médicaments pour la tension artérielle ou un problème cardiaque ?'],
  [/any other reason/i, 'Connaissez-vous une autre raison pour laquelle vous ne devriez pas pratiquer d\'activité physique ?'],
  [/pregnan/i, 'Êtes-vous enceinte ou avez-vous accouché récemment ?'],
  [/smok/i, 'Fumez-vous ?'],
  [/medication|medicine/i, 'Prenez-vous des médicaments ?'],
  [/injur/i, 'Avez-vous une blessure (actuelle ou passée) ?'],
  [/surgery|operation/i, 'Avez-vous été opéré(e) récemment ?'],
  [/diabet/i, 'Êtes-vous diabétique ?'],
  [/asthma/i, 'Êtes-vous asthmatique ?'],
  [/allerg/i, 'Avez-vous des allergies ?']
]
export const questionFr = (q) => PARQ_FR.find(([re]) => re.test(q))?.[1] || q
const reponseFr = (a) => {
  if (a === true || a === 1 || /^(yes|y|true|1|oui)$/i.test(String(a ?? '').trim())) return 'Oui'
  if (a === false || a === 0 || /^(no|n|false|0|non)$/i.test(String(a ?? '').trim())) return 'Non'
  return texte(typeof a === 'object' && a ? premier(a, ['answer', 'value', 'text']) : a)
}

function parqDe(brut, rapport) {
  const r = apiDe(brut, /parq/)
  if (!r) return { questions: [], allergies: [], date: null }
  const questions = []
  for (const q of liste(r.v, ['questions', 'parq', 'items'])) {
    const libelle = texte(premier(q, ['question', 'text', 'title', 'label', 'name']))
    if (!libelle) continue
    const brute = premier(q, ['answer', 'response', 'value', 'answer_text'])
    const detail = texte(premier(q, ['details', 'detail', 'notes', 'note', 'comment', 'explanation', 'answer_details']) ?? (brute && typeof brute === 'object' ? premier(brute, ['details', 'notes', 'comment']) : undefined))
    const rep = reponseFr(brute)
    questions.push({ question: questionFr(libelle), reponse: [rep || 'Sans réponse', detail].filter(Boolean).join(' — ') })
    nonConvertis(rapport, 'parq.questions[]', q, ['question', 'text', 'title', 'label', 'name', 'answer', 'response', 'value', 'answer_text', 'details', 'detail', 'notes', 'note', 'comment', 'explanation', 'answer_details', 'type', 'required', 'options'])
  }
  // Allergies et nutrition (nutrition_answers) : vers les notes du coach.
  const nut = r.v && typeof r.v === 'object' && !Array.isArray(r.v) ? deballer(r.v.nutrition_answers) : null
  const allergies = []
  const lignesNut = Array.isArray(nut) ? nut : nut && typeof nut === 'object' ? Object.entries(nut).map(([k, v]) => ({ question: k, answer: v })) : []
  for (const x of lignesNut) {
    const q = texte(premier(x, ['question', 'text', 'title', 'label', 'name', 'key']))
    const a = x.answer ?? x.value ?? x.response
    const val = Array.isArray(a) ? a.map(texte).filter(Boolean).join(', ') : reponseFr(a)
    if (val && val !== 'Non') allergies.push(q ? `${questionFr(q.replace(/_/g, ' '))} ${val}` : val)
  }
  const date = jourDe(r.v && typeof r.v === 'object' ? premier(r.v, ['completed_at', 'updated_at', 'submitted_at', 'date']) : null)
  return { questions, allergies, date }
}

// --- Séances et programmes ---------------------------------------------------------------------------------------
const CLES_EXOS = ['exercises', 'workout_exercises', 'exercise_list', 'items', 'blocks', 'sections', 'groups', 'circuits', 'supersets']
const CLES_SERIES = ['sets', 'exercise_sets', 'set_details', 'set_data']
const nomExo = (e) => texte(premier(e, ['name', 'title', 'exercise_name']) ?? premier(e.exercise || {}, ['name', 'title']))
const consignesDe = (o) => texte(premier(o, ['notes', 'note', 'instructions', 'description', 'comment', 'comments', 'trainer_notes']) ?? premier(o.exercise || {}, ['instructions']))

/** Une série MyPTHub -> série de l'app { reps | fourchetteReps, poids, tempsTravail, tempo, rpe }. */
function serieDe(s, rapport, famille) {
  const v = {}
  const reps = premier(s, ['reps', 'repetitions', 'target_reps', 'rep', 'value'])
  if (nombre(reps) !== undefined) v.reps = nombre(reps)
  else if (typeof reps === 'string' && reps.trim()) v.fourchetteReps = reps.trim()
  const poids = nombre(premier(s, ['weight', 'load', 'kg', 'target_weight']))
  if (poids !== undefined) v.poids = poids
  const t = premier(s, ['time', 'duration', 'seconds', 'target_time', 'work_time'])
  if (t !== undefined && secondes(t) !== null) v.tempsTravail = secondes(t)
  const tempo = premier(s, ['tempo'])
  if (tempo) v.tempo = String(tempo)
  const rpe = nombre(premier(s, ['rpe']))
  if (rpe !== undefined) v.rpe = rpe
  nonConvertis(rapport, famille, s, ['reps', 'repetitions', 'target_reps', 'rep', 'value', 'weight', 'load', 'kg', 'target_weight', 'time', 'duration', 'seconds', 'target_time', 'work_time', 'tempo', 'rpe', 'rest', 'rest_time', 'rest_seconds', 'rest_period', 'type', 'set_number', 'number', 'unit', 'weight_unit'])
  return v
}

/** Un exercice MyPTHub -> { nom, series[], repos?, consignes? } (format intermédiaire, nom au lieu d'id). */
function exerciceDe(e, rapport) {
  const nom = nomExo(e)
  if (!nom) return null
  const famille = 'workout.exercises[]'
  const sets = CLES_SERIES.map((k) => e[k]).find(Array.isArray)
  let series
  if (sets && sets.length) series = sets.map((s) => serieDe(s, rapport, `${famille}.sets[]`))
  else {
    const n = Math.max(1, Math.min(20, nombre(premier(e, ['sets', 'num_sets', 'set_count'])) ?? 1))
    series = Array.from({ length: n }, () => serieDe(e, {}, famille))
  }
  const reposBrut = premier(e, ['rest', 'rest_time', 'rest_seconds', 'rest_period']) ?? (sets && premier(sets[0] || {}, ['rest', 'rest_time', 'rest_seconds', 'rest_period']))
  const out = { nom, series }
  if (reposBrut !== undefined && secondes(reposBrut) !== null) out.repos = secondes(reposBrut)
  const c = consignesDe(e)
  if (c) out.consignes = c
  nonConvertis(rapport, famille, e, ['name', 'title', 'exercise_name', 'exercise', ...CLES_SERIES, 'sets', 'num_sets', 'set_count', 'reps', 'repetitions', 'target_reps', 'rep', 'value', 'weight', 'load', 'kg', 'target_weight', 'time', 'duration', 'seconds', 'target_time', 'work_time', 'tempo', 'rpe', 'rest', 'rest_time', 'rest_seconds', 'rest_period', 'notes', 'note', 'instructions', 'description', 'comment', 'comments', 'trainer_notes', 'superset', 'superset_id', 'group', 'group_id', 'superset_group', 'type', 'unit', 'weight_unit'])
  return out
}

/** Détail d'une séance MyPTHub -> { nom, consignes?, blocs[] } ; blocs { type:'exercice', … } ou { type:'superset', exercices[] }. */
export function seanceDe(w, rapport = {}) {
  const nom = texte(premier(w, ['name', 'title'])) || 'Séance MyPTHub'
  const blocs = []
  const entrees = CLES_EXOS.map((k) => w[k]).find(Array.isArray) || []
  // Regroupement par superset_id / group_id quand les exercices sont à plat.
  const groupes = new Map()
  for (const e of entrees) {
    const interne = CLES_EXOS.map((k) => e[k]).find(Array.isArray)
    if (interne) { // groupe / bloc contenant des exercices
      const exos = interne.map((x) => exerciceDe(x, rapport)).filter(Boolean)
      if (exos.length >= 2) {
        const repos = secondes(premier(e, ['rest', 'rest_time', 'rest_seconds']) ?? '')
        blocs.push({ type: 'superset', ...(repos !== null ? { repos } : {}), exercices: exos.map(({ repos: _, ...x }) => x) })
      } else if (exos.length === 1) blocs.push({ type: 'exercice', ...exos[0] })
      nonConvertis(rapport, 'workout.groups[]', e, [...CLES_EXOS, 'name', 'title', 'type', 'rest', 'rest_time', 'rest_seconds'])
      continue
    }
    const ex = exerciceDe(e, rapport)
    if (!ex) continue
    const g = premier(e, ['superset_id', 'group_id', 'superset_group', 'group', 'superset'])
    if (g !== undefined && g !== false && g !== 0 && typeof g !== 'object') {
      if (!groupes.has(g)) { groupes.set(g, { type: 'superset', exercices: [] }); blocs.push(groupes.get(g)) }
      groupes.get(g).exercices.push(ex)
    } else blocs.push({ type: 'exercice', ...ex })
  }
  // Un « superset » d'un seul exercice redevient un exercice simple.
  const final = blocs.map((b) => {
    if (b.type !== 'superset' || b.exercices.length >= 2) {
      if (b.type === 'superset' && b.repos === undefined) {
        const r = b.exercices.map((x) => x.repos).filter((x) => x !== undefined).pop()
        b.exercices = b.exercices.map(({ repos: _, ...x }) => x)
        if (r !== undefined) b.repos = r
      }
      return b
    }
    return { type: 'exercice', ...b.exercices[0] }
  })
  nonConvertis(rapport, 'workout', w, ['name', 'title', ...CLES_EXOS, 'description', 'notes', 'instructions', 'duration', 'type', 'status', 'category', 'tags', 'trainer', 'customer', 'assigned_at', 'date', 'scheduled_at', 'is_template'])
  const consignes = texte(premier(w, ['description', 'notes', 'instructions']))
  return { nom, ...(consignes ? { consignes } : {}), blocs: final }
}

/** Programmes (scheduler/current) : chaque schedule -> { sourceId, nom, debut (lundi), semaines[[sourceId]], joursFixes, termine }. */
function programmesDe(brut, exporteLe, rapport) {
  const r = apiDe(brut, /scheduler/)
  if (!r) return []
  const schedules = liste(r.v, ['schedules', 'schedule', 'programs', 'programmes'])
  const out = []
  for (const [i, s] of schedules.entries()) {
    const debutBrut = jourDe(premier(s, ['start_date', 'starts_at', 'start', 'date_start']))
    const fin = jourDe(premier(s, ['end_date', 'ends_at', 'end', 'date_end']))
    const items = liste(premier(s, ['workouts', 'items', 'days', 'schedule_workouts', 'events']) ?? s, ['workouts', 'items', 'days', 'events'])
    const places = []
    for (const it of items) {
      const wid = premier(it, ['workout_id']) ?? it.workout?.id ?? premier(it, ['id'])
      if (wid === undefined) continue
      const date = jourDe(premier(it, ['date', 'scheduled_at', 'day_date']))
      const semaine = nombre(premier(it, ['week', 'week_number']))
      const jour = nombre(premier(it, ['day', 'day_of_week', 'weekday']))
      places.push({ wid: String(wid), date, semaine, jour, detail: it.workout && typeof it.workout === 'object' ? it.workout : null })
      nonConvertis(rapport, 'scheduler.items[]', it, ['workout_id', 'workout', 'date', 'scheduled_at', 'day_date', 'week', 'week_number', 'day', 'day_of_week', 'weekday', 'name', 'title', 'status', 'completed', 'completed_at'])
    }
    if (!places.length) continue
    const premiereDate = places.map((p) => p.date).filter(Boolean).sort()[0]
    const debut = lundiDe(debutBrut || premiereDate || exporteLe)
    const semaines = [[]]
    const joursFixes = {}
    for (const p of places) {
      let n = 1
      let j = null
      if (p.date) { n = Math.floor(ecartJours(debut, p.date) / 7) + 1; j = jourSemaine(p.date) } else {
        if (p.semaine !== undefined) n = Math.max(1, p.semaine)
        // day : 1-7 (lundi = 1) le plus souvent ; 0 traité comme dimanche si présent avec 7 absents.
        if (p.jour !== undefined) j = p.jour >= 1 && p.jour <= 7 ? p.jour - 1 : p.jour === 0 ? 6 : null
      }
      if (n < 1) n = 1
      while (semaines.length < n) semaines.push([])
      if (!semaines[n - 1].includes(p.wid)) semaines[n - 1].push(p.wid)
      if (j !== null && joursFixes[p.wid] === undefined) joursFixes[p.wid] = j
    }
    nonConvertis(rapport, 'scheduler.schedules[]', s, ['name', 'title', 'start_date', 'starts_at', 'start', 'date_start', 'end_date', 'ends_at', 'end', 'date_end', 'workouts', 'items', 'days', 'schedule_workouts', 'events', 'status', 'active', 'description', 'weeks', 'duration'])
    out.push({
      sourceId: String(s.id ?? i), nom: texte(premier(s, ['name', 'title'])) || 'Programme MyPTHub', debut, ...(fin ? { fin } : {}),
      semaines, joursFixes, termine: !!(fin && fin < exporteLe),
      details: places.filter((p) => p.detail).map((p) => [p.wid, p.detail])
    })
  }
  return out
}

// --- Notes et résumé -----------------------------------------------------------------------------------------------
function notesMyPTHub(brut) {
  const r = apiDe(brut, /\/notes/)
  if (!r) return []
  const l = liste(r.v, ['notes'])
  return l.map((n) => ({ date: jourDe(premier(n, ['date', 'created_at', 'updated_at'])), texte: texte(premier(n, ['note', 'text', 'content', 'body', 'description', 'message'])) })).filter((n) => n.texte)
}

function activitesDe(brut) {
  const r = apiDe(brut, /activity_log/)
  return r ? liste(r.v, ['activity_log', 'activities', 'logs']).map((a) => ({ date: jourDe(premier(a, ['date', 'created_at', 'logged_at'])), texte: texte(premier(a, ['description', 'message', 'activity', 'title', 'name', 'type'])) })).filter((a) => a.texte) : []
}

function photosDe(brut) {
  const r = apiDe(brut, /photo/)
  let dates = []
  let n = 0
  if (r) { const l = liste(r.v, ['photos', 'progress_photos', 'items']); n = l.length; dates = l.map((p) => jourDe(premier(p, ['date', 'taken_at', 'created_at']))).filter(Boolean) }
  const t = brut?.textes?.['progress-photos']?.texte
  if (!n && typeof t === 'string') { // secours : dates lisibles dans le texte de l'écran
    dates = [...t.matchAll(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4})\b/g)].map((m) => jourDe(m[1])).filter(Boolean)
    n = dates.length
  }
  dates.sort()
  return { nombre: n, premiere: dates[0] || null, derniere: dates.at(-1) || null }
}

const dateFr = (j) => (j ? `${j.slice(8, 10)}/${j.slice(5, 7)}/${j.slice(0, 4)}` : '?')
export const MARQUEUR_NOTES = '— Import MyPTHub'

function composerNotes({ exporteLe, notes, objectifs, allergies, photos, activites, derniereConnexion, textesSecours }) {
  const l = [`${MARQUEUR_NOTES} (export du ${dateFr(exporteLe)}) —`]
  if (objectifs.length) l.push('', 'Objectifs :', ...objectifs.map((o) => `- ${o}`))
  if (allergies.length) l.push('', 'Allergies / nutrition :', ...allergies.map((a) => `- ${a}`))
  if (notes.length) l.push('', 'Notes MyPTHub :', ...notes.map((n) => `- ${n.date ? `[${dateFr(n.date)}] ` : ''}${n.texte}`))
  l.push('', `Dernière connexion MyPTHub : ${derniereConnexion ? dateFr(derniereConnexion) : 'inconnue'}`)
  l.push(`Photos de progression (non importées) : ${photos.nombre}${photos.nombre ? ` (du ${dateFr(photos.premiere)} au ${dateFr(photos.derniere)})` : ''}`)
  if (activites.length) l.push('', 'Dernières activités :', ...activites.slice(0, 10).map((a) => `- ${a.date ? `[${dateFr(a.date)}] ` : ''}${a.texte}`))
  for (const [rubrique, t] of textesSecours) l.push('', `Écran MyPTHub « ${rubrique} » (texte copié tel quel) :`, t)
  return l.join('\n').slice(0, 20000)
}

// --- Point d'entrée ------------------------------------------------------------------------------------------------
/**
 * @param {object} exportBrut forme : { exporte_le, contacts[], clients{contactId:{api, textes}}, workouts{id: json}, erreurs[] }
 * @returns {{ version, exporteLe, clients[], rapport }}
 */
export function normaliser(exportBrut) {
  const paiementRetire = {}
  const brut = sansPaiement(exportBrut, paiementRetire)
  const exporteLe = jourDe(brut.exporte_le) || '1970-01-01'
  const champs = {}
  const rapportClients = []
  const clients = []
  const workouts = brut.workouts || {}
  for (const [i, contact] of (brut.contacts || []).entries()) {
    const cid = String(contact.id)
    const donnees = brut.clients?.[cid] || brut.clients?.[contact.customer_id] || { api: {}, textes: {} }
    const profil = profilDe(contact, donnees, champs)
    const derniereConnexion = jourDe(contact.last_seen)
    const archive = !!contact.disabled || contact.active === false || !derniereConnexion || ecartJours(derniereConnexion, exporteLe) > JOURS_INACTIF
    const { mesures, bilans, source: mesuresApi } = mesuresDe(donnees, champs)
    const parq = parqDe(donnees, champs)
    // Séances assignées : liste du client + détail dans export.workouts (sinon la ligne de la liste elle-même).
    const assignees = liste(apiDe(donnees, /\/workouts$/)?.v, ['workouts'])
    const programmes = programmesDe(donnees, exporteLe, champs)
    const ids = new Set(assignees.map((w) => String(w.id ?? w.workout_id)).filter((x) => x !== 'undefined'))
    for (const p of programmes) for (const s of p.semaines) for (const w of s) ids.add(w)
    const detailsProg = new Map(programmes.flatMap((p) => p.details))
    const seances = []
    for (const id of ids) {
      const detail = workouts[id] ? deballer(workouts[id]) : detailsProg.get(id) || assignees.find((w) => String(w.id ?? w.workout_id) === id)
      if (!detail) continue
      const s = seanceDe(detail, champs)
      seances.push({ sourceId: id, ...s })
    }
    const connues = new Set(seances.map((s) => s.sourceId))
    for (const p of programmes) { p.semaines = p.semaines.map((s) => s.filter((w) => connues.has(w))); delete p.details; for (const w of Object.keys(p.joursFixes)) if (!connues.has(w)) delete p.joursFixes[w] }
    // Rubriques texte en secours quand l'API correspondante manque.
    const textes = donnees.textes || {}
    const secours = []
    const aApi = { 'weight-circumference': mesuresApi, 'body-fat': mesuresApi, 'vital-stats': mesuresApi, 'goals-interests': profil.objectifs.length > 0 }
    for (const [rubrique, t] of Object.entries(textes)) {
      if (rubrique === 'progress-photos' || aApi[rubrique]) continue
      const contenu = texte(t?.texte)
      if (contenu) secours.push([rubrique, contenu.slice(0, 4000)])
    }
    const photos = photosDe(donnees)
    const notesCoach = composerNotes({ exporteLe, notes: notesMyPTHub(donnees), objectifs: profil.objectifs, allergies: parq.allergies, photos, activites: activitesDe(donnees), derniereConnexion, textesSecours: secours })
    clients.push({
      source: { mypthub_contact_id: cid, customer_id: contact.customer_id != null ? String(contact.customer_id) : null },
      profil, archive, derniereConnexion, mesures, bilans,
      parq: { date: parq.date || exporteLe, questions: parq.questions },
      notesCoach, seances, programmes
    })
    rapportClients.push({
      client: `client-${String(i + 1).padStart(2, '0')}`, contactId: cid, archive,
      mesures: mesures.length, bilans: bilans.length, parq: parq.questions.length, seances: seances.length,
      exercices: seances.reduce((n, s) => n + s.blocs.reduce((m, b) => m + (b.type === 'superset' ? b.exercices.length : 1), 0), 0),
      programmes: programmes.length, photos: photos.nombre, textesSecours: secours.map(([r]) => r),
      manque: [!profil.nom && 'nom', !profil.email && 'email'].filter(Boolean)
    })
  }
  return {
    version: 1, exporteLe, clients,
    rapport: { clients: rapportClients, champsNonConvertis: champs, paiementRetire, erreursExport: (brut.erreurs || []).length }
  }
}
