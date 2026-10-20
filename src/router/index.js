import { createRouter, createWebHistory } from 'vue-router'
import Accueil from '../views/Accueil.vue'

// Les routes de l'app sont ajoutées lot par lot (voir PLAN.md).
export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: '/', name: 'accueil', component: Accueil }]
})
