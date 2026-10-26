<script setup>
// Menu de l'app « push back » (M5, maquette V2) : 6 rubriques. La page courante (le « plan ») recule en 3D vers la droite et laisse voir
// le menu posé derrière elle ; les rubriques arrivent depuis la profondeur. Choisir une rubrique : le plan s'envole à droite, la nouvelle
// page revient de la profondeur. Clavier : Entrée/Espace ouvrent, Échap ferme, Tab circule. Mouvement réduit : fondus et glissements courts.
// Aligné sur M5 (design/m5/assets/app.js ouvrirMenu / fermerMenu / allerRubrique) : sur le tableau de bord, le bouton est DANS la page
// (en haut à gauche, il recule avec elle) et demande l'ouverture par src/lib/menu.js ; ailleurs, un bouton flottant du même dessin.
// La croix est faite en CSS (html.menu-ouvert .burger, 0,45 s courbe vaul), comme la maquette.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { data } from '../data/index.js'
import { questionnairesDus } from '../domain/questionnairesDus.js'
import { accesSante } from '../domain/consentement.js'
import { jourLocal } from '../domain/dates.js'
import { numeroSemaine } from '../domain/programme.js'
import { EVT_MENU, etatMenu } from '../lib/menu.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { mouvementReduit } from '../anim/transitions.js'
import { sauterFermeture } from '../anim/passage.js'
import { M5, MENU } from '../anim/constantes.js'

const route = useRoute()
const router = useRouter()

const RUBRIQUES = [
  { id: 'accueil', n: '01', t: 'Accueil', chemin: '/' },
  { id: 'programme', n: '02', t: 'Programme', chemin: '/programme' },
  { id: 'coaching', n: '03', t: 'Coaching', chemin: '/coaching' },
  { id: 'questionnaires', n: '04', t: 'Questionnaires', chemin: '/questionnaires' },
  { id: 'suivi', n: '05', t: 'Suivi', chemin: '/suivi' },
  { id: 'profil', n: '06', t: 'Profil', chemin: '/profil' }
]

// Pas de menu en séance, sur la page Workout (le bouton Démarrer y est roi), en questionnaire ni dans l'espace coach.
const visible = computed(() => !['seance', 'workout', 'questionnaire'].includes(route.name) && !route.meta.sansMenu && !/^\/coach(\/|$)/.test(route.path))
const courante = computed(() => {
  const n = route.name
  if (n === 'accueil') return 'accueil'
  if (n === 'programme' || n === 'workout') return 'programme'
  if (n === 'coaching') return 'coaching'
  if (n === 'questionnaires' || n === 'questionnaire') return 'questionnaires'
  if (n === 'suivi') return 'suivi'
  if (n === 'profil') return 'profil'
  if (n === 'bientot') return route.params.rubrique
  return ''
})

// Tableau de bord : le bouton est dans la page (M5) ; le bouton flottant n'existe que sur les autres rubriques.
const surAccueil = computed(() => route.name === 'accueil')
const cadre = ref(null)
const menu = ref(null)
const btn = ref(null)
const ouvert = ref(false)
const occupe = ref(false)
const pied = ref({ nom: '', programme: '' })
const aRemplir = ref(0)
let tl = null

async function rafraichir() {
  try {
    const user = await utilisateurCourant()
    if (!user) return
    const [q, r, p] = await Promise.all([data.questionnaires.lister(), data.reponses.lister({ clientId: user.id }), data.programmes.lister({ clientId: user.id })])
    aRemplir.value = !accesSante(user) ? 0 : questionnairesDus({ questionnaires: q, reponses: r, clientId: user.id, aujourdhui: jourLocal(horloge.now()) }).length
    // pied du menu (M5 : « Force & cardio · semaine 3 / 8 »)
    const prog = p[0]
    let ligne = prog?.nom || ''
    if (prog) {
      const n = numeroSemaine(prog, jourLocal(horloge.now()))
      const total = prog.mode === 'parSemaine' ? prog.semaines?.length : prog.nbSemaines
      if (n >= 1) ligne += ` · semaine ${n}${total ? ` / ${total}` : ''}`
    }
    pied.value = { nom: user.nom, programme: ligne }
  } catch { /* le menu fonctionne sans la pastille */ }
}

const plan = () => document.querySelector('.ecran') // la page courante, celle qui recule
const rubriques = () => Array.from(menu.value.querySelectorAll('.m-item'))
const autres = () => Array.from(menu.value.querySelectorAll('.m-sur, .m-pied'))
const rm = mouvementReduit
// Croix du bouton : en CSS (M5), sur la classe html.menu-ouvert ; sert aussi à la parallaxe du tableau de bord (coupée menu ouvert).
const burger = (ouvre) => { document.documentElement.classList.toggle('menu-ouvert', ouvre); etatMenu.ouvert = ouvre }
// le bouton à reprendre en main : le flottant, ou celui de la page (tableau de bord)
const bouton = () => btn.value || plan()?.querySelector('[data-nav]') || null
// Le bouton suit le plan : il se pose en haut à gauche de la page reculée, comme dans la maquette (la croix reste « sur » la page).
const decalageBouton = () => {
  if (!btn.value) return 0
  const W = cadre.value.offsetWidth
  return W * MENU.x + 14 - (W - 16 - btn.value.offsetWidth)
}
function remettrePlan(p) {
  if (!p) return
  p.inert = false
  p.classList.remove('plan-recule')
  gsap.set(p, { clearProps: 'transform,opacity,transformPerspective,willChange' })
}

function ouvrir() {
  const p = plan()
  if (ouvert.value || occupe.value || !p) return
  ouvert.value = true
  rafraichir()
  menu.value.hidden = false
  p.classList.add('plan-recule')
  p.inert = true // rien ne se touche ni ne se tabule derrière le menu
  burger(true)
  const W = cadre.value.offsetWidth
  const flottant = btn.value ? [btn.value] : []
  tl?.kill()
  tl = gsap.timeline({ onComplete: () => { if (ouvert.value) menu.value.querySelector('.m-item.on, .m-item')?.focus({ preventScroll: true }) } })
  if (rm()) {
    tl.to(p, { x: W * MENU.x, duration: 0.25 }, 0).to(flottant, { x: decalageBouton(), duration: 0.25 }, 0)
      .fromTo([...rubriques(), ...autres()], { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0)
  } else {
    tl.to(p, { x: W * MENU.x, scale: MENU.scale, rotationY: MENU.rot, transformPerspective: 1400, transformOrigin: '0% 50%', duration: M5.T.menu, ease: M5.E.sortie }, 0)
      .to(flottant, { x: decalageBouton(), duration: M5.T.menu, ease: M5.E.sortie }, 0)
      .fromTo(rubriques(), { x: -80, z: -340, rotationY: 42, opacity: 0 }, { x: 0, z: 0, rotationY: 0, opacity: 1, duration: 0.95, stagger: 0.055, ease: 'expo.out' }, 0.05)
      .fromTo(autres(), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'expo.out' }, 0.3)
  }
}

function fermer() {
  const p = plan()
  if (!ouvert.value || occupe.value) return
  ouvert.value = false
  occupe.value = true
  burger(false)
  tl?.kill()
  tl = gsap.timeline({ onComplete: () => {
    menu.value.hidden = true; remettrePlan(p); gsap.set(rubriques(), { clearProps: 'all' }); occupe.value = false
    bouton()?.focus({ preventScroll: true }) // la page n'est plus inerte : le focus revient au bouton du menu
  } })
  if (btn.value) tl.to(btn.value, { x: 0, duration: rm() ? 0.25 : M5.T.menuFerme, ease: M5.E.sortie }, 0)
  if (rm()) tl.to(p, { x: 0, duration: 0.25 }, 0)
  else tl.to(p, { x: 0, scale: 1, rotationY: 0, duration: M5.T.menuFerme, ease: M5.E.sortie }, 0).to(rubriques(), { opacity: 0, x: -30, z: -120, duration: 0.3, stagger: 0.015, ease: 'power2.out' }, 0)
  btn.value?.focus()
}
const basculer = () => (ouvert.value ? fermer() : ouvrir())

// Choisir une rubrique : le plan s'envole, la page change derrière, la nouvelle page revient de la profondeur (z -520 -> 0).
async function aller(r) {
  if (occupe.value) return
  if (r.id === courante.value) { fermer(); return }
  occupe.value = true
  ouvert.value = false
  const ancien = plan()
  const W = cadre.value.offsetWidth
  tl?.kill()
  burger(false)
  if (btn.value) gsap.to(btn.value, { x: 0, duration: rm() ? 0.15 : 0.4, ease: 'power3.out' })
  await new Promise((fini) => {
    if (rm()) tl = gsap.to(ancien, { opacity: 0, duration: 0.15, onComplete: fini })
    else {
      tl = gsap.timeline({ onComplete: fini })
        .to(rubriques(), { opacity: 0, x: -30, z: -120, duration: 0.3, stagger: 0.012, ease: 'power2.out' }, 0)
        .to(ancien, { x: W * 1.08, rotationY: -26, duration: 0.38, ease: 'power3.out' }, 0)
    }
  })
  sauterFermeture() // la page quittée ne rejoue pas sa fermeture : elle est déjà partie
  await router.replace(r.chemin)
  await nextTick() // la nouvelle page est dans le DOM mais pas encore peinte : on la place en profondeur avant qu'elle ne s'affiche
  menu.value.hidden = true
  gsap.set(rubriques(), { clearProps: 'all' })
  const neuf = plan()
  if (neuf && neuf !== ancien) {
    gsap.set(neuf, { z: rm() ? 0 : -520, opacity: 0, transformPerspective: 1000 })
    tl = gsap.to(neuf, { z: 0, opacity: 1, duration: rm() ? 0.25 : 0.9, ease: 'expo.out', onComplete: () => { remettrePlan(neuf); occupe.value = false } })
  } else { remettrePlan(neuf); occupe.value = false }
}

// Menu ouvert : Échap ferme ; Tab reste dans le menu (bouton + rubriques), jamais derrière lui.
function surTouche(e) {
  if (!ouvert.value) return
  if (e.key === 'Escape') { e.preventDefault(); fermer(); return }
  if (e.key !== 'Tab') return
  const cycle = [btn.value, ...menu.value.querySelectorAll('.m-item')].filter(Boolean)
  const i = cycle.indexOf(document.activeElement)
  const cible = e.shiftKey ? cycle[i <= 0 ? cycle.length - 1 : i - 1] : cycle[i < 0 || i === cycle.length - 1 ? 0 : i + 1]
  e.preventDefault()
  cible.focus()
}
// le bouton apparaît (avec un petit ressort) chaque fois que le menu devient disponible : après connexion, en sortant de la séance…
function apparition() {
  rafraichir()
  nextTick(() => { if (btn.value && !rm()) gsap.fromTo(btn.value, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, delay: 0.5, ease: 'back.out(1.7)', clearProps: 'transform,opacity' }) })
}
const demande = () => { if (visible.value) basculer() } // bouton du menu posé dans une page (tableau de bord)
onMounted(() => { window.addEventListener('keydown', surTouche); window.addEventListener(EVT_MENU, demande); if (visible.value) apparition() })
watch(visible, (v) => { if (v) apparition() })
watch(surAccueil, (v) => { if (!v && visible.value) apparition() }) // quitter le tableau de bord : le bouton flottant arrive avec la page
onBeforeUnmount(() => {
  window.removeEventListener('keydown', surTouche)
  window.removeEventListener(EVT_MENU, demande)
  burger(false)
  if (tl) tl.kill()
})
// changement de page par un autre moyen (lien, retour du téléphone) : le menu se referme sans animation
watch(() => route.fullPath, async () => {
  if (!ouvert.value || occupe.value || !menu.value) return
  ouvert.value = false
  tl?.kill()
  menu.value.hidden = true
  burger(false)
  if (btn.value) gsap.set(btn.value, { x: 0 })
  gsap.set(rubriques(), { clearProps: 'all' })
  await nextTick()
  remettrePlan(plan())
})
</script>

<template>
  <template v-if="visible">
    <!-- Menu : posé derrière la page (il précède la page dans le DOM, voir App.vue), révélé quand la page recule -->
    <nav id="menu-app" ref="menu" class="menu-app" hidden aria-label="Menu principal">
      <p class="m-sur">Corentin Delmée<br>Coaching</p>
      <ul>
        <li v-for="r in RUBRIQUES" :key="r.id">
          <button class="m-item" type="button" :class="{ on: r.id === courante }" :aria-current="r.id === courante ? 'page' : undefined" @click="aller(r)">
            <span class="n">{{ r.n }}</span>
            <span class="t">{{ r.t }}</span>
            <span v-if="r.id === 'questionnaires' && aRemplir" class="bulle" :aria-label="`${aRemplir} à remplir`">{{ aRemplir }}</span>
          </button>
        </li>
      </ul>
      <p class="m-pied">{{ pied.nom }}<br><span>{{ pied.programme }}</span></p>
    </nav>
    <div ref="cadre" class="menu-cadre" data-racine>
      <!-- Zone de la page reculée : un toucher referme le menu (les rubriques, à gauche, restent touchables) -->
      <button v-if="ouvert" class="voile-plan" type="button" aria-label="Fermer le menu" tabindex="-1" @click="fermer"></button>
      <button v-if="!surAccueil" ref="btn" class="btn-menu btn-nav" type="button" :aria-expanded="ouvert" aria-controls="menu-app" :aria-label="ouvert ? 'Fermer le menu' : 'Ouvrir le menu'" @click="basculer">
        <span class="burger" aria-hidden="true"><i></i><i></i></span>
        <span v-if="aRemplir && !ouvert" class="btn-pastille" aria-hidden="true"></span>
      </button>
    </div>
  </template>
</template>
