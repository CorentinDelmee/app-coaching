import { createRouter, createWebHistory } from 'vue-router'
import Accueil from '../views/Accueil.vue'
import { routeCoach } from '../coach/routes.js'

// Les routes de l'app sont ajoutées lot par lot (voir PLAN.md).
export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: '/', name: 'accueil', component: Accueil }, routeCoach]
})
