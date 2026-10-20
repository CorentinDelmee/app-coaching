<script setup>
// Liste des séances (modèles + séances de chaque client) ; duplication vers un autre client.
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import data from '../../data/index.js'
import { etat, nomClient, rafraichir, uuid, messageErreur } from '../store.js'
import { dupliquerWorkout, renommerPourClient, resumeWorkout } from '../logique.js'

const workouts = ref([])
const exercices = ref([])
const filtre = ref('tous') // 'tous' | 'modeles' | id client
const duplication = ref(null) // { workout, cible }
const erreur = ref('')

async function charger() {
  await rafraichir()
  workouts.value = await data.workouts.lister()
  exercices.value = await data.exercices.lister()
}
onMounted(charger)

const nomExercice = (id) => exercices.value.find((e) => e.id === id)?.nom || '?'
const affiches = computed(() =>
  workouts.value
    .filter((w) => filtre.value === 'tous' || (filtre.value === 'modeles' ? !w.clientId : w.clientId === filtre.value))
    .sort((a, b) => (a.clientId || '').localeCompare(b.clientId || '') || a.nom.localeCompare(b.nom, 'fr'))
)

async function dupliquer() {
  erreur.value = ''
  const { workout, cible } = duplication.value
  try {
    // Vers un client : le nom de l'ancien client est remplacé ; vers un modèle : on marque « (copie) ».
    const nom = cible ? renommerPourClient(workout.nom, workout.clientId ? nomClient(workout.clientId) : '', nomClient(cible)) : `${workout.nom} (copie)`
    await data.workouts.creer(dupliquerWorkout(workout, cible || null, uuid, nom))
    duplication.value = null
    await charger()
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}
async function archiver(w) {
  await data.workouts.archiver(w.id)
  await charger()
}
</script>

<template>
  <div>
    <div class="c-entete">
      <div>
        <h1>Séances</h1>
        <p class="c-sous">Les modèles sont réutilisables : duplique-les vers un client.</p>
      </div>
      <RouterLink to="/coach/seances/nouveau" class="c-btn c-principal">Nouvelle séance</RouterLink>
    </div>

    <div class="c-ligne" style="margin-bottom: 14px">
      <label class="c-moyen" style="width: 240px !important">Afficher
        <select v-model="filtre">
          <option value="tous">Toutes</option>
          <option value="modeles">Modèles</option>
          <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
        </select>
      </label>
    </div>

    <form v-if="duplication" class="c-carte" style="margin-bottom: 14px" @submit.prevent="dupliquer">
      <h2>Dupliquer « {{ duplication.workout.nom }} »</h2>
      <div class="c-ligne c-bas">
        <label style="min-width: 220px">Vers
          <select v-model="duplication.cible">
            <option value="">Modèle (aucun client)</option>
            <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
          </select>
        </label>
        <button class="c-btn c-principal" type="submit">Dupliquer</button>
        <button class="c-btn" type="button" @click="duplication = null">Annuler</button>
      </div>
      <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>
    </form>

    <div v-if="affiches.length" class="c-liste">
      <div v-for="w in affiches" :key="w.id" class="c-item">
        <RouterLink :to="`/coach/seances/${w.id}`" style="flex: 1; min-width: 0; color: inherit; text-decoration: none">
          <strong>{{ w.nom }}</strong>
          <div class="c-doux" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
            {{ resumeWorkout(w, nomExercice).libelle }} · {{ resumeWorkout(w, nomExercice).noms.slice(0, 4).join(', ') }}
          </div>
        </RouterLink>
        <span class="c-pastille" :class="{ 'c-accent': !w.clientId }">{{ w.clientId ? nomClient(w.clientId) : 'Modèle' }}</span>
        <button class="c-btn c-mini" @click="duplication = { workout: w, cible: '' }">Dupliquer</button>
        <button class="c-btn c-mini c-danger" @click="archiver(w)">Archiver</button>
      </div>
    </div>
    <p v-else class="c-vide">Aucune séance ici.</p>
  </div>
</template>
