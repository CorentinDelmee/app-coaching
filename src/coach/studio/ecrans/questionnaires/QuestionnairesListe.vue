<script setup>
// Studio — liste des questionnaires : cartes teintées par fréquence, filtre, archivage avec « Annuler ».
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import data from '../../../../data/index.js'
import { nomClient, rafraichir, messageErreur } from '../../../store.js'
import { toast } from '../../toast.js'
import Filtres from '../../Filtres.vue'
import Puce from '../../Puce.vue'
import IconeSt from '../../IconeSt.vue'
import { LIBELLE_FREQ, TEINTE_FREQ, pluriel } from './logique.js'
import './questionnaires.css'

const questionnaires = ref([])
const nbReponses = ref({})
const etatChargement = ref('charge') // charge | ok | erreur
const erreur = ref('')
const filtre = ref('')

async function charger() {
  etatChargement.value = 'charge'
  try {
    await rafraichir()
    questionnaires.value = await data.questionnaires.lister()
    const reps = await data.reponses.lister().catch(() => [])
    const n = {}
    for (const r of reps) n[r.questionnaireId] = (n[r.questionnaireId] || 0) + 1
    nbReponses.value = n
    etatChargement.value = 'ok'
  } catch (e) {
    erreur.value = messageErreur(e)
    etatChargement.value = 'erreur'
  }
}
onMounted(charger)

const options = computed(() => [
  { valeur: 'quotidien', texte: LIBELLE_FREQ.quotidien, muscle: TEINTE_FREQ.quotidien, n: questionnaires.value.filter((q) => q.frequence === 'quotidien').length },
  { valeur: 'hebdo', texte: LIBELLE_FREQ.hebdo, muscle: TEINTE_FREQ.hebdo, n: questionnaires.value.filter((q) => q.frequence === 'hebdo').length },
  { valeur: 'ponctuel', texte: LIBELLE_FREQ.ponctuel, muscle: TEINTE_FREQ.ponctuel, n: questionnaires.value.filter((q) => q.frequence === 'ponctuel').length }
])
const visibles = computed(() => questionnaires.value.filter((q) => !filtre.value || q.frequence === filtre.value))

async function archiver(q) {
  try {
    await data.questionnaires.archiver(q.id)
    questionnaires.value = questionnaires.value.filter((x) => x.id !== q.id)
    toast('Questionnaire archivé', { action: 'Annuler', surAction: () => restaurer(q) })
  } catch (e) {
    toast(messageErreur(e))
  }
}
async function restaurer(q) {
  try {
    await data.questionnaires.modifier(q.id, { archive: false })
    await charger()
  } catch (e) {
    toast(messageErreur(e))
  }
}
</script>

<template>
  <section class="st-qs" aria-labelledby="st-qs-titre">
    <header class="st-entete">
      <div>
        <h1 id="st-qs-titre">Questionnaires</h1>
        <p>Check-in quotidien, bilan hebdo, questionnaires ponctuels.</p>
      </div>
      <div class="st-actions">
        <RouterLink to="/coach/questionnaires/nouveau" class="st-btn st-btn--jaune"><IconeSt nom="plus" />Nouveau questionnaire</RouterLink>
      </div>
    </header>

    <div v-if="etatChargement === 'charge'" class="st-qs-grille" aria-busy="true" aria-label="Chargement">
      <div v-for="n in 3" :key="n" class="st-qs-carte st-qs-squelette" aria-hidden="true" />
    </div>

    <div v-else-if="etatChargement === 'erreur'" class="st-qs-etat st-qs-etat--erreur" role="alert">
      <strong>Impossible de charger les questionnaires.</strong>
      <span>{{ erreur }}</span>
      <button type="button" class="st-btn" @click="charger">Réessayer</button>
    </div>

    <div v-else-if="!questionnaires.length" class="st-qs-etat">
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><rect x="12" y="8" width="40" height="48" rx="8" fill="var(--m-gainage)" /><path d="M22 24h20M22 33h20M22 42h11" stroke="var(--m-gainage-i)" stroke-width="3" stroke-linecap="round" /></svg>
      <strong>Aucun questionnaire pour l’instant.</strong>
      <span>Crée un check-in du matin ou un bilan de fin de mois : tes clients y répondent depuis l’application.</span>
      <RouterLink to="/coach/questionnaires/nouveau" class="st-btn st-btn--jaune"><IconeSt nom="plus" />Créer le premier</RouterLink>
    </div>

    <template v-else>
      <Filtres v-model="filtre" :options="options" :multiple="false" etiquette="Filtrer par fréquence" />
      <ul v-if="visibles.length" class="st-qs-grille" role="list">
        <li v-for="(q, i) in visibles" :key="q.id" class="st-qs-carte" :data-m="TEINTE_FREQ[q.frequence]" :style="{ '--i': Math.min(i, 12) }">
          <div class="st-qs-haut" aria-hidden="true">
            <span class="st-qs-nombre">{{ q.questions.length }}</span>
            <span class="st-qs-unite">question{{ q.questions.length > 1 ? 's' : '' }}</span>
          </div>
          <div class="st-qs-corps">
            <h2 class="st-qs-nom"><RouterLink :to="`/coach/questionnaires/${q.id}`" class="st-qs-lien">{{ q.nom }}</RouterLink></h2>
            <p class="st-qs-meta">
              <Puce variante="muscle" :muscle="TEINTE_FREQ[q.frequence]">{{ LIBELLE_FREQ[q.frequence] }}</Puce>
              <Puce :variante="q.clientId ? 'propose' : 'neutre'" class="st-qs-dest">{{ q.clientId ? nomClient(q.clientId) : 'Tous les clients' }}</Puce>
            </p>
            <p class="st-qs-rep">{{ nbReponses[q.id] ? pluriel(nbReponses[q.id], 'réponse') + ' reçue' + (nbReponses[q.id] > 1 ? 's' : '') : 'Aucune réponse pour l’instant' }}</p>
          </div>
          <button type="button" class="st-btn st-btn--fantome st-qs-archive" :aria-label="`Archiver ${q.nom}`" @click="archiver(q)">Archiver</button>
        </li>
      </ul>
      <div v-else class="st-qs-etat">
        <strong>Aucun questionnaire {{ LIBELLE_FREQ[filtre].toLowerCase() }}.</strong>
        <button type="button" class="st-btn" @click="filtre = ''">Voir tous les questionnaires</button>
      </div>
    </template>
  </section>
</template>
