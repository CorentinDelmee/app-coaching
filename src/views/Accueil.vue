<script setup>
// Tableau de bord (accueil client) : tout tient sans défiler à 390×844. Cinq cartes : aujourd'hui, cette semaine, coaching,
// programme, questionnaires. Chaque carte ouvre sa page par la transition « élément partagé » (carte -> page).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import { data, mode } from '../data/index.js'
import { syntheseAccueil } from '../domain/accueil.js'
import { messageEcrire } from '../domain/coaching.js'
import { lienCoach } from '../lib/coach.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { compter, fermerPage, installerRessort, mouvementReduit } from '../anim/transitions.js'
import { anneau, animerAnneau, motsMontent } from '../anim/titres.js'
import { consommerFinSeance, consommerRetour, memoriserSource } from '../anim/passage.js'

const router = useRouter()
const racine = ref(null)
const erreur = ref('')
const user = ref(null)
const s = shallowRef(null)
const anneauEl = ref(null)
const compteurSemaine = ref(null)
const salutEl = ref(null)
const celebration = ref(null)
let idle = []
let entrees = null // données de la synthèse (pour recalculer la semaine « avant » la séance qui vient d'être validée)

async function charger() {
  try {
    user.value = await utilisateurCourant()
    if (!user.value) { erreur.value = 'Connectez-vous pour voir votre tableau de bord.'; return }
    const id = user.value.id
    const [programmes, workouts, exercices, template, realisations, seancesCoaching, questionnaires, reponses] = await Promise.all([
      data.programmes.lister({ clientId: id }), data.workouts.lister({ clientId: id }), data.exercices.lister(), data.templates.lire(id),
      data.realisations.lister({ clientId: id }), data.seancesCoaching.lister({ clientId: id }), data.questionnaires.lister(), data.reponses.lister({ clientId: id })
    ])
    entrees = { user: user.value, programme: programmes[0] || null, workouts, exercices, template, realisations, seancesCoaching, questionnaires, reponses, now: horloge.now() }
    s.value = syntheseAccueil(entrees)
  } catch (e) {
    erreur.value = 'Impossible de charger votre tableau de bord. Réessayez.'
    console.error(e)
  }
}

const fraction = computed(() => (s.value && s.value.semaine.total ? s.value.semaine.faits / s.value.semaine.total : 0))
const bouclee = computed(() => s.value?.hero.etat === 'bouclee')
const lienEcrire = computed(() => lienCoach(messageEcrire(user.value?.nom || '')))
const dev = mode === 'local'

// --- Entrée : mots qui montent, cartes révélées en clip-path, anneau + compteurs, pastille ---
function entree() {
  const cartes = Array.from(racine.value.querySelectorAll('.carte'))
  anneau(anneauEl.value, 0)
  if (mouvementReduit()) {
    gsap.fromTo(cartes, { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' })
    anneau(anneauEl.value, fraction.value)
    return
  }
  motsMontent(salutEl.value, 0.05)
  gsap.fromTo('.a-haut .jour', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.05, ease: 'expo.out' })
  gsap.fromTo(cartes, { clipPath: 'inset(100% 0px 0px 0px round 26px)', y: 36 },
    { clipPath: 'inset(0% 0px 0px 0px round 26px)', y: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', delay: 0.12, clearProps: 'clipPath,transform' })
  gsap.fromTo('.hero .c-lab, .hero .hero-w, .hero .hero-sous, .hero .hero-meta li', { y: 30, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.9, stagger: 0.06, ease: 'expo.out', delay: 0.4, clearProps: 'transform,opacity' })
  gsap.fromTo('.carte.coaching > *, .carte.prog > *, .carte.quest > *', { y: 18, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.8, stagger: 0.04, ease: 'expo.out', delay: 0.7, clearProps: 'transform,opacity' })
  animerAnneau(anneauEl.value, 0, fraction.value, { duree: 1.6, delay: 0.7 })
  compter(compteurSemaine.value, 0, s.value.semaine.faits, { duree: 1.2, delay: 0.7 })
  gsap.fromTo('.pastille', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, delay: 1.1, ease: 'back.out(2.4)', clearProps: 'transform,opacity' })
  gsap.fromTo('.segs i', { scaleY: 0 }, { scaleY: 1, duration: 0.6, stagger: 0.07, delay: 1, ease: 'back.out(2)', clearProps: 'transform' })
  // vie discrète : la pastille respire, la flèche invite à toucher
  const pastille = racine.value.querySelector('.pastille')
  if (pastille) idle.push(gsap.to(pastille, { scale: 1.1, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2 }))
  if (bouclee.value) setTimeout(feter, 1100)
}

// Semaine bouclée : confettis depuis la carte héros
function feter() {
  const h = celebration.value
  if (!h || mouvementReduit()) return
  const couleurs = ['c1', 'c2', 'c3']
  for (let i = 0; i < 22; i++) {
    const c = document.createElement('span')
    c.className = `confetti ${couleurs[i % 3]}`
    c.style.left = '82%'; c.style.top = '26%'
    h.appendChild(c)
    const a = Math.random() * Math.PI * 2
    const d = 80 + Math.random() * 140
    gsap.fromTo(c, { x: 0, y: 0, scale: 0, opacity: 1 }, {
      x: Math.cos(a) * d, y: Math.sin(a) * d - 30, scale: 0.6 + Math.random() * 0.9, rotate: Math.random() * 540, duration: 1 + Math.random() * 0.4, ease: 'expo.out',
      onComplete: () => gsap.to(c, { opacity: 0, y: '+=120', duration: 0.9, ease: 'power2.in', onComplete: () => c.remove() })
    })
  }
}

// --- Retour d'une séance validée : l'écran de fin (copie posée tout de suite, avant le chargement) se referme dans la carte
// « Cette semaine », puis l'anneau et le compteur gagnent la séance (maquette M1 : S.terminer + animerSemaine).
function poserCouverture(fin) {
  const c = document.createElement('div')
  c.className = 'retour-seance'
  c.style.cssText = 'position:absolute;inset:0;z-index:300;background:var(--fond);overflow:hidden'
  if (fin.clone) {
    fin.clone.removeAttribute('hidden')
    fin.clone.querySelectorAll(':scope > i').forEach((x) => x.remove()) // confettis encore en vol
    c.appendChild(fin.clone)
  }
  racine.value.appendChild(c)
  return c
}
function retourDeSeance(couverture, fin) {
  const { faits, total } = s.value.semaine
  const sans = entrees.realisations.filter((r) => r.id !== fin.realisationId)
  const avant = Math.min(faits, syntheseAccueil({ ...entrees, realisations: sans }).semaine.faits)
  anneau(anneauEl.value, total ? avant / total : 0)
  compteurSemaine.value.textContent = avant
  fermerPage(couverture, racine.value.querySelector('.carte.semaine'), { onFini: () => { couverture.remove(); gagnerSeance(avant) } })
}
function gagnerSeance(avant) {
  const { faits, total } = s.value.semaine
  if (faits === avant) return
  animerAnneau(anneauEl.value, total ? avant / total : 0, fraction.value, { duree: 1.5 })
  compter(compteurSemaine.value, avant, faits, { duree: 1.1 })
  if (mouvementReduit()) return
  gsap.fromTo('.anneau-w', { scale: 0.88 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1,.55)', clearProps: 'transform' })
  gsap.fromTo('.hero .hero-w, .hero .hero-sous, .hero .hero-meta', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'expo.out', clearProps: 'transform,opacity' })
  if (bouclee.value) setTimeout(feter, 700)
}

onMounted(async () => {
  installerRessort()
  const fin = consommerFinSeance()
  const couverture = fin ? poserCouverture(fin) : null
  await charger()
  await nextTick()
  if (!s.value) { couverture?.remove(); return }
  anneau(anneauEl.value, fraction.value)
  if (couverture) { consommerRetour(); retourDeSeance(couverture, fin); return }
  if (consommerRetour()) return // retour d'une page refermée dans sa carte : le dashboard est montré tel quel
  entree()
})
onBeforeUnmount(() => idle.forEach((t) => t.kill()))

// --- Ouvrir une page : elle naît de la carte touchée ---
function ouvrir(chemin, e) {
  memoriserSource(e.currentTarget)
  router.push(chemin)
}
const versHero = (e) => {
  const h = s.value.hero
  memoriserSource(e.currentTarget)
  router.push(h.workoutId && h.etat !== 'bouclee' ? { name: 'workout', params: { workoutId: h.workoutId }, query: { retour: '/' } } : '/programme')
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <div v-if="erreur" class="ecran-vide">
      <p>{{ erreur }}</p>
    </div>

    <div v-else-if="s" class="accueil">
      <header class="a-haut">
        <p class="jour">{{ s.jour }}</p>
        <h1 ref="salutEl" v-once class="salut">Bonjour {{ s.prenom }}</h1>
      </header>

      <div class="bento">
        <!-- Aujourd'hui -->
        <button ref="celebration" class="carte hero" :class="{ fait: s.hero.etat === 'fait' || s.hero.etat === 'bouclee' }" type="button"
          :aria-label="`${s.hero.etiquette} : ${s.hero.titre}. ${s.hero.sous}`" @click="versHero">
          <div class="c-lab">{{ s.hero.etiquette }}</div>
          <span class="hero-w">{{ s.hero.titre }}</span>
          <span v-if="s.hero.sous" class="hero-sous">{{ s.hero.sous }}</span>
          <ul v-if="s.hero.meta.length" class="hero-meta"><li v-for="m in s.hero.meta" :key="m">{{ m }}</li></ul>
          <span class="fleche"><Icone :nom="bouclee ? 'coupe' : 'fleche'" /></span>
        </button>

        <div class="rang2">
          <!-- Cette semaine -->
          <button class="carte semaine" type="button" :aria-label="`Cette semaine : ${s.semaine.faits} sur ${s.semaine.total}`" @click="ouvrir('/programme', $event)">
            <div class="c-lab">Cette semaine</div>
            <div class="anneau-w">
              <svg viewBox="0 0 108 108" aria-hidden="true"><circle class="piste-a" cx="54" cy="54" r="48" /><circle ref="anneauEl" class="rempli" :class="{ plein: bouclee }" cx="54" cy="54" r="48" /></svg>
              <div class="centre"><span><b ref="compteurSemaine" class="n">{{ s.semaine.faits }}</b><small>/{{ s.semaine.total }}</small></span></div>
            </div>
          </button>

          <!-- Prochaine séance de coaching, ou invitation à écrire -->
          <button v-if="s.coaching" class="carte coaching" type="button" aria-label="Prochaine séance de coaching" @click="ouvrir('/coaching', $event)">
            <div class="c-lab">Coaching</div>
            <div class="co-date">{{ s.coaching.date }}<br>{{ s.coaching.mois }}</div>
            <div class="co-heure">{{ s.coaching.heure }}</div>
            <div class="co-lieu">{{ s.coaching.lieu }}</div>
          </button>
          <a v-else class="carte coaching vide" :href="lienEcrire" target="_blank" rel="noopener">
            <div class="c-lab">Coaching</div>
            <div class="co-date">Aucune séance prévue</div>
            <div class="co-heure">M'écrire <Icone nom="fleche" /></div>
          </a>
        </div>

        <div class="rang3">
          <!-- Mon programme -->
          <button v-if="s.programme" class="carte prog" type="button" aria-label="Mon programme" @click="ouvrir('/programme', $event)">
            <div class="c-lab">Mon programme</div>
            <div class="pg-nom">{{ s.programme.nom }}</div>
            <div class="pg-s">{{ s.programme.numero >= 1 ? `Semaine ${s.programme.numero}${s.programme.total ? ` sur ${s.programme.total}` : ''}` : 'Bientôt' }}</div>
            <div class="segs" aria-hidden="true"><i v-for="(on, k) in s.programme.segments" :key="k" :class="{ on }"></i></div>
          </button>
          <button v-else class="carte prog" type="button" aria-label="Mon programme" @click="ouvrir('/programme', $event)">
            <div class="c-lab">Mon programme</div>
            <div class="pg-nom">Pas encore de programme</div>
            <div class="pg-s">Votre coach le prépare</div>
          </button>

          <!-- Questionnaires : pastille seulement s'il y en a à remplir -->
          <button class="carte quest" type="button" aria-label="Questionnaires" @click="ouvrir('/questionnaires', $event)">
            <span v-if="s.questionnaires" class="pastille" :aria-label="`${s.questionnaires} à remplir`">{{ s.questionnaires }}</span>
            <div class="q-t">Questionnaires</div>
            <div class="q-s">{{ !s.sante ? 'Données de santé désactivées' : s.questionnaires ? 'À remplir · 2 min' : 'Tout est à jour' }}</div>
          </button>
        </div>
      </div>

      <!-- Accès développement (mode local seulement) : discret -->
      <nav v-if="dev" class="acces-dev" aria-label="Accès développement">
        <RouterLink to="/demo/seance">Séance démo</RouterLink><RouterLink to="/demo/circuits">Circuits</RouterLink><RouterLink to="/profil">Profil</RouterLink>
      </nav>
    </div>
  </main>
</template>
