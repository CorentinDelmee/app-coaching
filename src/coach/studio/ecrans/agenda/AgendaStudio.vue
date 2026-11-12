<script setup>
// Agenda Google (Studio) : dernière synchro et son bilan, rendez-vous attribués par jour, « à attribuer » (nom inconnu,
// prénom partagé, sans nom) avec choix du ou des clients. Avec le serveur, chaque « Coaching <client> » devient une séance
// de coaching en base (fiche client, appli du client) ; en démo, les alertes du faux agenda restent affichées.
import { computed, onMounted, reactive, ref } from 'vue'
import data from '../../../../data/index.js'
import { etat as etatCoach, maintenant, messageErreur, nomClient, rafraichir } from '../../../store.js'
import IconeSt from '../../IconeSt.vue'
import Puce from '../../Puce.vue'
import { CONSEIL_ALERTE, LIB_ALERTE, RAISON_GARDEE, grouperEvenements, libelleBilan, libelleHeureEvt, libelleSynchro, partiesDate } from './agendaOutils.js'
import './ecran.css'

const PAQUET = 8 // jours affichés avant « Voir la suite »
const agenda = ref({ derniereSynchro: null, bilan: null, evenements: [], alertes: [] })
const serveur = data.mode !== 'local' // attribution « à attribuer » : seulement avec le serveur
const groupes = ref([])
const choix = reactive({}) // clé du titre -> ids de clients cochés
const ajout = reactive({}) // clé du titre -> id choisi dans « Autre client »
const enCours = ref('') // clé du titre en cours d'attribution
const autorisation = computed(() => agenda.value.bilan?.ok === false && agenda.value.bilan.erreur === 'google_lecture_non_autorisee')
const chargement = ref(true)
const synchro = ref(false)
const message = ref('')
const erreur = ref('')
const nbJours = ref(PAQUET)

const aVenir = computed(() => agenda.value.evenements.filter((e) => e.debutMs >= maintenant() - 3600000))
const attribuees = computed(() => aVenir.value.filter((e) => e.statut === 'attribue'))
const jours = computed(() => grouperEvenements(attribuees.value))
const joursVisibles = computed(() => jours.value.slice(0, nbJours.value))
const nomDe = (e) => (e.clientIds?.length > 1 ? e.clientNom : nomClient(e.clientId) !== 'Modèle' ? nomClient(e.clientId) : e.clientNom || 'Client')

// Cases proposées pour un titre : candidats (y compris archivés), puis les clients ajoutés à la main.
function options(g) {
  const liste = [...g.candidats]
  for (const id of choix[g.cle] ?? []) if (!liste.some((c) => c.id === id)) liste.push({ id, nom: nomClient(id) })
  return liste
}
function ajouterClient(g) {
  const id = ajout[g.cle]
  if (!choix[g.cle]) choix[g.cle] = []
  if (id && !choix[g.cle].includes(id)) choix[g.cle].push(id)
  ajout[g.cle] = ''
}
const periode = (g) => (g.premier === g.dernier ? partiesDate(g.premier).court : `du ${partiesDate(g.premier).court} au ${partiesDate(g.dernier).court}`)

async function attribuer(g) {
  enCours.value = g.cle
  message.value = ''
  erreur.value = ''
  try {
    const b = await data.agenda.attribuer(g.titre, choix[g.cle])
    message.value = `« ${g.titre} » attribué : ${b.crees || 0} séance(s) ajoutée(s). Les prochains rendez-vous de ce titre suivront.`
    delete choix[g.cle]
    await rafraichir() // compteurs du menu (alertes de l'agenda)
    await charger()
  } catch (e) {
    erreur.value = messageErreur(e)
  } finally {
    enCours.value = ''
  }
}

async function charger() {
  try {
    agenda.value = await data.agenda.etat()
    if (serveur) {
      const liste = await data.agenda.aAttribuer()
      for (const g of liste) { if (!choix[g.cle]) choix[g.cle] = []; if (!ajout[g.cle]) ajout[g.cle] = '' } // avant l'affichage : « Choisir… » sélectionné
      groupes.value = liste
    }
    erreur.value = ''
  } catch (e) {
    erreur.value = messageErreur(e)
  } finally {
    chargement.value = false
  }
}

// Démo (faux agenda) : bilan d'événements ajoutés / modifiés / supprimés.
function libelleDemo(b) {
  const parties = [b.ajoutes && `${b.ajoutes} ajoutée(s)`, b.modifies && `${b.modifies} modifiée(s)`, b.supprimes && `${b.supprimes} supprimée(s)`].filter(Boolean)
  return parties.length ? `Synchronisé : ${parties.join(', ')}.` : 'Synchronisé : rien de nouveau.'
}

async function synchroniser() {
  synchro.value = true
  message.value = ''
  erreur.value = ''
  try {
    const b = await data.agenda.synchroniser()
    message.value = serveur ? libelleBilan(b) : libelleDemo(b)
    await charger()
    await rafraichir()
  } catch (e) {
    if (e?.code === 'GOOGLE_AUTORISATION') await charger() // le bandeau « Autorisation Google à renouveler » suffit
    else erreur.value = messageErreur(e)
  } finally {
    synchro.value = false
  }
}

onMounted(async () => { await rafraichir(); await charger() })
</script>

<template>
  <div class="st-ag">
    <header class="st-entete">
      <div>
        <h1>Agenda</h1>
        <p>
          Crée « Coaching Prénom » dans Google Agenda : le rendez-vous devient une séance de coaching (fiche du client et son appli).
          <Puce v-if="data.mode === 'local'" variante="propose">Démo : faux agenda</Puce>
        </p>
      </div>
      <div class="st-actions st-ag-sync">
        <span class="st-ag-meta" data-testid="derniere-synchro">{{ libelleSynchro(agenda.derniereSynchro) }}</span>
        <button class="st-btn st-btn--jaune st-ag-btn-sync" type="button" :disabled="synchro" :aria-busy="synchro" @click="synchroniser">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {{ synchro ? 'Synchronisation…' : 'Synchroniser' }}
        </button>
      </div>
    </header>

    <p v-if="autorisation" class="st-ag-msg st-ag-msg--err" role="alert" data-testid="autorisation-google">
      <span><b>Autorisation Google à renouveler.</b> L'agenda ne peut plus être lu : les séances déjà en base sont gardées, rien n'est supprimé. Ré-autorise l'accès Google de l'API réservation, puis synchronise.</span>
    </p>
    <p v-if="message" class="st-ag-msg st-ag-msg--ok" role="status">{{ message }}</p>
    <p v-if="erreur" class="st-ag-msg st-ag-msg--err" role="alert">{{ erreur }}<button class="st-btn" type="button" @click="charger">Réessayer</button></p>

    <div v-if="chargement" aria-hidden="true"><div class="st-ag-squelette" /><div class="st-ag-squelette" /></div>

    <div v-else class="st-ag-cols">
      <section v-if="serveur" aria-labelledby="ag-attribuer">
        <h2 id="ag-attribuer" class="st-ag-titre">À attribuer <span class="st-ag-n">{{ groupes.length }}</span></h2>
        <p v-if="agenda.bilan?.ok" class="st-ag-meta st-ag-bilan" data-testid="bilan-synchro">Dernière synchro : {{ libelleBilan(agenda.bilan).replace('Synchronisé : ', '') }}</p>
        <ul v-if="groupes.length" class="st-ag-alertes" data-testid="a-attribuer">
          <li v-for="(g, i) in groupes" :key="g.cle" class="st-ag-alerte" :style="{ '--i': i }">
            <Puce variante="alerte" point>{{ LIB_ALERTE[g.statut] || 'À vérifier' }}</Puce>
            <strong>{{ g.titre }}</strong>
            <span class="st-ag-meta">{{ g.nb }} rendez-vous · {{ periode(g) }}</span>
            <form class="st-ag-attrib" @submit.prevent="attribuer(g)">
              <fieldset v-if="options(g).length" class="st-ag-cases">
                <legend>Pour</legend>
                <label v-for="c in options(g)" :key="c.id" class="st-ag-case">
                  <input v-model="choix[g.cle]" type="checkbox" :value="c.id" />{{ c.nom }}<small v-if="c.archive">&nbsp;(archivé)</small>
                </label>
              </fieldset>
              <label class="st-ag-champ">{{ options(g).length ? 'Autre client' : 'Client' }}
                <select v-model="ajout[g.cle]" @change="ajouterClient(g)">
                  <option value="">Choisir…</option>
                  <option v-for="c in etatCoach.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
                </select>
              </label>
              <button class="st-btn st-btn--encre" type="submit" :disabled="!choix[g.cle]?.length || enCours === g.cle">{{ enCours === g.cle ? 'Attribution…' : 'Attribuer' }}</button>
            </form>
            <p v-if="g.actuels?.length" data-testid="attribution-gardee">Gardé pour l'instant : {{ g.actuels.map((c) => c.nom).join(', ') }} ({{ RAISON_GARDEE[g.statut] || 'à vérifier' }}). Rien n'est supprimé : confirme ou corrige.</p>
            <p>Retenu pour ce titre : les prochains « {{ g.titre }} » iront aux mêmes clients.</p>
          </li>
        </ul>
        <p v-else class="st-ag-ok"><IconeSt nom="check" />Tous les événements « Coaching » sont attribués.</p>
      </section>

      <section v-else aria-labelledby="ag-alertes">
        <h2 id="ag-alertes" class="st-ag-titre">À corriger <span class="st-ag-n">{{ agenda.alertes.length }}</span></h2>
        <ul v-if="agenda.alertes.length" class="st-ag-alertes" data-testid="alertes-agenda">
          <li v-for="(a, i) in agenda.alertes" :key="a.id" class="st-ag-alerte" :style="{ '--i': i }">
            <Puce variante="alerte" point>{{ LIB_ALERTE[a.type] || 'À vérifier' }}</Puce>
            <strong>{{ a.titre }}</strong>
            <span class="st-ag-meta">{{ partiesDate(a.date).court }} · {{ a.heure.replace(':', ' h ') }}</span>
            <p>{{ a.message || CONSEIL_ALERTE[a.type] }}</p>
          </li>
        </ul>
        <p v-else class="st-ag-ok"><IconeSt nom="check" />Tous les événements « Coaching » sont attribués.</p>
      </section>

      <section aria-labelledby="ag-seances">
        <h2 id="ag-seances" class="st-ag-titre">Rendez-vous à venir <span class="st-ag-n">{{ attribuees.length }}</span></h2>
        <ol v-if="jours.length" class="st-ag-jours" data-testid="seances-agenda">
          <li v-for="(g, i) in joursVisibles" :key="g.date" class="st-ag-jour" :style="{ '--i': Math.min(i, 8) }">
            <div class="st-ag-date" :aria-label="g.court"><b>{{ g.num }}</b><span>{{ g.jour }} {{ g.mois }}</span></div>
            <ul class="st-ag-seances">
              <li v-for="e in g.items" :key="e.id" class="st-ag-seance">
                <span class="st-ag-heure">{{ libelleHeureEvt(e) }}</span>
                <span class="st-ag-qui">
                  <strong>{{ nomDe(e) }}</strong>
                  <small>{{ e.lieu === 'salle' ? 'En salle' : 'À domicile' }}<template v-if="e.lieuTexte"> · {{ e.lieuTexte }}</template></small>
                </span>
              </li>
            </ul>
          </li>
        </ol>
        <button v-if="jours.length > nbJours" class="st-btn st-ag-plus" type="button" @click="nbJours += PAQUET">Voir la suite ({{ jours.length - nbJours }} jours)</button>
        <p v-if="!jours.length" class="st-ag-vide"><strong>Rien de prévu</strong>Aucun rendez-vous à venir dans l'agenda.</p>
      </section>
    </div>

    <p class="st-ag-aide">
      <b>Reconnaissance :</b> nom complet, ou prénom seul s'il n'est porté que par un client. Un prénom partagé n'est jamais deviné : il passe « à attribuer ».
      Un événement modifié ou supprimé dans Google Agenda est mis à jour à la prochaine synchro (toutes les 15 min, depuis le 1er janvier 2026).
      Une séance que tu modifies à la main (statut, heure, lieu) garde ta modification.
    </p>
  </div>
</template>
