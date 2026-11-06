<script setup>
// Liste des séances Studio : modèles + séances de chaque client, en cartes teintées par muscle.
// Reprend l'ancienne SeancesView : filtre (toutes / modèles / client), duplication vers un client ou un modèle
// (renommage), archivage (ici avec Annuler), nouvelle séance. En plus : recherche sans accents.
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import data from '../../../../../data/index.js'
import { etat, messageErreur, nomClient, rafraichir, uuid } from '../../../../store.js'
import { dupliquerWorkout, renommerPourClient, resumeWorkout } from '../../../../logique.js'
import IconeSt from '../../../IconeSt.vue'
import Puce from '../../../Puce.vue'
import Filtres from '../../../Filtres.vue'
import { toast } from '../../../toast.js'
import { NOMS_MUSCLES, sansAccents, teintesSeance } from '../commun/exercices.js'

const router = useRouter()
const workouts = ref([])
const exercices = ref([])
const charge = ref(false)
const filtre = ref('tous') // 'tous' | 'modeles' | id client
const q = ref('')
const filtreChoisi = computed({ get: () => filtre.value, set: (v) => { filtre.value = v || 'tous' } })
const duplication = ref(null) // { workout, cible }
const enCours = ref(false)   // garde anti-doublon (double clic sur Dupliquer)
const erreur = ref('')

async function charger() {
  erreur.value = ''
  try {
    await rafraichir()
    const [w, e] = await Promise.all([data.workouts.lister(), data.exercices.lister()])
    workouts.value = w
    exercices.value = e
  } catch (e) {
    erreur.value = messageErreur(e)
  }
  charge.value = true
}
onMounted(charger)

const parId = (id) => exercices.value.find((e) => e.id === id) || null
const nomExercice = (id) => parId(id)?.nom || '?'
const resume = (w) => resumeWorkout(w, nomExercice)

const options = computed(() => [
  { valeur: 'tous', texte: 'Toutes', n: workouts.value.length },
  { valeur: 'modeles', texte: 'Modèles', n: workouts.value.filter((w) => !w.clientId).length },
  ...etat.clients.filter((c) => workouts.value.some((w) => w.clientId === c.id)).map((c) => ({ valeur: c.id, texte: c.nom, n: workouts.value.filter((w) => w.clientId === c.id).length }))
])
const affiches = computed(() => {
  const mots = sansAccents(q.value).split(/\s+/).filter(Boolean)
  return workouts.value
    .filter((w) => filtre.value === 'tous' || (filtre.value === 'modeles' ? !w.clientId : w.clientId === filtre.value))
    .filter((w) => !mots.length || mots.every((m) => sansAccents(`${w.nom} ${w.clientId ? nomClient(w.clientId) : 'modele'} ${resume(w).noms.join(' ')}`).includes(m)))
    .sort((a, b) => (a.clientId ? 1 : 0) - (b.clientId ? 1 : 0) || nomClient(a.clientId).localeCompare(nomClient(b.clientId), 'fr') || a.nom.localeCompare(b.nom, 'fr'))
})

function ouvrirDuplication(w) {
  erreur.value = ''
  duplication.value = { workout: w, cible: '' }
}
async function dupliquer() {
  if (enCours.value) return
  erreur.value = ''
  enCours.value = true
  const { workout, cible } = duplication.value
  try {
    // Vers un client : le nom de l'ancien client est remplacé ; vers un modèle : on marque « (copie) ».
    const nom = cible ? renommerPourClient(workout.nom, workout.clientId ? nomClient(workout.clientId) : '', nomClient(cible)) : `${workout.nom} (copie)`
    const copie = dupliquerWorkout(workout, cible || null, uuid, nom)
    await data.workouts.creer(copie)
    duplication.value = null
    await charger()
    toast(`Séance copiée ${cible ? `pour ${nomClient(cible)}` : 'en modèle'}`, { action: 'Ouvrir', surAction: () => router.push(`/coach/seances/${copie.id}`) })
  } catch (e) {
    erreur.value = messageErreur(e)
  } finally {
    enCours.value = false
  }
}
async function archiver(w) {
  try {
    await data.workouts.archiver(w.id)
    workouts.value = workouts.value.filter((x) => x.id !== w.id)
    toast(`« ${w.nom} » archivée`, {
      action: 'Annuler',
      duree: 6000,
      surAction: async () => { await data.workouts.modifier(w.id, { archive: false }); await charger() }
    })
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}
</script>

<template>
  <div class="st-prog st-prog-l">
    <header class="st-entete">
      <div>
        <h1>Séances</h1>
        <p>Les modèles sont réutilisables : duplique-les vers un client.</p>
      </div>
      <div class="st-actions">
        <RouterLink to="/coach/programmes" class="st-btn st-btn--fantome">Programmes</RouterLink>
        <RouterLink to="/coach/seances/nouveau" class="st-btn st-btn--jaune"><IconeSt nom="plus" />Nouvelle séance</RouterLink>
      </div>
    </header>

    <div class="st-prog-l-outils">
      <label class="st-prog-l-cherche">
        <span class="st-sr">Chercher une séance</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        <input v-model="q" type="search" placeholder="Chercher (nom, client, exercice)" autocomplete="off" />
      </label>
      <Filtres v-model="filtreChoisi" :options="options" :multiple="false" etiquette="Afficher" />
    </div>

    <form v-if="duplication" class="st-bloc st-prog-l-dup" @submit.prevent="dupliquer">
      <h2>Dupliquer « {{ duplication.workout.nom }} »</h2>
      <div class="st-prog-l-dup-ligne">
        <label>Vers
          <select v-model="duplication.cible">
            <option value="">Modèle (aucun client)</option>
            <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
          </select>
        </label>
        <button class="st-btn st-btn--encre" type="submit" :disabled="enCours">{{ enCours ? 'Copie…' : 'Dupliquer' }}</button>
        <button class="st-btn" type="button" @click="duplication = null">Annuler</button>
      </div>
    </form>
    <p v-if="erreur" class="st-prog-l-erreur" role="alert">{{ erreur }}</p>

    <ul v-if="affiches.length" class="st-prog-l-grille">
      <li v-for="(w, i) in affiches" :key="w.id" class="st-prog-l-carte" :style="{ '--i': Math.min(i, 12) }">
        <div class="st-prog-l-bande" aria-hidden="true">
          <i v-for="m in teintesSeance(w, parId)" :key="m" :data-m="m" />
        </div>
        <RouterLink :to="`/coach/seances/${w.id}`" class="st-prog-l-lien">
          <h2>{{ w.nom }}</h2>
          <p class="st-prog-l-resume">{{ resume(w).libelle }}</p>
          <p class="st-prog-l-noms">{{ resume(w).noms.slice(0, 5).join(' · ') || 'Aucun exercice' }}</p>
        </RouterLink>
        <p v-if="teintesSeance(w, parId).length" class="st-prog-l-muscles">{{ teintesSeance(w, parId).map((m) => NOMS_MUSCLES[m]).join(', ') }}</p>
        <footer>
          <Puce v-if="w.clientId">{{ nomClient(w.clientId) }}</Puce>
          <span v-else class="st-puce st-prog-l-modele">Modèle</span>
          <span class="st-prog-l-espace" />
          <button type="button" class="st-btn st-btn--fantome st-prog-mini" @click="ouvrirDuplication(w)">Dupliquer<span class="st-sr"> {{ w.nom }}</span></button>
          <button type="button" class="st-btn st-btn--fantome st-prog-mini" @click="archiver(w)">Archiver<span class="st-sr"> {{ w.nom }}</span></button>
        </footer>
      </li>
    </ul>
    <div v-else-if="charge" class="st-prog-l-vide">
      <p><b>{{ q || filtre !== 'tous' ? 'Aucune séance ici.' : 'Pas encore de séance.' }}</b></p>
      <p>{{ q || filtre !== 'tous' ? 'Change le filtre ou la recherche.' : 'Crée un premier modèle : tu pourras le dupliquer vers chaque client.' }}</p>
      <RouterLink to="/coach/seances/nouveau" class="st-btn st-btn--jaune"><IconeSt nom="plus" />Nouvelle séance</RouterLink>
    </div>
  </div>
</template>

<style src="./liste.css"></style>
