<script setup>
// Fiche d'un client : calendrier, séances faites et charges, réponses, courbes, coaching (séances + mot du coach), réglages.
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import data from '../../data/index.js'
import { LIEUX, STATUTS_SEANCE } from '../../domain/modele.js'
import { jourLocal, ajouterJours, lundiDe } from '../../domain/dates.js'
import { etatSemaine } from '../../domain/programme.js'
import { libelleSeance, payeCeMois } from '../../domain/coaching.js'
import { maintenant, rafraichir, uuid, etat, marquerVue, messageErreur } from '../store.js'
import { HABITUDES_DEFAUT, parserHabitudes } from '../../domain/suivi.js'
import { chargesRealisees, pointsPoids, lienWhatsAppIdentifiants, messageIdentifiants } from '../logique.js'
import CalendrierMois from '../components/CalendrierMois.vue'
import SvgCourbe from '../components/SvgCourbe.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const profil = ref(undefined)
const d = reactive({
  programmes: [], workouts: [], realisations: [], seances: [], mots: [], reponses: [], questionnaires: [], mesures: [], douleurs: [], exercices: []
})
const onglet = ref('apercu')
const ONGLETS = [
  ['apercu', 'Aperçu'], ['faites', 'Séances faites'], ['reponses', 'Réponses'], ['courbes', 'Courbes'], ['coaching', 'Coaching'], ['reglages', 'Réglages']
]
const aujourdhui = jourLocal(maintenant())
const erreur = ref('')
const info = ref('')

async function charger() {
  profil.value = (await data.profils.lire(props.id)) || null
  if (!profil.value) return
  const f = { clientId: props.id }
  const [programmes, workouts, realisations, seances, mots, reponses, questionnaires, mesures, douleurs, exercices] = await Promise.all([
    data.programmes.lister(f), data.workouts.lister(f), data.realisations.lister(f), data.seancesCoaching.lister(f), data.motsDuCoach.lister(f),
    data.reponses.lister(f), data.questionnaires.lister(), data.mesures.lister(f), data.douleurs.lister(f), data.exercices.lister()
  ])
  Object.assign(d, { programmes, workouts, realisations, seances, mots, reponses, questionnaires, mesures, douleurs, exercices })
  reglages.nom = profil.value.nom
  reglages.tarif = profil.value.tarif
  reglages.lieuDefaut = profil.value.lieuDefaut
  reglages.modules = { habitudes: false, photosRepas: false, calories: false, ...profil.value.modules }
  reglages.habitudesTexte = (profil.value.modules?.listeHabitudes || []).join('\n')
  nouvelle.tarif = profil.value.tarif
  nouvelle.lieu = profil.value.lieuDefaut
  await rafraichir()
}
onMounted(charger)

const nomWorkout = (id) => d.workouts.find((w) => w.id === id)?.nom || 'Séance'
const nomExercice = (id) => d.exercices.find((e) => e.id === id)?.nom || '?'
const alertesClient = computed(() => etat.alertes.filter((a) => a.clientId === props.id))

// --- Calendrier -----------------------------------------------------------------------------------------
const evenements = computed(() => {
  const ev = {}
  const ajout = (jour, e) => (ev[jour] ||= []).push(e)
  for (const r of d.realisations) ajout(r.date, { texte: nomWorkout(r.workoutId), type: 'fait' })
  for (const s of d.seances.filter((x) => x.statut !== 'annulee')) ajout(s.date, { texte: `${s.heure} coaching`, type: 'coach' })
  // Séances prévues : jours fixés du programme, sur les semaines autour d'aujourd'hui.
  for (const p of d.programmes) {
    for (let k = -8; k <= 12; k++) {
      const s = etatSemaine(p, d.realisations, ajouterJours(lundiDe(aujourdhui), k * 7), aujourdhui)
      for (const w of s.workouts) if (!w.fait && w.jourPlace) ajout(w.jourPlace, { texte: nomWorkout(w.workoutId), type: 'prevu' })
    }
  }
  return ev
})
const faitesCetteSemaine = computed(() => {
  const l = lundiDe(aujourdhui)
  return d.realisations.filter((r) => r.date >= l && r.date <= ajouterJours(l, 6)).length
})
const derniereSeance = computed(() => [...d.realisations].sort((a, b) => b.date.localeCompare(a.date))[0])

// --- Séances faites / charges ----------------------------------------------------------------------------------
const faitesTriees = computed(() => [...d.realisations].sort((a, b) => b.date.localeCompare(a.date)))
const charges = computed(() => chargesRealisees(d.realisations, nomExercice))
const duree = (s) => `${Math.round(s / 60)} min`

// --- Réponses --------------------------------------------------------------------------------------------------------------
const reponsesTriees = computed(() => [...d.reponses].sort((a, b) => b.date.localeCompare(a.date)))
const questionnaireDe = (id) => d.questionnaires.find((q) => q.id === id)
const lignesReponse = (r) => {
  const q = questionnaireDe(r.questionnaireId)
  return Object.entries(r.valeurs).map(([cle, v]) => ({
    libelle: q?.questions.find((x) => x.cle === cle)?.libelle || cle,
    valeur: Array.isArray(v) ? v.join(', ') : v
  }))
}

// --- Courbes ------------------------------------------------------------------------------------------------------------------
const courbePoids = computed(() => pointsPoids(d.mesures, d.reponses))
const courbeDouleur = computed(() => {
  const m = new Map()
  const note = (date, v) => typeof v === 'number' && m.set(date, Math.max(m.get(date) ?? 0, v))
  d.douleurs.forEach((x) => note(x.date, x.intensite))
  d.reponses.forEach((r) => note(r.date, r.valeurs?.douleur))
  return [...m.entries()].map(([date, valeur]) => ({ date, valeur }))
})
const courbeVolume = computed(() => d.realisations.map((r) => ({ date: r.date, valeur: r.volume })))

// --- Coaching ------------------------------------------------------------------------------------------------------------------
const nouvelle = reactive({ date: aujourdhui, heure: '18:00', lieu: 'domicile', statut: 'prevue', tarif: 35 })
const seancesTriees = computed(() => [...d.seances].sort((a, b) => `${b.date}${b.heure}`.localeCompare(`${a.date}${a.heure}`)))
const paye = computed(() => payeCeMois(d.seances, maintenant()))
const mot = ref('')

async function ajouterSeance() {
  erreur.value = ''
  try {
    // Le tarif est figé dans la séance à sa création (modifier le tarif du client plus tard ne change pas l'historique).
    await data.seancesCoaching.creer({ id: uuid(), clientId: props.id, ...nouvelle, tarif: Number(nouvelle.tarif) || 0 })
    await charger()
  } catch (e) { erreur.value = messageErreur(e) }
}
async function changerStatut(s, statut) {
  await data.seancesCoaching.modifier(s.id, { statut })
  await charger()
}
async function envoyerMot() {
  if (!mot.value.trim()) return
  await data.motsDuCoach.creer({ id: uuid(), clientId: props.id, texte: mot.value.trim(), date: aujourdhui })
  mot.value = ''
  await charger()
}
async function supprimerMot(m) {
  await data.motsDuCoach.archiver(m.id)
  await charger()
}

// --- Réglages -------------------------------------------------------------------------------------------------------------------
const reglages = reactive({ nom: '', tarif: 0, lieuDefaut: 'domicile', modules: { habitudes: false, photosRepas: false, calories: false }, habitudesTexte: '' })
async function enregistrerReglages() {
  erreur.value = ''
  info.value = ''
  try {
    await data.profils.modifier(props.id, { nom: reglages.nom.trim(), tarif: Number(reglages.tarif) || 0, lieuDefaut: reglages.lieuDefaut, modules: { ...reglages.modules, listeHabitudes: parserHabitudes(reglages.habitudesTexte) } })
    info.value = 'Réglages enregistrés.'
    await charger()
  } catch (e) { erreur.value = messageErreur(e) }
}
// Nouveau code : affiché une seule fois, à transmettre tout de suite.
const nouveauCode = ref(null)
const copie = ref('')
async function genererNouveauCode() {
  erreur.value = ''
  try {
    const { identifiant, code } = await data.reinitialiserCode(props.id)
    nouveauCode.value = { nom: profil.value.nom, identifiant, code, url: window.location.origin }
  } catch (e) { erreur.value = messageErreur(e) }
}
async function copier(texte, quoi) {
  try { await navigator.clipboard.writeText(texte); copie.value = quoi } catch { copie.value = 'Copie impossible : sélectionne le texte' }
  setTimeout(() => { copie.value = '' }, 2000)
}
async function archiver() {
  await data.profils.archiver(props.id)
  await rafraichir()
  router.push('/coach/clients')
}
</script>

<template>
  <div v-if="profil">
    <RouterLink to="/coach/clients" class="c-retour">← Clients</RouterLink>
    <div class="c-entete">
      <div>
        <h1>{{ profil.nom }}</h1>
        <p class="c-sous">{{ profil.identifiant }} · {{ profil.tarif }} € la séance · {{ profil.lieuDefaut === 'domicile' ? 'à domicile' : 'en salle' }}</p>
      </div>
      <div class="c-actions">
        <RouterLink :to="`/coach/seances/nouveau?client=${id}`" class="c-btn">Nouvelle séance</RouterLink>
        <RouterLink :to="`/coach/programmes/nouveau?client=${id}`" class="c-btn c-principal">Nouveau programme</RouterLink>
      </div>
    </div>

    <div v-if="alertesClient.length" class="c-carte" style="margin-bottom: 16px; border-color: var(--alerte)">
      <div v-for="a in alertesClient" :key="a.id" class="c-ligne" style="margin-bottom: 4px">
        <span class="c-pastille c-alerte">{{ a.type === 'douleur' ? 'Douleur' : a.type === 'checkin' ? 'Check-in' : 'Commentaire' }}</span>
        <span style="flex: 1">{{ a.message }}</span>
        <button class="c-btn c-mini" @click="marquerVue(a)">Marquer vu</button>
      </div>
    </div>

    <div class="c-onglets" role="tablist">
      <button v-for="[cle, texte] in ONGLETS" :key="cle" class="c-onglet" role="tab" :aria-selected="onglet === cle" @click="onglet = cle">{{ texte }}</button>
    </div>

    <!-- Aperçu -->
    <section v-if="onglet === 'apercu'">
      <div class="c-grille" style="margin-bottom: 16px">
        <div class="c-carte"><h3>Cette semaine</h3><strong style="font: 400 26px var(--font-titre)">{{ faitesCetteSemaine }}</strong> <span class="c-doux">séance{{ faitesCetteSemaine > 1 ? 's' : '' }} faite{{ faitesCetteSemaine > 1 ? 's' : '' }}</span></div>
        <div class="c-carte"><h3>Dernière séance</h3>{{ derniereSeance ? `${nomWorkout(derniereSeance.workoutId)} · ${derniereSeance.date}` : 'Aucune pour l\'instant' }}</div>
        <div class="c-carte"><h3>Programme</h3>{{ d.programmes[0] ? d.programmes[0].nom : 'Aucun programme' }}
          <RouterLink v-if="d.programmes[0]" :to="`/coach/programmes/${d.programmes[0].id}`" class="c-petit" style="display: block">Ouvrir</RouterLink>
        </div>
      </div>
      <div class="c-carte"><CalendrierMois :evenements="evenements" :aujourdhui="aujourdhui" /></div>
    </section>

    <!-- Séances faites -->
    <section v-else-if="onglet === 'faites'">
      <h2>Séances faites ({{ faitesTriees.length }})</h2>
      <div v-if="faitesTriees.length" class="c-liste" style="margin-bottom: 20px">
        <div v-for="r in faitesTriees" :key="r.id" class="c-item" style="flex-wrap: wrap">
          <strong style="flex: 1; min-width: 160px">{{ nomWorkout(r.workoutId) }}</strong>
          <span class="c-doux">{{ r.date }} · {{ duree(r.dureeSec) }} · volume {{ Math.round(r.volume) }} kg</span>
          <p v-if="r.commentaire" style="flex-basis: 100%; margin: 0" class="c-petit">« {{ r.commentaire }} »</p>
        </div>
      </div>
      <p v-else class="c-vide" style="margin-bottom: 20px">Aucune séance faite.</p>

      <h2>Charges réalisées</h2>
      <div v-if="charges.length" class="c-grille">
        <div v-for="c in charges" :key="c.exerciceId" class="c-carte">
          <h3 style="text-transform: none; letter-spacing: 0; font-size: 14px; color: var(--texte)">{{ c.nom }}</h3>
          <table class="c-table">
            <tr v-for="h in c.historique.slice(0, 5)" :key="h.date"><td class="c-doux">{{ h.date }}</td><td><strong>{{ h.poids }} kg</strong><span v-if="h.reps !== null"> × {{ h.reps }}</span></td><td class="c-doux">{{ h.series }} séries</td></tr>
          </table>
        </div>
      </div>
      <p v-else class="c-vide">Pas encore de charge enregistrée.</p>
    </section>

    <!-- Réponses -->
    <section v-else-if="onglet === 'reponses'">
      <div v-if="reponsesTriees.length" class="c-liste">
        <details v-for="r in reponsesTriees" :key="r.id" class="c-item" style="display: block">
          <summary style="cursor: pointer"><strong>{{ questionnaireDe(r.questionnaireId)?.nom || 'Questionnaire' }}</strong> <span class="c-doux">{{ r.date }}</span></summary>
          <table class="c-table" style="margin-top: 8px">
            <tr v-for="l in lignesReponse(r)" :key="l.libelle"><td class="c-doux">{{ l.libelle }}</td><td>{{ l.valeur }}</td></tr>
          </table>
        </details>
      </div>
      <p v-else class="c-vide">Aucune réponse pour l'instant.</p>
    </section>

    <!-- Courbes -->
    <section v-else-if="onglet === 'courbes'" class="c-grille" style="grid-template-columns: repeat(auto-fit, minmax(340px, 1fr))">
      <div class="c-carte"><SvgCourbe :donnees="courbePoids" titre="Poids" unite="kg" /></div>
      <div class="c-carte"><SvgCourbe :donnees="courbeDouleur" titre="Douleur (max du jour)" unite="/10" /></div>
      <div class="c-carte"><SvgCourbe :donnees="courbeVolume" titre="Volume par séance" unite="kg" /></div>
    </section>

    <!-- Coaching -->
    <section v-else-if="onglet === 'coaching'" class="c-deux" style="align-items: start">
      <div>
        <form class="c-carte" @submit.prevent="ajouterSeance">
          <h2>Ajouter une séance de coaching</h2>
          <div class="c-ligne c-bas" style="margin-bottom: 12px">
            <label>Date<input v-model="nouvelle.date" type="date" required /></label>
            <label>Heure<input v-model="nouvelle.heure" type="time" required style="width: 120px" /></label>
            <label>Lieu<select v-model="nouvelle.lieu"><option v-for="l in LIEUX" :key="l" :value="l">{{ l === 'domicile' ? 'Domicile' : 'Salle' }}</option></select></label>
            <label>Statut<select v-model="nouvelle.statut"><option v-for="s in STATUTS_SEANCE" :key="s" :value="s">{{ s === 'prevue' ? 'Prévue' : s === 'faite' ? 'Faite' : 'Annulée' }}</option></select></label>
            <label class="c-court">Tarif (€)<input v-model.number="nouvelle.tarif" type="number" min="0" /></label>
          </div>
          <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>
          <button class="c-btn c-principal" type="submit">Ajouter</button>
        </form>
        <p class="c-doux c-petit">{{ paye.libelle }}</p>
        <div v-if="seancesTriees.length" class="c-liste">
          <div v-for="s in seancesTriees" :key="s.id" class="c-item" style="flex-wrap: wrap">
            <div style="flex: 1; min-width: 170px"><strong>{{ libelleSeance(s) }}</strong><div class="c-doux">{{ s.tarif }} €</div></div>
            <select :value="s.statut" :aria-label="`Statut de la séance du ${s.date}`" class="c-moyen" style="width: 120px !important" @change="changerStatut(s, $event.target.value)">
              <option value="prevue">Prévue</option><option value="faite">Faite</option><option value="annulee">Annulée</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <form class="c-carte" @submit.prevent="envoyerMot">
          <h2>Mot du coach</h2>
          <label>Message affiché sur le dashboard du client<textarea v-model="mot" placeholder="Beau travail cette semaine, on garde le cap !" /></label>
          <button class="c-btn c-principal" type="submit" style="margin-top: 10px">Publier</button>
        </form>
        <div v-if="d.mots.length" class="c-liste" style="margin-top: 12px">
          <div v-for="m in [...d.mots].sort((a, b) => b.date.localeCompare(a.date))" :key="m.id" class="c-item">
            <div style="flex: 1">{{ m.texte }}<div class="c-doux c-petit">{{ m.date }}</div></div>
            <button class="c-btn c-mini c-danger" @click="supprimerMot(m)">Retirer</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Réglages -->
    <section v-else>
      <form class="c-carte" style="max-width: 640px" @submit.prevent="enregistrerReglages">
        <h2>Réglages du client</h2>
        <div class="c-ligne c-bas" style="margin-bottom: 12px">
          <label style="flex: 2; min-width: 200px">Nom<input v-model="reglages.nom" required /></label>
          <label class="c-court">Tarif (€)<input v-model.number="reglages.tarif" type="number" min="0" /></label>
          <label class="c-moyen">Lieu par défaut<select v-model="reglages.lieuDefaut"><option v-for="l in LIEUX" :key="l" :value="l">{{ l === 'domicile' ? 'À domicile' : 'En salle' }}</option></select></label>
        </div>
        <div class="c-ligne" style="margin-bottom: 12px">
          <span class="c-doux c-petit">Nutrition :</span>
          <label class="c-case"><input v-model="reglages.modules.habitudes" type="checkbox" />Habitudes</label>
          <label class="c-case"><input v-model="reglages.modules.photosRepas" type="checkbox" />Photos de repas</label>
          <label class="c-case"><input v-model="reglages.modules.calories" type="checkbox" />Calories</label>
        </div>
        <!-- Liste des habitudes à cocher : une par ligne ; vide = habitudes proposées par défaut -->
        <label v-if="reglages.modules.habitudes" style="display: block; margin-bottom: 12px">
          Habitudes du client (une par ligne, 12 maximum)
          <textarea v-model="reglages.habitudesTexte" rows="5" :placeholder="HABITUDES_DEFAUT.join('\n')" style="width: 100%"></textarea>
          <span class="c-doux c-petit">Laisse vide pour garder les habitudes par défaut. Retirer une habitude la masque ; son historique est conservé.</span>
        </label>
        <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>
        <p v-if="info" class="c-info" role="status">{{ info }}</p>
        <div class="c-ligne">
          <button class="c-btn c-principal" type="submit">Enregistrer</button>
          <button class="c-btn" type="button" @click="genererNouveauCode">Nouveau code</button>
          <span class="c-espace" />
          <button class="c-btn c-danger" type="button" @click="archiver">Archiver ce client</button>
        </div>
        <div v-if="nouveauCode" class="c-carte" role="status" style="margin-top: 14px; border-color: var(--accent)">
          <p class="c-doux c-petit" style="margin-top: 0">Nouveau code généré : il ne sera plus affiché ensuite, transmets-le maintenant.</p>
          <div class="c-ligne" style="margin-bottom: 10px">
            <div><span class="c-doux c-petit">Identifiant</span><div class="c-secret">{{ nouveauCode.identifiant }}</div></div>
            <div><span class="c-doux c-petit">Code</span><div class="c-secret">{{ nouveauCode.code }}</div></div>
          </div>
          <div class="c-ligne">
            <button class="c-btn" type="button" @click="copier(messageIdentifiants(nouveauCode), 'Message copié')">Copier le message</button>
            <a class="c-btn c-principal" :href="lienWhatsAppIdentifiants(nouveauCode)" target="_blank" rel="noopener">Envoyer par WhatsApp</a>
            <button class="c-btn" type="button" @click="nouveauCode = null">Terminé</button>
            <span v-if="copie" class="c-ok c-petit">{{ copie }}</span>
          </div>
        </div>
        <p class="c-doux c-petit" style="margin-bottom: 0">Un client archivé ne peut plus se connecter ; ses données sont conservées.</p>
      </form>
    </section>
  </div>
  <p v-else-if="profil === null" class="c-vide">Client introuvable.</p>
</template>
