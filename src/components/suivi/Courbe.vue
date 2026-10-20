<script setup>
// Courbe SVG maison (poids, mensurations, douleur d'une zone, calories). Le tracé se dessine quand la courbe entre à l'écran
// (stroke-dashoffset), puis les points apparaissent le long du trait. Toucher / glisser sélectionne une mesure.
// Accessible : le SVG a un résumé écrit (role="img") et un tableau « Voir les valeurs ». Mouvement réduit : tout est affiché tel quel.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { construireCourbe, dateCourte } from '../../domain/graphique.js'
import { nombreFr } from '../../domain/unites.js'
import { mouvementReduit } from '../../anim/transitions.js'

let compteur = 0
const props = defineProps({
  points: { type: Array, required: true },     // [{ date, valeur }] triés par date, au moins 1
  unite: { type: String, default: '' },
  titre: { type: String, required: true },     // « Poids », « Genou gauche »…
  domaine: { type: Array, default: null },     // [min, max] imposé (douleur 0-10)
  hauteur: { type: Number, default: 190 },
  delai: { type: Number, default: 0 },         // attente avant le premier tracé (page qui s'ouvre)
  valeurs: { type: Boolean, default: true }    // afficher « Voir les valeurs »
})

const L = 340
const id = `crb${++compteur}`
const svg = ref(null)
const trace = ref(null)
const ligne = ref(null)
const aireEl = ref(null)
const sel = ref(props.points.length - 1)
const cacher = ref(!mouvementReduit()) // masqué jusqu'au premier tracé : pas de flash plein puis vide
let tl = null
let io = null
let dejaVu = false

const courbe = computed(() => construireCourbe(props.points, { largeur: L, hauteur: props.hauteur, domaine: props.domaine || undefined }))
const fmt = (v) => nombreFr(Math.round(v * 10) / 10)
const avecUnite = (v) => `${fmt(v)}${props.unite ? ` ${props.unite}` : ''}`
const choisi = computed(() => props.points[Math.min(sel.value, props.points.length - 1)])
const alt = computed(() => {
  const p = props.points
  if (p.length === 1) return `${props.titre} : ${avecUnite(p[0].valeur)} le ${dateCourte(p[0].date)}. Une seule mesure.`
  return `${props.titre} : de ${avecUnite(p[0].valeur)} le ${dateCourte(p[0].date)} à ${avecUnite(p[p.length - 1].valeur)} le ${dateCourte(p[p.length - 1].date)}, ${p.length} mesures.`
})

function jouer() {
  if (!trace.value) return
  tl?.kill()
  if (mouvementReduit()) { cacher.value = false; return }
  cacher.value = false
  const pts = trace.value.querySelectorAll('.crb-pt')
  tl = gsap.timeline({ delay: props.delai })
  if (ligne.value) tl.fromTo(ligne.value, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' }, 0)
  if (aireEl.value) tl.fromTo(aireEl.value, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power1.out' }, 0.45)
  tl.fromTo(trace.value.querySelector('.crb-guide'), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.out', clearProps: 'opacity' }, 1.1)
  tl.fromTo(pts, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, stagger: Math.min(0.2, 1.1 / Math.max(1, pts.length)), ease: 'back.out(2.2)', clearProps: 'transform,opacity' }, 0.1)
}

function selectionner(e) {
  const r = svg.value.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * L
  let meilleur = 0
  courbe.value.pts.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(courbe.value.pts[meilleur].x - x)) meilleur = i })
  sel.value = meilleur
}
const glisse = ref(false)
function debut(e) { glisse.value = true; svg.value.setPointerCapture(e.pointerId); selectionner(e) }
const bouge = (e) => { if (glisse.value) selectionner(e) }

// Nouvelles données (période, série) : on redessine, et la sélection revient sur la dernière mesure.
watch(() => props.points, async () => {
  sel.value = props.points.length - 1
  await nextTick()
  if (dejaVu) jouer()
}, { deep: false })

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') { dejaVu = true; jouer(); return }
  io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !dejaVu) { dejaVu = true; jouer(); io.disconnect() }
  }, { threshold: 0.3 })
  io.observe(svg.value)
})
onBeforeUnmount(() => { io?.disconnect(); tl?.kill() })
</script>

<template>
  <figure class="courbe">
    <figcaption class="crb-sel" aria-live="polite"><b>{{ avecUnite(choisi.valeur) }}</b><span>{{ dateCourte(choisi.date) }}</span></figcaption>
    <svg
      ref="svg" :viewBox="`0 0 ${L} ${hauteur}`" role="img" :aria-label="alt" class="crb-svg"
      @pointerdown="debut" @pointermove="bouge" @pointerup="glisse = false" @pointercancel="glisse = false"
    >
      <defs>
        <linearGradient :id="id" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--accent-lisible)" stop-opacity=".32" />
          <stop offset="1" stop-color="var(--accent-lisible)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g class="crb-grille">
        <template v-for="t in courbe.ticksY" :key="t.valeur">
          <line :x1="courbe.zone.x0" :x2="courbe.zone.x1" :y1="t.y" :y2="t.y" />
          <text :x="courbe.zone.x0 - 8" :y="t.y + 4" text-anchor="end">{{ fmt(t.valeur) }}</text>
        </template>
        <text v-for="t in courbe.ticksX" :key="t.label" :x="t.x" :y="courbe.bas + 20" :text-anchor="t.ancre">{{ t.label }}</text>
      </g>
      <g ref="trace" class="crb-trace" :class="{ attend: cacher }">
        <path v-if="courbe.aire" ref="aireEl" class="crb-aire" :d="courbe.aire" :fill="`url(#${id})`" />
        <path v-if="courbe.pts.length > 1" ref="ligne" class="crb-ligne" :d="courbe.chemin" pathLength="1" />
        <line class="crb-guide" :x1="courbe.pts[sel]?.x" :x2="courbe.pts[sel]?.x" :y1="courbe.zone.y0" :y2="courbe.zone.y1" />
        <circle v-for="(p, i) in courbe.pts" :key="p.date" class="crb-pt" :class="{ choisi: i === sel }" :cx="p.x" :cy="p.y" :r="i === sel ? 7 : 4.5" />
      </g>
    </svg>
    <details v-if="valeurs" class="crb-valeurs">
      <summary>Voir les valeurs</summary>
      <table>
        <caption class="sr-only">{{ titre }}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Valeur</th></tr></thead>
        <tbody><tr v-for="p in points" :key="p.date"><td>{{ dateCourte(p.date) }}</td><td>{{ avecUnite(p.valeur) }}</td></tr></tbody>
      </table>
    </details>
  </figure>
</template>

<style scoped>
.courbe { margin: 0; }
.crb-sel { display: flex; align-items: baseline; gap: 10px; min-height: 26px; font-size: 14px; color: var(--texte-doux); }
.crb-sel b { font-family: var(--font-chiffres); font-weight: 400; font-size: 17px; letter-spacing: -.03em; color: var(--texte); }
.crb-svg { display: block; width: 100%; height: auto; touch-action: pan-y; user-select: none; overflow: visible; }
.crb-grille line { stroke: var(--filet); stroke-width: 1; stroke-dasharray: 3 5; }
.crb-grille text { fill: var(--texte-doux); font-size: 12px; font-family: var(--font-texte); font-variant-numeric: tabular-nums; }
.crb-trace.attend { opacity: 0; }
.crb-ligne { fill: none; stroke: var(--accent-lisible); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; }
.crb-guide { stroke: var(--accent-lisible); stroke-opacity: .35; stroke-width: 1.5; }
.crb-pt { fill: var(--fond); stroke: var(--accent-lisible); stroke-width: 3; transform-box: fill-box; transform-origin: center; transition: r .18s var(--ease); }
.crb-pt.choisi { fill: var(--accent-lisible); }
.crb-valeurs { margin-top: 6px; font-size: 14px; }
.crb-valeurs summary { min-height: 40px; display: flex; align-items: center; color: var(--accent-lisible); font-weight: 600; cursor: pointer; }
.crb-valeurs table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
.crb-valeurs th, .crb-valeurs td { text-align: left; padding: 8px 0; border-top: 1px solid var(--filet); font-weight: 400; }
.crb-valeurs th { color: var(--texte-doux); font-size: 13px; }
.crb-valeurs td:last-child, .crb-valeurs th:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .crb-pt { transition: none; } }
</style>
