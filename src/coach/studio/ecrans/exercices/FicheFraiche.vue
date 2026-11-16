<script setup>
// Enveloppe de FicheExercice : l'exercice édité (avec sa `version`) vient TOUJOURS d'une lecture fraîche (data.exercices.detail),
// jamais de la liste affichée (qui peut venir du cache). Tant que la lecture n'est pas là, un squelette à la forme de la fiche
// tient la place (aucun champ actif) ; la fiche, lourde à monter, n'est montée qu'après la 1re image (le vol de la vignette part
// sans attendre). Monté avec :key="id" par l'hôte. Même interface que FicheExercice (événements et méthodes exposées).
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { attente } from '../../../../data/index.js'
import { mouvementReduit } from '../../transitionPartagee.js'
import FicheExercice from './FicheExercice.vue'
import { messageErreurExo } from './logique.js'
import * as D from './donnees.js'

const props = defineProps({
  id: { type: String, required: true },
  materiels: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] }
})
const emit = defineEmits(['etat', 'invalides', 'maj', 'archive', 'introuvable'])

const frais = ref(null)       // exercice lu frais (version à jour) : la fiche ne démarre qu'avec lui
const erreur = ref('')
const fiche = ref(null)
let mort = false
const debut = performance.now()

// Le montage de la fiche est une tâche longue (~80 ms sur un téléphone lent) : on le laisse après le vol de la vignette et la
// glissade de la feuille (500 ms), jamais en plein mouvement. Mouvement réduit : tout de suite (1re image suivante).
const FIN_MOUVEMENT = 460
const imageSuivante = () => new Promise((ok) => {
  const attente = mouvementReduit() ? 0 : Math.max(0, FIN_MOUVEMENT - (performance.now() - debut))
  const t = setTimeout(ok, attente + 120) // rAF est suspendu dans un onglet masqué
  setTimeout(() => requestAnimationFrame(() => { clearTimeout(t); ok() }), attente)
})

async function lire() {
  erreur.value = ''
  try {
    const item = await attente(D.detail(props.id))
    await imageSuivante()
    if (mort) return
    if (!item) { emit('introuvable', props.id); return }
    frais.value = item
    emit('maj', item) // la grille reprend la valeur fraîche
  } catch (e) { if (!mort) erreur.value = messageErreurExo(e) }
}
onMounted(lire)
onBeforeUnmount(() => { mort = true })

defineExpose({
  reessayer: () => (fiche.value ? fiche.value.reessayer() : lire()),
  enregistrer: () => fiche.value?.enregistrer?.(),
  invalides: () => fiche.value?.invalides?.() || [],
  focusInvalide: () => fiche.value?.focusInvalide?.()
})
</script>

<template>
  <FicheExercice
    v-if="frais" ref="fiche" :exercice="frais" :materiels="materiels" :categories="categories"
    @etat="emit('etat', $event)" @invalides="emit('invalides', $event)" @maj="emit('maj', $event)" @archive="emit('archive', $event)"
  />
  <p v-else-if="erreur" class="st-exo-alerte" role="alert">{{ erreur }} <button type="button" class="st-btn" @click="lire">Réessayer</button></p>
  <div v-else class="st-exo-fiche-fantome" aria-hidden="true">
    <i class="st-exo-fn-titre" /><i class="st-exo-fn-puces" />
    <div class="st-exo-fn-trois"><i /><i /><i /></div>
    <i class="st-exo-fn-champ" /><i class="st-exo-fn-champ" /><i class="st-exo-fn-champ st-exo-fn-grand" />
  </div>
</template>
