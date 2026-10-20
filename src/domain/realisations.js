// Enregistrement d'une séance terminée : réalisation, template client, file d'attente hors connexion.
import { jourLocal, lundiDe } from './dates.js'

/**
 * Transforme l'état d'une séance terminée (engine/seance) en `Realisation`.
 * Les valeurs d'une série non faite valent `null` (elles ne mettront pas le template à jour).
 */
export function construireRealisation(etat, { id, clientId, programmeId, now }) {
  if (!etat.terminee) throw new Error('La séance n\'est pas terminée')
  const date = jourLocal(now)
  const valeurs = {}
  const circuits = {}
  for (const it of etat.exercices) {
    if (it.type === 'circuit') {
      if (it.faite) circuits[it.id] = it.resultat
      continue
    }
    valeurs[it.id] = { exerciceId: it.exerciceId, series: it.series.map((s) => (s.faite ? { ...s.valeurs } : null)) }
  }
  const r = {
    id, clientId: clientId ?? etat.clientId, workoutId: etat.workoutId, date, semaine: lundiDe(date),
    valeurs, circuits, dureeSec: etat.resume.dureeSec, volume: etat.resume.volume, seriesFaites: etat.resume.seriesFaites,
    termineLe: now
  }
  if (programmeId) r.programmeId = programmeId
  // Un commentaire (même court) déclenche une alerte côté coach (voir domain/alertes).
  if (etat.commentaire && etat.commentaire.trim()) r.commentaire = etat.commentaire.trim()
  return r
}

/**
 * Met à jour le template du client avec les valeurs réellement validées.
 * Les séries non faites conservent l'ancienne valeur du template.
 */
export function mettreAJourTemplate(template, realisation) {
  const base = template || { id: realisation.clientId, valeurs: {} }
  const valeurs = structuredClone(base.valeurs)
  const parWorkout = (valeurs[realisation.workoutId] ||= {})
  for (const [blocId, { series }] of Object.entries(realisation.valeurs)) {
    const ancien = parWorkout[blocId] || []
    parWorkout[blocId] = series.map((s, i) => {
      if (!s) return ancien[i] ?? null
      const propres = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null && v !== undefined))
      return { ...(ancien[i] || {}), ...propres }
    })
  }
  return { ...base, valeurs }
}

/**
 * Applique une réalisation à { realisations, template }. Idempotent : même `id` = rien de nouveau.
 * @returns {{realisations, template, ajoutee: boolean}}
 */
export function appliquerRealisation({ realisations, template }, realisation) {
  if (realisations.some((r) => r.id === realisation.id)) return { realisations, template, ajoutee: false }
  return {
    realisations: [...realisations, realisation],
    template: mettreAJourTemplate(template, realisation),
    ajoutee: true
  }
}

/** Rejoue une file d'attente (pure) : doublons ignorés, ordre chronologique. */
export function fusionnerFile({ realisations, template }, file) {
  let etat = { realisations, template, ajoutee: false }
  let ajoutees = 0
  for (const r of [...file].sort((a, b) => a.termineLe - b.termineLe)) {
    etat = appliquerRealisation(etat, r)
    if (etat.ajoutee) ajoutees++
  }
  return { realisations: etat.realisations, template: etat.template, ajoutees }
}

/** Meilleure charge connue par exercice (pour détecter les records). */
export function meilleuresCharges(realisations) {
  const meilleures = {}
  for (const r of realisations) {
    for (const { exerciceId, series } of Object.values(r.valeurs)) {
      for (const s of series) {
        if (s && typeof s.poids === 'number' && s.poids > (meilleures[exerciceId] ?? 0)) meilleures[exerciceId] = s.poids
      }
    }
  }
  return meilleures
}
