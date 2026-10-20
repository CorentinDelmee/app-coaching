<script setup>
// Chrono plein écran d'un circuit, adapté à chacun des 8 formats. Les temps viennent du moteur (engine/circuits) via `st`,
// recalculé à chaque image par le parent ; ce composant affiche et renvoie les gestes (+1 tour, Terminé, Échec, Suivant…).
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { gsap } from 'gsap'
import Icone from '../Icone.vue'
import { ouvrirCercle, fermerCercle, nettoyer, mouvementReduit } from '../../anim/transitions.js'
import { modeleChrono, secondesAvantChangement, sonDuSignal } from '../../domain/circuitsUi.js'
import { detecterSignal, etatChrono } from '../../engine/circuits.js'
import { useMaintenant } from '../../composables/useMaintenant.js'
import { SONS } from '../../lib/son.js'

const props = defineProps({
  item: { type: Object, required: true },            // le circuit : { format, params, … }
  evenements: { type: Array, required: true },       // événements du chrono (démarrer, pause, tour…), voir engine/circuits
  mouvements: { type: Array, default: () => [] },    // [{ q, n }] pour la liste de l'AMRAP
  src: { type: Object, default: null }
})
const emit = defineEmits(['action', 'pause', 'reprendre', 'arreter', 'passer-prep', 'valider', 'ferme'])

const maintenant = useMaintenant()
// Le temps n'est jamais compté ici : le moteur le recalcule à chaque image à partir des événements et de l'horloge.
const st = computed(() => etatChrono(props.item.format, props.item.params, props.evenements, maintenant.value))
const racine = ref(null)
const grandEl = ref(null)
const flash = ref(null)
const C = 2 * Math.PI * 136
const m = computed(() => modeleChrono(st.value))
const grosFormat = computed(() => ['amrap', 'fortime', 'timecap'].includes(st.value.format) && st.value.phase !== 'preparation' && !st.value.termine)
const sousXl = computed(() => ['emom', 'deathby'].includes(st.value.format) && !st.value.termine && st.value.phase !== 'preparation')
const grandTitre = computed(() => st.value.format === 'superset' && st.value.phase === 'travail' && !st.value.termine)
// Circuit terminé : l'écran passe sur l'accent et l'anneau se remplit d'un trait (récompense), au lieu d'un anneau vide sur gris.
const remplissageFin = ref(0)
const theme = computed(() => (st.value.termine ? 'travail' : m.value.theme))
const decalage = computed(() => {
  if (st.value.termine) return C * (1 - remplissageFin.value)
  const p = m.value.anneauProchain ?? m.value.anneau
  return C * (1 - Math.max(0, Math.min(1, p ?? 0)))
})
const lisse = computed(() => m.value.anneauProchain !== null && !st.value.enPause)
const etiquette = computed(() => (st.value.enPause ? 'En pause' : m.value.etiquette))

// Arrêt en deux temps : un premier toucher demande confirmation (évite d'abandonner un chrono par erreur).
const confirmer = ref(false)
let delaiConfirmer = 0
function arret() {
  if (st.value.phase === 'preparation' || st.value.termine) return emit('arreter')
  if (confirmer.value) { clearTimeout(delaiConfirmer); confirmer.value = false; return emit('arreter') }
  confirmer.value = true
  delaiConfirmer = setTimeout(() => { confirmer.value = false }, 3000)
}

// AMRAP terminé : répétitions en plus.
const repsEnPlus = ref(0)
const bornes = (n) => Math.max(0, Math.min(999, n))

onMounted(() => {
  ouvrirCercle(racine.value, props.src)
  // pendant l'ouverture en cercle, le contenu ne reçoit pas de toucher (évite un double toucher sur le bouton d'origine)
  const contenu = racine.value.querySelector('.ch-contenu')
  contenu.style.pointerEvents = 'none'
  setTimeout(() => { contenu.style.pointerEvents = '' }, 300)
  if (!mouvementReduit()) gsap.fromTo(contenu, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.22, ease: 'power1.out' })
})
onBeforeUnmount(() => { clearTimeout(delaiConfirmer); nettoyer(racine.value) })

// --- Animations d'événement ---------------------------------------------------------------------
function pulse(el, echelle, duree) {
  if (el && !mouvementReduit()) gsap.fromTo(el, { scale: echelle }, { scale: 1, duration: duree, ease: 'expo.out' })
}
// Chaque seconde des 3 dernières : le gros chiffre pulse (le tic sonore est joué par le parent).
watch(() => secondesAvantChangement(st.value), (s, avant) => { if (s !== avant && s >= 1 && s <= 3) pulse(grandEl.value, 1.14, 0.55) })
watch(() => st.value.segment, (seg, avant) => {
  pulse(grandEl.value, 1.08, 0.6)
  // EMOM / Death by : l'annonce de la minute recouvre l'écran un instant.
  if (['emom', 'deathby'].includes(st.value.format) && st.value.phase === 'travail' && avant > 0) annoncerMinute()
})
function annoncerMinute() {
  const f = flash.value
  if (!f) return
  const g = f.querySelector('.mf-n, .mf-m') && f
  if (mouvementReduit()) { gsap.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.15, yoyo: true, repeat: 1, repeatDelay: 0.5 }); return }
  gsap.timeline()
    .fromTo(g, { opacity: 1, clipPath: 'inset(100% 0px 0px 0px)' }, { clipPath: 'inset(0% 0px 0px 0px)', duration: 0.35, ease: 'expo.out' })
    .fromTo(g.querySelectorAll('.mf-n, .mf-m'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.05, ease: 'expo.out' }, 0.05)
    .to(g, { clipPath: 'inset(0px 0px 100% 0px)', duration: 0.45, ease: 'power3.inOut' }, '+=.45')
    .set(g, { opacity: 0, clearProps: 'clipPath' })
}
watch(() => st.value.termine, (t) => {
  if (!t) return
  pulse(grandEl.value, 1.2, 1)
  if (mouvementReduit()) { remplissageFin.value = 1; return }
  const o = { p: 0 }
  gsap.to(o, { p: 1, duration: 1.2, delay: 0.1, ease: 'expo.out', onUpdate: () => { remplissageFin.value = o.p } })
}, { immediate: true })

// Compteur de tours : petit rebond à chaque +1.
const toursEl = ref(null)
watch(() => st.value.tours, (n, avant) => { if (n > avant && toursEl.value && !mouvementReduit()) gsap.fromTo(toursEl.value, { scale: 1.5, y: -8 }, { scale: 1, y: 0, duration: 0.7, ease: 'elastic.out(1,.45)' }) })

// Sons : un signal à chaque changement de segment (départ, travail, repos, minute, fin), un tic sur les 3 dernières secondes.
let precedent = null
watch(st, (courant) => {
  const signal = precedent ? detecterSignal(precedent, courant) : null
  const sec = secondesAvantChangement(courant)
  if (signal) SONS[sonDuSignal(signal)]?.()
  else if (precedent && sec !== secondesAvantChangement(precedent) && sec >= 1 && sec <= 3 && !courant.enPause) SONS.tic()
  precedent = courant
}, { immediate: true })

function fermer(vers) { fermerCercle(racine.value, vers, { onFini: () => emit('ferme') }) }
defineExpose({ fermer })
</script>

<template>
  <div ref="racine" class="couche chrono" hidden :style="{ '--ph-fg': `var(--ph-${theme}-fg)`, '--ph-bg-actuel': `var(--ph-${theme}-bg)` }">
    <div class="bgs">
      <i v-for="p in ['prep', 'travail', 'repos']" :key="p" :data-ph="p" :style="{ opacity: p === theme ? 1 : 0 }"></i>
    </div>
    <div class="ch-contenu" :data-format="st.format">
      <div class="ch-phase"><span class="ch-pt"></span><span>{{ etiquette }}</span></div>
      <p class="ch-sous" :class="{ xl: sousXl }">{{ m.sous }}</p>

      <!-- AMRAP, For Time, Time cap : chiffre géant, barre de progression, gros bouton -->
      <template v-if="grosFormat">
        <div class="ch-gros">
          <div ref="grandEl" class="ch-temps xl" role="timer">{{ m.grand }}</div>
          <div v-if="m.anneau !== null" class="barre" aria-hidden="true"><i :style="{ transform: `scaleX(${Math.max(0, Math.min(1, m.anneau))})` }"></i></div>
          <div class="ch-petit">{{ m.petit }}</div>
          <template v-if="st.format === 'amrap'">
            <div class="ch-tours">
              <span>Tours</span><b ref="toursEl">{{ st.tours }}</b>
              <button v-if="st.tours > 0" class="moins" type="button" aria-label="Retirer un tour" @click="emit('action', 'moins-un-tour')"><Icone nom="moins" /></button>
            </div>
            <ul v-if="mouvements.length" class="liste-mvt">
              <li v-for="(x, i) in mouvements" :key="i"><b>{{ x.q }}</b>{{ x.n }}</li>
            </ul>
          </template>
        </div>
        <button class="btn-gros" :class="{ geant: st.format === 'amrap' }" type="button" :disabled="st.enPause" @click="emit('action', m.action.id)">{{ m.action.libelle }}</button>
      </template>

      <!-- Tous les autres cas : anneau + chiffre -->
      <template v-else>
        <div class="ch-anneau" :class="{ titre: grandTitre }">
          <svg v-if="m.anneau !== null" viewBox="0 0 300 300" aria-hidden="true">
            <circle class="piste-a" cx="150" cy="150" r="136" />
            <circle class="reste" :class="{ lisse }" cx="150" cy="150" r="136" :style="{ strokeDasharray: C, strokeDashoffset: decalage }" />
          </svg>
          <div class="ch-centre">
            <div ref="grandEl" class="ch-temps" :class="{ 'en-titre': grandTitre, texte: st.termine && st.format === 'fortime' }" role="timer">{{ m.grand }}</div>
            <div v-if="m.petit" class="ch-petit">{{ m.petit }}</div>
          </div>
        </div>
        <div v-if="st.termine && st.format === 'amrap'" class="reps-plus">
          <span>Répétitions en plus</span>
          <div class="pm">
            <button type="button" aria-label="Une de moins" @click="repsEnPlus = bornes(repsEnPlus - 1)"><Icone nom="moins" /></button>
            <b>{{ repsEnPlus }}</b>
            <button type="button" aria-label="Une de plus" @click="repsEnPlus = bornes(repsEnPlus + 1)"><Icone nom="plus" /></button>
          </div>
        </div>
        <button v-if="m.action" class="btn-gros" type="button" :disabled="st.enPause" @click="emit('action', m.action.id)">{{ m.action.libelle }}</button>
      </template>

      <div class="ch-bas">
        <div class="rang-btn">
          <template v-if="st.phase === 'preparation'">
            <button type="button" @click="arret">Annuler</button>
            <button type="button" class="plein" @click="emit('passer-prep')">Commencer maintenant</button>
          </template>
          <template v-else-if="st.termine">
            <button type="button" class="plein" @click="emit('valider', { repsEnPlus })">Valider le circuit</button>
          </template>
          <template v-else>
            <button type="button" @click="st.enPause ? emit('reprendre') : emit('pause')">{{ st.enPause ? 'Reprendre' : 'Pause' }}</button>
            <button type="button" :class="{ plein: confirmer }" @click="arret">{{ confirmer ? 'Confirmer l\'arrêt' : 'Arrêter' }}</button>
          </template>
        </div>
      </div>
    </div>
    <div ref="flash" class="minute-flash" aria-hidden="true">
      <div><div class="mf-n">{{ m.etiquette }}</div><div class="mf-m">{{ m.sous }}</div></div>
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
.ch-phase { font-family: var(--font-titre); font-size: 22px; letter-spacing: -.03em; margin-top: 16px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
.ch-pt { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: currentColor; }
.ch-sous { margin-top: 8px; font-size: 17px; opacity: .78; text-align: center; font-weight: 500; line-height: 1.3; max-width: 340px; min-height: 22px; }
.ch-sous.xl { font-family: var(--font-titre); font-size: 30px; letter-spacing: -.04em; line-height: 1.1; opacity: 1; margin-top: 14px; font-weight: 400; }
.ch-gros { width: 100%; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ch-temps { font-family: var(--font-chrono); font-weight: 500; font-size: 112px; letter-spacing: -.05em; font-variant-numeric: tabular-nums; line-height: 1; }
.ch-temps.xl { font-size: 150px; }
.ch-temps.en-titre { font-family: var(--font-titre); font-weight: 400; font-size: 42px; letter-spacing: -.05em; line-height: 1.05; text-align: center; padding: 0 18px; }
.ch-petit { font-size: 22px; font-weight: 500; opacity: .8; margin-top: 8px; font-variant-numeric: tabular-nums; text-align: center; min-height: 6px; }
.barre { width: 78%; height: 8px; border-radius: 4px; background: color-mix(in srgb, currentColor 20%, transparent); overflow: hidden; margin-top: 12px; }
.barre i { display: block; height: 100%; background: currentColor; border-radius: 4px; transform-origin: left; }
.ch-tours { display: flex; align-items: center; gap: 14px; margin: 8px 0 2px; }
.ch-tours b { font-family: var(--font-chiffres); font-weight: 400; font-size: 64px; letter-spacing: -.07em; line-height: 1; min-width: 80px; text-align: center; font-variant-numeric: tabular-nums; }
.ch-tours span { font-size: 15px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; opacity: .75; }
.moins { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, currentColor 16%, transparent); }
.moins svg, .pm svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; }
.liste-mvt { width: 100%; margin: 8px 0; display: flex; flex-direction: column; }
.liste-mvt li { display: flex; align-items: baseline; gap: 12px; padding: 7px 4px; border-top: 1px solid color-mix(in srgb, currentColor 22%, transparent); font-size: 17px; font-weight: 500; }
.liste-mvt li b { font-family: var(--font-chiffres); font-weight: 400; min-width: 34px; letter-spacing: -.04em; }
.btn-gros { width: 100%; min-height: 110px; border-radius: 30px; background: var(--ph-fg); color: var(--ph-bg-actuel); font-family: var(--font-titre); font-size: 30px; letter-spacing: -.04em; font-weight: 400; margin-bottom: 12px; transition: transform .14s var(--ease); flex: none; }
.btn-gros.geant { min-height: 138px; border-radius: 34px; font-size: 34px; }
.btn-gros:active { transform: scale(.97); }
.btn-gros:disabled { opacity: .35; }
.ch-anneau { position: relative; width: 300px; height: 300px; margin: auto 0; display: grid; place-items: center; }
.ch-anneau.titre { width: 100%; height: 300px; }
.ch-anneau svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.piste-a { fill: none; stroke: currentColor; stroke-opacity: .2; stroke-width: 14; }
.reste { fill: none; stroke: currentColor; stroke-width: 14; stroke-linecap: round; }
.reste.lisse { transition: stroke-dashoffset 1s linear; }
.ch-centre { position: relative; display: flex; flex-direction: column; align-items: center; }
.ch-temps.texte { font-size: 76px; }
.reps-plus { width: 100%; background: color-mix(in srgb, currentColor 14%, transparent); border-radius: 24px; padding: 12px 14px 12px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-weight: 600; font-size: 16px; }
.pm { display: flex; align-items: center; gap: 6px; }
.pm button { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, currentColor 16%, transparent); }
.pm b { font-family: var(--font-chiffres); font-weight: 400; font-size: 40px; min-width: 64px; text-align: center; letter-spacing: -.06em; }
.ch-bas { width: 100%; display: flex; flex-direction: column; gap: 10px; flex: none; }
.rang-btn { display: flex; gap: 10px; }
.rang-btn button { flex: 1; min-height: 64px; border-radius: 22px; font-weight: 600; font-size: 17px; background: color-mix(in srgb, currentColor 16%, transparent); transition: transform .14s var(--ease); }
.rang-btn button:active { transform: scale(.96); }
.rang-btn button.plein { background: var(--ph-fg); color: var(--ph-bg-actuel); }
.minute-flash { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; text-align: center; background: var(--ph-fg); color: var(--ph-bg-actuel); pointer-events: none; opacity: 0; }
.mf-n { font-family: var(--font-titre); font-size: 22px; letter-spacing: .1em; text-transform: uppercase; }
.mf-m { font-family: var(--font-titre); font-size: 54px; letter-spacing: -.05em; line-height: 1.02; margin-top: 10px; padding: 0 20px; }
@media (max-height: 760px) {
  .liste-mvt { display: none; }
  .ch-anneau { width: 250px; height: 250px; } .ch-temps { font-size: 92px; } .ch-temps.xl { font-size: 124px; }
  .btn-gros.geant { min-height: 112px; }
}
@media (prefers-reduced-motion: reduce) { .bgs i, .btn-gros, .rang-btn button, .reste.lisse { transition: none; } }
</style>
