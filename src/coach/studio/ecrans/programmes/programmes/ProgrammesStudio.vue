<script setup>
// Studio · liste des programmes : cartes par client, filtre client + recherche, dupliquer vers un autre client, archiver (Annuler).
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import data from '../../../../../data/index.js'
import { etat, nomClient, rafraichir, uuid, messageErreur, maintenant } from '../../../../store.js'
import { dateFr, dupliquerProgramme } from '../../../../logique.js'
import { jourLocal, lundiDe, jourSemaine } from '../../../../../domain/dates.js'
import IconeSt from '../../../IconeSt.vue'
import Filtres from '../../../Filtres.vue'
import { toast } from '../../../toast.js'
import { sansAccents } from '../commun/exercices.js'
import { idsUtilises, initiales, libelleMode, teinteClient } from './planning.js'

const programmes = ref([])
const charge = ref(false)
const erreurChargement = ref('')
const filtreClient = ref('')
const q = ref('')
const duplication = ref(null) // { id, cible, debut, erreur, enCours }

async function charger() {
  try {
    await rafraichir()
    programmes.value = (await data.programmes.lister()).sort((a, b) => nomClient(a.clientId).localeCompare(nomClient(b.clientId), 'fr') || a.nom.localeCompare(b.nom, 'fr'))
    erreurChargement.value = ''
  } catch (e) {
    erreurChargement.value = messageErreur(e)
  }
  charge.value = true
}
onMounted(charger)

const optionsClients = computed(() => {
  const n = new Map()
  for (const p of programmes.value) n.set(p.clientId, (n.get(p.clientId) || 0) + 1)
  return [...n.entries()].map(([id, k]) => ({ valeur: id, texte: nomClient(id), n: k })).sort((a, b) => a.texte.localeCompare(b.texte, 'fr'))
})

const visibles = computed(() => {
  const mots = sansAccents(q.value).split(/\s+/).filter(Boolean)
  return programmes.value.filter((p) => {
    if (filtreClient.value && p.clientId !== filtreClient.value) return false
    const t = sansAccents(`${p.nom} ${nomClient(p.clientId)}`)
    return mots.every((m) => t.includes(m))
  })
})

const nbSeances = (p) => idsUtilises(p).length

function ouvrirDuplication(p) {
  duplication.value = duplication.value?.id === p.id ? null : { id: p.id, cible: '', debut: lundiDe(jourLocal(maintenant())), erreur: '', enCours: false }
}

async function dupliquer(p) {
  const d = duplication.value
  d.erreur = ''
  if (!d.cible) { d.erreur = 'Choisis le client qui reçoit le programme.'; return }
  if (!d.debut || jourSemaine(d.debut) !== 0) { d.erreur = 'Le début doit être un lundi.'; return }
  d.enCours = true
  try {
    const workouts = await data.workouts.lister()
    const copie = dupliquerProgramme(p, workouts, d.cible, uuid, d.debut, { ancien: nomClient(p.clientId), nouveau: nomClient(d.cible) })
    for (const w of copie.workouts) await data.workouts.creer(w)
    await data.programmes.creer(copie.programme)
    duplication.value = null
    await charger()
    toast(`« ${copie.programme.nom} » créé pour ${nomClient(d.cible)} (${copie.workouts.length} séance${copie.workouts.length > 1 ? 's' : ''} copiée${copie.workouts.length > 1 ? 's' : ''})`)
  } catch (e) {
    d.erreur = messageErreur(e)
  } finally {
    d.enCours = false
  }
}

async function archiver(p) {
  try {
    await data.programmes.archiver(p.id)
    await charger()
    toast(`« ${p.nom} » archivé`, {
      action: 'Annuler', duree: 6000,
      surAction: async () => {
        try { await data.programmes.modifier(p.id, { archive: false }); await charger() } catch (e) { toast(messageErreur(e)) }
      }
    })
  } catch (e) {
    toast(messageErreur(e))
  }
}
</script>

<template>
  <div class="st-prog-p">
    <header class="st-entete">
      <div>
        <h1>Programmes</h1>
        <p>Un programme range les séances d'un client sur ses semaines.</p>
      </div>
      <div class="st-actions">
        <RouterLink to="/coach/programmes/nouveau" class="st-btn st-btn--jaune"><IconeSt nom="plus" />Nouveau programme</RouterLink>
      </div>
    </header>

    <div v-if="programmes.length" class="st-prog-p-outils">
      <label class="st-prog-p-cherche">
        <span class="st-sr">Rechercher un programme</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        <input v-model="q" type="search" placeholder="Rechercher un programme ou un client" />
      </label>
      <Filtres v-if="optionsClients.length > 1" v-model="filtreClient" :options="optionsClients" :multiple="false" etiquette="Filtrer par client" />
    </div>

    <p v-if="erreurChargement" class="st-prog-p-erreur" role="alert">{{ erreurChargement }}</p>

    <ul v-if="visibles.length" class="st-prog-p-liste">
      <li v-for="(p, i) in visibles" :key="p.id" class="st-prog-p-carte" :style="{ '--i': Math.min(i, 12) }">
        <RouterLink :to="`/coach/programmes/${p.id}`" class="st-prog-p-lien">
          <span class="st-prog-p-avatar" :data-m="teinteClient(p.clientId)" aria-hidden="true">{{ initiales(nomClient(p.clientId)) }}</span>
          <span class="st-prog-p-txt">
            <strong>{{ p.nom || 'Programme sans nom' }}</strong>
            <small>{{ libelleMode(p) }} · début {{ dateFr(p.debut) }}</small>
            <small>{{ nbSeances(p) }} séance{{ nbSeances(p) > 1 ? 's' : '' }} · {{ nomClient(p.clientId) }}</small>
          </span>
        </RouterLink>
        <div class="st-prog-p-actions">
          <button type="button" class="st-btn st-btn--fantome" :aria-expanded="duplication?.id === p.id" @click="ouvrirDuplication(p)">Dupliquer</button>
          <button type="button" class="st-btn st-btn--fantome st-prog-p-archiver" @click="archiver(p)">Archiver</button>
        </div>
        <form v-if="duplication?.id === p.id" class="st-prog-p-dup" @submit.prevent="dupliquer(p)">
          <p>Copier « {{ p.nom }} » et ses séances pour un autre client. L'original ne bouge pas.</p>
          <div class="st-prog-p-dup-champs">
            <label>Client
              <select v-model="duplication.cible" required>
                <option value="">Choisir…</option>
                <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
              </select>
            </label>
            <label>Début (lundi)<input v-model="duplication.debut" type="date" required /></label>
            <button class="st-btn st-btn--encre" type="submit" :disabled="duplication.enCours">{{ duplication.enCours ? 'Copie…' : 'Dupliquer' }}</button>
            <button class="st-btn st-btn--fantome" type="button" @click="duplication = null">Annuler</button>
          </div>
          <p v-if="duplication.erreur" class="st-prog-p-erreur" role="alert">{{ duplication.erreur }}</p>
        </form>
      </li>
    </ul>

    <div v-else-if="charge && programmes.length" class="st-prog-p-vide">
      <p>Aucun programme ne correspond.</p>
      <button type="button" class="st-btn" @click="q = ''; filtreClient = ''">Tout afficher</button>
    </div>
    <div v-else-if="charge" class="st-prog-p-vide st-prog-p-vide--grand">
      <span class="st-prog-p-vide-motif" aria-hidden="true"><i data-m="jambes" /><i data-m="dos" /><i data-m="gainage" /><i data-m="cardio" /><i data-m="mobilite" /><i data-m="epaules" /><i data-m="bras" /></span>
      <h2>Aucun programme pour l'instant</h2>
      <p>Choisis un client, puis glisse ses séances dans les jours de la semaine.</p>
      <RouterLink to="/coach/programmes/nouveau" class="st-btn st-btn--jaune"><IconeSt nom="plus" />Créer un programme</RouterLink>
    </div>
  </div>
</template>

<style>
.st-prog-p { animation: st-entree var(--st-d-base) var(--st-sortie); }
.st-prog-p-outils { display: grid; gap: 10px; margin-bottom: 14px; }
.st-prog-p-cherche { display: flex; align-items: center; gap: 10px; max-width: 520px; min-height: 48px; padding: 0 14px; border-radius: var(--st-r-m); background: var(--st-surface); box-shadow: var(--st-ombre-1); color: var(--st-doux); }
.st-prog-p-cherche svg { width: 20px; height: 20px; flex: none; }
.st-prog-p-cherche input { flex: 1; min-width: 0; min-height: 46px; border: 0; background: transparent; outline: none; font-size: 15px; color: var(--st-encre); }
.st-prog-p-cherche:focus-within { box-shadow: 0 0 0 2.5px var(--st-encre); }
.st-prog-p-liste { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 14px; }
.st-prog-p-carte { position: relative; display: flex; flex-direction: column; background: var(--st-surface); border-radius: var(--st-r-l); box-shadow: var(--st-ombre-1); transition: box-shadow var(--st-d-court), transform var(--st-d-court) var(--st-sortie); animation: st-cascade var(--st-d-base) var(--st-sortie) both; animation-delay: calc(var(--i) * 40ms); }
.st-prog-p-carte:hover { box-shadow: var(--st-ombre-2); transform: translateY(-2px); }
.st-prog-p-lien { display: flex; gap: 14px; align-items: center; padding: 18px 18px 10px; color: inherit; text-decoration: none; border-radius: var(--st-r-l) var(--st-r-l) 0 0; }
.st-prog-p-avatar { flex: none; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--mc); color: var(--mi); font: 500 18px var(--st-titre); letter-spacing: -.02em; }
.st-prog-p-txt { min-width: 0; display: grid; gap: 3px; }
.st-prog-p-txt strong { font: 500 19px/1.2 var(--st-titre); letter-spacing: -.02em; color: var(--st-encre); overflow-wrap: anywhere; }
.st-prog-p-txt small { font-size: 13px; color: var(--st-doux); }
.st-prog-p-actions { display: flex; gap: 4px; padding: 0 10px 10px; margin-top: auto; justify-content: flex-end; }
.st-prog-p-actions .st-btn { min-height: 44px; padding: 0 14px; font-size: 14px; }
.st-prog-p-archiver { color: var(--st-alerte); }
.st-prog-p-dup { margin: 0 12px 12px; padding: 14px; border-radius: var(--st-r-m); background: var(--st-fond); animation: st-entree var(--st-d-court) var(--st-sortie); }
.st-prog-p-dup > p { margin: 0 0 10px; font-size: 13.5px; color: var(--st-doux); }
.st-prog-p-dup-champs { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
.st-prog-p-dup label { display: grid; gap: 4px; font-size: 13px; font-weight: 600; color: var(--st-encre); flex: 1 1 150px; }
.st-prog-p-dup select, .st-prog-p-dup input { min-height: 44px; padding: 0 10px; border-radius: var(--st-r-s); border: 1px solid var(--st-filet-fort); background: var(--st-surface); }
.st-prog-p-erreur { margin: 10px 0 0; padding: 10px 12px; border-radius: var(--st-r-s); background: var(--st-alerte-fond); color: var(--st-alerte); font-weight: 600; font-size: 14px; }
.st-prog-p-vide { display: grid; justify-items: center; gap: 10px; padding: 40px 20px; text-align: center; color: var(--st-doux); border: 1.5px dashed var(--st-filet-fort); border-radius: var(--st-r-xl); }
.st-prog-p-vide h2 { margin: 0; font: 500 26px var(--st-titre); letter-spacing: -.03em; color: var(--st-encre); }
.st-prog-p-vide p { margin: 0 0 6px; max-width: 40ch; }
.st-prog-p-vide--grand { padding: 56px 20px; background: var(--st-surface); border-style: solid; border-color: transparent; box-shadow: var(--st-ombre-1); }
.st-prog-p-vide-motif { display: flex; gap: 6px; margin-bottom: 6px; }
.st-prog-p-vide-motif i { width: 22px; height: 56px; border-radius: 11px; background: var(--mc); animation: st-cascade var(--st-d-base) var(--st-ressort) both; }
.st-prog-p-vide-motif i:nth-child(2n) { height: 40px; align-self: flex-end; }
.st-prog-p-vide-motif i:nth-child(1) { animation-delay: 0ms; } .st-prog-p-vide-motif i:nth-child(2) { animation-delay: 40ms; } .st-prog-p-vide-motif i:nth-child(3) { animation-delay: 80ms; } .st-prog-p-vide-motif i:nth-child(4) { animation-delay: 120ms; } .st-prog-p-vide-motif i:nth-child(5) { animation-delay: 160ms; } .st-prog-p-vide-motif i:nth-child(6) { animation-delay: 200ms; } .st-prog-p-vide-motif i:nth-child(7) { animation-delay: 240ms; }
@media (max-width: 900px) {
  .st-prog-p-entete-actions { width: 100%; }
  .st-prog-p .st-entete .st-actions { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .st-prog-p-carte:hover { transform: none; } }
</style>
