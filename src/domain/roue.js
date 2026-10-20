// Configuration de la roue de valeur (grand sélecteur) pour un champ de série : bornes, pas, unité.
// Pas du modèle (domain/modele CHAMPS) : poids 0,5 kg · reps 1 · temps 5 s. Jamais de valeur négative.
import { CHAMPS } from './modele.js'
import { poidsAffiche, poidsStocke } from './unites.js'

// Plafond d'affichage de la roue quand le champ n'a pas de maximum métier.
const MAX_ROUE = { poids: 300, reps: 100, tempsTravail: 600, dureeTotale: 3600, repos: 600, resistance: 100, bpm: 250, bpmMax: 250 }

const arrondir = (v) => Math.round(v * 100) / 100

/**
 * @param {string} cle  clé du champ (poids, reps, tempsTravail…)
 * @param {number|null} valeur  valeur actuelle stockée (kg pour le poids)
 * @param {'kg'|'lb'} unitePoids
 * @returns {{cle, label, unite, min, max, pas, nb, index, valeurDe(i), indexDe(v), stocke(i)}}
 */
export function configRoue(cle, valeur, unitePoids = 'kg') {
  const def = CHAMPS[cle] || {}
  const lb = cle === 'poids' && unitePoids === 'lb'
  const pas = lb ? 1 : def.pas || 1
  const min = def.min ?? 0
  const courant = typeof valeur === 'number' ? (cle === 'poids' ? poidsAffiche(valeur, unitePoids) : valeur) : min
  let max = def.max ?? (lb ? Math.round(MAX_ROUE.poids * 2.20462) : MAX_ROUE[cle] ?? 1000)
  if (courant > max) max = Math.ceil(courant / pas) * pas // une valeur fixée par le coach dépasse parfois le plafond
  const nb = Math.round((max - min) / pas) + 1
  const indexDe = (v) => Math.max(0, Math.min(nb - 1, Math.round(((typeof v === 'number' ? v : min) - min) / pas)))
  const valeurDe = (i) => arrondir(min + i * pas)
  return {
    cle, label: def.label || cle, unite: lb ? 'lb' : def.unite || '', min, max, pas, nb,
    index: indexDe(courant), valeurDe, indexDe,
    /** Index de la roue -> valeur à enregistrer (kg pour le poids). */
    stocke: (i) => (cle === 'poids' ? poidsStocke(valeurDe(i), unitePoids) : valeurDe(i))
  }
}

/** Le champ se règle-t-il avec la roue ? (nombres seulement ; texte, choix et cases restent affichés tels quels). */
export const estChampNombre = (cle) => CHAMPS[cle]?.type === 'nombre'
