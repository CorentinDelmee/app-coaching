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

/** Réponses d'API d'un client dont le chemin (sans « ?… » ni « &… ») vérifie `test` ; les réponses { error } sont écartées. */
const apisDe = (brut, test) => Object.entries(brut?.api || {})
  .filter(([chemin, v]) => test.test(chemin.split(/[?&]/)[0]) && !(v && typeof v === 'object' && v.error && Object.keys(v).length === 1))
  .map(([chemin, v]) => ({ chemin, v: deballer(v) }))
const apiDe = (brut, test) => apisDe(brut, test)[0] || null

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

// Formes réelles (export du 2026-11-05) : /v4/customers/N -> { customer: { telephone, address1…, injuries, description, user: { email, dob, gender } } }
// et /v5/contacts/N -> { contact: { goals (texte), telephone, description } }.
function profilDe(contact, brut, rapport) {
  const c4 = apiDe(brut, /\/v4\/customers\/\d+$/)?.v || {}
  const client4 = c4.customer && typeof c4.customer === 'object' ? c4.customer : c4
  const fiche = { ...(client4.user && typeof client4.user === 'object' ? client4.user : {}), ...client4 }
  const c5brut = apiDe(brut, /\/v5\/contacts\/\d+$/)?.v || {}
  const c5 = c5brut.contact && typeof c5brut.contact === 'object' ? c5brut.contact : c5brut
  const prenom = texte(premier(contact, ['first_name']) ?? premier(fiche, ['first_name']))
  const nomFamille = texte(premier(contact, ['last_name']) ?? premier(fiche, ['last_name']))
  const nom = texte(premier(contact, ['full_name'])) || [prenom, nomFamille].filter(Boolean).join(' ') || texte(fiche.name)
  const tel = premier(fiche, ['phone', 'mobile', 'phone_number', 'mobile_number', 'telephone', 'tel']) ?? premier(c5, ['phone', 'mobile', 'phone_number'])
  const sexe = String(premier(contact, ['gender']) ?? premier(fiche, ['gender', 'sex']) ?? '').toLowerCase()
  const ADRESSE = ['address', 'address1', 'address_1', 'address_line_1', 'address2', 'address_2', 'town_city', 'city', 'county', 'postcode', 'zip']
  const adresse = ADRESSE.map((k) => texte(fiche[k])).filter(Boolean).join(', ')
  // Réglages, comptes et liens techniques de MyPTHub : sans objet dans l'app (ignorés sans être signalés).
  const SANS_OBJET = ['user', 'source', 'timezone', 'time_display', 'date_display', 'enabled', 'demo', 'frozen', 'type', 'email_status', 'unread_messages', 'emails_unsubscribed', 'level', 'is_activated', 'idea_marketing', 'archon_active', 'trainer_user_id', 'country', 'files', 'package_purchases', 'uploaded_files', 'starred_files', 'trainer', 'is_provisioned_as_merchant_customer', 'bodyweight_display_units', 'distance_display_units', 'length_display_units', 'weight_display_units', 'height_display_units', 'separator_display_units', 'deleted_by', 'member_id', 'company_id', 'club_id', 'photo', 'initials', 'trainer_name', 'invited_at', 'unseen_logged_sessions_count', 'unseen_logged_nutrition_count', 'unseen_metrics_count', 'unseen_progress_photos_count', 'unseen_form_count', 'active_purchases', 'preferred_am_hour', 'preferred_am_minute', 'preferred_pm_hour', 'preferred_pm_minute']
  const UTILISES = ['first_name', 'last_name', 'name', 'full_name', 'email', 'phone', 'mobile', 'phone_number', 'mobile_number', 'telephone', 'tel', 'gender', 'sex', 'dob', 'date_of_birth', 'birthday', ...ADRESSE, 'last_seen', 'active', 'disabled', 'injuries', 'description', 'height', 'goals', 'exercise_plan', 'body_type', 'exercise_habit', ...SANS_OBJET]
  nonConvertis(rapport, 'customer', fiche, UTILISES)
  nonConvertis(rapport, 'contact', c5, UTILISES)
  // Texte libre du profil MyPTHub (vers les notes du coach).
  const infos = [
    ['Blessures', texte(fiche.injuries)], ['Description', texte(fiche.description) || texte(c5.description)],
    ['Programme d\'exercice', texte(fiche.exercise_plan)], ['Morphologie', texte(fiche.body_type)], ['Habitudes sportives', texte(fiche.exercise_habit)],
    ['Taille (profil)', nombre(fiche.height) ? `${nombre(fiche.height)} cm` : '']
  ].filter(([, v]) => v)
  const out = {
    nom, prenom, nomFamille,
    email: texte(premier(contact, ['email']) ?? fiche.email).toLowerCase() || null,
    telephone: texte(tel) || null,
    dateNaissance: jourDe(premier(contact, ['dob']) ?? premier(fiche, ['dob', 'date_of_birth', 'birthday'])),
    sexe: SEXES[sexe] || (sexe || null),
    adresse: adresse || null,
    objectifs: objectifsDe(c5.goals)
  }
  return { profil: out, infos }
}

/** goals : texte (forme réelle, une ligne par objectif) ou liste d'objets / de textes. */
function objectifsDe(goals) {
  if (typeof goals === 'string') return texte(goals).split(/\n+/).map((x) => x.trim()).filter(Boolean)
  if (!Array.isArray(goals)) return []
  return goals.map((g) => (typeof g === 'string' ? g : texte(premier(g, ['name', 'title', 'goal', 'label', 'description', 'text'])))).filter(Boolean)
}

// --- Mesures ----------------------------------------------------------------------------------------------------
const ZONES = { waist: 'tourDeTaille', hips: 'tourDeHanches', hip: 'tourDeHanches', chest: 'tourDePoitrine', arm: 'tourDeBras', arms: 'tourDeBras', bicep: 'tourDeBras', biceps: 'tourDeBras', thigh: 'tourDeCuisse', thighs: 'tourDeCuisse', calf: 'tourDeMollet', calves: 'tourDeMollet', neck: 'tourDeCou', shoulders: 'tourDEpaules', shoulder: 'tourDEpaules', forearm: 'tourDAvantBras', abdomen: 'tourDAbdomen', stomach: 'tourDAbdomen', belly: 'tourDAbdomen', glutes: 'tourDeFessiers', bust: 'tourDePoitrine', wrist: 'tourDePoignet' }
const COTES = { l: 'Gauche', left: 'Gauche', r: 'Droit', right: 'Droit' }
/** circ_arm_l -> tourDeBrasGauche ; circ_waist -> tourDeTaille ; zone inconnue -> tourDe<Zone>. */
export function cleMensuration(champ) {
  const m = champ.match(/^circ(?:umference)?_([a-z_]+?)(?:_(l|r|left|right))?$/i)
  if (!m || /^legacy$/i.test(m[1])) return null // circ_legacy : indicateur d'ancien format, pas un tour
  const zone = m[1].toLowerCase()
  const base = ZONES[zone] || `tourDe${zone.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())}`
  return base + (m[2] ? COTES[m[2].toLowerCase()] : '')
}
// Valeurs de bilan (hors poids et tours) : clé MyPTHub (regex) -> clé de l'app + libellé.
export const BILAN = [
  { re: /^height(_cm)?$/i, cle: 'taille', libelle: 'Taille (cm)' },
  { re: /fat_?percent_l$/i, cle: 'masseGrasseGauche', libelle: 'Masse grasse gauche (%)' },
  { re: /fat_?percent_r$/i, cle: 'masseGrasseDroite', libelle: 'Masse grasse droite (%)' },
  { re: /body_?fat|fat_?perc|^bf$/i, cle: 'masseGrasse', libelle: 'Masse grasse (%)' },
  { re: /^(blood_?pressure|bp)$/i, cle: 'tension', libelle: 'Tension artérielle' },
  { re: /systolic/i, cle: 'tensionSystolique', libelle: 'Tension systolique (mmHg)' },
  { re: /diastolic/i, cle: 'tensionDiastolique', libelle: 'Tension diastolique (mmHg)' },
  { re: /rest(ing)?_?(heart_?rate|hr|pulse)|^rhr$/i, cle: 'fcRepos', libelle: 'FC au repos (bpm)' },
  { re: /muscle_?mass/i, cle: 'masseMusculaire', libelle: 'Masse musculaire' },
  { re: /visceral/i, cle: 'graisseViscerale', libelle: 'Graisse viscérale' },
  { re: /^bmi$/i, cle: 'imc', libelle: 'IMC' },
  { re: /water/i, cle: 'eau', libelle: 'Eau corporelle (%)' },
  { re: /^note$/i, cle: 'note', libelle: 'Note' }
]

function mesuresDe(brut, rapport) {
  // Toutes les sources : /v5/…/metrics (une par type : bodyweight_circumference, body_fat, vital_stats ; 10 lignes par page),
  // /v4/…/metrics/latest ({ metrics }), et les « customermetric » du journal d'activité (rattrapent des pages non exportées).
  const reps = apisDe(brut, /metrics/)
  const r = reps[0] || null
  const lignes = reps.flatMap(({ v }) => (Array.isArray(v?.customer_metrics) ? v.customer_metrics : v?.metrics && typeof v.metrics === 'object' && !Array.isArray(v.metrics) ? [v.metrics] : liste(v, ['customer_metrics', 'metrics', 'items'])))
    .concat(activitesBrutes(brut).filter((a) => a.type === 'customermetric' && a.subject).map((a) => a.subject))
  const parJour = new Map() // une mesure par jour (règle de l'app) ; deux lignes le même jour -> fusion
  const bilans = new Map()
  for (const l of lignes) {
    const date = jourDe(premier(l, ['date', 'recorded_at', 'measured_at', 'created_at']))
    if (!date) { rapport['metrics.(sans date)'] = (rapport['metrics.(sans date)'] || 0) + 1; continue }
    const m = parJour.get(date) || { date }
    const b = bilans.get(date) || { date, valeurs: {} }
    // Première source lue = API (prioritaire) ; le journal ne fait que compléter.
    const utilises = ['date', 'recorded_at', 'measured_at', 'created_at', 'circ_legacy', 'skinfold_legacy']
    const unite = String(premier(l, ['weight_unit', 'unit', 'units']) ?? '').toLowerCase()
    if (unite) utilises.push('weight_unit', 'unit', 'units')
    for (const [k, v] of Object.entries(l)) {
      if (/^weight(_kg)?$/i.test(k) && nombre(v) !== undefined) {
        m.poids ??= arrondi(/lb/.test(unite) ? nombre(v) * 0.45359237 : nombre(v), 1); utilises.push(k); continue
      }
      const zone = cleMensuration(k)
      if (zone && nombre(v) !== undefined) { (m.mensurations ||= {})[zone] ??= nombre(v); utilises.push(k); continue }
      if (/^skinfold_/.test(k) && nombre(v) !== undefined) { b.valeurs[`pli_${k.slice(9)}`] ??= nombre(v); utilises.push(k); continue }
      const bi = BILAN.find((x) => x.re.test(k))
      if (bi && (nombre(v) !== undefined || (typeof v === 'string' && v.trim()))) { b.valeurs[bi.cle] ??= nombre(v) ?? v.trim(); utilises.push(k) }
    }
    nonConvertis(rapport, 'metrics', l, utilises)
    if (m.poids !== undefined || m.mensurations) parJour.set(date, m)
    if (Object.keys(b.valeurs).length) bilans.set(date, b)
  }
  const tri = (a, b) => a.date.localeCompare(b.date)
  return { mesures: [...parJour.values()].sort(tri), bilans: [...bilans.values()].sort(tri), source: !!r }
}

// --- PAR-Q -------------------------------------------------------------------------------------------------------
// Les 11 questions du PAR-Q de MyPTHub (texte exact de l'export réel), puis des mots-clés pour d'autres formulations.
const PARQ_EXACT = {
  'Do you have a heart condition, high blood pressure or circulatory problems?': 'Avez-vous un problème cardiaque, de l\'hypertension ou des problèmes de circulation ?',
  'Do you have diabetes?': 'Êtes-vous diabétique ?',
  'Do you suffer from epilepsy?': 'Souffrez-vous d\'épilepsie ?',
  'Do you ever experience pain in your chest when exercising or at rest?': 'Ressentez-vous parfois une douleur à la poitrine, à l\'effort ou au repos ?',
  'Do you ever feel faint or suffer from dizzy spells?': 'Vous arrive-t-il de vous sentir mal ou d\'avoir des vertiges ?',
  'Do you have back pain or joint conditions that could be exacerbated by exercise?': 'Avez-vous des douleurs de dos ou des problèmes articulaires que l\'exercice pourrait aggraver ?',
  'Do you have asthma?': 'Êtes-vous asthmatique ?',
  'Have you had any surgery in the past year that may affect your physical activity?': 'Avez-vous été opéré(e) au cours de l\'année passée d\'une façon qui pourrait gêner votre activité physique ?',
  'Are you aware of any other condition or injury that may give reason to modify your exercise programme?': 'Avez-vous connaissance d\'une autre affection ou blessure qui justifierait d\'adapter votre programme ?',
  'Are you taking any medication?': 'Prenez-vous des médicaments ?',
  'Are you pregnant? Or have you given birth in the past 6 weeks?': 'Êtes-vous enceinte, ou avez-vous accouché au cours des 6 dernières semaines ?'
}
const PARQ_FR = [
  [/heart condition.*(recommended|doctor)|doctor.*heart condition.*physical activity/i, 'Un médecin vous a-t-il déjà dit que vous aviez un problème cardiaque et que vous ne deviez pratiquer qu\'une activité physique recommandée par un médecin ?'],
  [/past month.*chest pain|chest pain.*(not|when you were not).*physical/i, 'Au cours du dernier mois, avez-vous ressenti une douleur à la poitrine en dehors d\'une activité physique ?'],
  [/pain in (your )?chest.*physical activity|chest pain.*physical activity/i, 'Ressentez-vous une douleur à la poitrine lors d\'une activité physique ?'],
  [/balance|dizziness|consciousness/i, 'Perdez-vous l\'équilibre à cause d\'étourdissements, ou avez-vous déjà perdu connaissance ?'],
  [/bone|joint/i, 'Avez-vous un problème osseux ou articulaire qui pourrait être aggravé par un changement de votre activité physique ?'],
  [/(drugs|medication|prescrib).*(blood pressure|heart)/i, 'Un médecin vous prescrit-il actuellement des médicaments pour la tension artérielle ou un problème cardiaque ?'],
  [/any other reason/i, 'Connaissez-vous une autre raison pour laquelle vous ne devriez pas pratiquer d\'activité physique ?']
]
export const questionFr = (q) => PARQ_EXACT[q.trim()] || PARQ_FR.find(([re]) => re.test(q))?.[1] || q
const reponseFr = (a) => {
  if (a === true || a === 1 || /^(yes|y|true|1|oui)$/i.test(String(a ?? '').trim())) return 'Oui'
  if (a === false || a === 0 || /^(no|n|false|0|non)$/i.test(String(a ?? '').trim())) return 'Non'
  return texte(typeof a === 'object' && a ? premier(a, ['answer', 'value', 'text']) : a)
}
const ALLERGIES = { milk: 'lait', eggs: 'œufs', fish: 'poisson', shellfish: 'crustacés', tree_nuts: 'fruits à coque', peanuts: 'arachides', wheat: 'blé', soybeans: 'soja', gluten: 'gluten' }

// Forme réelle : { questions: [{ question_text, answer: { yes: 0|1, additional_info } | null, for_gender }], nutrition_answers: { allergy_*: bool, allergy_other_notes, no_allergies }, injury_answers }
function parqDe(brut, rapport) {
  const r = apiDe(brut, /parq/)
  if (!r) return { questions: [], allergies: [], blessures: '', date: null }
  const questions = []
  const dates = []
  for (const q of liste(r.v, ['questions', 'parq', 'items'])) {
    const libelle = texte(premier(q, ['question_text', 'question', 'text', 'title', 'label', 'name']))
    if (!libelle) continue
    const a = q.answer
    if (a === null || a === undefined) continue // question non posée (ex. autre sexe) ou sans réponse
    const brute = a && typeof a === 'object' ? (a.yes ?? a.answer ?? a.value) : a
    const detail = texte(a && typeof a === 'object' ? premier(a, ['additional_info', 'details', 'notes', 'comment']) : premier(q, ['details', 'detail', 'notes', 'comment']))
    if (a && typeof a === 'object') dates.push(jourDe(a.updated_at ?? a.created_at))
    questions.push({ question: questionFr(libelle), reponse: [reponseFr(brute) || 'Sans réponse', detail].filter(Boolean).join(' — ') })
    nonConvertis(rapport, 'parq.questions[]', q, ['question_text', 'question', 'text', 'title', 'label', 'name', 'answer', 'help_text', 'has_additional_info', 'additional_info_required', 'for_gender', 'details', 'detail', 'notes', 'comment'])
    if (a && typeof a === 'object') nonConvertis(rapport, 'parq.questions[].answer', a, ['yes', 'answer', 'value', 'additional_info', 'details', 'notes', 'comment', 'parq_question_id'])
  }
  const nut = r.v && typeof r.v === 'object' && !Array.isArray(r.v) ? r.v.nutrition_answers : null
  const allergies = []
  if (nut && typeof nut === 'object') {
    for (const [k, v] of Object.entries(nut)) {
      const m = k.match(/^allergy_(.+)$/)
      if (m && m[1] !== 'other_notes' && v === true) allergies.push(ALLERGIES[m[1]] || m[1].replace(/_/g, ' '))
    }
    if (texte(nut.allergy_other_notes)) allergies.push(texte(nut.allergy_other_notes))
    if (!allergies.length && nut.no_allergies === true) allergies.push('aucune allergie déclarée')
    nonConvertis(rapport, 'parq.nutrition_answers', nut, [...Object.keys(nut).filter((k) => k.startsWith('allergy_')), 'no_allergies'])
  }
  const blessures = texte(r.v?.injury_answers)
  const date = dates.filter(Boolean).sort().at(-1) || null
  return { questions, allergies, blessures, date }
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
  if (Array.isArray(w.groups)) return seanceGroupes(w, rapport) // forme réelle de MyPTHub
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
  nonConvertis(rapport, 'workout', w, ['name', 'title', ...CLES_EXOS, 'description', 'notes', 'instructions', 'duration', 'type', 'status', 'category', 'tags', 'trainer', 'customer', 'assigned_at', 'date', 'scheduled_at', 'is_template',
    // Ligne de la liste des séances assignées (quand le détail manque) : réglages MyPTHub sans objet.
    'created_by', 'category_id', 'trainer_user_id', 'company_id', 'club_id', 'tag', 'enabled', 'archived', 'archived_original_id', 'new', 'note', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'day_6', 'day_7', 'deleted_by', 'library', 'private_workout_customer_id', 'private_workout_parent_id', 'ai_first_touch', 'assigned_via', 'metadata'])
  const consignes = texte(premier(w, ['description', 'notes', 'instructions']))
  return { nom, ...(consignes ? { consignes } : {}), blocs: final }
}


// --- Séances au format réel de MyPTHub (GET /v4/workouts/<id> -> { workout }) -----------------------------------------
// workout { title, note, metadata.description, groups[] } ; groupe { group_type: standalone | superset | giantset, exercises[] } ;
// exercice { exercise: { name, note, description, video_type, video_id }, meta: { type?, field_1…field_5 (type de colonne),
// field_N_label (unité), sets: [{ field_1…field_5 }] } }. Types de colonne vus : weight, bodyweight, reps, rep_range, time,
// rest_period, tempo, intensity, speed, distance, resistance, incline, kcals, split_times, amrap, state, n/a.
// `assigned_customers` (données des clients) n'est jamais lu.
const METHODES = { interval: 'intervalles', lsd: 'endurance longue (LSD)', fartlek: 'fartlek' }
const EXTRAS = { intensity: ['intensité', '%'], speed: ['vitesse', 'km/h'], distance: ['distance', 'km'], incline: ['inclinaison', '%'], kcals: ['objectif', 'kcal'], split_times: ['temps intermédiaire', 's'] }

/** rep_range « 8.12 » -> « 8-12 » ; « 5.08 » -> « 5-8 » ; « 7.80 » (7-8 formaté en décimal) -> « 7-8 ». */
export function fourchette(v) {
  const m = String(v).trim().match(/^(\d+)[.,-](\d+)$/)
  if (!m) return String(v).trim()
  const a = Number(m[1])
  let b = Number(m[2])
  if (b > a * 4 && m[2].endsWith('0')) b = Number(m[2].slice(0, -1))
  return `${a}-${b}`
}
const nombreFr = (x) => String(x).replace('.', ',')

function exerciceGroupe(e, rapport) {
  const ex = e.exercise && typeof e.exercise === 'object' ? e.exercise : {}
  const m = e.meta && typeof e.meta === 'object' ? e.meta : {}
  const nom = texte(ex.name)
  if (!nom) return null
  const types = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, m[`field_${n}`]]))
  const series = []
  const repos = []
  const extras = []
  for (const st of Array.isArray(m.sets) && m.sets.length ? m.sets : [{}]) {
    // Colonne « poids du corps » : vide dans l'export réel, elle indique seulement l'absence de charge.
    const s = Object.values(types).includes('bodyweight') ? { poidsDuCorps: true } : {}
    const plus = []
    for (const n of [1, 2, 3, 4, 5]) {
      const brut = st[`field_${n}`]
      if (brut === undefined || brut === null || brut === '') continue
      const type = types[n]
      const x = nombre(brut)
      if (type === 'weight' && x !== undefined) s.poids = x
      else if (type === 'bodyweight') { s.poidsDuCorps = true; if (x) s.poids = x }
      else if (type === 'reps' && x !== undefined) s.reps = x
      else if (type === 'rep_range') s.fourchetteReps = fourchette(brut)
      else if (type === 'amrap') { s.repsAuMax = true; if (x) plus.push(`AMRAP (objectif ${x})`) }
      else if (type === 'time' && x !== undefined) s.tempsTravail = x
      else if (type === 'rest_period' && x !== undefined) repos.push(x)
      else if (type === 'tempo') s.tempo = String(brut)
      else if (type === 'resistance' && x !== undefined) s.resistance = x
      else if (EXTRAS[type]) plus.push(`${EXTRAS[type][0]} ${nombreFr(brut)} ${m[`field_${n}_label`] || EXTRAS[type][1]}`)
      else rapport[`seance.sets.${type ?? `field_${n} (type absent)`}`] = (rapport[`seance.sets.${type ?? `field_${n} (type absent)`}`] || 0) + 1
    }
    series.push(s)
    extras.push(plus.join(', '))
  }
  const out = { nom, series }
  // Repos du bloc : la valeur la plus fréquente (MyPTHub la note série par série, presque toujours identique).
  if (repos.length) out.repos = [...repos].sort((a, b) => repos.filter((r) => r === b).length - repos.filter((r) => r === a).length)[0]
  const lignes = []
  if (METHODES[m.type]) lignes.push(`Méthode : ${METHODES[m.type]}.`)
  else if (m.type) rapport[`seance.meta.type.${m.type}`] = (rapport[`seance.meta.type.${m.type}`] || 0) + 1
  if (extras.some(Boolean)) lignes.push(new Set(extras).size === 1 ? `${extras[0]}.` : extras.map((x, i) => `Série ${i + 1} : ${x || '—'}`).join(' ; '))
  if (texte(ex.note)) lignes.push(texte(ex.note))
  if (lignes.length) out.consignes = lignes.join('\n')
  // Pour la bibliothèque (seulement si l'exercice est créé) : description et vidéo YouTube.
  if (texte(ex.description)) out.description = texte(ex.description).slice(0, 2000)
  if (ex.video_type === 'youtube' && /^[\w-]{6,20}$/.test(String(ex.video_id || ''))) out.video = `https://www.youtube.com/watch?v=${ex.video_id}`
  return out
}

/** Séance MyPTHub (forme réelle, avec groups) -> { nom, consignes?, blocs[] }. */
export function seanceGroupes(w, rapport = {}) {
  const blocs = []
  for (const g of w.groups) {
    const exos = (g.exercises || []).map((e) => exerciceGroupe(e, rapport)).filter(Boolean)
    if (!exos.length) continue
    if (exos.length === 1) { blocs.push({ type: 'exercice', ...exos[0] }); continue }
    // superset (2) et giantset (3 à 8) : exercices enchaînés, repos après le passage (celui du dernier exercice).
    const repos = exos.map((x) => x.repos).filter((x) => x !== undefined).pop()
    blocs.push({ type: 'superset', ...(repos !== undefined ? { repos } : {}), exercices: exos.map(({ repos: _, ...x }) => x) })
    if (!['superset', 'giantset', 'circuit'].includes(g.group_type)) rapport[`seance.group_type.${g.group_type}`] = (rapport[`seance.group_type.${g.group_type}`] || 0) + 1
  }
  const consignes = [texte(w.note), texte(w.metadata?.description)].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join('\n')
  return { nom: texte(w.title ?? w.name) || 'Séance MyPTHub', ...(consignes ? { consignes } : {}), blocs }
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
// Forme réelle : /v4/customers/N/notes -> { notes: [{ content, created_at, user (le coach), customer }] }.
function notesMyPTHub(brut) {
  const r = apiDe(brut, /\/notes$/)
  if (!r) return []
  const l = liste(r.v, ['notes'])
  return l.map((n) => ({ date: jourDe(premier(n, ['date', 'created_at', 'updated_at'])), texte: texte(premier(n, ['content', 'note', 'text', 'body', 'message'])) })).filter((n) => n.texte)
}

// Journal d'activité : plusieurs pages (/activity_log&…&current_page=P -> { activityLog: { data: [{ type, action, date, subject }] } }).
function activitesBrutes(brut) {
  const vues = new Set()
  const out = []
  for (const { v } of apisDe(brut, /activity_log$/)) {
    for (const a of liste(v?.activityLog ?? v, ['data', 'activity_log', 'activities', 'logs'])) {
      const cle = a.id ?? JSON.stringify(a)
      if (vues.has(cle)) continue
      vues.add(cle)
      out.push(a)
    }
  }
  return out.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
}

/** Une activité du journal en une ligne lisible (séance faite + ressenti du client, check-in, mesure, programme…). */
function activiteLisible(a) {
  const s = a.subject && typeof a.subject === 'object' ? a.subject : {}
  const date = jourDe(s.date_completed ?? a.date ?? s.date)
  const titre = texte(s.workout?.title ?? s.workout?.name ?? s.name)
  const libelle = {
    'session/completed': () => `Séance faite${titre ? ` : ${titre}` : ''}${s.time_elapsed ? ` (${Math.round(s.time_elapsed / 60)} min)` : ''}${texte(s.feedback) ? ` — ressenti : « ${texte(s.feedback)} »` : ''}`,
    'checkininstance/submitted': () => 'Check-in envoyé',
    'customermetric/updated': () => 'Mesures mises à jour',
    'schedule/started': () => `Programme commencé${titre ? ` : ${titre}` : ''}`,
    'schedule/ended': () => `Programme terminé${titre ? ` : ${titre}` : ''}`,
    'nutritionlogday/logged': () => 'Journal alimentaire rempli',
    'integrationactivity/synced': () => 'Activité synchronisée (montre / appli)'
  }[`${a.type}/${a.action}`]
  return { date, type: `${a.type}/${a.action}`, texte: libelle ? libelle() : texte(premier(a, ['title', 'content'])) || `${a.type} ${a.action}` }
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

function composerNotes({ exporteLe, notes, objectifs, allergies, blessures, infos, formulaires, photos, activites, derniereConnexion, textesSecours }) {
  const l = [`${MARQUEUR_NOTES} (export du ${dateFr(exporteLe)}) —`]
  if (objectifs.length) l.push('', 'Objectifs :', ...objectifs.map((o) => `- ${o}`))
  for (const [k, v] of infos) l.push('', `${k} : ${v}`)
  if (blessures) l.push('', `Blessures (PAR-Q) : ${blessures}`)
  if (allergies.length) l.push('', `Allergies : ${allergies.join(', ')}`)
  if (notes.length) l.push('', 'Notes MyPTHub :', ...notes.map((n) => `- ${n.date ? `[${dateFr(n.date)}] ` : ''}${n.texte}`))
  l.push('', `Dernière connexion MyPTHub : ${derniereConnexion ? dateFr(derniereConnexion) : 'inconnue'}`)
  l.push(`Photos de progression (non importées) : ${photos.nombre}${photos.nombre ? ` (du ${dateFr(photos.premiere)} au ${dateFr(photos.derniere)})` : ''}`)
  if (formulaires.length) l.push(`Formulaires MyPTHub (non importés) : ${formulaires.join(' ; ')}`)
  if (activites.length) {
    const faites = activites.filter((a) => a.type === 'session/completed')
    const checkins = activites.filter((a) => a.type === 'checkininstance/submitted')
    l.push('', `Journal MyPTHub (partie exportée) : ${faites.length} séance(s) faite(s)${faites.length ? `, dernière le ${dateFr(faites[0].date)}` : ''} ; ${checkins.length} check-in(s)${checkins.length ? `, dernier le ${dateFr(checkins[0].date)}` : ''}.`)
    const ressentis = faites.filter((a) => a.texte.includes('ressenti'))
    l.push('Dernières activités :', ...activites.filter((a) => a.type !== 'integrationactivity/synced').slice(0, 10).map((a) => `- ${a.date ? `[${dateFr(a.date)}] ` : ''}${a.texte}`))
    const autres = ressentis.filter((a) => !activites.slice(0, 10).includes(a))
    if (autres.length) l.push('Autres ressentis après séance :', ...autres.slice(0, 30).map((a) => `- [${dateFr(a.date)}] ${a.texte}`))
  }
  for (const [rubrique, t] of textesSecours) l.push('', `Écran MyPTHub « ${rubrique} » (texte copié tel quel) :`, t)
  return l.join('\n').slice(0, 20000)
}

// Rubriques texte (copie de l'écran) -> API qui porte la même information. Le texte ne sert qu'en secours, si l'API manque ;
// « financials » (paiement) n'est jamais lu ; les photos ne sont que comptées.
const RUBRIQUES_API = {
  activity: /activity_log$/, 'check-ins': /activity_log$/, 'habits-activity': /activity_log$/, programs: /scheduler/, workouts: /\/workouts$/,
  'nutrition-plan': /nutrition/, files: /files/, forms: /forms/, 'weight-circumference': /metrics/, 'body-fat': /metrics/, 'vital-stats': /metrics/,
  notes: /\/notes$/, parq: /parq/, 'goals-interests': /\/v5\/contacts\/\d+$/
}
const RUBRIQUES_JAMAIS = new Set(['financials', 'progress-photos', 'results-tracker'])

// --- Point d'entrée ------------------------------------------------------------------------------------------------
/**
 * @param {object} exportBrut forme : { exporte_le, contacts[], clients{contactId:{api, textes}}, workouts{id: json}, erreurs[] }
 * @param {{ seances?: object, exclure?: string[] }} options seances : détail des séances { id: { workout } } (fichier seances.json) ;
 *        exclure : noms complets de contacts à ne pas importer (ex. le compte de test du coach), comparés sans accents ni casse.
 * @returns {{ version, exporteLe, clients[], rapport }}
 */
export function normaliser(exportBrut, { seances: detailSeances = {}, exclure = [] } = {}) {
  const paiementRetire = {}
  const brut = sansPaiement(exportBrut, paiementRetire)
  const exporteLe = jourDe(brut.exporte_le) || '1970-01-01'
  const lundiExport = lundiDe(exporteLe)
  const champs = {}
  const rapportClients = []
  const clients = []
  const workouts = { ...(brut.workouts || {}), ...sansPaiement(detailSeances, paiementRetire) }
  const exclus = new Set(exclure.map(normNom))
  let nbExclus = 0
  const detailsManquants = new Set()
  for (const contact of brut.contacts || []) {
    if (exclus.has(normNom(contact.full_name ?? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`))) { nbExclus++; continue }
    const cid = String(contact.id)
    const donnees = brut.clients?.[cid] || brut.clients?.[contact.customer_id] || { api: {}, textes: {} }
    const { profil, infos } = profilDe(contact, donnees, champs)
    const derniereConnexion = jourDe(contact.last_seen)
    const archive = !!contact.disabled || contact.active === false || !derniereConnexion || ecartJours(derniereConnexion, exporteLe) > JOURS_INACTIF
    const { mesures, bilans } = mesuresDe(donnees, champs)
    const parq = parqDe(donnees, champs)
    // Séances assignées (forme réelle : { workouts: [{ id, title, note, day_1…day_7, metadata.description }] }) ; détail dans seances.json.
    const assignees = liste(apiDe(donnees, /\/workouts$/)?.v, ['workouts'])
    const programmes = programmesDe(donnees, exporteLe, champs)
    const ids = new Set(assignees.map((w) => String(w.id ?? w.workout_id)).filter((x) => x !== 'undefined'))
    for (const p of programmes) for (const s of p.semaines) for (const w of s) ids.add(w)
    const detailsProg = new Map(programmes.flatMap((p) => p.details))
    const seances = []
    const joursFixes = {}
    for (const id of ids) {
      const ligne = assignees.find((w) => String(w.id ?? w.workout_id) === id)
      let detail = workouts[id] ? deballer(workouts[id]) : null
      if (detail?.workout && typeof detail.workout === 'object') detail = detail.workout
      if (!detail) { detailsManquants.add(id); detail = detailsProg.get(id) || ligne }
      if (!detail) continue
      const s = seanceDe(detail === ligne || !ligne ? detail : { title: ligne.title, ...detail }, champs)
      // Note de l'assignation (ligne de la liste) en consignes si le détail n'en a pas.
      const note = texte(ligne?.note) || texte(ligne?.metadata?.description)
      if (!s.consignes && note) s.consignes = note
      seances.push({ sourceId: id, ...s })
      const jours = [1, 2, 3, 4, 5, 6, 7].filter((d) => ligne?.[`day_${d}`] === true)
      if (jours.length === 1) joursFixes[id] = jours[0] - 1 // day_1 = lundi (supposé ; aucun jour coché dans l'export réel)
    }
    const connues = new Set(seances.map((s) => s.sourceId))
    for (const p of programmes) { p.semaines = p.semaines.map((s) => s.filter((w) => connues.has(w))); delete p.details; for (const w of Object.keys(p.joursFixes)) if (!connues.has(w)) delete p.joursFixes[w] }
    // Séances assignées directement, sans programme : l'app client n'affiche que les séances d'un programme ;
    // pour un client actif, un programme « répété » les regroupe (sans jour fixe sauf day_N), sinon elles restent de simples séances.
    if (!archive && seances.length && !programmes.some((p) => !p.termine)) {
      const hors = seances.map((s) => s.sourceId).filter((id) => !programmes.some((p) => p.semaines.some((x) => x.includes(id))))
      if (hors.length) programmes.push({ sourceId: 'assignees', nom: 'Séances MyPTHub', mode: 'repete', debut: lundiExport, workouts: hors, joursFixes: Object.fromEntries(Object.entries(joursFixes).filter(([w]) => hors.includes(w))), termine: false })
    }
    // Rubriques texte : seulement en secours, quand l'export n'a AUCUNE réponse d'API pour ce client (copie d'écran :
    // en-tête et menus mêlés, parfois la liste des autres clients ; constaté sur l'export réel).
    const secours = []
    for (const [rubrique, t] of Object.entries(Object.keys(donnees.api || {}).length ? {} : donnees.textes || {})) {
      if (RUBRIQUES_JAMAIS.has(rubrique)) continue
      const re = RUBRIQUES_API[rubrique]
      if (re && apisDe(donnees, re).length) continue
      const contenu = texte(t?.texte)
      if (contenu) secours.push([rubrique, contenu.slice(0, 4000)])
    }
    const formulaires = liste(apiDe(donnees, /forms$/)?.v, ['forms']).concat(liste(apiDe(donnees, /forms$/)?.v?.archived ?? []))
      .map((x) => `${texte(x.title) || 'formulaire'}${x.completed ? ' (rempli)' : ''}`)
    const photos = photosDe(donnees)
    const activites = activitesBrutes(donnees).map(activiteLisible)
    const notesCoach = composerNotes({ exporteLe, notes: notesMyPTHub(donnees), objectifs: profil.objectifs, allergies: parq.allergies, blessures: parq.blessures, infos, formulaires, photos, activites, derniereConnexion, textesSecours: secours })
    clients.push({
      source: { mypthub_contact_id: cid, customer_id: contact.customer_id != null ? String(contact.customer_id) : null },
      profil, archive, derniereConnexion, mesures, bilans,
      parq: { date: parq.date || exporteLe, questions: parq.questions },
      notesCoach, seances, programmes
    })
    rapportClients.push({
      client: `client-${String(clients.length).padStart(2, '0')}`, contactId: cid, archive,
      mesures: mesures.length, bilans: bilans.length, parq: parq.questions.length, seances: seances.length,
      exercices: seances.reduce((n, s) => n + s.blocs.reduce((m, b) => m + (b.type === 'superset' ? b.exercices.length : 1), 0), 0),
      programmes: programmes.length, photos: photos.nombre, activites: activites.length, textesSecours: secours.map(([r]) => r),
      manque: [!profil.nom && 'nom', !profil.email && 'email'].filter(Boolean)
    })
  }
  return {
    version: 1, exporteLe, clients,
    rapport: { clients: rapportClients, exclus: nbExclus, seancesSansDetail: detailsManquants.size, champsNonConvertis: champs, paiementRetire, erreursExport: (brut.erreurs || []).length }
  }
}

const normNom = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
