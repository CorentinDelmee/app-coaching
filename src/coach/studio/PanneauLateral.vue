<script setup>
// Panneau d'édition du Studio : à côté du contenu sur ordinateur (fixe à droite, 440 px ; 400 px de 901 à 1180 px),
// feuille plein écran glissable sur téléphone (≤ 900 px : se ferme si glissée > 140 px ou vite).
// En-tête média 16:9 (slot « media ») avec barre : Fermer, Précédent, Suivant, indicateur de sauvegarde (+ slot « barre »).
// Contenu (slot par défaut) défilant, entrée en cascade (40 ms). Téléporté dans #st-calques (CoachLayout).
// Clavier : Échap ferme ; ↑ ↓ (hors champ de saisie) = précédent / suivant. Le focus va sur « Fermer » à l'ouverture
// et revient à l'élément qui avait le focus avant (la vignette) à la fermeture.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import IconeSt from './IconeSt.vue'
import IndicateurSauvegarde from './IndicateurSauvegarde.vue'

const props = defineProps({
  ouvert: { type: Boolean, default: false },
  etiquette: { type: String, default: 'Détail' },      // nom accessible du panneau (ex. nom de l'exercice)
  muscle: { type: String, default: null },             // teinte data-m du média
  sauvegarde: { type: String, default: '' },           // état de useSauvegardeAuto ('' = pas d'indicateur)
  precedent: { type: Boolean, default: false },        // affiche/active « Précédent »
  suivant: { type: Boolean, default: false },
  cascade: { type: Boolean, default: true }            // false : pas de cascade (ex. passage à l'exercice suivant)
})
const emit = defineEmits(['fermer', 'precedent', 'suivant', 'reessayer'])

const racine = ref(null)
const elMedia = ref(null)
const boutonFermer = ref(null)
let focusAvant = null
const mobile = () => typeof matchMedia === 'function' && matchMedia('(max-width: 900px)').matches

// Glisser pour fermer (téléphone)
const decalage = ref(0)
const glisse = ref(false)
let y0 = null, t0 = 0
function debutGlisse(ev) {
  if (!mobile() || ev.target.closest('button, a, input, textarea, select, iframe')) return
  y0 = ev.clientY; t0 = performance.now(); decalage.value = 0; glisse.value = true
  ev.currentTarget.setPointerCapture?.(ev.pointerId)
}
function suiteGlisse(ev) { if (y0 !== null) decalage.value = Math.max(0, ev.clientY - y0) }
function finGlisse() {
  if (y0 === null) return
  const vitesse = decalage.value / Math.max(1, performance.now() - t0)
  const fermer = decalage.value > 140 || vitesse > 0.6
  y0 = null; glisse.value = false
  if (fermer) emit('fermer')
  decalage.value = 0
}
const styleGlisse = computed(() => (glisse.value && decalage.value ? { transform: `translateY(${decalage.value}px)`, transition: 'none' } : null))
const styleVoile = computed(() => (glisse.value && decalage.value ? { opacity: String(Math.max(0, 1 - decalage.value / 600)) } : null))

function surTouche(ev) {
  if (!props.ouvert) return
  const champ = ev.target.closest?.('input, textarea, select, [contenteditable="true"]')
  if (ev.key === 'Escape') { ev.preventDefault(); emit('fermer'); return }
  if (champ) return
  if (ev.key === 'ArrowDown' && props.suivant) { ev.preventDefault(); emit('suivant') }
  if (ev.key === 'ArrowUp' && props.precedent) { ev.preventDefault(); emit('precedent') }
}

watch(() => props.ouvert, async (o) => {
  if (o) {
    focusAvant = document.activeElement
    document.addEventListener('keydown', surTouche)
    if (mobile()) document.documentElement.style.overflow = 'hidden'
    await nextTick()
    boutonFermer.value?.focus({ preventScroll: true })
  } else {
    document.removeEventListener('keydown', surTouche)
    document.documentElement.style.overflow = ''
    if (focusAvant?.isConnected) focusAvant.focus({ preventScroll: true })
    focusAvant = null
  }
}, { immediate: true })
onBeforeUnmount(() => { document.removeEventListener('keydown', surTouche); document.documentElement.style.overflow = '' })

defineExpose({ media: () => elMedia.value, racine: () => racine.value })
</script>

<template>
  <Teleport defer to="#st-calques">
    <Transition name="st-voile"><div v-if="ouvert" class="st-pan-voile" :style="styleVoile" aria-hidden="true" @click="emit('fermer')" /></Transition>
    <Transition name="st-pan">
      <aside v-if="ouvert" ref="racine" data-test="panneau" class="st-panneau" :class="{ 'sans-cascade': !cascade }" role="dialog" :aria-label="etiquette" :style="styleGlisse">
        <div ref="elMedia" class="st-pan-media" :data-m="muscle || undefined" @pointerdown="debutGlisse" @pointermove="suiteGlisse" @pointerup="finGlisse" @pointercancel="finGlisse">
          <slot name="media" />
        </div>
        <div class="st-pan-poignee" aria-hidden="true" @pointerdown="debutGlisse" @pointermove="suiteGlisse" @pointerup="finGlisse" @pointercancel="finGlisse" />
        <div class="st-pan-barre">
          <button ref="boutonFermer" class="st-btn st-btn--rond" type="button" aria-label="Fermer" @click="emit('fermer')"><IconeSt nom="fermer" /></button>
          <button v-if="precedent || suivant" class="st-btn st-btn--rond" type="button" aria-label="Précédent" :disabled="!precedent" @click="emit('precedent')"><IconeSt nom="haut" /></button>
          <button v-if="precedent || suivant" class="st-btn st-btn--rond" type="button" aria-label="Suivant" :disabled="!suivant" @click="emit('suivant')"><IconeSt nom="bas" /></button>
          <slot name="barre" />
          <IndicateurSauvegarde v-if="sauvegarde" class="st-pan-sauve" :etat="sauvegarde" @reessayer="emit('reessayer')" />
        </div>
        <div class="st-pan-defile"><slot /></div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style>
.st-panneau { position: fixed; z-index: var(--st-z-panneau); top: 16px; right: 16px; bottom: 16px; width: 440px; display: flex; flex-direction: column; background: var(--st-surface); border-radius: var(--st-r-xl); box-shadow: var(--st-ombre-3); overflow: hidden; }
.st-pan-media { position: relative; flex: none; aspect-ratio: 16 / 9; overflow: hidden; background: radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,.55), transparent 60%), var(--mc); }
.st-pan-media > img, .st-pan-media > iframe { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border: 0; }
.st-pan-media > .st-fig { position: absolute; left: 30%; top: 6%; width: 40%; height: 94%; }
.st-pan-barre { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 3; display: flex; gap: 8px; align-items: center; pointer-events: none; }
.st-pan-barre > * { pointer-events: auto; }
.st-pan-barre .st-btn { background: rgba(255,255,255,.92); border-color: transparent; }
.st-pan-barre .st-btn:disabled { opacity: .45; cursor: default; }
.st-pan-barre .st-pan-sauve { margin-left: auto; }
.st-pan-poignee { display: none; }
.st-pan-defile { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 18px 22px 28px; }
.st-pan-defile > * { animation: st-cascade var(--st-d-base) var(--st-sortie) both; }
.st-pan-defile > *:nth-child(2) { animation-delay: 40ms; }
.st-pan-defile > *:nth-child(3) { animation-delay: 80ms; }
.st-pan-defile > *:nth-child(4) { animation-delay: 120ms; }
.st-pan-defile > *:nth-child(n+5) { animation-delay: 160ms; }
.st-panneau.sans-cascade .st-pan-defile > * { animation: none; }
.st-pan-voile { display: none; }

/* entrée / sortie (ordinateur) */
.st-pan-enter-active { transition: transform var(--st-d-base) var(--st-sortie), opacity var(--st-d-base) var(--st-sortie); }
.st-pan-leave-active { transition: transform 120ms ease-in, opacity 120ms ease-in; }
.st-pan-enter-from { transform: translateX(24px); } /* translation seule : l'opacité de la cascade (.9) ne doit pas se multiplier avec celle du panneau */
.st-pan-leave-to { opacity: 0; transform: translateX(20px); }

/* L'écran réserve la place du panneau : ajouter la classe st-reserve-panneau à sa zone de contenu quand il est ouvert. */
@media (min-width: 901px) { .st-reserve-panneau { padding-right: 456px; } }
@media (min-width: 901px) and (max-width: 1180px) { .st-panneau { width: 400px; } .st-reserve-panneau { padding-right: 416px; } }

@media (max-width: 900px) {
  .st-panneau { top: max(10px, env(safe-area-inset-top)); left: 0; right: 0; bottom: 0; width: auto; border-radius: 26px 26px 0 0; transition: transform var(--st-d-panneau) var(--st-vaul); }
  .st-pan-enter-active, .st-pan-leave-active { transition: transform var(--st-d-panneau) var(--st-vaul); }
  .st-pan-enter-from, .st-pan-leave-to { opacity: 1; transform: translateY(100%); }
  .st-pan-media { touch-action: none; }
  .st-pan-poignee { display: grid; place-items: center; position: absolute; top: 0; left: 0; right: 0; height: 28px; z-index: 4; touch-action: none; cursor: grab; }
  .st-pan-poignee::after { content: ''; width: 44px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.85); box-shadow: 0 0 0 1px rgba(35,37,43,.15); }
  .st-pan-barre { top: 26px; }
  .st-pan-defile { padding: 16px 18px calc(28px + env(safe-area-inset-bottom)); }
  .st-pan-voile { display: block; position: fixed; inset: 0; z-index: var(--st-z-voile); background: rgba(35,37,43,.45); }
  .st-voile-enter-active, .st-voile-leave-active { transition: opacity var(--st-d-base) var(--st-vaul); }
  .st-voile-enter-from, .st-voile-leave-to { opacity: 0; }
}
</style>
