<script setup>
// Constructeur de séance par blocs : exercice, superset, circuit (+ format et paramètres).
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import data from '../../data/index.js'
import { FORMATS_CIRCUIT } from '../../domain/modele.js'
import { etat, rafraichir, uuid, messageErreur } from '../store.js'
import {
  copie, LIBELLES_FORMAT, PARAMS_FORMAT, deplacer, nouveauBloc, paramsAffiches, synchroniserExercicesCircuit
} from '../logique.js'
import ItemExercice from '../components/ItemExercice.vue'
import SelecteurExercice from '../components/SelecteurExercice.vue'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()

const exercices = ref([])
const workout = ref(undefined) // undefined = chargement, null = introuvable
const erreur = ref('')
const enregistre = ref(false)
const estNouveau = props.id === 'nouveau'

onMounted(async () => {
  await rafraichir()
  exercices.value = (await data.exercices.lister()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  if (estNouveau) workout.value = { id: uuid(), nom: '', clientId: route.query.client || null, consignes: '', blocs: [] }
  else {
    const w = await data.workouts.lire(props.id)
    workout.value = w ? { consignes: '', ...copie(w) } : null
  }
})

const nomExercice = (id) => exercices.value.find((e) => e.id === id)?.nom || '(exercice ?)'
const premier = computed(() => exercices.value[0]?.id || '')

const ajouter = (type) => { workout.value.blocs.push(nouveauBloc(type, uuid, premier.value)); enregistre.value = false }
const retirer = (i) => workout.value.blocs.splice(i, 1)
const bouger = (i, d) => { workout.value.blocs = deplacer(workout.value.blocs, i, d) }
const majBloc = (i, bloc) => { workout.value.blocs[i] = bloc }
const majSuperset = (i, j, item) => {
  const b = workout.value.blocs[i]
  b.exercices = b.exercices.map((x, k) => (k === j ? item : x))
}

// Circuit
function changerFormat(i, format) {
  const b = workout.value.blocs[i]
  workout.value.blocs[i] = synchroniserExercicesCircuit({ ...b, format, params: {} })
}
function majParam(i, cle, valeur) {
  const b = workout.value.blocs[i]
  b.params = { ...b.params, [cle]: valeur }
}
const ajouterExoCircuit = (i) => {
  const b = workout.value.blocs[i]
  b.exercices = [...b.exercices, { exerciceId: premier.value, reps: 10 }]
  workout.value.blocs[i] = synchroniserExercicesCircuit(b)
}
const retirerExoCircuit = (i, j) => {
  const b = workout.value.blocs[i]
  b.exercices = b.exercices.filter((_, k) => k !== j)
  workout.value.blocs[i] = synchroniserExercicesCircuit(b)
}
const majExoCircuit = (i, j, patch) => {
  const b = workout.value.blocs[i]
  b.exercices = b.exercices.map((x, k) => (k === j ? { ...x, ...patch } : x))
  workout.value.blocs[i] = synchroniserExercicesCircuit(b)
}
const valeurParam = (b, cle) => paramsAffiches(b.format, b.params)[cle]

async function enregistrer() {
  erreur.value = ''
  const w = { ...copie(workout.value), nom: workout.value.nom.trim(), clientId: workout.value.clientId || null }
  if (!w.consignes?.trim()) delete w.consignes
  for (const b of w.blocs) if (b.type === 'circuit' && !b.facultatif) delete b.facultatif
  if (!w.nom) return void (erreur.value = 'Donne un nom à la séance.')
  if (!w.blocs.length) return void (erreur.value = 'Ajoute au moins un bloc à la séance.')
  for (const [i, b] of w.blocs.entries()) {
    if (b.type === 'circuit' && !b.exercices.length) return void (erreur.value = `Le circuit (bloc ${i + 1}) doit contenir au moins un exercice.`)
    if (b.type === 'circuit' && b.exercices.some((x) => !x.exerciceId)) return void (erreur.value = `Chaque exercice du circuit (bloc ${i + 1}) doit être choisi.`)
    if (b.type === 'exercice' && !b.exerciceId) return void (erreur.value = 'Chaque bloc exercice doit avoir un exercice.')
    if (b.type === 'superset' && b.exercices.some((x) => !x.exerciceId)) return void (erreur.value = 'Chaque exercice du superset doit être choisi.')
  }
  try {
    if (estNouveau) await data.workouts.creer(w)
    else await data.workouts.modifier(w.id, w)
    enregistre.value = true
    if (estNouveau) router.replace(`/coach/seances/${w.id}`)
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}
</script>

<template>
  <div v-if="workout">
    <RouterLink to="/coach/seances" class="c-retour">← Séances</RouterLink>
    <div class="c-entete">
      <h1>{{ estNouveau ? 'Nouvelle séance' : workout.nom || 'Séance' }}</h1>
      <div class="c-actions">
        <span v-if="enregistre" class="c-ok c-petit" role="status">Enregistré</span>
        <button class="c-btn c-principal" @click="enregistrer">Enregistrer</button>
      </div>
    </div>
    <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>

    <div class="c-carte" style="margin-bottom: 16px">
      <div class="c-deux" style="margin-bottom: 12px">
        <label>Nom de la séance<input v-model="workout.nom" placeholder="Workout 1 — Bas du corps" /></label>
        <label>Pour
          <select v-model="workout.clientId">
            <option :value="null">Modèle (aucun client)</option>
            <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
          </select>
        </label>
      </div>
      <label>Consignes du coach<textarea v-model="workout.consignes" placeholder="Affichées au client en haut de la séance" /></label>
    </div>

    <div v-for="(b, i) in workout.blocs" :key="b.id" class="c-bloc" :class="`c-bloc-${b.type}`">
      <div class="c-bloc-tete">
        <span class="c-pastille c-accent">{{ i + 1 }}</span>
        <strong>{{ b.type === 'exercice' ? 'Exercice' : b.type === 'superset' ? 'Superset' : 'Circuit' }}</strong>
        <span class="c-espace" />
        <button class="c-btn c-mini" :disabled="i === 0" aria-label="Monter ce bloc" @click="bouger(i, -1)">↑</button>
        <button class="c-btn c-mini" :disabled="i === workout.blocs.length - 1" aria-label="Descendre ce bloc" @click="bouger(i, 1)">↓</button>
        <button class="c-btn c-mini c-danger" aria-label="Supprimer ce bloc" @click="retirer(i)">Supprimer</button>
      </div>

      <template v-if="b.type === 'exercice'">
        <ItemExercice :item="b" :exercices="exercices" @update:item="majBloc(i, $event)" />
        <div class="c-deux" style="margin-top: 10px">
          <label>Repos après chaque série (s)<input v-model.number="b.repos" type="number" min="0" step="5" /></label>
          <label>Consignes de l'exercice<input v-model="b.consignes" placeholder="Facultatif" /></label>
        </div>
      </template>

      <template v-else-if="b.type === 'superset'">
        <div v-for="(x, j) in b.exercices" :key="x.id" class="c-sous-bloc">
          <ItemExercice :item="x" :exercices="exercices" :titre="j === 0 ? 'Exercice A' : j === 1 ? 'Exercice B' : `Exercice ${j + 1}`" @update:item="majSuperset(i, j, $event)" />
        </div>
        <label class="c-court" style="margin-top: 10px">Repos (s)<input v-model.number="b.repos" type="number" min="0" step="5" /></label>
      </template>

      <template v-else>
        <div class="c-ligne c-bas" style="margin-bottom: 10px">
          <label style="flex: 1; min-width: 160px">Nom du circuit<input v-model="b.nom" placeholder="Finisher" /></label>
          <label class="c-moyen">Format
            <select :value="b.format" @change="changerFormat(i, $event.target.value)">
              <option v-for="f in FORMATS_CIRCUIT" :key="f" :value="f">{{ LIBELLES_FORMAT[f] }}</option>
            </select>
          </label>
          <label v-for="p in PARAMS_FORMAT[b.format]" :key="p.cle" class="c-court">{{ p.label }}{{ p.unite ? ` (${p.unite})` : '' }}
            <input type="number" min="0" :value="valeurParam(b, p.cle)" @input="majParam(i, p.cle, $event.target.value === '' ? 0 : Number($event.target.value))" />
          </label>
        </div>
        <label class="c-case" style="margin-bottom: 10px"><input v-model="b.facultatif" type="checkbox" />Facultatif : le client peut le passer (« Faire l'option » en fin de séance)</label>
        <div v-for="(x, j) in b.exercices" :key="j" class="c-ligne c-bas" style="margin-bottom: 8px">
          <div style="flex: 1; min-width: 200px"><SelecteurExercice :model-value="x.exerciceId" :exercices="exercices" label="Exercice" @update:model-value="majExoCircuit(i, j, { exerciceId: $event })" /></div>
          <label class="c-court">Reps<input type="number" min="0" :value="x.reps" @input="majExoCircuit(i, j, { reps: $event.target.value === '' ? undefined : Number($event.target.value) })" /></label>
          <button class="c-btn c-mini c-danger" :aria-label="`Retirer ${nomExercice(x.exerciceId)}`" @click="retirerExoCircuit(i, j)">✕</button>
        </div>
        <button class="c-btn c-mini" @click="ajouterExoCircuit(i)">+ Exercice dans le circuit</button>
      </template>
    </div>

    <div class="c-ligne" style="margin-top: 8px">
      <button class="c-btn" :disabled="!exercices.length" @click="ajouter('exercice')">+ Exercice</button>
      <button class="c-btn" :disabled="!exercices.length" @click="ajouter('superset')">+ Superset</button>
      <button class="c-btn" @click="ajouter('circuit')">+ Circuit</button>
    </div>
    <p v-if="!workout.blocs.length" class="c-vide" style="margin-top: 12px">Ajoute un premier bloc pour construire la séance.</p>
  </div>
  <p v-else-if="workout === null" class="c-vide">Séance introuvable.</p>
</template>
