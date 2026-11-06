<script setup>
// Figure « bâtons » qui mime le mouvement (repli quand l'exercice n'a ni photo ni vidéo). Bouge au survol de la carte
// (.st-carte:hover) ou quand un ancêtre porte .is-joue (appui long). Couleur = encre du muscle (--mi).
// Usage : <FigureMouvement mouvement="squat" />  (mouvementDe(exercice) dans medias.js)
const props = defineProps({ mouvement: { type: String, default: 'squat' } })
const couche = () => props.mouvement === 'pompe' || props.mouvement === 'gainage'
</script>

<template>
  <svg class="st-fig" :data-mv="mouvement" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <path class="sol" d="M14 93 H86" />
    <g v-if="couche()" class="tout">
      <circle class="tete" cx="22" cy="58" r="7" /><path class="os" d="M29 62 L80 72" />
      <g class="bras"><path class="os" d="M34 63 L34 84" /></g><path class="os" d="M80 72 L88 86" />
    </g>
    <g v-else class="tout">
      <g class="haut">
        <circle class="tete" cx="50" cy="20" r="7.5" /><path class="os" d="M50 30 L50 62" />
        <g class="bras"><path class="os" d="M50 38 L42 56 M50 38 L58 56" /></g>
      </g>
      <g class="bas"><path class="os" d="M50 62 L43 89 M50 62 L57 89" /></g>
    </g>
  </svg>
</template>

<style>
.st-fig { color: var(--mi); }
.st-fig .os { stroke: currentColor; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; fill: none; }
.st-fig .tete { fill: currentColor; }
.st-fig .sol { stroke: currentColor; stroke-width: 3; opacity: .25; stroke-linecap: round; }
.st-fig .haut, .st-fig .bas, .st-fig .bras, .st-fig .tout { transform-box: view-box; }
.st-fig .haut { transform-origin: 50px 62px; }
.st-fig .bras { transform-origin: 50px 38px; }
.st-fig .tout { transform-origin: 50px 90px; }
.st-fig[data-mv="squat"] { --anim-haut: st-mv-squat; --anim-bras: st-mv-squat-bras; }
.st-fig[data-mv="charniere"] { --anim-haut: st-mv-charniere; }
.st-fig[data-mv="tirage"] { --anim-bras: st-mv-tirage; }
.st-fig[data-mv="pousse"] { --anim-bras: st-mv-pousse; }
.st-fig[data-mv="pompe"] { --anim-tout: st-mv-pompe; }
.st-fig[data-mv="gainage"] { --anim-tout: st-mv-respire; }
.st-fig[data-mv="cardio"] { --anim-tout: st-mv-saut; --anim-bras: st-mv-ecart; }
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .st-carte:hover .st-fig .tout { animation: var(--anim-tout, none) 1.6s ease-in-out infinite; }
  .st-carte:hover .st-fig .haut { animation: var(--anim-haut, none) 1.6s ease-in-out infinite; }
  .st-carte:hover .st-fig .bras { animation: var(--anim-bras, none) 1.6s ease-in-out infinite; }
}
@media (prefers-reduced-motion: no-preference) {
  .is-joue .st-fig .tout { animation: var(--anim-tout, none) 1.6s ease-in-out infinite; }
  .is-joue .st-fig .haut { animation: var(--anim-haut, none) 1.6s ease-in-out infinite; }
  .is-joue .st-fig .bras { animation: var(--anim-bras, none) 1.6s ease-in-out infinite; }
}
@keyframes st-mv-squat { 50% { transform: translateY(14px); } }
@keyframes st-mv-squat-bras { 50% { transform: translateY(14px) rotate(-70deg); } }
@keyframes st-mv-charniere { 50% { transform: rotate(55deg); } }
@keyframes st-mv-tirage { 50% { transform: rotate(-150deg); } }
@keyframes st-mv-pousse { 50% { transform: rotate(160deg); } }
@keyframes st-mv-pompe { 50% { transform: translateY(8px) rotate(4deg); } }
@keyframes st-mv-respire { 50% { transform: scale(1.03); } }
@keyframes st-mv-saut { 50% { transform: translateY(-8px); } }
@keyframes st-mv-ecart { 50% { transform: rotate(-120deg); } }
</style>
