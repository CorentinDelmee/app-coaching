<script setup>
// Studio · fiche client : bandeau teinté, onglets à soulignement glissant. Reprend TOUT ce que permettait ClientView :
// calendrier (faites / prévues / coaching), séances faites + charges, réponses aux questionnaires (PAR-Q, bilans, check-ins),
// courbes (poids, douleur, volume, tours), séances de coaching (ajout, statut, payé ce mois), mot du coach (publier, retirer),
// fiche privée (contact, notes), réglages (nom, tarif, lieu, modules nutrition, habitudes), nouveau code, archivage / restauration,
// alertes (marquer vu), liens Nouvelle séance / Nouveau programme / ouvrir le programme.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import data from '../../../../data/index.js'
import { LIEUX, STATUTS_SEANCE } from '../../../../domain/modele.js'
import { jourLocal, ajouterJours, lundiDe } from '../../../../domain/dates.js'
import { etatSemaine } from '../../../../domain/programme.js'
import { libelleSeance, payeCeMois, prochaineSeance } from '../../../../domain/coaching.js'
import { HABITUDES_DEFAUT, parserHabitudes, seriesDisponibles, pointsSerie } from '../../../../domain/suivi.js'
import { maintenant, rafraichir, uuid, etat, marquerVue, messageErreur } from '../../../store.js'
import { chargesRealisees, dateFr, pointsPoids, adresseApp } from '../../../logique.js'
import { useSauvegardeAuto } from '../../useSauvegardeAuto.js'
import { toast } from '../../toast.js'
import IconeSt from '../../IconeSt.vue'
import Puce from '../../Puce.vue'
import Filtres from '../../Filtres.vue'
import IndicateurSauvegarde from '../../IndicateurSauvegarde.vue'
import CourbeSt from './CourbeSt.vue'
import CalendrierSt from './CalendrierSt.vue'
import IdentifiantsCrees from './IdentifiantsCrees.vue'
import { assiduite, dateAvecAnnee, initiales, normaliserTelephone, optionsReponses, patchTelephone, teinteClient, telephoneClient } from './logique.js'
import { demanderFocus, rendreFocus } from './retourFocus.js'

const props = defineProps({ id: { type: String, required: true } })
const emit = defineEmits(['change'])
const router = useRouter()
const route = useRoute()
const mobile = typeof matchMedia === 'function' ? matchMedia('(max-width: 900px)') : { matches: false }
const reduit = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }

const racine = ref(null)
// Feuille plein écran (téléphone) : rendue dans #st-calques du CoachLayout Studio s'il existe.
const enCalque = ref(mobile.matches && typeof document !== 'undefined' && !!document.getElementById('st-calques'))
const profil = ref(undefined)
const d = reactive({ programmes: [], workouts: [], realisations: [], seances: [], mots: [], reponses: [], questionnaires: [], mesures: [], douleurs: [], exercices: [] })
const aujourdhui = jourLocal(maintenant())
const erreur = ref('')
const teinte = computed(() => teinteClient(props.id))

const ONGLETS = [
  ['apercu', 'Aperçu'], ['programme', 'Programme'], ['suivi', 'Suivi'], ['reponses', 'Réponses'],
  ['coaching', 'Rendez-vous'], ['notes', 'Notes privées'], ['reglages', 'Réglages']
]
const cleOnglet = (q) => (ONGLETS.some(([c]) => c === q) ? q : null)
const onglet = ref(cleOnglet(route.query.onglet) || 'apercu') // ?onglet=reponses | coaching… : liens depuis Aujourd'hui

async function charger() {
  const p = (await data.profils.lire(props.id)) || null
  if (!p) { profil.value = null; return }
  const f = { clientId: props.id }
  const [programmes, workouts, realisations, seances, mots, reponses, questionnaires, mesures, douleurs, exercices] = await Promise.all([
    data.programmes.lister(f), data.workouts.lister(f), data.realisations.lister(f), data.seancesCoaching.lister(f), data.motsDuCoach.lister(f),
    data.reponses.lister(f), data.questionnaires.lister({}, { archives: true }), data.mesures.lister(f), data.douleurs.lister(f), data.exercices.lister()
  ])
  Object.assign(d, { programmes, workouts, realisations, seances, mots, reponses, questionnaires, mesures, douleurs, exercices })
  if (profil.value?.id !== p.id) remplirReglages(p)
  profil.value = p
}

const nomWorkout = (id) => d.workouts.find((w) => w.id === id)?.nom || 'Séance'
const nomExercice = (id) => d.exercices.find((e) => e.id === id)?.nom || '?'
const alertesClient = computed(() => etat.alertes.filter((a) => a.clientId === props.id))
const sousTitre = computed(() => profil.value && `${profil.value.identifiant} · ${profil.value.tarif} € la séance · ${profil.value.lieuDefaut === 'domicile' ? 'à domicile' : 'en salle'}`)

// --- Aperçu ----------------------------------------------------------------------------------------------
const evenements = computed(() => {
  const ev = {}
  const ajout = (jour, e) => (ev[jour] ||= []).push(e)
  for (const r of d.realisations) ajout(r.date, { texte: nomWorkout(r.workoutId), type: 'fait' })
  for (const s of d.seances.filter((x) => x.statut !== 'annulee')) ajout(s.date, { texte: `${s.heure || 'journée'} rendez-vous`, type: 'coach' })
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
const faitesTriees = computed(() => [...d.realisations].sort((a, b) => b.date.localeCompare(a.date)))
const derniereSeance = computed(() => faitesTriees.value[0])
const tauxAssiduite = computed(() => assiduite(d.programmes, d.realisations, aujourdhui))
const prochainCoaching = computed(() => prochaineSeance(d.seances, maintenant()))
const programmesEtat = computed(() => d.programmes.map((p) => ({ p, s: etatSemaine(p, d.realisations, aujourdhui, aujourdhui) })))

// --- Programme : séances faites, charges ------------------------------------------------------------------
const charges = computed(() => chargesRealisees(d.realisations, nomExercice))
const duree = (s) => `${Math.round((s || 0) / 60)} min`
const voirToutesFaites = ref(false)
const LIBELLE_SEMAINE = { avenir: 'pas encore commencé', termine: 'terminé', passee: 'semaine passée' }

// --- Réponses ---------------------------------------------------------------------------------------------
const filtreReponses = ref('')
const optionsRep = computed(() => optionsReponses(d.reponses, d.questionnaires))
const reponsesTriees = computed(() => [...d.reponses].filter((r) => !filtreReponses.value || r.questionnaireId === filtreReponses.value).sort((a, b) => b.date.localeCompare(a.date)))
const questionnaireDe = (id) => d.questionnaires.find((q) => q.id === id)
const lignesReponse = (r) => {
  const q = questionnaireDe(r.questionnaireId)
  return Object.entries(r.valeurs || {}).map(([cle, v]) => ({
    cle,
    libelle: q?.questions.find((x) => x.cle === cle)?.libelle || cle,
    valeur: Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
  }))
}
const estPhoto = (v) => typeof v === 'string' && /^(data:image\/|blob:|https?:)/.test(v)

// --- Suivi (courbes) --------------------------------------------------------------------------------------
const courbePoids = computed(() => pointsPoids(d.mesures, d.reponses))
const courbeDouleur = computed(() => {
  const m = new Map()
  const note = (date, v) => typeof v === 'number' && m.set(date, Math.max(m.get(date) ?? 0, v))
  d.douleurs.forEach((x) => note(x.date, x.intensite))
  d.reponses.forEach((r) => note(r.date, r.valeurs?.douleur))
  return [...m.entries()].map(([date, valeur]) => ({ date, valeur }))
})
const courbesTours = computed(() => seriesDisponibles(d.mesures).filter((s) => s.id !== 'poids').map((s) => ({ ...s, points: pointsSerie(d.mesures, s.id) })))
const courbeVolume = computed(() => d.realisations.filter((r) => Number.isFinite(r.volume)).map((r) => ({ date: r.date, valeur: r.volume })))
const courbePrincipale = computed(() => (courbePoids.value.length > 1 ? { donnees: courbePoids.value, titre: 'Poids', unite: 'kg' } : { donnees: courbeVolume.value, titre: 'Volume par séance', unite: 'kg' }))

// --- Notes privées (fiche importée, réservée au coach) -----------------------------------------------------
const LIBELLES_CONTACT = { email: 'E-mail', telephone: 'Téléphone', dateNaissance: 'Naissance', sexe: 'Sexe', adresse: 'Adresse' }
const contactFiche = computed(() => Object.entries(profil.value?.fiche?.contact || {}).filter(([k, v]) => v && LIBELLES_CONTACT[k]).map(([k, v]) => ({ libelle: LIBELLES_CONTACT[k], valeur: k === 'dateNaissance' ? dateAvecAnnee(v) : v })))

// --- Coaching ---------------------------------------------------------------------------------------------
const nouvelle = reactive({ date: aujourdhui, heure: '18:00', lieu: 'domicile', statut: 'prevue', tarif: 35 })
const seancesTriees = computed(() => [...d.seances].sort((a, b) => `${b.date}${b.heure}`.localeCompare(`${a.date}${a.heure}`)))
const paye = computed(() => payeCeMois(d.seances, maintenant()))
const mot = ref('')
const motsTries = computed(() => [...d.mots].sort((a, b) => b.date.localeCompare(a.date)))
const LIBELLE_STATUT = { prevue: 'Prévue', faite: 'Faite', annulee: 'Annulée' }

async function ajouterSeance() {
  erreur.value = ''
  try {
    // Le tarif est figé dans la séance à sa création (changer le tarif du client ensuite ne touche pas l'historique).
    await data.seancesCoaching.creer({ id: uuid(), clientId: props.id, ...nouvelle, tarif: Number(nouvelle.tarif) || 0 })
    await charger()
    toast('Rendez-vous ajouté')
  } catch (e) { erreur.value = messageErreur(e) }
}
async function changerStatut(s, statut) {
  try { await data.seancesCoaching.modifier(s.id, { statut }); await charger() } catch (e) { toast(messageErreur(e)) }
}
async function envoyerMot() {
  if (!mot.value.trim()) return
  try {
    await data.motsDuCoach.creer({ id: uuid(), clientId: props.id, texte: mot.value.trim(), date: aujourdhui })
    mot.value = ''
    await charger()
    toast('Mot publié sur le tableau de bord du client')
  } catch (e) { toast(messageErreur(e)) }
}
const champMot = ref(null)
async function supprimerMot(m) {
  const i = motsTries.value.findIndex((x) => x.id === m.id)
  try {
    await data.motsDuCoach.archiver(m.id)
    await charger()
    toast('Mot retiré')
    await nextTick()
    const boutons = racine.value?.querySelectorAll('[data-retirer-mot]') || []
    ;(boutons[Math.min(i, boutons.length - 1)] || champMot.value)?.focus()
  } catch (e) { toast(messageErreur(e)) }
}
async function voirAlerte(a) {
  await marquerVue(a)
  emit('change')
}

// --- Réglages (sauvegarde automatique) ---------------------------------------------------------------------
const reglages = reactive({ nom: '', tarif: 0, lieuDefaut: 'domicile', telephone: '', modules: { habitudes: false, photosRepas: false, calories: false }, habitudesTexte: '' })
let reglagesPrets = false
function remplirReglages(p) {
  reglagesPrets = false
  Object.assign(reglages, {
    nom: p.nom, tarif: p.tarif, lieuDefaut: p.lieuDefaut, telephone: p.fiche?.contact?.telephone || '',
    modules: { habitudes: false, photosRepas: false, calories: false, ...p.modules },
    habitudesTexte: (p.modules?.listeHabitudes || []).join('\n')
  })
  nouvelle.tarif = p.tarif
  nouvelle.lieu = p.lieuDefaut
  nextTick(() => { reglagesPrets = true })
}
const sauvegarde = useSauvegardeAuto(async (v) => {
  await data.profils.modifier(props.id, v)
  profil.value = { ...profil.value, ...v }
  emit('change')
}, { delai: 700 })
const nomVide = computed(() => !reglages.nom.trim())
// Numéro WhatsApp : vide (effacé) ou reconnu ; un texte non reconnu n'est pas enregistré (l'ancien numéro reste).
const telephoneInvalide = computed(() => !!reglages.telephone.trim() && !normaliserTelephone(reglages.telephone))
watch(reglages, () => {
  if (!reglagesPrets || nomVide.value) return
  const { habitudes, photosRepas, calories } = reglages.modules
  sauvegarde.planifier({
    nom: reglages.nom.trim(), tarif: Number(reglages.tarif) || 0, lieuDefaut: reglages.lieuDefaut,
    modules: { ...profil.value?.modules, habitudes, photosRepas, calories, listeHabitudes: parserHabitudes(reglages.habitudesTexte) },
    ...(telephoneInvalide.value ? {} : patchTelephone(profil.value, reglages.telephone))
  })
}, { deep: true })

const nouveauCode = ref(null)
async function genererNouveauCode() {
  erreur.value = ''
  try {
    const { identifiant, code } = await data.reinitialiserCode(props.id)
    nouveauCode.value = { nom: profil.value.nom, identifiant, code, url: adresseApp(window.location.origin, import.meta.env.BASE_URL), numero: telephoneClient(profil.value) }
  } catch (e) { erreur.value = messageErreur(e) }
}
const confirmerArchivage = ref(false)
async function archiver() {
  const { id } = props
  const nom = profil.value.nom
  try {
    await sauvegarde.maintenant()
    await data.profils.archiver(id)
    await rafraichir()
    emit('change')
    await fermer()
    toast(`${nom} est archivé`, { action: 'Annuler', surAction: () => restaurer(id, nom), duree: 6000 })
  } catch (e) { erreur.value = messageErreur(e) }
}
async function restaurer(id = props.id, nom = profil.value?.nom) {
  try {
    await data.profils.modifier(id, { archive: false })
    await rafraichir()
    emit('change')
    if (id === props.id) await charger()
    toast(`${nom} est de nouveau actif`)
  } catch (e) { toast(messageErreur(e)) }
}

// --- Onglets : soulignement glissant + flèches ← → ---------------------------------------------------------
const barreOnglets = ref(null)
const souligne = reactive({ x: 0, l: 0 })
function placerSouligne() {
  const b = barreOnglets.value?.querySelector('[aria-selected="true"]')
  if (b) Object.assign(souligne, { x: b.offsetLeft, l: b.offsetWidth })
}
watch(() => route.query.onglet, (q) => { if (cleOnglet(q)) choisirOnglet(q) })
function choisirOnglet(cle, focus = false) {
  onglet.value = cle
  nextTick(() => {
    placerSouligne()
    const b = barreOnglets.value?.querySelector('[aria-selected="true"]')
    if (focus) b?.focus()
    b?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduit.matches ? 'auto' : 'smooth' })
  })
}
function toucheOnglets(ev) {
  const i = ONGLETS.findIndex(([c]) => c === onglet.value)
  const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ONGLETS.length - 1 }[ev.key]
  if (n === undefined) return
  ev.preventDefault()
  choisirOnglet(ONGLETS[(n + ONGLETS.length) % ONGLETS.length][0], true)
}

// --- Ouverture / fermeture : panneau à côté (ordinateur), feuille glissable (téléphone) ------------------------
const vu = ref(false)
const glisse = ref(false)
const decalage = ref(0)
const ATTENTE_FERMETURE = 480
let fermeture = false

async function fermer() {
  if (fermeture) return
  fermeture = true
  await sauvegarde.arreter()
  const id = props.id
  if (mobile.matches && !reduit.matches) {
    glisse.value = false
    decalage.value = 0
    vu.value = false
    await new Promise((r) => setTimeout(r, ATTENTE_FERMETURE))
  }
  demanderFocus(id)
  await router.push('/coach/clients')
  await nextTick()
  rendreFocus()
}

const titre = ref(null)
let inertes = []
function rendreInerte() {
  const calques = document.getElementById('st-calques')
  const racineApp = calques?.parentElement
  if (!racineApp) return
  inertes = [...racineApp.children].filter((el) => el !== calques && !el.classList.contains('st-toast') && !el.inert)
  inertes.forEach((el) => { el.inert = true })
}
function rendreActif() {
  inertes.forEach((el) => { el.inert = false })
  inertes = []
}
function pieger(ev) {
  if (ev.key !== 'Tab' || !enCalque.value || !racine.value) return
  const f = [...racine.value.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
  if (!f.length) return
  const premier = f[0]
  const dernier = f[f.length - 1]
  if (ev.shiftKey && (document.activeElement === premier || !racine.value.contains(document.activeElement))) { ev.preventDefault(); dernier.focus() }
  else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus() }
}

function surTouche(ev) {
  pieger(ev)
  if (ev.key !== 'Escape' || ev.defaultPrevented) return
  ev.preventDefault()
  fermer()
}

// Glisser la feuille vers le bas (téléphone) : suit le doigt, se ferme au-delà de 140 px ou si le geste est vif.
let y0 = null
let t0 = 0
function debutGlisse(ev) {
  if (!mobile.matches || ev.button > 0 || ev.target.closest('button, a, input, select, textarea')) return
  if (racine.value.scrollTop > 0 && !ev.target.closest('.st-clients-poignee')) return
  y0 = ev.clientY
  t0 = performance.now()
  glisse.value = true
  ev.currentTarget.setPointerCapture?.(ev.pointerId)
}
function moveGlisse(ev) {
  if (y0 === null) return
  decalage.value = Math.max(0, ev.clientY - y0)
}
function finGlisse() {
  if (y0 === null) return
  const vitesse = decalage.value / Math.max(1, performance.now() - t0)
  y0 = null
  if (decalage.value > 140 || (decalage.value > 30 && vitesse > 0.6)) { fermer(); return }
  glisse.value = false
  decalage.value = 0
}
const styleFeuille = computed(() => (decalage.value ? { transform: `translateY(${decalage.value}px)` } : undefined))

onMounted(async () => {
  document.addEventListener('keydown', surTouche)
  if (mobile.matches) document.body.style.overflow = 'hidden'
  if (enCalque.value) rendreInerte()
  await charger()
  await nextTick()
  placerSouligne()
  if (onglet.value !== 'apercu') barreOnglets.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  // Le focus va au nom du client (annoncé par le lecteur d'écran), jamais au body.
  titre.value?.focus({ preventScroll: true })
  if (reduit.matches) { vu.value = true; return }
  if (mobile.matches) requestAnimationFrame(() => requestAnimationFrame(() => { vu.value = true }))
  else {
    vu.value = true
    racine.value?.animate([{ opacity: 0, transform: 'translateY(16px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.32,.72,0,1)' })
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', surTouche)
  document.body.style.overflow = ''
  rendreActif()
  sauvegarde.arreter()
})
</script>

<template>
  <Teleport defer to="#st-calques" :disabled="!enCalque">
  <div v-if="enCalque" class="st-clients st-clients-voile" :class="{ 'is-vu': vu }" aria-hidden="true" @click="fermer" />
  <article
    ref="racine" class="st-clients st-clients-fiche" :class="{ 'is-vu': vu, 'is-glisse': glisse }" :style="styleFeuille" :data-m="teinte"
    :role="enCalque ? 'dialog' : 'region'" :aria-modal="enCalque ? 'true' : undefined"
    :aria-labelledby="profil ? 'st-clients-fiche-nom' : undefined" :aria-label="profil ? undefined : 'Fiche client'"
    @pointerdown="debutGlisse" @pointermove="moveGlisse" @pointerup="finGlisse" @pointercancel="finGlisse"
  >
    <div class="st-clients-poignee" aria-hidden="true" />
    <template v-if="profil">
      <header class="st-clients-tete">
        <span class="st-clients-av is-grand" aria-hidden="true">{{ initiales(profil.nom) }}</span>
        <div class="st-clients-tete-txt">
          <h2 id="st-clients-fiche-nom" ref="titre" tabindex="-1" :title="profil.nom">{{ profil.nom }}</h2>
          <p>{{ sousTitre }}</p>
          <div v-if="profil.archive || alertesClient.length" class="st-clients-puces">
            <Puce v-if="profil.archive" variante="neutre">Archivé</Puce>
            <button v-if="alertesClient.length" type="button" class="st-clients-puce-btn" @click="choisirOnglet('apercu')"><Puce variante="alerte" point>{{ alertesClient.length }} alerte{{ alertesClient.length > 1 ? 's' : '' }}</Puce></button>
          </div>
        </div>
        <div class="st-clients-tete-actions">
          <RouterLink :to="`/coach/seances/nouveau?client=${id}`" class="st-btn">Nouvelle séance</RouterLink>
          <RouterLink :to="`/coach/programmes/nouveau?client=${id}`" class="st-btn st-btn--encre">Nouveau programme</RouterLink>
        </div>
        <button type="button" class="st-btn st-btn--rond st-clients-fermer" aria-label="Fermer la fiche (Échap)" @click="fermer"><IconeSt nom="fermer" /></button>
      </header>

      <div v-if="profil.archive" class="st-clients-bandeau" role="status">
        <span>Client archivé : il ne peut plus se connecter ; ses données sont conservées.</span>
        <button type="button" class="st-btn" @click="restaurer()">Restaurer</button>
      </div>

      <div ref="barreOnglets" class="st-clients-onglets" role="tablist" aria-label="Sections de la fiche" @keydown="toucheOnglets">
        <button
          v-for="[cle, texte] in ONGLETS" :id="`st-clients-o-${cle}`" :key="cle" type="button" role="tab"
          :aria-selected="onglet === cle" :aria-controls="`st-clients-p-${cle}`" :tabindex="onglet === cle ? 0 : -1" @click="choisirOnglet(cle)"
        >{{ texte }}</button>
        <span class="st-clients-souligne" aria-hidden="true" :style="{ width: `${souligne.l}px`, transform: `translateX(${souligne.x}px)` }" />
      </div>

      <Transition name="st-clients-onglet" mode="out-in">
        <section :id="`st-clients-p-${onglet}`" :key="onglet" class="st-clients-corps" role="tabpanel" :aria-labelledby="`st-clients-o-${onglet}`" tabindex="0">
          <!-- Aperçu -->
          <template v-if="onglet === 'apercu'">
            <ul v-if="alertesClient.length" class="st-clients-alertes" aria-label="Alertes">
              <li v-for="a in alertesClient" :key="a.id">
                <Puce variante="alerte">{{ a.type === 'douleur' ? 'Douleur' : a.type === 'checkin' ? 'Check-in' : 'Commentaire' }}</Puce>
                <span>{{ a.message }}</span>
                <button type="button" class="st-btn st-btn--fantome" @click="voirAlerte(a)">Marquer vu</button>
              </li>
            </ul>
            <div class="st-clients-kpis">
              <div class="st-clients-kpi"><span>Assiduité (4 sem.)</span><b>{{ tauxAssiduite === null ? '—' : `${tauxAssiduite} %` }}</b></div>
              <div class="st-clients-kpi"><span>Cette semaine</span><b>{{ faitesCetteSemaine }}</b><small>séance{{ faitesCetteSemaine > 1 ? 's' : '' }} faite{{ faitesCetteSemaine > 1 ? 's' : '' }}</small></div>
              <div class="st-clients-kpi"><span>Dernière séance</span><b class="is-petit">{{ derniereSeance ? dateFr(derniereSeance.date) : '—' }}</b><small>{{ derniereSeance ? nomWorkout(derniereSeance.workoutId) : "Aucune pour l'instant" }}</small></div>
              <div class="st-clients-kpi"><span>Prochain rendez-vous</span><b class="is-petit">{{ prochainCoaching ? dateFr(prochainCoaching.date) : '—' }}</b><small>{{ prochainCoaching ? `${prochainCoaching.heure || 'journée'} · ${prochainCoaching.lieu === 'domicile' ? 'domicile' : 'salle'}` : 'Rien de prévu' }}</small></div>
            </div>
            <div class="st-clients-prog-mini">
              <div>
                <span class="st-clients-etiquette">Programme</span>
                <b>{{ d.programmes[0] ? d.programmes[0].nom : 'Aucun programme' }}</b>
                <small v-if="programmesEtat[0]">{{ programmesEtat[0].s.statut === 'enCours' ? `Semaine ${programmesEtat[0].s.numero} · ${programmesEtat[0].s.libelle} faites` : LIBELLE_SEMAINE[programmesEtat[0].s.statut] }}</small>
              </div>
              <RouterLink v-if="d.programmes[0]" :to="`/coach/programmes/${d.programmes[0].id}`" class="st-btn">Ouvrir</RouterLink>
              <RouterLink v-else :to="`/coach/programmes/nouveau?client=${id}`" class="st-btn st-btn--jaune">Créer un programme</RouterLink>
            </div>
            <CourbeSt :donnees="courbePrincipale.donnees" :titre="courbePrincipale.titre" :unite="courbePrincipale.unite" />
            <CalendrierSt :evenements="evenements" :aujourdhui="aujourdhui" />
          </template>

          <!-- Programme : programmes, séances faites, charges -->
          <template v-else-if="onglet === 'programme'">
            <h3 class="st-clients-h3">Programmes ({{ d.programmes.length }})</h3>
            <ul v-if="d.programmes.length" class="st-clients-lignes">
              <li v-for="{ p, s } in programmesEtat" :key="p.id">
                <div><b>{{ p.nom }}</b><small>{{ s.statut === 'enCours' ? `Semaine ${s.numero} · ${s.libelle} faites cette semaine` : LIBELLE_SEMAINE[s.statut] }}</small></div>
                <RouterLink :to="`/coach/programmes/${p.id}`" class="st-btn">Ouvrir</RouterLink>
              </li>
            </ul>
            <p v-else class="st-clients-vide-petit">Aucun programme. <RouterLink :to="`/coach/programmes/nouveau?client=${id}`">En créer un</RouterLink></p>

            <h3 class="st-clients-h3">Séances faites ({{ faitesTriees.length }})</h3>
            <ul v-if="faitesTriees.length" class="st-clients-lignes">
              <li v-for="r in voirToutesFaites ? faitesTriees : faitesTriees.slice(0, 8)" :key="r.id" class="is-col">
                <div><b>{{ nomWorkout(r.workoutId) }}</b><small>{{ dateFr(r.date) }} · {{ duree(r.dureeSec) }} · volume {{ Math.round(r.volume || 0) }} kg</small></div>
                <p v-if="r.commentaire" class="st-clients-citation">« {{ r.commentaire }} »</p>
              </li>
            </ul>
            <p v-else class="st-clients-vide-petit">Aucune séance faite.</p>
            <button v-if="faitesTriees.length > 8" type="button" class="st-btn st-btn--fantome" @click="voirToutesFaites = !voirToutesFaites">{{ voirToutesFaites ? 'Voir moins' : `Voir les ${faitesTriees.length} séances` }}</button>

            <h3 class="st-clients-h3">Charges réalisées</h3>
            <div v-if="charges.length" class="st-clients-charges">
              <div v-for="c in charges" :key="c.exerciceId" class="st-clients-charge">
                <b>{{ c.nom }}</b>
                <table>
                  <tr v-for="h in c.historique.slice(0, 5)" :key="h.date"><td>{{ dateFr(h.date) }}</td><td><strong>{{ h.poids }} kg</strong><span v-if="h.reps !== null"> × {{ h.reps }}</span></td><td>{{ h.series }} séries</td></tr>
                </table>
              </div>
            </div>
            <p v-else class="st-clients-vide-petit">Pas encore de charge enregistrée.</p>
          </template>

          <!-- Suivi : courbes -->
          <div v-else-if="onglet === 'suivi'" class="st-clients-courbes">
            <CourbeSt :donnees="courbePoids" titre="Poids" unite="kg" />
            <CourbeSt :donnees="courbeDouleur" titre="Douleur (max du jour)" unite="/10" />
            <CourbeSt :donnees="courbeVolume" titre="Volume par séance" unite="kg" />
            <CourbeSt v-for="s in courbesTours" :key="s.id" :donnees="s.points" :titre="s.libelle" unite="cm" />
          </div>

          <!-- Réponses : questionnaires (PAR-Q, bilans, check-ins) -->
          <template v-else-if="onglet === 'reponses'">
            <Filtres v-if="optionsRep.length > 1" v-model="filtreReponses" :options="optionsRep" :multiple="false" etiquette="Filtrer par questionnaire" />
            <div v-if="reponsesTriees.length" class="st-clients-reponses">
              <details v-for="r in reponsesTriees" :key="r.id" class="st-clients-reponse">
                <summary><b>{{ questionnaireDe(r.questionnaireId)?.nom || 'Questionnaire' }}</b><small>{{ dateFr(r.date) }}</small><IconeSt nom="bas" /></summary>
                <dl>
                  <template v-for="l in lignesReponse(r)" :key="l.cle">
                    <dt>{{ l.libelle }}</dt>
                    <dd><img v-if="estPhoto(l.valeur)" :src="l.valeur" alt="Photo envoyée par le client" loading="lazy" /><template v-else>{{ l.valeur }}</template></dd>
                  </template>
                </dl>
              </details>
            </div>
            <p v-else class="st-clients-vide-petit">Aucune réponse pour l'instant.</p>
          </template>

          <!-- Rendez-vous (onglet « coaching ») : séances en présentiel + mot du coach -->
          <div v-else-if="onglet === 'coaching'" class="st-clients-deux">
            <div>
              <form class="st-clients-form-in" @submit.prevent="ajouterSeance">
                <h3 class="st-clients-h3">Ajouter un rendez-vous</h3>
                <div class="st-clients-champs">
                  <label class="st-clients-champ">Date<input v-model="nouvelle.date" type="date" required /></label>
                  <label class="st-clients-champ">Heure<input v-model="nouvelle.heure" type="time" required /></label>
                  <label class="st-clients-champ">Lieu<select v-model="nouvelle.lieu"><option v-for="l in LIEUX" :key="l" :value="l">{{ l === 'domicile' ? 'Domicile' : 'Salle' }}</option></select></label>
                  <label class="st-clients-champ">Statut<select v-model="nouvelle.statut"><option v-for="s in STATUTS_SEANCE" :key="s" :value="s">{{ LIBELLE_STATUT[s] }}</option></select></label>
                  <label class="st-clients-champ">Tarif (€)<input v-model.number="nouvelle.tarif" type="number" min="0" inputmode="numeric" /></label>
                </div>
                <p v-if="erreur" class="st-clients-erreur" role="alert">{{ erreur }}</p>
                <button class="st-btn st-btn--encre" type="submit">Ajouter</button>
              </form>
              <p class="st-clients-paye">{{ paye.libelle }}</p>
              <ul v-if="seancesTriees.length" class="st-clients-lignes">
                <li v-for="s in seancesTriees" :key="s.id" :class="`is-${s.statut}`">
                  <div><b>{{ libelleSeance(s) }}</b><small>{{ s.tarif }} €</small></div>
                  <select :value="s.statut" :aria-label="`Statut du rendez-vous du ${dateFr(s.date)}`" @change="changerStatut(s, $event.target.value)">
                    <option value="prevue">Prévue</option><option value="faite">Faite</option><option value="annulee">Annulée</option>
                  </select>
                </li>
              </ul>
            </div>
            <div>
              <form class="st-clients-form-in" @submit.prevent="envoyerMot">
                <h3 class="st-clients-h3">Mot du coach</h3>
                <label class="st-clients-champ is-large">Message affiché sur le tableau de bord du client<textarea ref="champMot" v-model="mot" rows="3" placeholder="Beau travail cette semaine, on garde le cap !" /></label>
                <button class="st-btn st-btn--encre" type="submit" :disabled="!mot.trim()">Publier</button>
              </form>
              <ul v-if="motsTries.length" class="st-clients-lignes">
                <li v-for="m in motsTries" :key="m.id">
                  <div><span>{{ m.texte }}</span><small>{{ dateFr(m.date) }}</small></div>
                  <button type="button" class="st-btn st-clients-danger" data-retirer-mot :aria-label="`Retirer le mot du ${dateFr(m.date)}`" @click="supprimerMot(m)">Retirer</button>
                </li>
              </ul>
            </div>
          </div>

          <!-- Notes privées : fiche importée (contact + notes), jamais envoyée au client -->
          <template v-else-if="onglet === 'notes'">
            <p class="st-clients-etiquette">Visible par toi seul</p>
            <dl v-if="contactFiche.length" class="st-clients-contact">
              <template v-for="l in contactFiche" :key="l.libelle"><dt>{{ l.libelle }}</dt><dd>{{ l.valeur }}</dd></template>
            </dl>
            <p v-if="profil.fiche?.notes" class="st-clients-prive">{{ profil.fiche.notes }}</p>
            <p v-if="!contactFiche.length && !profil.fiche?.notes" class="st-clients-vide-petit">Pas de fiche privée pour ce client (contact et notes importés de MyPTHub).</p>
          </template>

          <!-- Réglages -->
          <div v-else class="st-clients-reglages">
            <div class="st-clients-reglages-tete">
              <h3 class="st-clients-h3">Réglages du client</h3>
              <IndicateurSauvegarde :etat="sauvegarde.etat.value" @reessayer="sauvegarde.reessayer" />
            </div>
            <div class="st-clients-champs">
              <label class="st-clients-champ is-large">Nom<input v-model="reglages.nom" required :aria-invalid="nomVide" /></label>
              <label class="st-clients-champ">Tarif (€)<input v-model.number="reglages.tarif" type="number" min="0" inputmode="numeric" /></label>
              <label class="st-clients-champ">WhatsApp<input v-model="reglages.telephone" type="tel" inputmode="tel" autocomplete="off" placeholder="06 12 34 56 78" :aria-invalid="telephoneInvalide" /></label>
              <label class="st-clients-champ">Lieu par défaut<select v-model="reglages.lieuDefaut"><option v-for="l in LIEUX" :key="l" :value="l">{{ l === 'domicile' ? 'À domicile' : 'En salle' }}</option></select></label>
            </div>
            <p v-if="telephoneInvalide" class="st-clients-erreur" role="alert">Numéro non reconnu : écris-le comme 06 12 34 56 78 ou +33 6 12 34 56 78. Il n’est pas enregistré tant qu’il est incorrect.</p>
            <p v-if="nomVide" class="st-clients-erreur" role="alert">Le nom est obligatoire : rien n'est enregistré tant qu'il est vide.</p>
            <fieldset class="st-clients-cases">
              <legend>Nutrition</legend>
              <label><input v-model="reglages.modules.habitudes" type="checkbox" />Habitudes</label>
              <label><input v-model="reglages.modules.photosRepas" type="checkbox" />Photos de repas</label>
              <label><input v-model="reglages.modules.calories" type="checkbox" />Calories</label>
            </fieldset>
            <label v-if="reglages.modules.habitudes" class="st-clients-champ is-large">
              Habitudes du client (une par ligne, 12 maximum)
              <textarea v-model="reglages.habitudesTexte" rows="5" :placeholder="HABITUDES_DEFAUT.join('\n')" />
              <small>Laisse vide pour garder les habitudes par défaut. Retirer une habitude la masque ; son historique est conservé.</small>
            </label>

            <h3 class="st-clients-h3">Accès à l'application</h3>
            <p class="st-clients-doux">Un nouveau code remplace l'ancien : le client devra se reconnecter avec celui-ci.</p>
            <button type="button" class="st-btn" @click="genererNouveauCode">Générer un nouveau code</button>
            <IdentifiantsCrees v-if="nouveauCode" :infos="nouveauCode" @termine="nouveauCode = null" />
            <p v-if="erreur" class="st-clients-erreur" role="alert">{{ erreur }}</p>

            <h3 class="st-clients-h3">Archivage</h3>
            <p class="st-clients-doux">Un client archivé ne peut plus se connecter ; ses données sont conservées et il peut être restauré.</p>
            <button v-if="profil.archive" type="button" class="st-btn" @click="restaurer()">Restaurer ce client</button>
            <div v-else-if="confirmerArchivage" class="st-clients-boutons" role="group" aria-label="Confirmer l'archivage">
              <span>Archiver {{ profil.nom }} ?</span>
              <button type="button" class="st-btn st-clients-danger is-plein" @click="archiver">Oui, archiver</button>
              <button type="button" class="st-btn" @click="confirmerArchivage = false">Annuler</button>
            </div>
            <button v-else type="button" class="st-btn st-clients-danger" @click="confirmerArchivage = true">Archiver ce client</button>
          </div>
        </section>
      </Transition>
    </template>
    <div v-else-if="profil === null" class="st-clients-corps">
      <p>Client introuvable.</p>
      <button type="button" class="st-btn" @click="fermer">Retour à la liste</button>
    </div>
    <div v-else class="st-clients-corps st-clients-chargement" aria-busy="true">Chargement…</div>
  </article>
  </Teleport>
</template>
