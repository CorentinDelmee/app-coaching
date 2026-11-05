<script setup>
// Icônes du Studio (traits 1,8 px, 24×24, couleur = currentColor). Usage : <IconeSt nom="ex" />
defineProps({ nom: { type: String, required: true } })
const T = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
const ICONES = {
  maison: `<path ${T} d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>`,
  ex: `<path ${T} d="M2 12h2M20 12h2M6 7v10M18 7v10M4 9v6M20 9v6M6 12h12"/>`,
  clients: `<circle ${T} cx="9" cy="8" r="3.5"/><path ${T} d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>`,
  prog: `<rect ${T} x="3" y="4" width="18" height="17" rx="3"/><path ${T} d="M3 9h18M8 2.5v3M16 2.5v3M7 13h4M7 17h7"/>`,
  cal: `<rect ${T} x="3" y="5" width="18" height="16" rx="3"/><path ${T} d="M3 10h18M8 3v4M16 3v4"/>`,
  msg: `<path ${T} d="M4 5h16v11H9l-5 4z"/>`,
  cloche: `<path ${T} d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>`,
  seance: `<path ${T} d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>`,
  video: `<rect ${T} x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>`,
  donnees: `<path ${T} d="M12 3v12M7 10l5 5 5-5M4 20h16"/>`,
  sortir: `<path ${T} d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>`,
  plusmenu: `<circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/>`,
  plus: `<path ${T} d="M12 5v14M5 12h14"/>`,
  fermer: `<path ${T} d="M6 6l12 12M18 6L6 18"/>`,
  haut: `<path ${T} d="M6 15l6-6 6 6"/>`,
  bas: `<path ${T} d="M6 9l6 6 6-6"/>`,
  play: `<path d="M8 5l12 7-12 7z" fill="currentColor"/>`,
  check: `<path ${T} stroke-width="2.2" d="M5 12.5l4.5 4.2L19 7"/>`
}
</script>

<template>
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" v-html="ICONES[nom] || ''" />
</template>
