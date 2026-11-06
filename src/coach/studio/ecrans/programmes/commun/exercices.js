// Exercices vus par les éditeurs : teinte (groupe musculaire), recherche sans accents, libellé de muscle. Fonctions pures.
import { muscleDe, NOMS_MUSCLES } from '../../../medias.js'

export { NOMS_MUSCLES }

/** Teinte Studio (L0 : muscles principaux du contrat, sinon muscle / catégories), null sans exercice. */
export const teinte = (ex) => (ex ? muscleDe(ex) : null)

export const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Filtre la bibliothèque : texte (nom, description, matériel) + teintes choisies (vide = toutes). */
export function filtrerExercices(exercices, { q = '', muscles = [] } = {}) {
  const mots = sansAccents(q).split(/\s+/).filter(Boolean)
  return exercices.filter((e) => {
    if (muscles.length && !muscles.includes(teinte(e))) return false
    if (!mots.length) return true
    const texte = sansAccents([e.nom, e.description, ...(e.materiel || [])].join(' '))
    return mots.every((m) => texte.includes(m))
  })
}

/** « Jambes · Haltères » (méta courte de la vignette). */
export function meta(ex) {
  const t = teinte(ex)
  return [t ? NOMS_MUSCLES[t] : null, (ex?.materiel || [])[0]].filter(Boolean).join(' · ')
}

/** Teintes présentes dans une séance (ordre d'apparition, sans doublon) : bandeau de couleurs des cartes. */
export function teintesSeance(w, parId) {
  const ids = (w?.blocs || []).flatMap((b) => (b.type === 'exercice' ? [b.exerciceId] : (b.exercices || []).map((x) => x.exerciceId)))
  return [...new Set(ids.map((id) => teinte(parId(id))).filter(Boolean))]
}
