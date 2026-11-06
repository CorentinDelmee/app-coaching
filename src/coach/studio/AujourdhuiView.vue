<script setup>
// Emplacement provisoire de « Aujourd'hui » (/coach/aujourdhui). Le vrai écran est fait par le lot « aujourdhui »
// dans src/coach/studio/ecrans/aujourdhui/ ; REX remplacera cette route à la fusion.
import { RouterLink } from 'vue-router'
import IconeSt from './IconeSt.vue'
const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
</script>

<template>
  <section aria-labelledby="st-t-auj">
    <header class="st-entete">
      <div><p class="st-auj-date">{{ date }}</p><h1 id="st-t-auj">Bonjour Corentin.</h1></div>
      <div class="st-actions"><RouterLink class="st-btn st-btn--jaune" to="/coach/seances"><IconeSt nom="plus" />Nouvelle séance</RouterLink></div>
    </header>
    <div class="st-bloc">
      <h2>Ta journée arrive ici</h2>
      <p>Séances du jour, alertes, check-ins et réservations seront regroupés sur cet écran. En attendant :</p>
      <p><RouterLink class="st-btn" to="/coach/clients">Clients</RouterLink> <RouterLink class="st-btn" to="/coach/alertes">Alertes</RouterLink> <RouterLink class="st-btn" to="/coach/agenda">Agenda</RouterLink></p>
    </div>
  </section>
</template>

<style>
.st-auj-date { margin: 0 0 8px !important; text-transform: capitalize; font-weight: 600; }
</style>
