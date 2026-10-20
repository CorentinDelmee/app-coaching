<script setup>
// Série ouverte : la ligne touchée s'agrandit (élément partagé) et montre ses champs en grand.
// Un champ fixé par le coach est affiché verrouillé. Toucher une valeur ouvre la roue.
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import Icone from '../Icone.vue'
import { CHAMPS } from '../../domain/modele.js'
import { estChampNombre } from '../../domain/roue.js'
import { valeurAffichee } from '../../domain/seanceUi.js'
import { ouvrirRect, fermerRect, nettoyer } from '../../anim/transitions.js'

const props = defineProps({
  item: { type: Object, required: true },
  serieIdx: { type: Number, required: true },
  exercice: { type: Object, default: () => ({}) },
  src: { type: Object, default: null }, // la ligne touchée
  unite: { type: String, default: 'kg' },
  courante: { type: Boolean, default: false },
  auTemps: { type: Boolean, default: false },
  derniere: { type: String, default: null }
})
const emit = defineEmits(['champ', 'valider', 'ferme'])
const racine = ref(null)

const serie = computed(() => props.item.series[props.serieIdx])
// Champs numériques réglables à la roue ; les autres (texte, case…) ne s'affichent pas en tuile.
const tuiles = computed(() => props.item.champs.filter((c) => estChampNombre(c.cle)))
const uniteDe = (cle) => (cle === 'poids' ? props.unite : CHAMPS[cle]?.unite || '')
const modifiable = computed(() => tuiles.value.some((c) => c.modifiableParClient))
const verbe = computed(() => (props.courante ? (props.auTemps ? 'Lancer la série' : 'Valider la série') : 'Enregistrer'))

onMounted(() => ouvrirRect(racine.value, props.src, { rayon: 22 }))
onBeforeUnmount(() => nettoyer(racine.value))

/** Fermeture animée vers la ligne (état actuel). `cb` après l'animation. */
function fermer(cible, cb) {
  fermerRect(racine.value, cible || props.src, { onFini: () => { cb?.(); emit('ferme') } })
}
defineExpose({ fermer, racine })
</script>

<template>
  <div ref="racine" class="couche detail" hidden>
    <div class="couche-contenu">
      <div class="couche-haut" data-c>
        <button class="rond" type="button" aria-label="Fermer" @click="fermer()"><Icone nom="fermer" /></button>
        <span class="lab">Série {{ serieIdx + 1 }} sur {{ item.series.length }}<br>{{ exercice.nom }}</span>
      </div>
      <h3 class="couche-titre" data-c>{{ exercice.nom }}</h3>
      <p class="couche-sous" data-c>{{ modifiable ? 'Touchez une valeur pour la modifier.' : 'Cette série est fixée par votre coach.' }}</p>
      <div class="champs" :data-n="tuiles.length" data-c>
        <template v-for="c in tuiles" :key="c.cle">
          <div v-if="!c.modifiableParClient" class="champ verrou" :data-champ="c.cle">
            <span class="ch-lab">{{ CHAMPS[c.cle].label }}<em><Icone nom="cadenas" /> Fixé par le coach</em></span>
            <span class="ch-val"><span class="v" v-text="valeurAffichee(c.cle, serie.valeurs[c.cle], unite)"></span><small>{{ uniteDe(c.cle) }}</small></span>
          </div>
          <button v-else class="champ" type="button" :data-champ="c.cle" @click="emit('champ', c.cle, $event.currentTarget)">
            <span class="ch-lab">{{ CHAMPS[c.cle].label }}<em>Modifier</em></span>
            <span class="ch-val"><span class="v" v-text="valeurAffichee(c.cle, serie.valeurs[c.cle], unite)"></span><small>{{ uniteDe(c.cle) }}</small></span>
          </button>
        </template>
        <p v-if="!tuiles.length" class="aucun">Cette série n'a pas de valeur à régler.</p>
      </div>
      <p class="sv-prec" data-c>{{ derniere ? `Dernière fois · ${derniere}` : (item.consignes || '') }}</p>
      <button class="gros" type="button" data-c @click="emit('valider', $event.currentTarget)">{{ verbe }}</button>
    </div>
    <div class="voile" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.detail { z-index: 50; }
.champs { flex: 1; display: flex; flex-direction: column; gap: var(--gap); margin: 18px 0 14px; min-height: 0; }
.champ { position: relative; flex: 1; border-radius: var(--r-carte); background: var(--surface); text-align: left; padding: 18px 22px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; min-height: 0; transition: transform .16s var(--ease); }
button.champ:active { transform: scale(.98); }
.ch-lab { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; color: var(--texte-doux); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ch-lab em { font-style: normal; text-transform: none; letter-spacing: 0; display: inline-flex; align-items: center; gap: 6px; color: var(--accent-lisible); }
.verrou .ch-lab em { color: var(--texte-doux); }
.ch-lab em svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.ch-val { font-family: var(--font-chiffres); font-size: 96px; letter-spacing: -.07em; line-height: .95; font-variant-numeric: tabular-nums; }
.ch-val small { font-family: var(--font-texte); font-size: 28px; letter-spacing: 0; font-weight: 500; color: var(--texte-doux); margin-left: 10px; }
.verrou { background: var(--surface); box-shadow: inset 0 0 0 2px var(--filet); background: transparent; }
.verrou .ch-val { opacity: .8; }
/* 3 champs ou plus : valeurs plus petites pour tout faire tenir */
.champs[data-n="3"] .ch-val, .champs[data-n="4"] .ch-val { font-size: 56px; }
.champs[data-n="3"] .ch-val small, .champs[data-n="4"] .ch-val small { font-size: 20px; }
.champs[data-n="3"] .champ, .champs[data-n="4"] .champ { padding: 14px 20px; }
.aucun { color: var(--texte-doux); font-size: 16px; }
.sv-prec { font-size: 14.5px; color: var(--texte-doux); text-align: center; margin-bottom: 12px; min-height: 18px; }
@media (max-height: 700px) { .ch-val { font-size: 76px; } }
@media (prefers-reduced-motion: reduce) { .champ { transition: none; } }
</style>
