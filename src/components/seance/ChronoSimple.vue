<script setup>
// Chrono plein écran d'une série : préparation (« Prêt ? »), temps de travail, repos. Cercle depuis le bouton touché.
// Le temps vient du moteur de séance (échéances absolues) : ce composant affiche, il ne compte pas.
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { gsap } from 'gsap'
import Icone from '../Icone.vue'
import { ouvrirCercle, fermerCercle, nettoyer, mouvementReduit } from '../../anim/transitions.js'
import { formaterChrono } from '../../domain/format.js'
import { useMaintenant } from '../../composables/useMaintenant.js'
import { SONS } from '../../lib/son.js'

const props = defineProps({
  phase: { type: String, required: true },      // 'prep' | 'travail' | 'repos'
  fin: { type: Number, required: true },         // échéance (ms, horloge de l'app)
  duree: { type: Number, required: true },       // durée totale de la phase (ms), pour l'anneau
  sous: { type: String, default: '' },
  src: { type: Object, default: null },         // bouton d'où naît le cercle
  reductible: { type: Boolean, default: false } // le repos peut se réduire en pastille
})
const emit = defineEmits(['plus', 'passer', 'terminer', 'annuler', 'reduire', 'ferme'])

const racine = ref(null)
const temps = ref(null)
const maintenant = useMaintenant()
const restant = computed(() => Math.max(0, Math.ceil((props.fin - maintenant.value) / 1000)))
const fraction = computed(() => Math.min(1, Math.max(0, (props.fin - maintenant.value) / props.duree)))
const C = 2 * Math.PI * 136 // circonférence de l'anneau (rayon 136 dans un viewBox 300)

const etiquette = computed(() => ({ prep: 'Prêt ?', travail: 'Allez !', repos: 'Repos' }[props.phase]))
const texteTemps = computed(() => formaterChrono(restant.value * 1000))
const decalage = computed(() => C * (1 - fraction.value))

onMounted(() => {
  ouvrirCercle(racine.value, props.src)
  // pendant l'ouverture en cercle, le contenu ne reçoit pas de toucher (évite un double toucher sur le bouton d'origine)
  const contenu = racine.value.querySelector('.ch-contenu')
  contenu.style.pointerEvents = 'none'
  setTimeout(() => { contenu.style.pointerEvents = '' }, 450)
  if (!mouvementReduit()) gsap.fromTo(contenu, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.22, ease: 'power1.out' })
})
onBeforeUnmount(() => nettoyer(racine.value))

// Petit coup de pouce visuel : changement de phase, et chaque seconde des 3 dernières.
function pulse(echelle, duree) {
  if (temps.value && !mouvementReduit()) gsap.fromTo(temps.value, { scale: echelle }, { scale: 1, duration: duree, ease: 'expo.out' })
}
watch(() => props.phase, () => pulse(1.08, 0.6))
// « +15 s » : l'échéance recule, le chiffre fait un petit saut (le geste a bien été pris en compte)
watch(() => props.fin, (f, avant) => { if (avant && f - avant > 1000) pulse(1.1, 0.5) })
watch(restant, (r) => { if (r >= 1 && r <= 3) { pulse(1.14, 0.55); SONS.tic() } })

function fermer(vers) {
  fermerCercle(racine.value, vers, { onFini: () => emit('ferme') })
}
defineExpose({ fermer })
</script>

<template>
  <div ref="racine" class="couche chrono" hidden :style="{ '--ph-fg': `var(--ph-${phase}-fg)`, '--ph-bg-actuel': `var(--ph-${phase}-bg)` }">
    <div class="bgs">
      <i v-for="p in ['prep', 'travail', 'repos']" :key="p" :data-ph="p" :style="{ opacity: p === phase ? 1 : 0 }"></i>
    </div>
    <div class="ch-contenu">
      <button v-if="reductible" class="reduire" type="button" aria-label="Réduire le repos" @click="emit('reduire')"><Icone nom="bas" /></button>
      <div class="ch-phase"><span class="ch-pt"></span><span>{{ etiquette }}</span></div>
      <p class="ch-sous">{{ sous }}</p>
      <div class="ch-anneau">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <circle class="piste-a" cx="150" cy="150" r="136" />
          <circle class="reste" cx="150" cy="150" r="136" :style="{ strokeDasharray: C, strokeDashoffset: decalage }" />
        </svg>
        <div ref="temps" class="ch-temps" role="timer" :aria-label="`${etiquette} : ${texteTemps}`">{{ texteTemps }}</div>
      </div>
      <div class="ch-bas">
        <div v-if="phase === 'repos'" class="rang-btn">
          <button type="button" @click="emit('plus')">+15 s</button>
          <button type="button" class="plein" @click="emit('passer')">Passer</button>
        </div>
        <div v-else-if="phase === 'travail'" class="rang-btn">
          <button type="button" @click="emit('annuler')">Annuler</button>
          <button type="button" class="plein" @click="emit('terminer')">Terminer</button>
        </div>
        <div v-else class="rang-btn">
          <button type="button" class="plein" @click="emit('passer')">Commencer maintenant</button>
        </div>
      </div>
    </div>
    <div class="voile" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.chrono { z-index: 60; color: var(--ph-fg); }
.bgs { position: absolute; inset: 0; }
.bgs i { position: absolute; inset: 0; transition: opacity .22s linear; }
.bgs i[data-ph="prep"] { background: var(--ph-prep-bg); }
.bgs i[data-ph="travail"] { background: var(--ph-travail-bg); }
.bgs i[data-ph="repos"] { background: var(--ph-repos-bg); }
.ch-contenu { position: absolute; inset: 0; padding: var(--haut) var(--pad) var(--bas); display: flex; flex-direction: column; align-items: center; }
.reduire { position: absolute; left: var(--pad); top: var(--haut); width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, currentColor 16%, transparent); }
.reduire svg { width: 24px; height: 24px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.ch-phase { font-family: var(--font-titre); font-size: 22px; letter-spacing: -.03em; margin-top: 16px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
.ch-pt { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: currentColor; }
.ch-sous { margin-top: 8px; font-size: 17px; opacity: .78; text-align: center; font-weight: 500; line-height: 1.3; max-width: 320px; min-height: 22px; }
.ch-anneau { position: relative; width: 300px; height: 300px; margin: auto 0; display: grid; place-items: center; }
.ch-anneau svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.piste-a { fill: none; stroke: currentColor; stroke-opacity: .2; stroke-width: 14; }
.reste { fill: none; stroke: currentColor; stroke-width: 14; stroke-linecap: round; }
.ch-temps { font-family: var(--font-chrono); font-weight: 500; font-size: 112px; letter-spacing: -.05em; font-variant-numeric: tabular-nums; line-height: 1; }
.ch-bas { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.rang-btn { display: flex; gap: 10px; }
.rang-btn button { flex: 1; min-height: 64px; border-radius: 22px; font-weight: 600; font-size: 17px; background: color-mix(in srgb, currentColor 16%, transparent); transition: transform .14s var(--ease); }
.rang-btn button:active { transform: scale(.96); }
.rang-btn button.plein { background: var(--ph-fg); color: var(--ph-bg-actuel); }
@media (max-height: 760px) { .ch-anneau { width: 250px; height: 250px; } .ch-temps { font-size: 92px; } }
@media (prefers-reduced-motion: reduce) { .bgs i, .rang-btn button { transition: none; } }
</style>
