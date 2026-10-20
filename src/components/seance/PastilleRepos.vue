<script setup>
// Pastille de repos persistante (emprunt à la maquette M4) : le repos réduit reste visible en haut de l'écran, un toucher le rouvre.
import { computed } from 'vue'
import { useMaintenant } from '../../composables/useMaintenant.js'

const props = defineProps({ finLe: { type: Number, required: true } })
const emit = defineEmits(['ouvrir'])
const maintenant = useMaintenant()
const texte = computed(() => {
  const s = Math.max(0, Math.ceil((props.finLe - maintenant.value) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
</script>

<template>
  <button class="pastille" type="button" aria-label="Rouvrir le repos" @click="emit('ouvrir', $event.currentTarget)">
    <span class="point"></span>Repos <b>{{ texte }}</b>
  </button>
</template>

<style scoped>
.pastille { position: absolute; z-index: 35; top: calc(var(--haut) - 6px); left: 50%; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 20px; border-radius: 24px; background: var(--ph-repos-bg); color: var(--ph-repos-fg); font-weight: 600; font-size: 16px; box-shadow: var(--ombre); }
b { font-family: var(--font-chrono); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 18px; }
.point { width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
</style>
