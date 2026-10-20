import { createRouter, createWebHistory } from 'vue-router'
import Accueil from '../views/Accueil.vue'
import { routeCoach } from '../coach/routes.js'
import { data } from '../data/index.js'
import { redirection } from './garde.js'

// Les routes de l'app sont ajoutées lot par lot (voir PLAN.md).
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'accueil', component: Accueil },
    // Pages publiques (lot 9) : présentation / installation, connexion, confidentialité. `sansMenu` : pas de bouton menu.
    { path: '/bienvenue', name: 'bienvenue', component: () => import('../views/Bienvenue.vue'), meta: { sansMenu: true } },
    { path: '/connexion', name: 'connexion', component: () => import('../views/Connexion.vue'), meta: { sansMenu: true } },
    { path: '/confidentialite', name: 'confidentialite', component: () => import('../views/Confidentialite.vue'), meta: { sansMenu: true } },
    { path: '/consentement', name: 'consentement', component: () => import('../views/Consentement.vue'), meta: { sansMenu: true } },
    { path: '/profil', name: 'profil', component: () => import('../views/Profil.vue') },
    // Coaching (lot 6) et rubriques pas encore livrées (écran « bientôt »).
    { path: '/coaching', name: 'coaching', component: () => import('../views/Coaching.vue') },
    { path: '/bientot/:rubrique', name: 'bientot', component: () => import('../views/Bientot.vue') },
    // Programme du client (lot 4) et aperçu d'un workout (lot 3). ?retour=/chemin règle la page d'arrivée du bouton retour.
    { path: '/programme', name: 'programme', component: () => import('../views/Programme.vue') },
    { path: '/workout/:workoutId', name: 'workout', component: () => import('../views/Workout.vue') },
    // Séance en cours (lot 2). ?nouvelle=1 ignore une séance sauvegardée ; ?retour=/chemin règle la page d'arrivée.
    { path: '/seance/:workoutId', name: 'seance', component: () => import('../views/Seance.vue') },
    // Accès direct aux séances de démonstration de Fabien Vincent (après connexion au compte démo).
    { path: '/demo/seance', redirect: '/seance/w-fabien-2' },
    { path: '/demo/temps', redirect: '/seance/w-fabien-1' },
    { path: '/demo/circuits', redirect: '/seance/w-fabien-circuits' },
    { path: '/demo/finishers', redirect: '/seance/w-fabien-3' },
    routeCoach
  ]
})

// Garde : non connecté -> accueil public ; client hors /coach ; coach -> /coach ; consentement au premier lancement.
router.beforeEach(async (to) => redirection({ user: await data.utilisateurCourant(), nom: to.name, chemin: to.path }))

export default router
