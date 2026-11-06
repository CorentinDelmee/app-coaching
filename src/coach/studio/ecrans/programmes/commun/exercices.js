// Exercices vus par les éditeurs : teinte (groupe musculaire), recherche sans accents, libellé de muscle. Fonctions pures.
import { muscleDe } from '../../../medias.js'

export const NOMS_MUSCLES = { jambes: 'Jambes', dos: 'Dos', pecs: 'Pectoraux', epaules: 'Épaules', bras: 'Bras', gainage: 'Gainage', mobilite: 'Mobilité', cardio: 'Cardio' }

/** Teinte Studio : 1er muscle principal (contrat exercices enrichis), sinon champ muscle / catégories. */
export function teinte(ex) {
  if (!ex) return null
  for (const m of ex.musclesPrincipaux || []) { const t = muscleDe({ muscle: m }); if (t) return t }
  return muscleDe(ex)
}

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
