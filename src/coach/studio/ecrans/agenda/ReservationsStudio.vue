<script setup>
// Réservations (Studio) : onglets À venir / Passées / Annulées, blocages, règles de prise de rendez-vous.
// Reliées à Google Agenda côté serveur : l'annulation prévient le client tout de suite (confirmation en deux temps, dans la page).
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import data from '../../../../data/index.js'
import {
  LIB_SYNCHRO, JOURS_SEMAINE, formulaireRegles, grouperParJour, libelleBlocage, libelleHeure, lienCarte, lienTel, validerBlocage, validerRegles
} from '../../../../domain/reservations.js'
import IconeSt from '../../IconeSt.vue'
import Puce from '../../Puce.vue'
import './ecran.css'

const ONGLETS = [['a_venir', 'À venir'], ['passees', 'Passées'], ['annulees', 'Annulées'], ['blocages', 'Blocages'], ['regles', 'Règles']]
const LISTES = ['a_venir', 'passees', 'annulees']
const onglet = ref('a_venir')
const chargement = ref(true)
const erreur = ref('')
const message = ref('')
const groupes = ref([])
const aConfirmer = ref(null)
const blocages = ref([])
const bloc = ref({ date: '', debut: '09:00', fin: '12:00', journee: false, motif: '' })
const erreurBloc = ref('')
const regles = ref(null)
const reglesBase = ref({})
const erreursRegles = ref([])
const nouvelleFermeture = ref('')
const boutons = ref([])

const msgErreur = (e) => (e?.status === 502 || /502|indisponible/.test(String(e?.message || '')) ? 'Le service de réservation ne répond pas.' : 'Impossible de joindre le service de réservation. Réessayez dans un instant.')

let jeton = 0
async function charger() {
  const mien = ++jeton
  chargement.value = true; erreur.value = ''; aConfirmer.value = null
  try {
    if (!data.reservations) throw new Error('indisponible')
    if (LISTES.includes(onglet.value)) {
      const g = grouperParJour(await data.reservations.liste(onglet.value), onglet.value === 'a_venir' ? 'asc' : 'desc')
      if (mien === jeton) groupes.value = g
    } else if (onglet.value === 'blocages') {
      const b = await data.reservations.blocages()
      if (mien === jeton) blocages.value = b
    } else {
      const r = await data.reservations.regles()
      if (mien === jeton) { reglesBase.value = r; regles.value = formulaireRegles(r) }
    }
  } catch (e) {
    if (mien === jeton) erreur.value = msgErreur(e)
  } finally {
    if (mien === jeton) chargement.value = false
  }
}
onMounted(charger)
watch(onglet, () => { message.value = ''; charger() })

function toucheOnglet(ev, i) {
  const pas = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0
  const cible = ev.key === 'Home' ? 0 : ev.key === 'End' ? ONGLETS.length - 1 : (i + pas + ONGLETS.length) % ONGLETS.length
  if (!pas && ev.key !== 'Home' && ev.key !== 'End') return
  ev.preventDefault()
  onglet.value = ONGLETS[cible][0]
  nextTick(() => boutons.value[cible]?.focus())
}

const vide = computed(() => !chargement.value && !erreur.value && ((onglet.value === 'blocages' && !blocages.value.length) || (LISTES.includes(onglet.value) && !groupes.value.length)))
const VIDES = {
  a_venir: ['Aucune réservation à venir', 'Les rendez-vous pris sur le site apparaîtront ici.'],
  passees: ['Aucune réservation passée', ''],
  annulees: ['Aucune réservation annulée', ''],
  blocages: ['Aucun blocage', 'Bloquez un créneau pour empêcher la réservation.']
}
const total = computed(() => groupes.value.reduce((n, g) => n + g.items.length, 0))

async function annuler(id) {
  try {
    await data.reservations.annuler(id)
    message.value = 'Réservation annulée. Le client reçoit l’annulation Google tout de suite.'
    await charger()
  } catch (e) { erreur.value = msgErreur(e) }
}
async function bloquer() {
  const v = validerBlocage(bloc.value)
  erreurBloc.value = v.erreur || ''
  if (v.erreur) return
  try {
    await data.reservations.bloquer(v.debut, v.fin, bloc.value.motif.trim())
    message.value = 'Créneau bloqué.'
    bloc.value.motif = ''
    await charger()
  } catch (e) { erreur.value = msgErreur(e) }
}
async function debloquer(id) {
  try { await data.reservations.debloquer(id); message.value = 'Blocage retiré.'; await charger() } catch (e) { erreur.value = msgErreur(e) }
}
const ajouterPlage = (k) => regles.value.plages[k].push({ debut: '09:00', fin: '12:00' })
const retirerPlage = (k, i) => regles.value.plages[k].splice(i, 1)
function ajouterFermeture() {
  const d = nouvelleFermeture.value
  if (d && !regles.value.fermetures.includes(d)) regles.value.fermetures.push(d)
  regles.value.fermetures.sort(); nouvelleFermeture.value = ''
}
async function enregistrer() {
  const v = validerRegles(regles.value, reglesBase.value)
  erreursRegles.value = v.erreurs || []
  message.value = ''
  if (v.erreurs) return
  try {
    await data.reservations.ecrireRegles(v.regles)
    reglesBase.value = v.regles
    message.value = 'Règles enregistrées. Elles s’appliquent aux prochaines réservations.'
  } catch (e) { erreur.value = msgErreur(e) }
}
</script>

<template>
  <div class="st-app st-ag">
    <header class="st-entete">
      <div>
        <h1>Réservations</h1>
        <p>Les rendez-vous pris sur le site. L’agenda Google est mis à jour tout de suite.</p>
      </div>
    </header>

    <div class="st-ag-onglets" role="tablist" aria-label="Réservations">
      <button
        v-for="([k, l], i) in ONGLETS" :id="`rs-onglet-${k}`" :key="k" :ref="(el) => (boutons[i] = el)" class="st-ag-onglet" type="button" role="tab"
        :aria-selected="onglet === k" :aria-controls="'rs-panneau'" :tabindex="onglet === k ? 0 : -1" @click="onglet = k" @keydown="toucheOnglet($event, i)"
      >{{ l }}</button>
    </div>

    <p class="st-ag-msg st-ag-msg--ok st-ag-live" role="status" aria-live="polite" :style="message ? '' : 'display:none'">{{ message }}</p>
    <p v-if="erreur" class="st-ag-msg st-ag-msg--err" role="alert">{{ erreur }}<button class="st-btn" type="button" @click="charger">Réessayer</button></p>

    <div id="rs-panneau" role="tabpanel" :aria-labelledby="`rs-onglet-${onglet}`">
      <div v-if="chargement" aria-hidden="true"><div class="st-ag-squelette" /><div class="st-ag-squelette" /></div>
      <p v-else-if="vide" class="st-ag-vide"><strong>{{ VIDES[onglet][0] }}</strong>{{ VIDES[onglet][1] }}</p>

      <div v-if="!chargement && !erreur && LISTES.includes(onglet)" class="st-ag-resas">
        <p v-if="total > 1" class="st-ag-meta" style="margin: 0">{{ total }} rendez-vous</p>
        <section v-for="g in groupes" :key="g.date" class="st-ag-groupe" :aria-label="g.libelle">
          <h3>{{ g.libelle }}</h3>
          <ul class="st-ag-liste">
            <li v-for="(r, i) in g.items" :key="r.id" class="st-ag-carte" :style="{ '--i': Math.min(i, 8) }">
              <div class="st-ag-carte-tete">
                <span class="st-ag-heure">{{ libelleHeure(r.heure) }}</span>
                <div>
                  <strong>{{ r.prenom }} {{ r.nom.toUpperCase() }}</strong>
                  <small>{{ r.commune }}</small>
                </div>
                <Puce v-if="onglet !== 'passees' && LIB_SYNCHRO[r.synchro]" :variante="r.synchro === 'cree' ? 'ok' : 'propose'" point>{{ LIB_SYNCHRO[r.synchro] }}</Puce>
              </div>
              <div v-if="r.adresse || r.telephone || r.email" class="st-ag-contacts">
                <a v-if="r.adresse" class="st-ag-lien" :href="lienCarte(r.adresse, r.commune)" target="_blank" rel="noopener">{{ r.adresse }}</a>
                <a v-if="r.telephone" class="st-ag-lien" :href="lienTel(r.telephone)">{{ r.telephone }}</a>
                <a v-if="r.email" class="st-ag-lien" :href="`mailto:${r.email}`">{{ r.email }}</a>
              </div>
              <div v-if="onglet === 'a_venir'">
                <button v-if="aConfirmer !== r.id" class="st-btn st-btn--danger" type="button" @click="aConfirmer = r.id">Annuler ce rendez-vous</button>
                <div v-else class="st-ag-confirm" role="group" :aria-label="`Confirmer l’annulation de ${r.prenom} ${r.nom}`">
                  <span>Le client reçoit l’annulation Google tout de suite.</span>
                  <button class="st-btn st-btn--danger-plein" type="button" @click="annuler(r.id)">Confirmer l’annulation</button>
                  <button class="st-btn" type="button" @click="aConfirmer = null">Garder</button>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <div v-if="onglet === 'blocages' && !chargement && !erreur" class="st-ag-blocs">
        <form class="st-bloc st-ag-form" @submit.prevent="bloquer">
          <h2>Bloquer un créneau</h2>
          <div class="st-ag-ligne">
            <label class="st-ag-champ">Date<input v-model="bloc.date" type="date" required /></label>
            <label v-if="!bloc.journee" class="st-ag-champ">Début<input v-model="bloc.debut" type="time" /></label>
            <label v-if="!bloc.journee" class="st-ag-champ">Fin<input v-model="bloc.fin" type="time" /></label>
            <label class="st-ag-case"><input v-model="bloc.journee" type="checkbox" /> Journée entière</label>
          </div>
          <label class="st-ag-champ">Motif (facultatif)<input v-model="bloc.motif" type="text" maxlength="80" /></label>
          <p v-if="erreurBloc" class="st-ag-msg st-ag-msg--err" role="alert" style="margin: 0">{{ erreurBloc }}</p>
          <div><button class="st-btn st-btn--jaune" type="submit">Bloquer</button></div>
        </form>
        <ul v-if="blocages.length" class="st-ag-blocs" style="margin: 0; padding: 0; list-style: none">
          <li v-for="b in blocages" :key="b.id" class="st-ag-blocage">
            <div><strong>{{ libelleBlocage(b) }}</strong><small v-if="b.motif">{{ b.motif }}</small></div>
            <button class="st-btn" type="button" @click="debloquer(b.id)">Débloquer</button>
          </li>
        </ul>
      </div>

      <form v-if="onglet === 'regles' && regles && !chargement && !erreur" class="st-ag-blocs" @submit.prevent="enregistrer">
        <div class="st-bloc">
          <h2>Plages d’ouverture</h2>
          <div v-for="[k, nom] in JOURS_SEMAINE" :key="k" class="st-ag-plage-jour">
            <strong>{{ nom }}</strong>
            <div class="st-ag-plages">
              <span v-if="!regles.plages[k].length" class="st-ag-meta">Fermé</span>
              <span v-for="(p, i) in regles.plages[k]" :key="i" class="st-ag-plage">
                <input v-model="p.debut" type="time" :aria-label="`${nom}, début de la plage ${i + 1}`" />
                <span aria-hidden="true">–</span>
                <input v-model="p.fin" type="time" :aria-label="`${nom}, fin de la plage ${i + 1}`" />
                <button class="st-ag-x" type="button" :aria-label="`Retirer la plage ${i + 1} du ${nom}`" @click="retirerPlage(k, i)"><IconeSt nom="fermer" /></button>
              </span>
              <button class="st-btn" type="button" @click="ajouterPlage(k)"><IconeSt nom="plus" />Plage</button>
            </div>
          </div>
        </div>
        <div class="st-bloc st-ag-reglages">
          <label class="st-ag-champ">Durée (min)<input v-model="regles.dureeMin" type="number" inputmode="numeric" /></label>
          <label class="st-ag-champ">Tampon (min)<input v-model="regles.tamponMin" type="number" inputmode="numeric" /></label>
          <label class="st-ag-champ">Délai minimal (h)<input v-model="regles.delaiMinHeures" type="number" inputmode="numeric" /></label>
          <label class="st-ag-champ">Horizon (jours)<input v-model="regles.horizonJours" type="number" inputmode="numeric" /></label>
          <label class="st-ag-champ">Maximum par jour<input v-model="regles.maxParJour" type="number" inputmode="numeric" /></label>
          <label class="st-ag-champ">Conservation (mois)<input v-model="regles.conservationMois" type="number" inputmode="numeric" /></label>
        </div>
        <div class="st-bloc">
          <h2>Fermetures</h2>
          <div class="st-ag-ligne">
            <label class="st-ag-champ">Date<input v-model="nouvelleFermeture" type="date" /></label>
            <button class="st-btn" type="button" @click="ajouterFermeture">Ajouter</button>
          </div>
          <div class="st-ag-jetons">
            <span v-for="d in regles.fermetures" :key="d" class="st-ag-jeton">{{ d }}
              <button class="st-ag-x" type="button" :aria-label="`Retirer la fermeture du ${d}`" @click="regles.fermetures.splice(regles.fermetures.indexOf(d), 1)"><IconeSt nom="fermer" /></button>
            </span>
            <span v-if="!regles.fermetures.length" class="st-ag-meta">Aucune fermeture.</span>
          </div>
        </div>
        <div v-if="erreursRegles.length" class="st-ag-msg st-ag-msg--err" role="alert" style="display: block"><div v-for="e in erreursRegles" :key="e">{{ e }}</div></div>
        <div class="st-ag-barre"><button class="st-btn st-btn--encre" type="submit">Enregistrer les règles</button></div>
      </form>
    </div>
  </div>
</template>
