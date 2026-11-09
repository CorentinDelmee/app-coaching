// Import MyPTHub, complément du 2026-11-09 : contenu à jour des séances assignées + historique des séances RÉALISÉES
// (sessions MyPTHub : copie archivée de la séance, chaque série porte `done` = valeurs réellement faites).
// Fonction pure : entrées = fichiers v2 par client (c-<contactId>.json), état actuel de l'app, normalise.json du 5/11 ;
// sortie = plan { exercices, workouts, realisations, templates, rapport } d'objets COMPLETS à écrire un par un (PUT).
// Rien n'est lu ni écrit ici ; aucune date « maintenant ». Mêmes identifiants que importer.js (mp-<contactId>-…).
import { ENTITES } from '../../../src/data/entites.js'
import { mettreAJourTemplate } from '../../../src/domain/realisations.js'
import { lundiDe } from '../../../src/domain/dates.js'
import { norm, slug } from '../util.js'
import { seanceGroupes, exerciceGroupe } from './normaliser.js'

export const DESCRIPTION_VIDE = 'Importé de MyPTHub (à compléter par le coach).' // texte de importer.js quand MyPTHub n'avait rien
const LETTRES = 'abcdefghij'
const tableau = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : [])
const nombre = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'))
  return undefined
}

/** JSON à clés triées : deux objets égaux au contenu près donnent la même chaîne (l'ordre des clés ne compte pas). */
export function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
  return JSON.stringify(v)
}

/** Différences lisibles entre deux objets (chemins), au plus `max`. */
export function differences(a, b, chemin = '', out = [], max = 30) {
  if (out.length >= max) return out
  if (canon(a) === canon(b)) return out
  const objets = a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)
  if (!objets) { out.push(`${chemin || '(racine)'} : ${JSON.stringify(a)} -> ${JSON.stringify(b)}`); return out }
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])]) differences(a[k], b[k], Array.isArray(a) ? `${chemin}[${k}]` : chemin ? `${chemin}.${k}` : k, out, max)
  return out
}

/** Jour 'AAAA-MM-JJ' en Europe/Paris d'un horodatage (indépendant du fuseau de la machine). */
export function jourParis(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

/** « 2025-11-14 08:06:27 » (UTC, sans fuseau) -> ms ; null si illisible. */
export function msUtc(s) {
  if (typeof s !== 'string') return null
  const ms = Date.parse(`${s.trim().replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(s.trim()) ? '' : 'Z'}`)
  return Number.isFinite(ms) ? ms : null
}

// Comme champsDe (importer.js) : poids et reps modifiables par le client, le reste fixé par le coach.
export function champsDe(series) {
  const s = series.length ? series : [{}]
  const champs = ['poids', 'poidsDuCorps', 'reps', 'fourchetteReps', 'repsAuMax', 'tempsTravail', 'tempo', 'resistance', 'rpe'].filter((k) => s.some((x) => k in x)).map((k) => ({ cle: k, modifiableParClient: k === 'poids' || k === 'reps' }))
  return { series: s, champs }
}

/** Séance convertie ({ nom, consignes?, blocs } de seanceGroupes) -> Workout de l'app, mêmes ids que importerSeances. */
export function workoutDe(id, clientId, s, exoId) {
  const blocs = s.blocs.map((b, k) => {
    const bid = `${id}-b${k + 1}`
    if (b.type === 'superset') {
      const exercices = b.exercices.map((x, j) => ({ id: `${bid}${LETTRES[j] ?? j}`, exerciceId: exoId(x), ...champsDe(x.series), ...(x.consignes ? { consignes: x.consignes } : {}) }))
      return { type: 'superset', id: bid, ...(b.repos !== undefined ? { repos: b.repos } : {}), exercices }
    }
    return { type: 'exercice', id: bid, exerciceId: exoId(b), ...champsDe(b.series), ...(b.repos !== undefined ? { repos: b.repos } : {}), ...(b.consignes ? { consignes: b.consignes } : {}) }
  })
  return { id, clientId, nom: s.nom, ...(s.consignes ? { consignes: s.consignes } : {}), blocs }
}

/** Groupes MyPTHub non vides -> [[exercice brut]] (même filtrage que seanceGroupes, donc mêmes positions de blocs). */
function groupesBruts(w) {
  return (w.groups || []).map((g) => (g.exercises || []).filter((e) => exerciceGroupe(e, {}))).filter((l) => l.length)
}

/** Série faite (depuis `done`) au format de l'app ; null si rien n'a été saisi. `ignores` compte les colonnes non reprises. */
export function serieFaite(set, meta, ignores = {}) {
  const d = set?.done
  if (!d || typeof d !== 'object') return null
  const s = [1, 2, 3, 4, 5].some((n) => meta[`field_${n}`] === 'bodyweight') ? { poidsDuCorps: true } : {}
  let saisie = false
  for (const n of [1, 2, 3, 4, 5]) {
    const v = d[`field_${n}`]
    if (v === undefined || v === null || v === '') continue
    saisie = true
    const type = meta[`field_${n}`]
    const x = nombre(v)
    if (type === 'weight' && x !== undefined) s.poids = x
    else if (type === 'bodyweight') { if (x) s.poids = x }
    else if (['reps', 'rep_range', 'amrap'].includes(type) && x !== undefined) s.reps = x
    else if (type === 'time' && x !== undefined) s.tempsTravail = x
    else if (type === 'resistance' && x !== undefined) s.resistance = x
    else ignores[type ?? 'absent'] = (ignores[type ?? 'absent'] || 0) + 1
  }
  return saisie ? s : null
}

/** Suite des noms (normalisés) d'exercices par bloc d'un Workout de l'app ; `nomDe(exerciceId)`. */
function structureWorkout(w, nomDe) {
  return canon(w.blocs.map((b) => (b.type === 'exercice' ? [nomDe(b.exerciceId)] : b.type === 'superset' ? b.exercices.map((x) => nomDe(x.exerciceId)) : [`circuit:${b.id}`])))
}
const structureSeance = (s) => canon(s.blocs.map((b) => (b.type === 'superset' ? b.exercices.map((x) => norm(x.nom)) : [norm(b.nom)])))
/** Items (exercices et sous-exercices) d'un Workout, par bloc : [[{ id, exerciceId }]]. */
const itemsDe = (w) => w.blocs.map((b) => (b.type === 'exercice' ? [b] : b.type === 'superset' ? b.exercices : []))

/** Forme comparable d'un Workout : exercices remplacés par leur nom normalisé, version et champs techniques ignorés. */
function comparable(w, nomDe) {
  const ex = (x) => ({ ...x, exerciceId: `~${nomDe(x.exerciceId)}` })
  return { clientId: w.clientId, nom: w.nom, consignes: w.consignes, blocs: w.blocs.map((b) => (b.type === 'exercice' ? ex(b) : b.type === 'superset' ? { ...b, exercices: b.exercices.map(ex) } : b)) }
}

/**
 * @param {{ contact: string, sessions?: object[], workoutsAssignes?: object[] }[]} dossiers  fichiers v2 (un par client)
 * @param {{ profils, workouts, exercices, realisations, templates }} etat  état actuel de l'app (lignes de l'API)
 * @param {object} normalise  sortie de l'import du 5/11 (pour savoir si une séance a été retouchée depuis)
 * @param {{ octetsLigne?: number }} options  taille maximale d'une ligne (quota du serveur)
 */
export function planifierHistorique(dossiers, etat, normalise, { octetsLigne = Infinity } = {}) {
  const plan = { exercices: [], workouts: [], realisations: [], templates: [], rapport: { clients: [], exercicesCrees: 0, exercicesDecrits: 0, colonnesIgnorees: {}, erreurs: [] } }
  const profils = tableau(etat.profils)
  const workoutsApp = new Map(tableau(etat.workouts).map((w) => [w.id, w]))
  const realisationsApp = new Set(tableau(etat.realisations).map((r) => r.id))
  const templatesApp = new Map(tableau(etat.templates).map((t) => [t.id, t]))
  // Bibliothèque : par id (pour comparer) et par nom normalisé (pour retrouver un exercice MyPTHub).
  const exosParId = new Map(tableau(etat.exercices).map((e) => [e.id, e]))
  const exosParNom = new Map()
  for (const e of exosParId.values()) if (!exosParNom.has(norm(e.nom))) exosParNom.set(norm(e.nom), e)
  const nomDe = (id) => (exosParId.has(id) ? norm(exosParId.get(id).nom) : `?${id}`)
  const decrits = new Set()

  /** Exercice existant sans description (ou texte d'attente de l'import) et MyPTHub en a une : on la complète, rien d'autre ne change. */
  function completer(x) {
    const n = norm(x.nom)
    const ex = exosParNom.get(n)
    if (!ex || !x.description || (ex.description && ex.description !== DESCRIPTION_VIDE) || decrits.has(ex.id)) return
    decrits.add(ex.id)
    const { version: _, ...sans } = ex // le serveur refuse `version` dans un PUT
    const maj = { ...sans, description: `${x.description}\n\n(Importé de MyPTHub.)` }
    exosParId.set(ex.id, maj); exosParNom.set(n, maj)
    plan.exercices.push(maj)
    plan.rapport.exercicesDecrits++
  }
  const exercicesDe = (seance) => seance.blocs.flatMap((b) => (b.type === 'superset' ? b.exercices : [b]))

  /** Exercice de la bibliothèque pour ce nom ; sinon créé (comme exercice() de importer.js, suffixe -2, -3… si l'id est pris). */
  function exoId(x) {
    const n = norm(x.nom)
    const ex = exosParNom.get(n)
    if (ex) { completer(x); return ex.id }
    const base = `ex-${slug(x.nom)}`
    let id = base
    for (let k = 2; exosParId.has(id); k++) id = `${base}-${k}`
    const e = { id, nom: x.nom.trim(), categories: [], description: x.description ? `${x.description}\n\n(Importé de MyPTHub.)` : DESCRIPTION_VIDE, ...(x.video ? { lienVideo: x.video } : {}) }
    exosParId.set(id, e); exosParNom.set(n, e); decrits.add(id)
    plan.exercices.push(e)
    plan.rapport.exercicesCrees++
    return id
  }

  const tries = [...dossiers].sort((a, b) => String(a.contact).localeCompare(String(b.contact), 'en', { numeric: true }))
  for (const [i, d] of tries.entries()) {
    const contact = String(d.contact)
    const ligne = { client: `client-${String(i + 1).padStart(2, '0')}`, contact, action: '', seancesCreees: 0, seancesMisesAJour: 0, seancesRetouchees: [], realisations: 0, realisationsDejaLa: 0, versions: 0, sessionsIgnorees: 0, colonnesIgnorees: {} }
    plan.rapport.clients.push(ligne)
    const profil = profils.find((p) => p.fiche?.source?.mypthub?.contactId === contact)
    if (!profil) { ligne.action = 'ignoré (aucun profil de l\'app pour ce contact MyPTHub)'; continue }
    ligne.action = 'traité'
    const pid = profil.id
    const cle = `mp-${slug(contact)}`
    const source = (normalise?.clients || []).find((c) => String(c.source?.mypthub_contact_id) === contact)
    const modeles = new Map() // id -> Workout courant (plan s'il est écrit, sinon app)

    // --- Séances assignées : créer, mettre à jour si jamais retouchée, sinon signaler ---------------------------------
    for (const w of d.workoutsAssignes || []) {
      if (!Array.isArray(w?.groups)) continue
      const id = `${cle}-w-${slug(w.id)}`
      const frais = seanceGroupes(w, {})
      exercicesDe(frais).forEach(completer)
      const app = workoutsApp.get(id)
      if (!app) {
        const nouveau = workoutDe(id, pid, frais, exoId)
        plan.workouts.push(nouveau); modeles.set(id, nouveau); ligne.seancesCreees++
        continue
      }
      modeles.set(id, app)
      const parNom = (x) => `~${norm(x.nom)}` // forme comparable sans toucher à la bibliothèque
      const cApp = canon(comparable(app, nomDe))
      const cFrais = canon(comparable(workoutDe(id, pid, frais, parNom), (n) => n.slice(1)))
      if (cApp === cFrais) continue // déjà à jour
      const ancienne = source?.seances?.find((s) => String(s.sourceId) === String(w.id))
      const cAttendu = ancienne ? canon(comparable(workoutDe(id, pid, ancienne, parNom), (n) => n.slice(1))) : null
      if (cAttendu === cApp) {
        // Jamais retouchée depuis l'import du 5/11 : on la remplace par la conversion fraîche.
        const maj = workoutDe(id, pid, frais, exoId) // sans `version` : le serveur la refuse dans un PUT
        plan.workouts.push(maj); modeles.set(id, maj); ligne.seancesMisesAJour++
      } else {
        ligne.seancesRetouchees.push({ id, raison: ancienne ? 'retouchée dans l\'app' : 'absente de l\'import du 5/11 (non vérifiable)', differences: differences(JSON.parse(cApp), JSON.parse(cFrais)) })
      }
    }

    // --- Historique : une réalisation par session terminée -------------------------------------------------------------
    const versions = [] // { id, origine, structure, workout }
    const mesRealisations = []
    for (const x of d.sessions || []) {
      const s = x?.session
      if (!s || s.status !== 'finished' || !Array.isArray(s.workout?.groups)) { ligne.sessionsIgnorees++; continue }
      const copie = seanceGroupes(s.workout, {})
      exercicesDe(copie).forEach(completer)
      const bruts = groupesBruts(s.workout)
      const structure = structureSeance(copie)
      const origine = slug(s.workout.archived_original_id ?? s.workout.id)
      const idModele = `${cle}-w-${origine}`
      const modele = modeles.get(idModele) || workoutsApp.get(idModele)
      let cible = modele && structureWorkout(modele, nomDe) === structure ? modele : null
      if (!cible) {
        // Séance « version » : construite depuis la copie de la session, partagée par les sessions de même structure.
        let v = versions.find((y) => y.origine === origine && y.structure === structure)
        if (!v) {
          for (let n = 1; !v; n++) {
            const id = `${idModele}-v${n}`
            if (versions.some((y) => y.id === id)) continue
            const existante = workoutsApp.get(id)
            if (existante && structureWorkout(existante, nomDe) !== structure) continue
            v = { id, origine, structure, workout: existante || workoutDe(id, pid, copie, exoId) }
            versions.push(v)
            if (!existante) { plan.workouts.push(v.workout); ligne.versions++ }
          }
        }
        cible = v.workout
      }
      const id = `${cle}-s-${slug(s.id)}`
      const termineLe = msUtc(s.date_completed_utc) ?? msUtc(s.date_completed)
      if (termineLe === null) { ligne.sessionsIgnorees++; continue }
      const items = itemsDe(cible)
      const valeurs = {}
      let volume = 0
      let seriesFaites = 0
      bruts.forEach((groupe, k) => groupe.forEach((e, j) => {
        const item = items[k]?.[j]
        if (!item) return
        const meta = e.meta && typeof e.meta === 'object' ? e.meta : {}
        const series = (Array.isArray(meta.sets) ? meta.sets : []).map((st) => serieFaite(st, meta, ligne.colonnesIgnorees))
        for (const sf of series) if (sf) { seriesFaites++; volume += (sf.poids || 0) * (sf.reps || 0) }
        if (series.length) valeurs[item.id] = { exerciceId: item.exerciceId, series }
      }))
      const date = jourParis(termineLe)
      const r = { id, clientId: pid, workoutId: cible.id, date, semaine: lundiDe(date), valeurs, circuits: {}, dureeSec: Math.round((nombre(s.duration) ?? 0) * 60), volume: Math.round(volume * 10) / 10, seriesFaites, termineLe }
      const commentaire = typeof s.feedback === 'string' ? s.feedback.trim() : ''
      if (commentaire) r.commentaire = commentaire
      mesRealisations.push(r)
      if (realisationsApp.has(id)) { ligne.realisationsDejaLa++; continue }
      plan.realisations.push(r); ligne.realisations++
    }

    // --- Template du client : dernières valeurs MyPTHub, puis celles déjà dans l'app par-dessus (l'app est plus récente) ---
    const actuel = templatesApp.get(pid)
    let tpl = structuredClone(actuel || { id: pid, valeurs: {} })
    for (const r of [...mesRealisations].sort((a, b) => a.termineLe - b.termineLe)) tpl = mettreAJourTemplate(tpl, r)
    for (const [wid, blocs] of Object.entries(actuel?.valeurs || {})) {
      for (const [bid, series] of Object.entries(blocs || {})) {
        const fusion = [...(tpl.valeurs[wid]?.[bid] || [])]
        ;(series || []).forEach((sv, k) => { if (sv) fusion[k] = { ...(fusion[k] || {}), ...sv } })
        tpl.valeurs[wid] = { ...(tpl.valeurs[wid] || {}), [bid]: fusion.map((v) => v ?? null) }
      }
    }
    if (canon(tpl) !== canon(actuel || { id: pid, valeurs: {} })) plan.templates.push(tpl)
    for (const [t, n] of Object.entries(ligne.colonnesIgnorees)) plan.rapport.colonnesIgnorees[t] = (plan.rapport.colonnesIgnorees[t] || 0) + n
  }

  plan.rapport.erreurs = validerPlan(plan, octetsLigne)
  return plan
}

/** Chaque objet passe le validateur de son entité et tient dans le quota d'une ligne. */
export function validerPlan(plan, octetsLigne = Infinity) {
  const erreurs = []
  for (const entite of ['exercices', 'workouts', 'realisations', 'templates']) {
    for (const o of plan[entite]) {
      const v = ENTITES[entite].valider(o)
      if (!v.ok) erreurs.push(`${entite}/${o?.id} : ${v.erreurs.join(' ; ')}`)
      if (Buffer.byteLength(JSON.stringify(o)) > octetsLigne) erreurs.push(`${entite}/${o?.id} : ligne trop grosse (quota ${octetsLigne} octets)`)
    }
  }
  return erreurs
}
