<script setup>
// Curseur 0-10 (questionnaires, intensité d'une douleur) : gros chiffre, grosse poignée au pouce, retour haptique à chaque cran.
// Pointeur + clavier (flèches). La poignée et le remplissage sont animés en transform seulement.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ChiffresRoulants from './ChiffresRoulants.vue'
import { gsap } from 'gsap'
import { mouvementReduit } from '../anim/transitions.js'
import { SONS } from '../lib/son.js'

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 10 },
  etiquettes: { type: Array, default: () => [] }, // [bas, haut]
  compact: { type: Boolean, default: false },      // version réduite (feuille de la carte du corps)
  label: { type: String, default: 'Valeur' }
})
const emit = defineEmits(['update:modelValue'])

const rail = ref(null)
const poignee = ref(null)
const plein = ref(null)
const valEl = ref(null)
// Le grand chiffre roule (M2) : il monte quand la valeur augmente, descend quand elle baisse ; à l'arrivée il roule depuis 0.
const affichee = ref(props.min)
const sens = ref(1)
let delaiEntree = 0
let largeur = 0
let actif = false
let ro = null

const fraction = (v) => (v - props.min) / (props.max - props.min)

function placer(anime) {
  if (!rail.value) return
  largeur = rail.value.clientWidth
  const d = anime && !mouvementReduit() ? 0.45 : 0
  gsap.to(poignee.value, { x: fraction(props.modelValue) * largeur, duration: d, ease: 'expo.out', overwrite: 'auto' })
  gsap.to(plein.value, { scaleX: fraction(props.modelValue), duration: d, ease: 'expo.out', overwrite: 'auto' })
}

function choisir(v) {
  const n = Math.max(props.min, Math.min(props.max, v))
  if (n === props.modelValue) return
  emit('update:modelValue', n)
  SONS.tick()
  if (!mouvementReduit()) gsap.fromTo(valEl.value, { scale: 1.07 }, { scale: 1, duration: 0.35, ease: 'expo.out', overwrite: 'auto' })
}
function depuis(e) {
  const r = rail.value.getBoundingClientRect()
  const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  choisir(Math.round(props.min + f * (props.max - props.min)))
}
function debut(e) {
  rail.value.setPointerCapture(e.pointerId)
  actif = true
  depuis(e)
  if (!mouvementReduit()) gsap.to(poignee.value, { scale: 1.18, duration: 0.3, ease: 'back.out(2)' })
}
const bouge = (e) => { if (actif) depuis(e) }
function fin() {
  actif = false
  gsap.to(poignee.value, { scale: 1, duration: 0.5, ease: 'back.out(2)' })
}
function clavier(e) {
  const pas = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]
  if (pas) { e.preventDefault(); choisir(props.modelValue + pas) }
  else if (e.key === 'Home') choisir(props.min)
  else if (e.key === 'End') choisir(props.max)
}

watch(() => props.modelValue, (v, avant) => { sens.value = v >= avant ? 1 : -1; affichee.value = v; placer(true) })
onMounted(() => {
  placer(false)
  delaiEntree = setTimeout(() => { sens.value = 1; affichee.value = props.modelValue }, mouvementReduit() ? 0 : 450)
  ro = new ResizeObserver(() => placer(false)) // la largeur n'est connue qu'une fois la page visible
  ro.observe(rail.value)
})
onBeforeUnmount(() => { clearTimeout(delaiEntree); ro?.disconnect(); gsap.killTweensOf([poignee.value, plein.value, valEl.value]) })
</script>

<template>
  <div class="curseur-dix" :class="{ compact }">
    <div class="cd-val"><span ref="valEl" class="v" aria-live="polite" :aria-label="String(modelValue)"><ChiffresRoulants :valeur="affichee" :sens="sens" :duree="0.5" /></span><small>/{{ max }}</small></div>
    <div
      ref="rail" class="cd-rail" role="slider" tabindex="0" :aria-label="label"
      :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="modelValue"
      @pointerdown="debut" @pointermove="bouge" @pointerup="fin" @pointercancel="fin" @keydown="clavier"
    >
      <div class="cd-fond"></div>
      <div ref="plein" class="cd-plein"></div>
      <div class="cd-crans"><i v-for="n in max - min + 1" :key="n"></i></div>
      <div ref="poignee" class="cd-poignee"></div>
    </div>
    <div v-if="etiquettes.length" class="cd-ech"><span>{{ etiquettes[0] }}</span><span>{{ etiquettes[1] }}</span></div>
  </div>
</template>

<style scoped>
.curseur-dix { width: 100%; }
.cd-val { font-family: var(--font-chiffres); font-size: calc(var(--e) * 148px); line-height: 1; letter-spacing: -.07em; text-align: center; color: var(--accent-lisible); }
.cd-val small { font-size: calc(var(--e) * 38px); opacity: .45; letter-spacing: -.03em; }
.cd-val .v { display: inline-block; }
/* Zone de saisie large (72 px de haut) ; le rail visible n'en occupe qu'une bande. Marges latérales = demi-poignée. */
.cd-rail { position: relative; height: 72px; margin: 18px 26px 4px; touch-action: none; user-select: none; cursor: grab; outline-offset: 10px; }
.cd-fond, .cd-plein { position: absolute; left: 0; top: 28px; height: 16px; border-radius: 8px; }
.cd-fond { right: 0; background: var(--surface-2); }
.cd-plein { width: 100%; background: var(--accent-lisible); transform-origin: left; transform: scaleX(0); }
.cd-crans { position: absolute; left: 0; right: 0; top: 52px; display: flex; justify-content: space-between; }
.cd-crans i { width: 2px; height: 8px; background: var(--filet); border-radius: 1px; }
.cd-poignee { position: absolute; left: 0; top: 10px; width: 52px; height: 52px; margin-left: -26px; border-radius: 50%; background: var(--texte); box-shadow: 0 6px 20px rgba(0, 0, 0, .3); display: grid; place-items: center; }
.cd-poignee::after { content: ''; width: 16px; height: 16px; border-radius: 50%; background: var(--accent); }
.cd-ech { display: flex; justify-content: space-between; font-size: calc(var(--e) * 14px); color: var(--texte-doux); margin: 4px 4px 0; }
.compact .cd-val { font-size: calc(var(--e) * 72px); }
.compact .cd-val small { font-size: calc(var(--e) * 24px); }
.compact .cd-rail { margin-top: 6px; }
</style>
