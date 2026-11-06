<script setup>
// « Enregistrement… » (anneau) / « Enregistré » (coche qui se trace) / « Erreur » + Réessayer / « Modifié ailleurs » + Recharger.
// Lit l'état de useSauvegardeAuto (etat + conflit).
defineProps({
  etat: { type: String, default: 'repos' }, // repos | attente | encours | ok | erreur | conflit
  conflit: { type: Object, default: null } // { resume } : dernière saisie non enregistrée, montrée avant de la perdre
})
defineEmits(['reessayer', 'recharger'])
</script>

<template>
  <span class="st-sauve" :class="`is-${etat}`" :role="etat === 'conflit' ? 'alert' : 'status'" :aria-live="etat === 'conflit' ? 'assertive' : 'polite'">
    <template v-if="etat === 'attente' || etat === 'encours'"><i aria-hidden="true" />Enregistrement…</template>
    <template v-else-if="etat === 'ok'">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>Enregistré
    </template>
    <template v-else-if="etat === 'erreur'">
      Non enregistré
      <button type="button" @click="$emit('reessayer')">Réessayer</button>
    </template>
    <template v-else-if="etat === 'conflit'">
      <span class="st-sauve-texte">
        <strong>Modifié ailleurs (Claude ou un autre appareil)</strong>
        <span v-if="conflit?.resume" class="st-sauve-saisie">Ta dernière saisie, non enregistrée : « {{ conflit.resume }} »</span>
      </span>
      <button type="button" @click="$emit('recharger')">Recharger</button>
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
.st-sauve.is-erreur, .st-sauve.is-conflit { background: var(--st-alerte-fond); color: var(--st-alerte); padding-right: 4px; }
/* Conflit : texte sur deux lignes possibles, l'indicateur ne doit pas déborder sur téléphone. */
.st-sauve.is-conflit { border-radius: 12px; padding: 6px 4px 6px 12px; max-width: min(100%, 420px); }
.st-sauve-texte { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.st-sauve-saisie { font-weight: 500; overflow-wrap: anywhere; }
.st-sauve button { min-height: 44px; margin: -6px 0; padding: 0 10px; border: 0; background: none; color: var(--st-alerte); font-weight: 700; text-decoration: underline; flex: none; }
</style>
