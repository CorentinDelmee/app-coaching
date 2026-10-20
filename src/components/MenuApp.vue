<script setup>
// Menu de l'app : 6 rubriques. Le bouton (haut droite) fait jaillir un aplat d'accent en cercle ; choisir une rubrique garde le
// rideau plein pendant que la page change dessous, puis il se relève. Clavier : Entrée/Espace ouvrent, Échap ferme, Tab circule.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { data } from '../data/index.js'
import { questionnairesDus } from '../domain/questionnairesDus.js'
import { jourLocal } from '../domain/dates.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { fermerCercle, mouvementReduit, nettoyer, ouvrirCercle } from '../anim/transitions.js'
import { hauteurDe } from '../anim/geometrie.js'
import { sauterFermeture } from '../anim/passage.js'
import { T } from '../anim/constantes.js'

const route = useRoute()
const router = useRouter()

const RUBRIQUES = [
  { id: 'accueil', n: '01', t: 'Accueil', chemin: '/' },
  { id: 'programme', n: '02', t: 'Programme', chemin: '/programme' },
  { id: 'coaching', n: '03', t: 'Coaching', chemin: '/coaching' },
  { id: 'questionnaires', n: '04', t: 'Questionnaires', chemin: '/bientot/questionnaires' },
  { id: 'suivi', n: '05', t: 'Suivi', chemin: '/bientot/suivi' },
  { id: 'profil', n: '06', t: 'Profil', chemin: '/bientot/profil' }
]

// Pas de menu en séance, sur la page Workout (le bouton Démarrer y est roi) ni dans l'espace coach.
const visible = computed(() => !['seance', 'workout'].includes(route.name) && !/^\/coach(\/|$)/.test(route.path))
const courante = computed(() => {
  const n = route.name
  if (n === 'accueil') return 'accueil'
  if (n === 'programme' || n === 'workout') return 'programme'
  if (n === 'coaching') return 'coaching'
  if (n === 'bientot') return route.params.rubrique
  return ''
})

const cadre = ref(null)
const menu = ref(null)
const btn = ref(null)
const ouvert = ref(false)
const occupe = ref(false)
const pied = ref('')
const aRemplir = ref(0)
let tl = null

async function rafraichir() {
  try {
    const user = await utilisateurCourant()
    if (!user) return
    const [q, r, p] = await Promise.all([data.questionnaires.lister(), data.reponses.lister({ clientId: user.id }), data.programmes.lister({ clientId: user.id })])
    aRemplir.value = questionnairesDus({ questionnaires: q, reponses: r, clientId: user.id, aujourdhui: jourLocal(horloge.now()) }).length
    pied.value = [user.nom, p[0]?.nom].filter(Boolean).join(' · ')
  } catch { /* le menu fonctionne sans la pastille */ }
}

const items = () => Array.from(menu.value.querySelectorAll('.m-item .t, .m-item .n, .m-item .pt, .m-sur, .m-pied'))
const rm = mouvementReduit
const burger = (ouvre, dur) => {
  const [a, b] = btn.value.children
  gsap.to(a, { y: ouvre ? 0 : -4.5, rotate: ouvre ? 45 : 0, duration: dur, ease: ouvre ? 'expo.out' : 'power3.out' })
  gsap.to(b, { y: ouvre ? 0 : 4.5, rotate: ouvre ? -45 : 0, duration: dur, ease: ouvre ? 'expo.out' : 'power3.out' })
}

async function ouvrir() {
  if (ouvert.value || occupe.value) return
  ouvert.value = true
  rafraichir()
  nettoyer(menu.value)
  burger(true, rm() ? 0.2 : 0.5)
  ouvrirCercle(menu.value, btn.value, { duree: T.menuOuvre ?? 0.78 })
  if (!rm()) gsap.fromTo(items(), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.85, stagger: 0.045, ease: 'expo.out', delay: 0.22, clearProps: 'transform,opacity' })
  await nextTick()
  setTimeout(() => { if (ouvert.value) menu.value.querySelector('[aria-current="true"], .m-item')?.focus() }, 350)
}
function fermer() {
  if (!ouvert.value || occupe.value) return
  ouvert.value = false
  burger(false, 0.35)
  if (!rm()) gsap.to(menu.value.querySelectorAll('.m-item .t, .m-item .n'), { opacity: 0, duration: 0.16 })
  fermerCercle(menu.value, btn.value, { onFini: () => gsap.set(menu.value.querySelectorAll('.m-item .t, .m-item .n'), { clearProps: 'opacity' }) })
  btn.value.focus()
}
const basculer = () => (ouvert.value ? fermer() : ouvrir())

// Choisir une rubrique : la page change derrière le rideau, qui se relève ensuite (bord bas qui monte).
async function aller(r) {
  if (occupe.value) return
  if (r.id === courante.value) { fermer(); return }
  occupe.value = true
  ouvert.value = false
  nettoyer(menu.value)
  sauterFermeture()
  await router.replace(r.chemin)
  burger(false, 0.5)
  const H = hauteurDe(cadre.value)
  const fin = () => { menu.value.hidden = true; gsap.set(menu.value, { clearProps: 'clipPath,opacity' }); gsap.set(items(), { clearProps: 'transform,opacity' }); occupe.value = false }
  if (rm()) { tl = gsap.to(menu.value, { opacity: 0, duration: 0.2, onComplete: fin }); return }
  tl = gsap.timeline({ onComplete: fin })
    .to(items(), { yPercent: -60, opacity: 0, duration: 0.45, stagger: 0.02, ease: 'power2.out' }, 0.12)
    .fromTo(menu.value, { clipPath: 'inset(0px 0px 0px 0px round 0px 0px 44px 44px)' },
      { clipPath: `inset(0px 0px ${H}px 0px round 0px 0px 44px 44px)`, duration: 0.7, ease: 'expo.inOut', immediateRender: false }, 0.22)
}

function surTouche(e) {
  if (e.key === 'Escape' && ouvert.value) { e.preventDefault(); fermer() }
}
onMounted(() => {
  rafraichir()
  window.addEventListener('keydown', surTouche)
  if (btn.value && !rm()) gsap.fromTo(btn.value, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, delay: 0.5, ease: 'back.out(2)', clearProps: 'transform,opacity' })
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', surTouche)
  if (menu.value) nettoyer(menu.value)
  if (tl) tl.kill()
})
// changement de page par un autre moyen (lien, retour du téléphone) : le menu se referme sans animation
watch(() => route.fullPath, () => {
  if (ouvert.value && !occupe.value) { ouvert.value = false; nettoyer(menu.value); menu.value.hidden = true; burger(false, 0.2) }
})
</script>

<template>
  <div v-if="visible" ref="cadre" class="menu-cadre" data-racine>
    <button ref="btn" class="btn-menu" type="button" :aria-expanded="ouvert" aria-controls="menu-app" :aria-label="ouvert ? 'Fermer le menu' : 'Ouvrir le menu'" @click="basculer">
      <i></i><i></i>
      <span v-if="aRemplir && !ouvert" class="btn-pastille" aria-hidden="true"></span>
    </button>
    <nav id="menu-app" ref="menu" class="menu-app" hidden aria-label="Menu principal">
      <p class="m-sur">Menu</p>
      <ul>
        <li v-for="r in RUBRIQUES" :key="r.id">
          <button class="m-item" type="button" :aria-current="r.id === courante" @click="aller(r)">
            <span class="n">{{ r.n }}</span>
            <span class="t">{{ r.t }}<span v-if="r.id === 'questionnaires' && aRemplir" class="bulle" :aria-label="`${aRemplir} à remplir`">{{ aRemplir }}</span></span>
            <span class="pt"></span>
          </button>
        </li>
      </ul>
      <p class="m-pied">{{ pied }}</p>
    </nav>
  </div>
</template>
