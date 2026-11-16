<script setup>
// Racine de l'app : les écrans + l'invitation à reprendre une séance interrompue (rechargement ou fermeture en pleine séance).
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FeuilleBas from './components/seance/FeuilleBas.vue'
import MenuApp from './components/MenuApp.vue'
import HorsConnexion from './components/HorsConnexion.vue'
import Chargeur from './components/Chargeur.vue'
import { data } from './data/index.js'
import { effacerSeanceEnCours, lireSeanceEnCours } from './lib/seanceEnCours.js'

const router = useRouter()
const route = useRoute()
const reprise = ref(null)
const ouverte = ref(false)

onMounted(async () => {
  await router.isReady()
  const s = lireSeanceEnCours()
  if (!s || !(await data.utilisateurCourant()) || route.name === 'seance' || route.name === 'workout') return // la page Workout propose elle-même « Reprendre »
  reprise.value = s
  requestAnimationFrame(() => { ouverte.value = true })
})
const quand = (s) => new Date(s.sauveLe || s.etat.demarreLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
function reprendre() {
  const id = reprise.value.workoutId
  ouverte.value = false
  router.push({ name: 'seance', params: { workoutId: id } })
}
function abandonner() {
  effacerSeanceEnCours()
  ouverte.value = false
}
</script>

<template>
  <!-- Le menu vient AVANT la page dans le DOM : posé derrière elle (même niveau, ordre du DOM), il apparaît quand la page recule. -->
  <MenuApp />
  <RouterView />
  <HorsConnexion />
  <!-- Chargeur de l'app client (attente de la base > 250 ms) ; l'espace coach a le sien dans CoachLayout. -->
  <Chargeur v-if="!route.path.startsWith('/coach')" position="centre" />
  <div v-if="reprise" class="reprise">
    <FeuilleBas :ouverte="ouverte" titre="Reprendre votre séance en cours ?" @fermer="() => {}">
      <p>{{ reprise.etat.workoutNom }} — dernière action à {{ quand(reprise) }}. Vos séries déjà faites sont conservées.</p>
      <button class="gros" type="button" @click="reprendre">Reprendre</button>
      <button class="gros doux" type="button" @click="abandonner">Abandonner</button>
    </FeuilleBas>
  </div>
</template>

<style>
/* Chargeur aux couleurs du client (l'espace coach les redéfinit sous .st-app) */
.chg { --chg-accent: var(--accent, #F2E27A); }
</style>
<style scoped>
.reprise { position: fixed; inset: 0; z-index: 200; pointer-events: none; overflow: hidden; max-width: 520px; margin: 0 auto; }
.reprise :deep(.feuille), .reprise :deep(.scrim) { pointer-events: auto; }
</style>
