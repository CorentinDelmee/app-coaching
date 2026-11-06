<script setup>
// Démo des composants Studio (dev seulement : /coach/studio-demo). Montre la vignette (grille / liste), le panneau,
// l'élément partagé, les filtres, la sauvegarde auto et le toast — c'est le modèle de câblage pour les lots d'écrans.
// Données : exemples à la forme du contrat docs/CONTRAT-EXERCICES-STUDIO.md (aucun appel data).
import { computed, nextTick, ref } from 'vue'
import VignetteExercice from './VignetteExercice.vue'
import PanneauLateral from './PanneauLateral.vue'
import FigureMouvement from './FigureMouvement.vue'
import LecteurVideo from './LecteurVideo.vue'
import Filtres from './Filtres.vue'
import Puce from './Puce.vue'
import IconeSt from './IconeSt.vue'
import { useSauvegardeAuto } from './useSauvegardeAuto.js'
import { volerVers } from './transitionPartagee.js'
import { toast } from './toast.js'
import { mediaDe, muscleDe, mouvementDe, nomMuscleDe, idVideoDe, statutVideo } from './medias.js'

const ex = (id, nom, muscles, materiel, extra = {}) => ({ id, nom, categories: [], musclesPrincipaux: muscles, musclesSecondaires: [], materiel, niveau: 'debutant', photo: null, video: null, utiliseDans: 0, ...extra })
const exercices = ref([
  ex('ex-squat-gobelet', 'Squat gobelet', ['jambes'], ['Haltères'], { lienVideo: 'https://www.youtube.com/watch?v=mKREc_xl_j8', video: { url: 'https://www.youtube.com/watch?v=mKREc_xl_j8', titre: null, chaine: null, duree: 20, statut: 'valide' }, utiliseDans: 3 }),
  ex('ex-rowing', 'Rowing unilatéral à l’haltère', ['dos'], ['Haltères', 'Banc'], { niveau: 'intermediaire' }),
  ex('ex-pompes', 'Pompes sur les genoux', ['pectoraux'], ['Poids du corps'], { video: { url: '', titre: null, chaine: null, duree: 35, statut: 'propose' }, lienVideo: 'https://youtu.be/IODxDxX7oi4' }),
  ex('ex-dvp', 'Développé militaire à l’élastique', ['epaules'], ['Élastique']),
  ex('ex-curl', 'Curl biceps marteau', ['bras'], ['Haltères']),
  ex('ex-planche', 'Planche ventrale', ['gainage'], ['Tapis'], { niveau: 'confirme' }),
  ex('ex-chat', 'Chat-vache', ['mobilite'], ['Tapis']),
  ex('ex-jj', 'Jumping jacks', ['cardio'], [])
])

const filtre = ref('')
const OPTIONS = ['jambes', 'dos', 'pecs', 'epaules', 'bras', 'gainage', 'mobilite', 'cardio'].map((m) => ({ valeur: m, texte: { pecs: 'Pectoraux', epaules: 'Épaules', mobilite: 'Mobilité' }[m] || m[0].toUpperCase() + m.slice(1), muscle: m }))
const affichage = ref('grille')
const liste = computed(() => exercices.value.filter((e) => !filtre.value || muscleDe(e) === filtre.value))

const ouvert = ref(null) // id
const courant = computed(() => exercices.value.find((e) => e.id === ouvert.value) || null)
const panneau = ref(null)
const cascade = ref(true)
const lecture = ref(false)
const index = computed(() => liste.value.findIndex((e) => e.id === ouvert.value))

const sauvegarde = useSauvegardeAuto(async () => { await new Promise((r) => setTimeout(r, 500)) })

async function ouvrir(e, elMedia) {
  const deja = !!ouvert.value
  if (deja) sauvegarde.maintenant() // pas d'attente : la sauvegarde finit en arrière-plan
  cascade.value = !deja
  lecture.value = false
  ouvert.value = e.id
  await nextTick()
  if (!deja && elMedia) volerVers(elMedia, panneau.value?.media(), { muscle: muscleDe(e) })
}
function fermer() { sauvegarde.maintenant(); ouvert.value = null }
function voisin(d) {
  const n = liste.value[index.value + d]
  if (n) ouvrir(n, null)
}
function renommer(ev) {
  courant.value.nom = ev.target.value
  sauvegarde.planifier({ nom: ev.target.value })
}
function valider() {
  const e = courant.value
  const avant = e.video
  e.video = { ...avant, statut: 'valide' }
  toast('Vidéo validée', { action: 'Annuler', surAction: () => { e.video = avant } })
}
</script>

<template>
  <section class="st-demo" :class="{ 'st-reserve-panneau': ouvert }" aria-labelledby="st-t-demo">
    <header class="st-entete">
      <div><h1 id="st-t-demo">Composants</h1><p>Démo du Studio (développement seulement).</p></div>
      <div class="st-actions">
        <button class="st-btn" type="button" :aria-pressed="affichage === 'liste'" @click="affichage = affichage === 'liste' ? 'grille' : 'liste'">{{ affichage === 'liste' ? 'Grandes vignettes' : 'Liste compacte' }}</button>
      </div>
    </header>
    <Filtres v-model="filtre" :options="OPTIONS" :multiple="false" etiquette="Groupes musculaires" />
    <ul class="st-demo-grille" :class="{ 'is-liste': affichage === 'liste' }">
      <li v-for="e in liste" :key="e.id"><VignetteExercice :exercice="e" :actif="ouvert === e.id" :affichage="affichage" @ouvrir="ouvrir" /></li>
    </ul>

    <PanneauLateral
      ref="panneau" :ouvert="!!courant" :etiquette="courant?.nom || ''" :muscle="courant ? muscleDe(courant) : null"
      :sauvegarde="sauvegarde.etat.value" :precedent="index > 0" :suivant="index >= 0 && index < liste.length - 1" :cascade="cascade"
      @fermer="fermer" @precedent="voisin(-1)" @suivant="voisin(1)" @reessayer="sauvegarde.reessayer"
    >
      <template #media>
        <template v-if="courant">
          <LecteurVideo v-if="lecture && idVideoDe(courant)" :id="idVideoDe(courant)" :titre="courant.nom" />
          <img v-else-if="mediaDe(courant).type !== 'figure'" :src="mediaDe(courant).src" alt="">
          <FigureMouvement v-else :mouvement="mouvementDe(courant)" />
        </template>
      </template>
      <template #barre>
        <button v-if="courant && idVideoDe(courant) && !lecture" class="st-btn" type="button" @click="lecture = true"><IconeSt nom="play" />Lire</button>
      </template>
      <template v-if="courant">
        <textarea class="st-demo-nom" :value="courant.nom" rows="1" aria-label="Nom de l'exercice" @input="renommer" />
        <p class="st-demo-statut"><Puce variante="muscle" :muscle="muscleDe(courant)" point>{{ nomMuscleDe(courant) }}</Puce> <Puce v-if="statutVideo(courant) === 'propose'" variante="propose" point>Vidéo proposée par Claude</Puce></p>
        <div v-if="statutVideo(courant) === 'propose'" class="st-bloc st-demo-valider"><p>Claude a proposé cette vidéo.</p><button class="st-btn st-btn--jaune" type="button" @click="valider">Valider</button></div>
        <p>Utilisé dans <b>{{ courant.utiliseDans }}</b> séance(s).</p>
      </template>
    </PanneauLateral>
  </section>
</template>

<style>
.st-demo-grille { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.st-demo-grille.is-liste { grid-template-columns: 1fr; gap: 8px; }
@media (max-width: 900px) { .st-demo-grille:not(.is-liste) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
.st-demo-nom { width: 100%; border: 0; background: none; font-family: var(--st-titre); font-weight: 500; font-size: 30px; line-height: 1.08; letter-spacing: -.03em; color: var(--st-encre); padding: 4px 0; resize: none; field-sizing: content; min-height: 44px; }
.st-demo-statut { display: flex; gap: 8px; flex-wrap: wrap; }
.st-demo-valider { display: flex; align-items: center; gap: 12px; background: var(--st-propose-fond); color: var(--st-propose); box-shadow: none; }
.st-demo-valider p { flex: 1; margin: 0; }
</style>
