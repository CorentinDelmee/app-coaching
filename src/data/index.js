// Point d'entrée UNIQUE des données : les vues importent `data` d'ici, jamais localStorage ni fetch directement.
// VITE_BACKEND=api : serveur app-coaching du VPS (docs/CONTRAT-VPS.md). Sinon : adaptateur local (données factices).
import { creerAdapterLocal } from './adapters/local.js'
import { creerAdapterApi } from './adapters/api.js'
import { avecSynchroApi } from './synchro-api.js'
import { avecInvalidation, creerCacheLectures, creerLectureRapide } from './cache.js'
import { suivre } from '../lib/chargement.js'

export { ErreurData } from './erreurs.js'

/** Choisit l'adaptateur selon l'environnement (`env` = import.meta.env ou un objet de test). */
export function creerData(env = {}, options = {}) {
  if (env.VITE_BACKEND === 'api') return creerAdapterApi(options)
  const local = creerAdapterLocal(options)
  // Démo reliée au serveur (VITE_API_URL) : recopie les séances créées côté serveur (voir synchro-api.js).
  return env.VITE_API_URL ? avecSynchroApi(local, env.VITE_API_URL) : local
}

export const data = creerData(import.meta.env || {})
// Cache des lectures récentes (voir cache.js) : seulement pour l'affichage ; toute écriture passée par `data` l'invalide.
export const cacheLectures = creerCacheLectures()
avecInvalidation(data, cacheLectures)
/** lectureRapide(cle, entites, charger, appliquer, { attendre }) : affiche le cache tout de suite puis la lecture fraîche. */
export const lectureRapide = creerLectureRapide(cacheLectures, { surAttente: suivre })
/** Compte une attente (lecture d'un éditeur, action longue) pour le chargeur : `await attente(data.workouts.lire(id))`. */
export const attente = suivre
export const mode = data.mode
export default data
