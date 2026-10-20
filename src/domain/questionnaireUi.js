// Logique pure de l'écran Questionnaires (lot 7) : liste, valeur de départ, validation d'une question, réponses -> mesures.
import { ajouterJours, lundiDe } from './dates.js'
import { nombreFr } from './unites.js'
import { SEUIL_DOULEUR } from './alertes.js'

export const LIBELLES_EMOJIS = ['Très bas', 'Bas', 'Moyen', 'Bien', 'Au top']
export const GROUPES = { quotidien: 'Chaque jour', hebdo: 'Chaque semaine', ponctuel: "À l'occasion" }

const arrondir = (v) => Math.round(v * 10000) / 10000

/** « tourDeTaille » -> « Tour de taille ». */
export function libelleCourt(cle) {
  const t = String(cle).replace(/([A-Z])/g, ' $1').toLowerCase().trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Une réponse existe-t-elle pour la période du questionnaire ? (jour, semaine lundi-dimanche, ou jamais pour un ponctuel) */
export function reponseDeLaPeriode(q, reponses, clientId, aujourdhui) {
  const lundi = lundiDe(aujourdhui)
  const dimanche = ajouterJours(lundi, 6)
  const mes = reponses.filter((r) => r.clientId === clientId && r.questionnaireId === q.id)
  if (q.frequence === 'quotidien') return mes.find((r) => r.date === aujourdhui) || null
  if (q.frequence === 'hebdo') return mes.find((r) => r.date >= lundi && r.date <= dimanche) || null
  return mes[0] || null
}

/** Durée affichée sur la carte : ~ 20 s par question, au moins 1 min. */
export const dureeEstimee = (q) => Math.max(1, Math.round((q.questions.length * 20) / 60))

/**
 * Liste de l'écran : une ligne par questionnaire du client, groupées par fréquence, « à faire » d'abord.
 * `brouillons` : { [questionnaireId]: { index } } pour afficher « En cours ».
 */
export function listeQuestionnaires({ questionnaires, reponses, clientId, aujourdhui, brouillons = {} }) {
  const lignes = questionnaires
    .filter((q) => !q.archive && (!q.clientId || q.clientId === clientId))
    .map((q) => {
      const rep = reponseDeLaPeriode(q, reponses, clientId, aujourdhui)
      const fait = !!rep
      const brouillon = !fait ? brouillons[q.id] : null
      const texte = fait
        ? q.frequence === 'quotidien' ? "Déjà fait aujourd'hui" : q.frequence === 'hebdo' ? 'Fait cette semaine' : 'Déjà rempli'
        : brouillon ? `En cours · question ${brouillon.index + 1} sur ${q.questions.length}` : `${q.questions.length} questions · ~${dureeEstimee(q)} min`
      return { questionnaire: q, fait, texte, enCours: !!brouillon }
    })
  return Object.keys(GROUPES).map((f) => ({
    frequence: f, titre: GROUPES[f],
    lignes: lignes.filter((l) => l.questionnaire.frequence === f).sort((a, b) => Number(a.fait) - Number(b.fait))
  })).filter((g) => g.lignes.length)
}

/** Valeur de départ d'une question. Les nombres restent vides tant que le client n'a pas réglé la roue (sauf valeur précédente). */
export function valeurInitiale(question, derniere) {
  switch (question.type) {
    case 'curseur': return question.defaut ?? Math.round(((question.min ?? 0) + (question.max ?? 10)) / 2)
    case 'nombre': return typeof derniere === 'number' ? derniere : null
    case 'choixMultiple': return []
    default: return null
  }
}

/** Peut-on passer à la question suivante ? (une question facultative se passe toujours) */
export function peutContinuer(question, valeur) {
  if (question.optionnel) return true
  switch (question.type) {
    case 'curseur': case 'nombre': return typeof valeur === 'number' && Number.isFinite(valeur)
    case 'choixMultiple': return Array.isArray(valeur) && valeur.length > 0
    case 'texte': return typeof valeur === 'string' && valeur.trim() !== ''
    default: return valeur !== null && valeur !== undefined && valeur !== ''
  }
}

const vide = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)

/** Garde seulement les questions répondues (une question facultative laissée vide n'est pas enregistrée). */
export function valeursAEnregistrer(questionnaire, brouillon) {
  const out = {}
  for (const q of questionnaire.questions) {
    const v = brouillon[q.cle]
    if (vide(v)) continue
    out[q.cle] = typeof v === 'string' ? v.trim() : Array.isArray(v) ? [...v] : v // copie simple : jamais de proxy Vue dans le stockage
  }
  return out
}

/** Config de la roue de valeur pour un nombre (même forme que domain/roue.configRoue). */
export function configNombre({ cle, libelle, unite = '', min = 0, max = 1000, pas = 1, defaut }, valeur) {
  const nb = Math.round((max - min) / pas) + 1
  const depart = typeof valeur === 'number' ? valeur : defaut ?? (min + max) / 2
  const indexDe = (v) => Math.max(0, Math.min(nb - 1, Math.round(((typeof v === 'number' ? v : depart) - min) / pas)))
  const valeurDe = (i) => arrondir(min + i * pas)
  return { cle, label: libelle || cle, unite, min, max, pas, nb, index: indexDe(depart), valeurDe, indexDe, stocke: valeurDe }
}

/** Une réponse hebdo (poids, tours en cm) alimente aussi le suivi : renvoie { poids?, mensurations? } ou null. */
export function mesureDepuisReponse(questionnaire, valeurs) {
  let poids
  const mensurations = {}
  for (const q of questionnaire.questions) {
    const v = valeurs[q.cle]
    if (q.type !== 'nombre' || typeof v !== 'number') continue
    if (q.cle === 'poids' && q.unite === 'kg') poids = v
    else if (q.unite === 'cm') mensurations[q.cle] = v
  }
  if (poids === undefined && !Object.keys(mensurations).length) return null
  const m = {}
  if (poids !== undefined) m.poids = poids
  if (Object.keys(mensurations).length) m.mensurations = mensurations
  return m
}

export const douleurAlertante = (valeurs) => typeof valeurs?.douleur === 'number' && valeurs.douleur > SEUIL_DOULEUR

/** Petites pastilles du récapitulatif de fin (3 max) : curseurs, nombres, émojis. */
export function resumeFin(questionnaire, valeurs) {
  const out = []
  for (const q of questionnaire.questions) {
    const v = valeurs[q.cle]
    if (v === undefined) continue
    if (q.type === 'curseur') out.push(`${libelleCourt(q.cle)} ${v}/${q.max ?? 10}`)
    else if (q.type === 'nombre') out.push(`${libelleCourt(q.cle)} ${nombreFr(v)} ${q.unite || ''}`.trim())
    else if (q.type === 'emojis') out.push(v)
  }
  return out.slice(0, 3)
}

/** Id d'une réponse : un seul enregistrement par client, questionnaire et jour. */
export const idReponse = (clientId, questionnaireId, jour) => `rep-${clientId}-${questionnaireId}-${jour}`
export const idMesure = (clientId, jour) => `mes-${clientId}-${jour}`
