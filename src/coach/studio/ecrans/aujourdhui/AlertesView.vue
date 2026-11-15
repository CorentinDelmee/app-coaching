<script setup>
// Écran Alertes (Studio) : toutes les alertes (pas de check-in depuis 3 jours, douleur > 6, séance commentée),
// lien vers la fiche du client, « Vu » les retire. Mêmes fonctions que l'ancienne src/coach/views/AlertesView.vue.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { etat, messageErreur, rafraichir } from '../../../store.js'
import IconeSt from '../../IconeSt.vue'
import ListeAlertes from './ListeAlertes.vue'
import { memoireForme, tranche } from './forme.js'
import '../../tokens.css'
import './aujourdhui.css'

const statut = ref('chargement')
const erreur = ref('')
// Forme de la dernière visite : squelette de la bonne hauteur (aucun saut à l'arrivée du contenu).
const T = tranche(window.innerWidth)
const forme = memoireForme.lire(T)
const zone = ref(null)
const hZone = () => (statut.value === 'pret' || !forme.h.alertesPage ? undefined : { minHeight: forme.h.alertesPage + 'px' })
function noterForme() {
  if (statut.value === 'pret') memoireForme.noter(T, { n: { alertesPage: etat.alertes.length }, h: { alertesPage: zone.value?.offsetHeight } })
}
// rafraichir() rend la main tout de suite si l'état est récent (puis se met à jour) : pas de page vide.
async function charger() {
  statut.value = 'chargement'; erreur.value = ''
  try { await rafraichir(); statut.value = 'pret'; nextTick(noterForme) } catch (e) { erreur.value = messageErreur(e); statut.value = 'erreur' }
}
onMounted(charger)
onBeforeUnmount(noterForme)
</script>

<template>
  <div class="st-auj st-auj-alertes-page">
    <header class="st-auj-entete">
      <div>
        <p class="st-auj-date"><RouterLink to="/coach/aujourdhui">Aujourd’hui</RouterLink> · Alertes</p>
        <h1 class="st-auj-titre">Alertes</h1>
        <p class="st-auj-resume" :class="{ 'st-auj-resume--sq': statut !== 'pret' }">{{ statut === 'pret' ? (etat.alertes.length ? `${etat.alertes.length} à traiter` : 'Rien à signaler') : '\u00a0' }}</p>
      </div>
    </header>
    <section v-if="statut === 'erreur'" class="st-bloc st-auj-erreur" role="alert">
      <h2 class="st-auj-h2">Impossible de charger les alertes</h2>
      <p>{{ erreur }}.</p>
      <button type="button" class="st-btn st-btn--encre" @click="charger">Réessayer</button>
    </section>
    <section v-else class="st-bloc" :aria-busy="statut === 'chargement'" aria-label="Alertes à traiter">
      <div ref="zone" :style="hZone()">
      <div v-if="statut === 'chargement'" class="st-auj-sq-liste"><div v-for="n in Math.min(forme.n.alertesPage || 3, 8)" :key="n" class="st-auj-squelette" /></div>
      <ListeAlertes v-else-if="etat.alertes.length" />
      <p v-else class="st-auj-ok"><IconeSt nom="check" /> Tous les clients sont à jour.</p>
      <RouterLink v-if="statut === 'pret' && etat.alertesAgenda" to="/coach/agenda" class="st-auj-agenda">
        <IconeSt nom="cal" />{{ etat.alertesAgenda }} événement{{ etat.alertesAgenda > 1 ? 's' : '' }} de l’agenda à corriger
      </RouterLink>
      </div>
    </section>
  </div>
</template>
