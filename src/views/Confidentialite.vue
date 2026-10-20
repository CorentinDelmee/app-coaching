<script setup>
// Page Confidentialité (publique) : le texte vient de docs/page-confidentialite.md (une seule source, à faire relire et compléter).
import { nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icone from '../components/Icone.vue'
import texte from '../../docs/page-confidentialite.md?raw'
import { markdownVersHtml } from '../domain/markdown.js'
import { installerRessort } from '../anim/transitions.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const route = useRoute()
const router = useRouter()
const { racine, couche, ouvrir } = usePageAnimee('/bienvenue')
const html = markdownVersHtml(texte)

onMounted(async () => { installerRessort(); await nextTick(); ouvrir() })
// « retour » : l'historique s'il y en a un (Bienvenue, Profil, Consentement), sinon l'accueil public
const retour = () => (window.history.state?.back ? router.back() : router.replace(route.query.retour || '/bienvenue'))
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <section ref="couche" class="page" hidden aria-label="Confidentialité">
      <div class="voile"></div>
      <div class="defile defile-prog">
        <div class="p-top" data-c>
          <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
          <span class="sur-titre">Confidentialité</span>
        </div>
        <article class="markdown" data-c v-html="html"></article>
      </div>
    </section>
  </main>
</template>
