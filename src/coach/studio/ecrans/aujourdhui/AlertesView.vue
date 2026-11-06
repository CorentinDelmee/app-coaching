<script setup>
// Écran Alertes (Studio) : toutes les alertes (pas de check-in depuis 3 jours, douleur > 6, séance commentée),
// lien vers la fiche du client, « Vu » les retire. Mêmes fonctions que l'ancienne src/coach/views/AlertesView.vue.
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { etat, messageErreur, rafraichir } from '../../../store.js'
import IconeSt from '../../IconeSt.vue'
import ListeAlertes from './ListeAlertes.vue'
import '../../tokens.css'
import './aujourdhui.css'

const statut = ref('chargement')
const erreur = ref('')
async function charger() {
  statut.value = 'chargement'
  try { await rafraichir(); statut.value = 'pret' } catch (e) { erreur.value = messageErreur(e); statut.value = 'erreur' }
}
onMounted(charger)
</script>

<template>
  <div class="st-app st-auj st-auj-alertes-page">
    <header class="st-auj-entete">
      <div>
        <p class="st-auj-date"><RouterLink to="/coach/aujourdhui">Aujourd’hui</RouterLink> · Alertes</p>
        <h1 class="st-auj-titre">Alertes</h1>
        <p v-if="statut === 'pret'" class="st-auj-resume">{{ etat.alertes.length ? `${etat.alertes.length} à traiter` : 'Rien à signaler' }}</p>
      </div>
    </header>
    <section v-if="statut === 'erreur'" class="st-bloc st-auj-erreur" role="alert">
      <h2 class="st-auj-h2">Impossible de charger les alertes</h2>
      <p>{{ erreur }}.</p>
      <button type="button" class="st-btn st-btn--encre" @click="charger">Réessayer</button>
    </section>
    <section v-else class="st-bloc" :aria-busy="statut === 'chargement'" aria-label="Alertes à traiter">
      <template v-if="statut === 'chargement'"><div v-for="n in 3" :key="n" class="st-auj-squelette" /></template>
      <ListeAlertes v-else-if="etat.alertes.length" />
      <p v-else class="st-auj-ok"><IconeSt nom="check" /> Tous les clients sont à jour.</p>
      <RouterLink v-if="statut === 'pret' && etat.alertesAgenda" to="/coach/agenda" class="st-auj-agenda">
        <IconeSt nom="cal" />{{ etat.alertesAgenda }} événement{{ etat.alertesAgenda > 1 ? 's' : '' }} de l’agenda à corriger
      </RouterLink>
    </section>
  </div>
</template>
