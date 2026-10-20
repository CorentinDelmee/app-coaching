<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import data from '../../data/index.js'
import { nomClient, rafraichir } from '../store.js'

const questionnaires = ref([])
const LIBELLE_FREQ = { quotidien: 'Quotidien', hebdo: 'Hebdomadaire', ponctuel: 'Ponctuel' }

async function charger() {
  await rafraichir()
  questionnaires.value = await data.questionnaires.lister()
}
onMounted(charger)
async function archiver(q) {
  await data.questionnaires.archiver(q.id)
  await charger()
}
</script>

<template>
  <div>
    <div class="c-entete">
      <div>
        <h1>Questionnaires</h1>
        <p class="c-sous">Check-in quotidien, bilan hebdo, questionnaires ponctuels.</p>
      </div>
      <RouterLink to="/coach/questionnaires/nouveau" class="c-btn c-principal">Nouveau questionnaire</RouterLink>
    </div>
    <div v-if="questionnaires.length" class="c-liste">
      <div v-for="q in questionnaires" :key="q.id" class="c-item">
        <RouterLink :to="`/coach/questionnaires/${q.id}`" style="flex: 1; color: inherit; text-decoration: none">
          <strong>{{ q.nom }}</strong>
          <div class="c-doux">{{ LIBELLE_FREQ[q.frequence] }} · {{ q.questions.length }} question{{ q.questions.length > 1 ? 's' : '' }}</div>
        </RouterLink>
        <span class="c-pastille" :class="{ 'c-accent': !q.clientId }">{{ q.clientId ? nomClient(q.clientId) : 'Tous les clients' }}</span>
        <button class="c-btn c-mini c-danger" @click="archiver(q)">Archiver</button>
      </div>
    </div>
    <p v-else class="c-vide">Aucun questionnaire.</p>
  </div>
</template>
