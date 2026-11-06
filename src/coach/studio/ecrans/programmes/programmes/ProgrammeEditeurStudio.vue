<script>
// Studio · éditeur de programme : bibliothèque des séances du client à glisser dans 8 colonnes (« Au choix » + Lundi … Dimanche),
// semaines S1…Sn (mode « par semaine ») ou « Chaque semaine » (mode répété), sauvegarde automatique.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import data from '../../../../../data/index.js'
import { jourLocal, lundiDe, jourSemaine } from '../../../../../domain/dates.js'
import { etat, maintenant, nomClient, rafraichir, uuid, messageErreur } from '../../../../store.js'
import { copie, resumeWorkout, retirerWorkoutDuProgramme } from '../../../../logique.js'
import IconeSt from '../../../IconeSt.vue'
import IndicateurSauvegarde from '../../../IndicateurSauvegarde.vue'
import { useSauvegardeAuto } from '../../../useSauvegardeAuto.js'
import { useRafraichirAuRetour } from '../../../useRafraichirAuRetour.js'
import { toast } from '../../../toast.js'
import { creerGlisser, AIDE_GLISSER } from '../commun/glisser.js'
import ListeTriable from '../commun/ListeTriable.vue'
import Poignee from '../commun/Poignee.vue'
import { NOMS_MUSCLES, teintesSeance } from '../commun/exercices.js'
import { COLONNES, JOURS, JOURS_ABR, colonnes, convertirMode, ecrireSemaine, idsSemaine, nomColonne, poser, pourEcriture, raisonInvalide, restaurerSemaines } from './planning.js'

// Mémo de module (semaine, jour ciblé) : reste utile si la vue est remontée (même chemin rouvert).
const reprise = new Map()
</script>

<script setup>
import { remplacerAdresse } from '../commun/adresse.js'
const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const estNouveau = props.id === 'nouveau'
let cree = false

const programme = ref(undefined)
const tous = ref([])
const exercices = ref([])
const semaine = ref(0)
const jourActif = ref('choix')
const nonEnregistre = ref(false)
const quitterVers = ref('')
let forcerSortie = false

// ------------------------------------------------------------------ sauvegarde automatique
// Conflit (Claude ou un autre appareil a modifié le programme) : voir src/coach/studio/LISEZMOI.md « Conflits ».
const s = useSauvegardeAuto(async (p, opts) => {
  if (estNouveau && !cree) {
    let r
    try {
      r = await data.programmes.creer(p)
    } catch (e) {
      if (e?.code !== 'EXISTE') throw e
      r = await data.programmes.modifier(p.id, p)
    }
    s.suivreVersion(r?.version) // le programme existe : les écritures suivantes sont contrôlées
    cree = true
    estCree.value = true
    // Adresse mise à jour sans navigation : l'éditeur n'est pas remonté (saisie, glisser et semaine courante conservés).
    if (/\/nouveau$/.test(location.pathname)) remplacerAdresse(`/coach/programmes/${p.id}`)
    return r
  }
  return data.programmes.modifier(p.id, p, opts)
}, { recharger: remplacerProgramme, resumer: (p) => p.nom })

// Programme enregistré ailleurs (après « Recharger » ou au retour sur l'onglet) : remplace l'affichage, sans réécrire.
let sansSauvegarde = false
function remplacerProgramme(p) {
  sansSauvegarde = true
  programme.value = { joursFixes: {}, ...copie(p) }
  if (programme.value.mode === 'parSemaine') semaine.value = Math.min(semaine.value, Math.max(0, (programme.value.semaines?.length || 1) - 1))
}
useRafraichirAuRetour(async () => {
  if (!programme.value || (estNouveau && !cree)) return
  const p = await data.programmes.lire(programme.value.id)
  if (!p || p.version === programme.value.version || s.occupe()) return
  remplacerProgramme(p)
  s.suivreVersion(p.version)
}, { sauvegarde: s })
const estCree = ref(!estNouveau)
const raison = computed(() => (programme.value ? raisonInvalide(programme.value) : ''))
const messageErreurSauve = computed(() => (s.etat.value === 'erreur' ? messageErreur(s.erreur.value) : ''))

onMounted(async () => {
  await rafraichir()
  const [w, ex] = await Promise.all([data.workouts.lister(), data.exercices.lister().catch(() => [])])
  tous.value = w
  exercices.value = ex
  if (estNouveau) {
    const c = etat.clients.find((x) => x.id === route.query.client)
    programme.value = { id: uuid(), clientId: c?.id || '', nom: c ? `Programme ${c.nom}` : '', mode: 'repete', debut: lundiDe(jourLocal(maintenant())), workouts: [], joursFixes: {} }
  } else {
    const p = await data.programmes.lire(props.id)
    programme.value = p ? { joursFixes: {}, ...copie(p) } : null
    s.suivreVersion(p?.version)
  }
  if (!programme.value) return
  const r = reprise.get(props.id)
  if (r) {
    reprise.delete(props.id)
    jourActif.value = r.jourActif
    semaine.value = Math.min(r.semaine, Math.max(0, (programme.value.semaines?.length || 1) - 1))
  }
  watch(programme, (v) => {
    if (!v) return
    if (sansSauvegarde) { sansSauvegarde = false; return }
    if (raisonInvalide(v)) { nonEnregistre.value = true; return }
    nonEnregistre.value = false
    s.planifier(pourEcriture(v))
  }, { deep: true })
})

// ------------------------------------------------------------------ séances du client
const parId = (id) => exercices.value.find((e) => e.id === id)
const nomExercice = (id) => parId(id)?.nom || '?'
const seancesDuClient = computed(() => tous.value.filter((w) => w.clientId && w.clientId === programme.value?.clientId))
const workout = (id) => tous.value.find((w) => w.id === id)
const nomW = (id) => workout(id)?.nom || '(séance supprimée)'
const resume = (id) => (workout(id) ? resumeWorkout(workout(id), nomExercice).libelle : 'Cette séance n’existe plus')
const teintes = (id) => (workout(id) ? teintesSeance(workout(id), parId) : [])

const ids = computed(() => (programme.value ? idsSemaine(programme.value, semaine.value) : []))
const cols = computed(() => colonnes(ids.value, programme.value?.joursFixes || {}))
// Ordinateur : jours vides repliés en bandes étroites (les 8 colonnes ne tiennent pas à 1366 px) ; toucher une bande la cible et la déplie.
const tousLesJours = ref(false)
const replie = (c) => !tousLesJours.value && c !== 'choix' && c !== jourActif.value && !cols.value[c].length
const nbReplies = computed(() => COLONNES.filter(replie).length)
const gabaritJours = computed(() => ({ gridTemplateColumns: COLONNES.map((c) => (replie(c) ? '48px' : 'minmax(128px, 1fr)')).join(' ') }))

// Téléphone : bibliothèque collante repliable ; sa hauteur place la barre des semaines juste dessous (jamais masquée).
const biblioOuverte = ref(true)
const biblioEl = ref(null)
const hautBiblio = ref(0)
let observateur = null
watch(biblioEl, (el) => {
  observateur?.disconnect()
  if (!el || typeof ResizeObserver === 'undefined') return
  observateur = new ResizeObserver(() => { hautBiblio.value = Math.round(el.getBoundingClientRect().height) })
  observateur.observe(el)
})
onBeforeUnmount(() => observateur?.disconnect())

const placeDe = (id) => {
  if (!ids.value.includes(id)) return ''
  const j = programme.value.joursFixes?.[id]
  return Number.isInteger(j) ? JOURS[j] : 'au choix'
}

// ------------------------------------------------------------------ glisser-déposer
const colDeListe = (liste) => { const k = liste.slice(4); return k === 'choix' ? 'choix' : Number(k) }
function appliquer({ origine, donnee, cible }) {
  const p = programme.value
  const res = poser({ ids: idsSemaine(p, semaine.value), joursFixes: p.joursFixes || {} }, {
    source: origine ? { col: colDeListe(origine.liste), index: origine.index } : null,
    id: donnee,
    cible
  })
  if (!res) return false
  ecrireSemaine(p, semaine.value, res.ids)
  p.joursFixes = res.joursFixes
  const ou = cible.col === 'choix' ? '« au choix du client »' : JOURS[cible.col]
  if (res.dejaLa) return `${nomW(res.id)} était déjà dans la semaine : déplacée vers ${ou}`
  return res.deplace ? `${nomW(res.id)} déplacée vers ${ou}` : `${nomW(res.id)} ajoutée à ${ou}`
}
const g = creerGlisser({
  surDeposer: ({ origine, donnee, cible }) => {
    const col = colDeListe(cible.liste)
    return appliquer({ origine, donnee, cible: { col, index: cible.index } })
  },
  surAjouter: (id) => appliquer({ origine: null, donnee: id, cible: { col: jourActif.value, index: Infinity } }),
  capturer: () => copie(programme.value),
  restaurer: (x) => {
    programme.value = copie(x)
    if (programme.value.mode === 'parSemaine') semaine.value = Math.min(semaine.value, programme.value.semaines.length - 1)
  }
})

function retirer(id) {
  const avant = copie(programme.value)
  programme.value = retirerWorkoutDuProgramme(programme.value, id, semaine.value)
  toast(`${nomW(id)} retirée${programme.value.mode === 'parSemaine' ? ` de la semaine ${semaine.value + 1}` : ''}`, { action: 'Annuler', duree: 8000, surAction: () => { programme.value = avant } })
}

// ------------------------------------------------------------------ réglages
function changerClient(nouveau) {
  const p = programme.value
  const ancien = p.clientId
  if (nouveau === ancien) return
  // Les séances appartiennent à un client : changer de client vide la sélection.
  if (p.mode === 'repete') p.workouts = []
  else p.semaines = p.semaines.map(() => [])
  p.joursFixes = {}
  if (!p.nom.trim() || p.nom === `Programme ${nomClient(ancien)}`) p.nom = `Programme ${nomClient(nouveau)}`
  p.clientId = nouveau
}
// Répartition par semaine gardée en mémoire tant qu'on reste en « répété » : revenir à « différent » la restaure.
let memoSemaines = null
function changerMode(mode) {
  const p = programme.value
  if (mode === p.mode) return
  const avant = copie(p)
  const semAvant = semaine.value
  const memoAvant = memoSemaines
  const nouveau = convertirMode(p, mode)
  let message
  if (mode === 'repete') {
    memoSemaines = copie(p.semaines || [])
    message = memoSemaines.length > 1 ? `Séances des ${memoSemaines.length} semaines regroupées. Revenir à « Différent » restaure la répartition.` : 'Mêmes séances chaque semaine'
  } else if (memoSemaines) {
    nouveau.semaines = restaurerSemaines(memoSemaines, p.workouts || [])
    memoSemaines = null
    message = `Répartition des ${nouveau.semaines.length} semaines restaurée`
  } else {
    const n = nouveau.semaines.length
    message = n > 1 ? `Séances copiées dans les ${n} semaines` : 'Une semaine créée : ajoute les suivantes avec « Copier » ou « Semaine vide »'
  }
  programme.value = nouveau
  semaine.value = 0
  toast(message, { action: 'Annuler', duree: 8000, surAction: () => { programme.value = avant; semaine.value = semAvant; memoSemaines = memoAvant } })
}
const pasLundi = computed(() => programme.value?.debut && /^\d{4}-\d{2}-\d{2}$/.test(programme.value.debut) && jourSemaine(programme.value.debut) !== 0)
const nbSemainesTexte = computed({
  get: () => programme.value?.nbSemaines ?? '',
  set: (v) => { const n = Number(v); if (v === '' || !(n >= 1)) delete programme.value.nbSemaines; else programme.value.nbSemaines = Math.floor(n) }
})

// ------------------------------------------------------------------ semaines (mode par semaine)
// Nouvelle semaine juste après la semaine affichée : copie de celle-ci, ou vide.
function ajouterSemaine() {
  const i = semaine.value
  programme.value.semaines.splice(i + 1, 0, [])
  semaine.value = i + 1
  toast(`Semaine ${i + 2} ajoutée, vide`)
}
function dupliquerSemaine() {
  const i = semaine.value
  programme.value.semaines.splice(i + 1, 0, [...programme.value.semaines[i]])
  semaine.value = i + 1
  toast(`Semaine ${i + 1} copiée en semaine ${i + 2}`)
}
function supprimerSemaine() {
  const p = programme.value
  if (p.semaines.length < 2) return
  const avant = copie(p)
  const i = semaine.value
  p.semaines.splice(i, 1)
  const restants = new Set(p.semaines.flat())
  p.joursFixes = Object.fromEntries(Object.entries(p.joursFixes || {}).filter(([k]) => restants.has(k)))
  semaine.value = Math.min(i, p.semaines.length - 1)
  toast(`Semaine ${i + 1} supprimée`, { action: 'Annuler', duree: 8000, surAction: () => { programme.value = avant; semaine.value = i } })
}

// ------------------------------------------------------------------ sortie de page
onBeforeRouteLeave(async (to) => {
  if (forcerSortie || !programme.value) return true
  try { await s.maintenant() } catch { /* l'état passe en erreur */ }
  if (s.etat.value === 'erreur' || s.etat.value === 'conflit' || nonEnregistre.value) { quitterVers.value = to.fullPath; return false }
  return true
})
function quitterQuandMeme() { forcerSortie = true; router.push(quitterVers.value) }
const avantDecharger = (e) => {
  if (nonEnregistre.value || ['attente', 'encours', 'erreur', 'conflit'].includes(s.etat.value)) { e.preventDefault(); e.returnValue = '' }
}
window.addEventListener('beforeunload', avantDecharger)
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', avantDecharger)
  s.arreter()
  g.detruire()
})
</script>

<template>
  <div v-if="programme" class="st-prog-p-ed" :style="{ '--st-prog-p-hb': `${hautBiblio}px` }">
    <RouterLink to="/coach/programmes" class="st-prog-p-retour">← Programmes</RouterLink>
    <header class="st-entete">
      <div>
        <p>{{ programme.clientId ? `Programme · ${nomClient(programme.clientId)}` : 'Nouveau programme' }}</p>
        <h1>{{ programme.nom.trim() || 'Nouveau programme' }}</h1>
      </div>
      <div class="st-actions">
        <span v-if="raison && nonEnregistre" class="st-puce st-puce--alerte st-prog-p-invalide" role="status">Non enregistré : {{ raison }}</span>
        <IndicateurSauvegarde v-else-if="s.etat.value !== 'conflit'" :etat="s.etat.value" :conflit="s.conflit.value" @reessayer="s.reessayer" @recharger="s.recharger" />
      </div>
    </header>
    <!-- « Modifié ailleurs » : collant en haut de l'écran, visible même quand on travaille en bas des colonnes -->
    <IndicateurSauvegarde v-if="s.etat.value === 'conflit' && !(raison && nonEnregistre)" class="st-prog-conflit" etat="conflit" :conflit="s.conflit.value" @recharger="s.recharger" />

    <p v-if="messageErreurSauve" class="st-prog-p-erreur" role="alert">Non enregistré : {{ messageErreurSauve }}</p>
    <div v-if="quitterVers" class="st-prog-p-quitter" role="alertdialog" aria-labelledby="st-prog-p-quitter-t">
      <p id="st-prog-p-quitter-t"><strong>Des changements ne sont pas enregistrés.</strong> {{ raison ? `Il faut d'abord : ${raison}.` : s.etat.value === 'conflit' ? 'Programme modifié ailleurs (Claude ou un autre appareil) : recharge-le.' : 'L’enregistrement a échoué.' }}</p>
      <div>
        <button type="button" class="st-btn st-btn--encre" @click="quitterVers = ''">Rester</button>
        <button type="button" class="st-btn st-btn--fantome" @click="quitterQuandMeme">Quitter sans enregistrer</button>
      </div>
    </div>

    <!-- Réglages -->
    <section class="st-bloc st-prog-p-reglages" aria-label="Réglages du programme">
      <label class="st-prog-p-champ st-prog-p-champ--nom">Nom du programme
        <input v-model="programme.nom" maxlength="80" :placeholder="programme.clientId ? `Programme ${nomClient(programme.clientId)}` : 'Nouveau programme'" />
      </label>
      <label class="st-prog-p-champ">Client
        <select :value="programme.clientId" :disabled="estCree" @change="changerClient($event.target.value)">
          <option value="" disabled>Choisir un client…</option>
          <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
        </select>
      </label>
      <div class="st-prog-p-champ">
        <span id="st-prog-p-mode-t">Rythme</span>
        <div class="st-prog-p-segment" role="group" aria-labelledby="st-prog-p-mode-t">
          <button type="button" :aria-pressed="programme.mode === 'repete'" @click="changerMode('repete')">Répété chaque semaine</button>
          <button type="button" :aria-pressed="programme.mode === 'parSemaine'" @click="changerMode('parSemaine')">Différent chaque semaine</button>
        </div>
      </div>
      <label class="st-prog-p-champ st-prog-p-champ--court">Début (lundi)
        <input v-model="programme.debut" type="date" :aria-invalid="pasLundi || undefined" />
        <small v-if="pasLundi" class="st-prog-p-alerte">Ce n'est pas un lundi.</small>
      </label>
      <label v-if="programme.mode === 'repete'" class="st-prog-p-champ st-prog-p-champ--court">Semaines
        <input v-model="nbSemainesTexte" type="number" min="1" inputmode="numeric" placeholder="Sans fin" />
      </label>
    </section>

    <div class="st-prog-p-grille">
      <!-- Bibliothèque : séances du client -->
      <aside ref="biblioEl" class="st-prog-p-biblio" aria-labelledby="st-prog-p-biblio-t">
        <button type="button" class="st-prog-p-biblio-bascule" :aria-expanded="biblioOuverte" aria-controls="st-prog-p-biblio-corps" @click="biblioOuverte = !biblioOuverte">
          <span>Ajouter à <strong>{{ nomColonne(jourActif) }}</strong></span>
          <small>{{ biblioOuverte ? 'Replier' : `${seancesDuClient.length} séance${seancesDuClient.length > 1 ? 's' : ''}` }}</small>
          <IconeSt :nom="biblioOuverte ? 'haut' : 'bas'" />
        </button>
        <div id="st-prog-p-biblio-corps" class="st-prog-p-biblio-corps" :class="{ 'is-replie': !biblioOuverte }">
        <h2 id="st-prog-p-biblio-t">Séances {{ programme.clientId ? `de ${nomClient(programme.clientId)}` : '' }}</h2>
        <p class="st-prog-p-biblio-aide"><span class="st-prog-p-large">Glisse une séance dans un jour, ou touche-la pour l'ajouter à </span><span class="st-prog-p-etroit">Touche une séance pour l'ajouter à </span><strong>{{ nomColonne(jourActif) }}</strong>.</p>
        <ul v-if="seancesDuClient.length" class="st-prog-p-biblio-liste">
          <li v-for="w in seancesDuClient" :key="w.id">
            <button type="button" class="st-prog-p-source" v-bind="g.source({ donnee: w.id, type: 'seance' })" :aria-label="`Ajouter ${w.nom} à ${nomColonne(jourActif)}`">
              <span class="st-prog-p-bandeau" aria-hidden="true"><i v-for="t in teintes(w.id)" :key="t" :data-m="t" /></span>
              <strong>{{ w.nom }}</strong>
              <small class="st-prog-p-resume">{{ resume(w.id) }}</small>
              <small v-if="placeDe(w.id)" class="st-prog-p-deja"><IconeSt nom="check" /><span class="st-prog-p-deja-long">Dans la semaine · </span>{{ placeDe(w.id) }}</small>
            </button>
          </li>
          <li v-if="programme.clientId" class="st-prog-p-nouvelle-li"><RouterLink :to="`/coach/seances/nouveau?client=${programme.clientId}`" class="st-prog-p-nouvelle-carte"><IconeSt nom="plus" />Nouvelle séance</RouterLink></li>
        </ul>
        <p v-else-if="programme.clientId" class="st-prog-p-biblio-vide">{{ nomClient(programme.clientId) }} n'a pas encore de séance.</p>
        <p v-else class="st-prog-p-biblio-vide">Choisis d'abord un client.</p>
        <RouterLink v-if="programme.clientId" :to="`/coach/seances/nouveau?client=${programme.clientId}`" class="st-btn st-btn--fantome st-prog-p-nouvelle"><IconeSt nom="plus" />Nouvelle séance pour {{ nomClient(programme.clientId) }}</RouterLink>
        </div>
      </aside>

      <div class="st-prog-p-plan">
        <!-- Semaines -->
        <div v-if="programme.mode === 'parSemaine'" class="st-prog-p-semaines">
          <div role="group" aria-label="Semaines" class="st-prog-p-pastilles">
            <button v-for="(sm, i) in programme.semaines" :key="i" type="button" :aria-pressed="semaine === i" :aria-label="`Semaine ${i + 1}, ${sm.length} séance${sm.length > 1 ? 's' : ''}`" @click="semaine = i">S{{ i + 1 }}<small v-if="sm.length">{{ sm.length }}</small></button>
          </div>
          <div class="st-prog-p-sem-actions" role="group" aria-label="Nouvelle semaine">
            <button type="button" class="st-btn st-btn--fantome" @click="dupliquerSemaine"><IconeSt nom="plus" />Copier S{{ semaine + 1 }}<span class="st-sr"> dans une nouvelle semaine</span></button>
            <button type="button" class="st-btn st-btn--fantome" @click="ajouterSemaine"><IconeSt nom="plus" />Semaine vide</button>
            <button v-if="programme.semaines.length > 1" type="button" class="st-btn st-btn--fantome st-prog-p-danger" @click="supprimerSemaine">Supprimer S{{ semaine + 1 }}</button>
          </div>
        </div>
        <div v-else class="st-prog-p-semaines">
          <span class="st-puce st-puce--ok st-prog-p-chaque">Chaque semaine{{ programme.nbSemaines ? ` · ${programme.nbSemaines} semaines` : ' · sans fin' }}</span>
          <small class="st-prog-p-note">Mêmes séances chaque semaine ; le client progresse grâce au pré-remplissage.</small>
        </div>

        <!-- Jours -->
        <div v-if="nbReplies || tousLesJours" class="st-prog-p-jours-outils">
          <button type="button" class="st-btn st-btn--fantome st-prog-mini" :aria-pressed="tousLesJours" @click="tousLesJours = !tousLesJours">{{ tousLesJours ? 'Replier les jours sans séance' : `Afficher les 7 jours (${nbReplies} repliés)` }}</button>
        </div>
        <div class="st-prog-p-jours" data-st-defile-x :style="gabaritJours">
          <section
            v-for="c in COLONNES" :key="c" class="st-prog-p-jour"
            :class="{ 'is-choix': c === 'choix', 'is-actif': jourActif === c, 'is-replie': replie(c) }"
            :aria-labelledby="`st-prog-p-j-${c}`" @click="jourActif = c"
          >
            <h3>
              <button :id="`st-prog-p-j-${c}`" type="button" :aria-pressed="jourActif === c" :title="`Cibler ${nomColonne(c)}`" @click.stop="jourActif = c">
                <span class="st-prog-p-j-long">{{ nomColonne(c) }}</span>
                <span v-if="c !== 'choix'" class="st-prog-p-j-abr" aria-hidden="true">{{ JOURS_ABR[c] }}</span>
                <small>{{ cols[c].length ? `${cols[c].length} séance${cols[c].length > 1 ? 's' : ''}` : (c === 'choix' ? 'le client place' : 'repos') }}</small>
              </button>
            </h3>
            <ListeTriable :glisser="g" :id="`col-${c}`" type="seance" :items="cols[c]" :cle="(x) => x" :libelle="nomW" :etiquette="nomColonne(c)" class="st-prog-p-cartes">
              <template #default="{ item, poignee, tirable }">
                <article class="st-prog-p-posee" v-bind="tirable">
                  <span class="st-prog-p-bandeau" aria-hidden="true"><i v-for="t in teintes(item)" :key="t" :data-m="t" /></span>
                  <div class="st-prog-p-posee-tete">
                    <Poignee v-bind="poignee" />
                    <strong>{{ nomW(item) }}</strong>
                  </div>
                  <small>{{ resume(item) }}</small>
                  <small v-if="teintes(item).length" class="st-prog-p-muscles">{{ teintes(item).map((t) => NOMS_MUSCLES[t]).join(' · ') }}</small>
                  <div class="st-prog-p-posee-actions">
                    <RouterLink v-if="workout(item)" :to="`/coach/seances/${item}`" class="st-prog-p-icone" :aria-label="`Ouvrir ${nomW(item)}`" title="Ouvrir la séance"><IconeSt nom="seance" /></RouterLink>
                    <button type="button" class="st-prog-p-icone st-prog-p-danger" :aria-label="`Retirer ${nomW(item)}`" title="Retirer" @click.stop="retirer(item)"><IconeSt nom="fermer" /></button>
                  </div>
                </article>
              </template>
              <template #vide>
                <div class="st-prog-p-vide-jour">{{ jourActif === c ? 'Touche une séance pour l’ajouter ici' : 'Glisse une séance ici' }}</div>
              </template>
            </ListeTriable>
          </section>
        </div>
        <p class="st-prog-p-note st-prog-p-note--jours">
          <strong>Le jour choisi vaut pour tout le programme</strong>{{ programme.mode === 'parSemaine' ? ' : une séance posée le mercredi en S1 tombe aussi le mercredi dans les autres semaines où elle figure.' : '.' }}
          « Au choix du client » : il place la séance lui-même en la validant.
        </p>
      </div>
    </div>

    <p class="st-sr" aria-live="assertive">{{ g.annonce.value }}</p>
    <p id="st-gl-aide" class="st-sr">{{ AIDE_GLISSER }}</p>
  </div>
  <div v-else-if="programme === null" class="st-prog-p-vide">
    <h2>Programme introuvable</h2>
    <p>Il a peut-être été archivé.</p>
    <RouterLink to="/coach/programmes" class="st-btn">← Programmes</RouterLink>
  </div>
</template>

<style>
.st-prog-p-ed { animation: st-prog-monte var(--st-d-base) var(--st-sortie); }
.st-prog-p-retour { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: 4px; color: var(--st-doux); font-weight: 600; text-decoration: none; }
.st-prog-p-retour:hover { color: var(--st-encre); }
.st-prog-p-ed .st-entete h1 { overflow-wrap: anywhere; }
.st-prog-p-invalide { height: auto; min-height: 32px; white-space: normal; }
.st-prog-p-quitter { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 14px 16px; border-radius: var(--st-r-m); background: var(--st-propose-fond); color: var(--st-propose); animation: st-prog-monte var(--st-d-court) var(--st-sortie); }
.st-prog-p-quitter p { margin: 0; color: var(--st-texte); }
.st-prog-p-quitter div { display: flex; gap: 8px; flex-wrap: wrap; }

.st-prog-p-reglages { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px 16px; align-items: start; margin-bottom: 18px; }
.st-prog-p-champ { display: grid; gap: 5px; font-size: 13px; font-weight: 600; color: var(--st-encre); min-width: 0; grid-column: span 2; }
.st-prog-p-champ--court { grid-column: span 1; }
.st-prog-p-champ input, .st-prog-p-champ select { min-height: 46px; width: 100%; padding: 0 12px; border-radius: var(--st-r-s); border: 1px solid var(--st-filet-fort); background: var(--st-fond); font-size: 15px; font-weight: 500; }
/* Champs : anneau au focus (aussi pour le champ date, dont le focus est interne) */
.st-prog-p-champ input:focus, .st-prog-p-champ select:focus-visible { outline: 2.5px solid var(--st-encre); outline-offset: 2px; }
.st-prog-p-champ:focus-within :is(input, select) { box-shadow: 0 0 0 3px rgba(35, 37, 43, .2); }
.st-prog-p-champ select:disabled { opacity: 1; color: var(--st-doux); background: var(--st-surface-2); }
.st-prog-p-alerte { color: var(--st-alerte); font-weight: 600; }
.st-prog-p-segment { display: flex; padding: 3px; border-radius: 14px; background: var(--st-surface-2); }
.st-prog-p-segment button { flex: 1; white-space: nowrap; min-height: 44px; padding: 0 12px; border: 0; border-radius: 11px; background: transparent; font-weight: 600; font-size: 13.5px; color: var(--st-doux); transition: background var(--st-d-court), color var(--st-d-court); }
.st-prog-p-segment button[aria-pressed="true"] { background: var(--st-surface); color: var(--st-encre); box-shadow: var(--st-ombre-1); }

.st-prog-p-grille { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 20px; align-items: start; }
@media (max-width: 1440px) { .st-prog-p-grille { grid-template-columns: 252px minmax(0, 1fr); gap: 16px; } }
/* Bibliothèque : bascule et carte « Nouvelle séance » réservées au téléphone */
.st-prog-p-biblio-bascule, .st-prog-p-nouvelle-li, .st-prog-p-j-abr { display: none; }
/* Jours vides repliés (ordinateur) : bande étroite, toujours cible de dépôt ; la toucher la cible et la déplie */
.st-prog-p-jours-outils { display: flex; justify-content: flex-end; margin: -6px 0 6px; }
@media (min-width: 901px) {
  .st-prog-p-jour.is-replie { overflow: hidden; padding: 8px 2px; background: transparent; box-shadow: inset 0 0 0 1.5px var(--st-filet); cursor: pointer; }
  .st-prog-p-jour.is-replie:hover { background: var(--st-surface-2); }
  .st-prog-p-jour.is-replie h3 button { align-items: center; padding: 4px 0; }
  .st-prog-p-jour.is-replie :is(.st-prog-p-j-long, h3 small) { display: none; }
  .st-prog-p-jour.is-replie .st-prog-p-j-abr { display: block; font-size: 12.5px; }
  .st-prog-p-jour.is-replie .st-prog-p-vide-jour { visibility: hidden; }
  /* Toast : dans la colonne de la bibliothèque, jamais sur les colonnes des jours */
  .st-app:has(.st-prog-p-ed) .st-toast { left: calc(var(--st-nav) + clamp(16px, 3vw, 40px)); width: 252px; max-width: 252px; transform: translateY(calc(100% + 60px)); }
  .st-app:has(.st-prog-p-ed) .st-toast.is-vu { transform: none; }
  .st-app:has(.st-prog-p-ed) .st-toast { flex-wrap: wrap; justify-content: flex-end; row-gap: 0; padding-top: 12px; }
  .st-app:has(.st-prog-p-ed) .st-toast > span { flex: 1 1 100%; }
}
/* Bandeau « Modifié ailleurs » collant (au-dessus de la bibliothèque collante) */
.st-prog-p-ed .st-prog-conflit { position: sticky; top: 8px; z-index: 8; margin: 0 0 14px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
.st-prog-p-biblio { position: sticky; top: 16px; max-height: calc(100dvh - 32px); overflow: auto; padding: 14px; border-radius: var(--st-r-l); background: var(--st-surface); box-shadow: var(--st-ombre-1); z-index: 5; }
.st-prog-p-biblio h2 { margin: 4px 4px 4px; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--st-doux); }
.st-prog-p-biblio-aide { margin: 0 4px 12px; font-size: 13px; color: var(--st-doux); }
.st-prog-p-biblio-aide strong { color: var(--st-encre); }
.st-prog-p-biblio-liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.st-prog-p-source { position: relative; display: grid; gap: 3px; width: 100%; padding: 16px 12px 10px; border: 0; border-radius: 14px; background: var(--st-fond); text-align: left; overflow: hidden; cursor: grab; -webkit-user-select: none; user-select: none; transition: transform var(--st-d-appui) ease-out, background var(--st-d-court), box-shadow var(--st-d-court); }
/* la carte tirée est clonée en fantôme : il doit rester fixe et suivre le pointeur sans transition */
.st-prog-p-source.st-gl-fantome { position: fixed; transition: none; box-shadow: var(--st-ombre-3); background: var(--st-surface); }
.st-gl-fantome .st-prog-p-posee { animation: none; }
.st-prog-p-source:hover { background: var(--st-surface); box-shadow: var(--st-ombre-2); }
.st-prog-p-source:active { transform: scale(.97); }
.st-prog-p-source strong { font-size: 14px; font-weight: 600; color: var(--st-encre); line-height: 1.25; overflow-wrap: anywhere; }
.st-prog-p-source small, .st-prog-p-posee small { font-size: 12.5px; color: var(--st-doux); }
.st-prog-p-deja { display: inline-flex; align-items: center; gap: 4px; color: var(--st-ok) !important; font-weight: 600; }
.st-prog-p-deja svg { width: 14px; height: 14px; }
.st-prog-p-bandeau { position: absolute; left: 0; right: 0; top: 0; height: 6px; display: flex; background: var(--st-surface-2); }
.st-prog-p-bandeau i { flex: 1; background: var(--mi); }
.st-prog-p-biblio-vide { margin: 0 4px 8px; font-size: 13.5px; color: var(--st-doux); }
.st-prog-p-etroit { display: none; }
.st-prog-p-nouvelle { width: 100%; margin-top: 8px; justify-content: flex-start; font-size: 13.5px; text-align: left; }

.st-prog-p-semaines { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 14px; }
.st-prog-p-pastilles { display: flex; flex-wrap: wrap; gap: 6px; }
.st-prog-p-pastilles button { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; min-width: 52px; padding: 0 16px; border-radius: 22px; border: 1px solid var(--st-filet-fort); background: var(--st-surface); font-weight: 700; color: var(--st-encre); transition: background var(--st-d-court), transform var(--st-d-appui); }
.st-prog-p-pastilles button:active { transform: scale(.95); }
.st-prog-p-pastilles button small { font-size: 11.5px; font-weight: 600; color: var(--st-doux); }
.st-prog-p-pastilles button[aria-pressed="true"] { background: var(--st-encre); border-color: var(--st-encre); color: #fff; }
.st-prog-p-pastilles button[aria-pressed="true"] small { color: rgba(255,255,255,.8); }
.st-prog-p-plus { padding: 0 !important; width: 44px; min-width: 44px !important; justify-content: center; border-style: dashed !important; }
.st-prog-p-plus svg { width: 18px; height: 18px; }
.st-prog-p-sem-actions { display: flex; gap: 4px; margin-left: auto; }
.st-prog-p-danger { color: var(--st-alerte) !important; }
.st-prog-p-chaque { height: 32px; font-size: 13.5px; }
.st-prog-p-note { font-size: 13px; color: var(--st-doux); }
.st-prog-p-note--jours { margin: 12px 2px 0; max-width: 80ch; }
.st-prog-p-note strong { color: var(--st-encre); }

.st-prog-p-jours { display: grid; grid-template-columns: repeat(8, minmax(128px, 1fr)); gap: 8px; overflow-x: auto; padding: 2px 2px 10px; scroll-snap-type: x proximity; }
.st-prog-p-jour { scroll-snap-align: start; display: flex; flex-direction: column; gap: 8px; min-height: 300px; padding: 8px; border-radius: 18px; background: var(--st-surface-2); transition: box-shadow var(--st-d-court), background var(--st-d-court); }
.st-prog-p-jour.is-choix { background: color-mix(in srgb, var(--st-jaune) 30%, var(--st-surface-2)); }
.st-prog-p-jour.is-actif { box-shadow: inset 0 0 0 2px var(--st-encre); }
.st-prog-p-jour h3 { margin: 0; }
.st-prog-p-jour h3 button { display: flex; flex-direction: column; align-items: flex-start; width: 100%; min-height: 44px; padding: 4px 8px; border: 0; border-radius: 12px; background: transparent; text-align: left; }
.st-prog-p-jour h3 button span { font-size: 13.5px; font-weight: 700; color: var(--st-encre); }
.st-prog-p-jour h3 button small { font-size: 12px; font-weight: 500; color: var(--st-doux); }
.st-prog-p-jour h3 button[aria-pressed="true"] span::after { content: ' · cible'; font-weight: 600; color: var(--st-ok); }
.st-prog-p-cartes { flex: 1; --st-gl-ecart: 8px; min-height: 120px; padding: 2px; }
.st-prog-p-posee { position: relative; display: grid; gap: 3px; padding: 14px 8px 6px 10px; border-radius: 14px; background: var(--st-surface); box-shadow: var(--st-ombre-1); overflow: hidden; cursor: grab; animation: st-prog-p-pop .35s var(--st-ressort); }
@keyframes st-prog-p-pop { from { transform: scale(.9); } }
.st-prog-p-posee-tete { display: flex; align-items: flex-start; gap: 4px; }
.st-prog-p-posee-tete .st-gl-poignee { margin: -8px 0 -8px -8px; }
.st-prog-p-posee-tete strong { font-size: 13.5px; font-weight: 600; line-height: 1.25; color: var(--st-encre); padding-top: 5px; overflow-wrap: anywhere; }
.st-prog-p-muscles { font-weight: 600; }
.st-prog-p-posee-actions { display: flex; justify-content: flex-end; gap: 2px; margin: 0 -4px -2px 0; }
.st-prog-p-icone { display: inline-grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 10px; background: transparent; color: var(--st-doux); transition: background var(--st-d-court); }
.st-prog-p-icone:hover { background: var(--st-surface-2); color: var(--st-encre); }
.st-prog-p-icone svg { width: 18px; height: 18px; }
.st-prog-p-vide-jour { flex: 1; display: grid; place-items: center; min-height: 110px; padding: 10px; border: 1.5px dashed var(--st-filet-fort); border-radius: 12px; text-align: center; font-size: 12.5px; color: var(--st-doux); }
.st-prog-p-erreur { margin: 0 0 14px; padding: 10px 12px; border-radius: var(--st-r-s); background: var(--st-alerte-fond); color: var(--st-alerte); font-weight: 600; font-size: 14px; }

@media (max-width: 1100px) { .st-prog-p-segment button { white-space: normal; line-height: 1.2; } }
@media (max-width: 900px) {
  .st-prog-p-reglages { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 14px; }
  .st-prog-p-grille { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .st-prog-p-biblio { top: 0; max-height: none; overflow: visible; padding: 10px 0 10px 10px; margin: 0 -4px; border-radius: 0 0 var(--st-r-l) var(--st-r-l); box-shadow: var(--st-ombre-2); }
  .st-prog-p-biblio h2 { display: none; }
  .st-prog-p-biblio-aide { margin: 0 10px 8px 4px; font-size: 13px; }
  .st-prog-p-large, .st-prog-p-resume { display: none; }
  .st-prog-p-etroit { display: inline; }
  .st-prog-p-biblio-liste { display: flex; overflow-x: auto; gap: 8px; padding: 0 10px 4px 0; scroll-snap-type: x proximity; scrollbar-width: none; }
  .st-prog-p-biblio-liste li { flex: 0 0 150px; scroll-snap-align: start; }
  .st-prog-p-source { height: 100%; min-height: 56px; padding: 12px 10px 7px; align-content: start; }
  .st-prog-p-source strong { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .st-prog-p-source strong { font-size: 13.5px; }
  .st-prog-p-nouvelle { width: auto; margin: 4px 0 0 -6px; min-height: 44px; font-size: 13px; }
  .st-prog-p-jours { grid-template-columns: minmax(0, 1fr) !important; overflow: visible; }
  .st-prog-p-jours-outils { display: none; }
  .st-prog-p-biblio-bascule { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 0 12px 0 4px; border: 0; background: none; text-align: left; font-size: 14px; color: var(--st-texte); }
  .st-prog-p-biblio-bascule span { flex: 1; min-width: 0; }
  .st-prog-p-biblio-bascule strong { color: var(--st-encre); }
  .st-prog-p-biblio-bascule small { font-size: 12.5px; font-weight: 600; color: var(--st-doux); }
  .st-prog-p-biblio-bascule svg { width: 18px; height: 18px; flex: none; }
  .st-prog-p-biblio-corps.is-replie { display: none; }
  .st-prog-p-biblio-aide, .st-prog-p-nouvelle, .st-prog-p-deja-long { display: none !important; }
  .st-prog-p-nouvelle-li { display: block; }
  .st-prog-p-nouvelle-carte { display: flex; align-items: center; justify-content: center; gap: 6px; height: 100%; min-height: 56px; padding: 0 10px; border: 1.5px dashed var(--st-filet-fort); border-radius: 14px; color: var(--st-encre); font-size: 13px; font-weight: 600; text-decoration: none; }
  .st-prog-p-nouvelle-carte svg { width: 16px; height: 16px; }
  /* Semaines collées sous la bibliothèque : jamais masquées */
  .st-prog-p-semaines:has(.st-prog-p-pastilles) { position: sticky; top: var(--st-prog-p-hb, 0px); z-index: 4; margin: 0 -6px 12px; padding: 6px; background: var(--st-fond); }
  .st-prog-p-pastilles { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
  .st-prog-p-jour { min-height: 0; }
  .st-prog-p-cartes { min-height: 0; }
  .st-prog-p-vide-jour { min-height: 52px; }
  .st-prog-p-sem-actions { margin-left: 0; }
}
/* Entrées sans fondu d'opacité : texte lisible pendant tout le mouvement (contraste mesuré en temps réel) */
@keyframes st-prog-monte { from { transform: translateY(14px); } }
</style>
