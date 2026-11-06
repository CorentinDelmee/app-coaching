<script setup>
// Cadre Studio du tableau de bord coach (maquette design-coach/d3) : barre latérale (ordinateur, > 900 px),
// barre d'onglets flottante + feuille « Plus » (téléphone). Une seule liste de navigation : studio/navigation.js.
// PONT : une route sans `meta: { studio: true }` (ancienne vue pas encore refaite) est rendue dans <div class="coach c-pont">,
// avec les anciens tokens sombres de coach.css : elle reste utilisable telle quelle.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import data from '../data/index.js'
import { effacerSeanceEnCours } from '../lib/seanceEnCours.js'
import { sauterFermeture } from '../anim/passage.js'
import { etat, rafraichir } from './store.js'
import { NAV_PRINCIPALE, NAV_SECONDAIRE, estActif, compte } from './studio/navigation.js'
import IconeSt from './studio/IconeSt.vue'
import ToastSt from './studio/ToastSt.vue'
import './coach.css'
import './studio/tokens.css'
import './studio/layout.css'

const route = useRoute()
const router = useRouter()
onMounted(rafraichir)

const BAS = NAV_PRINCIPALE.filter((e) => e.bas)
const DANS_PLUS = [...NAV_PRINCIPALE.filter((e) => !e.bas), ...NAV_SECONDAIRE]
const actif = (e) => estActif(e, route.path)
const plusActif = computed(() => !BAS.some(actif))
const totalPlus = computed(() => DANS_PLUS.reduce((n, e) => n + compte(e, etat), 0))

// Feuille « Plus » (téléphone)
const plusOuvert = ref(false)
const boutonPlus = ref(null)
const feuille = ref(null)
function ouvrirPlus() {
  plusOuvert.value = true
  nextTick(() => feuille.value?.querySelector('a, button')?.focus())
}
function fermerPlus(rendreFocus = true) {
  if (!plusOuvert.value) return
  plusOuvert.value = false
  if (rendreFocus) boutonPlus.value?.focus()
}
watch(() => route.path, () => fermerPlus(false))
const surTouche = (ev) => { if (ev.key === 'Escape' && plusOuvert.value) { ev.preventDefault(); fermerPlus() } }
onMounted(() => document.addEventListener('keydown', surTouche))
onBeforeUnmount(() => document.removeEventListener('keydown', surTouche))

// Même sortie que le Profil client : session fermée, séance sauvegardée effacée.
async function deconnecter() {
  await data.deconnecter()
  effacerSeanceEnCours()
  sauterFermeture()
  router.replace('/bienvenue')
}
</script>

<template>
  <div class="st-app st-cadre">
    <a class="st-evitement" href="#st-contenu">Aller au contenu</a>

    <nav class="st-nav" aria-label="Navigation coach">
      <div class="st-marque"><i aria-hidden="true" />Studio coach</div>
      <RouterLink v-for="e in NAV_PRINCIPALE" :key="e.to" v-slot="{ href, navigate }" :to="e.to" custom>
        <a :href="href" :aria-current="actif(e) ? 'page' : undefined" @click="navigate">
          <IconeSt :nom="e.icone" />{{ e.texte }}
          <span v-if="compte(e, etat)" class="st-pastille"><span class="st-sr">, </span>{{ compte(e, etat) }}</span>
        </a>
      </RouterLink>
      <p class="st-nav-titre">Autres pages</p>
      <RouterLink v-for="e in NAV_SECONDAIRE" :key="e.to" v-slot="{ href, navigate, isActive }" :to="e.to" custom>
        <a class="st-nav-2" :href="href" :aria-current="isActive ? 'page' : undefined" @click="navigate"><IconeSt :nom="e.icone" />{{ e.texte }}</a>
      </RouterLink>
      <span class="st-sep" />
      <div class="st-moi">
        <span class="st-av" data-m="gainage" aria-hidden="true">CD</span>
        <div><b>Corentin</b>Coach</div>
        <button class="st-btn st-btn--rond st-btn--fantome" type="button" aria-label="Se déconnecter" title="Se déconnecter" @click="deconnecter"><IconeSt nom="sortir" /></button>
      </div>
    </nav>

    <main id="st-contenu" class="st-main" tabindex="-1">
      <RouterView v-slot="{ Component, route: r }">
        <Transition name="st-page" mode="out-in">
          <div v-if="r.meta.studio" :key="r.path" class="st-page"><component :is="Component" /></div>
          <div v-else :key="r.path" class="coach c-pont"><div class="c-main"><component :is="Component" /></div></div>
        </Transition>
      </RouterView>
    </main>

    <nav class="st-tabbar" aria-label="Navigation coach (téléphone)">
      <RouterLink v-for="e in BAS" :key="e.to" v-slot="{ href, navigate }" :to="e.to" custom>
        <a :href="href" :aria-current="actif(e) ? 'page' : undefined" @click="navigate">
          <IconeSt :nom="e.icone" />{{ e.court }}
          <span v-if="compte(e, etat)" class="st-pastille">{{ compte(e, etat) }}</span>
        </a>
      </RouterLink>
      <button ref="boutonPlus" type="button" :aria-expanded="plusOuvert" aria-controls="st-feuille-plus" :aria-current="plusActif ? 'page' : undefined" @click="plusOuvert ? fermerPlus() : ouvrirPlus()">
        <IconeSt nom="plusmenu" />Plus
        <span v-if="totalPlus" class="st-pastille">{{ totalPlus }}</span>
      </button>
    </nav>

    <div class="st-voile-plus" :class="{ 'is-vu': plusOuvert }" aria-hidden="true" @click="fermerPlus()" />
    <div id="st-feuille-plus" ref="feuille" class="st-feuille-plus" :class="{ 'is-vu': plusOuvert }" role="dialog" aria-modal="true" aria-label="Plus de pages" :inert="!plusOuvert || undefined">
      <div class="st-feuille-tete"><b>Plus</b><button class="st-btn st-btn--rond st-btn--fantome" type="button" aria-label="Fermer" @click="fermerPlus()"><IconeSt nom="fermer" /></button></div>
      <RouterLink v-for="e in DANS_PLUS" :key="e.to" v-slot="{ href, navigate }" :to="e.to" custom>
        <a :href="href" :aria-current="actif(e) ? 'page' : undefined" @click="navigate">
          <IconeSt :nom="e.icone" />{{ e.texte }}
          <span v-if="compte(e, etat)" class="st-pastille">{{ compte(e, etat) }}</span>
        </a>
      </RouterLink>
      <button type="button" class="st-feuille-sortir" @click="deconnecter"><IconeSt nom="sortir" />Se déconnecter</button>
    </div>

    <!-- Calques (panneau, fiche, volant) : <Teleport defer to="#st-calques"> depuis les écrans, pour rester sous .st-app (tokens). -->
    <div id="st-calques" />
    <ToastSt />
  </div>
</template>
