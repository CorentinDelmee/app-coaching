// Routes du tableau de bord coach, montées sous « /coach » (ajoutées au routeur par une seule ligne).
import { ouvrirSessionCoach } from './store.js'
import ecranAujourdhui from './studio/ecrans/aujourdhui/routes.js'
import ecranClients from './studio/ecrans/clients/routes.js'
import ecranExercices from './studio/ecrans/exercices/routes.js'
import ecranProgrammes from './studio/ecrans/programmes/routes.js'
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
    ...studio(ecranClients),
    ...studio(ecranExercices),
    ...studio(ecranProgrammes),
    ...studio(ecranQuestionnaires),
    ...studio(ecranAgenda)
  ]
}
