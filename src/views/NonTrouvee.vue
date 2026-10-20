<script setup>
// Page 404 : même habillage que l'écran « bientôt » (formes douces, grand titre), avec retour à l'accueil.
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icone from '../components/Icone.vue'
import { installerRessort } from '../anim/transitions.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const router = useRouter()
const { racine, couche, ouvrir } = usePageAnimee('/')
const formes = ref(null)

onMounted(async () => {
  installerRessort()
  await nextTick()
  ouvrir()
})
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <section ref="couche" class="page" hidden aria-label="Page introuvable">
      <div class="voile"></div>
      <div class="avenir">
        <div class="p-top avec-menu" data-c>
          <button class="rond" type="button" aria-label="Retour à l'accueil" @click="router.replace('/')"><Icone nom="gauche" /></button>
          <span class="sur-titre">Erreur 404</span>
        </div>
        <div class="centre">
          <div ref="formes" class="formes" data-c aria-hidden="true"><i class="f1"></i><i class="f2"></i><i class="f3"></i></div>
          <h1 class="grand" data-c>Page<br>introuvable.</h1>
          <p data-c>Cette adresse n'existe pas ou n'existe plus.</p>
          <button class="gros doux" type="button" data-c style="margin-top: 20px" @click="router.replace('/')">Retour à l'accueil</button>
        </div>
      </div>
    </section>
  </main>
</template>
