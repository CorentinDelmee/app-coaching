<script setup>
// Bibliothèque d'exercices : recherche, catégories, lien vidéo, création / édition.
import { computed, onMounted, ref } from 'vue'
import data from '../../data/index.js'
import { CATEGORIES, libelleCategorie } from '../logique.js'
import { uuid, messageErreur } from '../store.js'

const exercices = ref([])
const recherche = ref('')
const categorie = ref('')
const edition = ref(null) // copie de travail
const erreur = ref('')

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const filtres = computed(() =>
  exercices.value
    .filter((e) => (!categorie.value || e.categories.includes(categorie.value)) && norm(e.nom).includes(norm(recherche.value)))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
)
const toutesCategories = computed(() => [...new Set([...Object.keys(CATEGORIES), ...exercices.value.flatMap((e) => e.categories)])])

async function charger() { exercices.value = await data.exercices.lister() }
onMounted(charger)

const nouveau = () => { erreur.value = ''; edition.value = { id: null, nom: '', description: '', lienVideo: '', categories: [] } }
const modifier = (e) => { erreur.value = ''; edition.value = { description: '', lienVideo: '', ...e, categories: [...e.categories] } }
const basculer = (c) => {
  const cats = edition.value.categories
  edition.value.categories = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c]
}

async function enregistrer() {
  erreur.value = ''
  const e = edition.value
  const obj = { nom: e.nom.trim(), categories: [...e.categories] }
  if (e.description?.trim()) obj.description = e.description.trim()
  if (e.lienVideo?.trim()) obj.lienVideo = e.lienVideo.trim()
  if (obj.lienVideo && !/^https?:\/\//i.test(obj.lienVideo)) { erreur.value = 'Le lien vidéo doit commencer par http:// ou https://'; return }
  try {
    if (e.id) await data.exercices.modifier(e.id, { description: undefined, lienVideo: undefined, ...obj })
    else await data.exercices.creer({ id: uuid(), ...obj })
    edition.value = null
    await charger()
  } catch (err) {
    erreur.value = messageErreur(err)
  }
}

async function archiver() {
  await data.exercices.archiver(edition.value.id)
  edition.value = null
  await charger()
}
</script>

<template>
  <div>
    <div class="c-entete">
      <div>
        <h1>Exercices</h1>
        <p class="c-sous">{{ exercices.length }} exercices dans la bibliothèque</p>
      </div>
      <button class="c-btn c-principal" @click="nouveau">Nouvel exercice</button>
    </div>

    <form v-if="edition" class="c-carte" style="margin-bottom: 16px" @submit.prevent="enregistrer">
      <h2>{{ edition.id ? 'Modifier l\'exercice' : 'Nouvel exercice' }}</h2>
      <div class="c-deux" style="margin-bottom: 12px">
        <label>Nom<input v-model="edition.nom" required /></label>
        <label>Lien vidéo<input v-model="edition.lienVideo" type="url" placeholder="https://…" /></label>
      </div>
      <label style="margin-bottom: 12px">Description<textarea v-model="edition.description" /></label>
      <div class="c-champs" role="group" aria-label="Catégories">
        <button v-for="c in toutesCategories" :key="c" type="button" class="c-champ" :aria-pressed="edition.categories.includes(c)" @click="basculer(c)">{{ libelleCategorie(c) }}</button>
      </div>
      <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>
      <div class="c-ligne">
        <button class="c-btn c-principal" type="submit">Enregistrer</button>
        <button class="c-btn" type="button" @click="edition = null">Annuler</button>
        <span class="c-espace" />
        <button v-if="edition.id" class="c-btn c-danger" type="button" @click="archiver">Archiver</button>
      </div>
    </form>

    <div class="c-ligne" style="margin-bottom: 12px">
      <input v-model="recherche" type="search" placeholder="Rechercher un exercice…" aria-label="Rechercher un exercice" style="max-width: 340px" />
    </div>
    <div class="c-filtres">
      <button class="c-filtre" :aria-pressed="!categorie" @click="categorie = ''">Toutes</button>
      <button v-for="c in toutesCategories" :key="c" class="c-filtre" :aria-pressed="categorie === c" @click="categorie = c">{{ libelleCategorie(c) }}</button>
    </div>

    <div v-if="filtres.length" class="c-liste">
      <button v-for="e in filtres" :key="e.id" class="c-item" style="background: none; border: 0; border-top: 1px solid var(--filet); font: inherit; color: inherit; text-align: left; cursor: pointer; width: 100%" @click="modifier(e)">
        <div style="flex: 1; min-width: 0">
          <strong>{{ e.nom }}</strong>
          <div class="c-doux" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ e.description || 'Pas de description' }}</div>
        </div>
        <span v-for="c in e.categories" :key="c" class="c-pastille">{{ libelleCategorie(c) }}</span>
        <span v-if="e.lienVideo" class="c-pastille c-bien">Vidéo</span>
      </button>
    </div>
    <p v-else class="c-vide">Aucun exercice ne correspond.</p>
  </div>
</template>
