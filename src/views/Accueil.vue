<script setup>
import { memoriserSource } from '../anim/passage.js'
</script>

<template>
  <main class="squelette">
    <h1>Corentin Delmée Coaching</h1>
    <p>Squelette de l'app — les écrans arrivent lot par lot.</p>
    <nav class="demo" aria-label="Programme et workouts">
      <RouterLink to="/programme" @click="memoriserSource($event.currentTarget)">Mon programme</RouterLink>
      <RouterLink to="/workout/w-fabien-2" @click="memoriserSource($event.currentTarget)">Workout 2 — Haut du corps</RouterLink>
      <RouterLink to="/workout/w-fabien-3" @click="memoriserSource($event.currentTarget)">Workout 3 — Corps entier (circuits)</RouterLink>
    </nav>
    <nav class="demo" aria-label="Séances de démonstration">
      <RouterLink to="/demo/seance">Séance de démo (haut du corps, superset)</RouterLink>
      <RouterLink to="/demo/temps">Séance de démo (bas du corps, série au temps)</RouterLink>
      <RouterLink to="/demo/finishers">Séance de démo (AMRAP + EMOM)</RouterLink>
      <RouterLink to="/demo/circuits">Circuits : les 6 autres formats</RouterLink>
    </nav>
  </main>
</template>

<style scoped>
.squelette { min-height: 100dvh; display: grid; place-content: center; justify-items: center; gap: 12px; text-align: center; padding: var(--pad); }
h1 { font-family: var(--font-titre); font-weight: 400; letter-spacing: -.03em; }
.demo { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.demo a { padding: 14px 18px; border-radius: var(--r-btn); background: var(--surface); text-decoration: none; font-weight: 600; }
</style>
