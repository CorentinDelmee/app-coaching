<script setup>
// Éditeur de séance Studio : blocs Exercice / Superset / Circuit à glisser-déposer (souris, doigt par la poignée, clavier),
// bibliothèque d'exercices en vignettes, sauvegarde automatique, annulation de chaque déplacement / suppression.
// Reprend tout l'ancien SeanceEditeur : nom, client (« Pour »), consignes, blocs, séries/champs, repos, consignes d'exercice,
// circuits (nom, format, paramètres, facultatif, exercices + reps), supersets (A/B).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import data from '../../../../../data/index.js'
import { FORMATS_CIRCUIT } from '../../../../../domain/modele.js'
import { etat, messageErreur, nomClient, rafraichir, uuid } from '../../../../store.js'
import { LIBELLES_FORMAT, PARAMS_FORMAT, copie, nouveauBloc, paramsAffiches } from '../../../../logique.js'
import IconeSt from '../../../IconeSt.vue'
import IndicateurSauvegarde from '../../../IndicateurSauvegarde.vue'
import { useSauvegardeAuto } from '../../../useSauvegardeAuto.js'
import { useRafraichirAuRetour } from '../../../useRafraichirAuRetour.js'
import { toast } from '../../../toast.js'
import ListeTriable from '../commun/ListeTriable.vue'
import Poignee from '../commun/Poignee.vue'
import VignetteMini from '../commun/VignetteMini.vue'
import { AIDE_GLISSER, creerGlisser } from '../commun/glisser.js'
import { deplacerEnPlace, insererEnPlace } from '../commun/deplacements.js'
import { teinte } from '../commun/exercices.js'
import { remplacerAdresse } from '../commun/adresse.js'
import BibliothequeExercices from './BibliothequeExercices.vue'
import ItemExerciceStudio from './ItemExerciceStudio.vue'
import { blocPour, exoCircuit, nbExercices, nettoyerSeance, problemeSeance, resumeBloc, resynchroniser } from './seance.js'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()

const exercices = ref([])
const workout = ref(undefined) // undefined = chargement, null = introuvable
const erreurChargement = ref('')
let cree = false              // la séance existe côté données (garde anti-doublon de creer)
let dernierEcrit = ''         // JSON de la dernière version écrite
let pret = false

const parId = (id) => exercices.value.find((e) => e.id === id) || null
const nomExo = (id) => parId(id)?.nom || 'exercice'

async function chargerExercices() {
  const r = data.exercices.recherche ? (await data.exercices.recherche({ limite: 500 })).items : await data.exercices.lister()
  exercices.value = [...r].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

async function charger(id) {
  pret = false
  workout.value = undefined
  erreurChargement.value = ''
  try {
    await Promise.all([rafraichir(), chargerExercices()])
    if (id === 'nouveau') {
      workout.value = { id: uuid(), nom: NOM_DEFAUT, clientId: route.query.client || null, consignes: '', blocs: [] }
      cree = false
      dernierEcrit = ''
    } else {
      const w = await data.workouts.lire(id)
      workout.value = w ? { consignes: '', ...copie(w) } : null
      cree = !!w
      dernierEcrit = w ? JSON.stringify(nettoyerSeance(workout.value)) : ''
      s.suivreVersion(w?.version)
    }
  } catch (e) {
    erreurChargement.value = messageErreur(e)
    workout.value = null
  }
  await nextTick()
  pret = true
}
onMounted(() => charger(props.id))
// Autre séance ouverte dans le même composant (pas après notre propre router.replace de création).
watch(() => props.id, (id) => { if (id !== 'nouveau' && id !== workout.value?.id) charger(id) })

// ------------------------------------------------------------------ sauvegarde automatique
// Conflit (Claude ou un autre appareil a modifié la séance) : voir src/coach/studio/LISEZMOI.md « Conflits ».
const s = useSauvegardeAuto(async (w, opts) => {
  let r
  if (!cree) {
    try {
      r = await data.workouts.creer(w)
    } catch (e) {
      if (e?.code !== 'EXISTE') throw e
      r = await data.workouts.modifier(w.id, w) // 1re écriture déjà passée (réponse perdue) : pas de doublon
    }
    cree = true
    s.suivreVersion(r?.version) // la séance existe : les écritures suivantes sont contrôlées
    if (/\/nouveau$/.test(location.pathname)) remplacerAdresse(`/coach/seances/${w.id}`)
  } else r = await data.workouts.modifier(w.id, w, opts)
  dernierEcrit = JSON.stringify(w)
  return r
}, { delai: 700, recharger: appliquer, resumer: (w) => w.nom })

/** Remplace la séance affichée par la version enregistrée (après « Recharger » ou au retour sur l'onglet). */
function appliquer(w) {
  workout.value = { consignes: '', ...copie(w) }
  dernierEcrit = JSON.stringify(nettoyerSeance(workout.value))
}
// Retour sur l'onglet / la fenêtre : relit la séance si elle a changé ailleurs (jamais pendant une saisie non enregistrée).
useRafraichirAuRetour(async () => {
  if (!cree || !workout.value) return
  const w = await data.workouts.lire(workout.value.id)
  if (!w || w.version === workout.value.version || s.occupe()) return
  appliquer(w)
  s.suivreVersion(w.version)
}, { sauvegarde: s })

const probleme = computed(() => problemeSeance(workout.value))
const nonEcrit = () => workout.value && JSON.stringify(nettoyerSeance(workout.value)) !== dernierEcrit
const NOM_DEFAUT = 'Nouvelle séance'
const aDuContenu = () => workout.value && (workout.value.blocs.length || workout.value.consignes?.trim() || (workout.value.nom.trim() && workout.value.nom.trim() !== NOM_DEFAUT))

watch(workout, () => {
  if (!pret || !workout.value) return
  if (probleme.value) return
  const propre = nettoyerSeance(workout.value)
  if (JSON.stringify(propre) !== dernierEcrit) s.planifier(propre)
}, { deep: true })

// Quitter la page : on attend l'écriture en cours ; si rien n'a pu être écrit, bandeau « Quitter / Rester » (pas de confirm()).
const sortie = ref(null) // { vers, raison }
let forcer = false
async function avantDeQuitter(to) {
  if (forcer || !workout.value) return true
  await s.maintenant()
  if (s.etat.value === 'erreur') { sortie.value = { vers: to.fullPath, raison: 'La dernière modification n\'a pas pu être enregistrée.' }; return false }
  if (s.etat.value === 'conflit') { sortie.value = { vers: to.fullPath, raison: 'Séance modifiée ailleurs : ta dernière saisie n\'est pas enregistrée.' }; return false }
  if (probleme.value && (cree ? nonEcrit() : aDuContenu())) { sortie.value = { vers: to.fullPath, raison: `Non enregistré : ${probleme.value}` }; return false }
  return true
}
onBeforeRouteLeave(avantDeQuitter)
onBeforeRouteUpdate((to) => (to.params.id === workout.value?.id ? true : avantDeQuitter(to)))
function quitterQuandMeme() { forcer = true; const v = sortie.value.vers; sortie.value = null; router.push(v).finally(() => { forcer = false }) }
const avantFermeture = (e) => { if (s.etat.value === 'attente' || s.etat.value === 'encours' || s.etat.value === 'erreur' || s.etat.value === 'conflit') { e.preventDefault(); e.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', avantFermeture))
onBeforeUnmount(() => { window.removeEventListener('beforeunload', avantFermeture); s.arreter(); g.detruire() })

// ------------------------------------------------------------------ glisser-déposer
// Listes : 'blocs' (type bloc), 'circuit:<id>' (type circuit-exo, d'un circuit à l'autre), 'superset:<id>' (A/B, dans le superset).
const blocDe = (liste) => workout.value.blocs.find((b) => `circuit:${b.id}` === liste || `superset:${b.id}` === liste)
const tableauDe = (liste) => (liste === 'blocs' ? workout.value.blocs : blocDe(liste)?.exercices)
const vient = ref('') // id du bloc qui vient d'arriver (animation d'apparition + défilement)

function surDeposer({ origine, donnee, cible }) {
  const dst = tableauDe(cible.liste)
  if (!dst) return false
  if (donnee) {
    if (cible.liste === 'blocs') {
      const b = insererEnPlace(dst, cible.index, blocPour(donnee.id, uuid, donnee))
      vient.value = b.id
      return `${donnee.nom} ajouté à la séance`
    }
    insererEnPlace(dst, cible.index, exoCircuit(donnee.id))
    resynchroniser(blocDe(cible.liste))
    return `${donnee.nom} ajouté au circuit`
  }
  const src = tableauDe(origine.liste)
  const item = deplacerEnPlace(src, origine.index, cible.index, dst)
  if (origine.liste !== 'blocs') resynchroniser(blocDe(origine.liste))
  if (cible.liste !== origine.liste && cible.liste !== 'blocs') resynchroniser(blocDe(cible.liste))
  if (cible.liste === 'blocs') return `${libelleBloc(item)} déplacé en position ${cible.index + 1}`
  return `${nomExo(item.exerciceId)} déplacé${cible.liste !== origine.liste ? ' dans un autre circuit' : ''}`
}

// Où va le prochain ajout par toucher / clic : la séance, un circuit, ou le remplacement de l'exercice d'un item.
const ajout = ref({ vers: 'blocs' }) // { vers: 'blocs' } | { vers: 'circuit:<id>' } | { remplacer: { blocId, itemId? , index? } }
const feuille = ref(false)
const biblio = ref(null)
const titreBiblio = computed(() => {
  const a = ajout.value
  if (a.remplacer) return `Remplacer « ${nomExo(itemARemplacer()?.exerciceId) || 'exercice'} »`
  if (a.vers !== 'blocs') return `Ajouter au circuit « ${blocDe(a.vers)?.nom || 'sans nom'} »`
  return 'Ajouter à la séance'
})
function itemARemplacer() {
  const r = ajout.value.remplacer
  if (!r) return null
  const b = workout.value.blocs.find((x) => x.id === r.blocId)
  if (!b) return null
  if (b.type === 'exercice') return b
  if (b.type === 'superset') return b.exercices.find((x) => x.id === r.itemId)
  return b.exercices[r.index]
}
function surAjouter(e) {
  const a = ajout.value
  let msg
  if (a.remplacer) {
    const it = itemARemplacer()
    if (!it) return false
    const avant = nomExo(it.exerciceId)
    it.exerciceId = e.id
    const b = workout.value.blocs.find((x) => x.id === a.remplacer.blocId)
    resynchroniser(b)
    msg = it.exerciceId && avant !== 'exercice' ? `${avant} remplacé par ${e.nom}` : `${e.nom} choisi`
    const vide = b.type === 'superset' && b.exercices.find((x) => !x.exerciceId)
    ajout.value = vide ? { remplacer: { blocId: b.id, itemId: vide.id } } : { vers: 'blocs' }
    if (vide) { msg += ` · choisis l'exercice ${String.fromCharCode(65 + b.exercices.indexOf(vide))}`; return msg }
  } else msg = surDeposer({ origine: null, donnee: e, cible: { liste: a.vers, index: Infinity } })
  if (feuille.value) feuille.value = false
  return msg
}
const g = creerGlisser({
  surDeposer,
  surAjouter,
  capturer: () => copie(workout.value),
  restaurer: (w) => { workout.value = w }
})

function ouvrirBiblio(cible) {
  ajout.value = cible
  if (window.matchMedia('(max-width: 900px)').matches) feuille.value = true
  else nextTick(() => biblio.value?.focaliser())
}

// Défilement vers un bloc qui vient d'être ajouté (sans animation si mouvement réduit).
watch(vient, async (id) => {
  if (!id) return
  await nextTick()
  const el = document.getElementById(`st-prog-s-bloc-${id}`)
  if (el && el.getBoundingClientRect().bottom > window.innerHeight) {
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  }
  setTimeout(() => { if (vient.value === id) vient.value = '' }, 700)
})

// ------------------------------------------------------------------ blocs
// Blocs repliés par défaut (résumé compact, facile à glisser) ; « Modifier » déplie l'édition complète.
const ouverts = ref(new Set())
const estOuvert = (id) => ouverts.value.has(id)
function basculer(id) { const s2 = new Set(ouverts.value); if (s2.has(id)) s2.delete(id); else s2.add(id); ouverts.value = s2 }
const ouvrirBloc = (id) => { if (!estOuvert(id)) basculer(id) }
const libelleBloc = (b) => (b.type === 'exercice' ? nomExo(b.exerciceId) : b.type === 'superset' ? `Superset ${b.exercices.map((x) => nomExo(x.exerciceId)).join(' + ')}` : `Circuit ${b.nom || LIBELLES_FORMAT[b.format]}`)
const teinteBloc = (b) => (b.type === 'circuit' ? null : teinte(parId(b.type === 'exercice' ? b.exerciceId : b.exercices[0]?.exerciceId)))

function ajouterBloc(type) {
  const avant = copie(workout.value)
  const b = nouveauBloc(type, uuid, '') // superset : 2 emplacements vides à choisir (séance non enregistrée tant qu'ils manquent)
  workout.value.blocs.push(b)
  ouvrirBloc(b.id)
  vient.value = b.id
  toast(type === 'superset' ? 'Superset ajouté : choisis ses 2 exercices' : 'Circuit ajouté : glisse-y des exercices', { action: 'Annuler', surAction: () => { workout.value = avant; ajout.value = { vers: 'blocs' } }, duree: 8000 })
  if (type === 'circuit') ajout.value = { vers: `circuit:${b.id}` }
  else ouvrirBiblio({ remplacer: { blocId: b.id, itemId: b.exercices[0].id } })
}
function supprimerBloc(i) {
  const avant = copie(workout.value)
  const [b] = workout.value.blocs.splice(i, 1)
  if (ajout.value.vers === `circuit:${b.id}` || ajout.value.remplacer?.blocId === b.id) ajout.value = { vers: 'blocs' }
  toast(`${libelleBloc(b)} supprimé`, { action: 'Annuler', surAction: () => { workout.value = avant }, duree: 6000 })
}
function dupliquerBloc(i) {
  const c = copie(workout.value.blocs[i])
  c.id = uuid()
  if (c.type === 'superset') c.exercices.forEach((x) => { x.id = uuid() })
  workout.value.blocs.splice(i + 1, 0, c)
  vient.value = c.id
}
function retirerExoCircuit(b, j) {
  const avant = copie(workout.value)
  const [x] = b.exercices.splice(j, 1)
  resynchroniser(b)
  toast(`${nomExo(x.exerciceId)} retiré du circuit`, { action: 'Annuler', surAction: () => { workout.value = avant } })
}
function changerFormat(b, format) { b.format = format; b.params = {}; resynchroniser(b) }
const valeurParam = (b, cle) => paramsAffiches(b.format, b.params)[cle]
function majParam(b, cle, v) { b.params = { ...b.params, [cle]: v === '' ? 0 : Number(v) } }
const remplace = (blocId, extra = {}) => {
  const r = ajout.value.remplacer
  return !!r && r.blocId === blocId && (extra.itemId === undefined || r.itemId === extra.itemId) && (extra.index === undefined || r.index === extra.index)
}
const choisir = (blocId, extra = {}) => (ouvrirBloc(blocId), remplace(blocId, extra) ? (ajout.value = { vers: 'blocs' }) : ouvrirBiblio({ remplacer: { blocId, ...extra } }))
const cleCircuit = new WeakMap() // les exercices de circuit n'ont pas d'id dans le modèle : clé stable par objet
let n = 0
const cleExo = (x) => { const o = x; if (!cleCircuit.has(o)) cleCircuit.set(o, `cx${++n}`); return cleCircuit.get(o) }

const sousTitre = computed(() => (workout.value?.clientId ? `Séance · ${nomClient(workout.value.clientId)}` : 'Séance · Modèle réutilisable'))
const nbExos = computed(() => nbExercices(workout.value))
</script>

<template>
  <div class="st-prog st-prog-s">
    <p id="st-gl-aide" class="st-sr">{{ AIDE_GLISSER }}</p>
    <p class="st-sr" aria-live="assertive">{{ g.annonce.value }}</p>

    <RouterLink to="/coach/seances" class="st-prog-retour"><span aria-hidden="true">←</span> Séances</RouterLink>

    <div v-if="workout === undefined" class="st-prog-s-charge" aria-busy="true"><span /><span /><span /></div>
    <div v-else-if="workout === null" class="st-bloc st-prog-s-introuvable">
      <h1>Séance introuvable</h1>
      <p>{{ erreurChargement || 'Elle a peut-être été archivée.' }}</p>
      <RouterLink class="st-btn st-btn--encre" to="/coach/seances">Toutes les séances</RouterLink>
    </div>

    <template v-else>
      <header class="st-entete st-prog-s-entete">
        <div class="st-prog-s-titre">
          <p>{{ sousTitre }} · {{ workout.blocs.length }} bloc{{ workout.blocs.length > 1 ? 's' : '' }} · {{ nbExos }} exercice{{ nbExos > 1 ? 's' : '' }}</p>
          <label class="st-sr" for="st-prog-s-nom">Nom de la séance</label>
          <input id="st-prog-s-nom" v-model="workout.nom" class="st-prog-s-nom" placeholder="Nom de la séance" autocomplete="off" maxlength="80" />
        </div>
        <div class="st-actions">
          <IndicateurSauvegarde :etat="s.etat.value" :conflit="s.conflit.value" @reessayer="s.reessayer" @recharger="s.recharger" />
        </div>
      </header>

      <div v-if="sortie" class="st-prog-s-sortie" role="alertdialog" aria-labelledby="st-prog-s-sortie-t">
        <p id="st-prog-s-sortie-t"><b>{{ sortie.raison }}</b> Si tu quittes, la dernière modification sera perdue.</p>
        <button type="button" class="st-btn st-btn--encre" @click="sortie = null">Rester et corriger</button>
        <button type="button" class="st-btn" @click="quitterQuandMeme">Quitter sans enregistrer</button>
      </div>
      <p v-else-if="probleme && (cree || workout.blocs.length)" class="st-prog-s-probleme" role="status"><IconeSt nom="cloche" /> Pas encore enregistrée : {{ probleme }}</p>

      <div class="st-prog-s-grille">
        <BibliothequeExercices
          ref="biblio" :exercices="exercices" :glisser="g" :titre="titreBiblio" :ciblee="ajout.vers !== 'blocs' || !!ajout.remplacer"
          :ouverte="feuille" @fermer="feuille = false" @revenir="ajout = { vers: 'blocs' }"
        />

        <div class="st-prog-s-contenu">
          <section class="st-bloc st-prog-s-infos" aria-label="Réglages de la séance">
            <label>Pour
              <select v-model="workout.clientId">
                <option :value="null">Modèle (aucun client)</option>
                <option v-for="c in etat.clients" :key="c.id" :value="c.id">{{ c.nom }}</option>
              </select>
            </label>
            <label class="st-prog-s-large">Consignes du coach
              <textarea v-model="workout.consignes" rows="2" placeholder="Affichées au client en haut de la séance" />
            </label>
          </section>

          <ListeTriable
            :glisser="g" id="blocs" type="bloc" :accepte="['bloc', 'source-exo']" :items="workout.blocs"
            :cle="(b) => b.id" :libelle="libelleBloc" etiquette="Blocs de la séance" class="st-prog-s-blocs" data-test="zone-seance"
          >
            <template #default="{ item: b, index: i, poignee, tirable }">
              <article
                :id="`st-prog-s-bloc-${b.id}`" data-test="bloc" v-bind="tirable" class="st-prog-s-bloc" :class="[`is-${b.type}`, { 'is-vient': vient === b.id }]"
                :data-m="teinteBloc(b) || undefined" :style="{ '--i': Math.min(i, 8) }"
              >
                <header class="st-prog-s-bloc-tete">
                  <Poignee v-bind="poignee" />
                  <span class="st-prog-s-num" aria-hidden="true">{{ i + 1 }}</span>
                  <h3>
                    <template v-if="b.type === 'exercice'">Exercice</template>
                    <template v-else-if="b.type === 'superset'">Superset</template>
                    <template v-else>Circuit · {{ LIBELLES_FORMAT[b.format] }}<small v-if="b.facultatif"> · facultatif</small></template>
                    <span class="st-sr"> {{ i + 1 }} : {{ libelleBloc(b) }}</span>
                  </h3>
                  <span class="st-prog-s-espace" />
                  <button type="button" class="st-btn st-btn--fantome st-prog-mini st-prog-s-bascule" :aria-expanded="estOuvert(b.id)" :aria-controls="`st-prog-s-corps-${b.id}`" @click="basculer(b.id)">{{ estOuvert(b.id) ? 'Replier' : 'Modifier' }}<span class="st-sr"> le bloc {{ i + 1 }}</span></button>
                  <button type="button" class="st-btn st-btn--fantome st-btn--rond" :aria-label="`Dupliquer le bloc ${i + 1}`" title="Dupliquer" @click="dupliquerBloc(i)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8" /></svg></button>
                  <button type="button" class="st-btn st-btn--fantome st-btn--rond" :aria-label="`Supprimer le bloc ${i + 1}`" title="Supprimer" @click="supprimerBloc(i)"><IconeSt nom="fermer" /></button>
                </header>

                <!-- Replié : résumé (toute la carte se glisse à la souris) -->
                <button v-if="!estOuvert(b.id)" type="button" class="st-prog-s-resume" :aria-label="`Modifier le bloc ${i + 1} : ${libelleBloc(b)}`" @click="basculer(b.id)">
                  <VignetteMini v-if="b.type === 'exercice' && parId(b.exerciceId)" :exercice="parId(b.exerciceId)" tag="span" class="st-prog-s-actuel" />
                  <span v-else class="st-prog-s-resume-noms">
                    <template v-if="b.type === 'circuit'">{{ b.nom || 'Circuit sans nom' }}</template>
                    <template v-else-if="b.type === 'superset'">{{ b.exercices.map((x) => nomExo(x.exerciceId)).join(' + ') }}</template>
                    <template v-else>Exercice à choisir</template>
                  </span>
                  <span class="st-prog-s-resume-detail">{{ resumeBloc(b, nomExo, (f) => LIBELLES_FORMAT[f]) }}</span>
                </button>
                <!-- Exercice simple -->
                <div v-else-if="b.type === 'exercice'" :id="`st-prog-s-corps-${b.id}`" class="st-prog-s-corps">
                  <ItemExerciceStudio :item="b" :exercice="parId(b.exerciceId)" :remplacement="remplace(b.id)" @maj="Object.assign(b, $event)" @choisir="choisir(b.id)" />
                  <div class="st-prog-s-ligne">
                    <label class="st-prog-s-court"><span>Repos après chaque série <span class="st-prog-s-unite">s</span></span><input v-model.number="b.repos" type="number" min="0" step="5" inputmode="numeric" /></label>
                    <label class="st-prog-s-large">Consignes de l'exercice<input v-model="b.consignes" placeholder="Facultatif" /></label>
                  </div>
                </div>

                <!-- Superset : A puis B enchaînés, repos après le passage -->
                <div v-else-if="b.type === 'superset'" :id="`st-prog-s-corps-${b.id}`" class="st-prog-s-corps">
                  <ListeTriable
                    :glisser="g" :id="`superset:${b.id}`" :type="`superset:${b.id}`" :items="b.exercices" :cle="(x) => x.id"
                    :libelle="(x) => nomExo(x.exerciceId)" etiquette="Exercices du superset" class="st-prog-s-sous"
                  >
                    <template #default="{ item: x, index: j, poignee: p2 }">
                      <div class="st-prog-s-sousbloc" :data-m="teinte(parId(x.exerciceId)) || undefined">
                        <Poignee v-bind="p2" class="st-prog-s-poignee-sous" />
                        <ItemExerciceStudio :item="x" :exercice="parId(x.exerciceId)" :titre="String.fromCharCode(65 + j)" :remplacement="remplace(b.id, { itemId: x.id })" @maj="Object.assign(x, $event)" @choisir="choisir(b.id, { itemId: x.id })" />
                      </div>
                    </template>
                  </ListeTriable>
                  <label class="st-prog-s-court"><span>Repos après le passage <span class="st-prog-s-unite">s</span></span><input v-model.number="b.repos" type="number" min="0" step="5" inputmode="numeric" /></label>
                </div>

                <!-- Circuit -->
                <div v-else :id="`st-prog-s-corps-${b.id}`" class="st-prog-s-corps">
                  <div class="st-prog-s-ligne">
                    <label class="st-prog-s-large">Nom du circuit<input v-model="b.nom" placeholder="Finisher" maxlength="80" /></label>
                    <label>Format
                      <select :value="b.format" @change="changerFormat(b, $event.target.value)">
                        <option v-for="f in FORMATS_CIRCUIT" :key="f" :value="f">{{ LIBELLES_FORMAT[f] }}</option>
                      </select>
                    </label>
                    <label v-for="p in PARAMS_FORMAT[b.format]" :key="p.cle" class="st-prog-s-court"><span>{{ p.label }}<span v-if="p.unite" class="st-prog-s-unite">{{ p.unite }}</span></span>
                      <input type="number" min="0" inputmode="numeric" :value="valeurParam(b, p.cle)" @input="majParam(b, p.cle, $event.target.value)" />
                    </label>
                  </div>
                  <label class="st-prog-s-case"><input v-model="b.facultatif" type="checkbox" />Facultatif : le client peut le passer (« Faire l'option » en fin de séance)</label>
                  <ListeTriable
                    :glisser="g" :id="`circuit:${b.id}`" type="circuit-exo" :accepte="['circuit-exo', 'source-exo']" :items="b.exercices"
                    :cle="cleExo" :libelle="(x) => nomExo(x.exerciceId)" etiquette="Exercices du circuit" class="st-prog-s-sous st-prog-s-circuit"
                  >
                    <template #default="{ item: x, index: j, poignee: p3, tirable: t3 }">
                      <div class="st-prog-s-cx" :data-m="teinte(parId(x.exerciceId)) || undefined" v-bind="t3">
                        <Poignee v-bind="p3" />
                        <VignetteMini v-if="parId(x.exerciceId)" :exercice="parId(x.exerciceId)" tag="div" class="st-prog-s-actuel" />
                        <p v-else class="st-prog-s-manque">Aucun exercice choisi</p>
                        <button type="button" class="st-btn st-prog-mini" :class="{ 'st-btn--encre': remplace(b.id, { index: j }) }" @click="choisir(b.id, { index: j })">{{ remplace(b.id, { index: j }) ? 'Choisis…' : 'Changer' }}<span class="st-sr"> {{ nomExo(x.exerciceId) }}</span></button>
                        <label class="st-prog-s-court">Reps<input type="number" min="0" inputmode="numeric" :value="x.reps" @input="x.reps = $event.target.value === '' ? undefined : Number($event.target.value)" /></label>
                        <button type="button" class="st-btn st-btn--fantome st-btn--rond" :aria-label="`Retirer ${nomExo(x.exerciceId)} du circuit`" @click="retirerExoCircuit(b, j)"><IconeSt nom="fermer" /></button>
                      </div>
                    </template>
                    <template #vide><p class="st-prog-s-depot">Glisse des exercices ici, ou « + Exercice dans le circuit ».</p></template>
                  </ListeTriable>
                  <button type="button" class="st-btn st-prog-mini" :class="{ 'st-btn--encre': ajout.vers === `circuit:${b.id}` }" :aria-pressed="ajout.vers === `circuit:${b.id}`" @click="ajout.vers === `circuit:${b.id}` ? (ajout = { vers: 'blocs' }) : ouvrirBiblio({ vers: `circuit:${b.id}` })">
                    <IconeSt nom="plus" />{{ ajout.vers === `circuit:${b.id}` ? 'Ajout au circuit en cours (clic sur la bibliothèque)' : 'Exercice dans le circuit' }}
                  </button>
                </div>
              </article>
            </template>
            <template #vide>
              <div class="st-prog-s-vide">
                <p><b>Séance vide.</b> Glisse un exercice de la bibliothèque ici, ou ajoute un bloc.</p>
              </div>
            </template>
          </ListeTriable>

          <div class="st-prog-s-ajouts" role="group" aria-label="Ajouter un bloc">
            <button type="button" class="st-btn st-btn--jaune" :disabled="!exercices.length" @click="ouvrirBiblio({ vers: 'blocs' })"><IconeSt nom="plus" />Exercice</button>
            <button type="button" class="st-btn" :disabled="!exercices.length" @click="ajouterBloc('superset')"><IconeSt nom="plus" />Superset</button>
            <button type="button" class="st-btn" @click="ajouterBloc('circuit')"><IconeSt nom="plus" />Circuit</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style src="./seances.css"></style>
