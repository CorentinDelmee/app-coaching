<script setup>
// Accueil public : présentation, « Installer l'application » (invite du navigateur, ou instructions iOS / autres), « Se connecter ».
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import FeuilleBas from '../components/seance/FeuilleBas.vue'
import { installee, installer, surIOS } from '../lib/installation.js'
import { installerRessort, mouvementReduit } from '../anim/transitions.js'
import { motsMontent } from '../anim/titres.js'
import { memoriserSource } from '../anim/passage.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const router = useRouter()
const { racine, couche, ouvrir, partir } = usePageAnimee('/bienvenue')
const titre = ref(null)
const aide = ref(false)
let flottants = []

onMounted(async () => {
  installerRessort()
  await nextTick()
  const tl = ouvrir()
  if (mouvementReduit()) return
  motsMontent(titre.value, tl ? 0.25 : 0.05)
  flottants = Array.from(racine.value.querySelectorAll('.bv-formes i')).map((f, k) =>
    gsap.to(f, { y: (k % 2 ? -1 : 1) * 12, rotate: `+=${k % 2 ? -10 : 10}`, duration: 2.6 + k * 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }))
})
onBeforeUnmount(() => flottants.forEach((t) => t.kill()))

function seConnecter(e) {
  memoriserSource(e.currentTarget)
  partir()
  router.push('/connexion')
}
async function surInstaller() {
  if ((await installer()) === 'indisponible') aide.value = true
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <section ref="couche" class="page" hidden aria-label="Bienvenue">
      <div class="voile"></div>
      <div class="bv">
        <header class="bv-tete" data-c>
          <div class="bv-formes" aria-hidden="true"><i class="f1"></i><i class="f2"></i><i class="f3"></i></div>
          <p class="sur-titre">Coaching sportif</p>
          <h1 ref="titre" v-once class="bv-titre">Corentin<br>Delmée<br>Coaching</h1>
        </header>

        <ul class="bv-points" data-c>
          <li><b>Votre séance</b> guidée pas à pas, même sans réseau</li>
          <li><b>Votre programme</b> et votre coach, dans votre poche</li>
          <li><b>Vos progrès</b> semaine après semaine</li>
        </ul>

        <div class="bv-actions" data-c>
          <button class="gros" type="button" @click="seConnecter">Se connecter</button>
          <button v-if="!installee" class="gros contour" type="button" @click="surInstaller">Installer l'application</button>
        </div>
        <p class="bv-pied" data-c><RouterLink to="/confidentialite">Confidentialité</RouterLink></p>
      </div>

      <FeuilleBas :ouverte="aide" titre="Installer l'application" @fermer="aide = false">
        <ol v-if="surIOS" class="etapes">
          <li>Dans Safari, touchez le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li>
          <li>Choisissez <b>« Sur l'écran d'accueil »</b>.</li>
          <li>Touchez <b>Ajouter</b> : l'icône apparaît avec vos autres applications.</li>
        </ol>
        <ol v-else class="etapes">
          <li>Ouvrez le menu de votre navigateur (les trois points).</li>
          <li>Choisissez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</li>
        </ol>
        <button class="gros doux" type="button" @click="aide = false">Compris</button>
      </FeuilleBas>
    </section>
  </main>
</template>
