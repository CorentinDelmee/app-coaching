<script setup>
// Courbe de suivi Studio : aire teintée + ligne qui se dessine (1,1 s, stroke-dashoffset). Points { date, valeur }.
import { computed } from 'vue'
import { construireCourbe } from '../../../logique.js'
import { formaterNombre } from '../../../../domain/format.js'

const props = defineProps({
  donnees: { type: Array, required: true },
  titre: { type: String, required: true },
  unite: { type: String, default: '' }
})
const L = 560
const H = 180
const M = 28
const c = computed(() => construireCourbe(props.donnees, { largeur: L, hauteur: H, marge: M }))
const arrondi = (n) => formaterNombre(Math.round(n * 10) / 10)
const premier = computed(() => c.value.points[0])
const dernier = computed(() => c.value.points[c.value.points.length - 1])
const ecart = computed(() => (c.value.points.length > 1 ? dernier.value.valeur - premier.value.valeur : null))
const aire = computed(() => (c.value.points.length > 1 ? `${c.value.chemin} L${dernier.value.x.toFixed(1)},${H - M} L${premier.value.x.toFixed(1)},${H - M}Z` : ''))
const jour = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
</script>

<template>
  <figure class="st-clients-courbe">
    <figcaption>
      <span class="st-clients-courbe-titre">{{ titre }}</span>
      <span v-if="dernier" class="st-clients-courbe-val">{{ arrondi(dernier.valeur) }}<small> {{ unite }}</small></span>
      <span v-if="ecart !== null" class="st-clients-courbe-ecart">{{ ecart > 0 ? '+' : ecart < 0 ? '−' : '' }}{{ arrondi(Math.abs(ecart)) }} {{ unite }} depuis le {{ jour(premier.date) }}</span>
    </figcaption>
    <svg v-if="c.points.length" :viewBox="`0 0 ${L} ${H}`" role="img" :aria-label="`${titre} : ${c.points.length} mesure${c.points.length > 1 ? 's' : ''}, dernière ${arrondi(dernier.valeur)} ${unite}`">
      <path class="grille" :d="`M${M} ${M}H${L - M}M${M} ${H / 2}H${L - M}M${M} ${H - M}H${L - M}`" />
      <path v-if="aire" class="aire" :d="aire" />
      <path class="ligne" :d="c.chemin" pathLength="1" />
      <circle v-for="p in c.points" :key="p.date" :cx="p.x" :cy="p.y" r="3.5"><title>{{ jour(p.date) }} : {{ arrondi(p.valeur) }} {{ unite }}</title></circle>
      <text x="2" :y="M + 4">{{ arrondi(c.max) }}</text>
      <text x="2" :y="H - M + 4">{{ arrondi(c.min) }}</text>
      <text :x="premier.x" :y="H - 6" text-anchor="start">{{ jour(premier.date) }}</text>
      <text v-if="c.points.length > 1" :x="dernier.x" :y="H - 6" text-anchor="end">{{ jour(dernier.date) }}</text>
    </svg>
    <p v-else class="st-clients-vide-petit">Pas encore de mesure.</p>
  </figure>
</template>
