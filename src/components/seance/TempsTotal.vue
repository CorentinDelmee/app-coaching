<script setup>
// « SÉANCE 12:34 » (M4) : temps écoulé depuis le début de la séance, en haut de chaque page, chrono et section circuit.
// Sans fond : la couleur du texte vient du parent (currentColor). Avec `bouton`, la pastille est un bouton blanc (en-tête de séance).
import { computed } from 'vue'
import { useMaintenant } from '../../composables/useMaintenant.js'
import { tempsTotal } from '../../domain/seanceUi.js'

const props = defineProps({ debut: { type: Number, required: true } }) // `demarreLe` de la séance (horloge de l'app)
const maintenant = useMaintenant()
const texte = computed(() => tempsTotal(maintenant.value - props.debut))
</script>

<template>
  <span class="tt"><small>Séance</small><b>{{ texte }}</b></span>
</template>

<style scoped>
.tt { display: inline-flex; flex-direction: column; align-items: flex-end; line-height: 1; }
.tt small { font-size: calc(var(--e) * 11px); letter-spacing: .12em; text-transform: uppercase; font-weight: 600; opacity: .72; }
.tt b { font-family: var(--font-chrono); font-weight: var(--graisse-chrono); font-size: calc(var(--e) * 22px); font-variant-numeric: tabular-nums; margin-top: 3px; letter-spacing: .01em; }
</style>
