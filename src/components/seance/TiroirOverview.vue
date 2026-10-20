<script setup>
// Tiroir latéral : la liste de la séance (séries faites cochées). Onglet sur le bord droit, glissement ou toucher pour ouvrir ;
// glisser vers la droite ou toucher le fond pour fermer ; toucher un exercice y emmène.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { gsap } from 'gsap'
import Icone from '../Icone.vue'
import { mouvementReduit } from '../../anim/transitions.js'

const props = defineProps({
  ouvert: { type: Boolean, default: false },
  titre: { type: String, default: '' },
  sous: { type: String, default: '' },
  lignes: { type: Array, default: () => [] } // [{ nom, detail, fait, courant, cochees, total }]
})
const emit = defineEmits(['ouvrir', 'fermer', 'aller'])

const tiroir = ref(null)
const scrim = ref(null)
const liste = ref(null)
const largeur = () => (tiroir.value ? tiroir.value.offsetWidth + 30 : 400)

onMounted(() => { gsap.set(tiroir.value, { x: largeur(), visibility: 'hidden' }) })
onBeforeUnmount(() => gsap.killTweensOf([tiroir.value, scrim.value]))

watch(() => props.ouvert, (o) => {
  const rm = mouvementReduit()
  if (o) {
    gsap.to(scrim.value, { opacity: 1, duration: 0.35 })
    gsap.set(tiroir.value, { visibility: 'visible' })
    gsap.to(tiroir.value, { x: 0, duration: rm ? 0.2 : 0.65, ease: 'expo.out', overwrite: true })
    if (!rm) gsap.fromTo(liste.value.children, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, stagger: 0.035, delay: 0.12, ease: 'expo.out', clearProps: 'transform,opacity' })
  } else {
    gsap.to(scrim.value, { opacity: 0, duration: 0.3 })
    gsap.to(tiroir.value, { x: largeur(), duration: rm ? 0.15 : 0.42, ease: 'power3.out', overwrite: true, onComplete: () => gsap.set(tiroir.value, { visibility: 'hidden' }) })
  }
})

// Glisser le tiroir vers la droite pour le fermer.
let d = null
function bas(e) { d = { x: e.clientX, t: performance.now(), dx: 0, on: false, id: e.pointerId } }
function bouge(e) {
  if (!d) return
  const dx = e.clientX - d.x
  if (!d.on && dx > 10) { d.on = true; try { tiroir.value.setPointerCapture(d.id) } catch { /* ok */ } }
  if (d.on) { d.dx = Math.max(0, dx); gsap.set(tiroir.value, { x: d.dx }); gsap.set(scrim.value, { opacity: 1 - d.dx / largeur() }) }
}
function haut() {
  if (!d) return
  const m = d; d = null
  if (!m.on) return
  const v = m.dx / Math.max(1, performance.now() - m.t)
  if (m.dx > 90 || v > 0.5) emit('fermer')
  else { gsap.to(tiroir.value, { x: 0, duration: 0.5, ease: 'expo.out' }); gsap.to(scrim.value, { opacity: 1, duration: 0.3 }) }
}

// L'onglet : un toucher ou un coup de pouce vers la gauche l'ouvre.
let t = null
function ongletBas(e) { t = { x: e.clientX, fait: false } }
function ongletBouge(e) { if (t && !t.fait && e.clientX - t.x < -14) { t.fait = true; emit('ouvrir') } }
function ongletHaut() { setTimeout(() => { t = null }, 0) }
</script>

<template>
  <button class="tab-tiroir" type="button" aria-label="Ouvrir l'aperçu de la séance" @click="emit('ouvrir')"
    @pointerdown="ongletBas" @pointermove="ongletBouge" @pointerup="ongletHaut">
    <Icone nom="gauche" />
  </button>
  <div ref="scrim" class="scrim" :style="{ pointerEvents: ouvert ? 'auto' : 'none' }" @click="emit('fermer')"></div>
  <aside ref="tiroir" class="tiroir" aria-label="Aperçu de la séance" @pointerdown="bas" @pointermove="bouge" @pointerup="haut" @pointercancel="haut">
    <span class="t-poignee"></span>
    <h3>{{ titre }}</h3>
    <p class="t-sous">{{ sous }}</p>
    <ol ref="liste">
      <li v-for="(l, i) in lignes" :key="i" :class="{ fait: l.fait, courant: l.courant }">
        <button type="button" @click="emit('aller', i)">
          <span class="tn"><Icone v-if="l.fait" nom="coche" /><template v-else>{{ i + 1 }}</template></span>
          <span>{{ l.nom }}<small>{{ l.detail }}<template v-if="!l.fait && l.cochees"> · {{ l.cochees }}/{{ l.total }} faites</template></small></span>
        </button>
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.tab-tiroir { position: absolute; z-index: 20; right: 0; top: 52%; width: 26px; height: 92px; border-radius: 14px 0 0 14px; background: var(--surface-2); display: grid; place-items: center; color: var(--texte-doux); touch-action: none; }
.tab-tiroir svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.scrim { position: absolute; inset: 0; z-index: 40; background: var(--scrim); opacity: 0; pointer-events: none; }
.tiroir { position: absolute; z-index: 41; top: 0; right: 0; bottom: 0; width: 86%; background: var(--surface); border-radius: 30px 0 0 30px; padding: calc(var(--haut) + 4px) 18px var(--bas); display: flex; flex-direction: column; touch-action: pan-y; box-shadow: var(--ombre-tiroir); }
h3 { font-family: var(--font-titre); font-weight: 400; font-size: 22px; letter-spacing: -.04em; }
.t-sous { font-size: 14px; color: var(--texte-doux); margin: 4px 0 14px; }
ol { flex: 1; overflow-y: auto; scrollbar-width: none; }
li button { width: 100%; display: flex; align-items: center; gap: 12px; min-height: 60px; text-align: left; border-top: 1px solid var(--filet); font-size: 17px; font-weight: 600; }
li:first-child button { border-top: 0; }
.tn { width: 34px; height: 34px; border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; font-family: var(--font-chiffres); font-size: 13px; flex: none; }
.tn svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
li.fait .tn { background: var(--accent); color: var(--accent-texte); }
li.courant button { color: var(--accent-lisible); }
small { display: block; font-weight: 400; font-size: 13.5px; color: var(--texte-doux); margin-top: 1px; }
.t-poignee { position: absolute; left: 8px; top: 50%; width: 5px; height: 56px; margin-top: -28px; border-radius: 3px; background: var(--filet); }
</style>
