<script setup>
// Vignette compacte d'exercice (bibliothèque des éditeurs). Remplaçable par VignetteExercice (L0) quand elle existera.
// Média : photo, miniature YouTube, sinon pastille teintée avec l'initiale. Le nom du muscle est toujours écrit.
import { computed } from 'vue'
import { mediaDe } from '../../../medias.js'
import { meta, teinte } from './exercices.js'

const props = defineProps({ exercice: { type: Object, required: true }, tag: { type: String, default: 'button' } })
const media = computed(() => mediaDe(props.exercice))
const m = computed(() => teinte(props.exercice))
</script>

<template>
  <component :is="tag" :type="tag === 'button' ? 'button' : undefined" class="st-prog-vig" :data-m="m || undefined">
    <span class="st-prog-vig-media" aria-hidden="true">
      <img v-if="media.src" :src="media.src" alt="" loading="lazy" decoding="async" draggable="false" />
      <b v-else>{{ exercice.nom.slice(0, 1) }}</b>
    </span>
    <span class="st-prog-vig-txt"><strong>{{ exercice.nom }}</strong><small v-if="meta(exercice)">{{ meta(exercice) }}</small></span>
    <slot />
  </component>
</template>

<style>
.st-prog-vig { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 6px 10px 6px 6px; border: 0; border-radius: 14px; background: var(--st-fond); color: var(--st-encre); text-align: left; cursor: grab; transition: transform var(--st-d-appui) ease-out, background var(--st-d-court), box-shadow var(--st-d-court); -webkit-user-select: none; user-select: none; }
.st-prog-vig:hover { background: var(--st-surface); box-shadow: var(--st-ombre-2); }
.st-prog-vig:active { transform: scale(.97); }
.st-prog-vig-media { flex: none; width: 52px; height: 40px; border-radius: 10px; background: var(--mc); overflow: hidden; display: grid; place-items: center; }
.st-prog-vig-media img { width: 100%; height: 100%; object-fit: cover; }
.st-prog-vig-media b { font: 500 18px var(--st-titre); color: var(--mi); }
.st-prog-vig-txt { min-width: 0; display: grid; gap: 1px; }
.st-prog-vig-txt strong { font-size: 13.5px; font-weight: 600; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.st-prog-vig-txt small { font-size: 12px; color: var(--mi, var(--st-doux)); font-weight: 600; }
</style>
