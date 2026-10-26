// Garde de build : toute variable VITE_* est copiée EN CLAIR dans le bundle JavaScript public.
// Un build de production avec VITE_API_KEY défini est donc bloqué (audit sécurité du 26/10, point 2).
import { loadEnv } from 'vite'

export const MESSAGE_CLE_API =
  'BUILD BLOQUÉ : VITE_API_KEY est défini. Cette clé serait copiée en clair dans le bundle public (n\'importe qui pourrait piloter le serveur coach). ' +
  'Retirez-la de .env / de l\'environnement pour construire la version de production (elle ne sert qu\'à la démo locale, avec une clé de démo distincte). ' +
  'En production, l\'écran « Vidéos » doit passer par la session du coach (voir serveur/README.md, « Production »).'

/** Lève une erreur si un build de production embarque VITE_API_KEY. */
export function verifierCleApi({ command, mode, env }) {
  if (command === 'build' && mode === 'production' && env.VITE_API_KEY) throw new Error(MESSAGE_CLE_API)
}

/** Plugin Vite : vérifie .env* et l'environnement du processus. */
export function garderCleApi() {
  return {
    name: 'garde-cle-api',
    config(_, { command, mode }) {
      verifierCleApi({ command, mode, env: { ...loadEnv(mode, process.cwd(), 'VITE_'), ...(process.env.VITE_API_KEY ? { VITE_API_KEY: process.env.VITE_API_KEY } : {}) } })
    }
  }
}
