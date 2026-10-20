<script setup>
// Liste des clients + création (identifiant et code générés, à copier ou envoyer par WhatsApp).
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import data from '../../data/index.js'
import { etat, rafraichir, messageErreur } from '../store.js'
import { lienWhatsAppIdentifiants, messageIdentifiants } from '../logique.js'
import { LIEUX } from '../../domain/modele.js'

const archives = ref([])
const voirArchives = ref(false)
const formulaire = reactive({ ouvert: false, nom: '', tarif: 35, lieuDefaut: 'domicile', numero: '', modules: { habitudes: false, photosRepas: false, calories: false } })
const cree = ref(null) // { nom, identifiant, code, url }
const erreur = ref('')
const copie = ref('')

const alertesParClient = computed(() => {
  const m = {}
  for (const a of etat.alertes) m[a.clientId] = (m[a.clientId] || 0) + 1
  return m
})

async function charger() {
  await rafraichir()
  archives.value = (await data.profils.lister({}, { archives: true })).filter((p) => p.role === 'client' && p.archive)
}
onMounted(charger)

async function creer() {
  erreur.value = ''
  if (!formulaire.nom.trim()) { erreur.value = 'Le nom du client est obligatoire.'; return }
  try {
    const { profil, identifiant, code } = await data.creerClient({
      nom: formulaire.nom.trim(), tarif: Number(formulaire.tarif) || 0, lieuDefaut: formulaire.lieuDefaut, modules: { ...formulaire.modules }
    })
    cree.value = { nom: profil.nom, identifiant, code, url: window.location.origin, numero: formulaire.numero }
    Object.assign(formulaire, { ouvert: false, nom: '', numero: '' })
    await charger()
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}

async function copier(texte, quoi) {
  try {
    await navigator.clipboard.writeText(texte)
    copie.value = quoi
    setTimeout(() => { copie.value = '' }, 2000)
  } catch {
    copie.value = 'Copie impossible : sélectionne le texte à la main'
  }
}

async function restaurer(p) {
  await data.profils.modifier(p.id, { archive: false })
  await charger()
}
</script>

<template>
  <div>
    <div class="c-entete">
      <div>
        <h1>Clients</h1>
        <p class="c-sous">{{ etat.clients.length }} client{{ etat.clients.length > 1 ? 's' : '' }} actif{{ etat.clients.length > 1 ? 's' : '' }}</p>
      </div>
      <button class="c-btn c-principal" @click="formulaire.ouvert = !formulaire.ouvert">{{ formulaire.ouvert ? 'Fermer' : 'Nouveau client' }}</button>
    </div>

    <div v-if="cree" class="c-carte" role="status" style="margin-bottom: 16px; border-color: var(--accent)">
      <h2>Compte créé pour {{ cree.nom }}</h2>
      <p class="c-doux c-petit" style="margin-top: 0">Ce code ne sera plus affiché ensuite : transmets-le maintenant.</p>
      <div class="c-ligne" style="margin-bottom: 12px">
        <div><span class="c-doux c-petit">Identifiant</span><div class="c-secret">{{ cree.identifiant }}</div></div>
        <div><span class="c-doux c-petit">Code</span><div class="c-secret">{{ cree.code }}</div></div>
      </div>
      <div class="c-ligne">
        <button class="c-btn" @click="copier(messageIdentifiants(cree), 'Message copié')">Copier le message</button>
        <button class="c-btn" @click="copier(`${cree.identifiant} / ${cree.code}`, 'Identifiants copiés')">Copier identifiant + code</button>
        <a class="c-btn c-principal" :href="lienWhatsAppIdentifiants(cree, cree.numero)" target="_blank" rel="noopener">Envoyer par WhatsApp</a>
        <button class="c-btn" @click="cree = null">Terminé</button>
        <span v-if="copie" class="c-ok c-petit" role="status">{{ copie }}</span>
      </div>
    </div>

    <form v-if="formulaire.ouvert" class="c-carte" style="margin-bottom: 16px" novalidate @submit.prevent="creer">
      <h2>Nouveau client</h2>
      <div class="c-ligne c-bas" style="margin-bottom: 12px">
        <label style="flex: 2; min-width: 200px">Nom complet<input v-model="formulaire.nom" placeholder="Prénom Nom" autocomplete="off" /></label>
        <label class="c-court">Tarif (€)<input v-model.number="formulaire.tarif" type="number" min="0" step="1" /></label>
        <label class="c-moyen">Lieu par défaut
          <select v-model="formulaire.lieuDefaut"><option v-for="l in LIEUX" :key="l" :value="l">{{ l === 'domicile' ? 'À domicile' : 'En salle' }}</option></select>
        </label>
        <label class="c-moyen">WhatsApp (facultatif)<input v-model="formulaire.numero" type="tel" placeholder="+33 6 …" /></label>
      </div>
      <div class="c-ligne" style="margin-bottom: 12px">
        <span class="c-doux c-petit">Nutrition :</span>
        <label class="c-case"><input v-model="formulaire.modules.habitudes" type="checkbox" />Habitudes</label>
        <label class="c-case"><input v-model="formulaire.modules.photosRepas" type="checkbox" />Photos de repas</label>
        <label class="c-case"><input v-model="formulaire.modules.calories" type="checkbox" />Calories</label>
      </div>
      <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>
      <button class="c-btn c-principal" type="submit">Créer le compte</button>
    </form>

    <div v-if="etat.clients.length" class="c-liste">
      <RouterLink v-for="c in etat.clients" :key="c.id" :to="`/coach/clients/${c.id}`" class="c-item">
        <div style="flex: 1">
          <strong>{{ c.nom }}</strong>
          <div class="c-doux">{{ c.identifiant }} · {{ c.tarif }} € · {{ c.lieuDefaut === 'domicile' ? 'à domicile' : 'en salle' }}</div>
        </div>
        <span v-if="alertesParClient[c.id]" class="c-pastille c-alerte">{{ alertesParClient[c.id] }} alerte{{ alertesParClient[c.id] > 1 ? 's' : '' }}</span>
      </RouterLink>
    </div>
    <p v-else class="c-vide">Aucun client pour l'instant. Crée le premier avec « Nouveau client ».</p>

    <div v-if="archives.length" style="margin-top: 20px">
      <button class="c-btn c-mini" @click="voirArchives = !voirArchives">{{ voirArchives ? 'Masquer' : 'Voir' }} les {{ archives.length }} archivés</button>
      <div v-if="voirArchives" class="c-liste" style="margin-top: 10px">
        <div v-for="p in archives" :key="p.id" class="c-item">
          <div style="flex: 1"><strong>{{ p.nom }}</strong> <span class="c-doux">{{ p.identifiant }}</span></div>
          <button class="c-btn c-mini" @click="restaurer(p)">Restaurer</button>
        </div>
      </div>
    </div>
  </div>
</template>
