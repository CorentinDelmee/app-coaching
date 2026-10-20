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
import { compter, installerRessort, mouvementReduit } from '../anim/transitions.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const { racine, couche, ouvrir, retour } = usePageAnimee('/')

const MOT_PAR_DEFAUT = 'Belle semaine à toi ! Je suis là si tu as la moindre question, écris-moi quand tu veux.'

const erreur = ref('')
const charge = ref(false)
const user = ref(null)
const seances = shallowRef([])
const mot = ref('')
const now = horloge.now()

onMounted(async () => {
  installerRessort()
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
const jourGrand = computed(() => { const j = jourLong(prochaine.value.date); return j.charAt(0).toUpperCase() + j.slice(1) })
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
  if (prochaine.value) gsap.fromTo('.co-grand em', { scale: 0.9 }, { scale: 1, duration: 1, delay: delai + 0.5, ease: 'elastic.out(1,.5)', clearProps: 'transform' })
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
          <div class="p-top avec-menu" data-c>
            <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
            <span class="sur-titre">Coaching</span>
          </div>

          <!-- Séance prévue -->
          <div v-if="prochaine" class="p-entete" data-c>
            <p class="sur-titre">Votre séance</p>
            <h1 class="co-grand" :aria-label="`Votre séance : ${libelleSeance(prochaine)}`">{{ jourGrand }}<br><em>{{ formaterHeure(prochaine.heure) }}</em><br>{{ lieu }}</h1>
          </div>
          <!-- Aucune séance : même carte que sur le dashboard -->
          <a v-else class="carte-vide" :href="lienEcrire" target="_blank" rel="noopener" data-c>
            <span class="cv-t">Aucune séance prévue</span>
            <span class="cv-s">M'écrire pour en planifier une <Icone nom="fleche" /></span>
          </a>

          <div v-if="prochaine" class="bloc" data-c>
            <div class="co-actions">
              <a class="petit-btn" :href="lienModifier" target="_blank" rel="noopener" @click="surAction($event, lienModifier)">Modifier</a>
              <a class="petit-btn" :href="lienAnnuler" target="_blank" rel="noopener" @click="surAction($event, lienAnnuler)">Annuler</a>
            </div>
            <p class="co-regle" :class="{ alerte: bientot }">
              <span aria-hidden="true">{{ bientot ? '!' : '↺' }}</span>
              <span v-if="!bientot"><b>Annulation gratuite</b> jusqu'à 24 h avant la séance. On en parle sur WhatsApp.</span>
              <span v-else><b>Moins de 24 h avant la séance :</b> l'annulation gratuite n'est plus possible.</span>
            </p>
          </div>

          <div class="bloc mot-coach" data-c>
            <p class="sur-titre">Le mot de Corentin</p>
            <blockquote>« {{ motAffiche }} »</blockquote>
            <a class="petit-btn plein" :href="lienMot" target="_blank" rel="noopener">M'envoyer un mot</a>
          </div>

          <div v-if="prochaine && rang" class="bloc rang-bloc" data-c>
            <div class="stat-grand"><span data-compteur="rang">{{ rang }}</span><small>{{ ordinalFeminin(rang).replace(/^\d+/, '') }}</small></div>
            <p class="stat-leg">{{ phraseRang(rang) }}</p>
          </div>

          <div class="duo" data-c>
            <div class="bloc"><div class="stat-grand"><span data-compteur="semaine">{{ nbSemaine }}</span></div><p class="stat-leg">{{ nbSemaine > 1 ? 'séances' : 'séance' }} cette semaine</p></div>
            <div class="bloc"><div class="stat-grand"><span data-compteur="mois">{{ nbMois }}</span></div><p class="stat-leg">{{ nbMois > 1 ? 'séances' : 'séance' }} en {{ moisLabel.split(' ')[0] }}</p></div>
          </div>

          <div class="bloc" data-c>
            <p class="recap-calc"><span class="sur-titre recap-l">Payé ce mois : </span><span class="recap-v"><template v-if="paye.nb && tarifUnique !== null">{{ paye.nb }} × {{ formaterNombre(tarifUnique) }} € = </template><span class="total"><span data-compteur="total">{{ formaterNombre(paye.total) }}</span> €</span></span></p>
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
