<script setup>
// Fiche d'un exercice dans un panneau, à ouvrir PAR-DESSUS un autre écran (ex. l'éditeur de séance) sans le quitter.
// Réutilise FicheExercice (sauvegarde auto, version + 409, photo, vidéo) et PanneauLateral en mode « modal » (large, voile,
// focus piégé, clic dehors / Échap / croix ferment). L'écran hôte garde son état : ce panneau ne touche qu'à l'exercice.
// Props : exercice (null = fermé), exercices (liste de l'hôte, pour les choix matériel / catégorie).
// Émet : fermer, maj (exercice à jour : l'hôte met sa vignette à jour), archive (id).
import { computed, nextTick, ref, watch } from 'vue'
import PanneauLateral from '../../PanneauLateral.vue'
import LecteurVideo from '../../LecteurVideo.vue'
import FigureMouvement from '../../FigureMouvement.vue'
import IconeSt from '../../IconeSt.vue'
import { muscleDe, mediaDe, mouvementDe, idVideoDe, statutVideo, dureeCourte } from '../../medias.js'
import { materielsDe, categoriesDe, LIBELLES } from './logique.js'
import FicheExercice from './FicheExercice.vue'

const props = defineProps({
  exercice: { type: Object, default: null },
  exercices: { type: Array, default: () => [] }
})
const emit = defineEmits(['fermer', 'maj', 'archive'])

const panneau = ref(null)
const fiche = ref(null)
const etatSauve = ref('repos')
const invalides = ref([])
const avertir = ref(false)
const lecture = ref(false)
const media = computed(() => (props.exercice ? mediaDe(props.exercice) : null))
const idVideo = computed(() => (props.exercice ? idVideoDe(props.exercice) : null))
const materiels = computed(() => materielsDe(props.exercices))
const categories = computed(() => categoriesDe(props.exercices))
const texteInvalide = computed(() => (invalides.value.length === 1 ? `${LIBELLES[invalides.value[0]] || 'Un champ'} n'est pas enregistré` : `${invalides.value.length} champs ne sont pas enregistrés`))

watch(() => props.exercice?.id, () => { lecture.value = false; avertir.value = false; invalides.value = [] })

/** Fermer : un champ invalide retient une fois (« Corriger » / « Fermer quand même ») ; sinon l'écriture part sans être attendue. */
function fermer({ force = false } = {}) {
  if (!force && invalides.value.length && !avertir.value) {
    avertir.value = true
    nextTick(() => document.getElementById('st-exo-avertir')?.focus())
    return
  }
  fiche.value?.enregistrer?.()
  avertir.value = false
  emit('fermer')
}
function corriger() { avertir.value = false; nextTick(() => fiche.value?.focusInvalide?.()) }

defineExpose({ media: () => panneau.value?.media?.() })
</script>

<template>
  <PanneauLateral
    ref="panneau" modal :ouvert="!!exercice" :etiquette="exercice ? `Fiche : ${exercice.nom}` : 'Fiche exercice'" :muscle="exercice ? muscleDe(exercice) : null"
    :sauvegarde="invalides.length || etatSauve === 'conflit' ? '' : etatSauve"
    @fermer="fermer()" @reessayer="fiche?.reessayer()"
  >
    <template #media>
      <template v-if="exercice">
        <LecteurVideo v-if="lecture && idVideo" :id="idVideo" :titre="exercice.nom" />
        <img v-else-if="media.type !== 'figure'" :src="media.type === 'youtube' ? `https://i.ytimg.com/vi/${media.id}/hqdefault.jpg` : media.src" :alt="media.type === 'photo' ? `Photo : ${exercice.nom}` : ''" decoding="async">
        <FigureMouvement v-else :mouvement="mouvementDe(exercice)" />
        <button v-if="idVideo && !lecture" type="button" class="st-btn st-exo-lire" @click="lecture = true">
          <IconeSt nom="play" />Lire la vidéo<template v-if="dureeCourte(exercice.video?.duree)"> · {{ dureeCourte(exercice.video.duree) }}</template>
        </button>
        <span v-if="statutVideo(exercice) === 'propose' && !lecture" class="st-exo-propose">À valider</span>
      </template>
    </template>
    <template #barre>
      <button v-if="invalides.length && !avertir" type="button" class="st-exo-acorriger" @click="corriger">
        {{ invalides.length }} champ{{ invalides.length > 1 ? 's' : '' }} à corriger
      </button>
    </template>
    <div v-if="avertir" id="st-exo-avertir" class="st-exo-avertir" role="alertdialog" aria-labelledby="st-exo-avertir-t" tabindex="-1">
      <p id="st-exo-avertir-t"><b>{{ texteInvalide }}.</b> Corrige-le pour le garder ; le reste est enregistré.</p>
      <div>
        <button type="button" class="st-btn st-btn--encre" @click="corriger">Corriger</button>
        <button type="button" class="st-btn" @click="fermer({ force: true })">Fermer quand même</button>
      </div>
    </div>
    <FicheExercice
      v-if="exercice" :key="exercice.id" ref="fiche" :exercice="exercice" :materiels="materiels" :categories="categories"
      @etat="etatSauve = $event" @invalides="invalides = $event" @maj="emit('maj', $event)" @archive="emit('archive', $event)"
    />
  </PanneauLateral>
</template>

<style src="./exercices.css"></style>
