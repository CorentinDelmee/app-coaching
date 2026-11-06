<script setup>
// Import / export JSON de la bibliothèque (exercices, séances, programmes) avec rapport.
import { ref } from 'vue'
import data from '../../../../data/index.js'
import { jourLocal } from '../../../../domain/dates.js'
import { maintenant, rafraichir, messageErreur } from '../../../store.js'
import IconeSt from '../../IconeSt.vue'
import './ecran.css'

const rapport = ref('')
const erreur = ref('')
const survol = ref(false)
const occupe = ref(false)

async function exporter() {
  erreur.value = ''
  rapport.value = ''
  try {
    const doc = await data.exporterDonnees()
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `coaching-${jourLocal(maintenant())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    rapport.value = `Export : ${doc.exercices.length} exercices, ${doc.workouts.length} séances, ${doc.programmes.length} programmes.`
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}

async function lire(fichier) {
  erreur.value = ''
  rapport.value = ''
  if (!fichier) return
  occupe.value = true
  try {
    const { message } = await data.importerDonnees(JSON.parse(await fichier.text()))
    rapport.value = `Import terminé. ${message}`
    await rafraichir()
  } catch (e) {
    erreur.value = e instanceof SyntaxError ? 'Ce fichier n\'est pas un JSON valide.' : messageErreur(e)
  } finally {
    occupe.value = false
  }
}

function surChoix(ev) {
  const f = ev.target.files[0]
  ev.target.value = ''
  lire(f)
}
function surDepot(ev) {
  survol.value = false
  lire(ev.dataTransfer?.files?.[0])
}
</script>

<template>
  <div class="st-app st-ag">
    <header class="st-entete">
      <div>
        <h1>Import / export</h1>
        <p>Sauvegarde ou partage la bibliothèque : exercices, séances et programmes (format JSON).</p>
      </div>
    </header>

    <p v-if="rapport" class="st-ag-msg st-ag-msg--ok" role="status">{{ rapport }}</p>
    <p v-if="erreur" class="st-ag-msg st-ag-msg--err" role="alert">{{ erreur }}</p>

    <div class="st-ag-donnees">
      <section class="st-ag-carte-grande" aria-labelledby="dn-exp">
        <span class="st-ag-ico"><IconeSt nom="donnees" /></span>
        <h2 id="dn-exp">Exporter</h2>
        <p>Télécharge un fichier avec tout le contenu actuel.</p>
        <div><button class="st-btn st-btn--encre" type="button" @click="exporter"><IconeSt nom="donnees" />Télécharger le JSON</button></div>
      </section>
      <section class="st-ag-carte-grande" aria-labelledby="dn-imp">
        <span class="st-ag-ico"><IconeSt nom="plus" /></span>
        <h2 id="dn-imp">Importer</h2>
        <p>Le fichier est vérifié en entier avant toute écriture ; un élément invalide est rejeté et signalé.</p>
        <label class="st-ag-depot" :class="{ 'is-survol': survol }" @dragover.prevent="survol = true" @dragleave="survol = false" @drop.prevent="surDepot">
          {{ occupe ? 'Import en cours…' : 'Choisir un fichier JSON' }}
          <small>ou le déposer ici</small>
          <input type="file" accept="application/json,.json" aria-label="Fichier JSON à importer" :disabled="occupe" @change="surChoix" />
        </label>
      </section>
    </div>
  </div>
</template>
