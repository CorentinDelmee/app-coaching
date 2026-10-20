// Liens vidéo des exercices : extraction de l'identifiant YouTube et adresse d'intégration (youtube-nocookie).

/** Identifiant (11 caractères) d'un lien YouTube : watch?v=, youtu.be/, /embed/, /shorts/, /live/. null si ce n'est pas YouTube. */
export function idYoutube(lien) {
  if (typeof lien !== 'string') return null
  let url
  try { url = new URL(lien.trim()) } catch { return null }
  const hote = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  let id = null
  if (hote === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
  else if (hote === 'youtube.com' || hote === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)
      if (m) id = m[1]
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

export const urlIntegration = (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&modestbranding=1`

/** Ce qu'on propose pour un exercice : intégrée (YouTube), ouverte (autre lien) ou rien. */
export function videoDe(exercice) {
  const lien = exercice?.lienVideo
  if (!lien) return { type: 'aucune' }
  const id = idYoutube(lien)
  return id ? { type: 'youtube', id, embed: urlIntegration(id), lien } : { type: 'lien', lien }
}
