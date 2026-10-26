<script setup>
// Bibliothèque d'exercices (vidéos) : le coach VALIDE ou REMPLACE les vidéos proposées par Claude / la recherche automatique.
// Parle au serveur (VITE_API_URL, clé VITE_API_KEY : démo locale uniquement ; en production passer par une session coach, voir serveur/README.md).
import { computed, onMounted, ref } from 'vue'
import { idYoutube } from '../../domain/video.js'

const URL_API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const CLE_API = import.meta.env.VITE_API_KEY || ''
const entrees = ref([])
const erreur = ref('')
const recherche = ref('')
const filtre = ref('propose')
const nouveauLien = ref({}) // id d'entrée -> lien saisi pour remplacer
const chargement = ref(false)

const STATUTS = { propose: 'À valider', valide: 'Validée', remplace: 'Remplacée' }
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const affichees = computed(() =>
  entrees.value
    .filter((e) => (filtre.value === 'tous' || e.statut === filtre.value) && norm(e.nom).includes(norm(recherche.value)))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
)

async function appel(chemin, options = {}) {
  const r = await fetch(`${URL_API}${chemin}`, { ...options, headers: { Authorization: `Bearer ${CLE_API}`, 'Content-Type': 'application/json' } })
  const corps = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(corps.erreur || `Erreur ${r.status}`)
  return corps
}

async function charger() {
  erreur.value = ''
  if (!URL_API || !CLE_API) { erreur.value = 'Serveur non configuré : définis VITE_API_URL et VITE_API_KEY (voir serveur/README.md).'; return }
  chargement.value = true
  try { entrees.value = await appel('/api/bibliotheque') } catch (e) { erreur.value = `Serveur injoignable ou clé refusée (${e.message}).` } finally { chargement.value = false }
}
onMounted(charger)

async function valider(e) {
  erreur.value = ''
  try { await appel(`/api/bibliotheque/${encodeURIComponent(e.id)}/valider`, { method: 'POST', body: '{}' }); await charger() } catch (err) { erreur.value = err.message }
}
async function remplacer(e) {
  erreur.value = ''
  const url = (nouveauLien.value[e.id] || '').trim()
  if (!idYoutube(url)) { erreur.value = 'Colle un lien YouTube valide (youtube.com/watch?v=… ou youtu.be/…).'; return }
  try { await appel(`/api/bibliotheque/${encodeURIComponent(e.id)}/remplacer`, { method: 'POST', body: JSON.stringify({ url }) }); nouveauLien.value[e.id] = ''; await charger() } catch (err) { erreur.value = err.message }
}
const duree = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'durée inconnue')
</script>

<template>
  <div>
    <div class="c-entete">
      <div>
        <h1>Bibliothèque d'exercices</h1>
        <p class="c-sous">Vidéos de démonstration proposées pour chaque exercice : valide-les ou remplace-les.</p>
      </div>
    </div>
    <p v-if="erreur" class="c-erreur" role="alert">{{ erreur }}</p>

    <div class="c-ligne" style="margin-bottom: 12px">
      <input v-model="recherche" type="search" placeholder="Rechercher un exercice…" aria-label="Rechercher un exercice" style="max-width: 340px" />
    </div>
    <div class="c-filtres">
      <button v-for="(libelle, cle) in { ...STATUTS, tous: 'Toutes' }" :key="cle" class="c-filtre" :aria-pressed="filtre === cle" @click="filtre = cle">{{ libelle }}</button>
    </div>

    <p v-if="chargement" class="c-doux">Chargement…</p>
    <div v-else-if="affichees.length" class="c-liste">
      <article v-for="e in affichees" :key="e.id" class="c-item" style="flex-wrap: wrap; align-items: flex-start; gap: 8px" :data-statut="e.statut">
        <div style="flex: 1; min-width: 220px">
          <strong>{{ e.nom }}</strong>
          <span class="c-pastille" :class="{ 'c-bien': e.statut === 'valide' }" style="margin-left: 8px">{{ STATUTS[e.statut] }}</span>
          <div v-if="e.video" class="c-doux">
            <a :href="e.video.url" target="_blank" rel="noopener noreferrer">{{ e.video.titre || e.video.url }}</a>
            · {{ e.video.chaine || 'chaîne inconnue' }} · {{ duree(e.video.duree) }}
          </div>
          <div v-else class="c-doux">Pas encore de vidéo</div>
          <div v-if="e.justification" class="c-doux">{{ e.justification }}</div>
        </div>
        <div class="c-ligne" style="flex-wrap: wrap">
          <button v-if="e.video && e.statut !== 'valide'" class="c-btn c-principal" type="button" @click="valider(e)">Valider</button>
          <input v-model="nouveauLien[e.id]" type="url" placeholder="Autre lien YouTube…" :aria-label="`Remplacer la vidéo de ${e.nom}`" style="width: 230px" />
          <button class="c-btn" type="button" @click="remplacer(e)">Remplacer</button>
        </div>
      </article>
    </div>
    <p v-else-if="!erreur" class="c-vide">Aucune vidéo dans cette catégorie.</p>
  </div>
</template>
