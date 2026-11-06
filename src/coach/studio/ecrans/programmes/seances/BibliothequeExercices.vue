<script setup>
// Bibliothèque d'exercices de l'éditeur de séance : recherche sans accents + filtres de muscles + vignettes.
// Ordinateur : colonne collante, on glisse une vignette dans la séance (ou on clique : ajout à la cible affichée).
// Téléphone : feuille basse ouverte par les boutons « + Exercice » ; toucher une vignette l'ajoute puis ferme la feuille.
import { computed, nextTick, ref, watch } from 'vue'
import Filtres from '../../../Filtres.vue'
import IconeSt from '../../../IconeSt.vue'
import { TEINTES_STUDIO } from '../../../medias.js'
import VignetteMini from '../commun/VignetteMini.vue'
import { NOMS_MUSCLES, filtrerExercices, teinte } from '../commun/exercices.js'

const props = defineProps({
  exercices: { type: Array, required: true },
  glisser: { type: Object, required: true },
  titre: { type: String, default: 'Ajouter à la séance' },   // dit où va le prochain ajout
  ciblee: { type: Boolean, default: false },                 // ajout vers un circuit / remplacement : bouton « Revenir à la séance »
  ouverte: { type: Boolean, default: false }                 // feuille ouverte (téléphone)
})
const emit = defineEmits(['fermer', 'revenir'])

const q = ref('')
const muscles = ref([])
const options = computed(() => TEINTES_STUDIO
  .map((m) => ({ valeur: m, texte: NOMS_MUSCLES[m], muscle: m, n: props.exercices.filter((e) => teinte(e) === m).length }))
  .filter((o) => o.n))
const affiches = computed(() => filtrerExercices(props.exercices, { q: q.value, muscles: muscles.value }))
const champ = ref(null)

watch(() => props.ouverte, async (o) => { if (o) { await nextTick(); champ.value?.focus({ preventScroll: true }) } })
defineExpose({ focaliser: () => champ.value?.focus() })
</script>

<template>
  <div v-if="ouverte" class="st-prog-s-voile" aria-hidden="true" @click="emit('fermer')" />
  <aside
    class="st-prog-s-biblio" data-test="biblio" :class="{ 'is-ouverte': ouverte, 'is-ciblee': ciblee }"
    aria-labelledby="st-prog-s-biblio-titre" @keydown.esc="emit('fermer')"
  >
    <header class="st-prog-s-biblio-tete">
      <div>
        <p class="st-prog-s-etiq">Bibliothèque · glisser ou toucher</p>
        <h2 id="st-prog-s-biblio-titre">{{ titre }}</h2>
      </div>
      <button v-if="ciblee" type="button" class="st-btn st-btn--fantome st-prog-mini" @click="emit('revenir')">Revenir à la séance</button>
      <button type="button" class="st-btn st-btn--rond st-btn--fantome st-prog-s-fermer" aria-label="Fermer la bibliothèque" @click="emit('fermer')"><IconeSt nom="fermer" /></button>
    </header>
    <label class="st-prog-s-cherche">
      <span class="st-sr">Chercher un exercice</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      <input ref="champ" v-model="q" type="search" placeholder="Chercher (squat, élastique…)" autocomplete="off" enterkeyhint="search" />
    </label>
    <Filtres v-model="muscles" :options="options" etiquette="Filtrer par muscle" />
    <p class="st-prog-s-compte" aria-live="polite">{{ affiches.length }} exercice{{ affiches.length > 1 ? 's' : '' }}</p>
    <ul class="st-prog-s-biblio-liste">
      <li v-for="e in affiches" :key="e.id">
        <VignetteMini data-test="exercice" :exercice="e" v-bind="glisser.source({ donnee: e, type: 'source-exo' })" :aria-label="`${e.nom} : ${titre.toLowerCase()}`" />
      </li>
    </ul>
    <p v-if="!affiches.length" class="st-prog-s-rien">Aucun exercice ne correspond. <button type="button" class="st-prog-lien" @click="q = ''; muscles = []">Tout afficher</button></p>
  </aside>
</template>
