// Concurrence optimiste (« dernière écriture gagne » interdite quand l'écran connaît la version qu'il modifie).
// Chaque ligne de ces entités porte `version` (entier, 1 à la création, +1 à CHAQUE écriture, quel que soit le chemin :
// app, API REST coach, outils MCP). La version stockée fait foi : une `version` présente dans l'objet écrit est ignorée.
// Une écriture qui annonce `versionAttendue` différente de la version stockée est refusée : ErreurData('CONFLIT', …, { actuel }).
// Sans `versionAttendue` (outils MCP, anciens écrans, anciennes versions de l'app) : écriture acceptée, comme avant.
import { ErreurData } from './erreurs.js'

export const ENTITES_VERSIONNEES = new Set(['profils', 'exercices', 'workouts', 'programmes', 'questionnaires'])

export const MESSAGE_CONFLIT = 'Modifié ailleurs (Claude ou un autre appareil)'

/** Version d'une ligne stockée (lignes antérieures à la migration : 1). */
export const versionDe = (obj) => (Number.isInteger(obj?.version) && obj.version > 0 ? obj.version : 1)

/** Lit la version attendue d'une option ({ version }) : entier > 0, sinon undefined (= pas de contrôle). */
export const versionAttendueDe = (v) => (Number.isInteger(v) && v > 0 ? v : undefined)

export const erreurConflit = (actuel) => new ErreurData('CONFLIT', MESSAGE_CONFLIT, { actuel })

/**
 * Objet à stocker pour une écriture : `actuel` = ligne stockée (ou null), `obj` = ce qu'on veut écrire.
 * Lève CONFLIT si `versionAttendue` est donnée et ne correspond pas. Entité non versionnée : `obj` inchangé.
 */
export function versionner(entite, actuel, obj, versionAttendue) {
  if (!ENTITES_VERSIONNEES.has(entite)) return obj
  const attendue = versionAttendueDe(versionAttendue)
  if (attendue !== undefined && !actuel) throw erreurConflit(null) // ligne supprimée entre-temps : pas de recréation (audit R1)
  if (attendue !== undefined && attendue !== versionDe(actuel)) throw erreurConflit(actuel)
  return { ...obj, version: actuel ? versionDe(actuel) + 1 : 1 }
}

/** Ligne lue avec sa version (les lignes jamais réécrites depuis l'ajout des versions valent 1). */
export const avecVersion = (entite, obj) => (obj && ENTITES_VERSIONNEES.has(entite) ? { ...obj, version: versionDe(obj) } : obj)
