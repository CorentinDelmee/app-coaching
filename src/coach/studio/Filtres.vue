<script setup>
// Rangée de filtres à bascule (défilement horizontal, cibles 46 px).
// options : [{ valeur, texte, muscle?, n?, propose? }] ; v-model : tableau (multiple) ou valeur unique ('' = aucun).
const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: [Array, String, Number], default: () => [] },
  multiple: { type: Boolean, default: true },
  etiquette: { type: String, default: 'Filtres' }
})
const emit = defineEmits(['update:modelValue'])

const actif = (v) => (props.multiple ? props.modelValue.includes(v) : props.modelValue === v)
function basculer(v) {
  if (props.multiple) emit('update:modelValue', actif(v) ? props.modelValue.filter((x) => x !== v) : [...props.modelValue, v])
  else emit('update:modelValue', actif(v) ? '' : v)
}
</script>

<template>
  <div class="st-filtres" role="group" :aria-label="etiquette">
    <button
      v-for="o in options" :key="o.valeur" type="button" class="st-filtre"
      :class="{ 'st-filtre--propose': o.propose }" :data-m="o.muscle || undefined"
      :aria-pressed="actif(o.valeur)" @click="basculer(o.valeur)"
    >
      <span v-if="o.muscle" class="st-dot" aria-hidden="true" />{{ o.texte }}<span v-if="o.n != null" class="st-n">{{ o.n }}</span>
    </button>
    <slot />
  </div>
</template>

<style>
.st-filtres { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 4px 40px 12px 2px; margin: 0 -2px; -webkit-mask-image: linear-gradient(90deg, #000 92%, transparent); mask-image: linear-gradient(90deg, #000 92%, transparent); }
.st-filtres::-webkit-scrollbar { display: none; }
.st-filtre { flex: none; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 22px; border: 1px solid var(--st-filet-fort); background: var(--st-surface); font-weight: 600; font-size: 13.5px; color: var(--st-texte); transition: background var(--st-d-court), transform var(--st-d-appui); position: relative; }
.st-filtre:active { transform: scale(.95); }
.st-filtre .st-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--mc, var(--st-doux)); box-shadow: inset 0 0 0 1.5px var(--mi, transparent); }
.st-filtre[aria-pressed="true"] { background: var(--st-encre); color: #fff; border-color: var(--st-encre); }
.st-filtre[aria-pressed="true"][data-m] { background: var(--mc); color: var(--mi); border-color: var(--mi); }
.st-filtre--propose[aria-pressed="true"] { background: var(--st-propose-fond); color: var(--st-propose); border-color: var(--st-propose); }
.st-filtre .st-n { font-weight: 500; opacity: .75; }
</style>
