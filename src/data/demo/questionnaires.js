// Questionnaires par défaut (clientId null = proposés à tous les clients).
export const QUESTIONNAIRE_QUOTIDIEN = {
  id: 'q-checkin-quotidien', clientId: null, nom: 'Check-in du jour', frequence: 'quotidien',
  questions: [
    { cle: 'sommeil', libelle: 'Comment avez-vous dormi ?', type: 'curseur', min: 0, max: 10, etiquettes: ['Très mal', 'Très bien'] },
    { cle: 'energie', libelle: 'Votre niveau d\'énergie aujourd\'hui ?', type: 'emojis', choix: ['😫', '😕', '😐', '🙂', '🤩'] },
    { cle: 'stress', libelle: 'Votre niveau de stress ?', type: 'curseur', min: 0, max: 10, etiquettes: ['Zen', 'Au maximum'] },
    { cle: 'douleur', libelle: 'Une douleur aujourd\'hui ? (0 = aucune)', type: 'curseur', min: 0, max: 10, etiquettes: ['Aucune', 'Insupportable'], defaut: 0 },
    { cle: 'faim', libelle: 'Votre faim aujourd\'hui ?', type: 'choixUnique', choix: ['Pas faim', 'Normale', 'Très faim'] },
    { cle: 'hydratation', libelle: 'Combien avez-vous bu d\'eau ?', type: 'nombre', unite: 'L', min: 0, max: 10, pas: 0.25, defaut: 1.5 }
  ]
}

export const QUESTIONNAIRE_HEBDO = {
  id: 'q-bilan-hebdo', clientId: null, nom: 'Bilan de la semaine', frequence: 'hebdo',
  questions: [
    { cle: 'poids', libelle: 'Votre poids ce matin', type: 'nombre', unite: 'kg', min: 20, max: 300, pas: 0.1, defaut: 70 },
    { cle: 'tourDeTaille', libelle: 'Tour de taille', type: 'nombre', unite: 'cm', min: 30, max: 250, pas: 0.5, defaut: 80 },
    { cle: 'tourDeHanches', libelle: 'Tour de hanches', type: 'nombre', unite: 'cm', min: 30, max: 250, pas: 0.5, defaut: 95 },
    { cle: 'ressenti', libelle: 'Votre ressenti sur la semaine', type: 'emojis', choix: ['😫', '😕', '😐', '🙂', '🤩'] },
    { cle: 'objectifs', libelle: 'Qu\'est-ce qui s\'est bien passé ?', type: 'choixMultiple', choix: ['Séances faites', 'Alimentation', 'Sommeil', 'Motivation', 'Récupération'] },
    { cle: 'difficulte', libelle: 'Séances de la semaine', type: 'choixUnique', choix: ['Trop faciles', 'Bien dosées', 'Trop dures'] },
    { cle: 'bilan', libelle: 'Votre bilan en quelques mots', type: 'texte', optionnel: true },
    { cle: 'photo', libelle: 'Une photo de votre semaine', type: 'photo', optionnel: true }
  ]
}

export const QUESTIONNAIRES = [QUESTIONNAIRE_QUOTIDIEN, QUESTIONNAIRE_HEBDO]
