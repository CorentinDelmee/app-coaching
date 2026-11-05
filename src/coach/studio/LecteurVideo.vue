<script setup>
// Lecteur YouTube sans cookie (frame-src youtube-nocookie.com autorisé par la CSP). Monté seulement au clic (pas d'iframe au chargement).
import { computed } from 'vue'
import { urlIntegration } from '../../domain/video.js'
const props = defineProps({ id: { type: String, required: true }, titre: { type: String, default: 'Vidéo' }, auto: { type: Boolean, default: true } })
const src = computed(() => urlIntegration(props.id) + (props.auto ? '&autoplay=1' : ''))
</script>

<template>
  <iframe class="st-lecteur" :src="src" :title="`Vidéo : ${titre}`" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" />
</template>

<style>
.st-lecteur { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #000; }
</style>
