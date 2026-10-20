// Enregistre une mesure (poids et/ou mensurations) pour un jour : une seule ligne par client et par jour, fusionnée si elle existe déjà.
import { idMesure } from '../domain/questionnaireUi.js'

/** `data` : l'interface de src/data ; `partiel` : { poids?, mensurations?: { cle: cm } }. */
export async function enregistrerMesure(data, clientId, date, partiel) {
  const existante = (await data.mesures.lister({ clientId })).find((m) => m.date === date)
  if (!existante) return data.mesures.creer({ id: idMesure(clientId, date), clientId, date, ...partiel })
  const fusion = { poids: partiel.poids ?? existante.poids }
  const mensurations = { ...existante.mensurations, ...partiel.mensurations }
  if (Object.keys(mensurations).length) fusion.mensurations = mensurations
  return data.mesures.modifier(existante.id, fusion)
}
