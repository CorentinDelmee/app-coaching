// Moteur de séance : réducteur pur `reduire(etat, action, now) -> etat`.
// L'état est du JSON pur (sauvegardable après chaque action, repris tel quel après fermeture de l'app).
// Chaque appel renvoie un NOUVEL état dont `evenements` liste ce qui vient de se passer — pour que
// l'interface déclenche sons, vibrations et animations :
//   serie-validee · repos-demarre · repos-fini{son,vibration} · travail-demarre · travail-fini{son,vibration}
//   exercice-termine · avance-auto-prevue{vers,finLe} · avance{vers} · seance-complete · refuse{raison} · seance-terminee
// Les temps sont des millisecondes de l'horloge de l'appelant (`now`) ; rien ici ne lit l'heure.
// Appeler `{ type: 'tick' }` régulièrement (ex. 4 fois par seconde) pour faire avancer repos/travail/avance auto.
//
// Actions : demarrer · modifierValeur · validerSerie · lancerSerie · annulerTravail · ajouterRepos · passerRepos ·
//           rester · allerA · terminerCircuit · commenter · terminer · tick
import { CHAMPS } from '../domain/modele.js'

export const DELAI_AVANCE_AUTO = 3000
export const REPOS_DEFAUT = 60
export const BONUS_REPOS = 15

const num = (v) => typeof v === 'number' && Number.isFinite(v)

// --- Construction ---------------------------------------------------------------------------------

function champsDe(item) {
  if (item.champs) return item.champs
  const cles = Object.keys(item.series?.[0] || {})
  return cles.map((cle) => ({ cle, modifiableParClient: true }))
}

// Dernière valeur connue du template pour la série i (les séries non faites sont `null`).
function valeurTemplate(tpl, i, cle) {
  if (!Array.isArray(tpl)) return undefined
  const direct = tpl[i]
  if (direct && direct[cle] !== undefined && direct[cle] !== null) return direct[cle]
  for (let j = Math.min(i, tpl.length - 1); j >= 0; j--) {
    if (tpl[j] && tpl[j][cle] !== undefined && tpl[j][cle] !== null) return tpl[j][cle]
  }
  return undefined
}

function construireSeries(item, tpl) {
  const champs = champsDe(item)
  return item.series.map((prescrit, i) => {
    const valeurs = {}
    for (const c of champs) {
      // Champ fixé par le coach : toujours la valeur prescrite. Sinon : template client, puis prescrit, sinon vide.
      const t = c.modifiableParClient ? valeurTemplate(tpl, i, c.cle) : undefined
      valeurs[c.cle] = t ?? prescrit[c.cle] ?? null
    }
    return { valeurs, prescrit: { ...prescrit }, faite: false, faiteLe: null }
  })
}

function construireExercices(workout, template) {
  const tplWorkout = template?.valeurs?.[workout.id] || {}
  const items = []
  for (const b of workout.blocs) {
    if (b.type === 'exercice') {
      items.push({
        id: b.id, type: 'exercice', exerciceId: b.exerciceId, consignes: b.consignes || null, repos: b.repos ?? null,
        champs: champsDe(b), supersetId: null, series: construireSeries(b, tplWorkout[b.id])
      })
    } else if (b.type === 'superset') {
      b.exercices.forEach((x, j) => items.push({
        id: x.id, type: 'exercice', exerciceId: x.exerciceId, consignes: x.consignes || null, repos: b.repos ?? null,
        champs: champsDe(x), supersetId: b.id, supersetIndex: j, supersetTaille: b.exercices.length,
        series: construireSeries(x, tplWorkout[x.id])
      }))
    } else if (b.type === 'circuit') {
      items.push({
        id: b.id, type: 'circuit', nom: b.nom || null, format: b.format, params: b.params || {}, exercices: b.exercices || [],
        faite: false, resultat: null
      })
    }
  }
  return items
}

/**
 * Crée l'état initial. Peut aussi s'appeler via `reduire(null, { type: 'demarrer', ... }, now)`.
 * @param {{workout, template?, clientId?, recordsAvant?: {[exerciceId]: number}}} p
 *   `recordsAvant` = meilleure charge connue par exercice (voir domain/realisations `meilleuresCharges`).
 */
export function demarrerSeance({ workout, template = null, clientId = null, recordsAvant = {} }, now) {
  return {
    version: 1, workoutId: workout.id, workoutNom: workout.nom, clientId, demarreLe: now,
    exercices: construireExercices(workout, template),
    courant: 0, repos: null, travail: null, avancerAuto: null,
    recordsAvant, commentaire: '', terminee: false, resume: null, evenements: []
  }
}

// --- Requêtes ---------------------------------------------------------------------------------------

const exerciceComplet = (e) => (e.type === 'circuit' ? e.faite : e.series.every((s) => s.faite))

/** Membres d'un superset (indices d'exercices), sinon juste [idx]. */
function groupe(etat, idx) {
  const it = etat.exercices[idx]
  if (!it.supersetId) return [idx]
  return etat.exercices.map((x, i) => (x.supersetId === it.supersetId ? i : -1)).filter((i) => i >= 0)
}

/** Prochaine série non faite dans l'ordre de passage (superset : A1, B1, A2, B2…). */
export function prochaineSerie(etat) {
  const vus = new Set()
  for (let i = 0; i < etat.exercices.length; i++) {
    if (vus.has(i)) continue
    const g = groupe(etat, i)
    g.forEach((x) => vus.add(x))
    if (etat.exercices[i].type === 'circuit') { if (!etat.exercices[i].faite) return { exIdx: i, serieIdx: null } ; continue }
    const nb = Math.max(...g.map((x) => etat.exercices[x].series.length))
    for (let s = 0; s < nb; s++) {
      for (const x of g) {
        const serie = etat.exercices[x].series[s]
        if (serie && !serie.faite) return { exIdx: x, serieIdx: s }
      }
    }
  }
  return null
}

/** Vue dérivée pour l'affichage à l'instant `now` (aucune mutation). */
export function vue(etat, now) {
  const total = etat.exercices.reduce((n, e) => n + (e.type === 'circuit' ? 1 : e.series.length), 0)
  const faites = etat.exercices.reduce((n, e) => n + (e.type === 'circuit' ? (e.faite ? 1 : 0) : e.series.filter((s) => s.faite).length), 0)
  const r = etat.repos
  const w = etat.travail
  return {
    courant: etat.courant, nbExercices: etat.exercices.length, terminee: etat.terminee,
    reposActif: !!r && now < r.finLe,
    reposRestant: r ? Math.max(0, Math.ceil((r.finLe - now) / 1000)) : 0,
    reposDuree: r ? r.duree : 0,
    reposFraction: r ? Math.min(1, Math.max(0, (r.finLe - now) / (r.duree * 1000))) : 0, // 1 -> 0 (anneau)
    travailActif: !!w && now < w.finLe,
    travailRestant: w ? Math.max(0, Math.ceil((w.finLe - now) / 1000)) : 0,
    travailFraction: w ? Math.min(1, Math.max(0, (w.finLe - now) / (w.duree * 1000))) : 0,
    avancerAutoRestant: etat.avancerAuto ? Math.max(0, Math.ceil((etat.avancerAuto.finLe - now) / 1000)) : 0,
    avancerAutoVers: etat.avancerAuto ? etat.avancerAuto.vers : null,
    seriesFaites: faites, seriesTotal: total,
    exercicesFaits: etat.exercices.filter(exerciceComplet).length,
    prochaine: prochaineSerie(etat)
  }
}

// --- Réducteur --------------------------------------------------------------------------------------

export function reduire(etat, action, now) {
  if (action.type === 'demarrer') return demarrerSeance(action, now)
  if (!etat) throw new Error('Aucune séance en cours')
  const e = structuredClone(etat)
  e.evenements = []
  if (e.terminee && action.type !== 'tick') return e
  const f = FONCTIONS[action.type]
  if (!f) throw new Error(`Action de séance inconnue : ${action.type}`)
  f(e, action, now)
  return e
}

const refuser = (e, raison) => e.evenements.push({ type: 'refuse', raison })

function modifierValeur(e, { exIdx, serieIdx, champ, valeur }) {
  const item = e.exercices[exIdx]
  const serie = item?.series?.[serieIdx]
  if (!serie) return refuser(e, 'serie-inconnue')
  const def = item.champs.find((c) => c.cle === champ)
  if (!def) return refuser(e, 'champ-inconnu')
  if (!def.modifiableParClient) return refuser(e, 'champ-verrouille')
  const meta = CHAMPS[champ]
  if (num(valeur)) {
    if (valeur < 0 || (meta?.min !== undefined && valeur < meta.min)) return refuser(e, 'valeur-negative')
    if (meta?.max !== undefined && valeur > meta.max) return refuser(e, 'valeur-trop-grande')
  }
  serie.valeurs[champ] = valeur
}

function dureeRepos(item, serie) {
  const d = serie.valeurs.repos ?? item.repos ?? REPOS_DEFAUT
  return num(d) ? d : REPOS_DEFAUT
}

// Marque la série faite à l'instant `quand` ; démarre le repos ; prépare l'avance automatique.
function validerSerie(e, { exIdx, serieIdx }, quand) {
  const item = e.exercices[exIdx]
  const serie = item?.series?.[serieIdx]
  if (!serie) return refuser(e, 'serie-inconnue')
  if (serie.faite) return
  serie.faite = true
  serie.faiteLe = quand
  if (e.travail && e.travail.exIdx === exIdx && e.travail.serieIdx === serieIdx) e.travail = null
  e.evenements.push({ type: 'serie-validee', exIdx, serieIdx })

  const g = groupe(e, exIdx)
  const toutFait = e.exercices.every(exerciceComplet)
  // Repos : après chaque série, sauf à l'intérieur d'un superset (repos après le passage complet) et après la toute dernière.
  const finDePassage = !item.supersetId || g.every((x) => e.exercices[x].series[serieIdx]?.faite || !e.exercices[x].series[serieIdx])
  if (finDePassage && !toutFait) {
    const duree = dureeRepos(item, serie)
    if (duree > 0) {
      e.repos = { exIdx, serieIdx, debut: quand, finLe: quand + duree * 1000, duree }
      e.evenements.push({ type: 'repos-demarre', duree })
    }
  }
  apresProgression(e, exIdx, quand, toutFait)
}

// Après une série ou un circuit : exercice terminé ? séance complète ? sinon avance automatique.
function apresProgression(e, exIdx, quand, toutFait) {
  const g = groupe(e, exIdx)
  if (!g.every((x) => exerciceComplet(e.exercices[x]))) return
  e.evenements.push({ type: 'exercice-termine', exIdx })
  if (toutFait) return void e.evenements.push({ type: 'seance-complete' })
  const vers = Math.max(...g) + 1
  if (vers < e.exercices.length) {
    e.avancerAuto = { vers, finLe: quand + DELAI_AVANCE_AUTO }
    e.evenements.push({ type: 'avance-auto-prevue', vers, finLe: e.avancerAuto.finLe })
  }
}

function lancerSerie(e, { exIdx, serieIdx }, now) {
  const serie = e.exercices[exIdx]?.series?.[serieIdx]
  if (!serie || serie.faite) return refuser(e, 'serie-inconnue')
  const duree = serie.valeurs.tempsTravail ?? serie.valeurs.dureeTotale
  if (!num(duree) || duree <= 0) return refuser(e, 'pas-de-temps-de-travail')
  e.repos = null // lancer une série interrompt le repos
  e.travail = { exIdx, serieIdx, debut: now, finLe: now + duree * 1000, duree }
  e.evenements.push({ type: 'travail-demarre', duree })
}

function tick(e, _action, now) {
  if (e.terminee) return
  if (e.travail && now >= e.travail.finLe) {
    const { exIdx, serieIdx, finLe } = e.travail
    e.evenements.push({ type: 'travail-fini', exIdx, serieIdx, son: true, vibration: true })
    validerSerie(e, { exIdx, serieIdx }, finLe) // le repos part de la fin du travail, sans dérive
  }
  if (e.repos && now >= e.repos.finLe) {
    e.evenements.push({ type: 'repos-fini', exIdx: e.repos.exIdx, serieIdx: e.repos.serieIdx, son: true, vibration: true })
    e.repos = null
  }
  if (e.avancerAuto && now >= e.avancerAuto.finLe) {
    e.courant = e.avancerAuto.vers
    e.evenements.push({ type: 'avance', vers: e.courant })
    e.avancerAuto = null
  }
}

function terminer(e, action, now) {
  if (typeof action.commentaire === 'string') e.commentaire = action.commentaire
  e.repos = null; e.travail = null; e.avancerAuto = null
  e.terminee = true
  e.resume = resumer(e, now)
  e.evenements.push({ type: 'seance-terminee' })
}

/** Résumé : durée totale, volume (Σ poids × reps), séries faites, records (meilleure charge battue). */
export function resumer(e, now) {
  let volume = 0
  let faites = 0
  let total = 0
  const meilleures = {}
  for (const it of e.exercices) {
    if (it.type === 'circuit') continue
    for (const s of it.series) {
      total++
      if (!s.faite) continue
      faites++
      const { poids, reps } = s.valeurs
      if (num(poids) && num(reps)) volume += poids * reps
      if (num(poids) && poids > (meilleures[it.exerciceId] ?? 0)) meilleures[it.exerciceId] = poids
    }
  }
  const records = Object.entries(meilleures)
    .filter(([id, charge]) => num(e.recordsAvant[id]) && charge > e.recordsAvant[id])
    .map(([exerciceId, charge]) => ({ exerciceId, charge, precedente: e.recordsAvant[exerciceId] }))
  return {
    dureeSec: Math.max(0, Math.round((now - e.demarreLe) / 1000)),
    volume: Math.round(volume * 100) / 100, seriesFaites: faites, seriesTotal: total,
    circuitsFaits: e.exercices.filter((x) => x.type === 'circuit' && x.faite).length, records
  }
}

const FONCTIONS = {
  modifierValeur,
  validerSerie: (e, a, now) => validerSerie(e, a, now),
  lancerSerie,
  annulerTravail: (e) => { e.travail = null },
  ajouterRepos: (e, a) => {
    if (!e.repos) return refuser(e, 'pas-de-repos')
    const s = a.secondes ?? BONUS_REPOS
    e.repos.finLe += s * 1000
    e.repos.duree += s
  },
  passerRepos: (e) => { e.repos = null },
  rester: (e) => { e.avancerAuto = null },
  allerA: (e, { exIdx }) => {
    if (!e.exercices[exIdx]) return refuser(e, 'exercice-inconnu')
    e.courant = exIdx
    e.avancerAuto = null
  },
  terminerCircuit: (e, { exIdx, resultat }, now) => {
    const it = e.exercices[exIdx]
    if (!it || it.type !== 'circuit') return refuser(e, 'pas-un-circuit')
    it.faite = true
    it.resultat = resultat ?? null
    apresProgression(e, exIdx, now, e.exercices.every(exerciceComplet))
  },
  commenter: (e, { texte }) => { e.commentaire = texte },
  terminer,
  tick
}
