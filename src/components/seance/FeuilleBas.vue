<script setup>
// Feuille qui monte du bas (« Quitter la séance ? »). Contenu libre via le slot ; le fond sombre ferme la feuille.
import { onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { mouvementReduit } from '../../anim/transitions.js'

const props = defineProps({ ouverte: { type: Boolean, default: false }, titre: { type: String, default: '' } })
const emit = defineEmits(['fermer'])
const feuille = ref(null)
const scrim = ref(null)

onMounted(() => { gsap.set(feuille.value, { yPercent: 110, visibility: 'hidden' }) })
watch(() => props.ouverte, (v) => {
  const rm = mouvementReduit()
  gsap.to(scrim.value, { opacity: v ? 1 : 0, duration: 0.3 })
  if (v) gsap.set(feuille.value, { visibility: 'visible' })
  if (rm) { gsap.set(feuille.value, { yPercent: v ? 0 : 110, visibility: v ? 'visible' : 'hidden' }); return }
  gsap.to(feuille.value, { yPercent: v ? 0 : 110, duration: v ? 0.6 : 0.35, ease: v ? 'expo.out' : 'power3.out', onComplete: () => { if (!v) gsap.set(feuille.value, { visibility: 'hidden' }) } })
})
</script>

<template>
  <div ref="scrim" class="scrim" :style="{ pointerEvents: ouverte ? 'auto' : 'none' }" @click="emit('fermer')"></div>
  <div ref="feuille" class="feuille" role="dialog" :aria-label="titre" :aria-hidden="!ouverte">
    <h3>{{ titre }}</h3>
    <slot />
  </div>
</template>

<style scoped>
.scrim { position: absolute; inset: 0; z-index: 80; background: var(--scrim); opacity: 0; pointer-events: none; }
.feuille { position: absolute; z-index: 90; left: 0; right: 0; bottom: 0; background: var(--surface); border-radius: 30px 30px 0 0; padding: 26px var(--pad) var(--bas); box-shadow: var(--ombre-feuille); }
h3 { font-family: var(--font-titre); font-weight: 400; font-size: 24px; letter-spacing: -.04em; }
.feuille :deep(p) { margin: 8px 0 20px; color: var(--texte-doux); font-size: 16px; line-height: 1.4; }
.feuille :deep(.gros + .gros) { margin-top: 10px; }
.feuille :deep(.gros.doux) { background: var(--surface-2); }
</style>
