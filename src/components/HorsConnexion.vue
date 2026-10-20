<script setup>
// Pastille d'état du réseau : « Hors connexion — enregistré sur l'appareil » sans réseau (les séances terminées attendent dans la file
// locale), « Synchronisation… » quand le réseau revient et que des séances restent à envoyer. Invisible le reste du temps.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { useEnLigne } from '../composables/useEnLigne.js'
import { compterAttente, enAttente } from '../lib/synchro.js'
import { mouvementReduit } from '../anim/transitions.js'

const enLigne = useEnLigne()
const pastille = ref(null)
let minuteur = 0

const texte = computed(() => {
  if (!enLigne.value) return enAttente.value ? `Hors connexion — ${enAttente.value} ${enAttente.value > 1 ? 'séances enregistrées' : 'séance enregistrée'} sur l'appareil` : 'Hors connexion — enregistré sur l\'appareil'
  return enAttente.value ? 'Synchronisation en cours…' : ''
})

onMounted(() => { compterAttente(); minuteur = setInterval(compterAttente, 4000) })
onBeforeUnmount(() => clearInterval(minuteur))
watch(texte, async (t, avant) => {
  if (!t || avant === t || !pastille.value) return
  if (!avant && !mouvementReduit()) gsap.fromTo(pastille.value, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' })
}, { flush: 'post' })
</script>

<template>
  <div v-if="texte" ref="pastille" class="hors-connexion" role="status" aria-live="polite">
    <span class="hc-point" :class="{ sync: enLigne }"></span>{{ texte }}
  </div>
</template>

<style scoped>
.hors-connexion { position: fixed; z-index: 160; top: calc(env(safe-area-inset-top, 0px) + 2px); left: 0; right: 0; margin: 0 auto; width: fit-content; max-width: calc(100% - 16px); white-space: nowrap; display: flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 14px; background: var(--surface-2); color: var(--texte); font-size: 12px; font-weight: 600; line-height: 1.3; text-align: center; pointer-events: none; box-shadow: var(--ombre); }
.hc-point { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none; }
.hc-point.sync { animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .hc-point.sync { animation: none; } }
</style>
