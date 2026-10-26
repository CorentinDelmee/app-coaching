// Point d'entrée UNIQUE des données : les vues importent `data` d'ici, jamais localStorage ni Supabase.
// Supabase si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies, sinon adaptateur local (données factices).
import { creerAdapterLocal } from './adapters/local.js'
import { creerAdapterSupabase } from './adapters/supabase.js'
import { avecSynchroApi } from './synchro-api.js'

export { ErreurData } from './erreurs.js'

/** Choisit l'adaptateur selon l'environnement (`env` = import.meta.env ou un objet de test). */
export function creerData(env = {}, options = {}) {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (url && anonKey) return creerAdapterSupabase({ url, anonKey, ...options })
  const local = creerAdapterLocal(options)
  // Démo reliée au serveur (VITE_API_URL) : recopie les séances créées côté serveur (voir synchro-api.js).
  return env.VITE_API_URL ? avecSynchroApi(local, env.VITE_API_URL) : local
}

export const data = creerData(import.meta.env || {})
export const mode = data.mode
export default data
