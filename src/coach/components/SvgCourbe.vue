<script setup>
// Courbe SVG maison (pas de librairie) : points {date, valeur}.
import { computed } from 'vue'
import { construireCourbe } from '../logique.js'
import { formaterNombre } from '../../domain/format.js'

const props = defineProps({
  donnees: { type: Array, required: true },
  titre: { type: String, required: true },
  unite: { type: String, default: '' }
})
const L = 600
const H = 180
const c = computed(() => construireCourbe(props.donnees, { largeur: L, hauteur: H, marge: 30 }))
const arrondi = (n) => formaterNombre(Math.round(n * 10) / 10)
const dernier = computed(() => c.value.points[c.value.points.length - 1])
const jour = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
</script>

<template>
  <figure style="margin: 0">
    <figcaption class="c-ligne" style="margin-bottom: 6px">
      <h2 style="margin: 0; flex: 1">{{ titre }}</h2>
      <span v-if="dernier" class="c-doux c-petit">Dernier : <strong style="color: var(--texte)">{{ arrondi(dernier.valeur) }} {{ unite }}</strong></span>
    </figcaption>
    <svg v-if="c.points.length" class="c-courbe" :viewBox="`0 0 ${L} ${H}`" role="img" :aria-label="`${titre} : ${c.points.length} mesures`">
      <line x1="30" :x2="L - 30" :y1="H - 30" :y2="H - 30" stroke="currentColor" opacity=".15" />
      <text x="4" y="34">{{ arrondi(c.max) }}</text>
      <text x="4" :y="H - 26">{{ arrondi(c.min) }}</text>
      <path :d="c.chemin" pathLength="1" />
      <circle v-for="p in c.points" :key="p.date" :cx="p.x" :cy="p.y" r="4"><title>{{ jour(p.date) }} : {{ arrondi(p.valeur) }} {{ unite }}</title></circle>
      <text :x="c.points[0].x" :y="H - 8" text-anchor="start">{{ jour(c.points[0].date) }}</text>
      <text v-if="c.points.length > 1" :x="dernier.x" :y="H - 8" text-anchor="end">{{ jour(dernier.date) }}</text>
    </svg>
    <p v-else class="c-vide">Pas encore de mesure.</p>
  </figure>
</template>
