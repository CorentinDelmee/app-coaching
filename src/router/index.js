import { createRouter, createWebHistory } from 'vue-router'
import Accueil from '../views/Accueil.vue'
import { routeCoach } from '../coach/routes.js'

// Les routes de l'app sont ajoutées lot par lot (voir PLAN.md).
export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'accueil', component: Accueil },
    // Programme du client (lot 4) et aperçu d'un workout (lot 3). ?retour=/chemin règle la page d'arrivée du bouton retour.
    { path: '/programme', name: 'programme', component: () => import('../views/Programme.vue') },
    { path: '/workout/:workoutId', name: 'workout', component: () => import('../views/Workout.vue') },
    // Séance en cours (lot 2). ?nouvelle=1 ignore une séance sauvegardée ; ?retour=/chemin règle la page d'arrivée.
    { path: '/seance/:workoutId', name: 'seance', component: () => import('../views/Seance.vue') },
    // Accès direct aux séances de démonstration de Fabien Vincent (session de démo automatique en mode local).
    { path: '/demo/seance', redirect: '/seance/w-fabien-2' },
    { path: '/demo/temps', redirect: '/seance/w-fabien-1' },
    { path: '/demo/circuits', redirect: '/seance/w-fabien-circuits' },
    { path: '/demo/finishers', redirect: '/seance/w-fabien-3' },
    routeCoach
  ]
})
