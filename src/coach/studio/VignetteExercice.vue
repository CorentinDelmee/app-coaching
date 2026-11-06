<script setup>
// Carte d'exercice du Studio (grille 4:3 ou ligne compacte). Accepte la forme du contrat docs/CONTRAT-EXERCICES-STUDIO.md
// (musclesPrincipaux, materiel[], niveau, photo {url}, video {statut, duree}) et l'ancienne forme (categories, lienVideo).
// Usage :
//   <VignetteExercice :exercice="e" :actif="ouvert === e.id" @ouvrir="(e, elMedia) => ouvrir(e, elMedia)" />
//   elMedia = l'élément .st-carte-media, à passer à volerVers(elMedia, panneau.media()) pour l'élément partagé.
// Appui long (doigt, 380 ms) : l'aperçu s'anime sans ouvrir. Survol (souris) : idem.
import { computed, onBeforeUnmount, ref } from 'vue'
import { mediaDe, muscleDe, nomMuscleDe, mouvementDe, statutVideo, dureeCourte, NIVEAUX } from './medias.js'
import FigureMouvement from './FigureMouvement.vue'
import IconeSt from './IconeSt.vue'

const props = defineProps({
  exercice: { type: Object, required: true },
  actif: { type: Boolean, default: false },          // ouvert dans le panneau (aria-current)
  affichage: { type: String, default: 'grille' }     // 'grille' | 'liste'
})
const emit = defineEmits(['ouvrir'])

const media = computed(() => mediaDe(props.exercice))
const muscle = computed(() => muscleDe(props.exercice))
const statut = computed(() => statutVideo(props.exercice))
const duree = computed(() => dureeCourte(props.exercice?.video?.duree))
const meta = computed(() => [nomMuscleDe(props.exercice), (props.exercice.materiel || [])[0]].filter(Boolean).join(' · '))
const niveau = computed(() => NIVEAUX[props.exercice.niveau] || '')
const imageEchouee = ref(false)

const elMedia = ref(null)
const joue = ref(false)
let minuteur = null
let appuiLong = false
function appuyer(ev) {
  if (ev.pointerType === 'mouse') return
  appuiLong = false
  clearTimeout(minuteur)
  minuteur = setTimeout(() => { appuiLong = true; joue.value = true }, 380)
}
function relacher() { clearTimeout(minuteur); joue.value = false }
function cliquer(ev) {
  if (appuiLong) { appuiLong = false; ev.preventDefault(); return } // l'appui long montre l'aperçu, n'ouvre pas
  emit('ouvrir', props.exercice, elMedia.value)
}
onBeforeUnmount(() => clearTimeout(minuteur))
defineExpose({ media: () => elMedia.value })
</script>

<template>
  <button
    type="button" class="st-carte" :class="{ 'is-liste': affichage === 'liste', 'is-joue': joue }"
    :data-m="muscle || undefined" :data-id="exercice.id" :aria-current="actif ? 'true' : 'false'"
    @click="cliquer" @pointerdown="appuyer" @pointerup="relacher" @pointercancel="relacher" @pointerleave="relacher" @contextmenu="joue && $event.preventDefault()"
  >
    <span ref="elMedia" class="st-carte-media">
      <img v-if="media.type !== 'figure' && !imageEchouee" :src="media.src" alt="" loading="lazy" decoding="async" @error="imageEchouee = true">
      <FigureMouvement v-else :mouvement="mouvementDe(exercice)" />
      <span v-if="statut === 'propose'" class="st-puce st-puce--propose"><i aria-hidden="true" />À valider</span>
      <span v-else-if="statut === 'aucune' && media.type === 'figure'" class="st-puce st-puce--neutre">Sans vidéo</span>
      <template v-if="statut !== 'aucune'">
        <span class="st-lecture" aria-hidden="true"><IconeSt nom="play" /></span>
        <span v-if="duree" class="st-duree"><span class="st-sr">Vidéo de </span>{{ duree }}</span>
      </template>
    </span>
    <span class="st-carte-corps">
      <span class="st-carte-nom">{{ exercice.nom }}</span>
      <span v-if="meta" class="st-carte-meta"><span class="st-dot" aria-hidden="true" />{{ meta }}</span>
    </span>
    <span v-if="affichage === 'liste'" class="st-carte-fin">
      <span v-if="statut === 'propose'" class="st-puce st-puce--propose"><i aria-hidden="true" />À valider</span>
      <span v-if="niveau" class="st-puce st-puce--neutre">{{ niveau }}</span>
    </span>
  </button>
</template>

<style>
.st-carte { position: relative; display: block; width: 100%; text-align: left; padding: 0; border: 0; background: var(--st-surface); border-radius: var(--st-r-l); box-shadow: var(--st-ombre-1); overflow: hidden; color: var(--st-texte); transition: transform var(--st-d-court) var(--st-ressort), box-shadow var(--st-d-court); -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
@media (hover: hover) { .st-carte:hover { transform: translateY(-3px); box-shadow: var(--st-ombre-2); } }
.st-carte:active { transform: scale(.97); transition-duration: 90ms; }
.st-carte[aria-current="true"] { box-shadow: 0 0 0 2.5px var(--st-encre), var(--st-ombre-2); }
.st-carte-media { position: relative; display: block; aspect-ratio: 4 / 3; overflow: hidden; background: radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,.55), transparent 60%), var(--mc); }
.st-carte-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-carte-media .st-fig { position: absolute; inset: 8% 10% 0; width: 80%; height: 92%; }
.st-carte-media .st-lecture { position: absolute; left: 10px; bottom: 10px; width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,.88); display: grid; place-items: center; color: var(--st-encre); transition: transform var(--st-d-court) var(--st-ressort); }
.st-carte-media .st-lecture svg { width: 12px; height: 12px; margin-left: 2px; }
@media (hover: hover) { .st-carte:hover .st-lecture { transform: scale(1.12); } }
.st-carte-media .st-duree { position: absolute; right: 10px; bottom: 10px; padding: 2px 7px; border-radius: 7px; background: rgba(35,37,43,.78); color: #fff; font-size: 11.5px; font-weight: 600; }
.st-carte-media .st-puce { position: absolute; top: 10px; right: 10px; height: 24px; font-size: 11.5px; }
.st-carte-corps { display: block; padding: 11px 13px 13px; }
.st-carte-nom { font-weight: 650; color: var(--st-encre); font-size: 15px; line-height: 1.25; margin: 0 0 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.st-carte-meta { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--st-doux); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-carte-meta .st-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--mi); }
.st-carte-fin { display: flex; gap: 8px; align-items: center; }

/* Ligne compacte (76 px) */
.st-carte.is-liste { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 14px; min-height: 64px; border-radius: 14px; padding: 5px 12px 5px 5px; }
.st-carte.is-liste:hover { transform: none; }
.st-carte.is-liste .st-carte-media { aspect-ratio: 1; border-radius: 10px; }
.st-carte.is-liste .st-carte-media .st-puce, .st-carte.is-liste .st-duree, .st-carte.is-liste .st-lecture { display: none; }
.st-carte.is-liste .st-carte-corps { padding: 0; min-width: 0; }
.st-carte.is-liste .st-carte-nom { margin: 0; -webkit-line-clamp: 1; }
@media (max-width: 900px) {
  .st-carte-corps { padding: 9px 10px 11px; }
  .st-carte-nom { font-size: 14px; }
  .st-carte.is-liste .st-carte-meta { display: none; }
}
@media (prefers-reduced-motion: reduce) { .st-carte:hover { transform: none; } }
</style>
