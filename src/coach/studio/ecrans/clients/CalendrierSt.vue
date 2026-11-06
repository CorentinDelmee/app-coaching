<script setup>
// Calendrier mensuel Studio (lundi -> dimanche). evenements : { 'AAAA-MM-JJ': [{ texte, type: 'fait'|'prevu'|'coach' }] }.
import { computed, ref } from 'vue'
import { JOURS_COURTS, grilleMois } from '../../../logique.js'
import IconeSt from '../../IconeSt.vue'

const props = defineProps({ evenements: { type: Object, required: true }, aujourdhui: { type: String, required: true } })
const mois = ref(props.aujourdhui.slice(0, 7))
const grille = computed(() => grilleMois(mois.value))
const NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const titre = computed(() => `${NOMS[Number(mois.value.slice(5)) - 1]} ${mois.value.slice(0, 4)}`)
const TYPES = { fait: 'Faite', prevu: 'Prévue', coach: 'Coaching' }

function decaler(n) {
  let [y, m] = mois.value.split('-').map(Number)
  m += n
  if (m < 1) { m = 12; y-- }
  if (m > 12) { m = 1; y++ }
  mois.value = `${y}-${String(m).padStart(2, '0')}`
}
</script>

<template>
  <div class="st-clients-cal">
    <div class="st-clients-cal-tete">
      <button type="button" class="st-btn st-btn--rond" aria-label="Mois précédent" @click="decaler(-1)"><IconeSt nom="haut" style="transform: rotate(-90deg)" /></button>
      <strong aria-live="polite">{{ titre }}</strong>
      <button type="button" class="st-btn st-btn--rond" aria-label="Mois suivant" @click="decaler(1)"><IconeSt nom="haut" style="transform: rotate(90deg)" /></button>
    </div>
    <div class="st-clients-cal-grille" role="grid" :aria-label="`Calendrier ${titre}`">
      <div v-for="j in JOURS_COURTS" :key="j" class="st-clients-cal-j" role="columnheader">{{ j }}</div>
      <template v-for="semaine in grille" :key="semaine[0]">
        <div
          v-for="jour in semaine" :key="jour" role="gridcell" class="st-clients-cal-case"
          :class="{ 'is-hors': jour.slice(0, 7) !== mois, 'is-auj': jour === aujourdhui }"
          :aria-label="`${Number(jour.slice(8))} : ${(evenements[jour] || []).map((e) => `${TYPES[e.type]} ${e.texte}`).join(', ') || 'rien'}`"
        >
          <span class="st-clients-cal-num">{{ Number(jour.slice(8)) }}</span>
          <span v-for="(e, i) in evenements[jour] || []" :key="i" class="st-clients-cal-evt" :class="`is-${e.type}`" :title="`${TYPES[e.type]} : ${e.texte}`">{{ e.texte }}</span>
        </div>
      </template>
    </div>
    <p class="st-clients-cal-legende" aria-hidden="true">
      <span class="st-clients-cal-evt is-fait">Séance faite</span>
      <span class="st-clients-cal-evt is-prevu">Prévue</span>
      <span class="st-clients-cal-evt is-coach">Coaching</span>
    </p>
  </div>
</template>
