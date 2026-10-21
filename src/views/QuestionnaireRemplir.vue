<script setup>
// Passage d'un questionnaire (lot 7) : une question par écran, transitions de la direction M1 « Atelier » (la question sort en
// glissant, la suivante entre, les mots du titre montent), barre de progression qui se remplit, fin = cercle d'accent + confettis.
// Quitter au milieu garde un brouillon (reprise à la même question). Les réponses vont dans data.reponses ; les poids / mensurations
// de la semaine alimentent aussi data.mesures (page Suivi) ; une douleur > 6 déclenche l'alerte coach (domain/alertes).
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import CurseurDix from '../components/CurseurDix.vue'
import ChiffresRoulants from '../components/ChiffresRoulants.vue'
import RoueValeur from '../components/seance/RoueValeur.vue'
import { data, mode } from '../data/index.js'
import { jourLocal } from '../domain/dates.js'
import {
  LIBELLES_EMOJIS, configNombre, douleurAlertante, idReponse, mesureDepuisReponse, peutContinuer, reponseDeLaPeriode,
  resumeFin, valeurInitiale, valeursAEnregistrer
} from '../domain/questionnaireUi.js'
import { nombreFr } from '../domain/unites.js'
import { effacerBrouillon, lireBrouillon, sauverBrouillon } from '../lib/brouillonQuestionnaire.js'
import { enregistrerMesure } from '../lib/mesures.js'
import { compresserPhoto } from '../lib/photo.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { SONS, vibre } from '../lib/son.js'
import { installerRessort, mouvementReduit, ouvrirCercle } from '../anim/transitions.js'
import { motsMontent } from '../anim/titres.js'
import { confettis } from '../anim/celebration.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'
import '../styles/questionnaires.css'

const route = useRoute()
const { racine, couche, ouvrir, retour } = usePageAnimee('/questionnaires')

const erreur = ref('')
const charge = ref(false)
const user = ref(null)
const questionnaire = shallowRef(null)
const aujourdhui = jourLocal(horloge.now())

const index = ref(0)
const sens = ref(0) // 0 = première question, 1 = avant, -1 = arrière
const valeurs = reactive({})
const occupe = ref(false) // une transition de question est en cours : on ignore les touchers
const envoi = ref(false)
const erreurEnvoi = ref('')
const erreurPhoto = ref('')
const reprise = ref(false)
const fin = ref(false)
const dejaFait = ref(false)
const resume = ref([])
const alerte = ref(false)
const roue = shallowRef(null) // { config, src } quand la roue de valeur est ouverte

const barreEl = ref(null)
const finEl = ref(null)
const repriseEl = ref(null)
let minuteur = 0
const refsPhotos = new Map() // photo déjà envoyée -> référence : un nouvel essai ne renvoie pas le fichier

const total = computed(() => questionnaire.value?.questions.length || 0)
const q = computed(() => questionnaire.value?.questions[index.value])
const derniere = computed(() => index.value === total.value - 1)
const peut = computed(() => !!q.value && peutContinuer(q.value, valeurs[q.value.cle]))
// Choix unique et émojis passent seuls à la suite (sauf la dernière question : on garde un bouton « Envoyer » explicite).
const auto = computed(() => !!q.value && ['choixUnique', 'emojis'].includes(q.value.type) && !derniere.value)
const videOptionnelle = computed(() => {
  const v = valeurs[q.value?.cle]
  return !!q.value?.optionnel && (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length))
})
const libelleBouton = computed(() => (derniere.value ? 'Envoyer' : videOptionnelle.value && q.value.type !== 'curseur' ? 'Passer' : 'Continuer'))
const prenom = computed(() => (user.value?.nom || '').split(' ')[0])
const aide = computed(() => {
  const c = q.value
  if (!c) return ''
  if (c.aide) return c.aide
  if (c.type === 'curseur') return c.etiquettes?.length ? `De ${c.min ?? 0} (${c.etiquettes[0].toLowerCase()}) à ${c.max ?? 10} (${c.etiquettes[1].toLowerCase()}).` : `De ${c.min ?? 0} à ${c.max ?? 10}.`
  if (c.type === 'choixMultiple') return 'Plusieurs réponses possibles.'
  return c.optionnel ? 'Facultatif.' : ''
})
const libelleEmoji = computed(() => {
  const v = valeurs[q.value?.cle]
  const choix = q.value?.choix || []
  return v && choix.length === LIBELLES_EMOJIS.length ? LIBELLES_EMOJIS[choix.indexOf(v)] || '' : ''
})

// --- Chargement -------------------------------------------------------------------------------------------------
onMounted(async () => {
  installerRessort()
  try {
    user.value = await utilisateurCourant()
    if (!user.value) { erreur.value = 'Connectez-vous pour remplir ce questionnaire.'; return }
    const [qq, reponses, mesures] = await Promise.all([
      data.questionnaires.lire(route.params.id), data.reponses.lister({ clientId: user.value.id }), data.mesures.lister({ clientId: user.value.id })
    ])
    if (!qq || (qq.clientId && qq.clientId !== user.value.id)) { erreur.value = 'Questionnaire introuvable.'; return }
    questionnaire.value = qq
    // valeur précédente de chaque question « nombre » (poids, tours) : réponses d'abord, mesures du suivi ensuite
    const triees = [...reponses].sort((a, b) => a.date.localeCompare(b.date))
    const mesuresTriees = [...mesures].sort((a, b) => a.date.localeCompare(b.date))
    const derniereMesure = (cle) => mesuresTriees.map((m) => (cle === 'poids' ? m.poids : m.mensurations?.[cle])).filter((v) => typeof v === 'number').pop()
    for (const question of qq.questions) {
      const prec = triees.filter((r) => typeof r.valeurs?.[question.cle] === 'number').pop()?.valeurs[question.cle] ?? derniereMesure(question.cle)
      valeurs[question.cle] = valeurInitiale(question, prec)
    }
    dejaFait.value = !!reponseDeLaPeriode(qq, reponses, user.value.id, aujourdhui)
    const b = !dejaFait.value && lireBrouillon(user.value.id, qq.id, aujourdhui)
    if (b) {
      Object.assign(valeurs, b.valeurs)
      index.value = Math.min(b.index, total.value - 1)
      reprise.value = index.value > 0
    }
    charge.value = true
  } catch (e) {
    erreur.value = 'Impossible de charger ce questionnaire. Réessayez.'
    console.error(e)
    return
  }
  await nextTick()
  const tl = ouvrir()
  gsap.set(barreEl.value, { scaleX: 0 })
  gsap.to(barreEl.value, { scaleX: (index.value + 1) / total.value, duration: mouvementReduit() ? 0.2 : 0.9, delay: tl ? 0.5 : 0, ease: 'back.out(1.6)' })
  if (dejaFait.value) montrerDejaFait()
  else if (reprise.value) annoncerReprise()
})
onBeforeUnmount(() => {
  clearTimeout(minuteur)
  gsap.killTweensOf([barreEl.value, repriseEl.value].filter(Boolean))
})

// Brouillon : sauvegardé à chaque changement (hors fin).
watch([index, valeurs], () => {
  if (!charge.value || fin.value) return
  // hors mode démo, une photo n'est jamais gardée dans le navigateur : elle part directement dans le stockage privé à l'envoi
  const brouillon = { ...valeurs }
  if (mode !== 'local') for (const c of questionnaire.value.questions) if (c.type === 'photo') delete brouillon[c.cle]
  sauverBrouillon(user.value.id, questionnaire.value.id, aujourdhui, { index: index.value, valeurs: brouillon })
}, { deep: true })
watch(index, (i) => gsap.to(barreEl.value, { scaleX: (i + 1) / total.value, duration: mouvementReduit() ? 0.2 : 0.9, ease: 'back.out(1.6)', overwrite: 'auto' }))

function annoncerReprise() {
  nextTick(() => {
    if (!repriseEl.value) return
    if (mouvementReduit()) { gsap.fromTo(repriseEl.value, { opacity: 0 }, { opacity: 1, duration: 0.2 }); gsap.to(repriseEl.value, { opacity: 0, delay: 2.4, duration: 0.3, onComplete: () => { reprise.value = false } }); return }
    gsap.timeline({ delay: 1, onComplete: () => { reprise.value = false } })
      .fromTo(repriseEl.value, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out' })
      .to(repriseEl.value, { y: -14, opacity: 0, duration: 0.3, ease: 'power3.out' }, '+=2')
  })
}

// --- Transitions entre questions ----------------------------------------------------------------------------------
function entrer(el, done) {
  const premier = sens.value === 0
  const fini = () => { occupe.value = false; done() }
  if (mouvementReduit()) { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, onComplete: fini }); return }
  const corps = el.querySelectorAll('[data-qc]')
  gsap.fromTo(el, { x: premier ? 0 : sens.value * 90, opacity: premier ? 1 : 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'expo.out', clearProps: 'transform', delay: premier ? 0 : 0.12, onComplete: fini })
  motsMontent(el.querySelector('h2'), premier ? 0.5 : 0.18)
  if (!premier) gsap.fromTo(corps, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.09, ease: 'expo.out', delay: 0.25, clearProps: 'transform,opacity' })
}
function sortir(el, done) {
  el.style.pointerEvents = 'none'
  if (mouvementReduit()) { gsap.to(el, { opacity: 0, duration: 0.2, onComplete: done }); return }
  gsap.to(el, { x: -sens.value * 70, opacity: 0, duration: 0.38, ease: 'power3.out', onComplete: done })
}

function aller(delta) {
  if (occupe.value) return
  clearTimeout(minuteur)
  occupe.value = true
  sens.value = delta
  index.value += delta
}
function suivante() {
  if (occupe.value || !peut.value) return
  if (derniere.value) envoyer()
  else aller(1)
}

// --- Réponses ---------------------------------------------------------------------------------------------------
function choisir(valeur) {
  if (occupe.value) return
  const c = q.value
  valeurs[c.cle] = valeur
  SONS.choix()
  if (auto.value) { clearTimeout(minuteur); minuteur = setTimeout(() => aller(1), c.type === 'emojis' ? 750 : 650) }
}
function basculerChoix(option) {
  const liste = valeurs[q.value.cle]
  valeurs[q.value.cle] = liste.includes(option) ? liste.filter((x) => x !== option) : [...liste, option]
  SONS.choix()
}
// Humeur (M2) : l'émoji choisi grandit en rebond mesuré, les autres reculent un peu
function pop(e) {
  if (mouvementReduit()) return
  const bouton = e.currentTarget
  const tous = bouton.parentElement.querySelectorAll('.emo')
  tous.forEach((s) => gsap.to(s, { scale: s.parentElement === bouton ? 1.4 : 0.86, y: s.parentElement === bouton ? -8 : 0, duration: 0.55, ease: s.parentElement === bouton ? 'back.out(2)' : 'expo.out' }))
}
function choisirEmoji(e, emoji) { choisir(emoji); pop(e) }

function ouvrirRoue(e) {
  roue.value = { config: configNombre(q.value, valeurs[q.value.cle]), src: e.currentTarget }
}
const sensNombre = ref(1) // les chiffres de la tuile montent quand la valeur augmente, descendent sinon
function roueValidee(i) {
  const nouvelle = roue.value.config.stocke(i)
  const ancienne = valeurs[q.value.cle]
  sensNombre.value = typeof ancienne === 'number' && nouvelle < ancienne ? -1 : 1
  valeurs[q.value.cle] = nouvelle
  SONS.tick()
}

async function choisirPhoto(e) {
  const fichier = e.target.files?.[0]
  e.target.value = ''
  if (!fichier) return
  erreurPhoto.value = ''
  try { valeurs[q.value.cle] = await compresserPhoto(fichier) } catch (err) {
    erreurPhoto.value = "Cette photo n'a pas pu être utilisée. Essayez-en une autre."
    console.error(err)
  }
}

async function envoyer() {
  if (envoi.value) return
  envoi.value = true
  erreurEnvoi.value = ''
  const vals = valeursAEnregistrer(questionnaire.value, valeurs)
  const rep = { id: idReponse(user.value.id, questionnaire.value.id, aujourdhui), clientId: user.value.id, questionnaireId: questionnaire.value.id, frequence: questionnaire.value.frequence, date: aujourdhui, valeurs: vals }
  try {
    // photos : envoyées dans le stockage privé (Supabase) ; en démo elles restent en data URL (data.photos s'en charge)
    for (const c of questionnaire.value.questions) {
      if (c.type === 'photo' && typeof vals[c.cle] === 'string' && vals[c.cle].startsWith('data:')) {
        if (!refsPhotos.has(vals[c.cle])) refsPhotos.set(vals[c.cle], await data.photos.enregistrer(user.value.id, vals[c.cle]))
        vals[c.cle] = refsPhotos.get(vals[c.cle])
      }
    }
    try { await data.reponses.creer(rep) } catch (e) { if (e.code === 'EXISTE') await data.reponses.modifier(rep.id, rep); else throw e }
    const m = mesureDepuisReponse(questionnaire.value, vals)
    if (m) await enregistrerMesure(data, user.value.id, aujourdhui, m)
  } catch (e) {
    console.error(e)
    // rien n'est perdu : le brouillon reste, le client peut réessayer
    erreurEnvoi.value = e.code === 'STOCKAGE_PLEIN' ? `${e.message}. Libérez de la place (photos) puis réessayez.`
      : e.code === 'RESEAU' ? 'Pas de réseau : vos réponses sont gardées, réessayez dans un instant.' : "L'envoi a échoué. Vos réponses sont gardées, réessayez."
    envoi.value = false
    return
  }
  effacerBrouillon(user.value.id, questionnaire.value.id)
  resume.value = resumeFin(questionnaire.value, vals)
  alerte.value = douleurAlertante(vals)
  fin.value = true
  await nextTick()
  SONS.fete()
  ouvrirCercle(finEl.value, document.querySelector('.qz-bas .gros'), { onFini: celebrer })
  envoi.value = false
}

// --- Fin --------------------------------------------------------------------------------------------------------
function celebrer() {
  const f = finEl.value
  if (!f || mouvementReduit()) return
  confettis(f, { delai: 0.05 })
}
function animerContenuFin(delai) {
  const f = finEl.value
  const els = f.querySelectorAll('.rond-ok, .gd, p, .resume span, .gros')
  if (mouvementReduit()) { gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.25, clearProps: 'opacity' }); return }
  gsap.fromTo(els, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'expo.out', delay: delai, clearProps: 'transform,opacity' })
  gsap.fromTo(f.querySelector('.rond-ok'), { scale: 0.7 }, { scale: 1, duration: 0.9, delay: delai + 0.1, ease: 'back.out(1.7)', clearProps: 'transform' })
  const trait = f.querySelector('.rond-ok path')
  gsap.fromTo(trait, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, delay: delai + 0.4, ease: 'power2.out' })
}
watch(fin, (v) => { if (v && !dejaFait.value) nextTick(() => animerContenuFin(0.45)) })
function montrerDejaFait() {
  fin.value = true
  nextTick(() => { finEl.value.hidden = false; animerContenuFin(0.1) })
}

const quitter = () => retour()
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <div v-if="erreur" class="ecran-vide">
      <p>{{ erreur }}</p>
      <button class="gros" type="button" @click="retour">Retour</button>
    </div>

    <section v-else-if="charge" ref="couche" class="page" hidden :aria-label="questionnaire.nom">
      <div class="voile"></div>
      <div class="qz">
        <div class="qz-haut" data-c>
          <button class="rond" type="button" :aria-label="fin ? 'Fermer' : 'Quitter, vos réponses sont gardées'" @click="quitter"><Icone nom="fermer" /></button>
          <div class="qz-barre" role="progressbar" :aria-valuenow="index + 1" aria-valuemin="1" :aria-valuemax="total" aria-label="Progression"><b ref="barreEl"></b></div>
          <span class="qz-n" aria-live="polite">{{ index + 1 }}/{{ total }}</span>
        </div>

        <div class="qz-scene" data-c>
          <div v-if="reprise" ref="repriseEl" class="qz-reprise" role="status">On reprend où vous en étiez</div>

          <Transition :css="false" @enter="entrer" @leave="sortir">
            <div :key="index" class="qz-q">
              <h2>{{ q.libelle.replace(/ ([?!:;])/g, ' $1') }}</h2>
              <p v-if="aide" class="aide" data-qc>{{ aide }}</p>

              <div class="qz-corps" data-qc>
                <!-- curseur 0-10 -->
                <CurseurDix
                  v-if="q.type === 'curseur'" v-model="valeurs[q.cle]" :min="q.min ?? 0" :max="q.max ?? 10"
                  :etiquettes="q.etiquettes || []" :label="q.libelle"
                />

                <!-- émojis -->
                <template v-else-if="q.type === 'emojis'">
                  <div class="emojis">
                    <button
                      v-for="(e, k) in q.choix" :key="e" class="emoji" type="button" :aria-pressed="valeurs[q.cle] === e"
                      :aria-label="q.choix.length === 5 ? LIBELLES_EMOJIS[k] : e" @click="choisirEmoji($event, e)"
                    ><span class="emo">{{ e }}</span></button>
                  </div>
                  <div class="emoji-lab" aria-hidden="true">{{ libelleEmoji || '&nbsp;' }}</div>
                </template>

                <!-- choix unique -->
                <div v-else-if="q.type === 'choixUnique'" class="choix" role="radiogroup" :aria-label="q.libelle">
                  <button
                    v-for="o in q.choix" :key="o" type="button" role="radio" :aria-checked="valeurs[q.cle] === o" :aria-pressed="valeurs[q.cle] === o"
                    @click="choisir(o)"
                  ><span>{{ o }}</span><span class="coche"><Icone nom="coche" /></span></button>
                </div>

                <!-- choix multiple -->
                <div v-else-if="q.type === 'choixMultiple'" class="choix" role="group" :aria-label="q.libelle">
                  <button v-for="o in q.choix" :key="o" type="button" :aria-pressed="valeurs[q.cle].includes(o)" @click="basculerChoix(o)">
                    <span>{{ o }}</span><span class="coche"><Icone nom="coche" /></span>
                  </button>
                </div>

                <!-- nombre + unité : la tuile ouvre la roue de valeur (même sélecteur que la séance) -->
                <button v-else-if="q.type === 'nombre'" class="nombre-tuile" type="button" :aria-label="`${q.libelle} : ${valeurs[q.cle] === null ? 'à régler' : nombreFr(valeurs[q.cle]) + ' ' + (q.unite || '')}`" @click="ouvrirRoue">
                  <span class="nt-val" :class="{ vide: valeurs[q.cle] === null }"><template v-if="valeurs[q.cle] === null">—</template><ChiffresRoulants v-else :valeur="nombreFr(valeurs[q.cle])" :sens="sensNombre" :duree="0.6" /><small v-if="q.unite">{{ q.unite }}</small></span>
                  <span class="nt-aide">{{ valeurs[q.cle] === null ? 'Touchez pour régler' : 'Touchez pour modifier' }}</span>
                </button>

                <!-- texte -->
                <textarea
                  v-else-if="q.type === 'texte'" v-model="valeurs[q.cle]" class="qz-texte" maxlength="600" rows="6"
                  :aria-label="q.libelle" placeholder="Écrivez ici…"
                ></textarea>

                <!-- photo : l'appareil photo s'ouvre ; l'image est réduite et nettoyée (EXIF) avant d'être gardée -->
                <template v-else-if="q.type === 'photo'">
                  <label class="qz-photo">
                    <input type="file" accept="image/*" capture="environment" :aria-label="q.libelle" @change="choisirPhoto">
                    <img v-if="valeurs[q.cle]" :src="valeurs[q.cle]" alt="Votre photo">
                    <span v-else class="ph-vide">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /></svg>
                      Prendre une photo<small>ou choisir dans la galerie</small>
                    </span>
                  </label>
                  <p v-if="valeurs[q.cle]" class="ph-changer">Touchez la photo pour la changer</p>
                  <p v-if="erreurPhoto" class="qz-erreur" role="alert">{{ erreurPhoto }}</p>
                </template>
              </div>

              <div class="qz-bas" data-qc>
                <button v-if="index > 0" class="rond" type="button" aria-label="Question précédente" @click="aller(-1)"><Icone nom="gauche" /></button>
                <div v-if="auto" style="flex: 1; min-height: 68px"></div>
                <div v-else style="flex: 1">
                  <p v-if="erreurEnvoi && derniere" class="qz-erreur" role="alert">{{ erreurEnvoi }}</p>
                  <button class="gros" type="button" :disabled="!peut || envoi" @click="suivante">{{ envoi ? 'Envoi…' : libelleBouton }}</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Fin : le cercle d'accent jaillit du bouton « Envoyer » (ou s'affiche tel quel si c'est déjà fait) -->
      <div ref="finEl" class="couche qz-fin" hidden role="status">
        <div class="rond-ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" style="stroke-dasharray: 1" d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
        <div class="gd">{{ dejaFait ? "Déjà fait" : 'Merci' }}<br>{{ dejaFait ? "pour cette fois" : `${prenom} !` }}</div>
        <p v-if="dejaFait">Vos réponses sont bien enregistrées. À la prochaine !</p>
        <p v-else-if="alerte">Corentin est prévenu de votre douleur et adaptera la suite.</p>
        <p v-else>Corentin a bien reçu vos réponses.</p>
        <div v-if="resume.length" class="resume"><span v-for="r in resume" :key="r">{{ r }}</span></div>
        <button class="gros" type="button" @click="quitter">Terminer</button>
      </div>

      <RoueValeur
        v-if="roue" :config="roue.config" :titre="q.libelle" :sous="q.unite ? `en ${q.unite}` : ''" :src="roue.src"
        @valide="roueValidee" @ferme="roue = null"
      />
    </section>
  </main>
</template>
