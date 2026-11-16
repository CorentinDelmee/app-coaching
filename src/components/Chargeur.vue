<script setup>
// Chargeur : n'apparaît qu'après 250 ms d'attente de la base (src/lib/chargement.js), reste au moins 400 ms (pas de clignotement).
// Variante : CHOIX.chargeur (src/config/apparence.js) ou la prop `variante`. `toujours` : visible en permanence (démo).
// position : 'haut' (gélule en haut, la page montre déjà ses squelettes) | 'centre' (page entière en attente) | 'place' (dans le flux).
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { abonner, creerAffichageDiffere } from '../lib/chargement.js'
import { CHOIX } from '../config/apparence.js'
import './chargeur.css'

const props = defineProps({
  variante: { type: String, default: '' },
  position: { type: String, default: 'haut' },
  toujours: { type: Boolean, default: false }
})
const v = props.variante || CHOIX.chargeur || 'pastille'
const visible = ref(props.toujours)
let desabonner = null
onMounted(() => {
  if (props.toujours) return
  const changer = creerAffichageDiffere((b) => { visible.value = b })
  desabonner = abonner(changer)
})
onBeforeUnmount(() => desabonner?.())
</script>

<template>
  <Transition name="chg-entree">
    <div v-if="visible" class="chg" :class="`chg--${position}`" role="status">
      <span class="chg-sr">Chargement…</span>
      <div v-if="v === 'tempo'" class="chg-corps chg-tempo" aria-hidden="true"><i /><i /><i /></div>
      <div v-else-if="v === 'anneau'" class="chg-corps chg-anneau" aria-hidden="true">
        <svg viewBox="0 0 26 26"><circle class="piste" cx="13" cy="13" r="10" /><circle class="arc" cx="13" cy="13" r="10" pathLength="100" /></svg>
      </div>
      <div v-else class="chg-corps chg-pastille" aria-hidden="true"><i /></div>
    </div>
  </Transition>
</template>
