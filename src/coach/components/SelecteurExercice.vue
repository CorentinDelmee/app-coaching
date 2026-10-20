<script setup>
// Choix d'un exercice par son nom (recherche avec suggestions). Émet l'id de l'exercice.
import { computed, ref, watch } from 'vue'

const props = defineProps({ modelValue: { type: String, default: '' }, exercices: { type: Array, required: true }, label: { type: String, default: 'Exercice' } })
const emit = defineEmits(['update:modelValue'])

const listeId = `ex-${Math.random().toString(36).slice(2, 8)}`
const nomActuel = computed(() => props.exercices.find((e) => e.id === props.modelValue)?.nom || '')
const texte = ref(nomActuel.value)
watch(nomActuel, (n) => { texte.value = n })

const inconnu = computed(() => texte.value !== '' && !props.exercices.some((e) => e.nom.toLowerCase() === texte.value.trim().toLowerCase()))

function valider() {
  const trouve = props.exercices.find((e) => e.nom.toLowerCase() === texte.value.trim().toLowerCase())
  if (trouve) emit('update:modelValue', trouve.id)
  else texte.value = nomActuel.value // revient au dernier choix valide
}
</script>

<template>
  <label>
    {{ label }}
    <input v-model="texte" :list="listeId" placeholder="Tape pour chercher…" :aria-invalid="inconnu" @change="valider" @blur="valider" />
    <datalist :id="listeId"><option v-for="e in exercices" :key="e.id" :value="e.nom" /></datalist>
  </label>
</template>
