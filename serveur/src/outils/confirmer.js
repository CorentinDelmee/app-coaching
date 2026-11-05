// Suppressions EN DEUX TEMPS pour tous les lots : 1er appel sans jeton = résumé + jeton (5 min), rien n'est supprimé ;
// 2e appel avec le jeton = exécution. Un jeton ne sert qu'une fois et seulement pour la même action (clé).
import { randomBytes } from 'node:crypto'

export function creerConfirmations(now = () => Date.now(), dureeMs = 5 * 60 * 1000) {
  const jetons = new Map()
  const purger = () => { for (const [j, e] of jetons) if (e.expire < now()) jetons.delete(j) }
  return {
    /** cle = action précise, ex. `archiver_client:<id>` ; resume = texte lisible de ce qui sera fait. */
    demander(cle, resume) {
      purger()
      const jeton = randomBytes(16).toString('hex')
      jetons.set(jeton, { cle, expire: now() + dureeMs })
      return { confirmationRequise: true, jeton, resume, message: 'Rien n\'est fait. Rappelle le même outil avec ce jeton (valable 5 min) pour confirmer.' }
    },
    /** Vrai si le jeton existe, n'a pas expiré et correspond à la même action. Consomme le jeton. */
    verifier(cle, jeton) {
      const e = jetons.get(jeton)
      jetons.delete(jeton)
      return !!e && e.cle === cle && e.expire >= now()
    }
  }
}
