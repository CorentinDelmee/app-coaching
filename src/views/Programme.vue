<script setup>
// Programme du client : calendrier en colonnes (semaine par défaut, bascule mois animée), workouts à placer / faits,
// jours fixés par le coach, historique des semaines. Règles dans domain/programme.js, libellés dans domain/calendrierUi.js.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import { data } from '../data/index.js'
import { ajouterJours, estJour, jourLocal, lundiDe } from '../domain/dates.js'
import { etatSemaine, historiqueSemaines } from '../domain/programme.js'
import { ajouterMois, colonnesSemaine, grilleMois, JOURS_COURTS, jourLong, libelleMois, libelleSemaine, lignesSemaine, messageSemaine, moisDeSemaine } from '../domain/calendrierUi.js'
import { lienWhatsApp, messageEcrire } from '../domain/coaching.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { installerRessort, mouvementReduit } from '../anim/transitions.js'
import { memoriserSource } from '../anim/passage.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const route = useRoute()
const router = useRouter()
const { racine, couche, ouvrir, partir, retour } = usePageAnimee('/')

// --- Données -------------------------------------------------------------------------------------------
const erreur = ref('')
const charge = ref(false)
const user = ref(null)
const programme = shallowRef(null)
const workouts = shallowRef([])
const realisations = shallowRef([])
const seancesCoaching = shallowRef([])
const aujourdhui = jourLocal(horloge.now())
const lundiCourant = lundiDe(aujourdhui)

// Semaine et vue affichées : gardées dans l'adresse (?semaine=…&vue=mois) pour les retrouver au retour d'un workout.
const lundiInitial = estJour(route.query.semaine) ? lundiDe(route.query.semaine) : lundiCourant
const lundi = ref(lundiInitial)
const vue = ref(route.query.vue === 'mois' ? 'mois' : 'semaine')
const mois = ref(moisDeSemaine(lundiInitial))

async function charger() {
  try {
    user.value = await utilisateurCourant()
    if (!user.value) { erreur.value = 'Connectez-vous pour voir votre programme.'; return }
    const [programmes, w, r, sc] = await Promise.all([
      data.programmes.lister({ clientId: user.value.id }), data.workouts.lister({ clientId: user.value.id }),
      data.realisations.lister({ clientId: user.value.id }), data.seancesCoaching.lister({ clientId: user.value.id })
    ])
    programme.value = programmes[0] || null
    workouts.value = w
    realisations.value = r
    seancesCoaching.value = sc
    charge.value = true
  } catch (e) {
    erreur.value = 'Impossible de charger votre programme. Réessayez.'
    console.error(e)
  }
}

// --- Dérivés -------------------------------------------------------------------------------------------
const etat = computed(() => (programme.value ? etatSemaine(programme.value, realisations.value, lundi.value, aujourdhui) : null))
const message = computed(() => messageSemaine(programme.value, etat.value || {}))
const lignes = computed(() => (etat.value && !message.value ? lignesSemaine(etat.value, workouts.value, aujourdhui) : []))
const colonnes = computed(() => (etat.value && !message.value ? colonnesSemaine(etat.value, lignes.value, aujourdhui) : []))
const aFaire = computed(() => lignes.value.filter((l) => l.statut !== 'fait'))
const faits = computed(() => lignes.value.filter((l) => l.statut === 'fait'))
const bouclee = computed(() => !!etat.value?.semaineBouclee)
const historique = computed(() => (programme.value ? historiqueSemaines(programme.value, realisations.value, aujourdhui).filter((s) => s.lundi !== lundiCourant) : []))
const grille = computed(() => grilleMois({
  mois: mois.value, programme: programme.value, realisations: realisations.value, seancesCoaching: seancesCoaching.value, aujourdhui, lundiAffiche: lundi.value
}))
const nomClient = computed(() => user.value?.nom || '')
const enCours = computed(() => lundi.value === lundiCourant)
const tagSemaine = computed(() => (message.value ? '' : enCours.value ? 'En cours' : lundi.value < lundiCourant ? 'Passée' : 'À venir'))
const titreSemaine = computed(() => (etat.value && etat.value.numero >= 1 && etat.value.statut !== 'termine' ? `Semaine ${etat.value.numero}` : 'Semaine'))
const nbSemaines = computed(() => {
  const p = programme.value
  return p ? (p.mode === 'parSemaine' ? p.semaines.length : p.nbSemaines || null) : null
})
const surTitre = computed(() => {
  const p = programme.value
  if (!p) return 'Pas encore de programme'
  const n = numeroCourant.value
  if (p.mode === 'repete') return n >= 1 ? `Mêmes workouts chaque semaine · semaine ${n}${nbSemaines.value ? ` sur ${nbSemaines.value}` : ''}` : 'Mêmes workouts chaque semaine'
  return n >= 1 && n <= nbSemaines.value ? `Un programme par semaine · semaine ${n} sur ${nbSemaines.value}` : 'Un programme par semaine'
})
const numeroCourant = computed(() => (programme.value ? etatSemaine(programme.value, realisations.value, lundiCourant, aujourdhui).numero : 0))
const lienEcrire = computed(() => lienWhatsApp('', messageEcrire(nomClient.value)))

const peutReculer = computed(() => !!programme.value && lundi.value > lundiDe(programme.value.debut))
const peutAvancer = computed(() => !!programme.value && etat.value?.statut !== 'termine' && lundi.value < ajouterJours(lundiCourant, 28))
const moisMin = computed(() => (programme.value ? lundiDe(programme.value.debut).slice(0, 7) : null))
const moisMax = computed(() => ajouterMois(moisDeSemaine(lundiCourant), 1))
const peutMoisAvant = computed(() => !!moisMin.value && mois.value > moisMin.value)
const peutMoisApres = computed(() => mois.value < moisMax.value)

function memoriserAdresse() {
  router.replace({ query: { ...route.query, semaine: lundi.value === lundiCourant ? undefined : lundi.value, vue: vue.value === 'mois' ? 'mois' : undefined } })
}

// --- Éléments animés -----------------------------------------------------------------------------------
const semaineEl = ref(null)
const moisEl = ref(null)
const curseurEl = ref(null)
const banniereEl = ref(null)
const coupeEl = ref(null)
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel))

onMounted(async () => {
  installerRessort()
  await charger()
  await nextTick()
  if (!charge.value) return
  // le calendrier mensuel est rendu mais caché : si la page s'ouvre déjà en mois, on le montre sans animation
  if (vue.value === 'mois') afficherMoisDirect()
  ouvrir()
  // petit pop du jour courant une fois la page ouverte
  if (!mouvementReduit()) {
    const chip = $$('.col.auj .chip-w', semaineEl.value)
    if (chip.length) gsap.fromTo(chip, { scale: 0.8 }, { scale: 1, duration: 1, delay: 0.9, ease: 'elastic.out(1,.5)', clearProps: 'transform' })
  }
  if (bouclee.value && vue.value === 'semaine') setTimeout(celebrer, 900)
})
onBeforeUnmount(() => gsap.killTweensOf([semaineEl.value, moisEl.value, curseurEl.value, banniereEl.value, coupeEl.value]))

// --- Changer de semaine --------------------------------------------------------------------------------
async function allerSemaine(nouveau, dir = 1) {
  if (nouveau === lundi.value) return
  lundi.value = nouveau
  memoriserAdresse()
  await nextTick()
  animerSemaine(dir)
}
function animerSemaine(dir) {
  const cibles = $$('[data-s]', semaineEl.value)
  if (!cibles.length) return
  if (mouvementReduit()) { gsap.fromTo(cibles, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: 'opacity' }); return }
  gsap.fromTo(cibles, { x: dir * 56, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity' })
  gsap.fromTo($$('.col', semaineEl.value), { scaleY: 0.9, transformOrigin: 'bottom' }, { scaleY: 1, duration: 0.8, stagger: 0.04, ease: 'expo.out', clearProps: 'transform' })
  if (bouclee.value) setTimeout(celebrer, 500)
}
const semainePrec = () => peutReculer.value && allerSemaine(ajouterJours(lundi.value, -7), -1)
const semaineSuiv = () => peutAvancer.value && allerSemaine(ajouterJours(lundi.value, 7), 1)
const aujourdhuiBtn = () => allerSemaine(lundiCourant, lundi.value > lundiCourant ? -1 : 1)

// --- Bascule semaine <-> mois : le sélecteur glisse, la semaine sort par le haut, le mois se révèle en clip-path ---
function placerBande() {
  const bande = moisEl.value.querySelector('.bande-semaine')
  const l = grille.value.ligneSemaine
  if (!bande) return
  if (l < 0) { bande.style.display = 'none'; return }
  const cel = $$('.cel', moisEl.value)[l * 7]
  bande.style.display = ''
  Object.assign(bande.style, { top: `${cel.offsetTop}px`, height: `${cel.offsetHeight}px` })
}
function afficherMoisDirect() {
  semaineEl.value.style.display = 'none'
  moisEl.value.style.display = 'block'
  gsap.set(curseurEl.value, { xPercent: 100 })
  placerBande()
}
function basculer(vers) {
  if (vers === vue.value) return
  const rapide = mouvementReduit()
  vue.value = vers
  memoriserAdresse()
  gsap.to(curseurEl.value, { xPercent: vers === 'mois' ? 100 : 0, duration: 0.6, ease: 'expo.out' })
  const vs = semaineEl.value
  const vm = moisEl.value
  if (vers === 'mois') {
    mois.value = moisDeSemaine(lundi.value)
    gsap.to(vs.children, {
      y: -24, opacity: 0, duration: rapide ? 0.15 : 0.3, stagger: 0.03, ease: 'power2.out',
      onComplete: async () => {
        vs.style.display = 'none'
        vm.style.display = 'block'
        await nextTick()
        placerBande()
        if (rapide) { gsap.fromTo(vm, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: 'opacity' }); return }
        animerMois(true)
      }
    })
  } else {
    gsap.to(vm, {
      y: -20, opacity: 0, duration: rapide ? 0.15 : 0.22, ease: 'power2.out',
      onComplete: () => {
        vm.style.display = 'none'
        gsap.set(vm, { clearProps: 'transform,opacity' })
        vs.style.display = ''
        if (rapide) { gsap.fromTo(vs.children, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: 'opacity' }); return }
        gsap.fromTo(vs.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.07, ease: 'expo.out', clearProps: 'transform,opacity' })
        gsap.fromTo($$('.col', vs), { scaleY: 0.85, transformOrigin: 'bottom' }, { scaleY: 1, duration: 0.8, stagger: 0.04, ease: 'expo.out', clearProps: 'transform' })
        if (bouclee.value) setTimeout(celebrer, 700)
      }
    })
  }
}
// `entree` : première apparition du mois (révélation complète) ; sinon simple glissement lors d'un changement de mois.
function animerMois(entree, dir = 1) {
  const vm = moisEl.value
  const cels = $$('.cel', vm)
  if (entree) {
    gsap.fromTo(vm, { clipPath: 'inset(0px 0px 100% 0px round 24px)' }, { clipPath: 'inset(0px 0px 0% 0px round 24px)', duration: 0.9, ease: 'expo.out', clearProps: 'clipPath' })
    gsap.fromTo(cels, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, stagger: { each: 0.014, from: 'start' }, ease: 'back.out(1.8)', clearProps: 'transform,opacity' })
    gsap.fromTo($$('.bande-semaine', vm), { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.9, delay: 0.35, ease: 'expo.out' })
    gsap.fromTo($$('.legende', vm), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, delay: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' })
  } else {
    gsap.fromTo(cels, { x: dir * 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, stagger: 0.01, ease: 'expo.out', clearProps: 'transform,opacity' })
  }
}
async function changerMois(n) {
  if ((n < 0 && !peutMoisAvant.value) || (n > 0 && !peutMoisApres.value)) return
  mois.value = ajouterMois(mois.value, n)
  await nextTick()
  placerBande()
  if (!mouvementReduit()) animerMois(false, n)
}
// Toucher un jour du mois : on revient à la semaine de ce jour.
async function choisirJour(c) {
  lundi.value = lundiDe(c.jour)
  basculer('semaine')
}

// --- Ouvrir un workout : la page naît de l'élément touché ---
function ouvrirWorkout(workoutId, el) {
  memoriserSource(el)
  partir()
  router.push({ name: 'workout', params: { workoutId }, query: { retour: route.fullPath } })
}

// --- Semaine bouclée : la bannière jaillit, des confettis partent de la coupe ---
const FORMES = ['c1', 'c2', 'c3']
function celebrer() {
  const b = banniereEl.value
  if (!b || !bouclee.value || vue.value !== 'semaine') return
  if (mouvementReduit()) { gsap.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 0.3 }); return }
  gsap.fromTo(b, { scale: 0.7, opacity: 0, y: 24 }, { scale: 1, opacity: 1, y: 0, duration: 1, ease: 'elastic.out(1,.55)', clearProps: 'transform,opacity' })
  gsap.fromTo(coupeEl.value, { rotate: -28, scale: 0.4 }, { rotate: 0, scale: 1, duration: 1.1, delay: 0.12, ease: 'elastic.out(1,.4)', clearProps: 'transform' })
  const n = 18
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span')
    c.className = `confetti ${FORMES[i % 3]}`
    b.appendChild(c)
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
    const d = 70 + Math.random() * 70
    gsap.fromTo(c, { x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }, {
      x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8 - 18, scale: 0.6 + Math.random() * 0.8, rotate: Math.random() * 360,
      duration: 1.1, ease: 'expo.out',
      onComplete: () => gsap.to(c, { opacity: 0, y: '+=26', duration: 0.5, ease: 'power1.in', onComplete: () => c.remove() })
    })
  }
}
const aller = (id, e) => ouvrirWorkout(id, e.currentTarget)
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <div v-if="erreur" class="ecran-vide">
      <p>{{ erreur }}</p>
      <button class="gros" type="button" @click="router.replace('/')">Retour</button>
    </div>

    <section v-else-if="charge" ref="couche" class="page" hidden aria-label="Programme">
      <div class="voile"></div>
      <div class="defile defile-prog">
        <div class="p-top" data-c>
          <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
          <span class="sur-titre">Programme</span>
        </div>
        <div class="p-entete" data-c>
          <p class="sur-titre">{{ surTitre }}</p>
          <h1 class="titre-page">Programme<br>{{ nomClient }}</h1>
        </div>

        <!-- Aucun programme : état vide visible, avec un mot au coach -->
        <div v-if="!programme" class="vide-prog" data-c>
          <Icone nom="liste" />
          <h2>Pas encore de programme</h2>
          <p>Votre coach prépare votre programme. Écrivez-lui pour qu'il le prépare plus vite.</p>
          <a class="gros" :href="lienEcrire" target="_blank" rel="noopener">Écrire à Corentin</a>
        </div>

        <template v-else>
          <div class="bascule" data-c role="group" aria-label="Affichage">
            <span ref="curseurEl" class="curseur"></span>
            <button type="button" :aria-pressed="vue === 'semaine'" @click="basculer('semaine')">Semaine</button>
            <button type="button" :aria-pressed="vue === 'mois'" @click="basculer('mois')">Mois</button>
          </div>

          <div class="vues" data-c>
            <!-- ================= SEMAINE ================= -->
            <div ref="semaineEl" class="vue-semaine">
              <div class="nav-sem" data-s>
                <button class="rond petit" type="button" aria-label="Semaine précédente" :disabled="!peutReculer" @click="semainePrec"><Icone nom="gauche" /></button>
                <div class="nav-titre">
                  <b>{{ titreSemaine }} · {{ libelleSemaine(lundi) }}</b>
                  <span v-if="tagSemaine" class="tag-cours" :class="{ calme: !enCours }">{{ tagSemaine }}</span>
                </div>
                <button class="rond petit" type="button" aria-label="Semaine suivante" :disabled="!peutAvancer" @click="semaineSuiv"><Icone nom="droite" /></button>
              </div>
              <button v-if="!enCours" class="retour-auj" type="button" data-s @click="aujourdhuiBtn">Revenir à cette semaine</button>

              <!-- Cas limites : pas de programme cette semaine / programme terminé -->
              <div v-if="message" class="vide-prog" data-s>
                <Icone :nom="message.termine ? 'coupe' : 'liste'" />
                <h2>{{ message.termine ? 'Programme terminé — votre coach prépare la suite' : message.titre }}</h2>
                <p v-if="!message.termine">{{ message.texte }}</p>
                <a v-else class="gros doux" :href="lienEcrire" target="_blank" rel="noopener">Écrire à Corentin</a>
              </div>

              <template v-else>
                <div class="cols" data-s>
                  <div v-for="c in colonnes" :key="c.jour" class="col" :class="{ auj: c.auj }" :aria-label="jourLong(c.jour)">
                    <span class="j">{{ c.nom }}</span>
                    <span class="d">{{ c.numero }}</span>
                    <button v-for="p in c.puces" :key="p.workoutId" type="button" class="chip-w" :class="p.statut === 'fait' ? 'fait' : c.auj ? 'prevu' : 'coach'"
                      :aria-label="`${p.code} ${p.statut === 'fait' ? 'fait' : 'prévu'} ${jourLong(c.jour)}`" @click="aller(p.workoutId, $event)">
                      <span v-if="p.statut === 'fait'"><Icone nom="coche" /></span><span v-else></span>
                      <span>{{ p.code }}</span>
                      <small>{{ p.mention }}</small>
                    </button>
                    <span v-if="!c.puces.length" class="vide"></span>
                  </div>
                </div>

                <!-- Semaine bouclée : célébration -->
                <div v-if="bouclee" ref="banniereEl" class="boucle" data-s>
                  <span ref="coupeEl" class="boucle-coupe"><Icone nom="coupe" /></span>
                  <div><b>Semaine bouclée</b><span>{{ etat.total }} workouts sur {{ etat.total }}. Beau travail.</span></div>
                </div>

                <div v-if="aFaire.length" class="a-faire" data-s>
                  <h3>À faire cette semaine</h3>
                  <button v-for="(l, i) in aFaire" :key="l.workoutId" type="button" class="ligne-w cliquable" :class="{ 'en-avant': enCours && i === 0 }" @click="aller(l.workoutId, $event)">
                    <span class="wn">{{ l.code }}</span>
                    <span class="wt">{{ l.titre }}<small>{{ l.sous ? `${l.sous} · ` : '' }}{{ l.texte }}</small></span>
                    <span class="fl"><Icone nom="fleche" /></span>
                  </button>
                </div>

                <div v-if="faits.length" class="a-faire" data-s>
                  <h3>Fait</h3>
                  <button v-for="l in faits" :key="l.workoutId" type="button" class="ligne-w cliquable fait" @click="aller(l.workoutId, $event)">
                    <span class="wn"><Icone nom="coche" /></span>
                    <span class="wt">{{ l.titre }}<small>{{ l.sous ? `${l.sous} · ` : '' }}{{ l.texte }}</small></span>
                    <span class="etat">{{ l.code }}</span>
                  </button>
                </div>
              </template>

              <!-- Historique des semaines passées -->
              <div v-if="historique.length" class="a-faire histo" data-s>
                <h3>Historique</h3>
                <button v-for="s in historique" :key="s.lundi" type="button" class="ligne-w cliquable hist" :class="{ choisie: s.lundi === lundi }" @click="allerSemaine(s.lundi, -1)">
                  <span class="wn">S{{ s.numero }}</span>
                  <span class="wt">Semaine {{ s.numero }}<small>{{ libelleSemaine(s.lundi) }}</small></span>
                  <span class="etat" :class="{ ok: s.semaineBouclee }"><Icone v-if="s.semaineBouclee" nom="coche" />{{ s.libelle }}</span>
                </button>
              </div>
            </div>

            <!-- ================= MOIS ================= -->
            <div ref="moisEl" class="vue-mois">
              <div class="nav-sem">
                <button class="rond petit" type="button" aria-label="Mois précédent" :disabled="!peutMoisAvant" @click="changerMois(-1)"><Icone nom="gauche" /></button>
                <div class="nav-titre"><b class="mois-nom">{{ libelleMois(mois) }}</b></div>
                <button class="rond petit" type="button" aria-label="Mois suivant" :disabled="!peutMoisApres" @click="changerMois(1)"><Icone nom="droite" /></button>
              </div>
              <div class="mois-grille">
                <div class="bande-semaine"></div>
                <div v-for="j in JOURS_COURTS" :key="j" class="mois-j">{{ j[0] }}</div>
                <template v-for="ligne in grille.lignes" :key="ligne[0].jour">
                  <button v-for="c in ligne" :key="c.jour" type="button" class="cel" :class="{ hors: c.horsMois, auj: c.auj }" :aria-label="jourLong(c.jour)" @click="choisirJour(c)">
                    <span>{{ c.numero }}</span>
                    <span class="pts"><i v-for="p in c.points" :key="p" class="pt" :class="p"></i><i v-if="!c.points.length" class="pt rien"></i></span>
                  </button>
                </template>
              </div>
              <div class="legende"><span><i class="pt fait"></i>Fait</span><span><i class="pt prevu"></i>Prévu</span><span><i class="pt coach"></i>Coaching</span></div>
            </div>
          </div>
        </template>
      </div>
    </section>
  </main>
</template>
