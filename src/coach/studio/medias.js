// Médias d'un exercice pour le Studio : teinte (groupe musculaire), miniature YouTube, photo, figure animée. Fonctions pures, testées.
// Accepte la forme d'exercice de docs/CONTRAT-EXERCICES-STUDIO.md (musclesPrincipaux, photo {id,url}, video {statut,duree…})
// ET l'ancienne forme (categories[], lienVideo, photo en chaîne).
import { idYoutube, urlIntegration } from '../../domain/video.js'

export const TEINTES_STUDIO = ['jambes', 'dos', 'pecs', 'epaules', 'bras', 'gainage', 'mobilite', 'cardio']

/** Nom affiché de chaque teinte (la couleur n'est jamais le seul indice : ce nom est écrit à côté). */
export const NOMS_MUSCLES = {
  jambes: 'Jambes', dos: 'Dos', pecs: 'Pectoraux', epaules: 'Épaules', bras: 'Bras', gainage: 'Gainage', mobilite: 'Mobilité', cardio: 'Cardio'
}

/** Mot (muscle libre du contrat, ou catégorie historique de src/coach/logique.js) -> teinte Studio. */
const SYNONYMES = {
  jambes: 'jambes', jambe: 'jambes', quadriceps: 'jambes', ischios: 'jambes', 'ischio-jambiers': 'jambes', fessiers: 'jambes', fessier: 'jambes', mollets: 'jambes', adducteurs: 'jambes',
  dos: 'dos', tirage: 'dos', dorsaux: 'dos', lombaires: 'dos', trapezes: 'dos',
  pecs: 'pecs', pectoraux: 'pecs', poussee: 'pecs', poitrine: 'pecs',
  epaules: 'epaules', epaule: 'epaules', deltoides: 'epaules',
  bras: 'bras', biceps: 'bras', triceps: 'bras', 'avant-bras': 'bras',
  gainage: 'gainage', abdos: 'gainage', abdominaux: 'gainage', core: 'gainage', sangle: 'gainage',
  mobilite: 'mobilite', etirements: 'mobilite', souplesse: 'mobilite',
  cardio: 'cardio', conditionnement: 'cardio'
}
const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Teinte d'un mot libre (« Pectoraux », « fessiers »…) ou null. */
export function teinteDe(mot) {
  if (!mot) return null
  return SYNONYMES[normal(mot)] || null
}

/** Teinte de l'exercice : 1er muscle principal reconnu, sinon `muscle`, sinon 1re catégorie connue, sinon null (repli neutre). */
export function muscleDe(exercice) {
  const candidats = [...(exercice?.musclesPrincipaux || []), exercice?.muscle, ...(exercice?.categories || [])]
  for (const c of candidats) { const t = teinteDe(c); if (t) return t }
  return null
}

/** Nom affiché du groupe : le mot du coach s'il en a écrit un (« Fessiers »), sinon le nom de la teinte, sinon ''. */
export function nomMuscleDe(exercice) {
  const libre = exercice?.musclesPrincipaux?.[0]
  // mot du coach, sauf s'il est exactement le nom d'une teinte (« epaules » -> « Épaules », avec l'accent)
  if (libre) return NOMS_MUSCLES[normal(libre)] || libre.charAt(0).toUpperCase() + libre.slice(1)
  const t = muscleDe(exercice)
  return t ? NOMS_MUSCLES[t] : ''
}

/** Mouvement de la figure de repli (data-mv), choisi selon la teinte. */
const MOUVEMENTS = { jambes: 'squat', dos: 'tirage', pecs: 'pompe', epaules: 'pousse', bras: 'tirage', gainage: 'gainage', mobilite: 'charniere', cardio: 'cardio' }
export const mouvementDe = (exercice) => MOUVEMENTS[muscleDe(exercice)] || 'squat'

/** Miniature YouTube réelle (320×180, servie par i.ytimg.com — autorisée par la CSP img-src). */
export const miniatureYoutube = (id) => (id && /^[\w-]{11}$/.test(id) ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null)

/** Adresse de la photo : contrat `photo.url` (chemin same-origin « /api/… » ou data-URL en local), ou ancienne chaîne. */
export function urlPhoto(exercice) {
  const p = exercice?.photo
  const url = typeof p === 'string' ? p : p?.url || exercice?.photoUrl
  if (typeof url !== 'string') return null
  // same-origin (« /api/app/fichiers?… », jamais « //hote »), http(s), blob:, data:image
  return /^(\/(?!\/)|https?:|blob:|data:image\/)/.test(url) ? url : null
}

/** Statut de la vidéo : 'propose' (Claude l'a proposée, à valider), 'valide', ou 'aucune'. */
export function statutVideo(exercice) {
  const s = exercice?.video?.statut
  if (s === 'propose' || s === 'valide') return s
  return idYoutube(exercice?.lienVideo) || idYoutube(exercice?.video?.url) ? 'valide' : 'aucune'
}

/** Durée en secondes -> « 0:20 », « 1:05 » ; '' si inconnue. */
export function dureeCourte(secondes) {
  const s = Math.round(Number(secondes))
  if (!Number.isFinite(s) || s <= 0) return ''
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Ce que la vignette affiche, par ordre : photo, miniature YouTube, figure de repli.
 * @returns {{ type: 'photo'|'youtube'|'figure', src?: string, id?: string, embed?: string }}
 */
export function mediaDe(exercice) {
  const photo = urlPhoto(exercice)
  if (photo) return { type: 'photo', src: photo }
  const id = idYoutube(exercice?.lienVideo) || idYoutube(exercice?.video?.url)
  if (id) return { type: 'youtube', id, src: miniatureYoutube(id), embed: urlIntegration(id) }
  return { type: 'figure' }
}

/** Identifiant YouTube de l'exercice (pour <LecteurVideo :id>), ou null. */
export const idVideoDe = (exercice) => idYoutube(exercice?.lienVideo) || idYoutube(exercice?.video?.url)

/** Libellés de niveau du contrat. */
export const NIVEAUX = { debutant: 'Débutant', intermediaire: 'Intermédiaire', confirme: 'Confirmé' }
