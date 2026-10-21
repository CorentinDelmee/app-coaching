<script setup>
// Chiffres en roulette (M2) : quand la valeur change, chaque chiffre modifié défile dans sa colonne (transform seul).
// Les chiffres descendent pour un compte à rebours (`sens` -1), montent pour un compteur (+1). Mouvement réduit : le texte change, rien ne défile.
// L'affichage utilise la police de l'élément parent (chiffres tabulaires) : poser font-family / font-size sur le parent.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { cibleRoulette } from '../anim/roulette.js'
import { mouvementReduit } from '../anim/transitions.js'

const props = defineProps({
  valeur: { type: [String, Number], required: true },
  sens: { type: Number, default: -1 },
  duree: { type: Number, default: 0.55 }
})

const racine = ref(null)
const COLONNE = Array.from({ length: 20 }, (_, i) => i % 10)
// Clé = rang depuis la droite + nature : les unités gardent leur colonne d'une valeur à l'autre.
const signes = computed(() => {
  const a = [...String(props.valeur)]
  return a.map((c, i) => ({ c, chiffre: /\d/.test(c), cle: `${a.length - 1 - i}${/\d/.test(c) ? 'n' : 's'}` }))
})
const positions = new Map() // cle -> case affichée
const colonne = (cle) => racine.value?.querySelector(`[data-k="${CSS.escape(cle)}"] .rl-c`)

function poser(anime) {
  for (const s of signes.value) {
    if (!s.chiffre) continue
    const col = colonne(s.cle)
    if (!col) continue
    const d = Number(s.c)
    const pos = positions.get(s.cle)
    if (pos === undefined) { gsap.set(col, { yPercent: -5 * d }); positions.set(s.cle, d); continue }
    if (pos % 10 === d) continue
    const { depart, arrivee } = cibleRoulette(pos, d, props.sens)
    positions.set(s.cle, arrivee)
    if (!anime) { gsap.set(col, { yPercent: -5 * arrivee }); continue }
    gsap.killTweensOf(col)
    gsap.fromTo(col, { yPercent: -5 * depart }, { yPercent: -5 * arrivee, duration: props.duree, ease: 'expo.out' })
  }
}
onMounted(() => poser(false))
watch(signes, async () => { await nextTick(); poser(!mouvementReduit() && document.visibilityState === 'visible') })
onBeforeUnmount(() => { if (racine.value) gsap.killTweensOf(racine.value.querySelectorAll('.rl-c')) })
</script>

<template>
  <span ref="racine" class="rl-wrap">
    <span class="sr-seul">{{ valeur }}</span><!-- la valeur pour les lecteurs d'écran ; les colonnes qui défilent sont masquées (aria-hidden) -->
    <template v-for="s in signes" :key="s.cle">
      <span v-if="s.chiffre" class="rl" :data-k="s.cle" aria-hidden="true"><span class="rl-m">{{ s.c }}</span><span class="rl-c"><i v-for="(n, i) in COLONNE" :key="i">{{ n }}</i></span></span>
      <span v-else class="rl-s" aria-hidden="true">{{ s.c }}</span>
    </template>
  </span>
</template>

<style scoped>
.sr-seul { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.rl-wrap { position: relative; display: inline-flex; align-items: flex-start; font-variant-numeric: tabular-nums; line-height: 1; white-space: nowrap; }
.rl { position: relative; display: inline-block; height: 1.1em; overflow: hidden; overflow: clip; }
.rl-m { visibility: hidden; display: block; line-height: 1.1; } /* donne sa largeur à la cellule */
.rl-c { position: absolute; left: 0; right: 0; top: 0; will-change: transform; }
.rl-c i { display: block; height: 1.1em; line-height: 1.1; font-style: normal; text-align: center; }
.rl-s { display: inline-block; height: 1.1em; line-height: 1.1; }
</style>
