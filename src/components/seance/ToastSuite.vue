<script setup>
// Bandeau « Exercice suivant dans 3 s — Rester ». La barre se vide pendant le compte à rebours du moteur (échéance absolue).
import { computed, toRef } from 'vue'
import { gsap } from 'gsap'
import { mouvementReduit } from '../../anim/transitions.js'
import { DELAI_AVANCE_AUTO } from '../../engine/seance.js'
import { useMaintenant } from '../../composables/useMaintenant.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  nom: { type: String, default: '' },
  finLe: { type: Number, default: 0 }
})
const maintenant = useMaintenant(toRef(props, 'visible'))
const emit = defineEmits(['rester'])

const restant = computed(() => Math.max(0, props.finLe - maintenant.value))
const secondes = computed(() => Math.max(1, Math.ceil(restant.value / 1000)))
const fraction = computed(() => Math.min(1, restant.value / DELAI_AVANCE_AUTO))

function entre(el, fini) {
  if (mouvementReduit()) return void gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, onComplete: fini })
  gsap.fromTo(el, { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', onComplete: fini })
}
function sort(el, fini) {
  if (mouvementReduit()) return void gsap.to(el, { opacity: 0, duration: 0.15, onComplete: fini })
  gsap.to(el, { y: 80, opacity: 0, duration: 0.35, ease: 'power3.out', onComplete: fini })
}
</script>

<template>
  <Transition :css="false" @enter="entre" @leave="sort">
    <div v-if="visible" class="toast-suite" role="status">
      <div class="tx">{{ nom }}<small>Exercice suivant dans {{ secondes }} s</small></div>
      <button type="button" @click="emit('rester')">Rester ici</button>
      <span class="prog" :style="{ transform: `scaleX(${fraction})` }"></span>
    </div>
  </Transition>
</template>

<style scoped>
.toast-suite { position: absolute; z-index: 30; left: var(--pad); right: var(--pad); bottom: calc(var(--bas) + 100px); background: var(--texte); color: var(--fond); border-radius: 24px; padding: 14px 14px 14px 20px; display: flex; align-items: center; gap: 12px; overflow: hidden; }
.tx { flex: 1; font-weight: 600; font-size: 16px; line-height: 1.25; }
.tx small { display: block; font-weight: 400; opacity: .7; font-size: 14px; }
button { min-height: 48px; padding: 0 16px; border-radius: 16px; background: var(--fond); color: var(--texte); font-weight: 600; font-size: 15px; }
.prog { position: absolute; left: 0; bottom: 0; height: 4px; width: 100%; background: var(--accent); transform-origin: left; }
</style>
