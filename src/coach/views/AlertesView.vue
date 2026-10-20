<script setup>
// Alertes : pas de check-in depuis 3 jours, douleur > 6, séance commentée. « Marquer vu » la retire.
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { etat, marquerVue, nomClient, rafraichir } from '../store.js'

const LIBELLES = { checkin: 'Check-in', douleur: 'Douleur', commentaire: 'Commentaire' }
onMounted(rafraichir)
</script>

<template>
  <div>
    <div class="c-entete">
      <div>
        <h1>Alertes</h1>
        <p class="c-sous">{{ etat.alertes.length ? `${etat.alertes.length} à traiter` : 'Rien à signaler' }}</p>
      </div>
    </div>
    <div v-if="etat.alertes.length" class="c-liste">
      <div v-for="a in etat.alertes" :key="a.id" class="c-item">
        <span class="c-pastille" :class="a.type === 'douleur' ? 'c-alerte' : ''">{{ LIBELLES[a.type] }}</span>
        <div style="flex: 1; min-width: 0">
          <RouterLink :to="`/coach/clients/${a.clientId}`" style="color: inherit"><strong>{{ nomClient(a.clientId) }}</strong></RouterLink>
          <div class="c-doux">{{ a.message }}</div>
        </div>
        <button class="c-btn c-mini" @click="marquerVue(a)">Marquer vu</button>
      </div>
    </div>
    <p v-else class="c-vide">Tous les clients sont à jour.</p>
  </div>
</template>
