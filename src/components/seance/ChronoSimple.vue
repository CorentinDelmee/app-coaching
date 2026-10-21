<script setup>
// Chrono plein écran d'une série : préparation, temps de travail, repos. Cercle depuis le bouton touché.
// V2 : petite phrase au-dessus (« Respirez. »), chiffres en roulette qui descendent, balayage de couleur entre les phases, temps total de séance.
// Le temps vient du moteur de séance (échéances absolues) : ce composant affiche, il ne compte pas.
import { computed, onMounted, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { gsap } from 'gsap'
import Icone from '../Icone.vue'
import ChiffresRoulants from '../ChiffresRoulants.vue'
import TempsTotal from './TempsTotal.vue'
import { ouvrirCercle, fermerCercle, nettoyer, mouvementReduit } from '../../anim/transitions.js'
import { T } from '../../anim/constantes.js'
import { formaterChrono } from '../../domain/format.js'
import { phraseSerie } from '../../domain/phrases.js'
import { useMaintenant } from '../../composables/useMaintenant.js'
import { useBalayageCouleur } from '../../composables/useBalayageCouleur.js'
import { SONS } from '../../lib/son.js'

const props = defineProps({
  phase: { type: String, required: true },      // 'prep' | 'travail' | 'repos'
  fin: { type: Number, required: true },         // échéance (ms, horloge de l'app)
  duree: { type: Number, required: true },       // durée totale de la phase (ms), pour l'anneau
  sous: { type: String, default: '' },
  etiquetteExo: { type: String, default: '' },   // nom de l'exercice, en petites capitales en haut à gauche
  debut: { type: Number, default: 0 },           // début de la séance (temps total affiché en haut)
  src: { type: Object, default: null },         // bouton d'où naît le cercle
  reductible: { type: Boolean, default: false } // le repos peut se réduire en pastille
})
const emit = defineEmits(['plus', 'passer', 'terminer', 'annuler', 'reduire', 'ferme'])

const racine = ref(null)
const temps = ref(null)
const phraseEl = ref(null)
const maintenant = useMaintenant()
const restant = computed(() => Math.max(0, Math.ceil((props.fin - maintenant.value) / 1000)))
const fraction = computed(() => Math.min(1, Math.max(0, (props.fin - maintenant.value) / props.duree)))
const C = 2 * Math.PI * 136 // circonférence de l'anneau (rayon 136 dans un viewBox 300)

const affiche = useBalayageCouleur(racine, toRef(props, 'phase'))
const etiquette = computed(() => ({ prep: 'Préparation', travail: 'Travail', repos: 'Repos' }[props.phase]))
const phrase = computed(() => phraseSerie(props.phase, restant.value))
const texteTemps = computed(() => formaterChrono(restant.value * 1000))
const decalage = computed(() => C * (1 - fraction.value))

onMounted(() => {
  // action fréquente (≈ 15 fois par séance) : le cercle part tout de suite du bouton (maquette V2 : 0,5 s expo.out)
  ouvrirCercle(racine.value, props.src, { duree: T.repos, ease: 'expo.out' })
  // pendant l'ouverture en cercle, le contenu ne reçoit pas de toucher (évite un double toucher sur le bouton d'origine)
  const contenu = racine.value.querySelector('.ch-contenu')
  contenu.style.pointerEvents = 'none'
  setTimeout(() => { contenu.style.pointerEvents = '' }, 300)
  if (!mouvementReduit()) gsap.fromTo(contenu, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.15, ease: 'power1.out' })
})
onBeforeUnmount(() => { nettoyer(racine.value); gsap.killTweensOf([temps.value, phraseEl.value]) })

// Petit coup de pouce visuel : changement de phase, et chaque seconde des 3 dernières.
function pulse(echelle, duree) {
  if (temps.value && !mouvementReduit()) gsap.fromTo(temps.value, { scale: echelle }, { scale: 1, duration: duree, ease: 'back.out(1.5)' })
}
watch(() => props.phase, () => pulse(1.08, 0.6))
// « +15 s » : l'échéance recule, le chiffre fait un petit saut (le geste a bien été pris en compte)
watch(() => props.fin, (f, avant) => { if (avant && f - avant > 1000) pulse(1.1, 0.5) })
watch(restant, (r) => { if (r >= 1 && r <= 3) { pulse(1.1, 0.55); SONS.tic() } })
// La phrase monte d'un cran quand elle change (le texte lui-même vient de domain/phrases.js)
watch(phrase, () => { if (phraseEl.value && !mouvementReduit()) gsap.fromTo(phraseEl.value, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }) })

function fermer(vers) {
  fermerCercle(racine.value, vers, { onFini: () => emit('ferme') })
}
defineExpose({ fermer })
</script>

<template>
  <div ref="racine" class="couche chrono" hidden :style="{ '--ph-fg': `var(--ph-${affiche}-fg)`, '--ph-bg-actuel': `var(--ph-${affiche}-bg)` }">
    <div class="bgs">
      <i v-for="p in ['prep', 'travail', 'repos']" :key="p" :data-ph="p"></i>
    </div>
    <div class="ch-contenu">
      <div class="ch-haut">
        <button v-if="reductible" class="reduire" type="button" aria-label="Réduire le repos" @click="emit('reduire')"><Icone nom="bas" /></button>
        <span class="ch-label">{{ etiquetteExo || etiquette }}</span>
        <TempsTotal :debut="debut" />
      </div>
      <p ref="phraseEl" class="ch-phrase">{{ phrase }}</p>
      <div class="ch-anneau">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <circle class="piste-a" cx="150" cy="150" r="136" />
          <circle class="reste" cx="150" cy="150" r="136" :style="{ strokeDasharray: C, strokeDashoffset: decalage }" />
        </svg>
        <div ref="temps" class="ch-temps" role="timer" :aria-label="`${etiquette} : ${texteTemps}`"><ChiffresRoulants :valeur="texteTemps" /></div>
      </div>
      <div class="ch-bas">
        <p class="ch-sous">{{ sous }}</p>
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
.bgs { position: absolute; inset: 0; z-index: 0; } /* contexte d empilement : les couches de couleur restent sous le contenu */
.bgs i { position: absolute; inset: 0; opacity: 0; }
.bgs i[data-ph="prep"] { background: var(--ph-prep-bg); }
.bgs i[data-ph="travail"] { background: var(--ph-travail-bg); }
.bgs i[data-ph="repos"] { background: var(--ph-repos-bg); }
.ch-contenu { position: absolute; inset: 0; z-index: 1; padding: var(--haut) var(--pad) var(--bas); display: flex; flex-direction: column; align-items: center; }
.ch-haut { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: var(--cible); }
.ch-label { flex: 1; min-width: 0; font-size: calc(var(--e) * 13px); letter-spacing: .12em; text-transform: uppercase; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reduire { width: var(--cible); height: var(--cible); border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, currentColor 16%, transparent); flex: none; }
.reduire svg { width: 24px; height: 24px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.ch-phrase { font-family: var(--font-titre); font-weight: 400; font-size: calc(var(--e) * 44px); letter-spacing: -.045em; line-height: 1.05; margin-top: 10px; text-align: center; }
.ch-anneau { position: relative; width: calc(var(--e-chrono) * 300px); max-width: 100%; aspect-ratio: 1; margin: auto 0; display: grid; place-items: center; }
.ch-anneau svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.piste-a { fill: none; stroke: currentColor; stroke-opacity: .2; stroke-width: 14; }
.reste { fill: none; stroke: currentColor; stroke-width: 14; stroke-linecap: round; }
.ch-temps { font-family: var(--font-chrono); font-weight: var(--graisse-chrono); font-size: calc(var(--e-chrono) * 112px); letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1; }
.ch-bas { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.ch-sous { font-size: calc(var(--e) * 17px); opacity: .85; text-align: center; font-weight: 500; line-height: 1.3; min-height: 22px; }
.rang-btn { display: flex; gap: 10px; }
.rang-btn button { flex: 1; min-height: calc(var(--e) * 64px); border-radius: 22px; font-weight: 600; font-size: calc(var(--e) * 17px); background: color-mix(in srgb, currentColor 16%, transparent); transition: transform .32s var(--ressort); }
.rang-btn button:active { transform: scale(.96); transition-duration: .1s; }
.rang-btn button.plein { background: var(--ph-fg); color: var(--ph-bg-actuel); }
@media (max-height: 760px) { .ch-anneau { width: calc(var(--e-chrono) * 250px); } .ch-temps { font-size: calc(var(--e-chrono) * 92px); } .ch-phrase { font-size: calc(var(--e) * 36px); } }
@media (prefers-reduced-motion: reduce) { .rang-btn button { transition: none; } }
</style>
