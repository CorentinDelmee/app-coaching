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
.pastille { position: absolute; z-index: 35; top: calc(var(--haut) + 21px); left: 50%; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 10px; min-height: calc(var(--e) * 48px); padding: 0 20px; border-radius: 24px; background: var(--ph-repos-bg); color: var(--ph-repos-fg); font-weight: 600; font-size: calc(var(--e) * 16px); box-shadow: var(--ombre);
  transition: transform .14s var(--ease); animation: pastille-entre .5s var(--ease) backwards; }
/* elle naît là où le chrono vient de se refermer (haut, centre) : petit rebond, sans partir de rien */
@keyframes pastille-entre { from { opacity: 0; transform: translateX(-50%) scale(.82); } }
.pastille:active { transform: translateX(-50%) scale(.95); }
@media (prefers-reduced-motion: reduce) { .pastille { animation-name: pastille-fondu; transition: none; } @keyframes pastille-fondu { from { opacity: 0; } } }
b { font-family: var(--font-chrono); font-weight: 600; font-variant-numeric: tabular-nums; font-size: calc(var(--e) * 18px); }
.point { width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
</style>
