// Journal des actions : une ligne JSON par appel (qui, quand, outil, client, résultat). Ne contient jamais de clé.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function creerJournal(fichier, now = () => Date.now()) {
  mkdirSync(dirname(fichier), { recursive: true })
  return {
    fichier,
    /** Supprime les lignes plus vieilles que `jours` jours (appelé au démarrage). Renvoie le nombre de lignes retirées. */
    purger(jours = 90) {
      if (!existsSync(fichier) || !(jours > 0)) return 0
      const limite = now() - jours * 864e5
      const lignes = readFileSync(fichier, 'utf8').split('\n').filter(Boolean)
      const gardees = lignes.filter((l) => { try { return Date.parse(JSON.parse(l).quand) >= limite } catch { return false } })
      if (gardees.length !== lignes.length) writeFileSync(fichier, gardees.length ? gardees.join('\n') + '\n' : '')
      return lignes.length - gardees.length
    },
    ecrire({ acteur, outil, client = null, ok, resultat = null, erreur = null }) {
      const ligne = { quand: new Date(now()).toISOString(), acteur, outil, client, ok, ...(resultat ? { resultat } : {}), ...(erreur ? { erreur } : {}) }
      appendFileSync(fichier, JSON.stringify(ligne) + '\n')
    }
  }
}
