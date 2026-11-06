<script setup>
// Agenda Google (Studio) : dernière synchro, séances attribuées par jour, alertes (nom inconnu, ambigu, sans nom).
// Les événements « Coaching <nom du client> » du Google Agenda du coach apparaissent dans la case Coaching de l'appli du client.
import { computed, onMounted, ref } from 'vue'
import data from '../../../../data/index.js'
import { etat as etatCoach, maintenant, messageErreur, nomClient, rafraichir } from '../../../store.js'
import IconeSt from '../../IconeSt.vue'
import Puce from '../../Puce.vue'
import { CONSEIL_ALERTE, LIB_ALERTE, grouperEvenements, libelleHeureEvt, libelleSynchro, partiesDate } from './agendaOutils.js'
import './ecran.css'

const PAQUET = 8 // jours affichés avant « Voir la suite »
const agenda = ref({ derniereSynchro: null, evenements: [], alertes: [] })
const chargement = ref(true)
const synchro = ref(false)
const message = ref('')
const erreur = ref('')
const nbJours = ref(PAQUET)

const aVenir = computed(() => agenda.value.evenements.filter((e) => e.debutMs >= maintenant() - 3600000))
const attribuees = computed(() => aVenir.value.filter((e) => e.statut === 'attribue'))
const jours = computed(() => grouperEvenements(attribuees.value))
const joursVisibles = computed(() => jours.value.slice(0, nbJours.value))
const nomDe = (e) => (nomClient(e.clientId) !== 'Modèle' ? nomClient(e.clientId) : e.clientNom || 'Client')

async function charger() {
  try {
    agenda.value = await data.agenda.etat()
    erreur.value = ''
  } catch (e) {
    erreur.value = messageErreur(e)
  } finally {
    chargement.value = false
  }
}

async function synchroniser() {
  synchro.value = true
  message.value = ''
  erreur.value = ''
  try {
    const b = await data.agenda.synchroniser()
    const parties = [b.ajoutes && `${b.ajoutes} ajoutée(s)`, b.modifies && `${b.modifies} modifiée(s)`, b.supprimes && `${b.supprimes} supprimée(s)`].filter(Boolean)
    message.value = b.message || (parties.length ? `Synchronisé : ${parties.join(', ')}.` : 'Synchronisé : rien de nouveau.')
    await charger()
    await rafraichir()
  } catch (e) {
    erreur.value = messageErreur(e)
  } finally {
    synchro.value = false
  }
}

onMounted(async () => { await rafraichir(); await charger() })
</script>

<template>
  <div class="st-app st-ag">
    <header class="st-entete">
      <div>
        <h1>Agenda</h1>
        <p>
          Créez « Coaching Prénom Nom » dans Google Agenda : la séance apparaît dans l'appli du client.
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

    <p v-if="message" class="st-ag-msg st-ag-msg--ok" role="status">{{ message }}</p>
    <p v-if="erreur" class="st-ag-msg st-ag-msg--err" role="alert">{{ erreur }}<button class="st-btn" type="button" @click="charger">Réessayer</button></p>

    <div v-if="chargement" aria-hidden="true"><div class="st-ag-squelette" /><div class="st-ag-squelette" /></div>

    <div v-else class="st-ag-cols">
      <section aria-labelledby="ag-alertes">
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
        <h2 id="ag-seances" class="st-ag-titre">Séances à venir <span class="st-ag-n">{{ attribuees.length }}</span></h2>
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
        <p v-if="!jours.length" class="st-ag-vide"><strong>Rien de prévu</strong>Aucune séance à venir dans l'agenda.</p>
      </section>
    </div>

    <p class="st-ag-aide">
      <b>Homonymes :</b> ajoutez un identifiant court au titre ou à la description (ex. « Coaching Marc Dupont #md2 »).
      Un événement modifié ou supprimé dans Google Agenda est mis à jour à la prochaine synchro (toutes les 15 min).
      {{ etatCoach.clients.length }} clients actifs pris en compte.
    </p>
  </div>
</template>
