<script setup>
// Liste des programmes ; duplication d'un programme (avec ses séances) vers un autre client.
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import data from '../../data/index.js'
import { etat, nomClient, rafraichir, uuid, messageErreur } from '../store.js'
import { dupliquerProgramme } from '../logique.js'
import { jourLocal, lundiDe } from '../../domain/dates.js'
import { maintenant } from '../store.js'

const programmes = ref([])
const duplication = ref(null) // { programme, cible, debut }
const erreur = ref('')

async function charger() {
  await rafraichir()
  programmes.value = (await data.programmes.lister()).sort((a, b) => nomClient(a.clientId).localeCompare(nomClient(b.clientId), 'fr'))
}
onMounted(charger)

const ouvrirDuplication = (p) => {
  erreur.value = ''
  duplication.value = { programme: p, cible: '', debut: lundiDe(jourLocal(maintenant())) }
}

async function dupliquer() {
  erreur.value = ''
  const { programme, cible, debut } = duplication.value
  if (!cible) { erreur.value = 'Choisis le client qui reçoit le programme.'; return }
  try {
    const workouts = await data.workouts.lister()
    const copie = dupliquerProgramme(programme, workouts, cible, uuid, debut)
    copie.programme.nom = `${programme.nom} (copie)`
    for (const w of copie.workouts) await data.workouts.creer(w)
    await data.programmes.creer(copie.programme)
    duplication.value = null
    await charger()
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}
async function archiver(p) {
  await data.programmes.archiver(p.id)
  await charger()
}
const libelleMode = (p) => (p.mode === 'repete' ? `Répété · ${p.workouts.length} séance${p.workouts.length > 1 ? 's' : ''}/semaine` : `Par semaine · ${p.semaines.length} semaine${p.semaines.length > 1 ? 's' : ''}`)
</script>

<template>
  <div>
    <div class="c-entete">
      <div>
        <h1>Programmes</h1>
        <p class="c-sous">Un programme regroupe les séances d'un client sur plusieurs semaines.</p>
      </div>
      <RouterLink to="/coach/programmes/nouveau" class="c-btn c-principal">Nouveau programme</RouterLink>
    </div>

    <form v-if="duplication" class="c-carte" style="margin-bottom: 14px" @submit.prevent="dupliquer">
      <h2>Dupliquer « {{ duplication.programme.nom }} » vers un autre client</h2>
      <p class="c-doux c-petit" style="margin-top: 0">Les séances du programme sont copiées pour le client choisi ; l'original ne bouge pas.</p>
      <div class="c-ligne c-bas">
        <label style="min-width: 220px">Client
          <select v-model="duplication.cible">
            <option value="">Choisir…</option>
            <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
          </select>
        </label>
        <label class="c-moyen">Début (lundi)<input v-model="duplication.debut" type="date" /></label>
        <button class="c-btn c-principal" type="submit">Dupliquer</button>
        <button class="c-btn" type="button" @click="duplication = null">Annuler</button>
      </div>
      <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>
    </form>

    <div v-if="programmes.length" class="c-liste">
      <div v-for="p in programmes" :key="p.id" class="c-item">
        <RouterLink :to="`/coach/programmes/${p.id}`" style="flex: 1; color: inherit; text-decoration: none">
          <strong>{{ p.nom }}</strong>
          <div class="c-doux">{{ libelleMode(p) }} · début {{ p.debut }}</div>
        </RouterLink>
        <span class="c-pastille">{{ nomClient(p.clientId) }}</span>
        <button class="c-btn c-mini" @click="ouvrirDuplication(p)">Dupliquer</button>
        <button class="c-btn c-mini c-danger" @click="archiver(p)">Archiver</button>
      </div>
    </div>
    <p v-else class="c-vide">Aucun programme. Crée-en un pour un client.</p>
  </div>
</template>
