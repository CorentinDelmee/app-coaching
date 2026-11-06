<script setup>
// « Enregistrement… » (anneau) / « Enregistré » (coche qui se trace) / « Erreur » + Réessayer. Lit l'état de useSauvegardeAuto.
defineProps({ etat: { type: String, default: 'repos' } }) // repos | attente | encours | ok | erreur
defineEmits(['reessayer'])
</script>

<template>
  <span class="st-sauve" :class="`is-${etat}`" role="status" aria-live="polite">
    <template v-if="etat === 'attente' || etat === 'encours'"><i aria-hidden="true" />Enregistrement…</template>
    <template v-else-if="etat === 'ok'">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>Enregistré
    </template>
    <template v-else-if="etat === 'erreur'">
      Non enregistré
      <button type="button" @click="$emit('reessayer')">Réessayer</button>
    </template>
  </span>
</template>

<style>
.st-sauve { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border-radius: 16px; background: rgba(255,255,255,.92); font-size: 12.5px; font-weight: 600; color: var(--st-doux); }
.st-sauve.is-repos { visibility: hidden; }
.st-sauve svg { width: 14px; height: 14px; }
.st-sauve i { width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: st-tourne .7s linear infinite; }
.st-sauve.is-ok { color: var(--st-ok); }
.st-sauve.is-ok svg path { stroke-dasharray: 20; stroke-dashoffset: 20; animation: st-trace .35s var(--st-sortie) forwards; }
.st-sauve.is-erreur { background: var(--st-alerte-fond); color: var(--st-alerte); padding-right: 4px; }
.st-sauve button { min-height: 44px; margin: -6px 0; padding: 0 10px; border: 0; background: none; color: var(--st-alerte); font-weight: 700; text-decoration: underline; }
</style>
