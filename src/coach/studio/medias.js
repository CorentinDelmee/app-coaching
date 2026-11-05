// Médias d'un exercice pour le Studio : teinte (groupe musculaire), miniature YouTube, photo. Fonctions pures, testées.
import { idYoutube, urlIntegration } from '../../domain/video.js'

/** Catégorie de l'app (src/coach/logique.js CATEGORIES) -> teinte Studio (data-m). */
const TEINTES = { jambes: 'jambes', poussee: 'pecs', tirage: 'dos', gainage: 'gainage', cardio: 'cardio', mobilite: 'mobilite', dos: 'dos', pecs: 'pecs', epaules: 'epaules', bras: 'bras' }
export const TEINTES_STUDIO = ['jambes', 'dos', 'pecs', 'epaules', 'bras', 'gainage', 'mobilite', 'cardio']

/** Teinte de l'exercice : champ `muscle` s'il existe, sinon 1re catégorie connue, sinon null (repli neutre). */
export function muscleDe(exercice) {
  const candidats = [exercice?.muscle, ...(exercice?.categories || [])]
  for (const c of candidats) if (c && TEINTES[c]) return TEINTES[c]
  return null
}

/** Miniature YouTube réelle (320×180, servie par i.ytimg.com — autorisée par la CSP img-src). */
export const miniatureYoutube = (id) => (id && /^[\w-]{11}$/.test(id) ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null)

/**
 * Ce que la vignette affiche, par ordre : photo (http(s), blob: ou data:image), miniature YouTube, figure de repli.
 * @returns {{ type: 'photo'|'youtube'|'figure', src?: string, id?: string, embed?: string }}
 */
export function mediaDe(exercice) {
  const photo = exercice?.photo || exercice?.photoUrl
  if (typeof photo === 'string' && /^(https?:|blob:|data:image\/)/.test(photo)) return { type: 'photo', src: photo }
  const id = idYoutube(exercice?.lienVideo)
  if (id) return { type: 'youtube', id, src: miniatureYoutube(id), embed: urlIntegration(id) }
  return { type: 'figure' }
}
