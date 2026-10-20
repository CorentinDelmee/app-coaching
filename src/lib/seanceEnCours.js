// Séance en cours sauvegardée localement à chaque action (reprise si l'app est rechargée ou fermée en pleine séance).
// Ce n'est pas une donnée métier : c'est l'état transitoire de l'interface, d'où ce petit module plutôt que src/data/.
// Contenu : { version, workoutId, clientId, realisationId, etat (état du moteur de séance), circuit ({itemId, evenements}|null), sauveLe }
const CLE = 'cdc-coaching/seance-en-cours'
const VERSION = 1

const stockage = () => { try { return globalThis.localStorage || null } catch { return null } }

export function lireSeanceEnCours() {
  try {
    const brut = stockage()?.getItem(CLE)
    if (!brut) return null
    const s = JSON.parse(brut)
    return s && s.version === VERSION && s.etat && s.workoutId ? s : null
  } catch { return null }
}

export function sauverSeanceEnCours(seance) {
  try { stockage()?.setItem(CLE, JSON.stringify({ ...seance, version: VERSION })) } catch { /* quota plein : la séance continue quand même */ }
}

export function effacerSeanceEnCours() {
  try { stockage()?.removeItem(CLE) } catch { /* ignore */ }
}
