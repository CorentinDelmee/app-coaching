<script setup>
// Icônes de l'app (trait de 2,2 px, bouts ronds). Une seule source pour tous les écrans.
defineProps({ nom: { type: String, required: true } })

const CHEMINS = {
  fermer: 'M6 6l12 12M18 6L6 18',
  coche: 'M5 12.5l4.5 4.5L19 7.5',
  fleche: 'M5 12h14M13 6l6 6-6 6',
  gauche: 'M15 5l-7 7 7 7',
  droite: 'M9 5l7 7-7 7',
  bas: 'M5 9l7 7 7-7',
  liste: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  lecture: 'M8 5.5v13l11-6.5z',
  coupe: 'M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8',
  cadenas: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  plus: 'M12 5v14M5 12h14',
  moins: 'M5 12h14',
  pause: 'M8 5v14M16 5v14'
}
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="CHEMINS[nom]" /></svg>
</template>
