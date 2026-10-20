<script setup>
// Calendrier mensuel (lundi → dimanche). `evenements` : { 'AAAA-MM-JJ': [{ texte, type: 'fait'|'prevu'|'coach' }] }.
import { computed, ref } from 'vue'
import { JOURS_COURTS, grilleMois } from '../logique.js'

const props = defineProps({ evenements: { type: Object, required: true }, aujourdhui: { type: String, required: true } })
const emit = defineEmits(['mois'])

const mois = ref(props.aujourdhui.slice(0, 7))
const grille = computed(() => grilleMois(mois.value))
const NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const titre = computed(() => `${NOMS[Number(mois.value.slice(5)) - 1]} ${mois.value.slice(0, 4)}`)

function decaler(n) {
  let [y, m] = mois.value.split('-').map(Number)
  m += n
  if (m < 1) { m = 12; y-- }
  if (m > 12) { m = 1; y++ }
  mois.value = `${y}-${String(m).padStart(2, '0')}`
  emit('mois', mois.value)
}
</script>

<template>
  <div>
    <div class="c-ligne" style="margin-bottom: 10px">
      <button class="c-btn c-mini" aria-label="Mois précédent" @click="decaler(-1)">←</button>
      <strong style="min-width: 130px; text-align: center; text-transform: capitalize">{{ titre }}</strong>
      <button class="c-btn c-mini" aria-label="Mois suivant" @click="decaler(1)">→</button>
    </div>
    <div class="c-cal" role="grid" :aria-label="`Calendrier ${titre}`">
      <div v-for="j in JOURS_COURTS" :key="j" class="c-cal-tete">{{ j }}</div>
      <template v-for="semaine in grille" :key="semaine[0]">
        <div v-for="jour in semaine" :key="jour" class="c-cal-jour" :class="{ 'c-hors': jour.slice(0, 7) !== mois, 'c-auj': jour === aujourdhui }" role="gridcell">
          <span class="c-cal-num">{{ Number(jour.slice(8)) }}</span>
          <span v-for="(e, i) in evenements[jour] || []" :key="i" class="c-cal-evt" :class="`c-${e.type}`" :title="e.texte">{{ e.texte }}</span>
        </div>
      </template>
    </div>
    <p class="c-petit c-doux" style="margin-bottom: 0">
      <span class="c-cal-evt c-fait" style="display: inline">Séance faite</span>
      <span class="c-cal-evt c-prevu" style="display: inline">Prévue</span>
      <span class="c-cal-evt c-coach" style="display: inline">Coaching</span>
    </p>
  </div>
</template>
