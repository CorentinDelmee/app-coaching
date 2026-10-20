// Registre des entités : nom de collection -> validateur, portée (qui peut les lire) et table Supabase.
import * as M from '../domain/modele.js'

/**
 * portee : 'client'  -> un client ne voit que les lignes où clientId = son id
 *          'libre'   -> lisible par tous les connectés (bibliothèque d'exercices)
 *          'mixte'   -> clientId null (modèle commun) ou le sien
 *          'profil'  -> un client ne voit que son propre profil
 */
export const ENTITES = {
  profils: { valider: M.validerProfil, portee: 'profil', table: 'profiles' },
  exercices: { valider: M.validerExercice, portee: 'libre', table: 'exercices' },
  workouts: { valider: M.validerWorkout, portee: 'client', table: 'workouts' },
  programmes: { valider: M.validerProgramme, portee: 'client', table: 'programmes' },
  realisations: { valider: M.validerRealisation, portee: 'client', table: 'realisations' },
  templates: { valider: M.validerTemplateClient, portee: 'client', table: 'templates_client', cleClient: 'id' },
  seancesCoaching: { valider: M.validerSeanceCoaching, portee: 'client', table: 'seances_coaching' },
  motsDuCoach: { valider: M.validerMotDuCoach, portee: 'client', table: 'mots_du_coach' },
  questionnaires: { valider: M.validerQuestionnaire, portee: 'mixte', table: 'questionnaires' },
  reponses: { valider: M.validerReponse, portee: 'client', table: 'reponses' },
  mesures: { valider: M.validerMesure, portee: 'client', table: 'mesures' },
  douleurs: { valider: M.validerDouleur, portee: 'client', table: 'douleurs' },
  nutrition: { valider: M.validerEntreeNutrition, portee: 'client', table: 'entrees_nutrition' },
  alertesVues: { valider: M.validerAlerteVue, portee: 'client', table: 'alertes_vues' }
}

export const NOMS_ENTITES = Object.keys(ENTITES)

/** Id du client propriétaire d'une ligne (les templates ont id = clientId). */
export const clientDe = (entite, obj) => (ENTITES[entite].cleClient ? obj[ENTITES[entite].cleClient] : obj.clientId ?? null)

/** Une ligne est-elle visible par cet utilisateur ? (miroir des règles RLS de schema.sql) */
export function visiblePar(entite, obj, utilisateur) {
  if (!utilisateur || utilisateur.role === 'coach') return true
  switch (ENTITES[entite].portee) {
    case 'libre': return true
    case 'profil': return obj.id === utilisateur.id
    case 'mixte': return !obj.clientId || obj.clientId === utilisateur.id
    default: return clientDe(entite, obj) === utilisateur.id
  }
}
