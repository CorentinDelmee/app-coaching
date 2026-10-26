// Journal des actions : une ligne JSON par appel (qui, quand, outil, client, résultat). Ne contient jamais de clé.
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function creerJournal(fichier, now = () => Date.now()) {
  mkdirSync(dirname(fichier), { recursive: true })
  return {
    fichier,
    ecrire({ acteur, outil, client = null, ok, resultat = null, erreur = null }) {
      const ligne = { quand: new Date(now()).toISOString(), acteur, outil, client, ok, ...(resultat ? { resultat } : {}), ...(erreur ? { erreur } : {}) }
      appendFileSync(fichier, JSON.stringify(ligne) + '\n')
    }
  }
}
