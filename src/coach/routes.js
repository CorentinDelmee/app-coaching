// Routes du tableau de bord coach, montées sous « /coach » (ajoutées au routeur par une seule ligne).
import { ouvrirSessionCoach } from './store.js'
import ecranAujourdhui from './studio/ecrans/aujourdhui/routes.js'
import ecranAgenda from './studio/ecrans/agenda/routes.js'
import ecranQuestionnaires from './studio/ecrans/questionnaires/routes.js'

// Écrans Studio : chaque lot exporte ses routes (relatives à /coach) ; meta.studio ajouté ici.
const studio = (routes) => routes.map((r) => ({ ...r, meta: { ...(r.meta || {}), studio: true } }))

export const routeCoach = {
  path: '/coach',
  component: () => import('./CoachLayout.vue'),
  // Un client connecté est renvoyé vers l'accueil ; en mode local le compte coach de démo s'ouvre tout seul.
  beforeEnter: async () => ((await ouvrirSessionCoach()) === 'ok' ? true : '/'),
  children: [
    { path: '', redirect: '/coach/aujourdhui' },
    // Studio : une route refaite porte meta.studio (sinon CoachLayout la rend dans le pont .coach des anciennes vues).
    ...studio(ecranAujourdhui),
    // Démo des composants Studio (vignette, panneau, élément partagé) : en développement seulement.
    ...(import.meta.env.DEV ? [{ path: 'studio-demo', component: () => import('./studio/DemoComposants.vue'), meta: { studio: true } }] : []),
    { path: 'clients', component: () => import('./views/ClientsView.vue') },
    { path: 'clients/:id', component: () => import('./views/ClientView.vue'), props: true },
    { path: 'exercices', component: () => import('./views/ExercicesView.vue') },
    { path: 'bibliotheque', component: () => import('./views/BibliothequeVideosView.vue') },
    { path: 'seances', component: () => import('./views/SeancesView.vue') },
    { path: 'seances/:id', component: () => import('./views/SeanceEditeur.vue'), props: true },
    { path: 'programmes', component: () => import('./views/ProgrammesView.vue') },
    { path: 'programmes/:id', component: () => import('./views/ProgrammeEditeur.vue'), props: true },
    ...studio(ecranQuestionnaires),
    ...studio(ecranAgenda)
  ]
}
