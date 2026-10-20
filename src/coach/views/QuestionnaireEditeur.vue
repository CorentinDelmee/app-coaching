<script setup>
// Constructeur de questionnaire : curseur 0-10, choix, émojis, nombre, texte, photo.
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import data from '../../data/index.js'
import { FREQUENCES } from '../../domain/modele.js'
import { etat, rafraichir, uuid, messageErreur } from '../store.js'
import { TYPES_QUESTION_LIBELLES, cleDepuisLibelle, copie, deplacer, nouvelleQuestion } from '../logique.js'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const estNouveau = props.id === 'nouveau'
const q = ref(undefined)
const erreur = ref('')
const enregistre = ref(false)
const LIBELLE_FREQ = { quotidien: 'Quotidien', hebdo: 'Hebdomadaire', ponctuel: 'Ponctuel' }

onMounted(async () => {
  await rafraichir()
  if (estNouveau) q.value = { id: uuid(), clientId: null, nom: '', frequence: 'ponctuel', questions: [] }
  else {
    const lu = await data.questionnaires.lire(props.id)
    q.value = lu ? copie(lu) : null
    // Les questions déjà publiées gardent leur clé : renommer le texte ne casse pas les réponses existantes.
    q.value?.questions.forEach((x) => { x.cleFigee = true })
  }
})

const ajouter = (type) => { q.value.questions.push(nouvelleQuestion(type, q.value.questions)); enregistre.value = false }
const retirer = (i) => q.value.questions.splice(i, 1)
const bouger = (i, d) => { q.value.questions = deplacer(q.value.questions, i, d) }
const lignes = (qu) => (qu.choix || []).join('\n')
const majChoix = (qu, texte) => { qu.choix = texte.split('\n').map((s) => s.trim()).filter(Boolean) }
const majEmojis = (qu, texte) => { qu.choix = [...texte.replace(/\s+/g, '')].filter(Boolean) }

// Tant que le libellé est neuf, la clé le suit (elle sert aux courbes et alertes : « douleur », « poids »).
function majLibelle(qu, i, valeur) {
  qu.libelle = valeur
  if (!qu.cleFigee) {
    const autres = q.value.questions.filter((_, k) => k !== i).map((x) => x.cle)
    qu.cle = cleDepuisLibelle(valeur, autres)
  }
}

async function enregistrer() {
  erreur.value = ''
  const doc = copie(q.value)
  doc.nom = doc.nom.trim()
  doc.clientId = doc.clientId || null
  if (!doc.clientId) delete doc.clientId
  if (!doc.questions.length) return void (erreur.value = 'Ajoute au moins une question.')
  if (doc.questions.some((x) => !x.libelle.trim())) return void (erreur.value = 'Chaque question doit avoir un texte.')
  doc.questions.forEach((x) => { delete x.cleFigee })
  try {
    if (estNouveau) await data.questionnaires.creer(doc)
    else await data.questionnaires.modifier(doc.id, { ...doc, clientId: doc.clientId })
    enregistre.value = true
    if (estNouveau) router.replace(`/coach/questionnaires/${doc.id}`)
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}
</script>

<template>
  <div v-if="q">
    <RouterLink to="/coach/questionnaires" class="c-retour">← Questionnaires</RouterLink>
    <div class="c-entete">
      <h1>{{ estNouveau ? 'Nouveau questionnaire' : q.nom || 'Questionnaire' }}</h1>
      <div class="c-actions">
        <span v-if="enregistre" class="c-ok c-petit" role="status">Enregistré</span>
        <button class="c-btn c-principal" @click="enregistrer">Enregistrer</button>
      </div>
    </div>
    <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>

    <div class="c-carte" style="margin-bottom: 16px">
      <div class="c-ligne c-bas">
        <label style="flex: 2; min-width: 200px">Nom<input v-model="q.nom" placeholder="Bilan de fin de mois" /></label>
        <label class="c-moyen">Fréquence
          <select v-model="q.frequence"><option v-for="f in FREQUENCES" :key="f" :value="f">{{ LIBELLE_FREQ[f] }}</option></select>
        </label>
        <label style="flex: 1; min-width: 180px">Pour
          <select v-model="q.clientId">
            <option :value="null">Tous les clients</option>
            <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
          </select>
        </label>
      </div>
    </div>

    <div v-for="(qu, i) in q.questions" :key="i" class="c-bloc">
      <div class="c-bloc-tete">
        <span class="c-pastille c-accent">{{ i + 1 }}</span>
        <span class="c-pastille">{{ TYPES_QUESTION_LIBELLES[qu.type] }}</span>
        <span class="c-espace" />
        <button class="c-btn c-mini" :disabled="i === 0" aria-label="Monter la question" @click="bouger(i, -1)">↑</button>
        <button class="c-btn c-mini" :disabled="i === q.questions.length - 1" aria-label="Descendre la question" @click="bouger(i, 1)">↓</button>
        <button class="c-btn c-mini c-danger" @click="retirer(i)">Supprimer</button>
      </div>
      <label>Question<input :value="qu.libelle" placeholder="Comment as-tu dormi ?" @input="majLibelle(qu, i, $event.target.value)" /></label>

      <div v-if="qu.type === 'curseur'" class="c-ligne c-bas" style="margin-top: 10px">
        <label class="c-moyen">Libellé du 0<input v-model="qu.etiquettes[0]" placeholder="Très mal" /></label>
        <label class="c-moyen">Libellé du 10<input v-model="qu.etiquettes[1]" placeholder="Très bien" /></label>
      </div>
      <label v-if="qu.type === 'choixUnique' || qu.type === 'choixMultiple'" style="margin-top: 10px">Choix (un par ligne)
        <textarea :value="lignes(qu)" @input="majChoix(qu, $event.target.value)" />
      </label>
      <label v-if="qu.type === 'emojis'" style="margin-top: 10px">Émojis proposés (du moins bien au mieux)
        <input :value="(qu.choix || []).join(' ')" @input="majEmojis(qu, $event.target.value)" />
      </label>
      <div v-if="qu.type === 'nombre'" class="c-ligne c-bas" style="margin-top: 10px">
        <label class="c-court">Unité<input v-model="qu.unite" placeholder="kg" /></label>
        <label class="c-court">Min<input v-model.number="qu.min" type="number" /></label>
        <label class="c-court">Max<input v-model.number="qu.max" type="number" /></label>
        <label class="c-court">Pas<input v-model.number="qu.pas" type="number" step="any" min="0" /></label>
      </div>
      <label class="c-case" style="margin-top: 10px"><input v-model="qu.optionnel" type="checkbox" />Facultative</label>
    </div>

    <div class="c-ligne" style="margin-top: 8px">
      <button v-for="(libelle, type) in TYPES_QUESTION_LIBELLES" :key="type" class="c-btn c-mini" @click="ajouter(type)">+ {{ libelle }}</button>
    </div>
    <p v-if="!q.questions.length" class="c-vide" style="margin-top: 12px">Choisis un type de question pour commencer.</p>
  </div>
  <p v-else-if="q === null" class="c-vide">Questionnaire introuvable.</p>
</template>
