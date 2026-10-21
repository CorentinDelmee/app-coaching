// Aperçu d'un workout (page Workout, lot 3) : tout ce que l'écran affiche, calculé ici (pur, testé).
// Les valeurs pré-remplies viennent du moteur de séance (demarrerSeance + template du client) : l'aperçu montre
// donc exactement ce que la séance proposera.
import { demarrerSeance } from '../engine/seance.js'
import { paramsComplets } from '../engine/circuits.js'
import { titreCircuit } from './circuitsUi.js'
import { puces, jetonsSerie } from './seanceUi.js'
import { videoDe } from './video.js'
import { pluriel } from './format.js'
import { mettreAJourTemplate } from './realisations.js'

const TRAVAIL_PAR_SERIE = 40 // secondes estimées pour une série en répétitions
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** « Workout 2 — Haut du corps » -> { titre: 'Workout 2', sous: 'Haut du corps' }. */
export function titreWorkout(nom = '') {
  const m = nom.split(/\s+[—–]\s+/)
  if (m.length < 2) return { titre: nom, sous: '' }
  // « Semaine 2 — Séance A » (programme par semaine) : le numéro de semaine est déjà affiché ailleurs
  if (/^Semaine \d+$/.test(m[0])) return { titre: m.slice(1).join(' — '), sous: m[0] }
  return { titre: m[0], sous: m.slice(1).join(' — ') }
}

/** Durée estimée d'un circuit, en secondes (préparation et explication exclues). */
export function dureeCircuitSec(format, params = {}) {
  const p = paramsComplets(format, params)
  switch (format) {
    case 'amrap': return p.duree
    case 'emom': return p.minutes * 60
    case 'fortime': return p.cap || 600
    case 'timecap': return p.cap
    case 'deathby': return 600
    case 'tabata': case 'intervalles': return p.tours * (p.travail + p.repos)
    case 'superset': return p.tours * (Math.max(2, (p.exercices || []).length) * TRAVAIL_PAR_SERIE + p.repos)
    default: return 0
  }
}

const travailDe = (item) => item.series[0]?.valeurs.tempsTravail ?? item.series[0]?.valeurs.dureeTotale ?? TRAVAIL_PAR_SERIE

/** Durée estimée de la séance en minutes, arrondie à 5 min (« ≈ 50 min »). */
export function dureeEstimeeMin(items) {
  let sec = 0
  const vus = new Set()
  for (const it of items) {
    if (it.type === 'circuit') { sec += dureeCircuitSec(it.format, it.params) + 60; continue }
    if (it.supersetId) {
      if (vus.has(it.supersetId)) continue
      vus.add(it.supersetId)
      const membres = items.filter((x) => x.supersetId === it.supersetId)
      const passages = Math.max(...membres.map((x) => x.series.length))
      sec += passages * (membres.reduce((n, x) => n + travailDe(x), 0) + (it.repos ?? 60))
      continue
    }
    sec += it.series.length * (travailDe(it) + (it.repos ?? 60))
  }
  return Math.max(5, Math.round(sec / 60 / 5) * 5)
}

// Les séries ont-elles toutes la même valeur ? Sinon on les détaille (« 8 × 57,5 kg · 8 × 60 kg »).
function detailSeries(item, unite) {
  const textes = item.series.map((s) => jetonsSerie(item.champs, s.valeurs, unite).map((j) => (j.type === 'sep' ? '×' : j.unite ? `${j.texte} ${j.unite}` : j.texte)).join(' '))
  return new Set(textes).size > 1 ? textes.join(' · ') : null
}

const prerempli = (item) => item.series.some((s) => item.champs.some((c) => c.modifiableParClient && s.valeurs[c.cle] !== s.prescrit[c.cle]))

/**
 * @param {{workout, exercices: object[], template?: object|null, unite?: 'kg'|'lb'}} p
 * @returns {{titre, sous, meta: string[], sections: object[], prerempli: boolean, consigne: string|null, nbSeries: number}}
 *  sections : { kind:'bloc', titre, exos[] } | { kind:'superset', titre, detail, exos[] } | { kind:'circuit', nom, detail, exos[] }
 */
export function apercuWorkout({ workout, exercices, template = null, unite = 'kg' }) {
  const bib = Object.fromEntries(exercices.map((e) => [e.id, e]))
  const items = demarrerSeance({ workout, template }, 0).exercices
  const ligne = (it) => {
    const e = bib[it.exerciceId] || {}
    return {
      id: it.id, nom: e.nom || 'Exercice', description: e.description || null, consignes: it.consignes,
      puces: puces(it, unite), variante: detailSeries(it, unite), prerempli: prerempli(it), video: videoDe(e)
    }
  }
  const sections = []
  let lettre = 0
  let courant = null
  for (const it of items) {
    if (it.type === 'circuit') {
      courant = null
      const t = titreCircuit(it.format, it.params)
      sections.push({
        kind: 'circuit', id: it.id, nom: t.nom, detail: t.detail, libelle: it.nom,
        exos: it.exercices.map((x) => ({ reps: x.reps ?? null, consignes: x.consignes || null, nom: bib[x.exerciceId]?.nom || 'Exercice', video: videoDe(bib[x.exerciceId]) }))
      })
    } else if (it.supersetId) {
      courant = null
      let s = sections.find((x) => x.id === it.supersetId)
      if (!s) {
        s = { kind: 'superset', id: it.supersetId, titre: 'Superset', detail: `repos ${it.repos ?? 60} s après chaque passage`, exos: [] }
        sections.push(s)
      }
      s.exos.push({ ...ligne(it), lettre: LETTRES[s.exos.length] })
    } else {
      if (!courant) { courant = { kind: 'bloc', titre: `Bloc ${LETTRES[lettre++ % 26]}`, exos: [] }; sections.push(courant) }
      courant.exos.push(ligne(it))
    }
  }
  const aDesValeursClient = sections.some((s) => s.exos.some((x) => x.prerempli))
  const nbExos = items.filter((i) => i.type !== 'circuit').length
  const nbCircuits = items.length - nbExos
  const meta = [`≈ ${dureeEstimeeMin(items)} min`]
  if (nbExos) meta.push(`${nbExos} ${pluriel(nbExos, 'exercice', 'exercices')}`)
  if (nbCircuits) meta.push(`${nbCircuits} ${pluriel(nbCircuits, 'circuit', 'circuits')}`)
  const { titre, sous } = titreWorkout(workout.nom)
  return {
    titre, sous, meta, sections, prerempli: aDesValeursClient, consigne: workout.consignes?.trim() || null,
    nbSeries: items.reduce((n, i) => n + (i.type === 'circuit' ? 0 : i.series.length), 0)
  }
}

/** État du bouton principal : démarrer / refaire (déjà fait aujourd'hui) / reprendre (séance interrompue). */
export function etatBouton({ workoutId, aujourdhui, realisations, enCours }) {
  if (enCours && enCours.workoutId === workoutId) return { action: 'reprendre', libelle: 'Reprendre la séance', mention: 'Séance en cours' }
  if (realisations.some((r) => r.workoutId === workoutId && r.date === aujourdhui)) return { action: 'refaire', libelle: 'Refaire la séance', mention: 'Fait aujourd\'hui' }
  return { action: 'demarrer', libelle: 'Démarrer la séance', mention: null }
}

/**
 * Template à utiliser pour afficher le workout d'un jour donné (récap de la semaine) :
 * séance faite ce jour-là -> ses valeurs réalisées (la plus récente si plusieurs) ; sinon le template courant.
 */
export function templatePourJour({ template, realisations, workoutId, jour }) {
  if (!jour) return template
  const faites = realisations.filter((r) => r.workoutId === workoutId && r.date === jour).sort((a, b) => (a.termineLe ?? 0) - (b.termineLe ?? 0))
  const derniere = faites[faites.length - 1]
  return derniere ? mettreAJourTemplate(null, derniere) : template
}
