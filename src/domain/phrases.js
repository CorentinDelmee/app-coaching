// Petite phrase au-dessus des chiffres d'un chrono (M2). Pure et testée : elle ne dépend que de la phase et du temps restant.
import { CHOIX, PHRASES } from '../config/apparence.js'

/** Secondes avant la fin d'un repos où la phrase passe à « On y retourne. ». */
export const SEUIL_RETOUR = 5

const phrases = (adresse = CHOIX.adresse) => PHRASES[adresse] || PHRASES.vous

/** Chrono d'une série : phase 'prep' | 'travail' | 'repos', `restant` en secondes. */
export function phraseSerie(phase, restant, adresse) {
  const p = phrases(adresse)
  if (phase === 'prep') return p.prep
  if (phase === 'travail') return restant <= 0 ? p.fin : p.travail
  return restant <= SEUIL_RETOUR ? p.reposFin : p.repos
}

/** Chrono de circuit : `theme` 'prep' | 'travail' | 'repos' (modèle d'affichage), `termine` quand le circuit est fini. */
export function phraseCircuit({ theme, termine }, adresse) {
  const p = phrases(adresse)
  if (termine) return p.fin
  if (theme === 'repos') return p.repos
  if (theme === 'prep') return p.prep
  return p.travail
}
