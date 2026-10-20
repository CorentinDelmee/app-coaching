<script setup>
// Poids et mensurations : choix de la série (poids, taille, hanches…), période (4 sem. / 3 mois / 1 an / tout), valeur du moment avec
// sa variation, courbe qui se dessine. Une seule mesure -> un point + invitation à en ajouter une 2e. Pas de jugement sur la variation.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import Courbe from './Courbe.vue'
import { PERIODES, filtrerPeriode, libelleSerie, pointsSerie, resumeSerie, seriesDisponibles, uniteSerie } from '../../domain/suivi.js'
import { dateCourte } from '../../domain/graphique.js'
import { nombreFr } from '../../domain/unites.js'
import { compter, mouvementReduit } from '../../anim/transitions.js'

const props = defineProps({
  mesures: { type: Array, required: true },
  aujourdhui: { type: String, required: true },
  delai: { type: Number, default: 0 }
})
const emit = defineEmits(['ajouter'])

const serieId = ref('poids')
const periode = ref('3m')
const valEl = ref(null)
let precedente = null

const series = computed(() => seriesDisponibles(props.mesures))
const toutes = computed(() => pointsSerie(props.mesures, serieId.value))
const points = computed(() => filtrerPeriode(toutes.value, periode.value, props.aujourdhui))
const resume = computed(() => resumeSerie(points.value))
const unite = computed(() => uniteSerie(serieId.value))
const libelle = computed(() => libelleSerie(serieId.value))
const fmt = (v) => nombreFr(Math.round(v * 10) / 10)
const variation = computed(() => {
  const r = resume.value
  if (!r || r.variation === null) return ''
  const signe = r.variation > 0 ? '+' : r.variation < 0 ? '−' : ''
  return r.variation === 0 ? 'Stable sur la période' : `${signe}${fmt(Math.abs(r.variation))} ${unite.value} depuis le ${dateCourte(points.value[0].date)}`
})
const titreCourbe = computed(() => `${libelle.value}${serieId.value === 'poids' ? '' : ' (tour)'}`)

function animerValeur() {
  if (!valEl.value) return
  const a = resume.value?.derniere
  if (a === undefined) return
  compter(valEl.value, precedente ?? a, a, { duree: precedente === null ? 1.4 : 0.8, delay: precedente === null ? props.delai : 0, fmt })
  precedente = a
}
onMounted(async () => { await nextTick(); animerValeur() })
watch([serieId, periode], async () => { await nextTick(); animerValeur() })
watch(() => props.mesures, async () => { await nextTick(); animerValeur() })
onBeforeUnmount(() => gsap.killTweensOf(valEl.value))

function ajouter(e) { emit('ajouter', { serie: serieId.value, src: e.currentTarget }) }
</script>

<template>
  <div class="suivi-mesures">
    <div v-if="series.length > 1" class="sm-chips" role="group" aria-label="Mesure à afficher">
      <button v-for="s in series" :key="s.id" type="button" :aria-pressed="serieId === s.id" @click="serieId = s.id">{{ s.libelle }}</button>
    </div>

    <div class="sm-periodes" role="group" aria-label="Période">
      <button v-for="p in PERIODES" :key="p.id" type="button" :aria-pressed="periode === p.id" @click="periode = p.id">{{ p.libelle }}</button>
    </div>

    <template v-if="resume">
      <div class="sm-valeur">
        <span class="sm-nombre"><span ref="valEl">{{ fmt(resume.derniere) }}</span><small>{{ unite }}</small></span>
        <span v-if="variation" class="sm-variation">{{ variation }}</span>
      </div>
      <Courbe :key="serieId + periode" :points="points" :unite="unite" :titre="titreCourbe" :delai="delai" />
      <p v-if="points.length === 1" class="sm-note">Ajoutez une 2e mesure pour voir la courbe.</p>
    </template>
    <div v-else-if="toutes.length" class="sm-vide">
      <p>Aucune mesure sur cette période.</p>
      <button class="gros doux" type="button" @click="periode = 'tout'">Tout voir</button>
    </div>
    <p v-else class="sm-vide">Pas encore de mesure de {{ libelle.toLowerCase() }}. Votre bilan de la semaine en ajoutera une, ou notez-la directement ci-dessous.</p>

    <button class="gros doux sm-ajout" type="button" @click="ajouter">{{ serieId === 'poids' ? 'Noter mon poids' : `Noter mon tour de ${libelle.toLowerCase()}` }}</button>
  </div>
</template>

<style scoped>
.sm-chips, .sm-periodes { display: flex; gap: 8px; }
.sm-chips { overflow-x: auto; scrollbar-width: none; margin-bottom: 12px; padding-bottom: 2px; }
.sm-chips::-webkit-scrollbar { display: none; }
.sm-chips button, .sm-periodes button { min-height: 44px; padding: 0 16px; border-radius: 22px; background: var(--surface-2); font-size: 15px; font-weight: 600; white-space: nowrap; transition: background-color .2s, color .2s, transform .14s var(--ease); }
.sm-chips button:active, .sm-periodes button:active { transform: scale(.95); }
.sm-chips button[aria-pressed="true"] { background: var(--accent); color: var(--accent-texte); }
.sm-periodes { margin-bottom: 14px; }
.sm-periodes button { flex: 1; padding: 0 6px; min-height: 40px; font-size: 14px; background: transparent; color: var(--texte-doux); box-shadow: inset 0 0 0 2px var(--filet); }
.sm-periodes button[aria-pressed="true"] { color: var(--texte); box-shadow: inset 0 0 0 2px var(--accent-lisible); }
.sm-valeur { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
.sm-nombre { font-family: var(--font-chiffres); font-size: 52px; letter-spacing: -.06em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.sm-nombre small { font-family: var(--font-texte); font-size: 22px; letter-spacing: 0; font-weight: 600; color: var(--texte-doux); margin-left: 6px; }
.sm-variation { font-size: 14.5px; font-weight: 600; color: var(--texte-doux); }
.sm-note { margin-top: 8px; padding: 12px 14px; border-radius: 16px; background: var(--surface-2); font-size: 15px; font-weight: 600; text-align: center; }
.sm-vide { padding: 16px 0; text-align: center; color: var(--texte-doux); font-size: 15.5px; line-height: 1.4; display: flex; flex-direction: column; gap: 12px; }
.sm-ajout { margin-top: 12px; min-height: 60px; }
@media (prefers-reduced-motion: reduce) { .sm-chips button, .sm-periodes button { transition: none; } }
</style>
