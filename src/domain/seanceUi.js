// Libellés et regroupements de l'écran de séance (purs, testés) : lignes de série, puces, boutons, tiroir.
import { CHAMPS } from './modele.js'
import { poidsAffiche, nombreFr } from './unites.js'
import { titreCircuit } from './circuitsUi.js'

const num = (v) => typeof v === 'number' && Number.isFinite(v)

/** Valeur d'un champ pour l'affichage : « 12,5 », « – » si vide, poids converti selon l'unité. */
export function valeurAffichee(cle, valeur, unitePoids = 'kg') {
  if (!num(valeur)) return '–'
  return nombreFr(cle === 'poids' ? poidsAffiche(valeur, unitePoids) : valeur)
}

/**
 * Ligne de série : suite de jetons pour le gabarit.
 *   reps + poids -> 8 × 60 kg · reps seules -> 6 reps · temps -> 30 s · sinon le premier champ numérique.
 * @returns {{ type: 'val'|'sep', texte: string, unite?: string }[]}
 */
export function jetonsSerie(champs, valeurs, unitePoids = 'kg') {
  const cles = champs.map((c) => c.cle)
  const val = (cle, unite) => ({ type: 'val', texte: valeurAffichee(cle, valeurs[cle], unitePoids), unite })
  const aPoids = cles.includes('poids') && num(valeurs.poids) && valeurs.poids > 0
  if (cles.includes('reps') && aPoids) return [val('reps'), { type: 'sep', texte: '×' }, val('poids', unitePoids)]
  if (cles.includes('reps')) return [val('reps', 'reps')]
  if (cles.includes('tempsTravail')) return [val('tempsTravail', 's')]
  if (cles.includes('dureeTotale')) return [val('dureeTotale', 's')]
  const premier = cles.find((c) => CHAMPS[c]?.type === 'nombre')
  return premier ? [val(premier, CHAMPS[premier].unite)] : [{ type: 'val', texte: '–' }]
}

/** Index de la série à faire dans l'exercice (première non faite), -1 si tout est fait. */
export const serieCourante = (item) => item.series.findIndex((s) => !s.faite)

/** Un exercice « au temps » se lance au chrono (temps de travail prescrit) plutôt qu'il ne se valide d'un geste. */
export const estAuTemps = (item) => item.champs.some((c) => c.cle === 'tempsTravail' || c.cle === 'dureeTotale') && !item.champs.some((c) => c.cle === 'reps')

/** Texte du bouton principal d'un exercice. `toutFait` : toutes les séries de la séance sont faites. */
export function libelleAction(item, { toutFait = false, derniereEtape = false } = {}) {
  if (toutFait) return 'Terminer la séance'
  const cur = serieCourante(item)
  if (cur < 0) return derniereEtape ? 'Terminer la séance' : 'Exercice suivant'
  return estAuTemps(item) ? `Lancer la série ${cur + 1}` : `Valider la série ${cur + 1}`
}

/** Puces d'en-tête : « 4 × 8 reps », « 60 kg », « repos 120 s », « 30 s ». */
export function puces(item, unitePoids = 'kg') {
  const s0 = item.series[0]?.valeurs || {}
  const cles = item.champs.map((c) => c.cle)
  const n = item.series.length
  const res = []
  if (cles.includes('reps')) res.push(`${n} × ${valeurAffichee('reps', s0.reps)} reps`)
  else if (cles.includes('tempsTravail') && num(s0.tempsTravail)) res.push(`${n} × ${s0.tempsTravail} s`)
  else if (cles.includes('dureeTotale') && num(s0.dureeTotale)) res.push(`${n} × ${s0.dureeTotale} s`)
  else res.push(`${n} ${n > 1 ? 'séries' : 'série'}`)
  if (num(s0.poids) && s0.poids > 0) res.push(`${valeurAffichee('poids', s0.poids, unitePoids)} ${unitePoids}`)
  if (num(item.repos) && item.repos > 0) res.push(`repos ${item.repos} s`)
  return res
}

/** « Dernière fois : 8 × 57,5 kg » d'après la réalisation la plus récente de cet exercice (null si jamais fait). */
export function derniereFois(realisations, exerciceId, unitePoids = 'kg') {
  const triees = [...realisations].sort((a, b) => (b.termineLe || 0) - (a.termineLe || 0))
  for (const r of triees) {
    for (const bloc of Object.values(r.valeurs || {})) {
      if (bloc.exerciceId !== exerciceId) continue
      const serie = bloc.series.find((s) => s)
      if (!serie) continue
      const jetons = jetonsSerie(Object.keys(serie).map((cle) => ({ cle })), serie, unitePoids)
      return jetons.map((j) => (j.type === 'sep' ? '×' : j.unite ? `${j.texte} ${j.unite}` : j.texte)).join(' ')
    }
  }
  return null
}

/** Détail d'une ligne du tiroir d'overview. */
export function detailTiroir(item, unitePoids = 'kg') {
  if (item.type === 'circuit') { const t = titreCircuit(item.format, item.params); return `${t.nom} · ${t.detail}` }
  return puces(item, unitePoids).slice(0, 2).join(' · ')
}

/** Avancement d'un exercice (0..1) pour la barre de segments. */
export function fractionExercice(item) {
  if (item.type === 'circuit') return item.faite ? 1 : 0
  return item.series.length ? item.series.filter((s) => s.faite).length / item.series.length : 1
}

export const exerciceComplet = (item) => (item.type === 'circuit' ? item.faite : item.series.every((s) => s.faite))

/** 3725 s -> « 62 min » (durée lisible de l'écran de fin). */
export const minutesDe = (sec) => Math.max(1, Math.round(sec / 60))

export const milliers = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
