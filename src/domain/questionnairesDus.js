// Questionnaires à remplir (pastille de l'accueil, liste du lot 7). Pur : `aujourdhui` en paramètre.
import { ajouterJours, lundiDe } from './dates.js'

/**
 * Un questionnaire est « à remplir » si : quotidien -> pas de réponse aujourd'hui ; hebdo -> pas de réponse cette semaine
 * (lundi -> dimanche) ; ponctuel -> jamais rempli. Seuls comptent ceux du client (ou proposés à tous : clientId null).
 */
export function questionnairesDus({ questionnaires, reponses, clientId, aujourdhui }) {
  const lundi = lundiDe(aujourdhui)
  const dimanche = ajouterJours(lundi, 6)
  const siens = reponses.filter((r) => r.clientId === clientId)
  return questionnaires
    .filter((q) => !q.clientId || q.clientId === clientId)
    .filter((q) => {
      const mes = siens.filter((r) => r.questionnaireId === q.id)
      if (q.frequence === 'quotidien') return !mes.some((r) => r.date === aujourdhui)
      if (q.frequence === 'hebdo') return !mes.some((r) => r.date >= lundi && r.date <= dimanche)
      return mes.length === 0
    })
}
