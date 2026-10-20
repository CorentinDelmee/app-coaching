<script setup>
// Rubrique pas encore livrée (Questionnaires, Suivi, Profil) : un écran « bientôt » propre, avec ses formes qui flottent.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import { installerRessort, mouvementReduit } from '../anim/transitions.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const route = useRoute()
const { racine, couche, ouvrir, retour } = usePageAnimee('/')
const formes = ref(null)

const RUBRIQUES = {
  questionnaires: { titre: 'Questionnaires', texte: 'Votre check-in du jour et vos bilans de la semaine arriveront ici.' },
  suivi: { titre: 'Suivi', texte: 'Vos mesures, vos records et vos progrès arriveront ici, semaine après semaine.' },
  profil: { titre: 'Profil', texte: 'Vos informations, vos préférences et l\'apparence de l\'application arriveront ici.' }
}
const rub = computed(() => RUBRIQUES[route.params.rubrique] || { titre: 'Cette page', texte: 'Elle arrive bientôt.' })

let flottants = []
onMounted(async () => {
  installerRessort()
  await nextTick()
  const tl = ouvrir()
  if (!tl || mouvementReduit()) return
  flottants = Array.from(formes.value.querySelectorAll('i')).map((f, k) =>
    gsap.to(f, { y: (k % 2 ? -1 : 1) * 14, rotate: `+=${k % 2 ? -12 : 12}`, duration: 2.4 + k * 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }))
})
onBeforeUnmount(() => flottants.forEach((t) => t.kill()))
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <section ref="couche" class="page" hidden :aria-label="`${rub.titre}, bientôt`">
      <div class="voile"></div>
      <div class="avenir">
        <div class="p-top avec-menu" data-c>
          <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
          <span class="sur-titre">{{ rub.titre }}</span>
        </div>
        <div class="centre">
          <div ref="formes" class="formes" data-c aria-hidden="true">
            <i class="f1"></i><i class="f2"></i><i class="f3"></i>
          </div>
          <h1 class="grand" data-c>{{ rub.titre }}<br>bientôt.</h1>
          <p data-c>{{ rub.texte }}</p>
        </div>
      </div>
    </section>
  </main>
</template>
