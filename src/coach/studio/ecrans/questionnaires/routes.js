// Routes de l'écran Questionnaires (Studio), relatives à /coach — mêmes URL que les anciennes vues.
export default [
  { path: 'questionnaires', component: () => import('./QuestionnairesListe.vue') },
  { path: 'questionnaires/:id', component: () => import('./QuestionnaireEditeur.vue'), props: true }
]
