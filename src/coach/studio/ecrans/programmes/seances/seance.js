// Séance (workout) dans l'éditeur Studio : validation lisible, nettoyage avant écriture, opérations de liste. Fonctions pures.
import { copie, nouveauBloc, synchroniserExercicesCircuit } from '../../../../logique.js'

/** Premier problème qui empêche l'enregistrement (texte affiché), ou '' si la séance peut être écrite. Mêmes règles que l'ancien éditeur. */
export function problemeSeance(w) {
  if (!w) return ''
  if (!w.nom?.trim()) return 'Donne un nom à la séance.'
  if (!w.blocs?.length) return 'Ajoute au moins un bloc à la séance.'
  for (const [i, b] of w.blocs.entries()) {
    if (b.type === 'circuit' && !b.exercices.length) return `Le circuit (bloc ${i + 1}) doit contenir au moins un exercice.`
    if (b.type === 'circuit' && b.exercices.some((x) => !x.exerciceId)) return `Chaque exercice du circuit (bloc ${i + 1}) doit être choisi.`
    if (b.type === 'exercice' && !b.exerciceId) return `Choisis l'exercice du bloc ${i + 1}.`
    if (b.type === 'superset' && b.exercices.some((x) => !x.exerciceId)) return `Chaque exercice du superset (bloc ${i + 1}) doit être choisi.`
  }
  return ''
}

/** Copie prête à écrire (nom rogné, champs vides retirés), comme l'ancien bouton Enregistrer. */
export function nettoyerSeance(w) {
  const c = { ...copie(w), nom: w.nom.trim(), clientId: w.clientId || null }
  if (!c.consignes?.trim()) delete c.consignes
  for (const b of c.blocs) {
    if (b.type === 'circuit' && !b.facultatif) delete b.facultatif
    if (b.type === 'exercice' && !b.consignes?.trim()) delete b.consignes
  }
  return c
}

/** Nouveau bloc « exercice » pour l'exercice choisi dans la bibliothèque (3 séries poids/reps, repos conseillé de la fiche sinon 90 s). */
export function blocPour(exerciceId, uuid, exercice = null) {
  const b = nouveauBloc('exercice', uuid, exerciceId)
  if (Number.isInteger(exercice?.reposConseille)) b.repos = exercice.reposConseille // repos conseillé de la fiche
  return b
}

/** Exercice de circuit (le modèle ne lui donne pas d'id). */
export const exoCircuit = (exerciceId) => ({ exerciceId, reps: 10 })

/** Après tout changement dans un circuit : resynchronise params.exercices (emom, superset chrono). */
export const resynchroniser = (bloc) => (bloc.type === 'circuit' ? Object.assign(bloc, synchroniserExercicesCircuit(bloc)) : bloc)

/** Nombre d'exercices d'une séance (méta de l'en-tête). */
export const nbExercices = (w) => (w?.blocs || []).reduce((n, b) => n + (b.type === 'exercice' ? 1 : (b.exercices || []).length), 0)

/** « 3 × 10 reps · 60 kg » : séries d'un item d'après sa 1re série (champs reps, poids, temps de travail, tempo). */
export function resumeSeries(item) {
  const s = item.series?.[0] || {}
  const n = item.series?.length || 0
  const cles = (item.champs || []).map((c) => c.cle)
  const parties = []
  if (cles.includes('reps')) parties.push(`${n} × ${s.reps ?? '?'}`)
  else if (cles.includes('tempsTravail')) parties.push(`${n} × ${s.tempsTravail ?? '?'} s`)
  else if (cles.includes('repsAuMax') && s.repsAuMax) parties.push(`${n} × max`)
  else parties.push(`${n} série${n > 1 ? 's' : ''}`)
  if (cles.includes('poids') && Number(s.poids) > 0) parties.push(`${s.poids} kg`)
  if (cles.includes('tempo') && s.tempo) parties.push(`tempo ${s.tempo}`)
  return parties.join(' · ')
}

/** Ligne de résumé d'un bloc replié. */
export function resumeBloc(b, nomExo, libelleFormat = (f) => f) {
  if (b.type === 'exercice') return [resumeSeries(b), b.repos != null ? `repos ${b.repos} s` : ''].filter(Boolean).join(' · ')
  if (b.type === 'superset') return [b.exercices.map((x, j) => `${String.fromCharCode(65 + j)} ${resumeSeries(x)}`).join(' / '), b.repos != null ? `repos ${b.repos} s` : ''].filter(Boolean).join(' · ')
  const n = b.exercices.length
  return [libelleFormat(b.format), `${n} exercice${n > 1 ? 's' : ''}`, b.exercices.slice(0, 4).map((x) => nomExo(x.exerciceId)).join(', ')].filter(Boolean).join(' · ')
}

/** `?client=` d'une nouvelle séance : accepté seulement si c'est l'id d'un client connu (un lien piégé ne rattache rien). */
export const clientDeLien = (id, clients = []) => (typeof id === 'string' && clients.some((c) => c.id === id) ? id : null)
