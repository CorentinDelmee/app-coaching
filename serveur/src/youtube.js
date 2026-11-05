// Recherche automatique de vidéos de démonstration : API YouTube Data v3 + score justifié.
// Sans YOUTUBE_API_KEY, le serveur se rabat sur la bibliothèque locale (voir service.js).
// Règles (2026-11-05) : vidéo de plus de 30 s REFUSÉE, 20 s ou moins favorisée, intégrable seulement ;
// requêtes en français d'abord, anglais en repli. Quota : search = 100 unités, videos.list = 1 unité
// -> au plus 2 recherches (donc ≤ 202 unités) par exercice.
import { norm } from './util.js'

export const DUREE_MAX = 30 // secondes : au-delà, la vidéo est refusée
export const DUREE_IDEALE = 20 // secondes : au plus, elle est favorisée

/** Durée ISO 8601 de l'API (« PT1M45S ») -> secondes. */
export function dureeIso(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '')
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : null
}

/**
 * Score sur 100 + phrase de justification. Critères : durée (≤ 20 s idéal, ≤ 30 s accepté), chaîne reconnue,
 * nombre de vues, pertinence du titre. Fonction pure (testée).
 */
export function scorerVideo({ nom, titre, chaine, duree, vues }, chainesReconnues = []) {
  let score = 0
  const raisons = []
  if (duree != null) {
    if (duree <= DUREE_IDEALE) { score += 40; raisons.push(`très courte (${duree} s)`) }
    else if (duree <= DUREE_MAX) { score += 25; raisons.push(`courte (${duree} s)`) }
    else raisons.push(`trop longue (${duree} s)`)
  }
  if (chaine && chainesReconnues.some((c) => norm(c) === norm(chaine))) { score += 25; raisons.push(`chaîne reconnue (${chaine})`) }
  if (vues > 0) { score += Math.min(20, Math.round(Math.log10(vues) * 3)); raisons.push(`${vues} vues`) }
  const mots = norm(nom).split(' ').filter((m) => m.length > 2)
  const t = norm(titre)
  const trouves = mots.filter((m) => t.includes(m)).length
  if (mots.length) { score += Math.round((15 * trouves) / mots.length); raisons.push(`titre : ${trouves}/${mots.length} mots de l'exercice`) }
  return { score: Math.min(100, score), justification: raisons.join(' ; ') }
}

/**
 * Cherche sur YouTube ; renvoie les vidéos acceptables (≤ 30 s, intégrables, publiques) triées par score.
 * `nomEn` (facultatif) : nom anglais de l'exercice pour la recherche de repli (« goblet squat »).
 * `fetchFn` est injectable (tests).
 */
export async function chercherYoutube(nom, { cle, chainesReconnues = [], limite = 5, fetchFn = fetch, nomEn } = {}) {
  if (!cle) return []
  const get = async (chemin, params) => {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${chemin}`)
    for (const [k, v] of Object.entries({ ...params, key: cle })) url.searchParams.set(k, v)
    const r = await fetchFn(url)
    if (!r.ok) throw new Error(`YouTube API : HTTP ${r.status}`) // le message ne contient jamais la clé
    return r.json()
  }
  const rechercher = async (q, langue) => {
    const recherche = await get('search', { part: 'snippet', type: 'video', q, maxResults: 15, videoDuration: 'short', videoEmbeddable: 'true', relevanceLanguage: langue, regionCode: 'FR', safeSearch: 'strict' })
    const ids = (recherche.items || []).map((i) => i.id?.videoId).filter(Boolean)
    if (!ids.length) return []
    const details = await get('videos', { part: 'contentDetails,status,statistics,snippet', id: ids.join(',') })
    return (details.items || [])
      .filter((v) => v.status?.embeddable === true && (!v.status.privacyStatus || v.status.privacyStatus === 'public'))
      .map((v) => {
        const info = { nom, titre: v.snippet?.title || '', chaine: v.snippet?.channelTitle || '', duree: dureeIso(v.contentDetails?.duration), vues: Number(v.statistics?.viewCount || 0) }
        return { url: `https://www.youtube.com/watch?v=${v.id}`, ...info, ...scorerVideo(info, chainesReconnues) }
      })
      .filter((v) => v.duree != null && v.duree <= DUREE_MAX)
      .sort((a, b) => b.score - a.score)
  }
  let trouvees = await rechercher(`${nom} démonstration`, 'fr')
  if (!trouvees.length) trouvees = await rechercher(`${nomEn || nom} form`, 'en') // repli anglais
  return trouvees.slice(0, limite)
}
