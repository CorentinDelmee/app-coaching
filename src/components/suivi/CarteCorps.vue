<script setup>
// Carte du corps : silhouette SVG (face / dos), chaque zone se touche pour noter une douleur. La couleur d'une zone suit sa dernière
// intensité récente (domain/corps.js). Au premier affichage les zones apparaissent du centre vers l'extérieur ; le passage face <-> dos
// retourne la silhouette. La feuille de saisie est gérée par la page (emit « zone »).
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap } from 'gsap'
import { HAUTEUR_CARTE, LARGEUR_CARTE, cheminForme, intensiteCarte, teinteIntensite, zonesActives, zonesDeVue } from '../../domain/corps.js'
import { mouvementReduit } from '../../anim/transitions.js'

const props = defineProps({
  douleurs: { type: Array, required: true },
  aujourdhui: { type: String, required: true }
})
const emit = defineEmits(['zone'])

const vue = ref('face')
const racine = ref(null)
const corps = ref(null)
const curseur = ref(null)
let occupe = false
let io = null

const zones = computed(() => zonesDeVue(vue.value).map((z) => ({
  id: z.id, libelle: z.libelle, d: cheminForme(z.formes[vue.value]),
  intensite: intensiteCarte(props.douleurs, z.id, props.aujourdhui)
})))
const actives = computed(() => zonesActives(props.douleurs, props.aujourdhui))
const fond = (i) => (i > 0 ? `color-mix(in srgb, var(--accent) ${teinteIntensite(i)}%, var(--surface-2))` : undefined)
const etat = (z) => (z.intensite > 0 ? `douleur ${z.intensite} sur 10` : 'aucune douleur notée récemment')

function basculer(vers) {
  if (vers === vue.value || occupe) return
  occupe = true
  gsap.to(curseur.value, { xPercent: vers === 'dos' ? 100 : 0, duration: 0.6, ease: 'expo.out' })
  if (mouvementReduit()) { vue.value = vers; occupe = false; return }
  gsap.to(corps.value, {
    scaleX: 0, duration: 0.2, ease: 'power2.in',
    onComplete: async () => {
      vue.value = vers
      await nextTick()
      gsap.fromTo(corps.value, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'back.out(1.6)', clearProps: 'transform', onComplete: () => { occupe = false } })
    }
  })
}

function toucher(z, e) {
  const el = e.currentTarget
  if (!mouvementReduit()) gsap.fromTo(el, { scale: 1.1, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.7, ease: 'elastic.out(1,.45)', clearProps: 'transform' })
  emit('zone', z.id)
}
const clavier = (z, e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toucher(z, e) } }

/** Petit rebond de la zone qui vient d'être enregistrée. */
function flash(id) {
  if (mouvementReduit()) return
  const el = racine.value?.querySelector(`[data-zone="${id}"]`)
  if (el) gsap.fromTo(el, { scale: 1.18, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.9, ease: 'elastic.out(1,.4)', clearProps: 'transform' })
}
defineExpose({ flash })

function entree() {
  if (mouvementReduit()) return
  const els = racine.value.querySelectorAll('.zone')
  gsap.fromTo(els, { scale: 0.6, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.6)', stagger: { amount: 0.7, from: 'center' }, clearProps: 'transform,opacity' })
}
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  // les zones sont cachées jusqu'à leur entrée (pas de flash plein puis vide)
  if (!mouvementReduit()) gsap.set(racine.value.querySelectorAll('.zone'), { opacity: 0 })
  io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { entree(); io.disconnect() } }, { threshold: 0.25 })
  io.observe(corps.value)
})
onBeforeUnmount(() => { io?.disconnect(); gsap.killTweensOf([corps.value, curseur.value]) })
</script>

<template>
  <div ref="racine" class="carte-corps">
    <div class="bascule" role="group" aria-label="Vue du corps">
      <span ref="curseur" class="curseur"></span>
      <button type="button" :aria-pressed="vue === 'face'" @click="basculer('face')">Face</button>
      <button type="button" :aria-pressed="vue === 'dos'" @click="basculer('dos')">Dos</button>
    </div>

    <div ref="corps" class="cc-corps">
      <svg :viewBox="`0 0 ${LARGEUR_CARTE} ${HAUTEUR_CARTE}`" role="group" :aria-label="`Carte du corps, vue de ${vue === 'face' ? 'face' : 'dos'}. Touchez une zone pour noter une douleur.`">
        <path
          v-for="z in zones" :key="vue + z.id" class="zone" :class="{ active: z.intensite > 0, forte: z.intensite > 6 }" :d="z.d" :data-zone="z.id"
          :style="{ fill: fond(z.intensite) }" role="button" tabindex="0" :aria-label="`${z.libelle}, ${etat(z)}`"
          @click="toucher(z, $event)" @keydown="clavier(z, $event)"
        />
      </svg>
    </div>

    <p v-if="!actives.length" class="cc-legende">Aucune douleur notée. Touchez une zone si quelque chose vous gêne.</p>
    <ul v-else class="cc-actives" aria-label="Zones avec une douleur récente">
      <li v-for="z in actives" :key="z.id" :class="{ forte: z.intensite > 6 }"><b>{{ z.intensite }}</b>{{ z.libelle }}</li>
    </ul>
  </div>
</template>

<style scoped>
.cc-corps { width: min(100%, 236px); margin: 6px auto 0; }
.cc-corps svg { display: block; width: 100%; height: auto; overflow: visible; }
.zone { fill: color-mix(in srgb, var(--texte) 13%, var(--surface)); stroke: var(--surface); stroke-width: 2; cursor: pointer; transform-box: fill-box; transform-origin: center; transition: filter .15s; outline: none; }
.zone:active { filter: brightness(1.2); }
.zone:focus-visible { stroke: var(--accent-lisible); stroke-width: 3.5; }
.zone.forte { stroke: var(--accent-lisible); stroke-width: 3; }
.cc-legende { margin-top: 12px; font-size: 14.5px; color: var(--texte-doux); text-align: center; line-height: 1.35; }
.cc-actives { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 14px; }
.cc-actives li { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 18px; background: var(--surface-2); font-size: 14px; font-weight: 600; }
.cc-actives b { display: grid; place-items: center; min-width: 26px; height: 26px; border-radius: 13px; background: var(--accent); color: var(--accent-texte); font-family: var(--font-chiffres); font-weight: 400; font-size: 13px; }
.cc-actives li.forte { box-shadow: inset 0 0 0 2px var(--accent-lisible); }
.cc-corps + .cc-legende { margin-top: 10px; }
</style>
