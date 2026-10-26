<script setup>
// Panneau « Agenda Google » : dernière synchro, séances attribuées, alertes (nom inconnu, ambigu, sans nom).
// Les événements « Coaching <nom du client> » du Google Agenda du coach apparaissent dans la case Coaching de l'appli du client.
import { computed, onMounted, ref } from 'vue'
import data from '../../data/index.js'
import { etat as etatCoach, maintenant, messageErreur, nomClient, rafraichir } from '../store.js'

const agenda = ref({ derniereSynchro: null, evenements: [], alertes: [] })
const chargement = ref(true)
const synchro = ref(false)
const message = ref('')
const erreur = ref('')

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const libelleJour = (date) => {
  const [a, m, j] = date.split('-').map(Number)
  return `${JOURS[new Date(a, m - 1, j).getDay()]} ${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}
const libelleHeure = (e) => (e.journee ? 'toute la journée' : e.finHeure ? `${e.heure.replace(':', ' h ')} – ${e.finHeure.replace(':', ' h ')}` : e.heure.replace(':', ' h '))
const libelleSynchro = computed(() => {
  const t = agenda.value.derniereSynchro
  if (!t) return 'Jamais synchronisé'
  const d = new Date(t)
  return `Dernière synchro : ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
})

const aVenir = computed(() => agenda.value.evenements.filter((e) => e.debutMs >= maintenant() - 3600000))
const attribuees = computed(() => aVenir.value.filter((e) => e.statut === 'attribue'))
const nomDe = (e) => nomClient(e.clientId) !== 'Modèle' ? nomClient(e.clientId) : e.clientNom || 'Client'
const LIB_ALERTE = { inconnu: 'Nom inconnu', ambigu: 'Nom ambigu', 'sans-nom': 'Sans nom' }

async function charger() {
  try {
    agenda.value = await data.agenda.etat()
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
    message.value = parties.length ? `Synchronisé : ${parties.join(', ')}.` : 'Synchronisé : rien de nouveau.'
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
  <div class="c-agenda">
    <div class="c-entete">
      <div>
        <h1>Agenda Google</h1>
        <p class="c-sous">
          Créez « Coaching Prénom Nom » dans votre agenda : la séance apparaît dans l'appli du client.
          <span v-if="data.mode === 'local'" class="c-pastille">Démo : faux agenda</span>
        </p>
      </div>
      <div class="c-agenda-synchro">
        <span class="c-doux" data-testid="derniere-synchro">{{ libelleSynchro }}</span>
        <button class="c-btn c-principal" type="button" :disabled="synchro" @click="synchroniser">{{ synchro ? 'Synchronisation…' : 'Synchroniser maintenant' }}</button>
      </div>
    </div>

    <p v-if="message" class="c-ok" role="status">{{ message }}</p>
    <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>

    <h2>À corriger ({{ agenda.alertes.length }})</h2>
    <div v-if="agenda.alertes.length" class="c-liste" data-testid="alertes-agenda">
      <div v-for="a in agenda.alertes" :key="a.id" class="c-item">
        <span class="c-pastille c-alerte">{{ LIB_ALERTE[a.type] }}</span>
        <div style="flex: 1; min-width: 0">
          <strong>{{ a.titre }}</strong> <span class="c-doux">· {{ libelleJour(a.date) }} {{ a.heure.replace(':', ' h ') }}</span>
          <div class="c-doux">{{ a.message }}</div>
        </div>
      </div>
    </div>
    <p v-else-if="!chargement" class="c-vide">Tous les événements « Coaching » sont attribués.</p>

    <h2 style="margin-top: 26px">Séances attribuées ({{ attribuees.length }})</h2>
    <div v-if="attribuees.length" class="c-liste" data-testid="seances-agenda">
      <div v-for="e in attribuees" :key="e.id" class="c-item">
        <span class="c-pastille c-bien">{{ libelleJour(e.date) }}</span>
        <div style="flex: 1; min-width: 0">
          <strong>{{ nomDe(e) }}</strong>
          <div class="c-doux">{{ libelleHeure(e) }} · {{ e.lieu === 'salle' ? 'en salle' : 'à domicile' }}<template v-if="e.lieuTexte"> · {{ e.lieuTexte }}</template></div>
        </div>
      </div>
    </div>
    <p v-else-if="!chargement" class="c-vide">Aucune séance à venir dans l'agenda.</p>

    <p class="c-doux" style="margin-top: 22px; font-size: 13px">
      Homonymes : ajoutez un identifiant court au titre ou à la description (ex. « Coaching Marc Dupont #md2 »).
      Un événement modifié ou supprimé dans Google Agenda est mis à jour à la prochaine synchro (toutes les 15 min).
      {{ etatCoach.clients.length }} clients actifs pris en compte.
    </p>
  </div>
</template>

<style scoped>
.c-agenda-synchro { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
@media (max-width: 860px) { .c-agenda-synchro { width: 100%; } }
</style>
