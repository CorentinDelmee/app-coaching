<script setup>
// Studio — éditeur de questionnaire : sauvegarde automatique, 7 types de questions, aperçu vivant de chaque question.
// Création : le questionnaire est créé dès qu'il est complet (nom + au moins une question avec texte), puis modifié.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import data from '../../../../data/index.js'
import { FREQUENCES } from '../../../../domain/modele.js'
import { etat, rafraichir, uuid, messageErreur } from '../../../store.js'
import { TYPES_QUESTION_LIBELLES, cleDepuisLibelle, copie, deplacer, nouvelleQuestion } from '../../../logique.js'
import { useSauvegardeAuto } from '../../useSauvegardeAuto.js'
import { toast } from '../../toast.js'
import IndicateurSauvegarde from '../../IndicateurSauvegarde.vue'
import Puce from '../../Puce.vue'
import IconeSt from '../../IconeSt.vue'
import { LIBELLE_FREQ, TEINTE_TYPE, choixDepuisTexte, documentPropre, emojisDepuisTexte, probleme } from './logique.js'
import './questionnaires.css'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const q = ref(undefined) // undefined = chargement, null = introuvable
const erreurChargement = ref('')
const nbReponses = ref(0)
const brut = ref({}) // texte tapé tel quel (choix, émojis) : évite de réécrire le champ pendant la frappe
const existeRef = ref(props.id !== 'nouveau')
let existe = existeRef.value
let idDoc = existe ? props.id : uuid()
let pret = false
let uid = 0
const nouvelUid = () => ++uid

const sauve = useSauvegardeAuto(async (doc) => {
  if (!existe) {
    await data.questionnaires.creer(documentPropre(doc, { creation: true }))
    existe = true; existeRef.value = true
    router.replace(`/coach/questionnaires/${idDoc}`)
  } else {
    const propre = documentPropre(doc)
    await data.questionnaires.modifier(idDoc, { ...propre, clientId: propre.clientId })
  }
}, { delai: 600 })

async function charger() {
  q.value = undefined
  erreurChargement.value = ''
  try {
    await rafraichir()
    if (!existe) {
      q.value = { id: idDoc, clientId: null, nom: '', frequence: 'ponctuel', questions: [] }
    } else {
      const lu = await data.questionnaires.lire(props.id)
      q.value = lu ? copie(lu) : null
      // Les questions déjà publiées gardent leur clé : renommer le texte ne casse pas les réponses existantes.
      q.value?.questions.forEach((x) => { x.cleFigee = true; x._u = nouvelUid(); if (x.type === 'curseur') x.etiquettes ||= ['', ''] })
      const reps = await data.reponses.lister({ questionnaireId: props.id }).catch(() => [])
      nbReponses.value = reps.length
    }
    await nextTick()
    pret = true
  } catch (e) {
    erreurChargement.value = messageErreur(e)
    q.value = null
  }
}
onMounted(charger)
onBeforeUnmount(() => { sauve.arreter() })

const manque = computed(() => (q.value ? probleme(q.value) : null))
// Chaque modification d'un questionnaire complet est planifiée ; un questionnaire incomplet n'est pas écrit (message affiché).
watch(q, (v) => { if (pret && v && !probleme(v)) sauve.planifier(copie(v)) }, { deep: true })

const ajouter = (type) => {
  const nq = nouvelleQuestion(type, q.value.questions)
  nq._u = nouvelUid()
  q.value.questions.push(nq)
  nextTick(() => document.querySelector(`[data-u="${nq._u}"] .st-qs-champ-libelle`)?.focus())
}
function retirer(i) {
  const [x] = q.value.questions.splice(i, 1)
  toast('Question supprimée', { action: 'Annuler', surAction: () => q.value.questions.splice(Math.min(i, q.value.questions.length), 0, x) })
  // Le bouton supprimé disparaît : le focus passe à la question voisine, sinon à « Annuler » du toast.
  nextTick(() => {
    const voisin = q.value.questions[Math.min(i, q.value.questions.length - 1)]
    const cible = voisin && document.querySelector(`[data-u="${voisin._u}"] .st-qs-suppr`)
    ;(cible || document.querySelector('.st-toast.is-vu button'))?.focus()
  })
}
function bouger(i, d) {
  const u = q.value.questions[i]._u
  q.value.questions = deplacer(q.value.questions, i, d)
  nextTick(() => {
    const bloc = document.querySelector(`[data-u="${u}"]`)
    const cible = bloc?.querySelector(`[data-act="${d < 0 ? 'haut' : 'bas'}"]:not(:disabled)`) || bloc?.querySelector(`[data-act="${d < 0 ? 'bas' : 'haut'}"]:not(:disabled)`)
    cible?.focus()
  })
}
const lignes = (qu) => brut.value[qu._u] ?? (qu.choix || []).join('\n')
const majChoix = (qu, texte) => { brut.value[qu._u] = texte; qu.choix = choixDepuisTexte(texte) }
const emojisTexte = (qu) => brut.value[qu._u] ?? (qu.choix || []).join(' ')
const majEmojis = (qu, texte) => { brut.value[qu._u] = texte; qu.choix = emojisDepuisTexte(texte) }

// Tant que le libellé est neuf, la clé le suit (elle sert aux courbes et alertes : « douleur », « poids »).
function majLibelle(qu, i, valeur) {
  qu.libelle = valeur
  if (!qu.cleFigee) {
    const autres = q.value.questions.filter((_, k) => k !== i).map((x) => x.cle)
    qu.cle = cleDepuisLibelle(valeur, autres)
  }
}

async function archiver() {
  await sauve.maintenant()
  if (!existe) return router.push('/coach/questionnaires')
  try {
    await data.questionnaires.archiver(idDoc)
    router.push('/coach/questionnaires')
    toast('Questionnaire archivé', { action: 'Annuler', surAction: () => data.questionnaires.modifier(idDoc, { archive: false }) })
  } catch (e) {
    toast(messageErreur(e))
  }
}
const apercuCurseur = (qu) => qu.etiquettes || ['', '']
</script>

<template>
  <section v-if="q" class="st-qs st-qs-ed" aria-labelledby="st-qs-ed-titre">
    <RouterLink to="/coach/questionnaires" class="st-qs-retour" @click="sauve.maintenant()">← Questionnaires</RouterLink>

    <header class="st-qs-ed-tete">
      <h1 id="st-qs-ed-titre" class="st-sr">{{ q.nom || 'Nouveau questionnaire' }}</h1>
      <label class="st-qs-nomchamp">
        <span class="st-qs-etiq">Nom du questionnaire</span>
        <input v-model="q.nom" class="st-qs-titre-input" placeholder="Bilan de fin de mois" maxlength="120" autocomplete="off" />
      </label>
      <IndicateurSauvegarde class="st-qs-sauve" :etat="sauve.etat.value" @reessayer="sauve.reessayer" />
    </header>

    <p v-if="manque" class="st-qs-note" role="status">{{ manque }} <span>Rien n’est écrit tant que ce n’est pas complet.</span></p>
    <p v-if="nbReponses" class="st-qs-note st-qs-note--info">{{ nbReponses }} réponse{{ nbReponses > 1 ? 's' : '' }} déjà reçue{{ nbReponses > 1 ? 's' : '' }} : les questions existantes gardent leur clé, tu peux reformuler leur texte sans perdre l’historique.</p>

    <div class="st-bloc st-qs-reglages">
      <fieldset class="st-qs-freq">
        <legend class="st-qs-etiq">Fréquence</legend>
        <label v-for="f in FREQUENCES" :key="f" class="st-qs-seg" :class="{ 'is-on': q.frequence === f }">
          <input v-model="q.frequence" type="radio" name="st-qs-freq" :value="f" class="st-sr" />{{ LIBELLE_FREQ[f] }}
        </label>
      </fieldset>
      <label class="st-qs-pour">
        <span class="st-qs-etiq">Envoyé à</span>
        <select v-model="q.clientId" class="st-qs-champ">
          <option :value="null">Tous les clients</option>
          <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
        </select>
      </label>
    </div>

    <ol class="st-qs-questions" role="list">
      <li v-for="(qu, i) in q.questions" :key="qu._u" class="st-qs-q" :data-m="TEINTE_TYPE[qu.type]" :data-u="qu._u">
        <div class="st-qs-q-tete">
          <span class="st-qs-num" aria-hidden="true">{{ i + 1 }}</span>
          <Puce variante="muscle" :muscle="TEINTE_TYPE[qu.type]">{{ TYPES_QUESTION_LIBELLES[qu.type] }}</Puce>
          <span class="st-qs-espace" />
          <button type="button" class="st-btn st-btn--rond st-btn--fantome" data-act="haut" :disabled="i === 0" :aria-label="`Monter la question ${i + 1}`" @click="bouger(i, -1)"><IconeSt nom="haut" /></button>
          <button type="button" class="st-btn st-btn--rond st-btn--fantome" data-act="bas" :disabled="i === q.questions.length - 1" :aria-label="`Descendre la question ${i + 1}`" @click="bouger(i, 1)"><IconeSt nom="bas" /></button>
          <button type="button" class="st-btn st-btn--rond st-btn--fantome st-qs-suppr" :aria-label="`Supprimer la question ${i + 1}`" @click="retirer(i)"><IconeSt nom="fermer" /></button>
        </div>
        <label class="st-qs-lab"><span class="st-qs-etiq">Question</span>
          <input :value="qu.libelle" class="st-qs-champ st-qs-champ-libelle" placeholder="Comment avez-vous dormi ?" autocomplete="off" @input="majLibelle(qu, i, $event.target.value)" />
        </label>

        <div v-if="qu.type === 'curseur'" class="st-qs-ligne">
          <label class="st-qs-lab"><span class="st-qs-etiq">Libellé du 0</span><input v-model="qu.etiquettes[0]" class="st-qs-champ" placeholder="Très mal" /></label>
          <label class="st-qs-lab"><span class="st-qs-etiq">Libellé du 10</span><input v-model="qu.etiquettes[1]" class="st-qs-champ" placeholder="Très bien" /></label>
        </div>
        <label v-if="qu.type === 'choixUnique' || qu.type === 'choixMultiple'" class="st-qs-lab"><span class="st-qs-etiq">Choix (un par ligne)</span>
          <textarea :value="lignes(qu)" class="st-qs-champ" rows="4" @input="majChoix(qu, $event.target.value)" />
        </label>
        <label v-if="qu.type === 'emojis'" class="st-qs-lab"><span class="st-qs-etiq">Émojis proposés (du moins bien au mieux)</span>
          <input :value="emojisTexte(qu)" class="st-qs-champ" @input="majEmojis(qu, $event.target.value)" />
        </label>
        <div v-if="qu.type === 'nombre'" class="st-qs-ligne st-qs-ligne--4">
          <label class="st-qs-lab"><span class="st-qs-etiq">Unité</span><input v-model="qu.unite" class="st-qs-champ" placeholder="kg" /></label>
          <label class="st-qs-lab"><span class="st-qs-etiq">Min</span><input v-model.number="qu.min" class="st-qs-champ" type="number" /></label>
          <label class="st-qs-lab"><span class="st-qs-etiq">Max</span><input v-model.number="qu.max" class="st-qs-champ" type="number" /></label>
          <label class="st-qs-lab"><span class="st-qs-etiq">Pas</span><input v-model.number="qu.pas" class="st-qs-champ" type="number" step="any" min="0" /></label>
        </div>

        <!-- Aperçu : ce que verra le client (décoratif) -->
        <div class="st-qs-apercu" aria-hidden="true">
          <template v-if="qu.type === 'curseur'">
            <span class="st-qs-rail"><i /></span>
            <span class="st-qs-bouts"><span>{{ apercuCurseur(qu)[0] || '0' }}</span><span>{{ apercuCurseur(qu)[1] || '10' }}</span></span>
          </template>
          <span v-else-if="qu.type === 'emojis'" class="st-qs-emo"><b v-for="(e, k) in qu.choix" :key="k">{{ e }}</b></span>
          <span v-else-if="qu.type === 'choixUnique' || qu.type === 'choixMultiple'" class="st-qs-jetons"><b v-for="(c, k) in qu.choix" :key="k" :class="{ 'st-qs-carre': qu.type === 'choixMultiple' }">{{ c }}</b></span>
          <span v-else-if="qu.type === 'nombre'" class="st-qs-nb">{{ qu.min }} – {{ qu.max }} {{ qu.unite }}</span>
          <span v-else-if="qu.type === 'texte'" class="st-qs-nb">Réponse libre…</span>
          <span v-else class="st-qs-nb">Photo à joindre</span>
        </div>

        <label class="st-qs-case"><input v-model="qu.optionnel" type="checkbox" /><span>Facultative</span></label>
      </li>
    </ol>

    <div class="st-qs-ajout" :class="{ 'st-qs-ajout--vide': !q.questions.length }">
      <p v-if="!q.questions.length" class="st-qs-vide">Choisis un type de question pour commencer.</p>
      <p v-else class="st-qs-etiq">Ajouter une question</p>
      <div class="st-qs-types" role="group" aria-label="Ajouter une question">
        <button v-for="(libelle, type) in TYPES_QUESTION_LIBELLES" :key="type" type="button" class="st-qs-type" :data-m="TEINTE_TYPE[type]" @click="ajouter(type)">
          <IconeSt nom="plus" />{{ libelle }}
        </button>
      </div>
    </div>

    <footer class="st-qs-pied">
      <button v-if="existeRef" type="button" class="st-btn st-btn--fantome st-qs-archiver" @click="archiver">Archiver ce questionnaire</button>
    </footer>
  </section>

  <section v-else-if="q === null" class="st-qs">
    <RouterLink to="/coach/questionnaires" class="st-qs-retour">← Questionnaires</RouterLink>
    <div class="st-qs-etat" :class="{ 'st-qs-etat--erreur': erreurChargement }" :role="erreurChargement ? 'alert' : undefined">
      <strong>{{ erreurChargement ? 'Impossible de charger ce questionnaire.' : 'Questionnaire introuvable.' }}</strong>
      <span v-if="erreurChargement">{{ erreurChargement }}</span>
      <button v-if="erreurChargement" type="button" class="st-btn" @click="charger">Réessayer</button>
      <RouterLink v-else to="/coach/questionnaires" class="st-btn">Retour à la liste</RouterLink>
    </div>
  </section>
  <section v-else class="st-qs" aria-busy="true"><div class="st-qs-carte st-qs-squelette" aria-hidden="true" style="height: 160px" /></section>
</template>
