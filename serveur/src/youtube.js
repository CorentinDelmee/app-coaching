// Recherche automatique de vidéos de démonstration : API YouTube Data v3 + score justifié.
// Sans YOUTUBE_API_KEY, le serveur se rabat sur la bibliothèque locale (voir service.js).
import { norm } from './util.js'

/** Durée ISO 8601 de l'API (« PT1M45S ») -> secondes. */
export function dureeIso(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '')
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : null
}

/**
 * Score sur 100 + phrase de justification. Critères : durée (< 2 min de préférence), chaîne reconnue,
 * nombre de vues, pertinence du titre. Fonction pure (testée).
 */
export function scorerVideo({ nom, titre, chaine, duree, vues }, chainesReconnues = []) {
  let score = 0
  const raisons = []
  if (duree != null) {
    if (duree <= 120) { score += 40; raisons.push(`courte (${duree} s)`) }
    else if (duree <= 240) { score += 20; raisons.push(`assez courte (${duree} s)`) }
    else raisons.push(`longue (${duree} s)`)
  }
  if (chaine && chainesReconnues.some((c) => norm(c) === norm(chaine))) { score += 25; raisons.push(`chaîne reconnue (${chaine})`) }
  if (vues > 0) { score += Math.min(20, Math.round(Math.log10(vues) * 3)); raisons.push(`${vues} vues`) }
  const mots = norm(nom).split(' ').filter((m) => m.length > 2)
  const t = norm(titre)
  const trouves = mots.filter((m) => t.includes(m)).length
  if (mots.length) { score += Math.round((15 * trouves) / mots.length); raisons.push(`titre : ${trouves}/${mots.length} mots de l'exercice`) }
  return { score: Math.min(100, score), justification: raisons.join(' ; ') }
}

/** Cherche sur YouTube ; renvoie les vidéos triées par score. `fetchFn` est injectable (tests). */
export async function chercherYoutube(nom, { cle, chainesReconnues = [], limite = 5, fetchFn = fetch }) {
  if (!cle) return []
  const get = async (chemin, params) => {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${chemin}`)
    for (const [k, v] of Object.entries({ ...params, key: cle })) url.searchParams.set(k, v)
    const r = await fetchFn(url)
    if (!r.ok) throw new Error(`YouTube API : HTTP ${r.status}`) // le message ne contient jamais la clé
    return r.json()
  }
  const recherche = await get('search', { part: 'snippet', type: 'video', q: `${nom} exercice démonstration`, maxResults: 10, videoDuration: 'short', relevanceLanguage: 'fr', safeSearch: 'strict' })
  const ids = (recherche.items || []).map((i) => i.id?.videoId).filter(Boolean)
  if (!ids.length) return []
  const details = await get('videos', { part: 'contentDetails,statistics,snippet', id: ids.join(',') })
  return (details.items || [])
    .map((v) => {
      const info = { nom, titre: v.snippet?.title || '', chaine: v.snippet?.channelTitle || '', duree: dureeIso(v.contentDetails?.duration), vues: Number(v.statistics?.viewCount || 0) }
      return { url: `https://www.youtube.com/watch?v=${v.id}`, ...info, ...scorerVideo(info, chainesReconnues) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
}
