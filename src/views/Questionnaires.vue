<script setup>
// Liste des questionnaires (lot 7) : chaque ligne ouvre le questionnaire par la transition « élément partagé »
// (la page naît de la ligne touchée). Groupés chaque jour / chaque semaine / à l'occasion, « à faire » d'abord.
import { computed, nextTick, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icone from '../components/Icone.vue'
import { data } from '../data/index.js'
import { jourLocal } from '../domain/dates.js'
import { listeQuestionnaires } from '../domain/questionnaireUi.js'
import { brouillonsDuJour } from '../lib/brouillonQuestionnaire.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { installerRessort } from '../anim/transitions.js'
import { memoriserSource } from '../anim/passage.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'
import '../styles/questionnaires.css'

const route = useRoute()
const router = useRouter()
const { racine, couche, ouvrir, partir, retour } = usePageAnimee('/')

const erreur = ref('')
const charge = ref(false)
const groupes = shallowRef([])

const nbAFaire = computed(() => groupes.value.reduce((n, g) => n + g.lignes.filter((l) => !l.fait).length, 0))

onMounted(async () => {
  installerRessort()
  try {
    const user = await utilisateurCourant()
    if (!user) { erreur.value = 'Connectez-vous pour voir vos questionnaires.'; return }
    const [questionnaires, reponses] = await Promise.all([data.questionnaires.lister(), data.reponses.lister({ clientId: user.id })])
    const aujourdhui = jourLocal(horloge.now())
    groupes.value = listeQuestionnaires({
      questionnaires, reponses, clientId: user.id, aujourdhui,
      brouillons: brouillonsDuJour(user.id, questionnaires.map((q) => q.id), aujourdhui)
    })
    charge.value = true
  } catch (e) {
    erreur.value = 'Impossible de charger vos questionnaires. Réessayez.'
    console.error(e)
  }
  await nextTick()
  if (charge.value) ouvrir()
})

function aller(id, e) {
  memoriserSource(e.currentTarget)
  partir()
  router.push({ name: 'questionnaire', params: { id }, query: { retour: route.fullPath } })
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <div v-if="erreur" class="ecran-vide">
      <p>{{ erreur }}</p>
      <button class="gros" type="button" @click="router.replace('/')">Retour</button>
    </div>

    <section v-else-if="charge" ref="couche" class="page" hidden aria-label="Questionnaires">
      <div class="voile"></div>
      <div class="defile defile-prog">
        <div class="p-top avec-menu" data-c>
          <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
          <span class="sur-titre">Questionnaires</span>
        </div>
        <div class="p-entete" data-c>
          <p class="sur-titre">{{ nbAFaire ? `${nbAFaire} à remplir` : 'Tout est à jour' }}</p>
          <h1 class="titre-page">Vos<br>questionnaires</h1>
        </div>

        <div v-if="!nbAFaire && groupes.length" class="q-tout-bon" data-c>
          <Icone nom="coche" /><span>Rien à remplir pour le moment. Merci !</span>
        </div>

        <p v-if="!groupes.length" class="w-vide" data-c>Aucun questionnaire pour l'instant. Votre coach vous en proposera bientôt.</p>

        <section v-for="g in groupes" :key="g.frequence" class="q-groupe" data-c>
          <h3>{{ g.titre }}</h3>
          <button
            v-for="(l, i) in g.lignes" :key="l.questionnaire.id" type="button" class="ligne-w cliquable"
            :class="{ 'en-avant': !l.fait && i === 0 && g.frequence === 'quotidien', fait: l.fait }" @click="aller(l.questionnaire.id, $event)"
          >
            <span class="wn"><Icone v-if="l.fait" nom="coche" /><template v-else>{{ l.questionnaire.questions.length }}</template></span>
            <span class="wt">{{ l.questionnaire.nom }}<small>{{ l.texte }}</small></span>
            <span v-if="l.enCours" class="q-pastille">En cours</span>
            <span v-else class="fl"><Icone nom="fleche" /></span>
          </button>
        </section>
      </div>
    </section>
  </main>
</template>
