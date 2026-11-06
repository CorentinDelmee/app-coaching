<script setup>
// Écran Exercices du Studio (design-coach/d3) : grille de vignettes teintées, filtres instantanés, panneau d'édition
// à côté (feuille sur téléphone) où la vignette « s'envole » (élément partagé), sauvegarde automatique.
// Remplace aussi la bibliothèque vidéo (/coach/bibliotheque -> filtre « À valider »).
// Données : uniquement data.exercices.* (via ./donnees.js). Préfixe CSS : st-exo-.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Filtres from '../../Filtres.vue'
import IconeSt from '../../IconeSt.vue'
import LecteurVideo from '../../LecteurVideo.vue'
import FigureMouvement from '../../FigureMouvement.vue'
import VignetteExercice from '../../VignetteExercice.vue'
import PanneauLateral from '../../PanneauLateral.vue'
import { volerVers, mouvementReduit } from '../../transitionPartagee.js'
import { toast } from '../../toast.js'
import { NOMS_MUSCLES, TEINTES_STUDIO, NIVEAUX, muscleDe, mediaDe, mouvementDe, idVideoDe, statutVideo, dureeCourte } from '../../medias.js'
import { uuid } from '../../../store.js'
import { filtrer, compteParTeinte, materielsDe, categoriesDe, compteVideo, voisin, messageErreurExo } from './logique.js'
import * as D from './donnees.js'
import FicheExercice from './FicheExercice.vue'

const route = useRoute()
const router = useRouter()

const items = ref([])
const charge = ref(false)
const erreur = ref('')
const q = ref('')
const muscles = ref([])
const materiel = ref('')
const categorie = ref('')
const niveau = ref('')
const video = ref(['propose', 'valide', 'aucune'].includes(route.query.video) ? route.query.video : '')
const affichage = ref('grille')

const liste = computed(() => filtrer(items.value, { q: q.value, muscles: muscles.value, materiel: materiel.value, categorie: categorie.value, niveau: niveau.value, video: video.value }))
const comptes = computed(() => compteParTeinte(items.value))
const optionsMuscles = computed(() => TEINTES_STUDIO.map((t) => ({ valeur: t, texte: NOMS_MUSCLES[t], muscle: t, n: comptes.value[t] })))
const optionsVideo = computed(() => [
  { valeur: 'propose', texte: 'Vidéo à valider', propose: true, n: compteVideo(items.value, 'propose') },
  { valeur: 'aucune', texte: 'Sans vidéo', n: compteVideo(items.value, 'aucune') }
])
const materiels = computed(() => materielsDe(items.value))
const categories = computed(() => categoriesDe(items.value))
const filtresActifs = computed(() => !!(q.value || muscles.value.length || materiel.value || categorie.value || niveau.value || video.value))
function toutEffacer() { q.value = ''; muscles.value = []; materiel.value = ''; categorie.value = ''; niveau.value = ''; video.value = '' }

async function charger() {
  erreur.value = ''
  try { items.value = await D.chargerTous() } catch (e) { erreur.value = messageErreurExo(e) } finally { charge.value = true }
}

// ---------- Panneau ----------
const courantId = ref(null)
const courant = computed(() => items.value.find((e) => e.id === courantId.value) || null)
const panneau = ref(null)
const fiche = ref(null)
const etatSauve = ref('repos')
const cascade = ref(true)
const lecture = ref(false)
const mediaCourant = computed(() => (courant.value ? mediaDe(courant.value) : null))
const idVideo = computed(() => (courant.value ? idVideoDe(courant.value) : null))
const precedent = computed(() => !!(courant.value && voisin(liste.value, courant.value.id, -1)))
const suivant = computed(() => !!(courant.value && voisin(liste.value, courant.value.id, 1)))

// Lien direct : /coach/exercices?ex=<id> ouvre l'exercice (ex. depuis Aujourd'hui). L'ouverture ne réécrit pas l'URL :
// recharger la page rend la grille (le panneau ne recouvre pas tout au retour sur téléphone).
function majUrl(id) {
  const query = { ...route.query }
  if (id) query.ex = id; else delete query.ex
  router.replace({ query })
}

async function ouvrir(e, elMedia) {
  const deja = !!courantId.value
  if (deja && courantId.value === e.id) return
  // L'ancienne fiche est démontée (:key) : son onBeforeUnmount écrit ce qui reste, sans bloquer le changement.
  cascade.value = !deja
  lecture.value = false
  courantId.value = e.id
  await nextTick()
  const cible = panneau.value?.media?.()
  if (!deja && elMedia && cible) volerVers(elMedia, cible, { muscle: muscleDe(e) })
  else if (deja && cible && !mouvementReduit()) cible.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' })
}

async function fermer() {
  const id = courantId.value
  if (!id) return
  fiche.value?.enregistrer?.() // sans attendre : le panneau se ferme tout de suite, l'écriture finit en arrière-plan
  courantId.value = null
  lecture.value = false
  if (route.query.ex) majUrl(null)
  await nextTick()
  // PanneauLateral rend le focus à la carte d'ouverture ; après ↑ ↓ c'est la dernière carte affichée qui doit l'avoir.
  document.querySelector(`.st-exo-grille .st-carte[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true })
}

function aller(d) {
  const n = courant.value && voisin(liste.value, courant.value.id, d)
  if (!n) return
  ouvrir(n, null)
  nextTick(() => document.querySelector(`.st-exo-grille .st-carte[data-id="${CSS.escape(n.id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: mouvementReduit() ? 'auto' : 'smooth' }))
}

function surMaj(item) {
  const i = items.value.findIndex((e) => e.id === item.id)
  if (i >= 0) items.value[i] = { ...items.value[i], ...item }
}
function surArchive(id) {
  const n = voisin(liste.value, id, 1) || voisin(liste.value, id, -1)
  courantId.value = null
  items.value = items.value.filter((e) => e.id !== id)
  if (route.query.ex) majUrl(null)
  if (n) nextTick(() => document.querySelector(`.st-exo-grille .st-carte[data-id="${CSS.escape(n.id)}"]`)?.focus({ preventScroll: true }))
}

async function nouveau() {
  try {
    const cree = await D.creer({ id: uuid(), nom: 'Nouvel exercice', categories: [] })
    const item = (await D.detail(cree.id)) || cree
    if (!item) { await charger(); return }
    items.value = [...items.value, item]
    toutEffacer()
    await ouvrir(item, null)
    await nextTick()
    const champ = document.getElementById('st-exo-nom')
    champ?.focus(); champ?.select()
  } catch (e) { toast(messageErreurExo(e)) }
}

// Filtre vidéo <-> ?video= (lien « N vidéos proposées par Claude » d'Aujourd'hui, ancienne /coach/bibliotheque)
watch(video, (v) => {
  if ((route.query.video || '') === v) return
  const query = { ...route.query }
  if (v) query.video = v; else delete query.video
  router.replace({ query })
})
watch(() => route.query.video, (v) => { const n = ['propose', 'valide', 'aucune'].includes(v) ? v : ''; if (n !== video.value) video.value = n })

// ---------- Filtrage : la grille se recompose sans saut (16 premières cartes, 18 ms de décalage) ----------
const grille = ref(null)
let animFiltre = []
watch([q, muscles, materiel, categorie, niveau, video], async () => {
  if (mouvementReduit()) return
  await nextTick()
  animFiltre.forEach((a) => a.cancel())
  animFiltre = [...(grille.value?.querySelectorAll('.st-carte') || [])].slice(0, 16).map((c, i) =>
    c.animate([{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: i * 18, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }))
})

// ---------- Clavier : / cherche ; flèches dans la grille ----------
const champRecherche = ref(null)
function surTouche(ev) {
  const champ = ev.target.closest?.('input, textarea, select, [contenteditable="true"]')
  if (ev.key === '/' && !champ && !courantId.value) { ev.preventDefault(); champRecherche.value?.focus(); return }
  if (ev.key === 'Escape' && ev.target === champRecherche.value && q.value) { q.value = ''; return }
  if (courantId.value || champ) return
  const carte = ev.target.closest?.('.st-exo-grille .st-carte')
  if (!carte) return
  const cartes = [...grille.value.querySelectorAll('.st-carte')]
  const i = cartes.indexOf(carte)
  const cols = affichage.value === 'liste' ? 1 : Math.max(1, Math.round(grille.value.clientWidth / carte.offsetWidth))
  const pas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[ev.key]
  if (!pas) return
  const n = cartes[Math.max(0, Math.min(cartes.length - 1, i + pas))]
  if (n) { ev.preventDefault(); n.focus() }
}

onMounted(async () => {
  document.addEventListener('keydown', surTouche)
  await charger()
  const id = route.query.ex
  if (id && items.value.some((e) => e.id === id)) ouvrir(items.value.find((e) => e.id === id), null)
})
onBeforeUnmount(() => { document.removeEventListener('keydown', surTouche); animFiltre.forEach((a) => a.cancel()) })
</script>

<template>
  <section class="st-exo" :class="{ 'st-reserve-panneau': !!courant }" aria-labelledby="st-exo-titre">
    <header class="st-entete">
      <div>
        <h1 id="st-exo-titre">Exercices</h1>
        <p>{{ charge ? `${items.length} mouvements dans ta bibliothèque, prêts à glisser dans une séance.` : 'Chargement de ta bibliothèque…' }}</p>
      </div>
      <div class="st-actions">
        <button class="st-btn st-btn--jaune" type="button" @click="nouveau"><IconeSt nom="plus" /><span>Nouvel exercice</span></button>
      </div>
    </header>

    <div class="st-exo-outils">
      <label class="st-exo-recherche">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        <span class="st-sr">Rechercher un exercice</span>
        <input ref="champRecherche" v-model="q" type="search" placeholder="Rechercher : squat, élastique, épaules…" autocomplete="off" enterkeyhint="search">
        <kbd aria-hidden="true">/</kbd>
      </label>
      <select v-model="materiel" class="st-exo-select" aria-label="Matériel"><option value="">Matériel</option><option v-for="m in materiels" :key="m" :value="m">{{ m }}</option></select>
      <select v-model="categorie" class="st-exo-select" aria-label="Catégorie"><option value="">Catégorie</option><option v-for="c in categories" :key="c" :value="c">{{ c }}</option></select>
      <select v-model="niveau" class="st-exo-select" aria-label="Niveau"><option value="">Niveau</option><option v-for="(t, v) in NIVEAUX" :key="v" :value="v">{{ t }}</option></select>
      <div class="st-exo-bascule" role="group" aria-label="Affichage">
        <button type="button" :aria-pressed="affichage === 'grille'" aria-label="Grandes vignettes" @click="affichage = 'grille'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></svg></button>
        <button type="button" :aria-pressed="affichage === 'liste'" aria-label="Liste compacte" @click="affichage = 'liste'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="3" rx="1.5" /><rect x="4" y="10.5" width="16" height="3" rx="1.5" /><rect x="4" y="16" width="16" height="3" rx="1.5" /></svg></button>
      </div>
    </div>
    <div class="st-exo-rangee">
      <Filtres v-model="video" class="st-exo-fvideo" :options="optionsVideo" :multiple="false" etiquette="Vidéo" />
      <Filtres v-model="muscles" class="st-exo-fmuscles" :options="optionsMuscles" etiquette="Groupes musculaires" />
    </div>

    <p v-if="erreur" class="st-exo-alerte" role="alert">{{ erreur }} <button type="button" class="st-btn" @click="charger">Réessayer</button></p>
    <p class="st-sr" role="status" aria-live="polite">{{ charge ? `${liste.length} exercice${liste.length > 1 ? 's' : ''}` : '' }}</p>

    <ul v-if="liste.length" ref="grille" class="st-exo-grille" data-test="biblio" :class="{ 'is-liste': affichage === 'liste' }">
      <li v-for="e in liste" :key="e.id"><VignetteExercice data-test="exercice" :exercice="e" :actif="courantId === e.id" :affichage="affichage" @ouvrir="ouvrir" /></li>
    </ul>
    <div v-else-if="charge && !erreur" class="st-exo-vide">
      <p v-if="!items.length"><b>Ta bibliothèque est vide.</b><br>Crée ton premier exercice ou demande à Claude d'en ajouter.</p>
      <p v-else><b>Aucun exercice ne correspond.</b><br>Essaie un autre mot ou retire un filtre.</p>
      <button v-if="filtresActifs" type="button" class="st-btn" @click="toutEffacer">Effacer les filtres</button>
    </div>
    <ul v-else-if="!charge" class="st-exo-grille" aria-hidden="true"><li v-for="n in 8" :key="n" class="st-exo-fantome" /></ul>

    <PanneauLateral
      ref="panneau" :ouvert="!!courant" :etiquette="courant?.nom || 'Exercice'" :muscle="courant ? muscleDe(courant) : null"
      :sauvegarde="etatSauve" :precedent="precedent" :suivant="suivant" :cascade="cascade"
      @fermer="fermer" @precedent="aller(-1)" @suivant="aller(1)" @reessayer="fiche?.reessayer()"
    >
      <template #media>
        <template v-if="courant">
          <LecteurVideo v-if="lecture && idVideo" :id="idVideo" :titre="courant.nom" />
          <img v-else-if="mediaCourant.type !== 'figure'" :src="mediaCourant.type === 'youtube' ? `https://i.ytimg.com/vi/${mediaCourant.id}/hqdefault.jpg` : mediaCourant.src" :alt="mediaCourant.type === 'photo' ? `Photo : ${courant.nom}` : ''" decoding="async">
          <FigureMouvement v-else :mouvement="mouvementDe(courant)" />
          <button v-if="idVideo && !lecture" type="button" class="st-btn st-exo-lire" @click="lecture = true">
            <IconeSt nom="play" />Lire la vidéo<template v-if="dureeCourte(courant.video?.duree)"> · {{ dureeCourte(courant.video.duree) }}</template>
          </button>
          <span v-if="statutVideo(courant) === 'propose' && !lecture" class="st-exo-propose">À valider</span>
        </template>
      </template>
      <FicheExercice
        v-if="courant" :key="courant.id" ref="fiche" :exercice="courant" :materiels="materiels" :categories="categories"
        @etat="etatSauve = $event" @maj="surMaj" @archive="surArchive"
      />
    </PanneauLateral>
  </section>
</template>

<style src="./exercices.css"></style>
