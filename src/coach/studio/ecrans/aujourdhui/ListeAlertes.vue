<script setup>
// Liste des alertes coach (pas de check-in depuis 3 jours, douleur > 6, séance commentée), partagée par
// « Aujourd'hui » (les premières) et l'écran Alertes (toutes). « Vu » la retire (même règle que l'ancienne AlertesView).
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Puce from '../../Puce.vue'
import { toast } from '../../toast.js'
import { etat, marquerVue, messageErreur, nomClient } from '../../../store.js'
import { avatarClient } from '../../avatar.js'

const props = defineProps({ max: { type: Number, default: 0 } })
const LIBELLES = { checkin: 'Check-in', douleur: 'Douleur', commentaire: 'Commentaire' }
const enCours = ref('')
const liste = computed(() => (props.max ? etat.alertes.slice(0, props.max) : etat.alertes))

async function vu(a) {
  enCours.value = a.id
  try {
    await marquerVue(a)
    toast(`Alerte de ${nomClient(a.clientId)} marquée comme vue`)
  } catch (e) {
    toast(`Impossible d’enregistrer : ${messageErreur(e)}`)
  } finally {
    enCours.value = ''
  }
}
</script>

<template>
  <TransitionGroup tag="ul" name="st-auj-liste" class="st-auj-mini">
    <li v-for="a in liste" :key="a.id">
      <span class="st-auj-av" :data-m="avatarClient(a.clientId, nomClient(a.clientId)).teinte" aria-hidden="true">{{ avatarClient(a.clientId, nomClient(a.clientId)).initiales }}</span>
      <div>
        <RouterLink :to="`/coach/clients/${a.clientId}`" class="st-auj-nom">{{ nomClient(a.clientId) }}</RouterLink>
        <small>{{ a.message }}</small>
      </div>
      <Puce :variante="a.type === 'douleur' ? 'alerte' : 'neutre'" point>{{ LIBELLES[a.type] || a.type }}</Puce>
      <button type="button" class="st-btn st-auj-vu" :disabled="enCours === a.id" :aria-label="`Marquer vue l’alerte de ${nomClient(a.clientId)} : ${a.message}`" @click="vu(a)">Vu</button>
    </li>
  </TransitionGroup>
</template>
