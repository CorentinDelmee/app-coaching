<script setup>
// Page Workout (overview) : tout le workout qui défile, bouton « Démarrer » collant en bas.
// La page naît de la carte touchée (transition d'élément partagé) ; « Démarrer » ouvre la séance par un cercle depuis le bouton.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import { data } from '../data/index.js'
import { apercuWorkout, etatBouton, templatePourJour } from '../domain/workoutUi.js'
import { jourLocal } from '../domain/dates.js'
import { jourLong } from '../domain/calendrierUi.js'
import { horloge } from '../lib/horloge.js'
import { lireSeanceEnCours } from '../lib/seanceEnCours.js'
import { utilisateurCourant } from '../lib/session.js'
import { mouvementReduit, nettoyer, ouvrirCercle } from '../anim/transitions.js'
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

// Jour touché dans le récap (?jour=AAAA-MM-JJ) ; sans lui, aujourd'hui.
const jourAffiche = /^\d{4}-\d{2}-\d{2}$/.test(route.query.jour || '') ? route.query.jour : aujourdhui
const sousTitre = computed(() => (apercu.value ? `${jourLong(jourAffiche)}` : ''))
// Bandeau « fait / à venir » quand on ouvre le workout d'un AUTRE jour depuis le récap de la semaine (?jour=)
const bandeau = ref(null)
const faitCeJour = ref(false)
const consigne = computed(() => apercu.value?.consigne || null)
// Séance déjà faite un autre jour : on montre ce qui a été réalisé, sans bouton pour la relancer (comme la maquette V2)
const sansDemarrer = computed(() => faitCeJour.value && jourAffiche !== aujourdhui)

async function charger() {
  try {
    const user = await utilisateurCourant()
    if (!user) { erreur.value = 'Connectez-vous pour voir ce workout.'; return }
    const id = route.params.workoutId
    const [workout, exercices, template, realisations] = await Promise.all([
      data.workouts.lire(id), data.exercices.lister(), data.templates.lire(user.id), data.realisations.lister({ clientId: user.id })
    ])
    if (!workout) { erreur.value = 'Ce workout est introuvable.'; return }
    apercu.value = apercuWorkout({
      workout, exercices, template: templatePourJour({ template, realisations, workoutId: id, jour: route.query.jour || null }), unite: user.preferences?.unite || 'kg',
      realisations: realisations.filter((r) => r.date < jourAffiche) // « Dernière fois » = avant le jour affiché
    })
    faitCeJour.value = realisations.some((r) => r.workoutId === id && r.date === jourAffiche)
    if (route.query.jour && faitCeJour.value && jourAffiche !== aujourdhui) bandeau.value = { type: 'fait', texte: `Séance faite ${jourLong(jourAffiche)}. Voici ce que vous avez réalisé.` }
    else if (route.query.jour && jourAffiche > aujourdhui) bandeau.value = { type: 'avenir', texte: 'Séance à venir : voici ce que Corentin a prévu.' }
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
  await charger()
  await nextTick()
  const tl = ouvrir()
  // les encarts d'exercice arrivent un à un, les pastilles de lettre rebondissent (maquette V2)
  if (tl && !mouvementReduit() && couche.value) {
    gsap.fromTo(couche.value.querySelectorAll('.ex, .ci-liste li'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out', delay: 0.3, clearProps: 'transform,opacity' })
    gsap.fromTo(couche.value.querySelectorAll('.bloc-l'), { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'back.out(1.7)', delay: 0.25, clearProps: 'transform,opacity' })
  }
})
onBeforeUnmount(() => {
  if (lancement.value) nettoyer(lancement.value)
  gsap.killTweensOf('.w-video')
})

// --- Démarrer : cercle d'accent depuis le bouton, puis la séance (qui lève un rideau de la même couleur) ---
// `exId` : toucher un exercice de l'overview ouvre la séance DEPUIS cet encart, directement sur cet exercice (M2)
function demarrer(exId = null, src = null) {
  if (enCoursDeLancement.value || !bouton.value) return
  enCoursDeLancement.value = true
  const nouvelle = bouton.value.action !== 'reprendre'
  const aller = () => {
    marquerLancement()
    partir()
    router.push({ name: 'seance', params: { workoutId: route.params.workoutId }, query: { ...(nouvelle ? { nouvelle: 1 } : {}), ...(exId ? { ex: exId } : {}), retour: route.path, ...(route.query.retour ? { depuis: route.query.retour } : {}) } })
  }
  ouvrirCercle(lancement.value, src || btn.value, { onFini: aller })
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
  gsap.to(el, { height: 0, opacity: 0, duration: 0.3, ease: 'power3.out', onComplete: fin })
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
        <!-- En-tête encre (maquette V2) : le workout, puis ses sections Bloc A / B / C -->
        <header class="page-haut w-tete" data-teinte="encre">
          <div class="p-top" data-c>
            <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
            <span class="sur-titre">{{ sousTitre }}</span>
          </div>
          <div data-c>
            <h1 class="page-titre">{{ apercu.titre }}</h1>
            <p v-if="apercu.sous" class="page-sous">{{ apercu.sous }}</p>
            <ul class="hero-meta">
              <li v-if="bouton.mention" class="mention"><Icone v-if="bouton.action === 'refaire'" nom="coche" />{{ bouton.mention }}</li>
              <li v-for="m in apercu.meta" :key="m">{{ m }}</li>
              <li v-if="apercu.prerempli">Vos dernières valeurs</li>
            </ul>
          </div>
        </header>

        <div class="w-corps">
          <div v-if="consigne" class="consigne" data-c>
            <span class="etiq">Consigne de Corentin</span>
            <p>{{ consigne }}</p>
          </div>
          <p v-if="bandeau" class="bandeau-fait" :class="{ 'bandeau-avenir': bandeau.type === 'avenir' }" data-c>
            <Icone v-if="bandeau.type === 'fait'" nom="coche" /><span>{{ bandeau.texte }}</span>
          </p>

          <section v-for="s in apercu.sections" :key="s.id || s.titre" data-c class="w-sec"
            :class="{ 'bloc-circuit': s.kind === 'circuit' && !s.option, 'bloc-option': s.option }">
            <header class="bloc-tete">
              <span class="bloc-l" aria-hidden="true">{{ s.option ? '+' : s.lettre }}</span>
              <span class="bloc-n">
                {{ s.option ? 'Option' : s.kind === 'circuit' ? `Bloc ${s.lettre}` : s.titre }}
                <small>{{ s.kind === 'circuit' ? (s.option ? 'Facultatif · si vous avez encore de l’énergie' : `Circuit · ${s.detail}`) : s.kind === 'superset' ? s.detail : `${s.exos.length} ${s.exos.length > 1 ? 'exercices' : 'exercice'}` }}</small>
              </span>
              <span v-if="s.kind === 'circuit'" class="tag-format">{{ s.nom }}</span>
            </header>

            <!-- Bloc d'exercices ou superset : un encart par exercice -->
            <ol v-if="s.kind !== 'circuit'" class="ex-liste">
              <li v-for="(x, k) in s.exos" :key="x.id" class="ex">
                <div class="ex-go" :class="{ 'ex-ouvre': !sansDemarrer }" :role="sansDemarrer ? undefined : 'button'" :tabindex="sansDemarrer ? undefined : 0" :aria-label="sansDemarrer ? undefined : `Ouvrir la séance sur ${x.nom}`"
                  @click="!sansDemarrer && demarrer(x.id, $event.currentTarget)" @keydown.enter="!sansDemarrer && demarrer(x.id, $event.currentTarget)">
                  <span class="ex-code">{{ s.lettre }}{{ k + 1 }}</span>
                  <span class="ex-nom">{{ x.nom }}</span>
                  <span class="ex-presc">
                    <span v-for="(p, i) in x.pastilles" :key="i" class="ex-p"><b>{{ p.valeur }}</b><i>{{ p.unite }}</i></span>
                  </span>
                  <span v-if="x.variante" class="ex-prec">Série par série : {{ x.variante }}</span>
                  <span v-if="x.derniere" class="ex-prec">Dernière fois : {{ x.derniere }}</span>
                  <span v-if="x.consignes" class="ex-prec ex-note">{{ x.consignes }}</span>
                </div>
                <button v-if="x.video.type === 'youtube'" class="ex-video" type="button" :aria-label="`Voir la vidéo : ${x.nom}`" :aria-expanded="!!videosOuvertes[x.id]" @click="basculerVideo(x)">
                  <Icone :nom="videosOuvertes[x.id] ? 'fermer' : 'lecture'" />
                </button>
                <a v-else-if="x.video.type === 'lien'" class="ex-video" :href="x.video.lien" target="_blank" rel="noopener" :aria-label="`Voir la vidéo : ${x.nom}`"><Icone nom="lecture" /></a>
                <Transition :css="false" @enter="entreeVideo" @leave="sortieVideo">
                  <div v-if="videosOuvertes[x.id]" class="w-video">
                    <div class="video-cadre"><iframe :src="x.video.embed" :title="x.nom" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>
                  </div>
                </Transition>
              </li>
            </ol>

            <!-- Circuit : consigne, puis ses exercices (quantité, nom, vidéo) -->
            <template v-else>
              <p v-if="s.libelle && s.libelle !== s.nom" class="bloc-but">{{ s.libelle }}</p>
              <ol class="ci-liste">
                <li v-for="(x, i) in s.exos" :key="i">
                  <span class="ci-q">{{ x.reps ?? '·' }}</span>
                  <span class="ci-n">{{ x.nom }}<small v-if="x.consignes">{{ x.consignes }}</small></span>
                  <a v-if="x.video.type !== 'aucune'" class="ci-v" :href="x.video.lien" target="_blank" rel="noopener" :aria-label="`Voir la vidéo : ${x.nom}`"><Icone nom="lecture" /></a>
                </li>
              </ol>
            </template>
          </section>

          <p v-if="!apercu.sections.length" class="w-vide" data-c>Ce workout ne contient pas encore d'exercice.</p>
        </div>
      </div>

      <!-- Bouton collant : visible pendant tout le défilement ; retour à portée du pouce -->
      <div class="dock-bas" data-c>
        <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
        <button v-if="!sansDemarrer" ref="btn" class="gros" :class="{ lance: enCoursDeLancement }" type="button" :disabled="enCoursDeLancement || !apercu.sections.length" @click="demarrer()">{{ bouton.libelle }}<Icone nom="fleche" /></button>
      </div>
    </section>

    <!-- Cercle d'accent : naît du bouton, couvre l'écran, puis la séance prend le relais -->
    <div ref="lancement" class="lancement" hidden></div>
  </main>
</template>
