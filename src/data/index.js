// Point d'entrée UNIQUE des données : les vues importent `data` d'ici, jamais localStorage ni Supabase.
// Supabase si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies, sinon adaptateur local (données factices).
import { creerAdapterLocal } from './adapters/local.js'
import { creerAdapterSupabase } from './adapters/supabase.js'

export { ErreurData } from './erreurs.js'

/** Choisit l'adaptateur selon l'environnement (`env` = import.meta.env ou un objet de test). */
export function creerData(env = {}, options = {}) {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  return url && anonKey ? creerAdapterSupabase({ url, anonKey, ...options }) : creerAdapterLocal(options)
}

export const data = creerData(import.meta.env || {})
export const mode = data.mode
export default data
