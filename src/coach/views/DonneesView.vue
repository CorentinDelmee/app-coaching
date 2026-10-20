<script setup>
// Import / export JSON de la bibliothèque (exercices, séances, programmes) avec rapport.
import { ref } from 'vue'
import data from '../../data/index.js'
import { jourLocal } from '../../domain/dates.js'
import { maintenant, rafraichir, messageErreur } from '../store.js'

const rapport = ref('')
const erreur = ref('')

async function exporter() {
  erreur.value = ''
  const doc = await data.exporterDonnees()
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `coaching-${jourLocal(maintenant())}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  rapport.value = `Export : ${doc.exercices.length} exercices, ${doc.workouts.length} séances, ${doc.programmes.length} programmes.`
}

async function importer(ev) {
  erreur.value = ''
  rapport.value = ''
  const fichier = ev.target.files[0]
  ev.target.value = ''
  if (!fichier) return
  try {
    const { message } = await data.importerDonnees(JSON.parse(await fichier.text()))
    rapport.value = `Import terminé. ${message}`
    await rafraichir()
  } catch (e) {
    erreur.value = e instanceof SyntaxError ? 'Ce fichier n\'est pas un JSON valide.' : messageErreur(e)
  }
}
</script>

<template>
  <div>
    <div class="c-entete">
      <div>
        <h1>Import / export</h1>
        <p class="c-sous">Sauvegarde ou partage la bibliothèque : exercices, séances et programmes (format JSON).</p>
      </div>
    </div>
    <div class="c-deux">
      <div class="c-carte">
        <h2>Exporter</h2>
        <p class="c-doux c-petit" style="margin-top: 0">Télécharge un fichier avec tout le contenu actuel.</p>
        <button class="c-btn c-principal" @click="exporter">Télécharger le JSON</button>
      </div>
      <div class="c-carte">
        <h2>Importer</h2>
        <p class="c-doux c-petit" style="margin-top: 0">Le fichier est vérifié en entier avant toute écriture ; un élément invalide est rejeté et signalé.</p>
        <label>Fichier JSON<input type="file" accept="application/json,.json" @change="importer" /></label>
      </div>
    </div>
    <p v-if="rapport" class="c-info" role="status">{{ rapport }}</p>
    <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>
  </div>
</template>
