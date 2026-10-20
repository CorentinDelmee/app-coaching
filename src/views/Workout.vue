<script setup>
// Page Workout (overview) : tout le workout qui défile, bouton « Démarrer » collant en bas.
// La page naît de la carte touchée (transition d'élément partagé) ; « Démarrer » ouvre la séance par un cercle depuis le bouton.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import { data } from '../data/index.js'
import { apercuWorkout, etatBouton } from '../domain/workoutUi.js'
import { jourLocal } from '../domain/dates.js'
import { jourLong } from '../domain/calendrierUi.js'
import { horloge } from '../lib/horloge.js'
import { lireSeanceEnCours } from '../lib/seanceEnCours.js'
import { utilisateurCourant } from '../lib/session.js'
import { installerRessort, mouvementReduit, nettoyer, ouvrirCercle } from '../anim/transitions.js'
import { marquerLancement, memoriserSource } from '../anim/passage.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const route = useRoute()
const router = useRouter()
const { racine, couche, ouvrir, partir, retour } = usePageAnimee('/programme')

const erreur = ref('')
const apercu = shallowRef(null)
const bouton = ref(null)
const aujourdhui = jourLocal(horloge.now())
const lancement = ref(null) // couche d'accent qui s'ouvre depuis « Démarrer »
const btn = ref(null)
const enCoursDeLancement = ref(false)
const videosOuvertes = ref({}) // exerciceLigne.id -> true

const sousTitre = computed(() => (apercu.value ? `${jourLong(aujourdhui)}` : ''))
const premierPuce = (p) => !p.startsWith('repos')

async function charger() {
  try {
    const user = await utilisateurCourant()
    if (!user) { erreur.value = 'Connectez-vous pour voir ce workout.'; return }
    const id = route.params.workoutId
    const [workout, exercices, template, realisations] = await Promise.all([
      data.workouts.lire(id), data.exercices.lister(), data.templates.lire(user.id), data.realisations.lister({ clientId: user.id })
    ])
    if (!workout) { erreur.value = 'Ce workout est introuvable.'; return }
    apercu.value = apercuWorkout({ workout, exercices, template, unite: user.preferences?.unite || 'kg' })
    const s = lireSeanceEnCours()
    bouton.value = etatBouton({
      workoutId: id, aujourdhui, realisations,
      enCours: s && s.clientId === user.id ? s : null
    })
  } catch (e) {
    erreur.value = 'Impossible de charger ce workout. Réessayez.'
    console.error(e)
  }
}

onMounted(async () => {
  installerRessort()
  await charger()
  await nextTick()
  ouvrir()
})
onBeforeUnmount(() => {
  if (lancement.value) nettoyer(lancement.value)
  gsap.killTweensOf('.w-video')
})

// --- Démarrer : cercle d'accent depuis le bouton, puis la séance (qui lève un rideau de la même couleur) ---
function demarrer() {
  if (enCoursDeLancement.value || !bouton.value) return
  enCoursDeLancement.value = true
  const nouvelle = bouton.value.action !== 'reprendre'
  const aller = () => {
    marquerLancement()
    partir()
    router.push({ name: 'seance', params: { workoutId: route.params.workoutId }, query: { ...(nouvelle ? { nouvelle: 1 } : {}), retour: route.path, ...(route.query.retour ? { depuis: route.query.retour } : {}) } })
  }
  ouvrirCercle(lancement.value, btn.value, { onFini: aller })
}

// --- Vidéo intégrée sous la ligne de l'exercice (YouTube) ou lien externe ---
function basculerVideo(ligne) {
  videosOuvertes.value = { ...videosOuvertes.value, [ligne.id]: !videosOuvertes.value[ligne.id] }
}
const entreeVideo = (el, fin) => {
  if (mouvementReduit()) { fin(); return }
  gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.55, ease: 'expo.out', onComplete: fin })
}
const sortieVideo = (el, fin) => {
  if (mouvementReduit()) { fin(); return }
  gsap.to(el, { height: 0, opacity: 0, duration: 0.3, ease: 'power3.in', onComplete: fin })
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <div v-if="erreur" class="ecran-vide">
      <p>{{ erreur }}</p>
      <button class="gros" type="button" @click="router.replace('/')">Retour</button>
    </div>

    <section v-else-if="apercu" ref="couche" class="page" hidden aria-label="Aperçu du workout">
      <div class="voile"></div>
      <div class="defile">
        <header class="w-tete">
          <div class="p-top" data-c>
            <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
            <span class="sur-titre">{{ sousTitre }}</span>
          </div>
          <div data-c>
            <h1 class="gros-titre">{{ apercu.titre }}</h1>
            <p v-if="apercu.sous" class="sous">{{ apercu.sous }}</p>
            <ul class="hero-meta">
              <li v-if="bouton.mention" class="mention"><Icone v-if="bouton.action === 'refaire'" nom="coche" />{{ bouton.mention }}</li>
              <li v-for="m in apercu.meta" :key="m">{{ m }}</li>
              <li v-if="apercu.prerempli">Vos dernières valeurs</li>
            </ul>
          </div>
        </header>

        <div class="w-corps">
          <section v-for="(s, k) in apercu.sections" :key="k" data-c :class="s.kind === 'circuit' ? 'w-circuit' : 'w-bloc'">
            <!-- Bloc d'exercices ou superset -->
            <template v-if="s.kind !== 'circuit'">
              <h3>{{ s.titre }} <span>{{ s.kind === 'superset' ? s.detail : `${s.exos.length} ${s.exos.length > 1 ? 'exercices' : 'exercice'}` }}</span></h3>
              <div :class="{ 'w-superset': s.kind === 'superset' }">
                <article v-for="x in s.exos" :key="x.id" class="w-exo-bloc">
                  <div class="w-exo">
                    <span v-if="x.lettre" class="lettre">{{ x.lettre }}</span>
                    <div class="w-exo-texte">
                      <div class="nom">{{ x.nom }}</div>
                      <div class="det">
                        <template v-for="(p, i) in x.puces" :key="i"><span v-if="i">{{ premierPuce(p) ? ' à ' : ' · ' }}</span><b v-if="premierPuce(p)">{{ p }}</b><template v-else>{{ p }}</template></template>
                      </div>
                      <div v-if="x.variante" class="det fin">Série par série : {{ x.variante }}</div>
                    </div>
                    <button v-if="x.video.type === 'youtube'" class="vid" type="button" :aria-label="`Voir la vidéo : ${x.nom}`" :aria-expanded="!!videosOuvertes[x.id]" @click="basculerVideo(x)">
                      <Icone :nom="videosOuvertes[x.id] ? 'fermer' : 'lecture'" />
                    </button>
                    <a v-else-if="x.video.type === 'lien'" class="vid" :href="x.video.lien" target="_blank" rel="noopener" :aria-label="`Voir la vidéo : ${x.nom}`"><Icone nom="lecture" /></a>
                  </div>
                  <p v-if="x.consignes" class="w-note">{{ x.consignes }}</p>
                  <Transition :css="false" @enter="entreeVideo" @leave="sortieVideo">
                    <div v-if="videosOuvertes[x.id]" class="w-video">
                      <div class="video-cadre"><iframe :src="x.video.embed" :title="x.nom" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>
                    </div>
                  </Transition>
                </article>
              </div>
            </template>

            <!-- Circuit : format + durée, puis ses exercices -->
            <template v-else>
              <div class="mode"><b>{{ s.nom }}</b><span class="sur-titre">{{ s.detail }}</span></div>
              <p v-if="s.libelle && s.libelle !== s.nom" class="w-note">{{ s.libelle }}</p>
              <ul>
                <li v-for="(x, i) in s.exos" :key="i">
                  <b>{{ x.reps ?? '·' }}</b><span>{{ x.nom }}<small v-if="x.consignes">{{ x.consignes }}</small></span>
                  <a v-if="x.video.type !== 'aucune'" class="vid mini" :href="x.video.lien" target="_blank" rel="noopener" :aria-label="`Voir la vidéo : ${x.nom}`"><Icone nom="lecture" /></a>
                </li>
              </ul>
            </template>
          </section>

          <div v-if="apercu.consigne" class="consigne" data-c>{{ apercu.consigne }}<small>Le mot de Corentin pour ce workout</small></div>
          <p v-if="!apercu.sections.length" class="w-vide" data-c>Ce workout ne contient pas encore d'exercice.</p>
        </div>
      </div>

      <!-- Bouton collant : visible pendant tout le défilement ; retour à portée du pouce -->
      <div class="dock-bas" data-c>
        <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
        <button ref="btn" class="gros" type="button" :disabled="enCoursDeLancement || !apercu.sections.length" @click="demarrer">{{ bouton.libelle }}</button>
      </div>
    </section>

    <!-- Cercle d'accent : naît du bouton, couvre l'écran, puis la séance prend le relais -->
    <div ref="lancement" class="lancement" hidden></div>
  </main>
</template>
