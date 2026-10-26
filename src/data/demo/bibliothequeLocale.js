// Bibliothèque d'exercices en MODE DÉMO local (pas de VITE_API_URL) : on part de l'import
// `serveur/donnees/bibliotheque-videos.json` et on garde « valider » / « remplacer » dans localStorage.
// Mêmes règles que le serveur (serveur/src/bibliotheque.js), en plus simple.
import { idYoutube } from '../../domain/video.js'

export const CLE_BIBLIOTHEQUE_DEMO = 'cdc-coaching/1:bibliotheque-demo'

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Entrée de l'import (video.duree_s) -> entrée affichée par la vue (video.duree). */
export function depuisImport(brut) {
  const v = brut.video
  return {
    id: brut.id, nom: brut.nom, statut: ['propose', 'valide', 'remplace'].includes(brut.statut) ? brut.statut : 'propose',
    justification: brut.justification || '',
    video: v?.url ? { url: v.url, titre: v.titre ?? null, chaine: v.chaine ?? null, duree: v.duree_s ?? null } : null
  }
}

/** Valide une vidéo ; les autres entrées du même exercice passent « remplace ». Renvoie une nouvelle liste. */
export function validerEntree(liste, id) {
  const e = liste.find((x) => x.id === id)
  if (!e || !e.video) throw new Error('Entrée introuvable ou sans vidéo')
  return liste.map((x) => x.id === id ? { ...x, statut: 'valide' } : norm(x.nom) === norm(e.nom) && x.statut !== 'remplace' ? { ...x, statut: 'remplace' } : x)
}

/** Remplace la vidéo d'une entrée par un lien YouTube : l'ancienne passe « remplace », la nouvelle est validée. */
export function remplacerEntree(liste, id, url) {
  const ancienne = liste.find((x) => x.id === id)
  const ytId = idYoutube(url)
  if (!ancienne) throw new Error('Entrée introuvable')
  if (!ytId) throw new Error('Lien YouTube invalide')
  const nouvelle = {
    id: `${ancienne.id.replace(/-[\w-]{4}$/, '')}-${ytId.slice(0, 4).toLowerCase()}`, nom: ancienne.nom, statut: 'valide',
    justification: 'Choisie par le coach', video: { url: `https://www.youtube.com/watch?v=${ytId}`, titre: null, chaine: null, duree: null }
  }
  const sans = liste.map((x) => (x.id === id ? { ...x, statut: 'remplace' } : x)).filter((x) => x.id !== nouvelle.id)
  return validerEntree([...sans, nouvelle], nouvelle.id)
}

/** Accès au stockage : lit (import au 1er accès), valide, remplace. `storage` injectable pour les tests. */
export function creerBibliothequeLocale({ storage = globalThis.localStorage, charger = () => import('../../../serveur/donnees/bibliotheque-videos.json').then((m) => m.default.exercices.map(depuisImport)) } = {}) {
  const lire = async () => {
    const brut = storage.getItem(CLE_BIBLIOTHEQUE_DEMO)
    if (brut) return JSON.parse(brut)
    const liste = await charger()
    storage.setItem(CLE_BIBLIOTHEQUE_DEMO, JSON.stringify(liste))
    return liste
  }
  const ecrire = async (fn) => { const liste = fn(await lire()); storage.setItem(CLE_BIBLIOTHEQUE_DEMO, JSON.stringify(liste)); return liste }
  return {
    lister: lire,
    valider: (id) => ecrire((l) => validerEntree(l, id)),
    remplacer: (id, url) => ecrire((l) => remplacerEntree(l, id, url))
  }
}
