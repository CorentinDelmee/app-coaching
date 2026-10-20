<script setup>
// Grand sélecteur : roue verticale plein écran sur l'accent. Défilement natif avec accroche (scroll-snap) :
// l'inertie et les crans viennent du navigateur (fiable sur iOS). Gros chiffre + unité, vibration à chaque cran.
import { onMounted, onBeforeUnmount, ref } from 'vue'
import Icone from '../Icone.vue'
import { ouvrirRect, fermerRect, nettoyer, mouvementReduit } from '../../anim/transitions.js'
import { nombreFr } from '../../domain/unites.js'
import { SONS } from '../../lib/son.js'

const props = defineProps({
  config: { type: Object, required: true }, // domain/roue configRoue
  titre: { type: String, default: '' },
  sous: { type: String, default: '' },
  src: { type: Object, default: null } // la tuile touchée
})
const emit = defineEmits(['valide', 'ferme'])

const CRAN = 104 // hauteur d'un cran en px (doit rester égale au CSS)
const racine = ref(null)
const roue = ref(null)
let index = props.config.index
let raf = 0
let drag = null

const crans = Array.from({ length: props.config.nb }, (_, i) => nombreFr(props.config.valeurDe(i)))

// Effet « barillet » : les valeurs voisines rétrécissent et s'estompent.
function majRoue() {
  const r = roue.value
  if (!r) return
  const pos = r.scrollTop / CRAN
  const items = r.children
  const idx = Math.max(0, Math.min(items.length - 1, Math.round(pos)))
  for (let i = Math.max(0, Math.floor(pos) - 5); i < Math.min(items.length, Math.ceil(pos) + 6); i++) {
    const d = i - pos
    const a = Math.abs(d)
    const sc = 1 / (1 + a * 0.95)
    const op = 1 / (1 + a * 1.5) - (a > 3 ? 0.1 : 0)
    items[i].style.transform = `translateY(${(-d * CRAN * (1 - sc) * 0.3).toFixed(1)}px) scale(${sc.toFixed(3)})`
    items[i].style.opacity = Math.max(0, op).toFixed(3)
  }
  if (idx !== index) {
    index = idx
    SONS.cran()
    r.setAttribute('aria-valuenow', props.config.valeurDe(idx))
  }
}
const allerA = (i) => roue.value.scrollTo({ top: Math.max(0, Math.min(props.config.nb - 1, i)) * CRAN, behavior: mouvementReduit() ? 'auto' : 'smooth' })

function placer() {
  const r = roue.value
  if (!r) return
  r.style.paddingTop = r.style.paddingBottom = `${Math.max(0, (r.clientHeight - CRAN) / 2)}px`
  r.scrollTop = props.config.index * CRAN
  majRoue()
}

function brancher() {
  const r = roue.value
  r.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; majRoue() }) }, { passive: true })
  // Souris : glisser à la main (sur écran tactile, le défilement natif suffit).
  r.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return
    drag = { y: e.clientY, s: r.scrollTop, moved: false, v: 0, ly: e.clientY, lt: performance.now() }
    r.classList.add('glisse'); r.setPointerCapture(e.pointerId)
  })
  r.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dy = e.clientY - drag.y
    if (Math.abs(dy) > 4) drag.moved = true
    const t = performance.now()
    drag.v = (e.clientY - drag.ly) / Math.max(1, t - drag.lt); drag.ly = e.clientY; drag.lt = t
    r.scrollTop = drag.s - dy
  })
  const fin = () => {
    if (!drag) return
    const d = drag; drag = null; r.classList.remove('glisse'); r._moved = d.moved
    if (d.moved) allerA(Math.round((r.scrollTop - d.v * 260) / CRAN))
  }
  r.addEventListener('pointerup', fin); r.addEventListener('pointercancel', fin)
  r.addEventListener('click', (e) => {
    const c = e.target.closest('.cran')
    if (!c || e.detail === 0) return
    if (r._moved) { r._moved = false; return }
    if (Math.abs(+c.dataset.i - r.scrollTop / CRAN) < 0.4) return
    allerA(+c.dataset.i)
  })
}

onMounted(() => {
  ouvrirRect(racine.value, props.src, { rayon: 24 })
  requestAnimationFrame(() => requestAnimationFrame(placer))
  setTimeout(placer, 60)
  brancher()
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); nettoyer(racine.value) })

function clavier(e) {
  if (e.key === 'ArrowUp') { e.preventDefault(); allerA(index - 1) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); allerA(index + 1) }
  else if (e.key === 'Enter') valider()
}

/** Fermeture sans changement. */
function annuler() { fermerRect(racine.value, props.src, { duree: 0.42, onFini: () => emit('ferme') }) }
/** Valider : la valeur choisie remonte au parent, la roue se referme sur la tuile. */
function valider() {
  emit('valide', index)
  fermerRect(racine.value, props.src, { duree: 0.46, onFini: () => emit('ferme') })
}
defineExpose({ annuler })
</script>

<template>
  <div ref="racine" class="couche roue-couche" hidden>
    <div class="sel">
      <div class="couche-haut" data-c>
        <button class="rond" type="button" aria-label="Annuler" @click="annuler"><Icone nom="fermer" /></button>
        <span class="lab">{{ titre }}<br>{{ sous }}</span>
      </div>
      <div class="roue-w" data-c>
        <div
          ref="roue" class="roue" tabindex="0" role="spinbutton" :aria-label="config.label"
          :aria-valuenow="config.valeurDe(config.index)" :aria-valuemin="config.min" :aria-valuemax="config.max" @keydown="clavier"
        >
          <div v-for="(t, i) in crans" :key="i" class="cran" :data-i="i">{{ t }}</div>
        </div>
        <div class="roue-cadre"></div>
        <span class="roue-unite">{{ config.unite }}</span>
      </div>
      <button class="gros" type="button" data-c @click="valider">Valider</button>
    </div>
    <div class="voile" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.roue-couche { z-index: 55; }
.sel { position: absolute; inset: 0; padding: var(--haut) 0 var(--bas); display: flex; flex-direction: column; background: var(--accent); color: var(--accent-texte); }
.couche-haut { padding: 0 var(--pad); }
.sel .rond { background: var(--accent-texte); color: var(--accent); }
.sel .lab { color: var(--on-accent-doux); }
.roue-w { position: relative; flex: 1; min-height: 0; margin: 6px 0 14px; }
.roue {
  position: absolute; inset: 0; overflow-y: auto; scroll-snap-type: y mandatory; scrollbar-width: none; touch-action: pan-y; overscroll-behavior: contain; cursor: grab;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22%, #000 78%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 22%, #000 78%, transparent 100%);
}
.roue::-webkit-scrollbar { display: none; }
.roue.glisse { scroll-snap-type: none; cursor: grabbing; }
.roue:focus-visible { outline-offset: -6px; outline-color: var(--accent-texte); }
.cran { height: 104px; display: flex; align-items: center; justify-content: center; scroll-snap-align: center; font-family: var(--font-chiffres); font-size: 112px; letter-spacing: -.07em; font-variant-numeric: tabular-nums; line-height: 1; cursor: pointer; }
.roue-cadre { position: absolute; left: var(--pad); right: var(--pad); top: 50%; height: 120px; margin-top: -60px; border-top: 2px solid color-mix(in srgb, var(--accent-texte) 30%, transparent); border-bottom: 2px solid color-mix(in srgb, var(--accent-texte) 30%, transparent); pointer-events: none; }
.roue-unite { position: absolute; right: 26px; top: 50%; margin-top: 18px; font-size: 34px; font-weight: 600; pointer-events: none; font-family: var(--font-texte); }
.sel .gros { margin: 0 var(--pad); width: calc(100% - 2 * var(--pad)); background: var(--accent-texte); color: var(--accent); }
</style>
