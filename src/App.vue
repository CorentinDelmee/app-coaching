<script setup>
// Racine de l'app : les écrans + l'invitation à reprendre une séance interrompue (rechargement ou fermeture en pleine séance).
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FeuilleBas from './components/seance/FeuilleBas.vue'
import MenuApp from './components/MenuApp.vue'
import { effacerSeanceEnCours, lireSeanceEnCours } from './lib/seanceEnCours.js'

const router = useRouter()
const route = useRoute()
const reprise = ref(null)
const ouverte = ref(false)

onMounted(async () => {
  await router.isReady()
  const s = lireSeanceEnCours()
  if (!s || route.name === 'seance' || route.name === 'workout') return // la page Workout propose elle-même « Reprendre »
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
  <RouterView />
  <MenuApp />
  <div v-if="reprise" class="reprise">
    <FeuilleBas :ouverte="ouverte" titre="Reprendre votre séance en cours ?" @fermer="() => {}">
      <p>{{ reprise.etat.workoutNom }} — dernière action à {{ quand(reprise) }}. Vos séries déjà faites sont conservées.</p>
      <button class="gros" type="button" @click="reprendre">Reprendre</button>
      <button class="gros doux" type="button" @click="abandonner">Abandonner</button>
    </FeuilleBas>
  </div>
</template>

<style scoped>
.reprise { position: fixed; inset: 0; z-index: 200; pointer-events: none; overflow: hidden; max-width: 520px; margin: 0 auto; }
.reprise :deep(.feuille), .reprise :deep(.scrim) { pointer-events: auto; }
</style>
