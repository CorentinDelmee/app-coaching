<script setup>
// Studio · Clients : liste (recherche sans accents, filtres actifs / à surveiller / archivés, statut, dernière séance,
// assiduité en anneau), invitation d'un client (identifiant + code), restauration d'un archivé. La fiche s'ouvre à côté
// (ordinateur) ou en feuille plein écran (téléphone) : route enfant /coach/clients/:id.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import data from '../../../../data/index.js'
import { jourLocal } from '../../../../domain/dates.js'
import { LIEUX } from '../../../../domain/modele.js'
import { etat, maintenant, messageErreur, rafraichir } from '../../../store.js'
import { adresseApp } from '../../../logique.js'
import { toast } from '../../toast.js'
import IconeSt from '../../IconeSt.vue'
import Puce from '../../Puce.vue'
import Filtres from '../../Filtres.vue'
import IdentifiantsCrees from './IdentifiantsCrees.vue'
import { rendreFocus } from './retourFocus.js'
import { LIBELLES_STATUT, VARIANTE_STATUT, compterFiltres, filtrerClients, initiales, libelleDepuis, resumeClient, teinteClient } from './logique.js'
import './clients.css'

const route = useRoute()
const aujourdhui = jourLocal(maintenant())
const archives = ref([])
const realisations = ref([])
const programmes = ref([])
const charge = ref(false)
const filtre = ref('actifs')
const recherche = ref('')
const champRecherche = ref(null)
const liste = ref(null)
const reduit = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)')

const ouvert = computed(() => route.params.id || null)

async function charger() {
  const [tous, reals, progs] = await Promise.all([
    data.profils.lister({}, { archives: true }), data.realisations.lister(), data.programmes.lister(), rafraichir()
  ])
  archives.value = tous.filter((p) => p.role === 'client' && p.archive)
  realisations.value = reals
  programmes.value = progs
  charge.value = true
  await nextTick()
  rendreFocus()
}
onMounted(charger)

const alertesParClient = computed(() => {
  const m = {}
  for (const a of etat.alertes) m[a.clientId] = (m[a.clientId] || 0) + 1
  return m
})
// etat.clients (actifs, toujours frais après rafraichir) l'emporte sur une liste d'archivés pas encore rechargée.
const tous = computed(() => [...new Map([...archives.value, ...etat.clients].map((p) => [p.id, p])).values()].map((profil) => ({
  profil,
  teinte: teinteClient(profil.id),
  resume: resumeClient({ profil, realisations: realisations.value, programmes: programmes.value, nbAlertes: alertesParClient.value[profil.id] || 0, aujourdhui })
})))
const compteurs = computed(() => compterFiltres(tous.value))
const affiches = computed(() => filtrerClients(tous.value, { filtre: filtre.value, recherche: recherche.value }))
const optionsFiltre = computed(() => [
  { valeur: 'actifs', texte: 'Actifs', n: compteurs.value.actifs },
  { valeur: 'attention', texte: 'À surveiller', n: compteurs.value.attention },
  { valeur: 'archives', texte: 'Archivés', n: compteurs.value.archives }
])
// Filtre « à bascule » : recliquer sur l'actif revient à « Actifs » (jamais aucun filtre).
const filtreModele = computed({ get: () => filtre.value, set: (v) => { filtre.value = v || 'actifs' } })

// Anneau d'assiduité (r = 26, périmètre ≈ 163,4)
const PERIMETRE = 2 * Math.PI * 26
const trait = (p) => `${((PERIMETRE * (p || 0)) / 100).toFixed(1)} ${PERIMETRE.toFixed(1)}`

// Recomposition de la liste au filtrage : 380 ms, décalage 18 ms sur les 16 premières cartes (transform/opacity).
watch([filtre, recherche], async () => {
  if (reduit?.matches) return
  await nextTick()
  const cartes = liste.value?.querySelectorAll('.st-clients-carte') || []
  ;[...cartes].slice(0, 16).forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }],
    { duration: 380, delay: i * 18, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
  ))
})

// Raccourci « / » : recherche.
function surTouche(ev) {
  if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return
  if (ev.target.closest?.('input, textarea, select, [contenteditable]')) return
  ev.preventDefault()
  champRecherche.value?.focus()
}
onMounted(() => document.addEventListener('keydown', surTouche))
onBeforeUnmount(() => document.removeEventListener('keydown', surTouche))

// --- Invitation (création du compte) ------------------------------------------------------------------------
const formulaire = reactive({ ouvert: false, nom: '', tarif: 35, lieuDefaut: 'domicile', numero: '', modules: { habitudes: false, photosRepas: false, calories: false } })
const cree = ref(null)
const erreur = ref('')
const champNom = ref(null)
async function basculerFormulaire() {
  formulaire.ouvert = !formulaire.ouvert
  erreur.value = ''
  if (formulaire.ouvert) { await nextTick(); champNom.value?.focus() }
}
async function creer() {
  erreur.value = ''
  if (!formulaire.nom.trim()) { erreur.value = 'Le nom du client est obligatoire.'; return }
  try {
    const { profil, identifiant, code } = await data.creerClient({
      nom: formulaire.nom.trim(), tarif: Number(formulaire.tarif) || 0, lieuDefaut: formulaire.lieuDefaut, modules: { ...formulaire.modules }
    })
    cree.value = { nom: profil.nom, identifiant, code, url: adresseApp(window.location.origin, import.meta.env.BASE_URL), numero: formulaire.numero }
    Object.assign(formulaire, { ouvert: false, nom: '', numero: '', modules: { habitudes: false, photosRepas: false, calories: false } })
    filtre.value = 'actifs'
    await charger()
  } catch (e) {
    erreur.value = messageErreur(e)
  }
}

async function restaurer(p) {
  try {
    await data.profils.modifier(p.id, { archive: false })
    await charger()
    toast(`${p.nom} est de nouveau actif`)
  } catch (e) { toast(messageErreur(e)) }
}

</script>

<template>
  <section class="st-clients" :class="{ 'is-fiche': ouvert }" aria-labelledby="st-clients-titre">
    <header class="st-entete st-clients-entete">
      <div>
        <h1 id="st-clients-titre">Clients</h1>
        <p v-if="charge">{{ compteurs.actifs }} client{{ compteurs.actifs > 1 ? 's' : '' }} suivi{{ compteurs.actifs > 1 ? 's' : '' }}<template v-if="compteurs.attention"> · {{ compteurs.attention }} demande{{ compteurs.attention > 1 ? 'nt' : '' }} ton attention</template></p>
      </div>
      <div class="st-actions">
        <button type="button" class="st-btn st-btn--jaune" :aria-expanded="formulaire.ouvert" aria-controls="st-clients-invit" @click="basculerFormulaire">
          <IconeSt :nom="formulaire.ouvert ? 'fermer' : 'plus'" /><span>{{ formulaire.ouvert ? 'Fermer' : 'Inviter un client' }}</span>
        </button>
      </div>
    </header>

    <IdentifiantsCrees v-if="cree" class="st-clients-bloc" :infos="cree" :titre="`Compte créé pour ${cree.nom}`" @termine="cree = null" />

    <form v-if="formulaire.ouvert" id="st-clients-invit" class="st-clients-bloc st-clients-form" novalidate @submit.prevent="creer">
      <h2>Inviter un client</h2>
      <div class="st-clients-champs">
        <label class="st-clients-champ is-large">Nom complet<input ref="champNom" v-model="formulaire.nom" placeholder="Prénom Nom" autocomplete="off" /></label>
        <label class="st-clients-champ">Tarif (€)<input v-model.number="formulaire.tarif" type="number" min="0" step="1" inputmode="numeric" /></label>
        <label class="st-clients-champ">Lieu par défaut
          <select v-model="formulaire.lieuDefaut"><option v-for="l in LIEUX" :key="l" :value="l">{{ l === 'domicile' ? 'À domicile' : 'En salle' }}</option></select>
        </label>
        <label class="st-clients-champ">WhatsApp (facultatif)<input v-model="formulaire.numero" type="tel" placeholder="+33 6 …" autocomplete="off" /></label>
      </div>
      <fieldset class="st-clients-cases">
        <legend>Nutrition</legend>
        <label><input v-model="formulaire.modules.habitudes" type="checkbox" />Habitudes</label>
        <label><input v-model="formulaire.modules.photosRepas" type="checkbox" />Photos de repas</label>
        <label><input v-model="formulaire.modules.calories" type="checkbox" />Calories</label>
      </fieldset>
      <p v-if="erreur" class="st-clients-erreur" role="alert">{{ erreur }}</p>
      <button class="st-btn st-btn--encre" type="submit">Créer le compte</button>
    </form>

    <div class="st-clients-zone" :class="{ 'is-ouvert': ouvert }">
      <section class="st-clients-col" aria-label="Liste des clients">
        <div class="st-clients-outils">
          <label class="st-clients-recherche">
            <span class="st-sr">Rechercher un client</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
            <input ref="champRecherche" v-model="recherche" type="search" placeholder="Rechercher un client" autocomplete="off" enterkeyhint="search" />
            <kbd aria-hidden="true">/</kbd>
          </label>
          <Filtres v-model="filtreModele" :options="optionsFiltre" :multiple="false" etiquette="Filtrer les clients" />
        </div>

        <ul v-if="affiches.length" ref="liste" class="st-clients-liste" aria-label="Clients">
          <li v-for="c in affiches" :key="c.profil.id" class="st-clients-li">
            <RouterLink
              :to="`/coach/clients/${c.profil.id}`" class="st-clients-carte" :data-m="c.teinte" :data-client="c.profil.id"
              :aria-current="ouvert === c.profil.id ? 'page' : undefined" :class="{ 'is-archive': c.profil.archive }"
            >
              <span class="st-clients-av" aria-hidden="true">
                <svg v-if="c.resume.assiduite !== null" viewBox="0 0 56 56"><circle class="fond" cx="28" cy="28" r="26" /><circle class="val" cx="28" cy="28" r="26" :stroke-dasharray="trait(c.resume.assiduite)" /></svg>
                {{ initiales(c.profil.nom) }}
              </span>
              <span class="st-clients-txt">
                <b>{{ c.profil.nom }}</b>
                <small>{{ c.profil.archive ? `${c.profil.identifiant} · archivé` : libelleDepuis(c.resume.depuis) }}</small>
                <small v-if="!c.profil.archive">{{ c.profil.tarif }} € · {{ c.profil.lieuDefaut === 'domicile' ? 'à domicile' : 'en salle' }}<template v-if="c.resume.assiduite !== null"> · assiduité {{ c.resume.assiduite }} %</template></small>
              </span>
              <Puce v-if="!c.profil.archive" :variante="VARIANTE_STATUT[c.resume.statut]" :point="c.resume.statut === 'alerte'">
                {{ c.resume.statut === 'alerte' ? `${c.resume.nbAlertes} alerte${c.resume.nbAlertes > 1 ? 's' : ''}` : LIBELLES_STATUT[c.resume.statut] }}
              </Puce>
            </RouterLink>
            <button v-if="c.profil.archive" type="button" class="st-btn st-clients-restaurer" :aria-label="`Restaurer ${c.profil.nom}`" @click="restaurer(c.profil)">Restaurer</button>
          </li>
        </ul>
        <div v-else-if="charge" class="st-clients-vide">
          <template v-if="recherche">
            <p>Aucun client ne correspond à « {{ recherche }} »<template v-if="filtre !== 'actifs'"> dans ce filtre</template>.</p>
            <button type="button" class="st-btn" @click="recherche = ''; filtre = 'actifs'">Tout afficher</button>
          </template>
          <p v-else-if="filtre === 'archives'">Aucun client archivé.</p>
          <p v-else-if="filtre === 'attention'">Personne à surveiller : tout le monde est à jour.</p>
          <template v-else>
            <p>Aucun client pour l'instant.</p>
            <button type="button" class="st-btn st-btn--jaune" @click="basculerFormulaire"><IconeSt nom="plus" />Inviter le premier</button>
          </template>
        </div>
      </section>

      <RouterView v-slot="{ Component }">
        <component :is="Component" v-if="Component" :key="route.params.id" @change="charger" />
      </RouterView>
    </div>
  </section>
</template>
