<script setup>
// Éditeur de programme : mode répété ou par semaine, jours fixés optionnels.
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import data from '../../data/index.js'
import { jourLocal, lundiDe } from '../../domain/dates.js'
import { etat, maintenant, rafraichir, uuid, messageErreur } from '../store.js'
import { JOURS_COURTS, copie, retirerWorkoutDuProgramme } from '../logique.js'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const estNouveau = props.id === 'nouveau'

const programme = ref(undefined)
const workouts = ref([]) // séances du client choisi
const tous = ref([])
const erreur = ref('')
const enregistre = ref(false)

onMounted(async () => {
  await rafraichir()
  tous.value = await data.workouts.lister()
  if (estNouveau) {
    programme.value = {
      id: uuid(), clientId: route.query.client || etat.clients[0]?.id || '', nom: '', mode: 'repete',
      debut: lundiDe(jourLocal(maintenant())), workouts: [], joursFixes: {}
    }
  } else {
    const p = await data.programmes.lire(props.id)
    programme.value = p ? { joursFixes: {}, ...copie(p) } : null
  }
})

const seancesDuClient = computed(() => tous.value.filter((w) => w.clientId === programme.value?.clientId))
const nomWorkout = (id) => tous.value.find((w) => w.id === id)?.nom || '(séance supprimée)'
const dejaDans = (liste) => seancesDuClient.value.filter((w) => !liste.includes(w.id))

// Changer de mode convertit la structure (répété <-> par semaine) sans perdre les séances.
function changerMode(mode) {
  const p = programme.value
  if (mode === p.mode) return
  if (mode === 'parSemaine') {
    p.semaines = [[...p.workouts], ...(p.nbSemaines ? Array.from({ length: p.nbSemaines - 1 }, () => [...p.workouts]) : [])]
    delete p.workouts
    delete p.nbSemaines
  } else {
    p.workouts = [...new Set(p.semaines.flat())]
    delete p.semaines
  }
  p.mode = mode
}

watch(() => programme.value?.clientId, (n, o) => {
  // Changer de client vide la sélection : les séances appartiennent à un client.
  if (o === undefined || !programme.value) return
  const p = programme.value
  if (p.mode === 'repete') p.workouts = []
  else p.semaines = p.semaines.map(() => [])
  p.joursFixes = {}
})

const ajouter = (liste, id) => { if (id) liste.push(id) }
function retirer(id, semaine) { programme.value = retirerWorkoutDuProgramme(programme.value, id, semaine) }
const ajouterSemaine = () => programme.value.semaines.push([])
const retirerSemaine = (i) => programme.value.semaines.splice(i, 1)
const copierSemaine = (i) => programme.value.semaines.splice(i + 1, 0, [...programme.value.semaines[i]])

const idsUtilises = computed(() => (programme.value.mode === 'repete' ? programme.value.workouts : [...new Set(programme.value.semaines.flat())]))
function setJour(id, v) {
  const j = { ...programme.value.joursFixes }
  if (v === '') delete j[id]
  else j[id] = Number(v)
  programme.value.joursFixes = j
}

async function enregistrer() {
  erreur.value = ''
  const p = { ...copie(programme.value), nom: programme.value.nom.trim() }
  if (!p.clientId) return void (erreur.value = 'Choisis un client.')
  if (p.mode === 'repete') {
    if (!p.nbSemaines) delete p.nbSemaines
  } else delete p.nbSemaines
  if (!Object.keys(p.joursFixes || {}).length) delete p.joursFixes
  try {
    if (estNouveau) await data.programmes.creer(p)
    else await data.programmes.modifier(p.id, { ...p, nbSemaines: p.nbSemaines, workouts: p.workouts, semaines: p.semaines, joursFixes: p.joursFixes })
    enregistre.value = true
    if (estNouveau) router.replace(`/coach/programmes/${p.id}`)
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}
</script>

<template>
  <div v-if="programme">
    <RouterLink to="/coach/programmes" class="c-retour">← Programmes</RouterLink>
    <div class="c-entete">
      <h1>{{ estNouveau ? 'Nouveau programme' : programme.nom || 'Programme' }}</h1>
      <div class="c-actions">
        <span v-if="enregistre" class="c-ok c-petit" role="status">Enregistré</span>
        <button class="c-btn c-principal" @click="enregistrer">Enregistrer</button>
      </div>
    </div>
    <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>

    <div class="c-carte" style="margin-bottom: 16px">
      <div class="c-deux" style="margin-bottom: 12px">
        <label>Nom du programme<input v-model="programme.nom" placeholder="Programme Fabien Vincent" /></label>
        <label>Client
          <select v-model="programme.clientId" :disabled="!estNouveau">
            <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
          </select>
        </label>
      </div>
      <div class="c-ligne c-bas">
        <label style="min-width: 230px">Mode
          <select :value="programme.mode" @change="changerMode($event.target.value)">
            <option value="repete">Répété chaque semaine</option>
            <option value="parSemaine">Différent chaque semaine</option>
          </select>
        </label>
        <label class="c-moyen">Début (lundi)<input v-model="programme.debut" type="date" /></label>
        <label v-if="programme.mode === 'repete'" class="c-court">Semaines<input v-model.number="programme.nbSemaines" type="number" min="1" placeholder="∞" /></label>
      </div>
      <p class="c-doux c-petit" style="margin-bottom: 0">
        {{ programme.mode === 'repete' ? 'Mêmes séances chaque semaine ; le client progresse grâce au pré-remplissage. Laisse « semaines » vide pour ne pas fixer de fin.' : 'Choisis les séances de chaque semaine.' }}
      </p>
    </div>

    <div v-if="!seancesDuClient.length" class="c-info" style="color: var(--alerte); border-color: var(--alerte)">
      Ce client n'a pas encore de séance. <RouterLink :to="`/coach/seances/nouveau?client=${programme.clientId}`" style="color: inherit">Créer une séance</RouterLink> ou dupliquer un modèle depuis « Séances ».
    </div>

    <div v-if="programme.mode === 'repete'" class="c-carte">
      <h2>Séances de la semaine</h2>
      <div v-for="id in programme.workouts" :key="id" class="c-item" style="padding-left: 0; padding-right: 0">
        <strong style="flex: 1">{{ nomWorkout(id) }}</strong>
        <button class="c-btn c-mini c-danger" @click="retirer(id)">Retirer</button>
      </div>
      <select v-if="dejaDans(programme.workouts).length" aria-label="Ajouter une séance" style="margin-top: 10px; max-width: 320px" @change="ajouter(programme.workouts, $event.target.value); $event.target.value = ''">
        <option value="">+ Ajouter une séance…</option>
        <option v-for="w in dejaDans(programme.workouts)" :key="w.id" :value="w.id">{{ w.nom }}</option>
      </select>
    </div>

    <template v-else>
      <div v-for="(sem, i) in programme.semaines" :key="i" class="c-carte">
        <div class="c-ligne" style="margin-bottom: 8px">
          <h2 style="margin: 0; flex: 1">Semaine {{ i + 1 }}</h2>
          <button class="c-btn c-mini" @click="copierSemaine(i)">Dupliquer la semaine</button>
          <button class="c-btn c-mini c-danger" @click="retirerSemaine(i)">Supprimer</button>
        </div>
        <div v-for="id in sem" :key="id" class="c-item" style="padding-left: 0; padding-right: 0">
          <strong style="flex: 1">{{ nomWorkout(id) }}</strong>
          <button class="c-btn c-mini c-danger" @click="retirer(id, i)">Retirer</button>
        </div>
        <select v-if="dejaDans(sem).length" aria-label="Ajouter une séance" style="margin-top: 10px; max-width: 320px" @change="ajouter(sem, $event.target.value); $event.target.value = ''">
          <option value="">+ Ajouter une séance…</option>
          <option v-for="w in dejaDans(sem)" :key="w.id" :value="w.id">{{ w.nom }}</option>
        </select>
      </div>
      <button class="c-btn" style="margin-top: 12px" @click="ajouterSemaine">+ Semaine</button>
    </template>

    <div v-if="idsUtilises.length" class="c-carte" style="margin-top: 16px">
      <h2>Jours fixés (facultatif)</h2>
      <p class="c-doux c-petit" style="margin-top: 0">Sans jour fixé, le client place lui-même la séance en la validant.</p>
      <div v-for="id in idsUtilises" :key="id" class="c-ligne" style="margin-bottom: 6px">
        <span style="flex: 1">{{ nomWorkout(id) }}</span>
        <select class="c-moyen" :value="programme.joursFixes?.[id] ?? ''" :aria-label="`Jour fixé pour ${nomWorkout(id)}`" @change="setJour(id, $event.target.value)">
          <option value="">Au choix du client</option>
          <option v-for="(j, k) in JOURS_COURTS" :key="k" :value="k">{{ j }}</option>
        </select>
      </div>
    </div>
  </div>
  <p v-else-if="programme === null" class="c-vide">Programme introuvable.</p>
</template>
