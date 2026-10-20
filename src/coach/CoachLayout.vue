<script setup>
// Cadre du tableau de bord coach : navigation latérale (ordinateur) / barre horizontale (téléphone).
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import data from '../data/index.js'
import { effacerSeanceEnCours } from '../lib/seanceEnCours.js'
import { sauterFermeture } from '../anim/passage.js'
import { etat, rafraichir } from './store.js'
import './coach.css'

const LIENS = [
  { to: '/coach/clients', texte: 'Clients' },
  { to: '/coach/alertes', texte: 'Alertes', badge: true },
  { to: '/coach/seances', texte: 'Séances' },
  { to: '/coach/programmes', texte: 'Programmes' },
  { to: '/coach/exercices', texte: 'Exercices' },
  { to: '/coach/questionnaires', texte: 'Questionnaires' },
  { to: '/coach/donnees', texte: 'Import / export' }
]

onMounted(rafraichir)

// Même sortie que le Profil client : session fermée, séance sauvegardée effacée.
const router = useRouter()
async function deconnecter() {
  await data.deconnecter()
  effacerSeanceEnCours()
  sauterFermeture()
  router.replace('/bienvenue')
}
</script>

<template>
  <div class="coach">
    <aside class="c-nav">
      <div class="c-marque">Coach<small>Corentin Delmée</small></div>
      <nav aria-label="Tableau de bord coach">
        <RouterLink v-for="l in LIENS" :key="l.to" :to="l.to" class="c-lien">
          {{ l.texte }}
          <span v-if="l.badge && etat.alertes.length" class="c-badge" :aria-label="`${etat.alertes.length} alertes`">{{ etat.alertes.length }}</span>
        </RouterLink>
      </nav>
      <button class="c-btn c-deco" type="button" @click="deconnecter">Se déconnecter</button>
    </aside>
    <main class="c-main">
      <RouterView v-slot="{ Component, route }">
        <Transition name="c-page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>
