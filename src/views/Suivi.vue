<script setup>
// Suivi du client (lot 8) : poids et mensurations (courbes SVG), carte du corps des douleurs, nutrition selon les modules activés.
// La page charge les données et écrit via src/data ; les blocs (components/suivi) ne font que de l'affichage.
// Pas de photos de progression en V1 (cahier des charges 4.7).
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import RoueValeur from '../components/seance/RoueValeur.vue'
import SuiviMesures from '../components/suivi/SuiviMesures.vue'
import CarteCorps from '../components/suivi/CarteCorps.vue'
import FeuilleZone from '../components/suivi/FeuilleZone.vue'
import SuiviNutrition from '../components/suivi/SuiviNutrition.vue'
import { data } from '../data/index.js'
import { jourLocal } from '../domain/dates.js'
import { configNombre } from '../domain/questionnaireUi.js'
import { idDouleur } from '../domain/corps.js'
import { aUnModule, caloriesDuJour, idCalories, idHabitude, idRepas, libelleSerie, modulesActifs, pointsCalories, pointsSerie } from '../domain/suivi.js'
import { enregistrerMesure } from '../lib/mesures.js'
import { compresserPhoto } from '../lib/photo.js'
import { horloge } from '../lib/horloge.js'
import { utilisateurCourant } from '../lib/session.js'
import { SONS } from '../lib/son.js'
import { installerRessort, mouvementReduit } from '../anim/transitions.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'
import '../styles/suivi.css'

const router = useRouter()
const { racine, couche, ouvrir, retour } = usePageAnimee('/')

const erreur = ref('')
const charge = ref(false)
const user = ref(null)
const mesures = shallowRef([])
const douleurs = shallowRef([])
const nutrition = shallowRef([])
const aujourdhui = jourLocal(horloge.now())

const roue = shallowRef(null)      // { config, src, valide(valeur) }
const zoneOuverte = ref(null)
const enregistrementZone = ref(false)
const erreurZone = ref('')
const repasOccupe = ref('')
const erreurRepas = ref('')
const toast = ref('')
const carte = ref(null)
const toastEl = ref(null)
let minuteurToast = 0

onMounted(async () => {
  installerRessort()
  try {
    user.value = await utilisateurCourant()
    if (!user.value) { erreur.value = 'Connectez-vous pour voir votre suivi.'; return }
    await recharger()
    charge.value = true
  } catch (e) {
    erreur.value = 'Impossible de charger votre suivi. Réessayez.'
    console.error(e)
    return
  }
  await nextTick()
  ouvrir()
})
onBeforeUnmount(() => { clearTimeout(minuteurToast); gsap.killTweensOf(toastEl.value) })

async function recharger() {
  const filtre = { clientId: user.value.id }
  const [m, d, n] = await Promise.all([data.mesures.lister(filtre), data.douleurs.lister(filtre), data.nutrition.lister(filtre)])
  mesures.value = m
  douleurs.value = d
  nutrition.value = n
}

/** Message bref en bas de l'écran (erreur d'écriture : rien n'est perdu en silence). */
function avertir(e) {
  console.error(e)
  toast.value = e?.code === 'STOCKAGE_PLEIN' ? `${e.message}. Libérez de la place (photos) puis réessayez.`
    : e?.code === 'RESEAU' ? 'Pas de réseau : réessayez dans un instant.' : "L'enregistrement a échoué. Réessayez."
  clearTimeout(minuteurToast)
  nextTick(() => { if (toastEl.value) gsap.fromTo(toastEl.value, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: mouvementReduit() ? 0.15 : 0.6, ease: 'expo.out' }) })
  minuteurToast = setTimeout(() => { toast.value = '' }, 5000)
}

/** Une seule ligne par client et par « clé » (zone + jour, habitude + jour…) : on remplace la ligne existante, sinon on la crée. */
async function enregistrer(collection, obj, meme) {
  const existante = (await data[collection].lister({ clientId: obj.clientId })).find(meme)
  return existante ? data[collection].modifier(existante.id, { ...obj, id: existante.id }) : data[collection].creer(obj)
}

// --- Poids et mensurations ------------------------------------------------------------------------------------------
function ajouterMesure({ serie, src }) {
  const derniere = pointsSerie(mesures.value, serie).pop()?.valeur
  const poids = serie === 'poids'
  const config = configNombre(
    { cle: serie, libelle: libelleSerie(serie), unite: poids ? 'kg' : 'cm', min: poids ? 20 : 30, max: poids ? 300 : 250, pas: poids ? 0.1 : 0.5, defaut: poids ? 70 : 80 },
    derniere
  )
  roue.value = {
    config, src,
    async valide(valeur) {
      try {
        await enregistrerMesure(data, user.value.id, aujourdhui, poids ? { poids: valeur } : { mensurations: { [serie]: valeur } })
        await recharger()
      } catch (e) { avertir(e) }
    }
  }
}

// --- Carte du corps ----------------------------------------------------------------------------------------------------
function ouvrirZone(id) {
  erreurZone.value = ''
  zoneOuverte.value = id
}
async function enregistrerDouleur(intensite) {
  const zone = zoneOuverte.value
  enregistrementZone.value = true
  erreurZone.value = ''
  try {
    await enregistrer('douleurs', { id: idDouleur(user.value.id, zone, aujourdhui), clientId: user.value.id, zone, intensite, date: aujourdhui },
      (d) => d.zone === zone && d.date === aujourdhui)
    await recharger()
    SONS.valide()
    zoneOuverte.value = null
    await nextTick()
    setTimeout(() => carte.value?.flash(zone), 350)
  } catch (e) {
    console.error(e)
    erreurZone.value = e.code === 'STOCKAGE_PLEIN' ? `${e.message}.` : "L'enregistrement a échoué. Réessayez."
  } finally {
    enregistrementZone.value = false
  }
}

// --- Nutrition -------------------------------------------------------------------------------------------------------
async function basculerHabitude({ nom, fait }) {
  try {
    await enregistrer('nutrition', { id: idHabitude(user.value.id, aujourdhui, nom), clientId: user.value.id, date: aujourdhui, type: 'habitude', valeur: { nom, fait } },
      (e) => e.type === 'habitude' && e.date === aujourdhui && e.valeur?.nom === nom)
    await recharger()
    SONS.valide()
  } catch (e) { avertir(e) }
}
async function ajouterPhoto({ repas, fichier }) {
  repasOccupe.value = repas
  erreurRepas.value = ''
  try {
    const photo = await compresserPhoto(fichier, { max: 900, qualite: 0.7 }) // plus petite que les photos de questionnaire : c'est un journal, pas un album
    await enregistrer('nutrition', { id: idRepas(user.value.id, aujourdhui, repas), clientId: user.value.id, date: aujourdhui, type: 'repas', valeur: { repas, photo } },
      (e) => e.type === 'repas' && e.date === aujourdhui && e.valeur?.repas === repas)
    await recharger()
  } catch (e) {
    console.error(e)
    erreurRepas.value = e.code === 'STOCKAGE_PLEIN' ? `${e.message}. Libérez de la place puis réessayez.` : "Cette photo n'a pas pu être enregistrée. Essayez-en une autre."
  } finally {
    repasOccupe.value = ''
  }
}
function noterCalories(src) {
  const derniere = caloriesDuJour(nutrition.value, aujourdhui) ?? pointsCalories(nutrition.value, aujourdhui, 60).pop()?.valeur
  roue.value = {
    config: configNombre({ cle: 'kcal', libelle: 'Calories du jour', unite: 'kcal', min: 0, max: 6000, pas: 50, defaut: 2000 }, derniere),
    src,
    async valide(valeur) {
      try {
        await enregistrer('nutrition', { id: idCalories(user.value.id, aujourdhui), clientId: user.value.id, date: aujourdhui, type: 'calories', valeur: { kcal: valeur } },
          (e) => e.type === 'calories' && e.date === aujourdhui)
        await recharger()
      } catch (e) { avertir(e) }
    }
  }
}

function roueValidee(i) {
  SONS.valide()
  roue.value.valide(roue.value.config.stocke(i))
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <div v-if="erreur" class="ecran-vide">
      <p>{{ erreur }}</p>
      <button class="gros" type="button" @click="router.replace('/')">Retour</button>
    </div>

    <section v-else-if="charge" ref="couche" class="page" hidden aria-label="Suivi">
      <div class="voile"></div>
      <div class="defile defile-prog">
        <div class="p-top avec-menu" data-c>
          <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
          <span class="sur-titre">Suivi</span>
        </div>
        <div class="p-entete" data-c>
          <p class="sur-titre">Vos progrès</p>
          <h1 class="titre-page">Suivi</h1>
        </div>

        <section class="bloc-suivi" data-c aria-labelledby="sv-mes">
          <h2 id="sv-mes">Poids et mensurations</h2>
          <SuiviMesures :mesures="mesures" :aujourdhui="aujourdhui" :delai="0.7" @ajouter="ajouterMesure" />
        </section>

        <section class="bloc-suivi" data-c aria-labelledby="sv-corps">
          <h2 id="sv-corps">Carte du corps</h2>
          <p class="sv-sous">Une gêne, une douleur ? Touchez la zone et notez l'intensité de 0 à 10.</p>
          <CarteCorps ref="carte" :douleurs="douleurs" :aujourdhui="aujourdhui" @zone="ouvrirZone" />
        </section>

        <!-- Rubrique absente si le coach n'a activé aucun module nutrition pour ce client -->
        <section v-if="aUnModule(user)" class="bloc-suivi" data-c aria-labelledby="sv-nut">
          <h2 id="sv-nut">Nutrition</h2>
          <SuiviNutrition
            :modules="modulesActifs(user)" :entrees="nutrition" :aujourdhui="aujourdhui" :occupe="repasOccupe" :erreur="erreurRepas"
            @habitude="basculerHabitude" @photo="ajouterPhoto" @calories="noterCalories"
          />
        </section>
      </div>

      <FeuilleZone
        :zone="zoneOuverte" :douleurs="douleurs" :aujourdhui="aujourdhui" :enregistrement="enregistrementZone" :erreur="erreurZone"
        @fermer="zoneOuverte = null" @enregistrer="enregistrerDouleur"
      />

      <p v-if="toast" ref="toastEl" class="sv-toast" role="alert">{{ toast }}</p>

      <RoueValeur
        v-if="roue" :config="roue.config" :titre="roue.config.label" :sous="roue.config.unite ? `en ${roue.config.unite}` : ''" :src="roue.src"
        @valide="roueValidee" @ferme="roue = null"
      />
    </section>
  </main>
</template>
