<script setup>
// Page Coaching : prochaine séance (jour, heure, lieu), Modifier / Annuler via WhatsApp pré-rempli (avertissement à moins de 24 h),
// mot du coach, rang dans le mois, compteurs semaine/mois, payé ce mois. La page naît de la carte du dashboard (élément partagé).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import FeuilleBas from '../components/seance/FeuilleBas.vue'
import { data } from '../data/index.js'
import {
  formaterHeure, messageAnnuler, messageEcrire, messageModifier, moinsDe24h, nbSeancesMois, nbSeancesSemaine, payeCeMois, phraseRang,
  prochaineSeance, rangDansLeMois, libelleSeance
} from '../domain/coaching.js'
import { jourLong, libelleMois } from '../domain/calendrierUi.js'
import { jourLocal } from '../domain/dates.js'
import { formaterNombre, ordinalFeminin } from '../domain/format.js'
import { lienCoach } from '../lib/coach.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { compter, mouvementReduit } from '../anim/transitions.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const { racine, couche, ouvrir, retour } = usePageAnimee('/')

const MOT_PAR_DEFAUT = 'Belle semaine à vous ! Je suis là si vous avez la moindre question, écrivez-moi quand vous voulez.'

const erreur = ref('')
const charge = ref(false)
const user = ref(null)
const seances = shallowRef([])
const mot = ref('')
const now = horloge.now()

onMounted(async () => {
  try {
    user.value = await utilisateurCourant()
    if (!user.value) { erreur.value = 'Connectez-vous pour voir votre coaching.'; return }
    const [s, mots] = await Promise.all([data.seancesCoaching.lister({ clientId: user.value.id }), data.motsDuCoach.lister({ clientId: user.value.id })])
    seances.value = s
    mot.value = [...mots].sort((a, b) => b.date.localeCompare(a.date))[0]?.texte || ''
    charge.value = true
  } catch (e) {
    erreur.value = 'Impossible de charger votre coaching. Réessayez.'
    console.error(e)
    return
  }
  await nextTick()
  const tl = ouvrir()
  compteurs(tl ? 0.35 : 0)
})
onBeforeUnmount(() => gsap.killTweensOf('[data-compteur]'))

// --- Dérivés -----------------------------------------------------------------------------------------
const prochaine = computed(() => prochaineSeance(seances.value, now))
const rang = computed(() => (prochaine.value ? rangDansLeMois(seances.value, prochaine.value) : null))
const nbSemaine = computed(() => nbSeancesSemaine(seances.value, now))
const nbMois = computed(() => nbSeancesMois(seances.value, now))
const paye = computed(() => payeCeMois(seances.value, now))
const tarifUnique = computed(() => {
  const faites = seances.value.filter((s) => s.statut === 'faite' && s.date.slice(0, 7) === jourLocal(now).slice(0, 7))
  const t = [...new Set(faites.map((s) => s.tarif))]
  return t.length === 1 ? t[0] : null
})
const moisLabel = computed(() => libelleMois(jourLocal(now).slice(0, 7)))
const bientot = computed(() => !!prochaine.value && moinsDe24h(prochaine.value, now))
const motAffiche = computed(() => mot.value || MOT_PAR_DEFAUT)
// « Mardi 27 » / « octobre » : le jour et son numéro sur la 1re ligne, le mois sur la 2e (maquette V2)
const jourGrand = computed(() => { const [jour, num, ...mois] = jourLong(prochaine.value.date).split(' '); return [`${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${num}`, mois.join(' ')] })
const lieu = computed(() => (prochaine.value.lieu === 'domicile' ? 'à domicile' : 'en salle'))
const nom = computed(() => user.value?.nom || '')
const lienModifier = computed(() => lienCoach(messageModifier(prochaine.value, nom.value)))
const lienAnnuler = computed(() => lienCoach(messageAnnuler(prochaine.value, nom.value)))
const lienMot = computed(() => lienCoach(`Bonjour Corentin, c'est ${nom.value}. `))
const lienEcrire = computed(() => lienCoach(messageEcrire(nom.value)))

// --- Avertissement < 24 h : une feuille demande confirmation avant d'ouvrir WhatsApp ---
const avertir = ref(false)
const lienEnAttente = ref('')
function surAction(e, lien) {
  if (!bientot.value) return // plus de 24 h : le lien s'ouvre normalement
  e.preventDefault()
  lienEnAttente.value = lien
  avertir.value = true
}
function continuer() {
  avertir.value = false
  window.open(lienEnAttente.value, '_blank', 'noopener')
}

// --- Compteurs : défilent puis décélèrent ---
function compteurs(delai) {
  const els = (sel) => document.querySelector(sel)
  if (rang.value) compter(els('[data-compteur="rang"]'), 0, rang.value, { duree: 1.2, delay: delai })
  compter(els('[data-compteur="semaine"]'), 0, nbSemaine.value, { duree: 1.2, delay: delai + 0.05 })
  compter(els('[data-compteur="mois"]'), 0, nbMois.value, { duree: 1.2, delay: delai + 0.1 })
  const total = els('[data-compteur="total"]')
  compter(total, 0, paye.value.total, { duree: 1.5, delay: delai + 0.2, fmt: (v) => formaterNombre(Math.round(v * 100) / 100) })
  if (mouvementReduit()) return
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <div v-if="erreur" class="ecran-vide">
      <p>{{ erreur }}</p>
      <button class="gros" type="button" @click="retour">Retour</button>
    </div>

    <template v-else-if="charge">
      <section ref="couche" class="page" hidden aria-label="Coaching">
        <div class="voile"></div>
        <div class="defile defile-prog">
          <!-- En-tête inversé (maquette V2) : la séance en grand ; sans séance, simple titre -->
          <header class="page-haut" data-teinte="inverse">
            <div class="p-top avec-menu" data-c>
              <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
              <span class="sur-titre">{{ prochaine ? 'Votre séance' : 'Coaching' }}</span>
            </div>
            <template v-if="prochaine">
              <h1 class="page-titre grand" data-c :aria-label="`Votre séance : ${libelleSeance(prochaine)}`">{{ jourGrand[0] }}<br>{{ jourGrand[1] }}</h1>
              <p class="page-sous grand" data-c>{{ formaterHeure(prochaine.heure) }} · {{ lieu }}</p>
            </template>
            <h1 v-else class="page-titre" data-c>Pas de séance<br>prévue</h1>
          </header>

          <div class="page-corps">
            <!-- Aucune séance : même carte que sur le dashboard -->
            <a v-if="!prochaine" class="carte-vide" :href="lienEcrire" target="_blank" rel="noopener" data-c>
              <span class="cv-t">Aucune séance prévue</span>
              <span class="cv-s">M'écrire pour en planifier une <Icone nom="fleche" /></span>
            </a>

            <template v-else>
              <div class="co-actions" data-c>
                <a class="gros doux" :href="lienModifier" target="_blank" rel="noopener" @click="surAction($event, lienModifier)">Modifier</a>
                <a class="gros doux" :href="lienAnnuler" target="_blank" rel="noopener" @click="surAction($event, lienAnnuler)">Annuler</a>
              </div>
              <p class="co-regle" :class="{ alerte: bientot }" data-c>
                <Icone v-if="!bientot" nom="horloge" />
                <span v-else class="co-alerte" aria-hidden="true">!</span>
                <span v-if="!bientot">Annulation gratuite jusqu'à 24 h avant la séance. On en parle sur WhatsApp.</span>
                <span v-else><b>Moins de 24 h avant la séance :</b> l'annulation gratuite n'est plus possible.</span>
              </p>
            </template>

            <div class="mot-coach" data-c>
              <span class="mot-av" aria-hidden="true">C</span>
              <p class="mot-t">« {{ motAffiche }} »</p>
              <a class="gros contour" :href="lienMot" target="_blank" rel="noopener">M'envoyer un mot</a>
            </div>

            <div class="duo" data-c>
              <div v-if="prochaine && rang" class="stat">
                <b class="stat-n"><span data-compteur="rang">{{ rang }}</span><sup>{{ ordinalFeminin(rang).replace(/^\d+/, '') }}</sup></b>
                <span>{{ phraseRang(rang) }}</span>
              </div>
              <div class="stat stat-accent">
                <b class="stat-n"><span data-compteur="total">{{ formaterNombre(paye.total) }}</span>&nbsp;€</b>
                <span>Payé ce mois<template v-if="paye.nb && tarifUnique !== null"> : {{ paye.nb }} × {{ formaterNombre(tarifUnique) }} €</template></span>
              </div>
            </div>

            <div class="duo" data-c>
              <div class="stat"><b class="stat-n"><span data-compteur="semaine">{{ nbSemaine }}</span></b><span>{{ nbSemaine > 1 ? 'séances' : 'séance' }} cette semaine</span></div>
              <div class="stat"><b class="stat-n"><span data-compteur="mois">{{ nbMois }}</span></b><span>{{ nbMois > 1 ? 'séances' : 'séance' }} en {{ moisLabel.split(' ')[0] }}</span></div>
            </div>
          </div>
        </div>
      </section>

      <FeuilleBas :ouverte="avertir" titre="Séance proche" @fermer="avertir = false">
        <p>Moins de 24 h avant la séance : elle pourra être due. Continuer ?</p>
        <button class="gros" type="button" @click="continuer">Continuer sur WhatsApp</button>
        <button class="gros doux" type="button" @click="avertir = false">Retour</button>
      </FeuilleBas>
    </template>
  </main>
</template>
