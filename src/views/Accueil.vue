<script setup>
// Tableau de bord (accueil client) : tout tient sans défiler à 390×844. Cinq cartes : aujourd'hui, cette semaine, coaching,
// programme, questionnaires. Chaque carte ouvre sa page par la transition « élément partagé » (carte -> page).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import Icone from '../components/Icone.vue'
import { data, mode } from '../data/index.js'
import { syntheseAccueil } from '../domain/accueil.js'
import { messageEcrire } from '../domain/coaching.js'
import { messageAccueil } from '../domain/messageAccueil.js'
import { CHOIX } from '../config/apparence.js'
import { lienCoach } from '../lib/coach.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { compter, fermerPage, mouvementReduit } from '../anim/transitions.js'
import { anneau, animerAnneau } from '../anim/titres.js'
import { consommerFinSeance, consommerRetour, memoriserSource } from '../anim/passage.js'

gsap.registerPlugin(SplitText)
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
let decoupe = null // SplitText du message d'accueil (à défaire avant de changer le texte)
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
const reste = computed(() => (s.value ? Math.max(0, s.value.semaine.total - s.value.semaine.faits) : 0))
const semaineInfo = computed(() => {
  const p = s.value?.programme
  return p && p.numero >= 1 ? `Semaine ${p.numero}${p.total ? ` sur ${p.total}` : ''}` : ''
})
const fantome = computed(() => { const n = s.value?.hero.titre.match(/(\d+)\s*$/); return n ? `W${n[1]}` : '' }) // grand « W2 » décoratif de l'aplat

// Message d'accueil (variante choisie dans src/config/apparence.js). Le titre est posé à la main (SplitText découpe ses lettres) :
// d'où cette fonction, qui défait la découpe précédente avant de remplacer le texte.
function poserMessage(msg) {
  if (decoupe) { decoupe.revert(); decoupe = null }
  const h = salutEl.value
  h.textContent = ''
  msg.lignes.forEach((l, i) => { if (i) h.appendChild(document.createElement('br')); h.appendChild(document.createTextNode(l)) })
  h.classList.toggle('long', msg.long)
}
const messageActuel = () => messageAccueil({ variante: CHOIX.accueil, prenom: s.value.prenom, etat: s.value.hero.etat, reste: reste.value })
function animerMessage(delai = 0) {
  const h = salutEl.value
  if (mouvementReduit()) { gsap.fromTo(h, { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' }); return }
  decoupe = SplitText.create(h, { type: 'chars', charsClass: 'car' })
  gsap.fromTo(decoupe.chars, { opacity: 0, z: -360, y: 60, rotationX: -80 }, { opacity: 1, z: 0, y: 0, rotationX: 0, duration: 1.05, stagger: 0.035, ease: 'expo.out', delay: delai, clearProps: 'transform,opacity' })
}

// --- Entrée (maquette V2) : l'aplat jaune descend comme un rideau, le message se pose lettre à lettre depuis la profondeur,
// la carte du jour puis les cartes arrivent en 3D ; anneau + compteur + pastille. Seulement transform / opacity / clip-path. ---
function entree() {
  const cartes = Array.from(racine.value.querySelectorAll('.grille .carte'))
  const hero = racine.value.querySelector('.c-aujourdhui')
  anneau(anneauEl.value, 0)
  poserMessage(messageActuel())
  if (mouvementReduit()) {
    gsap.fromTo([racine.value.querySelector('.aplat'), ...cartes], { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' })
    anneau(anneauEl.value, fraction.value)
    return
  }
  const tl = gsap.timeline()
  tl.fromTo('.aplat', { clipPath: 'inset(0px 0px 100% 0px round 0px 0px 34px 34px)' }, { clipPath: 'inset(0px 0px 0% 0px round 0px 0px 34px 34px)', duration: 1, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
    .fromTo('.aplat-fond span', { opacity: 0, y: 80, z: -300 }, { opacity: 1, y: 0, z: 0, duration: 1.8, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.2)
    .fromTo('.haut-info', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.35)
    .fromTo('.salut-p', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.45)
    .add(() => animerMessage(0), 0.4)
  if (hero) tl.fromTo(hero, { opacity: 0, y: 70, z: -200, rotationX: 16 }, { opacity: 1, y: 0, z: 0, rotationX: 0, duration: 1.1, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.55)
  cartes.forEach((c, i) => {
    const k = i < 2 ? 2 : 1 // les deux cartes du haut arrivent de plus loin
    tl.fromTo(c, { opacity: 0, z: -200 - k * 80, y: 60 + k * 36, rotationX: 18 }, { opacity: 1, z: 0, y: 0, rotationX: 0, duration: 0.85 + k * 0.14, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.7 + i * 0.08)
  })
  animerAnneau(anneauEl.value, 0, fraction.value, { duree: 1.4, delay: 0.9 })
  compter(compteurSemaine.value, 0, s.value.semaine.faits, { duree: 1.1, delay: 0.9 })
  const pastille = racine.value.querySelector('.pastille')
  if (pastille) {
    gsap.fromTo(pastille, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, delay: 1.3, ease: 'back.out(1.7)', clearProps: 'transform,opacity' })
    // trois respirations puis repos : un rappel, pas une animation permanente (batterie, écran vu plusieurs fois par jour)
    idle.push(gsap.to(pastille, { scale: 1.1, duration: 1.1, repeat: 5, yoyo: true, ease: 'sine.inOut', delay: 2.4 }))
  }
  gsap.fromTo('.barres i', { scaleY: 0 }, { scaleY: 1, duration: 0.6, stagger: 0.07, delay: 1.1, ease: 'back.out(1.7)', clearProps: 'transform' })
  if (bouclee.value) setTimeout(feter, 1100)
}

// Semaine bouclée : confettis depuis la carte du jour
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
      onComplete: () => gsap.to(c, { opacity: 0, y: '+=120', duration: 0.9, ease: 'power2.out', onComplete: () => c.remove() })
    })
  }
}

// --- Retour d'une séance validée : l'écran de fin (copie posée tout de suite, avant le chargement) se referme dans la carte
// « Cette semaine », puis l'anneau, le compteur et le message d'accueil gagnent la séance (« Prêt, Fabien ? » -> « Bien joué, Fabien. »). ---
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
  poserMessage(messageAccueil({ variante: CHOIX.accueil, prenom: s.value.prenom, etat: 'prevu', reste: total - avant })) // le message d'« avant »
  fermerPage(couverture, racine.value.querySelector('.carte.semaine'), { onFini: () => { couverture.remove(); gagnerSeance(avant) } })
}
function gagnerSeance(avant) {
  const { faits, total } = s.value.semaine
  poserMessage(messageActuel())
  if (faits === avant) return
  animerMessage(0.1)
  animerAnneau(anneauEl.value, total ? avant / total : 0, fraction.value, { duree: 1.5 })
  compter(compteurSemaine.value, avant, faits, { duree: 1.1 })
  if (mouvementReduit()) return
  gsap.fromTo('.anneau-s', { scale: 0.88 }, { scale: 1, duration: 0.8, ease: 'back.out(1.7)', clearProps: 'transform' })
  gsap.fromTo('.c-aujourdhui .c-lab, .c-aujourdhui .c-titre, .c-aujourdhui .c-sous, .c-aujourdhui .c-pieds', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'expo.out', clearProps: 'transform,opacity' })
  if (bouclee.value) setTimeout(feter, 700)
}

onMounted(async () => {
  const fin = consommerFinSeance()
  const couverture = fin ? poserCouverture(fin) : null
  await charger()
  await nextTick()
  if (!s.value) { couverture?.remove(); return }
  anneau(anneauEl.value, fraction.value)
  if (couverture) { consommerRetour(); retourDeSeance(couverture, fin); return }
  if (consommerRetour()) { poserMessage(messageActuel()); return } // retour d'une page refermée dans sa carte : le dashboard est montré tel quel
  entree()
})
onBeforeUnmount(() => { idle.forEach((t) => t.kill()); if (decoupe) decoupe.revert() })

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
      <!-- Aplat jaune : en-tête, message d'accueil, carte du jour. Texte foncé (réglage : html[data-aplat]) -->
      <div class="aplat" data-teinte="aplat">
        <div class="aplat-fond" aria-hidden="true"><span v-if="fantome">{{ fantome }}</span></div>
        <header class="haut"><span class="haut-info">{{ semaineInfo }}</span></header>
        <div class="salut">
          <p class="salut-p">{{ s.jour }}</p>
          <h1 ref="salutEl" class="salut-h" aria-live="polite"></h1>
        </div>
        <button ref="celebration" class="carte c-aujourdhui" data-teinte="encre" :class="{ fait: s.hero.etat === 'fait' || s.hero.etat === 'bouclee' }" type="button"
          :aria-label="`${s.hero.etiquette} : ${s.hero.titre}. ${s.hero.sous}`" @click="versHero">
          <span class="c-lab">{{ s.hero.etiquette }}</span>
          <span class="c-titre">{{ s.hero.titre }}</span>
          <span v-if="s.hero.sous" class="c-sous">{{ s.hero.sous }}</span>
          <span class="c-pieds">
            <span v-if="s.hero.etat === 'fait'" class="chip fait">Fait</span>
            <span v-for="m in s.hero.meta" :key="m" class="chip">{{ m }}</span>
            <span v-if="s.hero.etat === 'prevu'" class="chip">À faire</span>
          </span>
          <span class="c-go"><Icone :nom="bouclee ? 'coupe' : 'fleche'" /></span>
        </button>
      </div>

      <div class="grille">
        <!-- Cette semaine -->
        <button class="carte semaine c-semaine" data-teinte="surface" type="button" :aria-label="`Cette semaine : ${s.semaine.faits} sur ${s.semaine.total}`" @click="ouvrir('/programme', $event)">
          <span class="c-lab">Cette semaine</span>
          <span class="anneau-s">
            <svg viewBox="0 0 108 108" aria-hidden="true"><circle class="as-fond" cx="54" cy="54" r="48" /><circle ref="anneauEl" class="as-val" :class="{ plein: bouclee }" cx="54" cy="54" r="48" /></svg>
            <span class="as-txt"><b ref="compteurSemaine">{{ s.semaine.faits }}</b><i>/{{ s.semaine.total }}</i></span>
          </span>
          <span class="c-mini">{{ !s.semaine.total ? 'Aucun workout prévu' : bouclee ? 'Semaine bouclée !' : `${reste} ${reste > 1 ? 'séances' : 'séance'} à faire` }}</span>
        </button>

        <!-- Prochaine séance de coaching, ou invitation à écrire -->
        <button v-if="s.coaching" class="carte coaching c-coaching" data-teinte="inverse" type="button" aria-label="Prochaine séance de coaching" @click="ouvrir('/coaching', $event)">
          <span class="c-lab">Coaching</span>
          <span class="c-date"><b>{{ s.coaching.num }}</b><i>{{ s.coaching.moisCourt }}</i></span>
          <span class="c-mini">{{ s.coaching.jourNom }} · {{ s.coaching.heure }}<br>{{ s.coaching.lieu }}</span>
        </button>
        <a v-else class="carte coaching c-coaching vide" data-teinte="surface" :href="lienEcrire" target="_blank" rel="noopener">
          <span class="c-lab">Coaching</span>
          <span class="c-prog-t">Aucune séance prévue</span>
          <span class="c-mini">M'écrire <Icone nom="fleche" /></span>
        </a>

        <!-- Mon programme -->
        <button v-if="s.programme" class="carte prog c-programme" data-teinte="surface" type="button" aria-label="Mon programme" @click="ouvrir('/programme', $event)">
          <span class="c-lab">Mon programme</span>
          <span class="c-prog-t">{{ s.programme.nom }}</span>
          <span class="barres" aria-hidden="true"><i v-for="(on, k) in s.programme.segments" :key="k" :class="{ on }"></i></span>
        </button>
        <button v-else class="carte prog c-programme" data-teinte="surface" type="button" aria-label="Mon programme" @click="ouvrir('/programme', $event)">
          <span class="c-lab">Mon programme</span>
          <span class="c-prog-t">Pas encore de programme</span>
          <span class="c-mini">Votre coach le prépare</span>
        </button>

        <!-- Questionnaires : pastille seulement s'il y en a à remplir -->
        <button class="carte quest c-quest" data-teinte="surface" type="button" aria-label="Questionnaires" @click="ouvrir('/questionnaires', $event)">
          <span class="c-lab">Questionnaires</span>
          <span class="c-prog-t">{{ !s.sante ? 'Données de santé désactivées' : s.questionnaires ? 'À remplir · 2 min' : 'Tout est à jour' }}</span>
          <span v-if="s.questionnaires" class="pastille" :aria-label="`${s.questionnaires} à remplir`">{{ s.questionnaires }}</span>
        </button>
      </div>

      <!-- Accès développement (mode local seulement) : discret -->
      <nav v-if="dev" class="acces-dev" aria-label="Accès développement">
        <RouterLink to="/demo/seance">Séance démo</RouterLink><RouterLink to="/demo/circuits">Circuits</RouterLink><RouterLink to="/profil">Profil</RouterLink>
      </nav>
    </div>
  </main>
</template>
