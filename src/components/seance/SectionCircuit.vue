<script setup>
// Section d'un circuit (M1 + M2 + M4) : un circuit qui démarre OUVRE UNE NOUVELLE SECTION de la séance. L'écran change de couleur
// (teinte inversée) par un cercle depuis le bouton touché, puis : « Découvrir le circuit » -> explication -> exercices -> « Je suis prêt »
// (le chrono s'ouvre alors par-dessus). À la fin du circuit, la section se referme dans le bouton d'action de la page.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap } from 'gsap'
import Icone from '../Icone.vue'
import TempsTotal from './TempsTotal.vue'
import { butCircuit, etapesExplication, minutesDesExercices, titreCircuit } from '../../domain/circuitsUi.js'
import { videoDe } from '../../domain/video.js'
import { fermerCercle, mouvementReduit, nettoyer, ouvrirCercle } from '../../anim/transitions.js'
import { racineDe } from '../../anim/geometrie.js'
import { REBOND } from '../../anim/constantes.js'
import { useEnLigne } from '../../composables/useEnLigne.js'
import { SONS } from '../../lib/son.js'

const props = defineProps({
  item: { type: Object, required: true },
  exercices: { type: Object, default: () => ({}) }, // bibliothèque indexée par id
  repere: { type: Object, default: () => ({ lettre: 'A', rang: 1, taille: 1 }) },
  debut: { type: Number, default: 0 },
  src: { type: Object, default: null } // bouton « Découvrir le circuit » : la section naît de lui (maquette V2)
})
const emit = defineEmits(['pret', 'video', 'ferme'])
const enLigne = useEnLigne()

const racine = ref(null)
const etape = ref(1) // 1 = explication, 2 = exercices
const titre = computed(() => titreCircuit(props.item.format, props.item.params))
const etapes = computed(() => etapesExplication(props.item.format, props.item.params))
const but = computed(() => butCircuit(props.item.format, props.item.params))
const fac = computed(() => !!props.item.facultatif)
const kicker = computed(() => `${fac.value ? 'Option facultative' : 'Circuit'} · ${titre.value.detail}`)
const position = computed(() => `${fac.value ? 'Option' : `Bloc ${props.repere.lettre}`} · ${titre.value.nom}`)
const note = computed(() => (props.item.format === 'amrap' ? 'Un tour = tous les mouvements, dans cet ordre.' : 'Dans cet ordre, en suivant le chrono.'))

const mouvements = computed(() => {
  const liste = props.item.exercices || []
  const base = liste.length
    ? liste.map((x) => {
      const ex = props.exercices[x.exerciceId] || {}
      return { q: x.reps ? String(x.reps) : '', nom: ex.nom || 'Exercice', note: x.consignes || '', exercice: ex, video: videoDe(ex) }
    })
    : (props.item.params?.exercices || []).map((n) => ({ q: '', nom: n, note: '', exercice: {}, video: { type: 'aucune' } }))
  const minutes = props.item.format === 'emom' ? minutesDesExercices(base.length, props.item.params?.minutes || 10) : []
  return base.map((m, i) => ({ ...m, note: [minutes[i], m.note].filter(Boolean).join(' · ') }))
})

const balayage = { ouvert: 'inset(0% 0% 0% 0%)', ferme: 'inset(100% 0% 0% 0%)' } // le bas se soulève : bas -> haut
let occupe = false

onMounted(() => {
  const el = racine.value
  const scene2 = el.querySelector('.cc-s2')
  gsap.set(scene2, { xPercent: 100 })
  const entrees = el.querySelectorAll('.cc-s1 > *')
  SONS.tour()
  if (mouvementReduit()) { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 }); return }
  occupe = true
  const voile = el.querySelector('.cc-voile')
  // balayage bas -> haut, puis le voile jaune (la couleur de l'effort) se retire vers le haut : l'écran « change de couleur »
  // cercle jaune depuis le bouton touché (moment rare : 0,85 s), puis le voile jaune se relève sur la teinte inverse ; sans bouton : balayage bas -> haut
  const depuisBouton = props.src && props.src.isConnected
  const tl = gsap.timeline({ onComplete: () => { occupe = false; gsap.set(el, { clearProps: 'clipPath' }) } })
  if (depuisBouton) ouvrirCercle(el, props.src, { duree: 0.85 })
  else tl.fromTo(el, { clipPath: balayage.ferme }, { clipPath: balayage.ouvert, duration: 0.75, ease: 'expo.out' }, 0)
  tl.fromTo(voile, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'expo.inOut' }, depuisBouton ? 0.42 : 0.38)
    .fromTo('.cc-haut', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0.5)
    .fromTo(entrees, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.09, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.55)
})
onBeforeUnmount(() => { nettoyer(racine.value); gsap.killTweensOf(racine.value?.querySelectorAll('*')) })

function aller(n) {
  if (occupe) return
  etape.value = n
  const el = racine.value
  const s1 = el.querySelector('.cc-s1')
  const s2 = el.querySelector('.cc-s2')
  if (mouvementReduit()) {
    gsap.set(s2, { xPercent: n === 2 ? 0 : 100 })
    gsap.set(s1, { opacity: n === 2 ? 0 : 1 })
    return
  }
  gsap.to(s1, { xPercent: n === 2 ? -26 : 0, opacity: n === 2 ? 0.25 : 1, scale: n === 2 ? 0.94 : 1, duration: 0.7, ease: 'expo.out' })
  gsap.to(s2, { xPercent: n === 2 ? 0 : 100, duration: 0.7, ease: 'expo.out' })
  if (n === 2) {
    gsap.fromTo(s2.querySelectorAll('.cc-h2, .mvt, .cc-note, .cc-cta'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.05, delay: 0.3, ease: 'expo.out', clearProps: 'transform,opacity' })
    // les quantités roulent vers le haut (M2) : petit rebond
    gsap.fromTo(s2.querySelectorAll('.mvt .q'), { scale: 0.8 }, { scale: 1, duration: 0.7, stagger: 0.08, delay: 0.5, ease: REBOND.pop, clearProps: 'transform' })
  }
}

// Retour : de l'étape 2 à l'étape 1, puis fermeture de la section.
function retour() {
  if (occupe) return
  if (etape.value === 2) aller(1)
  else fermer()
}

// Fermeture : balayage inverse (le haut descend), la page du circuit réapparaît dessous.
function fermer() {
  const el = racine.value
  if (!el) return emit('ferme')
  nettoyer(el)
  occupe = true
  const fin = () => emit('ferme')
  if (mouvementReduit()) { gsap.to(el, { opacity: 0, duration: 0.18, onComplete: fin }); return }
  // la section se referme dans le bouton d'action de la page affichée (maquette V2) ; à défaut, balayage inverse
  const cible = racineDe(el).querySelector('.panel:not([inert]) [data-action]')
  if (cible && cible.offsetParent !== null) fermerCercle(el, cible, { duree: 0.7, onFini: fin })
  else gsap.to(el, { clipPath: balayage.ferme, duration: 0.55, ease: 'power3.out', onComplete: fin })
}
defineExpose({ fermer, retour })
</script>

<template>
  <div ref="racine" class="couche section" data-teinte="inverse" :aria-label="`${titre.nom} : ${kicker}`">
    <div class="cc-haut">
      <button class="cc-retour" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
      <span class="cc-pos">{{ position }}</span>
      <TempsTotal :debut="debut" />
    </div>
    <div class="cc-scenes">
      <div class="cc-s cc-s1">
        <p class="cc-kicker">{{ kicker }}</p>
        <h2 class="cc-h1">{{ titre.nom }}</h2>
        <p class="cc-but">{{ but }}</p>
        <ol class="cc-etapes">
          <li v-for="(t, i) in etapes" :key="i"><b>0{{ i + 1 }}</b><span>{{ t }}</span></li>
        </ol>
        <div class="cc-cta"><button class="cc-btn inv" type="button" data-voir @click="aller(2)">Voir les exercices<Icone nom="fleche" /></button></div>
      </div>
      <div class="cc-s cc-s2">
        <p class="cc-kicker">{{ titre.nom }} · {{ titre.detail }}</p>
        <h2 class="cc-h2">Les exercices</h2>
        <div class="cc-liste">
          <div v-for="(m, i) in mouvements" :key="i" class="mvt">
            <span class="q">{{ m.q || i + 1 }}</span>
            <span class="n"><b>{{ m.nom }}</b><small v-if="m.note">{{ m.note }}</small></span>
            <button v-if="m.video.type !== 'aucune' && enLigne" class="mv-video" type="button" :aria-label="`Voir la vidéo : ${m.nom}`" @click="emit('video', m.exercice, $event.currentTarget)">
              <Icone nom="lecture" />
            </button>
            <small v-else-if="m.video.type !== 'aucune'" class="mv-hors">hors connexion</small>
          </div>
        </div>
        <p class="cc-note">{{ note }}</p>
        <div class="cc-cta"><button class="cc-btn jaune" type="button" data-pret @click="emit('pret', $event.currentTarget)">Je suis prêt</button></div>
      </div>
    </div>
    <div class="cc-voile" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.section { z-index: 48; background: var(--tb); color: var(--tf); }
.cc-haut { position: absolute; z-index: 3; left: var(--pad); right: var(--pad); top: var(--haut); display: flex; align-items: center; gap: 12px; min-height: calc(var(--e) * 52px); }
.cc-retour { width: calc(var(--e) * 52px); height: calc(var(--e) * 52px); border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, currentColor 16%, transparent); flex: none; }
.cc-retour :deep(svg) { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.cc-pos { flex: 1; min-width: 0; font-size: calc(var(--e) * 13px); letter-spacing: .12em; text-transform: uppercase; font-weight: 600; opacity: .8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-scenes { position: absolute; inset: calc(var(--haut) + var(--e) * 52px + 8px) 0 0 0; overflow: hidden; overflow: clip; }
.cc-s { position: absolute; inset: 0; background: var(--tb); padding: 0 var(--pad) var(--bas); display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: none; }
.cc-s::-webkit-scrollbar { display: none; }
.cc-kicker { font-size: calc(var(--e) * 13px); letter-spacing: .12em; text-transform: uppercase; font-weight: 600; opacity: .72; margin-top: 8px; }
.cc-h1 { font-family: var(--font-titre); font-weight: 400; font-size: calc(var(--e) * 72px); letter-spacing: -.06em; line-height: .95; margin: 8px 0 14px; overflow-wrap: anywhere; }
.cc-h2 { font-family: var(--font-titre); font-weight: 400; font-size: calc(var(--e) * 38px); letter-spacing: -.05em; line-height: 1; margin: 6px 0 12px; }
.cc-but { font-family: var(--font-titre); font-size: calc(var(--e) * 22px); letter-spacing: -.03em; line-height: 1.2; margin-bottom: 18px; }
.cc-etapes { border-top: 1px solid color-mix(in srgb, currentColor 22%, transparent); }
.cc-etapes li { display: flex; gap: 18px; padding: 14px 0; border-bottom: 1px solid color-mix(in srgb, currentColor 22%, transparent); font-size: calc(var(--e) * 16px); line-height: 1.35; }
.cc-etapes li b { font-size: calc(var(--e) * 13px); opacity: .7; min-width: 24px; padding-top: 2px; font-variant-numeric: tabular-nums; }
.cc-liste { flex: none; }
.mvt { display: flex; align-items: center; gap: 14px; padding: 12px 0; min-height: calc(var(--e) * 72px); border-bottom: 1px solid color-mix(in srgb, currentColor 22%, transparent); }
.mvt .q { font-family: var(--font-chiffres); font-size: calc(var(--e) * 36px); letter-spacing: -.06em; min-width: calc(var(--e) * 56px); }
.mvt .n { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mvt .n b { font-size: calc(var(--e) * 18px); font-weight: 600; line-height: 1.2; }
.mvt .n small { font-size: calc(var(--e) * 13.5px); opacity: .75; line-height: 1.3; }
.mv-video { width: var(--cible); height: var(--cible); border-radius: 50%; background: color-mix(in srgb, currentColor 16%, transparent); display: grid; place-items: center; flex: none; }
.mv-video :deep(svg) { width: 16px; height: 16px; fill: currentColor; stroke: none; }
.mv-hors { font-size: calc(var(--e) * 12.5px); opacity: .75; }
.cc-note { margin-top: 14px; font-size: calc(var(--e) * 15px); line-height: 1.38; opacity: .85; }
.cc-cta { margin-top: auto; padding-top: 18px; flex: none; }
.cc-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: calc(var(--e) * 72px); border-radius: var(--r-btn); font-weight: 600; font-size: calc(var(--e) * 17px); transition: transform .32s var(--ressort); }
.cc-btn:active { transform: scale(.97); transition-duration: .1s; }
.cc-btn.inv { background: var(--tf); color: var(--tb); }
.cc-btn.jaune { background: var(--accent); color: var(--accent-texte); }
.cc-btn :deep(svg) { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.cc-voile { position: absolute; inset: 0; z-index: 5; background: var(--accent); pointer-events: none; }
@media (max-height: 700px) { .cc-h1 { font-size: calc(var(--e) * 56px); } }
@media (prefers-reduced-motion: reduce) { .cc-btn { transition: none; } .cc-voile { display: none; } }
</style>
