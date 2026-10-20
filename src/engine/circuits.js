// Moteur de circuits : fonction pure `etatChrono(format, params, evenements, now)`.
// Aucun état interne : l'UI conserve la liste d'événements (JSON, sauvegardable) et rappelle
// la fonction à chaque image avec l'horloge. Pause/reprise ne fait jamais dériver le chrono.
//
// Événements ({ type, t } avec t en ms, horloge de l'appelant) :
//   demarrer · pause · reprendre
//   amrap : tour, moins-un-tour, reps-en-plus ({valeur}) · fortime/timecap : termine
//   deathby : echec · superset : suivant, passer-repos
//
// L'état renvoyé contient toujours : format, params, phase ('attente'|'preparation'|'travail'|'repos'|'termine'),
// enPause, preparationRestante (s), ecoule (ms de chrono, préparation exclue), termine, resultat,
// segment (entier croissant à chaque transition) et signal (ce qu'il faut jouer en entrant dans ce segment :
// 'preparation' | 'go' | 'travail' | 'repos' | 'minute' | 'fin'). Comparer `segment` d'une image à l'autre,
// ou appeler `detecterSignal(prev, next)`.
import { formaterChrono, pluriel } from '../domain/format.js'

const S = 1000
const MINUTE = 60 * S

const DEFAUTS = {
  amrap: { duree: 12 * 60 },
  emom: { minutes: 10, exercices: [] },
  fortime: { cap: null },
  timecap: { cap: 10 * 60 },
  deathby: { repsDepart: 1, increment: 1 },
  tabata: { tours: 8, travail: 20, repos: 10, reposFinal: false },
  intervalles: { tours: 8, travail: 30, repos: 30, reposFinal: false },
  superset: { exercices: [], tours: 3, repos: 60 }
}

export const paramsComplets = (format, params = {}) => ({ preparation: 10, ...DEFAUTS[format], ...params })

/** Ajoute un événement (liste immuable). */
export const evenement = (type, t, extra = {}) => ({ type, t, ...extra })
export const ajouter = (evenements, ev) => [...evenements, ev]

/** Texte de l'écran d'explication d'un circuit. */
export function explication(format, params = {}) {
  const p = paramsComplets(format, params)
  const min = (s) => `${Math.round((s / 60) * 10) / 10}`.replace('.', ',')
  switch (format) {
    case 'amrap': return `AMRAP — objectif : faire le plus de tours possible en ${min(p.duree)} min.`
    case 'emom': return `EMOM — toutes les minutes, pendant ${p.minutes} min : faites l'exercice de la minute, le temps restant sert de repos.`
    case 'fortime': return p.cap
      ? `For Time — objectif : terminer le travail le plus vite possible (cap à ${formaterChrono(p.cap * S)}).`
      : 'For Time — objectif : terminer le travail le plus vite possible.'
    case 'timecap': return `Time cap — objectif : terminer le travail avant le cap de ${formaterChrono(p.cap * S)}.`
    case 'deathby': return 'Death by — minute 1 : 1 répétition, minute 2 : 2 répétitions… Continuez jusqu\'à l\'échec.'
    case 'tabata': return `Tabata — ${p.tours} tours de ${p.travail} s de travail et ${p.repos} s de repos.`
    case 'intervalles': return `Intervalles — ${p.tours} tours de ${p.travail} s de travail et ${p.repos} s de repos.`
    case 'superset': return `Superset — enchaînez ${(p.exercices || []).length || 2} exercices sans pause, puis repos de ${p.repos} s ; ${p.tours} passages.`
    default: return ''
  }
}

// --- Temps actif : horloge moins les pauses -------------------------------------------------------

function lignesDeTemps(evenements, now) {
  const debut = evenements.find((e) => e.type === 'demarrer' && e.t <= now)
  if (!debut) return null
  const pauses = []
  let ouverte = null
  for (const e of [...evenements].sort((a, b) => a.t - b.t)) {
    if (e.t > now) break
    if (e.type === 'pause' && ouverte === null) ouverte = e.t
    else if (e.type === 'reprendre' && ouverte !== null) { pauses.push([ouverte, e.t]); ouverte = null }
  }
  if (ouverte !== null) pauses.push([ouverte, now])
  // Temps actif à l'instant t (les pauses sont retirées).
  const actif = (t) => {
    let perdu = 0
    for (const [a, b] of pauses) perdu += Math.max(0, Math.min(b, t) - Math.min(a, t))
    return Math.max(0, t - debut.t - perdu)
  }
  const enPausePourEvenement = (t) => pauses.some(([a, b]) => t > a && t < b)
  return { actif, enPause: ouverte !== null, maintenant: actif(now), enPausePourEvenement }
}

const pluralMinutes = (n) => `${n} ${pluriel(n, 'minute', 'minutes')}`

/**
 * État du chrono à l'instant `now`.
 * @param {string} format  amrap|emom|fortime|timecap|deathby|tabata|intervalles|superset
 */
export function etatChrono(format, params, evenements, now) {
  const p = paramsComplets(format, params)
  const base = {
    format, params: p, phase: 'attente', enPause: false, preparationRestante: p.preparation,
    ecoule: 0, termine: false, resultat: null, segment: 0, signal: null
  }
  const tl = lignesDeTemps(evenements, now)
  if (!tl) return base
  const prepMs = p.preparation * S
  base.enPause = tl.enPause

  if (tl.maintenant < prepMs) {
    return { ...base, phase: 'preparation', preparationRestante: Math.ceil((prepMs - tl.maintenant) / S), segment: 1, signal: 'preparation' }
  }
  base.preparationRestante = 0
  const t = tl.maintenant - prepMs
  // Événements utiles, datés en temps de chrono (préparation exclue, pauses exclues).
  const evs = evenements
    .filter((e) => e.t <= now && e.type !== 'demarrer' && e.type !== 'pause' && e.type !== 'reprendre' && !tl.enPausePourEvenement(e.t))
    .map((e) => ({ ...e, ct: tl.actif(e.t) - prepMs }))
    .filter((e) => e.ct >= 0 || e.type === 'reps-en-plus')
    .sort((a, b) => a.ct - b.ct)

  const calc = { amrap, emom, fortime, timecap: fortime, deathby, tabata: intervalles, intervalles, superset }[format]
  if (!calc) throw new Error(`Format de circuit inconnu : ${format}`)
  return { ...base, ...calc(p, t, evs, format) }
}

/** Signal à jouer entre deux images (null si aucune transition). */
export function detecterSignal(precedent, courant) {
  if (!courant || courant.segment === 0) return null
  if (precedent && precedent.segment === courant.segment) return null
  return courant.signal
}

// --- Formats ----------------------------------------------------------------------------------------

function amrap(p, t, evs) {
  const dureeMs = p.duree * S
  const fini = t >= dureeMs
  const tours = Math.max(0, evs.filter((e) => e.type === 'tour' && e.ct <= dureeMs).length
    - evs.filter((e) => e.type === 'moins-un-tour' && e.ct <= dureeMs).length)
  const repsEv = evs.filter((e) => e.type === 'reps-en-plus').pop()
  const base = { tours, restant: Math.max(0, Math.ceil((dureeMs - t) / S)), ecoule: Math.min(t, dureeMs) }
  if (!fini) return { ...base, phase: 'travail', segment: 2, signal: 'go' }
  const repsEnPlus = repsEv ? repsEv.valeur : 0
  return {
    ...base, phase: 'termine', termine: true, segment: 3, signal: 'fin',
    saisieRequise: !repsEv, // l'UI demande les répétitions en plus
    resultat: { type: 'amrap', tours, repsEnPlus, libelle: `${tours} ${pluriel(tours, 'tour', 'tours')} + ${repsEnPlus} reps` }
  }
}

function emom(p, t) {
  const totalMs = p.minutes * MINUTE
  if (t >= totalMs) {
    return { phase: 'termine', termine: true, ecoule: totalMs, minute: p.minutes, total: p.minutes, restantMinute: 0,
      segment: 2 + p.minutes, signal: 'fin', resultat: { type: 'emom', minutes: p.minutes, libelle: `EMOM ${p.minutes} min terminé` } }
  }
  const idx = Math.floor(t / MINUTE)
  const exos = p.exercices || []
  return {
    phase: 'travail', ecoule: t, minute: idx + 1, total: p.minutes,
    restantMinute: Math.ceil((MINUTE - (t % MINUTE)) / S),
    exerciceIndex: exos.length ? idx % exos.length : null,
    exerciceMinute: exos.length ? exos[idx % exos.length] : null,
    segment: 2 + idx, signal: idx === 0 ? 'go' : 'minute'
  }
}

// For Time (chrono qui monte, cap facultatif) et Time cap (cap obligatoire) : même mécanique.
// Le cap affiché (`capAffiche`) ne bouge jamais : seul `ecoule` monte.
function fortime(p, t, evs, format) {
  const capMs = p.cap ? p.cap * S : null
  const cap = capMs === null ? {} : { cap: capMs, capAffiche: formaterChrono(capMs) }
  const fin = evs.find((e) => e.type === 'termine' && (capMs === null || e.ct <= capMs))
  if (fin) {
    return { ...cap, phase: 'termine', termine: true, ecoule: fin.ct, segment: 3, signal: 'fin',
      resultat: { type: 'temps', ms: fin.ct, libelle: formaterChrono(fin.ct) } }
  }
  if (capMs !== null && t >= capMs) {
    return { ...cap, phase: 'termine', termine: true, ecoule: capMs, segment: 3, signal: 'fin',
      resultat: { type: 'cap', cap: capMs, libelle: `cap ${formaterChrono(capMs)}` } }
  }
  return { ...cap, phase: 'travail', ecoule: t, segment: 2, signal: 'go',
    ...(capMs !== null ? { restantCap: Math.ceil((capMs - t) / S) } : {}), format }
}

function deathby(p, t, evs) {
  const reps = (n) => (n < 1 ? 0 : p.repsDepart + (n - 1) * p.increment)
  const echec = evs.find((e) => e.type === 'echec')
  if (echec) {
    const minuteEchec = Math.floor(echec.ct / MINUTE) + 1
    const reussies = minuteEchec - 1
    return {
      phase: 'termine', termine: true, ecoule: echec.ct, minute: minuteEchec, segment: 1000 + minuteEchec, signal: 'fin',
      resultat: { type: 'deathby', minutes: reussies, reps: reps(reussies), libelle: pluralMinutes(reussies) }
    }
  }
  const idx = Math.floor(t / MINUTE)
  return {
    phase: 'travail', ecoule: t, minute: idx + 1, repsMinute: reps(idx + 1),
    restantMinute: Math.ceil((MINUTE - (t % MINUTE)) / S), segment: 2 + idx, signal: idx === 0 ? 'go' : 'minute'
  }
}

// Tabata = intervalles 8 × 20/10. Pas de repos après le dernier tour (sauf `reposFinal`).
function intervalles(p, t) {
  const travail = p.travail * S
  const repos = p.repos * S
  const cycle = travail + repos
  const total = p.tours * cycle - (p.reposFinal ? 0 : repos)
  if (t >= total) {
    return { phase: 'termine', termine: true, ecoule: total, tour: p.tours, totalTours: p.tours, segment: 2 + p.tours * 2, signal: 'fin',
      resultat: { type: 'intervalles', tours: p.tours, libelle: `${p.tours} tours` } }
  }
  const tour = Math.floor(t / cycle)
  const dans = t % cycle
  const enTravail = dans < travail
  return {
    phase: enTravail ? 'travail' : 'repos', ecoule: t, tour: tour + 1, totalTours: p.tours,
    restant: Math.ceil(((enTravail ? travail : cycle) - dans) / S),
    segment: 2 + tour * 2 + (enTravail ? 0 : 1), signal: enTravail ? (t === 0 ? 'go' : 'travail') : 'repos'
  }
}

// Superset : rythme libre (bouton « suivant » après chaque exercice) ; repos après un passage complet.
function superset(p, t, evs) {
  const exos = p.exercices && p.exercices.length ? p.exercices : ['A', 'B']
  const taille = exos.length
  const totalPas = taille * p.tours
  const suivants = evs.filter((e) => e.type === 'suivant').slice(0, totalPas)
  const passes = evs.filter((e) => e.type === 'passer-repos')
  const n = suivants.length
  if (n >= totalPas) {
    const dernier = suivants[totalPas - 1].ct
    return { phase: 'termine', termine: true, ecoule: dernier, tour: p.tours, totalTours: p.tours, segment: 3 * n + 2, signal: 'fin',
      resultat: { type: 'superset', tours: p.tours, ms: dernier, libelle: `${p.tours} passages en ${formaterChrono(dernier)}` } }
  }
  // Repos après un passage complet (jamais après le dernier).
  let reposActif = false
  let reposFini = false
  let restant = 0
  if (n > 0 && n % taille === 0) {
    const debutRepos = suivants[n - 1].ct
    const passe = passes.find((e) => e.ct >= debutRepos)
    const finRepos = Math.min(debutRepos + p.repos * S, passe ? passe.ct : Infinity)
    if (t < finRepos) { reposActif = true; restant = Math.ceil((finRepos - t) / S) } else reposFini = true
  }
  const sub = reposActif ? 1 : reposFini ? 2 : 0
  return {
    phase: reposActif ? 'repos' : 'travail', ecoule: t, tour: Math.floor(n / taille) + 1, totalTours: p.tours,
    exerciceIndex: n % taille, exerciceCourant: exos[n % taille], restant,
    segment: 3 * n + 2 + sub, signal: reposActif ? 'repos' : n === 0 ? 'go' : 'travail'
  }
}
