<script setup>
// Cadre de test local (en attendant CoachLayout Studio) : racine .st-app + toasts. Non utilisé en production.
import { RouterView } from 'vue-router'
import '../../tokens.css'
import ToastSt from '../../ToastSt.vue'
</script>

<template>
  <div class="st-app" style="min-height: 100vh; padding: 24px clamp(16px, 4vw, 40px)">
    <RouterView />
    <ToastSt />
  </div>
</template>
