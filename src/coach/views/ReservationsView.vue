<script setup>
// Écran coach « Réservations » : onglets À venir / Passées / Annulées, blocages, règles de prise de rendez-vous.
import { computed, onMounted, ref, watch } from 'vue'
import data from '../../data/index.js'
import {
  LIB_SYNCHRO, JOURS_SEMAINE, formulaireRegles, grouperParJour, libelleBlocage, libelleHeure, lienCarte, lienTel, validerBlocage, validerRegles
} from '../../domain/reservations.js'

const ONGLETS = [['a_venir', 'À venir'], ['passees', 'Passées'], ['annulees', 'Annulées'], ['blocages', 'Blocages'], ['regles', 'Règles']]
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

const msgErreur = (e) => (e?.status === 502 || /502|indisponible/.test(String(e?.message || '')) ? 'Le service de réservation ne répond pas.' : 'Impossible de joindre le service de réservation. Réessayez dans un instant.')

async function charger() {
  chargement.value = true; erreur.value = ''; aConfirmer.value = null
  try {
    if (!data.reservations) throw new Error('indisponible')
    if (['a_venir', 'passees', 'annulees'].includes(onglet.value)) {
      groupes.value = grouperParJour(await data.reservations.liste(onglet.value), onglet.value === 'a_venir' ? 'asc' : 'desc')
    } else if (onglet.value === 'blocages') {
      blocages.value = await data.reservations.blocages()
    } else {
      reglesBase.value = await data.reservations.regles()
      regles.value = formulaireRegles(reglesBase.value)
    }
  } catch (e) {
    erreur.value = msgErreur(e)
  } finally {
    chargement.value = false
  }
}
onMounted(charger)
watch(onglet, () => { message.value = ''; charger() })

const vide = computed(() => !chargement.value && !erreur.value && ((onglet.value === 'blocages' && !blocages.value.length) || (['a_venir', 'passees', 'annulees'].includes(onglet.value) && !groupes.value.length)))
const VIDES = { a_venir: 'Aucune réservation à venir.', passees: 'Aucune réservation passée.', annulees: 'Aucune réservation annulée.', blocages: 'Aucun blocage.' }

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
  <div class="c-resa">
    <div class="c-entete">
      <div>
        <h1>Réservations</h1>
        <p class="c-sous">Les rendez-vous pris sur le site. L’agenda Google est mis à jour tout de suite.</p>
      </div>
    </div>

    <div class="c-onglets" role="tablist" aria-label="Réservations">
      <button v-for="[k, l] in ONGLETS" :key="k" class="c-onglet" type="button" role="tab" :aria-selected="onglet === k" @click="onglet = k">{{ l }}</button>
    </div>

    <p class="c-ok" role="status" aria-live="polite">{{ message }}</p>
    <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }} <button class="c-btn c-mini" type="button" @click="charger">Réessayer</button></p>
    <p v-if="chargement" class="c-doux" role="status">Chargement…</p>
    <p v-else-if="vide" class="c-vide">{{ VIDES[onglet] }}</p>

    <template v-if="!chargement && !erreur && ['a_venir', 'passees', 'annulees'].includes(onglet)">
      <section v-for="g in groupes" :key="g.date" class="c-jour" :aria-label="g.libelle">
        <h3>{{ g.libelle }}</h3>
        <article v-for="r in g.items" :key="r.id" class="c-carte c-resa-carte">
          <div class="c-ligne">
            <strong class="c-heure">{{ libelleHeure(r.heure) }}</strong>
            <strong>{{ r.prenom }} {{ r.nom.toUpperCase() }}</strong>
            <span class="c-doux">{{ r.commune }}</span>
            <span class="c-espace"></span>
            <span v-if="onglet !== 'passees' && LIB_SYNCHRO[r.synchro]" class="c-pastille" :class="r.synchro === 'cree' ? 'c-bien' : 'c-alerte'">{{ LIB_SYNCHRO[r.synchro] }}</span>
          </div>
          <ul class="c-contacts">
            <li v-if="r.adresse"><a :href="lienCarte(r.adresse, r.commune)" target="_blank" rel="noopener">{{ r.adresse }}</a></li>
            <li v-if="r.telephone"><a :href="lienTel(r.telephone)">{{ r.telephone }}</a></li>
            <li v-if="r.email"><a :href="`mailto:${r.email}`">{{ r.email }}</a></li>
          </ul>
          <div v-if="onglet === 'a_venir'" class="c-ligne">
            <button v-if="aConfirmer !== r.id" class="c-btn c-mini c-danger" type="button" @click="aConfirmer = r.id">Annuler ce rendez-vous</button>
            <template v-else>
              <span class="c-petit">Le client reçoit l’annulation Google tout de suite.</span>
              <button class="c-btn c-mini c-danger" type="button" @click="annuler(r.id)">Confirmer l’annulation</button>
              <button class="c-btn c-mini" type="button" @click="aConfirmer = null">Garder</button>
            </template>
          </div>
        </article>
      </section>
    </template>

    <template v-if="onglet === 'blocages' && !chargement && !erreur">
      <form class="c-carte c-bloc-form" @submit.prevent="bloquer">
        <h2>Bloquer un créneau</h2>
        <div class="c-ligne c-bas">
          <label>Date<input v-model="bloc.date" type="date" required /></label>
          <label v-if="!bloc.journee">Début<input v-model="bloc.debut" type="time" /></label>
          <label v-if="!bloc.journee">Fin<input v-model="bloc.fin" type="time" /></label>
          <label class="c-case"><input v-model="bloc.journee" type="checkbox" /> Journée entière</label>
        </div>
        <label>Motif (facultatif)<input v-model="bloc.motif" type="text" maxlength="80" /></label>
        <p v-if="erreurBloc" class="c-erreur" role="alert">{{ erreurBloc }}</p>
        <div><button class="c-btn c-principal" type="submit">Bloquer</button></div>
      </form>
      <div v-if="blocages.length" class="c-liste" style="margin-top: 14px">
        <div v-for="b in blocages" :key="b.id" class="c-item">
          <div style="flex: 1; min-width: 0"><strong>{{ libelleBlocage(b) }}</strong><div v-if="b.motif" class="c-doux">{{ b.motif }}</div></div>
          <button class="c-btn c-mini" type="button" @click="debloquer(b.id)">Débloquer</button>
        </div>
      </div>
    </template>

    <form v-if="onglet === 'regles' && regles && !chargement && !erreur" class="c-regles" @submit.prevent="enregistrer">
      <div class="c-carte">
        <h2>Plages d’ouverture</h2>
        <div v-for="[k, nom] in JOURS_SEMAINE" :key="k" class="c-plage-jour">
          <strong class="c-nom-jour">{{ nom }}</strong>
          <div class="c-plages">
            <span v-if="!regles.plages[k].length" class="c-doux">Fermé</span>
            <span v-for="(p, i) in regles.plages[k]" :key="i" class="c-plage">
              <input v-model="p.debut" type="time" :aria-label="`${nom}, début de la plage ${i + 1}`" />
              <span aria-hidden="true">–</span>
              <input v-model="p.fin" type="time" :aria-label="`${nom}, fin de la plage ${i + 1}`" />
              <button class="c-btn c-mini" type="button" :aria-label="`Retirer la plage ${i + 1} du ${nom}`" @click="retirerPlage(k, i)">×</button>
            </span>
            <button class="c-btn c-mini" type="button" @click="ajouterPlage(k)">+ Plage</button>
          </div>
        </div>
      </div>
      <div class="c-carte c-reglages">
        <label>Durée (min)<input v-model="regles.dureeMin" type="number" inputmode="numeric" /></label>
        <label>Tampon (min)<input v-model="regles.tamponMin" type="number" inputmode="numeric" /></label>
        <label>Délai minimal (h)<input v-model="regles.delaiMinHeures" type="number" inputmode="numeric" /></label>
        <label>Horizon (jours)<input v-model="regles.horizonJours" type="number" inputmode="numeric" /></label>
        <label>Maximum par jour<input v-model="regles.maxParJour" type="number" inputmode="numeric" /></label>
        <label>Conservation (mois)<input v-model="regles.conservationMois" type="number" inputmode="numeric" /></label>
      </div>
      <div class="c-carte">
        <h2>Fermetures</h2>
        <div class="c-ligne c-bas">
          <label>Date<input v-model="nouvelleFermeture" type="date" /></label>
          <button class="c-btn" type="button" @click="ajouterFermeture">Ajouter</button>
        </div>
        <div class="c-champs">
          <span v-for="d in regles.fermetures" :key="d" class="c-champ">{{ d }}
            <button class="c-btn c-mini" type="button" :aria-label="`Retirer la fermeture du ${d}`" @click="regles.fermetures.splice(regles.fermetures.indexOf(d), 1)">×</button>
          </span>
          <span v-if="!regles.fermetures.length" class="c-doux">Aucune fermeture.</span>
        </div>
      </div>
      <div v-if="erreursRegles.length" class="c-erreur" role="alert"><div v-for="e in erreursRegles" :key="e">{{ e }}</div></div>
      <div><button class="c-btn c-principal" type="submit">Enregistrer les règles</button></div>
    </form>
  </div>
</template>

<style scoped>
.c-jour { margin-bottom: 18px; }
.c-resa-carte { display: flex; flex-direction: column; gap: 8px; }
.c-resa-carte + .c-resa-carte { margin-top: 8px; }
.c-heure { font-variant-numeric: tabular-nums; color: var(--accent); }
.c-contacts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 14px; }
.c-contacts a { overflow-wrap: anywhere; }
.c-bloc-form { display: flex; flex-direction: column; gap: 12px; }
.c-regles { display: flex; flex-direction: column; gap: 12px; }
.c-plage-jour { display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid var(--filet); }
.c-nom-jour { width: 88px; flex: none; padding-top: 8px; }
.c-plages, .c-plage { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.c-plage input { width: 110px; }
.c-reglages { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
@media (max-width: 860px) { .c-plage-jour { flex-direction: column; gap: 4px; } .c-nom-jour { padding-top: 0; } }
</style>
