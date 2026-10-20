// Brouillon d'un questionnaire en cours (reprise à la question où on s'est arrêté). État d'interface, pas une donnée métier :
// d'où ce petit module plutôt que src/data/. Valable pour le jour où il a été commencé ; best effort (un quota plein ne bloque rien).
const cle = (clientId, questionnaireId) => `cdc-coaching/brouillon-q:${clientId}:${questionnaireId}`
const stockage = (s) => { try { return s || globalThis.localStorage || null } catch { return null } }

export function lireBrouillon(clientId, questionnaireId, aujourdhui, storage) {
  try {
    const b = JSON.parse(stockage(storage)?.getItem(cle(clientId, questionnaireId)) || 'null')
    return b && b.date === aujourdhui && Number.isInteger(b.index) && b.valeurs ? b : null
  } catch { return null }
}

export function sauverBrouillon(clientId, questionnaireId, aujourdhui, { index, valeurs }, storage) {
  try { stockage(storage)?.setItem(cle(clientId, questionnaireId), JSON.stringify({ date: aujourdhui, index, valeurs })) } catch { /* brouillon perdu : sans gravité */ }
}

export function effacerBrouillon(clientId, questionnaireId, storage) {
  try { stockage(storage)?.removeItem(cle(clientId, questionnaireId)) } catch { /* ignore */ }
}

/** { [questionnaireId]: { index } } des brouillons du jour, pour la liste. */
export function brouillonsDuJour(clientId, ids, aujourdhui, storage) {
  const out = {}
  for (const id of ids) {
    const b = lireBrouillon(clientId, id, aujourdhui, storage)
    if (b) out[id] = { index: b.index }
  }
  return out
}
