// Session de l'utilisateur. Tant que l'écran de connexion n'existe pas (lot 9), en mode local on ouvre
// automatiquement la session de démo de Fabien Vincent. Avec Supabase : la session réelle, ou null.
import { data, mode } from '../data/index.js'

export const COMPTE_DEMO = { identifiant: 'fabien.vincent', code: 'DEMO24' }

export async function utilisateurCourant() {
  let user = await data.utilisateurCourant()
  if (!user && mode === 'local') user = await data.connecter(COMPTE_DEMO.identifiant, COMPTE_DEMO.code)
  return user
}
