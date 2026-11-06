<script setup>
// Puce de statut (non cliquable). variante : neutre | propose | ok | alerte | muscle (avec prop muscle = teinte data-m).
defineProps({ variante: { type: String, default: 'neutre' }, muscle: { type: String, default: null }, point: { type: Boolean, default: false } })
</script>

<template>
  <span class="st-puce" :class="`st-puce--${variante}`" :data-m="variante === 'muscle' ? muscle : undefined"><i v-if="point" aria-hidden="true" /><slot /></span>
</template>

<style>
.st-puce { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 13px; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.st-puce i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.st-puce--propose { background: var(--st-propose-fond); color: var(--st-propose); }
.st-puce--ok { background: var(--st-ok-fond); color: var(--st-ok); }
.st-puce--neutre { background: var(--st-surface-2); color: #45484F; } /* 7:1 sur surface-2 (marge pendant les entrées) */
.st-puce--alerte { background: var(--st-alerte-fond); color: var(--st-alerte); }
.st-puce--muscle { background: var(--mc); color: var(--mi); }
</style>
