// Qui a le droit d'aller où (pur, testé). Renvoie null (accès autorisé) ou le chemin vers lequel rediriger.
import { consentementRepondu } from '../domain/consentement.js'

const PUBLIQUES = ['bienvenue', 'connexion', 'confidentialite']
const estCoach = (chemin) => /^\/coach(\/|$)/.test(chemin)

export function redirection({ user, nom, chemin }) {
  const publique = PUBLIQUES.includes(nom)
  if (!user) return publique ? null : '/bienvenue'
  if (user.role === 'coach') return estCoach(chemin) || nom === 'confidentialite' ? null : '/coach'
  if (estCoach(chemin) || nom === 'bienvenue' || nom === 'connexion') return '/'
  // premier lancement : le consentement passe avant tout (sauf la page Confidentialité qu'il cite)
  if (!consentementRepondu(user) && nom !== 'consentement' && nom !== 'confidentialite') return '/consentement'
  return null
}
