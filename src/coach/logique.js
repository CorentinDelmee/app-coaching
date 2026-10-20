// Logique pure du tableau de bord coach (sans Vue, sans horloge, sans accès aux données).
import { CHAMPS } from '../domain/modele.js'
import { paramsComplets } from '../engine/circuits.js'
import { lienWhatsApp } from '../domain/coaching.js'
import { ajouterJours, jourSemaine, lundiDe } from '../domain/dates.js'

export const CATEGORIES = {
  jambes: 'Jambes', poussee: 'Poussée', tirage: 'Tirage', gainage: 'Gainage', cardio: 'Cardio', mobilite: 'Mobilité'
}
export const libelleCategorie = (c) => CATEGORIES[c] || c

export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Copie profonde de données JSON (marche aussi sur les objets réactifs Vue, ce que structuredClone refuse). */
export const copie = (x) => JSON.parse(JSON.stringify(x))

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const JOURS_ABREGES = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
/** '2026-09-28' -> « lun. 28 sept. » (et l'année si elle diffère de `anneeRef`, ex. « lun. 28 sept. 2025 »). */
export function dateFr(jour, anneeRef) {
  if (!jour) return ''
  const [a, m, j] = jour.split('-').map(Number)
  const base = `${JOURS_ABREGES[jourSemaine(jour)]} ${j} ${MOIS_COURTS[m - 1]}`
  return anneeRef && a !== anneeRef ? `${base} ${a}` : base
}

// --- Messages à transmettre au client -------------------------------------------------------------
export function messageIdentifiants({ nom, identifiant, code, url }) {
  const prenom = nom.trim().split(/\s+/)[0]
  return `Bonjour ${prenom}, voici votre accès à l'application de coaching :\n${url}\nIdentifiant : ${identifiant}\nCode : ${code}\nVous pourrez changer ce code dans votre profil.`
}
export const lienWhatsAppIdentifiants = (infos, numero = '') => lienWhatsApp(numero, messageIdentifiants(infos))

// --- Champs d'exercice (CDC §5) ----------------------------------------------------------------------
/** Champs proposables dans une séance. Le repos est géré au niveau du bloc. */
export const CLES_CHAMPS = Object.keys(CHAMPS).filter((k) => k !== 'repos')
export const estPerso = (cle) => cle.startsWith('perso:')
export const libelleChamp = (champ) => (estPerso(champ.cle) ? champ.libelle || champ.cle.slice(6) : CHAMPS[champ.cle]?.label || champ.cle)

/** Valeur par défaut d'un champ dans une nouvelle série. */
const DEFAUTS_CHAMPS = { reps: 10, tempsTravail: 30, dureeTotale: 600, rpe: 7 }
export function valeurParDefaut(cle) {
  if (cle in DEFAUTS_CHAMPS) return DEFAUTS_CHAMPS[cle]
  const spec = CHAMPS[cle]
  if (!spec) return ''
  if (spec.type === 'nombre') return spec.min ?? 0
  if (spec.type === 'booleen') return false
  if (spec.type === 'choix') return spec.choix[0]
  return ''
}

/** Nouvelle série pour un jeu de champs. */
export const nouvelleSerie = (champs) => Object.fromEntries(champs.map((c) => [c.cle, valeurParDefaut(c.cle)]))

/** Ajoute ou retire un champ ; les séries suivent (valeur par défaut / suppression). */
export function basculerChamp(item, cle, libelle) {
  const present = item.champs.some((c) => c.cle === cle)
  const champs = present ? item.champs.filter((c) => c.cle !== cle) : [...item.champs, { cle, modifiableParClient: true, ...(libelle ? { libelle } : {}) }]
  const series = item.series.map((s) => {
    const { [cle]: ancien, ...reste } = s
    return present ? reste : { ...reste, [cle]: ancien ?? valeurParDefaut(cle) }
  })
  return { ...item, champs, series }
}

/** Fixe le nombre de séries (copie la dernière pour les nouvelles). Minimum 1. */
export function fixerNbSeries(item, n) {
  const nb = Math.max(1, Math.round(n) || 1)
  const series = item.series.slice(0, nb)
  while (series.length < nb) series.push({ ...(series[series.length - 1] || nouvelleSerie(item.champs)) })
  return { ...item, series }
}

/** Clé d'un champ personnalisé : « perso:grip-large », unique parmi les champs de l'exercice. */
export function clePerso(libelle, existants = []) {
  const base = 'perso:' + (slug(libelle || '') || 'champ')
  let cle = base
  for (let n = 2; existants.includes(cle); n++) cle = `${base}-${n}`
  return cle
}

// --- Blocs de séance -------------------------------------------------------------------------------------
const CHAMPS_DEFAUT = () => [{ cle: 'poids', modifiableParClient: true }, { cle: 'reps', modifiableParClient: true }]

export function nouvelItemExercice(id, exerciceId) {
  const champs = CHAMPS_DEFAUT()
  return { id, exerciceId, champs, series: Array.from({ length: 3 }, () => nouvelleSerie(champs)) }
}

/** Crée un bloc vide du type demandé. `uuid()` fournit les identifiants. */
export function nouveauBloc(type, uuid, exerciceId = '') {
  const id = uuid()
  if (type === 'exercice') return { type, ...nouvelItemExercice(id, exerciceId), repos: 90 }
  if (type === 'superset') return { type, id, repos: 75, exercices: [nouvelItemExercice(uuid(), exerciceId), nouvelItemExercice(uuid(), exerciceId)] }
  return { type: 'circuit', id, nom: '', format: 'amrap', params: {}, exercices: [] }
}

/** Déplace l'élément i de `delta` rangs (-1 = monter). Renvoie une nouvelle liste. */
export function deplacer(liste, i, delta) {
  const j = i + delta
  if (j < 0 || j >= liste.length) return liste
  const nouvelle = [...liste]
  const tmp = nouvelle[i]
  nouvelle[i] = nouvelle[j]
  nouvelle[j] = tmp
  return nouvelle
}

/** Paramètres éditables d'un format de circuit (valeurs en secondes, minutes ou nombre). */
export const PARAMS_FORMAT = {
  amrap: [{ cle: 'duree', label: 'Durée', unite: 's' }],
  emom: [{ cle: 'minutes', label: 'Minutes', unite: 'min' }],
  fortime: [{ cle: 'cap', label: 'Cap (0 = sans)', unite: 's' }],
  timecap: [{ cle: 'cap', label: 'Cap', unite: 's' }],
  deathby: [{ cle: 'repsDepart', label: 'Reps de départ', unite: '' }, { cle: 'increment', label: 'Ajout par minute', unite: '' }],
  tabata: [{ cle: 'tours', label: 'Tours', unite: '' }, { cle: 'travail', label: 'Travail', unite: 's' }, { cle: 'repos', label: 'Repos', unite: 's' }],
  intervalles: [{ cle: 'tours', label: 'Tours', unite: '' }, { cle: 'travail', label: 'Travail', unite: 's' }, { cle: 'repos', label: 'Repos', unite: 's' }],
  superset: [{ cle: 'tours', label: 'Passages', unite: '' }, { cle: 'repos', label: 'Repos', unite: 's' }]
}
export const LIBELLES_FORMAT = {
  amrap: 'AMRAP', emom: 'EMOM', fortime: 'For Time', timecap: 'Time cap', deathby: 'Death by',
  tabata: 'Tabata', intervalles: 'Intervalles', superset: 'Superset (chrono)'
}
/** Paramètres complets (valeurs par défaut du moteur) à afficher pour un format. */
export const paramsAffiches = (format, params) => paramsComplets(format, params)

/** Pour les formats qui nomment leurs exercices (emom, superset) : liste des ids d'exercices du circuit. */
export function synchroniserExercicesCircuit(bloc) {
  if (!['emom', 'superset'].includes(bloc.format)) return bloc
  return { ...bloc, params: { ...bloc.params, exercices: bloc.exercices.map((x) => x.exerciceId) } }
}

/** Résumé d'une séance pour les listes. */
export function resumeWorkout(w, nomExercice) {
  const compte = { exercice: 0, superset: 0, circuit: 0 }
  w.blocs.forEach((b) => compte[b.type]++)
  const noms = w.blocs.flatMap((b) => (b.type === 'exercice' ? [b.exerciceId] : (b.exercices || []).map((x) => x.exerciceId))).map(nomExercice)
  const parts = []
  if (compte.exercice) parts.push(`${compte.exercice} exercice${compte.exercice > 1 ? 's' : ''}`)
  if (compte.superset) parts.push(`${compte.superset} superset${compte.superset > 1 ? 's' : ''}`)
  if (compte.circuit) parts.push(`${compte.circuit} circuit${compte.circuit > 1 ? 's' : ''}`)
  return { libelle: parts.join(' · ') || 'Vide', noms }
}

// --- Duplication d'un modèle vers un autre client --------------------------------------------------------
/** Copie une séance pour `clientId` (nouvel id ; les blocs gardent leurs ids, locaux à la séance). */
export function dupliquerWorkout(w, clientId, uuid, nom) {
  const c = copie(w)
  return { ...c, id: uuid(), clientId: clientId ?? null, nom: nom ?? c.nom }
}

/** Remplace le nom de l'ancien client par celui du nouveau dans un titre (rien ne doit fuiter chez le destinataire). */
export const renommerPourClient = (titre, ancienNom, nouveauNom) =>
  ancienNom && nouveauNom && titre.includes(ancienNom) ? titre.split(ancienNom).join(nouveauNom) : titre

/**
 * Copie un programme + toutes ses séances pour un autre client.
 * `noms` { ancien, nouveau } : noms des clients, pour renommer le programme (« Programme <nouveau> ») et les séances.
 * @returns {{programme, workouts}} à créer (séances d'abord).
 */
export function dupliquerProgramme(programme, workoutsSource, clientId, uuid, debut, noms = {}) {
  const copies = new Map()
  const copier = (wid) => {
    if (copies.has(wid)) return copies.get(wid).id
    const source = workoutsSource.find((w) => w.id === wid)
    if (!source) return null
    const c = dupliquerWorkout(source, clientId, uuid, renommerPourClient(source.nom, noms.ancien, noms.nouveau))
    copies.set(wid, c)
    return c.id
  }
  const nouveau = { ...copie(programme), id: uuid(), clientId, debut: debut || programme.debut }
  if (noms.nouveau) nouveau.nom = `Programme ${noms.nouveau}`
  if (programme.mode === 'repete') nouveau.workouts = programme.workouts.map(copier).filter(Boolean)
  else nouveau.semaines = programme.semaines.map((s) => s.map(copier).filter(Boolean))
  if (programme.joursFixes) {
    nouveau.joursFixes = Object.fromEntries(Object.entries(programme.joursFixes).filter(([k]) => copies.has(k)).map(([k, v]) => [copies.get(k).id, v]))
  }
  return { programme: nouveau, workouts: [...copies.values()] }
}

/** Un workout supprimé du programme disparaît aussi des jours fixés. */
export function retirerWorkoutDuProgramme(programme, workoutId, semaine) {
  const p = copie(programme)
  if (p.mode === 'repete') p.workouts = p.workouts.filter((id) => id !== workoutId)
  else p.semaines[semaine] = p.semaines[semaine].filter((id) => id !== workoutId)
  const encore = p.mode === 'repete' ? p.workouts : p.semaines.flat()
  if (p.joursFixes && !encore.includes(workoutId)) delete p.joursFixes[workoutId]
  return p
}

// --- Questionnaires ----------------------------------------------------------------------------------------------
export const TYPES_QUESTION_LIBELLES = {
  curseur: 'Curseur 0-10', choixUnique: 'Choix unique', choixMultiple: 'Choix multiples', emojis: 'Émojis', nombre: 'Nombre', texte: 'Texte libre', photo: 'Photo'
}
export const EMOJIS_PAR_DEFAUT = ['😫', '😕', '😐', '🙂', '🤩']

/** Clé stable à partir du libellé (les courbes et alertes s'appuient sur « douleur », « poids »). */
export function cleDepuisLibelle(libelle, autres = []) {
  const base = slug(libelle || '').replace(/-(\w)/g, (_, c) => c.toUpperCase()) || 'question'
  let cle = base
  for (let n = 2; autres.includes(cle); n++) cle = `${base}${n}`
  return cle
}

export function nouvelleQuestion(type, existantes = []) {
  const q = { cle: cleDepuisLibelle('question', existantes.map((x) => x.cle)), libelle: '', type }
  if (type === 'curseur') Object.assign(q, { min: 0, max: 10, etiquettes: ['', ''] })
  if (type === 'choixUnique' || type === 'choixMultiple') q.choix = ['Option 1', 'Option 2']
  if (type === 'emojis') q.choix = [...EMOJIS_PAR_DEFAUT]
  if (type === 'nombre') Object.assign(q, { unite: '', min: 0, max: 1000, pas: 1 })
  if (type === 'texte' || type === 'photo') q.optionnel = true
  return q
}

// --- Courbes SVG -------------------------------------------------------------------------------------------------------
/**
 * Transforme des points {date:'AAAA-MM-JJ', valeur:nombre} en coordonnées SVG.
 * @returns {{points:{x,y,date,valeur}[], chemin:string, min, max}}
 */
export function construireCourbe(donnees, { largeur = 600, hauteur = 180, marge = 24 } = {}) {
  const tries = [...donnees].filter((d) => Number.isFinite(d.valeur)).sort((a, b) => a.date.localeCompare(b.date))
  if (tries.length === 0) return { points: [], chemin: '', min: 0, max: 0 }
  const vals = tries.map((d) => d.valeur)
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (min === max) { min -= 1; max += 1 }
  const t0 = Date.parse(tries[0].date)
  const duree = Date.parse(tries[tries.length - 1].date) - t0
  const points = tries.map((d) => ({
    date: d.date, valeur: d.valeur,
    x: marge + (duree ? ((Date.parse(d.date) - t0) / duree) * (largeur - 2 * marge) : (largeur - 2 * marge) / 2),
    y: marge + (1 - (d.valeur - min) / (max - min)) * (hauteur - 2 * marge)
  }))
  const chemin = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return { points, chemin, min, max }
}

// --- Vue client --------------------------------------------------------------------------------------------------------------
/** Charges réalisées : pour chaque exercice, la meilleure charge de chaque séance faite (du plus récent au plus ancien). */
export function chargesRealisees(realisations, nomExercice) {
  const parExo = new Map()
  for (const r of [...realisations].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const bloc of Object.values(r.valeurs || {})) {
      const series = (bloc.series || []).filter(Boolean)
      const poids = series.map((s) => s.poids).filter((p) => typeof p === 'number')
      if (!poids.length) continue
      const max = Math.max(...poids)
      const meilleure = series.find((s) => s.poids === max)
      const liste = parExo.get(bloc.exerciceId) || []
      liste.push({ date: r.date, poids: max, reps: meilleure.reps ?? null, series: series.length })
      parExo.set(bloc.exerciceId, liste)
    }
  }
  return [...parExo.entries()].map(([exerciceId, historique]) => ({ exerciceId, nom: nomExercice(exerciceId), historique }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

/** Points de la courbe de poids : mesures (poids) + réponses dont la clé « poids » est un nombre (la mesure prime). */
export function pointsPoids(mesures, reponses) {
  const parDate = new Map()
  for (const r of reponses) if (typeof r.valeurs?.poids === 'number') parDate.set(r.date, r.valeurs.poids)
  for (const m of mesures) if (typeof m.poids === 'number') parDate.set(m.date, m.poids)
  return [...parDate.entries()].map(([date, valeur]) => ({ date, valeur }))
}

/** Grille de calendrier d'un mois « AAAA-MM » : semaines (lundi→dimanche) de jours 'AAAA-MM-JJ'. */
export function grilleMois(mois) {
  const [y, m] = mois.split('-').map(Number)
  const dernier = `${mois}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  const semaines = []
  for (let l = lundiDe(`${mois}-01`); l <= dernier; l = ajouterJours(l, 7)) {
    semaines.push(Array.from({ length: 7 }, (_, i) => ajouterJours(l, i)))
  }
  return semaines
}
