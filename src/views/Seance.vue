<script setup>
// Séance en cours : le cœur de l'app. Cette vue orchestre ; les temps et les règles viennent des moteurs
// (src/engine/seance.js, src/engine/circuits.js), l'affichage des composants de src/components/seance/.
// État sauvegardé à chaque action (reprise après rechargement), Wake Lock, sons/vibrations.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import PanneauExercice from '../components/seance/PanneauExercice.vue'
import PanneauCircuit from '../components/seance/PanneauCircuit.vue'
import SerieDetail from '../components/seance/SerieDetail.vue'
import RoueValeur from '../components/seance/RoueValeur.vue'
import SectionCircuit from '../components/seance/SectionCircuit.vue'
import TempsTotal from '../components/seance/TempsTotal.vue'
import ChronoSimple from '../components/seance/ChronoSimple.vue'
import ChronoCircuit from '../components/seance/ChronoCircuit.vue'
import TiroirOverview from '../components/seance/TiroirOverview.vue'
import ToastSuite from '../components/seance/ToastSuite.vue'
import PastilleRepos from '../components/seance/PastilleRepos.vue'
import FeuilleBas from '../components/seance/FeuilleBas.vue'
import FinSeance from '../components/seance/FinSeance.vue'
import { data } from '../data/index.js'
import { demarrerSeance, reduire, vue as vueSeance } from '../engine/seance.js'
import { etatChrono, evenement } from '../engine/circuits.js'
import { construireRealisation, meilleuresCharges } from '../domain/realisations.js'
import { configRoue } from '../domain/roue.js'
import { CHAMPS } from '../domain/modele.js'
import { poidsAffiche, nombreFr } from '../domain/unites.js'
import { videoDe } from '../domain/video.js'
import { derniereFois, detailTiroir, exerciceComplet, fractionExercice, libelleAction, reperesBlocs, serieCourante, estAuTemps } from '../domain/seanceUi.js'
import { titreCircuit } from '../domain/circuitsUi.js'
import { horloge } from '../lib/horloge.js'
import { SONS, deverrouiller, regler as reglerSon } from '../lib/son.js'
import { activerWakeLock, libererWakeLock } from '../lib/wakelock.js'
import { effacerSeanceEnCours, lireSeanceEnCours, sauverSeanceEnCours } from '../lib/seanceEnCours.js'
import { utilisateurCourant } from '../lib/session.js'
import { T, E, REBOND } from '../anim/constantes.js'
import { cascade, compter, fermerPage, installerRessort, mouvementReduit, nettoyer, ouvrirCercle } from '../anim/transitions.js'
import { centreDe } from '../anim/geometrie.js'
import { consommerLancement, leverRideau, marquerFinSeance } from '../anim/passage.js'

const route = useRoute()
const router = useRouter()

// ---------------------------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------------------------
const racine = ref(null)
const erreur = ref('')
const user = ref(null)
const bib = shallowRef({})          // bibliothèque d'exercices, par id
const realisations = shallowRef([]) // historique du client (« dernière fois »)
const etat = shallowRef(null)       // état du moteur de séance
const circuit = shallowRef(null)    // chrono de circuit en cours : { itemId, evenements }
let realisationId = null
let programmeId = null

const unite = computed(() => user.value?.preferences?.unite || 'kg')
const items = computed(() => etat.value?.exercices || [])
const nbItems = computed(() => items.value.length)
const exo = (item) => bib.value[item.exerciceId] || {}
const nomItem = (item) => (item.type === 'circuit' ? item.nom || titreCircuit(item.format, item.params).nom : exo(item).nom || 'Exercice')

async function charger() {
  try {
    user.value = await utilisateurCourant()
    if (!user.value) { erreur.value = 'Connectez-vous pour démarrer une séance.'; return }
    reglerSon(user.value.preferences)
    const id = route.params.workoutId
    const [workout, exos, template, historique] = await Promise.all([
      data.workouts.lire(id), data.exercices.lister(), data.templates.lire(user.value.id), data.realisations.lister({ clientId: user.value.id })
    ])
    if (!workout) { erreur.value = 'Cette séance est introuvable.'; return }
    bib.value = Object.fromEntries(exos.map((e) => [e.id, e]))
    realisations.value = historique
    const sauvegarde = lireSeanceEnCours()
    if (sauvegarde && sauvegarde.workoutId === id && sauvegarde.clientId === user.value.id && !route.query.nouvelle) {
      etat.value = { ...sauvegarde.etat, evenements: [] }
      circuit.value = sauvegarde.circuit || null
      realisationId = sauvegarde.realisationId
      programmeId = sauvegarde.programmeId
      allerAExercice()
    } else {
      etat.value = demarrerSeance({ workout, template, clientId: user.value.id, recordsAvant: meilleuresCharges(historique) }, horloge.now())
      realisationId = globalThis.crypto.randomUUID()
      const programmes = await data.programmes.lister({ clientId: user.value.id })
      const p = programmes.find((x) => (x.workouts || []).includes(id) || (x.semaines || []).flat().includes(id))
      programmeId = p ? p.id : undefined
      allerAExercice()
      sauver()
      // `?nouvelle=1` et `?ex=` ne doivent pas se rejouer à chaque rechargement
      if (route.query.nouvelle || route.query.ex) router.replace({ query: { ...route.query, nouvelle: undefined, ex: undefined } })
    }
  } catch (e) {
    erreur.value = 'Impossible de charger la séance. Réessayez.'
    console.error(e)
  }
}

// Arrivée depuis un exercice de l'overview du Workout (`?ex=<id du bloc>`) : la séance s'ouvre directement sur lui.
function allerAExercice() {
  const i = etat.value.exercices.findIndex((x) => x.id === route.query.ex)
  if (i >= 0 && i !== etat.value.courant) etat.value = reduire(etat.value, { type: 'allerA', exIdx: i }, horloge.now())
}

function sauver() {
  if (!etat.value) return
  sauverSeanceEnCours({ workoutId: etat.value.workoutId, clientId: etat.value.clientId, realisationId, programmeId, etat: etat.value, circuit: circuit.value, sauveLe: Date.now() })
}

// ---------------------------------------------------------------------------------------------
// Horloge : le moteur est tické 4×/s (échéances absolues, pas de dérive)
// ---------------------------------------------------------------------------------------------
const preparation = ref(null) // « Prêt ? » de 3 s avant une série au temps : { exIdx, serieIdx, finLe }
let raf = 0
let intervalle = 0
let dernierTick = Date.now() // heure réelle (pas l'horloge de l'app) : détecte un onglet resté en arrière-plan

// La boucle d'images ne sert ici qu'à lancer la série à la fin du « Prêt ? » ; chaque chrono lit l'horloge lui-même.
function boucle() {
  raf = requestAnimationFrame(boucle)
  if (preparation.value && horloge.now() >= preparation.value.finLe) lancerTravail()
}

function tick(muet = false) {
  const e = etat.value
  if (!e || e.terminee) return
  const t = horloge.now()
  const retard = Date.now() - dernierTick
  dernierTick = Date.now()
  if (!(e.repos || e.travail || e.avancerAuto)) return
  const suivant = reduire(e, { type: 'tick' }, t)
  if (suivant.evenements.length) {
    etat.value = suivant
    sauver()
    surEvenements(suivant.evenements, muet || retard > 2500) // app restée en arrière-plan : pas de son en retard
  }
}

function envoyer(action) {
  const suivant = reduire(etat.value, action, horloge.now())
  etat.value = suivant
  sauver()
  surEvenements(suivant.evenements)
  return suivant
}

function surEvenements(evs, muet = false) {
  for (const ev of evs) {
    if (ev.type === 'serie-validee') { SONS.valide(); pulseRow(ev.exIdx, ev.serieIdx) }
    else if (ev.type === 'travail-demarre') SONS.go()
    else if ((ev.type === 'repos-fini' || ev.type === 'travail-fini') && !muet) SONS.fin()
  }
}

// ---------------------------------------------------------------------------------------------
// Navigation entre exercices : piste horizontale, glissement, swipe
// ---------------------------------------------------------------------------------------------
const piste = ref(null)
const pv = ref(null)
const courant = computed(() => etat.value?.courant ?? 0)
const largeurVue = () => pv.value?.offsetWidth || 390

function glisser(j, avant) {
  if (!piste.value) return
  const x = -j * largeurVue()
  if (mouvementReduit()) { gsap.fromTo(piste.value, { opacity: 0 }, { opacity: 1, duration: 0.25, onStart: () => gsap.set(piste.value, { x }) }); return }
  gsap.to(piste.value, { x, duration: T.slide, ease: E.slide, overwrite: true })
  // la page quittée recule en s'estompant (M2), celle d'arrivée amène son contenu élément par élément
  const ancien = racine.value.querySelector(`.panel[data-i="${avant}"]`)
  if (ancien) gsap.fromTo(ancien, { scale: 1, opacity: 1 }, { scale: 0.9, opacity: 0.3, duration: T.slide, ease: 'power3.out', clearProps: 'transform,opacity' })
  const els = [...racine.value.querySelectorAll(`.panel[data-i="${j}"] [data-c]`)]
  // titre en ligne masquée (M2) : il monte derrière un masque fixe (clip et translation suivent la même courbe)
  const nom = els.find((n) => n.classList.contains('p-nom'))
  if (nom) {
    els.splice(els.indexOf(nom), 1)
    gsap.fromTo(nom, { yPercent: 100, clipPath: 'inset(0% 0% 100% 0%)' }, { yPercent: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, delay: 0.12, ease: 'expo.out', clearProps: 'transform,clipPath' })
  }
  gsap.fromTo(els,{ x: 50 * (j >= avant ? 1 : -1), opacity: 0 }, { x: 0, opacity: 1, duration: 0.9, stagger: 0.05, delay: 0.08, ease: 'expo.out', clearProps: 'transform,opacity' })
}
watch(courant, (j, avant) => glisser(j, avant))

let swipe = null
let aGlisse = false
function swipeBas(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  swipe = { x: e.clientX, y: e.clientY, t: performance.now(), mode: null, dx: 0 }
  aGlisse = false
}
function swipeBouge(e) {
  if (!swipe) return
  const dx = e.clientX - swipe.x
  const dy = e.clientY - swipe.y
  if (!swipe.mode) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipe.mode = 'h'
      try { pv.value.setPointerCapture(e.pointerId) } catch { /* ok */ }
      gsap.killTweensOf(piste.value)
    } else if (Math.abs(dy) > 12) swipe = null
  }
  if (swipe && swipe.mode === 'h') {
    aGlisse = true; swipe.dx = dx
    const bout = (courant.value === 0 && dx > 0) || (courant.value === nbItems.value - 1 && dx < 0)
    gsap.set(piste.value, { x: -courant.value * largeurVue() + dx * (bout ? 0.3 : 1) })
  }
}
function swipeHaut() {
  if (!swipe) return
  const s = swipe
  swipe = null
  if (s.mode !== 'h') return
  const W = largeurVue()
  const v = s.dx / Math.max(1, performance.now() - s.t)
  let j = courant.value
  if ((s.dx < -W * 0.2 || v < -0.25) && j < nbItems.value - 1) j++
  else if ((s.dx > W * 0.2 || v > 0.25) && j > 0) j--
  setTimeout(() => { aGlisse = false }, 50)
  if (j !== courant.value) envoyer({ type: 'allerA', exIdx: j })
  else gsap.to(piste.value, { x: -courant.value * W, duration: 0.6, ease: REBOND.ressort })
}
const surRedimension = () => { if (piste.value) gsap.set(piste.value, { x: -courant.value * largeurVue() }) }

// ---------------------------------------------------------------------------------------------
// En-tête : segments, titre
// ---------------------------------------------------------------------------------------------
const fractions = computed(() => items.value.map(fractionExercice))
const reperes = computed(() => reperesBlocs(items.value))
// « Bloc A » (ou « Option » pour un circuit facultatif) au-dessus de « 2 sur 7 » dans l'en-tête
const titreCourant = computed(() => {
  const it = items.value[courant.value]
  if (!it) return ''
  return it.facultatif ? 'Option' : `Bloc ${reperes.value[courant.value].lettre}`
})
const toutFait = computed(() => items.value.length > 0 && items.value.every(exerciceComplet))
// Les champs utilisés ici (séries faites, prochaine série…) ne dépendent pas de l'heure.
const resume = computed(() => (etat.value ? vueSeance(etat.value, 0) : null))

const derniereParExercice = computed(() => {
  const m = {}
  for (const it of items.value) if (it.type === 'exercice' && !(it.exerciceId in m)) m[it.exerciceId] = derniereFois(realisations.value, it.exerciceId, unite.value)
  return m
})

function pulseRow(exIdx, k) {
  nextTick(() => {
    const r = racine.value?.querySelector(`.panel[data-i="${exIdx}"] .rang[data-serie="${k}"]`)
    if (!r || mouvementReduit()) return
    // action fréquente : retour bref (maquette V2 : ligne 0,3 s ressort, coche 0,35 s pop)
    gsap.fromTo(r.querySelector('.rg-e'), { scale: 0.7 }, { scale: 1, duration: 0.35, ease: REBOND.pop, clearProps: 'transform' })
    gsap.fromTo(r, { scale: 0.97 }, { scale: 1, duration: 0.3, ease: REBOND.ressort, clearProps: 'transform' })
  })
}

// ---------------------------------------------------------------------------------------------
// Boutons principaux : valider / lancer / suivant / terminer
// ---------------------------------------------------------------------------------------------
// Un double toucher sur « Valider la série » ne doit pas valider la suivante pendant que le chrono s'ouvre :
// pendant une ouverture de couche, les boutons de la séance sont ignorés.
let verrouJusqua = 0
const bloquer = (ms = 400) => { verrouJusqua = performance.now() + ms } // > un double toucher (~300 ms), sans avaler le geste suivant
const verrouille = () => performance.now() < verrouJusqua

const srcChrono = ref(null) // bouton d'où naît le cercle du chrono

function libelleDe(i) {
  const it = items.value[i]
  const derniereEtape = i === nbItems.value - 1
  if (it.type !== 'circuit') return libelleAction(it, { toutFait: toutFait.value, derniereEtape })
  if (it.faite || it.passee) return toutFait.value || derniereEtape ? 'Terminer la séance' : 'Exercice suivant'
  return it.facultatif ? 'Faire l\'option' : 'Découvrir le circuit'
}
// Seconde action d'un circuit : passer (obligatoire : discret ; facultatif : vrai bouton, « Terminer sans l'option » en fin de séance)
function libelleSecondaire(i) {
  const it = items.value[i]
  if (it.type !== 'circuit' || it.faite || it.passee) return ''
  if (!it.facultatif) return 'Passer ce circuit'
  return i === nbItems.value - 1 ? 'Terminer sans l\'option' : 'Passer l\'option'
}

function actionPrincipale(i, el) {
  if (verrouille()) return
  const it = items.value[i]
  if (it.type === 'circuit') {
    if (it.faite || it.passee) return suiteOuFin(i, el)
    ouvrirSection(i)
    return
  }
  if (toutFait.value) return terminerSeance(el)
  const k = serieCourante(it)
  if (k < 0) return suiteOuFin(i, el)
  if (estAuTemps(it)) lancerTemps(i, k, el)
  else validerSerie(i, k, el)
}
function suiteOuFin(i, el) {
  if (i === nbItems.value - 1) terminerSeance(el)
  else envoyer({ type: 'allerA', exIdx: i + 1 })
}
function passerCircuit(i, el) {
  if (verrouille()) return
  // une option passée est notée comme telle (le moteur la compte comme réglée) ; un circuit obligatoire sauté reste non fait
  if (items.value[i].facultatif) envoyer({ type: 'passerOption', exIdx: i })
  if (i === nbItems.value - 1) terminerSeance(el)
  else envoyer({ type: 'allerA', exIdx: i + 1 })
}

function validerSerie(exIdx, serieIdx, src) {
  bloquer()
  srcChrono.value = src
  envoyer({ type: 'validerSerie', exIdx, serieIdx })
  // Superset : on enchaîne sur l'exercice suivant du passage (et on revient au premier après le repos du passage complet).
  const it = items.value[exIdx]
  if (it.supersetId) {
    const p = resume.value.prochaine
    if (p && p.exIdx !== exIdx && items.value[p.exIdx].supersetId === it.supersetId) envoyer({ type: 'allerA', exIdx: p.exIdx })
  }
}
function lancerTemps(exIdx, serieIdx, src) {
  bloquer()
  srcChrono.value = src
  preparation.value = { exIdx, serieIdx, finLe: horloge.now() + 3000 }
}
function lancerTravail() {
  const p = preparation.value
  preparation.value = null
  if (p) envoyer({ type: 'lancerSerie', exIdx: p.exIdx, serieIdx: p.serieIdx })
}

// ---------------------------------------------------------------------------------------------
// Chrono de série (préparation, travail, repos) et pastille de repos
// ---------------------------------------------------------------------------------------------
const phaseSimple = computed(() => {
  if (preparation.value) return 'prep'
  if (etat.value?.travail) return 'travail'
  if (etat.value?.repos) return 'repos'
  return null
})
const reposReduit = ref(false)
const simpleRef = ref(null)
const simpleMonte = ref(false)
const cleSimple = ref(0)

// Ce qu'affiche le chrono de série (le temps lui-même est calculé dans ChronoSimple, à partir de l'échéance).
const modeleSimple = computed(() => {
  const ph = phaseSimple.value
  if (!ph) return null
  const e = etat.value
  const fin = ph === 'prep' ? preparation.value.finLe : ph === 'travail' ? e.travail.finLe : e.repos.finLe
  const duree = ph === 'prep' ? 3000 : ph === 'travail' ? e.travail.duree * 1000 : e.repos.duree * 1000
  const exIdx = ph === 'prep' ? preparation.value.exIdx : ph === 'travail' ? e.travail.exIdx : e.repos.exIdx
  return { phase: ph, fin, duree, sous: sousSimple(ph), exo: nomItem(e.exercices[exIdx]) }
})
const affichageSimple = ref(null) // dernier modèle non nul : le chrono reste affiché pendant sa fermeture
watch(modeleSimple, (m) => { if (m) affichageSimple.value = m }, { immediate: true })

function sousSimple(ph) {
  const e = etat.value
  if (ph === 'prep') {
    const { exIdx, serieIdx } = preparation.value
    return `${nomItem(e.exercices[exIdx])} · série ${serieIdx + 1} sur ${e.exercices[exIdx].series.length}`
  }
  if (ph === 'travail') {
    const { exIdx, serieIdx } = e.travail
    return `Série ${serieIdx + 1} sur ${e.exercices[exIdx].series.length} · tenez !`
  }
  const fait = e.exercices[e.repos.exIdx]
  const k = serieCourante(fait)
  if (k >= 0 && !fait.supersetId) return `Ensuite : série ${k + 1} sur ${fait.series.length} · ${nomItem(fait)}`
  const p = vueSeance(e, 0).prochaine
  if (!p) return 'Dernière série !'
  const it = e.exercices[p.exIdx]
  return it.supersetId && p.serieIdx !== null ? `Ensuite : série ${p.serieIdx + 1} sur ${it.series.length} · ${nomItem(it)}` : `Ensuite : ${nomItem(it)}`
}

const simpleVisible = computed(() => !!phaseSimple.value && !(phaseSimple.value === 'repos' && reposReduit.value))
watch(simpleVisible, (v) => {
  if (v) { if (!simpleMonte.value) simpleMonte.value = true } // la création du composant joue l'ouverture
  else if (simpleMonte.value) simpleRef.value?.fermer(reposReduit.value ? centreDe(racine.value.querySelector('.se-titre'), racine.value) : null) // se referme là où naît la pastille
})
async function simpleFerme() {
  simpleMonte.value = false
  if (simpleVisible.value) { cleSimple.value++; await nextTick(); simpleMonte.value = true } // une nouvelle phase a démarré pendant la fermeture
}
watch(() => etat.value?.repos?.debut, () => { reposReduit.value = false })
// Le chrono a servi : on ne garde pas l'ancien bouton (il n'existe plus).
watch(simpleMonte, (m) => { if (m) nextTick(() => { srcChrono.value = null }) })

function rouvrirRepos(el) { srcChrono.value = el; reposReduit.value = false }

const actionsSimple = {
  plus: () => { envoyer({ type: 'ajouterRepos' }); SONS.plus() },
  passer: () => {
    if (preparation.value) lancerTravail()
    else envoyer({ type: 'passerRepos' })
  },
  terminer: () => {
    const w = etat.value.travail
    if (w) envoyer({ type: 'validerSerie', exIdx: w.exIdx, serieIdx: w.serieIdx })
  },
  annuler: () => envoyer({ type: 'annulerTravail' }),
  reduire: () => { reposReduit.value = true }
}

// ---------------------------------------------------------------------------------------------
// Bandeau « Exercice suivant dans 3 s — Rester »
// ---------------------------------------------------------------------------------------------
const avance = computed(() => {
  const a = etat.value?.avancerAuto
  return a && !etat.value.repos && !phaseSimple.value && !circuitMonte.value && !sectionMontee.value ? a : null
})
const nomSuivant = computed(() => (avance.value ? nomItem(items.value[avance.value.vers]) : ''))

// ---------------------------------------------------------------------------------------------
// Série ouverte et roue de valeur
// ---------------------------------------------------------------------------------------------
const serieOuverte = ref(null) // { idx, k, src }
const serieRef = ref(null)
const roueOuverte = ref(null)  // { cle, idx, k, src, config, ancienne }
const roueRef = ref(null)

function ouvrirSerie(idx, k, src) {
  if (verrouille() || aGlisse || serieOuverte.value || simpleMonte.value || circuitMonte.value || sectionMontee.value) return
  bloquer()
  serieOuverte.value = { idx, k, src }
}
function ouvrirRoue(cle, src) {
  if (roueOuverte.value || verrouille()) return
  bloquer()
  const { idx, k } = serieOuverte.value
  const valeur = items.value[idx].series[k].valeurs[cle]
  roueOuverte.value = { cle, idx, k, src, config: configRoue(cle, valeur, unite.value), ancienne: valeur }
}
function roueValidee(index) {
  const { cle, idx, k, config, ancienne, src } = roueOuverte.value
  const valeur = config.stocke(index)
  if (index === config.index) return // inchangé : on garde la valeur exacte du coach
  envoyer({ type: 'modifierValeur', exIdx: idx, serieIdx: k, champ: cle, valeur })
  // les séries suivantes (non faites) qui avaient la même valeur la reprennent
  items.value[idx].series.forEach((s, j) => {
    if (j > k && !s.faite && s.valeurs[cle] === ancienne) envoyer({ type: 'modifierValeur', exIdx: idx, serieIdx: j, champ: cle, valeur })
  })
  // le chiffre défile de l'ancienne à la nouvelle valeur une fois la roue refermée
  const de = cle === 'poids' ? poidsAffiche(ancienne, unite.value) : ancienne ?? 0
  const a = config.valeurDe(index)
  const pas = config.pas
  roueApres = () => {
    const cible = racine.value?.querySelector(`.detail [data-champ="${cle}"] .v`)
    if (cible) compter(cible, de, a, { duree: 0.9, ease: 'expo.out', fmt: (x) => nombreFr(Math.round(x / pas) * pas) })
  }
  }
let roueApres = null
function roueFermee() {
  roueOuverte.value = null
  if (roueApres) { const f = roueApres; roueApres = null; nextTick(f) }
}

function validerDepuisSerie(btn) {
  const { idx, k } = serieOuverte.value
  const it = items.value[idx]
  if (k !== serieCourante(it)) return serieRef.value.fermer() // simple enregistrement des valeurs
  if (estAuTemps(it)) lancerTemps(idx, k, btn)
  else validerSerie(idx, k, btn)
  // le chrono s'ouvre en cercle depuis le bouton ; la série ouverte disparaît dessous. Sans chrono (toute dernière série), elle se referme.
  if (phaseSimple.value) setTimeout(() => { serieOuverte.value = null }, 900)
  else nextTick(() => serieRef.value?.fermer())
}

// ---------------------------------------------------------------------------------------------
// Circuits : chrono plein écran
// ---------------------------------------------------------------------------------------------
const circuitMonte = ref(false)
const circuitRef = ref(null)
// Section du circuit (M1/M2) : s'ouvre au toucher de « Découvrir le circuit », reste sous le chrono, se referme à la fin du circuit
const sectionMontee = ref(false)
const sectionRef = ref(null)
const sectionIdx = ref(-1)
let fermerSectionApres = false
const itemSection = computed(() => items.value[sectionIdx.value] || null)
function ouvrirSection(i) {
  if (verrouille() || sectionMontee.value) return
  bloquer(700)
  sectionIdx.value = i
  sectionMontee.value = true
}
const itemCircuit = computed(() => (circuit.value ? items.value.find((x) => x.id === circuit.value.itemId) : null))
const circuitAffiche = ref(null) // dernier chrono non nul : reste affiché pendant sa fermeture
watch(circuit, (c) => { if (c) circuitAffiche.value = c }, { immediate: true })
const itemAffiche = computed(() => (circuitAffiche.value ? items.value.find((x) => x.id === circuitAffiche.value.itemId) : null))
const stMaintenant = () => etatChrono(itemCircuit.value.format, itemCircuit.value.params, circuit.value.evenements, horloge.now())
const mouvementsChrono = computed(() => {
  const it = itemCircuit.value
  if (!it) return []
  return (it.exercices || []).map((x) => ({ q: x.reps ? String(x.reps) : '·', n: exo(x).nom || 'Exercice' }))
})

function lancerCircuit(i, src) {
  const it = items.value[i]
  bloquer()
  srcChrono.value = src
  circuit.value = { itemId: it.id, evenements: [evenement('demarrer', horloge.now())] }
  circuitMonte.value = true
  sauver()
}
function ajouterEvenement(type, extra) {
  circuit.value = { ...circuit.value, evenements: [...circuit.value.evenements, evenement(type, horloge.now(), extra)] }
  sauver()
}
function fermerCircuit() { circuitRef.value?.fermer() }
function actionCircuit(id) {
  if (id === 'tour' || id === 'suivant') SONS.tour()
  ajouterEvenement(id === 'termine' ? 'termine' : id)
}
function validerCircuit({ repsEnPlus }) {
  const it = itemCircuit.value
  const idx = items.value.indexOf(it)
  fermerSectionApres = true // la section se referme une fois le chrono parti
  if (stMaintenant().saisieRequise) ajouterEvenement('reps-en-plus', { valeur: repsEnPlus })
  const final = etatChrono(it.format, it.params, circuit.value.evenements, horloge.now() + 1)
  envoyer({ type: 'terminerCircuit', exIdx: idx, resultat: final.resultat })
  circuit.value = null
  sauver()
  fermerCircuit()
}
function arreterCircuit() { circuit.value = null; sauver(); fermerCircuit() }
function passerPreparation() {
  const evs = [...circuit.value.evenements]
  const ms = stMaintenant().params.preparation * 1000
  evs[0] = { ...evs[0], t: horloge.now() - ms } // le départ est avancé : la préparation est terminée, le chrono part à 0
  circuit.value = { ...circuit.value, evenements: evs }
  sauver()
}
function circuitFerme() {
  circuitMonte.value = false
  if (fermerSectionApres) { fermerSectionApres = false; sectionRef.value?.fermer() }
}

// ---------------------------------------------------------------------------------------------
// Tiroir, vidéo, sortie
// ---------------------------------------------------------------------------------------------
const tiroirOuvert = ref(false)
const lignesTiroir = computed(() => items.value.map((it, i) => ({
  nom: nomItem(it), detail: detailTiroir(it, unite.value), fait: exerciceComplet(it), courant: i === courant.value,
  cochees: it.type === 'circuit' ? 0 : it.series.filter((s) => s.faite).length, total: it.type === 'circuit' ? 0 : it.series.length
})))
function allerDepuisTiroir(i) {
  tiroirOuvert.value = false
  envoyer({ type: 'allerA', exIdx: i })
}

const video = ref(null) // { nom, embed, lien, type }
const videoMontee = ref(false)
let delaiVideo = 0
function ouvrirVideo(exercice) {
  const v = videoDe(exercice)
  if (v.type === 'aucune') return
  if (v.type === 'lien') { window.open(v.lien, '_blank', 'noopener'); return }
  clearTimeout(delaiVideo)
  video.value = { nom: exercice.nom || 'Vidéo', embed: v.embed, lien: v.lien }
  videoMontee.value = true
}
function fermerVideo() {
  videoMontee.value = false
  delaiVideo = setTimeout(() => { video.value = null }, 450) // l'iframe est retirée une fois la feuille fermée
}

const feuilleQuitter = ref(false)
let sortieAutorisee = false
function demanderQuitter() {
  if (finOuverte.value) return
  if (roueOuverte.value) return roueRef.value?.annuler()
  if (serieOuverte.value) return serieRef.value?.fermer()
  if (videoMontee.value) return fermerVideo()
  if (tiroirOuvert.value) { tiroirOuvert.value = false; return }
  if (simpleMonte.value || circuitMonte.value) return
  if (sectionMontee.value) return sectionRef.value?.retour()
  feuilleQuitter.value = !feuilleQuitter.value
}
// Le bouton « retour » du téléphone ferme d'abord la couche du dessus, puis demande confirmation.
onBeforeRouteLeave(() => {
  if (sortieAutorisee) return true
  demanderQuitter()
  return false
})
const surTouche = (e) => { if (e.key === 'Escape') demanderQuitter() }

// Sortie de la séance : on REVIENT dans l'historique (sans empiler une copie de la page d'origine, sinon le geste retour
// retombait sur le workout et demandait 2 appuis). `history.state.back` = page précédente ; sans elle (adresse ouverte directement) : replace.
const cheminDe = (adresse) => (adresse || '').split('?')[0]
function retourHistorique(cible) {
  const avant = cheminDe(window.history.state?.back)
  const retour = route.query.retour
  if (avant && retour && avant === cheminDe(retour) && cheminDe(cible) === cheminDe(retour)) return router.back()
  // fin de séance : on rentre au tableau de bord en sautant le workout si c'est de là qu'on est venu
  if (cible === '/' && avant && retour && avant === cheminDe(retour) && route.query.depuis === '/') return router.go(-2)
  return router.replace(cible === retour && route.query.depuis ? { path: retour, query: { retour: route.query.depuis } } : cible)
}
function sortir() {
  sortieAutorisee = true
  libererWakeLock()
  fermerPage(racine.value, null, { onFini: () => retourHistorique(route.query.retour || '/') })
}
function abandonner() {
  effacerSeanceEnCours()
  sortir()
}

// ---------------------------------------------------------------------------------------------
// Fin de séance
// ---------------------------------------------------------------------------------------------
const finOuverte = ref(false)
const srcFin = ref(null)
const enregistrement = ref(false)
const erreurFin = ref('')

function terminerSeance(src) {
  bloquer(500)
  feuilleQuitter.value = false
  srcFin.value = src
  if (!etat.value.terminee) envoyer({ type: 'terminer' })
  finOuverte.value = true
}
const recordsFin = computed(() => (etat.value?.resume?.records || []).map((r) => ({ nom: bib.value[r.exerciceId]?.nom || 'Exercice', charge: r.charge })))

async function validerSeance(commentaire) {
  enregistrement.value = true
  erreurFin.value = ''
  try {
    const fin = commentaire ? { ...etat.value, commentaire } : etat.value
    const r = construireRealisation(fin, { id: realisationId, clientId: user.value.id, programmeId, now: horloge.now() })
    await data.enregistrerSeanceOuFile(r)
    effacerSeanceEnCours()
    // récompense : on rentre au tableau de bord, l'écran de fin se referme dans la carte « Cette semaine » (voir Accueil.vue)
    sortieAutorisee = true
    libererWakeLock()
    marquerFinSeance(racine.value?.querySelector('.couche.fin'), realisationId)
    retourHistorique('/')
  } catch (e) {
    console.error(e)
    erreurFin.value = e?.message || 'L\'enregistrement a échoué. Réessayez.'
  } finally {
    enregistrement.value = false
  }
}

// ---------------------------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------------------------
function auRetour() { if (document.visibilityState === 'visible') tick() }

onMounted(async () => {
  installerRessort()
  await charger()
  if (!etat.value) return
  activerWakeLock()
  tick(true) // un repos ou un travail échu pendant la fermeture est soldé sans son
  circuitMonte.value = !!circuit.value
  simpleMonte.value = simpleVisible.value // rechargé en plein repos : le chrono se rouvre
  finOuverte.value = etat.value.terminee // rechargé sur l'écran de fin
  await nextTick()
  if (piste.value) gsap.set(piste.value, { x: -courant.value * largeurVue() })
  // ouverture : le cercle part du bas de l'écran (là où se trouvait « Démarrer »), le contenu monte en cascade
  const els = racine.value.querySelectorAll('[data-c]')
  gsap.set(els, { opacity: 0 })
  // arrivée depuis « Démarrer » de la page Workout : un rideau d'accent (déjà plein à l'écran) s'efface ; sinon cercle depuis le bas
  if (consommerLancement()) leverRideau(racine.value)
  else ouvrirCercle(racine.value, null)
  cascade(racine.value, { delay: 0.3 })
  raf = requestAnimationFrame(boucle)
  intervalle = setInterval(() => tick(), 250)
  window.addEventListener('resize', surRedimension)
  window.addEventListener('keydown', surTouche)
  document.addEventListener('visibilitychange', auRetour)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInterval(intervalle)
  clearTimeout(delaiVideo)
  window.removeEventListener('resize', surRedimension)
  window.removeEventListener('keydown', surTouche)
  document.removeEventListener('visibilitychange', auRetour)
  libererWakeLock()
  if (racine.value) nettoyer(racine.value)
  gsap.killTweensOf(piste.value)
})

defineExpose({ envoyer })
</script>

<template>
  <main ref="racine" class="seance" data-racine @pointerdown.capture="deverrouiller" @click.capture="deverrouiller" @touchend.capture="deverrouiller">
    <div v-if="erreur" class="vide">
      <p>{{ erreur }}</p>
      <button class="gros" type="button" @click="router.replace('/')">Retour</button>
    </div>

    <template v-else-if="etat">
      <div class="se">
        <header class="se-haut" data-c>
          <div class="segments" aria-hidden="true">
            <i v-for="(f, k) in fractions" :key="k" :class="{ cur: k === courant }"><b :style="{ transform: `scaleX(${f})` }"></b></i>
          </div>
          <div class="se-barre">
            <button class="rond" type="button" aria-label="Quitter la séance" @click="feuilleQuitter = true"><Icone nom="fermer" /></button>
            <div class="se-titre" :class="{ cache: reposReduit && etat.repos && !simpleMonte }"><span>{{ titreCourant }}</span><br><b>{{ courant + 1 }}</b> sur {{ nbItems }}</div>
            <button class="pastille-total" type="button" aria-label="Aperçu de la séance et temps écoulé" @click="tiroirOuvert = true"><TempsTotal :debut="etat.demarreLe" /></button>
          </div>
        </header>

        <div ref="pv" class="piste-vue" @pointerdown="swipeBas" @pointermove="swipeBouge" @pointerup="swipeHaut" @pointercancel="swipeHaut">
          <div ref="piste" class="piste">
            <template v-for="(it, i) in items" :key="it.id">
              <PanneauCircuit
                v-if="it.type === 'circuit'" :item="it" :idx="i" :exercices="bib" :libelle="libelleDe(i)" :libelle-secondaire="libelleSecondaire(i)" :repere="reperes[i]" :inert="i !== courant"
                @action="actionPrincipale(i, $event)" @passer="passerCircuit(i, $event)" @video="ouvrirVideo"
              />
              <PanneauExercice
                v-else :item="it" :idx="i" :exercice="exo(it)" :unite="unite" :derniere="derniereParExercice[it.exerciceId]" :libelle="libelleDe(i)" :repere="reperes[i]" :inert="i !== courant"
                @ouvrir-serie="(k, el) => ouvrirSerie(i, k, el)" @action="actionPrincipale(i, $event)" @video="ouvrirVideo(exo(it))"
              />
            </template>
          </div>
        </div>
      </div>

      <TiroirOverview
        :ouvert="tiroirOuvert" :titre="etat.workoutNom" :sous="`${resume.seriesFaites}/${resume.seriesTotal} séries · touchez un exercice pour y aller`"
        :lignes="lignesTiroir" @ouvrir="tiroirOuvert = true" @fermer="tiroirOuvert = false" @aller="allerDepuisTiroir"
      />

      <ToastSuite :visible="!!avance" :nom="nomSuivant" :fin-le="avance ? avance.finLe : 0" @rester="envoyer({ type: 'rester' })" />

      <!-- Pastille de repos : le chrono réduit reste visible, un toucher le rouvre -->
      <PastilleRepos v-if="reposReduit && etat.repos && !simpleMonte" :fin-le="etat.repos.finLe" @ouvrir="rouvrirRepos" />

      <SerieDetail
        v-if="serieOuverte" ref="serieRef" :item="items[serieOuverte.idx]" :serie-idx="serieOuverte.k" :exercice="exo(items[serieOuverte.idx])"
        :src="serieOuverte.src" :unite="unite" :courante="serieOuverte.k === serieCourante(items[serieOuverte.idx])"
        :au-temps="estAuTemps(items[serieOuverte.idx])" :derniere="derniereParExercice[items[serieOuverte.idx].exerciceId]"
        @champ="ouvrirRoue" @valider="validerDepuisSerie" @ferme="serieOuverte = null"
      />
      <RoueValeur
        v-if="roueOuverte" ref="roueRef" :config="roueOuverte.config" :src="roueOuverte.src"
        :titre="`${roueOuverte.config.label} · ${exo(items[roueOuverte.idx]).nom || ''}`" :sous="`Série ${roueOuverte.k + 1} sur ${items[roueOuverte.idx].series.length}`"
        @valide="roueValidee" @ferme="roueFermee"
      />

      <ChronoSimple
        v-if="simpleMonte && affichageSimple" :key="cleSimple" ref="simpleRef" :phase="affichageSimple.phase" :fin="affichageSimple.fin"
        :duree="affichageSimple.duree" :sous="affichageSimple.sous" :etiquette-exo="affichageSimple.exo" :debut="etat.demarreLe" :src="srcChrono" :reductible="affichageSimple.phase === 'repos'"
        @plus="actionsSimple.plus" @passer="actionsSimple.passer" @terminer="actionsSimple.terminer" @annuler="actionsSimple.annuler"
        @reduire="actionsSimple.reduire" @ferme="simpleFerme"
      />
      <SectionCircuit
        v-if="sectionMontee && itemSection" ref="sectionRef" :item="itemSection" :exercices="bib" :repere="reperes[sectionIdx]" :debut="etat.demarreLe"
        @pret="lancerCircuit(sectionIdx, $event)" @video="ouvrirVideo" @ferme="sectionMontee = false"
      />
      <ChronoCircuit
        v-if="circuitMonte && itemAffiche" ref="circuitRef" :item="itemAffiche" :evenements="circuitAffiche.evenements" :mouvements="mouvementsChrono" :debut="etat.demarreLe" :src="srcChrono"
        @action="actionCircuit" @pause="ajouterEvenement('pause')" @reprendre="ajouterEvenement('reprendre')" @arreter="arreterCircuit"
        @passer-prep="passerPreparation" @valider="validerCircuit" @ferme="circuitFerme"
      />

      <FinSeance
        v-if="finOuverte && etat.resume" :resume="etat.resume" :nom-workout="etat.workoutNom" :nb-exercices="resume.exercicesFaits" :records="recordsFin"
        :unite="unite" :src="srcFin" :en-cours="enregistrement" :erreur="erreurFin" @valider="validerSeance"
      />

      <FeuilleBas :ouverte="feuilleQuitter" titre="Quitter la séance ?" @fermer="feuilleQuitter = false">
        <p>Vos séries déjà faites sont conservées si vous terminez maintenant. Abandonner efface tout.</p>
        <button class="gros" type="button" @click="feuilleQuitter = false">Continuer la séance</button>
        <button v-if="resume.seriesFaites > 0 || resume.exercicesFaits > 0" class="gros doux" type="button" @click="terminerSeance(null)">Terminer la séance maintenant</button>
        <button class="gros contour" type="button" @click="abandonner">Abandonner la séance</button>
      </FeuilleBas>

      <FeuilleBas :ouverte="videoMontee" :titre="video?.nom || 'Vidéo'" @fermer="fermerVideo">
        <div v-if="video" class="video-cadre">
          <iframe
            :src="video.embed" title="Vidéo de l'exercice" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
        </div>
        <a v-if="video" class="gros doux" :href="video.lien" target="_blank" rel="noopener">Ouvrir sur YouTube</a>
        <button class="gros" type="button" @click="fermerVideo">Fermer</button>
      </FeuilleBas>
    </template>
  </main>
</template>

<style scoped>
.seance { position: fixed; inset: 0; margin: 0 auto; max-width: 520px; background: var(--fond); color: var(--texte); overflow: hidden; overflow: clip; }
.vide { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 20px; padding: var(--pad); font-size: 18px; text-align: center; }
.se { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--fond); }
.se-haut { padding: var(--haut) var(--pad) 0; flex: none; }
.segments { display: flex; gap: 4px; margin-bottom: 12px; }
.segments i { flex: 1; height: 7px; border-radius: 4px; background: var(--surface-2); overflow: hidden; display: block; }
.segments i.cur { background: color-mix(in srgb, var(--texte) 28%, var(--surface-2)); }
.segments b { display: block; height: 100%; width: 100%; border-radius: 4px; background: var(--accent-lisible); transform-origin: left; transition: transform .8s var(--ease); }
.se-barre { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: calc(var(--e) * 52px); }
.se-titre { font-size: calc(var(--e) * 13px); letter-spacing: .12em; text-transform: uppercase; font-weight: 600; color: var(--texte-doux); text-align: center; line-height: 1.3; min-width: 0; transition: opacity .2s var(--ease); }
/* temps total de séance (M4) : pastille blanche qui ouvre aussi l'aperçu */
.pastille-total { min-width: calc(var(--e) * 76px); min-height: var(--cible); padding: 6px 12px; border-radius: 18px; background: var(--surface); color: var(--texte); display: inline-flex; align-items: center; justify-content: center; flex: none; }
/* repos réduit : la pastille prend la place du titre (au centre de la barre), le titre s'efface dessous */
.se-titre.cache { opacity: 0; }
.se-titre span { display: inline-block; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
.se-titre b { color: var(--texte); font-family: var(--font-texte); font-weight: 700; letter-spacing: 0; }
.piste-vue { position: relative; flex: 1; overflow: hidden; overflow: clip; touch-action: pan-y; }
.piste { position: absolute; inset: 0; display: flex; will-change: transform; }
.video-cadre { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 18px; overflow: hidden; background: var(--surface-2); margin: 14px 0 12px; }
.video-cadre iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
a.gros { text-decoration: none; margin-bottom: 10px; }
@media (prefers-reduced-motion: reduce) { .segments b { transition: none; } }
</style>
