<script setup>
// Consentement explicite (1er lancement, ou depuis Profil) : deux cases NON pré-cochées ; « Continuer » reste inactif tant qu'elles
// ne sont pas cochées. Refus = programme et séances sans données de santé. Texte : src/domain/consentement.js (docs/texte-consentement.md).
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { data } from '../data/index.js'
import { patchConsentement, TEXTE_CONSENTEMENT as T } from '../domain/consentement.js'
import { horloge } from '../lib/horloge.js'
import { coches, reinitialiserCoches } from '../lib/consentementBrouillon.js'
import { utilisateurCourant } from '../lib/session.js'
import { installerRessort } from '../anim/transitions.js'
import { sauterFermeture } from '../anim/passage.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const route = useRoute()
const router = useRouter()
const { racine, couche, ouvrir } = usePageAnimee('/profil')
const user = ref(null)
const erreur = ref('')
const occupe = ref(false)
const tout = computed(() => coches.value.every(Boolean))

onMounted(async () => {
  installerRessort()
  user.value = await utilisateurCourant()
  await nextTick()
  ouvrir()
})

async function enregistrer(sante) {
  if (occupe.value || (sante && !tout.value)) return
  occupe.value = true
  try {
    await data.profils.modifier(user.value.id, patchConsentement(user.value, sante, horloge.now()))
    reinitialiserCoches()
    sauterFermeture()
    router.replace(route.query.retour || '/')
  } catch (e) {
    erreur.value = e?.message || 'Impossible d\'enregistrer votre choix. Réessayez.'
    occupe.value = false
  }
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <section ref="couche" class="page" hidden aria-label="Consentement">
      <div class="voile"></div>
      <div class="defile defile-prog">
        <div class="p-entete" data-c style="margin-top: 24px">
          <p class="sur-titre">Avant de commencer</p>
          <h1 class="titre-page">{{ T.titre }}</h1>
        </div>
        <div class="bloc cs-texte" data-c>
          <p>{{ T.intro }}</p>
          <ul><li v-for="l in T.liste" :key="l">{{ l }}</li></ul>
          <p>{{ T.destinataires }}</p>
          <p>{{ T.droits }}</p>
          <p><RouterLink :to="{ name: 'confidentialite' }">Lire la politique de confidentialité</RouterLink></p>
        </div>

        <div class="cs-cases" data-c>
          <label v-for="(c, i) in T.cases" :key="i" class="case">
            <input v-model="coches[i]" type="checkbox" />
            <span class="boite" aria-hidden="true"></span>
            <span>{{ c }}</span>
          </label>
        </div>

        <p v-if="erreur" class="cx-erreur" role="alert">{{ erreur }}</p>
        <div class="cs-actions" data-c>
          <button class="gros" type="button" :disabled="!tout || occupe" @click="enregistrer(true)">{{ T.continuer }}</button>
          <button class="gros doux" type="button" :disabled="occupe" @click="enregistrer(false)">{{ T.refuser }}</button>
          <p class="stat-leg">{{ T.refusExplication }}</p>
        </div>
      </div>
    </section>
  </main>
</template>
