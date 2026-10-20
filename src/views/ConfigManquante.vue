<script setup>
// Écran affiché à la place de l'app quand un build de production n'a pas de configuration Supabase.
</script>

<template>
  <main class="config-manquante">
    <h1>Configuration manquante</h1>
    <p>Cette version de l'application n'est pas reliée à sa base de données. Elle ne doit pas être utilisée.</p>
    <p>Si vous êtes le coach : refaites la construction (<code>npm run build</code>) avec le fichier <code>.env</code> rempli, puis republiez.</p>
  </main>
</template>

<style scoped>
.config-manquante { min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 32px 24px; max-width: 520px; margin: 0 auto; color: var(--texte, #F3EDE4); }
h1 { font-size: 28px; }
p { line-height: 1.5; color: var(--texte-doux, inherit); }
</style>
