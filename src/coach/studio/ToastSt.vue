<script setup>
// Affiche le toast du Studio (voir toast.js). Monté une seule fois dans CoachLayout.
import { etatToast, agirToast, fermerToast } from './toast.js'
</script>

<template>
  <div class="st-toast" :class="{ 'is-vu': etatToast.visible }" role="status" aria-live="polite">
    <template v-if="etatToast.visible">
      <span>{{ etatToast.message }}</span>
      <button v-if="etatToast.action" type="button" @click="agirToast">{{ etatToast.action }}</button>
      <button type="button" class="st-toast-x" aria-label="Fermer le message" @click="fermerToast">×</button>
    </template>
  </div>
</template>

<style>
.st-toast { position: fixed; left: 50%; bottom: 24px; z-index: var(--st-z-toast); display: flex; gap: 10px; align-items: center; max-width: calc(100vw - 32px); padding: 8px 8px 8px 18px; border-radius: 16px; background: var(--st-encre); color: #fff; font-weight: 600; box-shadow: var(--st-ombre-3); transform: translate(-50%, calc(100% + 60px)); visibility: hidden; transition: transform var(--st-d-base) var(--st-ressort), visibility 0s var(--st-d-base); }
.st-toast.is-vu { transform: translate(-50%, 0); visibility: visible; transition: transform var(--st-d-base) var(--st-ressort), visibility 0s; }
.st-toast button { min-height: 44px; min-width: 44px; padding: 0 10px; border: 0; background: none; color: var(--st-jaune); font-weight: 700; text-decoration: underline; border-radius: 10px; }
.st-toast .st-toast-x { color: #C9C6BF; text-decoration: none; font-size: 22px; }
@media (max-width: 900px) { .st-toast { bottom: calc(96px + env(safe-area-inset-bottom)); } }
</style>
