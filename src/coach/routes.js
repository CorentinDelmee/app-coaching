// Routes du tableau de bord coach, montées sous « /coach » (ajoutées au routeur par une seule ligne).
import { ouvrirSessionCoach } from './store.js'

export const routeCoach = {
  path: '/coach',
  component: () => import('./CoachLayout.vue'),
  // Un client connecté est renvoyé vers l'accueil ; en mode local le compte coach de démo s'ouvre tout seul.
  beforeEnter: async () => ((await ouvrirSessionCoach()) === 'ok' ? true : '/'),
  children: [
    { path: '', redirect: '/coach/clients' },
    { path: 'clients', component: () => import('./views/ClientsView.vue') },
    { path: 'clients/:id', component: () => import('./views/ClientView.vue'), props: true },
    { path: 'alertes', component: () => import('./views/AlertesView.vue') },
    { path: 'exercices', component: () => import('./views/ExercicesView.vue') },
    { path: 'seances', component: () => import('./views/SeancesView.vue') },
    { path: 'seances/:id', component: () => import('./views/SeanceEditeur.vue'), props: true },
    { path: 'programmes', component: () => import('./views/ProgrammesView.vue') },
    { path: 'programmes/:id', component: () => import('./views/ProgrammeEditeur.vue'), props: true },
    { path: 'questionnaires', component: () => import('./views/QuestionnairesView.vue') },
    { path: 'questionnaires/:id', component: () => import('./views/QuestionnaireEditeur.vue'), props: true },
    { path: 'agenda', component: () => import('./views/AgendaView.vue') },
    { path: 'donnees', component: () => import('./views/DonneesView.vue') }
  ]
}
