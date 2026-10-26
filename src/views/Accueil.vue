<script setup>
// Tableau de bord (accueil client) — aligné sur la maquette M5 « Profondeur » (design/m5 : index.html #e-dash, ecrans.js PAGES['e-dash']).
// Tout tient sans défiler à 390×844 : décor (grand chiffre du jour + halos), en-tête (menu à gauche), message d'accueil, cinq cartes
// sur trois couches de profondeur. Chaque carte se soulève puis ouvre sa page (« élément partagé », carte -> page), une copie du
// tableau de bord restant visible derrière et reculant (scale .92). Parallaxe à la souris (jamais au toucher). Texte du message : V2.
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
import { basculerMenu, etatMenu } from '../lib/menu.js'
import { utilisateurCourant } from '../lib/session.js'
import { compter, fermerPage, mouvementReduit } from '../anim/transitions.js'
import { anneau, animerAnneau } from '../anim/titres.js'
import { M5 } from '../anim/constantes.js'
import { consommerFinSeance, consommerRetour, memoriserSource, poserDessous, retirerDessous } from '../anim/passage.js'

gsap.registerPlugin(SplitText)
const router = useRouter()
const racine = ref(null)
const erreur = ref('')
const user = ref(null)
const s = shallowRef(null)
const anneauEl = ref(null)
const compteurSemaine = ref(null)
const salutEl = ref(null)
const salutP = ref(null)
const celebration = ref(null)
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
const fantome = computed(() => { const n = s.value?.hero.titre.match(/(\d+)\s*$/); return n ? `W${n[1]}` : '' }) // « W2 » détouré de la carte du jour
const numeroJour = new Date(horloge.now()).getDate() // grand chiffre détouré du décor (M5 : « 20 »)
const dateCourte = computed(() => (s.value ? s.value.jour.charAt(0).toLowerCase() + s.value.jour.slice(1) : ''))
// barres du programme (M5) : semaines passées en accent, la semaine en cours en couleur du texte
const courante = computed(() => (s.value?.programme ? s.value.programme.segments.lastIndexOf(true) : -1))

// Message d'accueil (variante choisie dans src/config/apparence.js), posé dans la structure M5 : la première ligne en petit
// au-dessus (M5 : « Bonjour »), la suite en grand (M5 : « Fabien. »). Une phrase longue (variante « semaine ») reste seule en grand.
// Le titre est posé à la main (SplitText découpe ses lettres) : d'où cette fonction, qui défait la découpe précédente.
function poserMessage(msg) {
  if (decoupe) { decoupe.revert(); decoupe = null }
  const h = salutEl.value
  const deux = msg.lignes.length > 1
  salutP.value.textContent = deux ? msg.lignes[0] : ''
  h.textContent = ''
  const grandes = deux ? msg.lignes.slice(1) : msg.lignes
  grandes.forEach((l, i) => { if (i) h.appendChild(document.createElement('br')); h.appendChild(document.createTextNode(l)) })
  h.classList.toggle('long', msg.long)
  // M5 n'a que « Fabien. » (7 signes) à côté de la date : plus long, le titre prend toute la largeur (la date passe dessous),
  // au-delà de 10 signes il rapetisse un peu ; jamais de mot coupé.
  const n = Math.max(...grandes.map((l) => l.length))
  h.classList.toggle('etroit', !msg.long && n > 7)
  h.classList.toggle('moyen', !msg.long && n > 10)
}
const messageActuel = () => messageAccueil({ variante: CHOIX.accueil, prenom: s.value.prenom, etat: s.value.hero.etat, reste: reste.value })
function animerMessage(delai = 0) {
  const h = salutEl.value
  if (mouvementReduit()) { gsap.fromTo(h, { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' }); return }
  decoupe = SplitText.create(h, { type: 'words,chars', wordsClass: 'mot-s', charsClass: 'car' })
  gsap.fromTo(decoupe.chars, { opacity: 0, z: -360, y: 70, rotationX: -80 }, { opacity: 1, z: 0, y: 0, rotationX: 0, duration: 1.1, stagger: 0.055, ease: M5.E.sortie, delay: delai, clearProps: 'transform,opacity' })
}

// --- Entrée (M5, PAGES['e-dash'].entrer) : décor depuis la profondeur, en-tête, message lettre à lettre en 3D, cartes sur 3 couches
// (data-couche : 1 = loin, 3 = près : distances et durées différentes), anneau + compteur, pastille. transform / opacity seulement. ---
let pret = false // la parallaxe attend la fin de l'entrée (M5 : dash.pret)
function entree() {
  const r = racine.value
  const cartes = Array.from(r.querySelectorAll('.grille .carte'))
  const q = (sel) => r.querySelectorAll(sel)
  anneau(anneauEl.value, 0)
  poserMessage(messageActuel())
  pret = false
  if (mouvementReduit()) {
    gsap.fromTo([r.querySelector('.haut'), r.querySelector('.salut'), ...cartes], { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0, clearProps: 'opacity' })
    anneau(anneauEl.value, fraction.value)
    pret = true
    return
  }
  const tl = gsap.timeline({ onComplete: () => { pret = true } })
  tl.fromTo(q('.deco-n'), { opacity: 0, y: 90, z: -400 }, { opacity: 1, y: 0, z: 0, duration: 1.8, ease: M5.E.sortie }, 0)
    .fromTo(q('.deco-o1, .deco-o2'), { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 2, ease: M5.E.sortie }, 0)
    .fromTo(q('.haut'), { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: 0.8, ease: M5.E.sortie, clearProps: 'transform,opacity' }, 0.05)
    .fromTo(q('.salut-p, .salut-date'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: M5.E.sortie, clearProps: 'transform,opacity' }, 0.1)
    .add(() => animerMessage(0), 0.08)
  cartes.forEach((c, i) => {
    const k = +c.dataset.couche || 1
    tl.fromTo(c, { opacity: 0, z: -200 - k * 80, y: 60 + k * 36, rotationX: 18, rotationY: 0 },
      { opacity: 1, z: 0, y: 0, rotationX: 0, duration: 0.85 + k * 0.14, ease: M5.E.sortie, clearProps: 'opacity' }, 0.12 + i * 0.08)
  })
  // l'anneau se remplit et le chiffre compte (M5 : à 0,5 s)
  animerAnneau(anneauEl.value, 0, fraction.value, { duree: 1.4, delay: 0.5 })
  tl.add(() => compter(compteurSemaine.value, 0, s.value.semaine.faits, { duree: 1.1, ease: 'expo.out' }), 0.5) // M5 : le chiffre final reste affiché jusqu'au départ du compteur
  const pastille = r.querySelector('.pastille')
  if (pastille) tl.fromTo(pastille, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: M5.E.ressort, clearProps: 'transform,opacity' }, 1.1)
  if (bouclee.value) setTimeout(feter, 1100)
}

// --- Parallaxe douce à la souris (M5) : les cartes s'inclinent selon leur couche, le décor glisse en sens inverse. Jamais au toucher. ---
let tilts = null
let decor = null
function survol(e) {
  if (!pret || occupe || e.pointerType === 'touch' || mouvementReduit() || document.documentElement.classList.contains('menu-ouvert')) return
  const page = racine.value?.querySelector('.accueil')
  if (!page) return
  const r = page.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width - 0.5
  const py = (e.clientY - r.top) / r.height - 0.5
  if (!tilts) {
    tilts = Array.from(page.querySelectorAll('.carte')).map((c) => ({ qy: gsap.quickTo(c, 'rotationY', { duration: 0.6, ease: 'power3.out' }), qx: gsap.quickTo(c, 'rotationX', { duration: 0.6, ease: 'power3.out' }), k: +c.dataset.couche || 1 }))
    decor = Array.from(page.querySelectorAll('.deco [data-depth]')).map((el) => ({ qx: gsap.quickTo(el, 'x', { duration: 1, ease: 'power3.out' }), qy: gsap.quickTo(el, 'y', { duration: 1, ease: 'power3.out' }), k: +el.dataset.depth }))
  }
  tilts.forEach((t) => { t.qy(px * 7 * (1 + t.k * 0.3)); t.qx(-py * 6 * (1 + t.k * 0.3)) })
  decor.forEach((t) => { t.qx(-px * 26 * t.k); t.qy(-py * 22 * t.k) })
}
function sortieSurvol() {
  if (!tilts) return
  tilts.forEach((t) => { t.qy(0); t.qx(0) }); decor.forEach((t) => { t.qx(0); t.qy(0) })
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
  compter(compteurSemaine.value, avant, faits, { duree: 1, ease: 'expo.out' })
  if (mouvementReduit()) return
  // M5 apresSeance : la carte « Cette semaine » se soulève une fois (aller-retour) pendant que l'anneau gagne la séance
  gsap.fromTo(racine.value.querySelector('.c-semaine'), { scale: 1 }, { scale: 1.06, z: 40, duration: 0.35, yoyo: true, repeat: 1, ease: 'power2.out', delay: 0.1 })
  gsap.fromTo('.c-aujourdhui .c-lab, .c-aujourdhui .c-titre, .c-aujourdhui .c-sous, .c-aujourdhui .c-pieds', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: M5.E.sortie, clearProps: 'transform,opacity' })
  if (bouclee.value) setTimeout(feter, 700)
}

onMounted(async () => {
  const fin = consommerFinSeance()
  const couverture = fin ? poserCouverture(fin) : null
  await charger()
  await nextTick()
  retirerDessous() // copie du tableau de bord laissée derrière une page refermée : le vrai est prêt
  if (!s.value) { couverture?.remove(); return }
  anneau(anneauEl.value, fraction.value)
  if (couverture) { consommerRetour(); pret = true; retourDeSeance(couverture, fin); return }
  if (consommerRetour()) { poserMessage(messageActuel()); pret = true; return } // retour d'une page refermée dans sa carte : montré tel quel
  entree()
})
onBeforeUnmount(() => { if (decoupe) decoupe.revert() })

// --- Ouvrir une page (M5 ouvrirCarte) : la carte se soulève (z 70, scale 1.04, ombre --lev) pendant 0,2 s, puis la page naît
// d'elle ; une copie du tableau de bord reste derrière et recule (scale .92), puis se rapproche au retour. ---
let occupe = false
function ouvrir(chemin, e) {
  const carte = e.currentTarget
  if (occupe || !carte) return
  occupe = true
  const partir = () => {
    memoriserSource(carte)
    poserDessous(racine.value)
    router.push(chemin).then((echec) => {
      if (!echec) return // navigation refusée (garde) : la carte se repose, le tableau de bord reste utilisable
      occupe = false
      retirerDessous()
      gsap.to(carte, { '--lev': 0, z: 0, scale: 1, duration: 0.5, ease: M5.E.sortie, clearProps: 'willChange' })
    })
  }
  if (mouvementReduit()) { partir(); return }
  sortieSurvol()
  gsap.set(carte, { willChange: 'transform' })
  gsap.to(carte, { '--lev': 1, z: 70, scale: 1.04, duration: M5.T.lever, ease: 'power2.out' })
  gsap.delayedCall(M5.T.avantPage, partir)
}
const versHero = (e) => {
  const h = s.value.hero
  ouvrir(h.workoutId && h.etat !== 'bouclee' ? { name: 'workout', params: { workoutId: h.workoutId }, query: { retour: '/' } } : '/programme', e)
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine @pointermove="survol" @pointerleave="sortieSurvol">
    <div v-if="erreur" class="ecran-vide">
      <p>{{ erreur }}</p>
    </div>

    <div v-else-if="s" class="accueil" data-teinte="surface">
      <!-- Décor (M5) : grand chiffre du jour détouré + deux halos d'accent ; glisse en sens inverse de la souris -->
      <div class="deco" aria-hidden="true">
        <span class="deco-n" data-depth="0.5">{{ numeroJour }}</span>
        <i class="deco-o1" data-depth="1"></i>
        <i class="deco-o2" data-depth="1.6"></i>
      </div>
      <header class="haut" data-couche="2">
        <!-- Bouton du menu (M5 : dans la page, à gauche) : il recule avec elle et devient une croix. Le menu lui-même : MenuApp. -->
        <button class="btn-nav" data-nav type="button" :aria-label="etatMenu.ouvert ? 'Fermer le menu' : 'Ouvrir le menu'" :aria-expanded="etatMenu.ouvert" aria-controls="menu-app" @click="basculerMenu"><span class="burger"><i></i><i></i></span></button>
        <span class="haut-info">{{ semaineInfo }}</span>
      </header>
      <div class="salut" data-couche="1">
        <p ref="salutP" class="salut-p"></p>
        <h1 ref="salutEl" class="salut-h" aria-live="polite"></h1>
        <p class="salut-date">{{ dateCourte }}</p>
      </div>

      <div class="grille">
        <!-- Aujourd'hui : carte d'accent sur toute la largeur, « W2 » détouré, flèche ronde inversée -->
        <button ref="celebration" class="carte c-aujourdhui" data-teinte="accent" data-couche="3" :class="{ fait: s.hero.etat === 'fait' || s.hero.etat === 'bouclee' }" type="button"
          :aria-label="`${s.hero.etiquette} : ${s.hero.titre}. ${s.hero.sous}`" @click="versHero">
          <span v-if="fantome" class="ghost" aria-hidden="true">{{ fantome }}</span>
          <span class="c-lab">{{ s.hero.etiquette }}</span>
          <span class="c-titre">{{ s.hero.titre }}</span>
          <span v-if="s.hero.sous" class="c-sous">{{ s.hero.sous }}</span>
          <span class="c-pieds">
            <span v-for="m in s.hero.meta" :key="m" class="chip">{{ m }}</span>
            <span v-if="s.hero.etat === 'fait'" class="chip fait">Fait</span>
            <span v-if="s.hero.etat === 'prevu'" class="chip">À faire</span>
          </span>
          <span class="c-go"><Icone :nom="bouclee ? 'coupe' : 'fleche'" /></span>
        </button>

        <!-- Cette semaine -->
        <button class="carte semaine c-semaine" data-teinte="surface" data-couche="2" type="button" :aria-label="`Cette semaine : ${s.semaine.faits} sur ${s.semaine.total}`" @click="ouvrir('/programme', $event)">
          <span class="c-lab">Cette semaine</span>
          <span class="anneau-s">
            <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="as-fond" cx="60" cy="60" r="50" /><circle ref="anneauEl" class="as-val" :class="{ plein: bouclee }" cx="60" cy="60" r="50" transform="rotate(-90 60 60)" /></svg>
            <span class="as-txt"><b ref="compteurSemaine">{{ s.semaine.faits }}</b><i>/{{ s.semaine.total }}</i></span>
          </span>
          <span class="c-mini">{{ !s.semaine.total ? 'Aucun workout prévu' : bouclee ? 'Semaine bouclée !' : `${reste} ${reste > 1 ? 'séances' : 'séance'} à faire` }}</span>
        </button>

        <!-- Prochaine séance de coaching (teinte inverse), ou invitation à écrire -->
        <button v-if="s.coaching" class="carte coaching c-coaching" data-teinte="inverse" data-couche="2" type="button" aria-label="Prochaine séance de coaching" @click="ouvrir('/coaching', $event)">
          <span class="c-lab">Coaching</span>
          <span class="c-date"><b>{{ s.coaching.num }}</b><i>{{ s.coaching.moisCourt }}</i></span>
          <span class="c-mini">{{ s.coaching.jourNom }} · {{ s.coaching.heure }}<br>{{ s.coaching.lieu }}</span>
        </button>
        <a v-else class="carte coaching c-coaching vide" data-teinte="surface" data-couche="2" :href="lienEcrire" target="_blank" rel="noopener">
          <span class="c-lab">Coaching</span>
          <span class="c-prog-t">Aucune séance prévue</span>
          <span class="c-mini">M'écrire <Icone nom="fleche" /></span>
        </a>

        <!-- Mon programme : barres des semaines (passées en accent, en cours en couleur du texte) -->
        <button class="carte prog c-programme" data-teinte="surface" data-couche="1" type="button" aria-label="Mon programme" @click="ouvrir('/programme', $event)">
          <span class="c-lab">Mon programme</span>
          <template v-if="s.programme">
            <span class="c-prog-t">{{ s.programme.nom }}</span>
            <span class="barres" aria-hidden="true"><i v-for="(on, k) in s.programme.segments" :key="k" :class="{ on, cur: k === courante }"></i></span>
          </template>
          <template v-else>
            <span class="c-prog-t">Pas encore de programme</span>
            <span class="c-mini">Votre coach le prépare</span>
          </template>
        </button>

        <!-- Questionnaires : pastille seulement s'il y en a à remplir -->
        <button class="carte quest c-quest" data-teinte="surface" data-couche="1" type="button" aria-label="Questionnaires" @click="ouvrir('/questionnaires', $event)">
          <span class="c-lab">Questionnaires</span>
          <span class="c-prog-t">{{ !s.sante ? 'Données de santé désactivées' : s.questionnaires ? 'À remplir · 2 min' : 'Tout est à jour' }}</span>
          <span v-if="s.questionnaires" class="pastille" :aria-label="`${s.questionnaires} à remplir`">{{ s.questionnaires }}</span>
        </button>
      </div>

      <!-- Accès développement (mode local seulement, hors maquette) : liens discrets superposés en bas, ne prennent pas de place -->
      <nav v-if="dev" class="acces-dev" aria-label="Accès développement">
        <RouterLink to="/demo/seance">Séance démo</RouterLink><RouterLink to="/demo/circuits">Circuits</RouterLink>
      </nav>
    </div>
  </main>
</template>
