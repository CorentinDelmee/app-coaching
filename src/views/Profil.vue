<script setup>
// Profil : infos, changer son code, préférences (son, vibration, unité), consentement, export JSON de mes données, déconnexion.
import { computed, nextTick, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import Icone from '../components/Icone.vue'
import { data } from '../data/index.js'
import { patchConsentement } from '../domain/consentement.js'
import { jourLocal } from '../domain/dates.js'
import { jourLong } from '../domain/calendrierUi.js'
import { validerNouveauCode } from '../domain/identifiants.js'
import { horloge } from '../lib/horloge.js'
import { effacerSeanceEnCours } from '../lib/seanceEnCours.js'
import { utilisateurCourant } from '../lib/session.js'
import { regler as reglerSon, SONS } from '../lib/son.js'
import { installerRessort } from '../anim/transitions.js'
import { memoriserSource, sauterFermeture } from '../anim/passage.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const router = useRouter()
const { racine, couche, ouvrir, retour } = usePageAnimee('/')
const user = shallowRef(null)
const prefs = ref({ son: true, vibration: true, unite: 'kg' })
const message = ref('')

onMounted(async () => {
  installerRessort()
  user.value = await utilisateurCourant()
  if (!user.value) return
  const p = user.value.preferences || {}
  prefs.value = { son: p.son ?? true, vibration: p.vibration ?? true, unite: p.unite || 'kg' } // seulement les trois réglages (le reste, comme le consentement, reste dans le profil)
  await nextTick()
  ouvrir()
})

const consentement = computed(() => user.value?.preferences?.consentement || null)
const libelleConsentement = computed(() => {
  if (!consentement.value) return 'Pas encore répondu'
  const le = user.value.consentementLe ? ` le ${jourLong(jourLocal(user.value.consentementLe))}` : ''
  return consentement.value.sante ? `Données de santé acceptées${le}` : `Données de santé refusées${le}`
})
const lieu = computed(() => (user.value?.lieuDefaut === 'salle' ? 'En salle' : 'À domicile'))

async function enregistrerPrefs(patch) {
  prefs.value = { ...prefs.value, ...patch }
  const maj = await data.profils.modifier(user.value.id, { preferences: { ...(user.value.preferences || {}), ...prefs.value } })
  user.value = maj
  reglerSon(maj.preferences)
  if (patch.son === true) SONS.valide()
  if (patch.vibration === true && navigator.vibrate) navigator.vibrate(30)
}

// --- Changer son code ---
const formCode = ref(false)
const ancien = ref('')
const nouveau = ref('')
const confirmation = ref('')
const erreurCode = ref('')
const codeChange = ref(false)
async function changerCode() {
  erreurCode.value = ''
  const probleme = validerNouveauCode(nouveau.value, confirmation.value)
  if (probleme) { erreurCode.value = probleme; return }
  try {
    await data.changerCode(ancien.value, nouveau.value)
    codeChange.value = true
    formCode.value = false
    ancien.value = nouveau.value = confirmation.value = ''
  } catch (e) {
    erreurCode.value = e?.code === 'IDENTIFIANTS' ? 'Code actuel incorrect' : (e?.message || 'Impossible de changer le code.')
  }
}

// --- Consentement ---
async function retirer() {
  user.value = await data.profils.modifier(user.value.id, patchConsentement(user.value, false, horloge.now()))
  message.value = 'Consentement retiré : vos données de santé ne sont plus utilisées.'
}
function donner(e) {
  memoriserSource(e.currentTarget)
  router.push({ name: 'consentement', query: { retour: '/profil' } })
}

// --- Export de mes données (RGPD) : fichier JSON téléchargé ---
async function exporter() {
  const contenu = await data.exporterMesDonnees()
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `mes-donnees-${jourLocal(horloge.now())}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  message.value = 'Vos données ont été exportées.'
}

async function deconnecter() {
  await data.deconnecter()
  effacerSeanceEnCours()
  sauterFermeture()
  router.replace('/bienvenue')
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <section v-if="user" ref="couche" class="page" hidden aria-label="Profil">
      <div class="voile"></div>
      <div class="defile defile-prog">
        <div class="p-top avec-menu" data-c>
          <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
          <span class="sur-titre">Profil</span>
        </div>
        <div class="p-entete" data-c>
          <p class="sur-titre">Votre compte</p>
          <h1 class="titre-page">{{ user.nom }}</h1>
        </div>
        <p v-if="message" class="pf-message" role="status">{{ message }}</p>

        <div class="bloc" data-c>
          <p class="sur-titre">Informations</p>
          <dl class="pf-infos">
            <div><dt>Identifiant</dt><dd>{{ user.identifiant }}</dd></div>
            <div><dt>Séances</dt><dd>{{ lieu }}</dd></div>
          </dl>
        </div>

        <div class="bloc" data-c>
          <p class="sur-titre">Préférences</p>
          <div class="pf-ligne">
            <span>Sons</span>
            <button class="interrupteur" type="button" role="switch" :aria-checked="prefs.son" aria-label="Sons" @click="enregistrerPrefs({ son: !prefs.son })"><i></i></button>
          </div>
          <div class="pf-ligne">
            <span>Vibrations</span>
            <button class="interrupteur" type="button" role="switch" :aria-checked="prefs.vibration" aria-label="Vibrations" @click="enregistrerPrefs({ vibration: !prefs.vibration })"><i></i></button>
          </div>
          <div class="pf-ligne">
            <span>Unité de poids</span>
            <span class="duo-unite" role="group" aria-label="Unité de poids">
              <button type="button" :aria-pressed="prefs.unite === 'kg'" @click="enregistrerPrefs({ unite: 'kg' })">kg</button>
              <button type="button" :aria-pressed="prefs.unite === 'lb'" @click="enregistrerPrefs({ unite: 'lb' })">lb</button>
            </span>
          </div>
        </div>

        <div class="bloc" data-c>
          <p class="sur-titre">Mon code</p>
          <p v-if="codeChange" class="pf-ok">Code modifié.</p>
          <button v-if="!formCode" class="petit-btn" type="button" @click="formCode = true; codeChange = false">Changer mon code</button>
          <form v-else class="cx-form" novalidate @submit.prevent="changerCode">
            <label class="champ"><span>Code actuel</span><input v-model="ancien" type="password" autocomplete="current-password" /></label>
            <label class="champ"><span>Nouveau code (6 caractères minimum)</span><input v-model="nouveau" type="password" autocomplete="new-password" /></label>
            <label class="champ"><span>Confirmer le nouveau code</span><input v-model="confirmation" type="password" autocomplete="new-password" /></label>
            <p v-if="erreurCode" class="cx-erreur" role="alert">{{ erreurCode }}</p>
            <button class="gros" type="submit">Enregistrer</button>
            <button class="gros doux" type="button" @click="formCode = false">Annuler</button>
          </form>
        </div>

        <div class="bloc" data-c>
          <p class="sur-titre">Mes données</p>
          <p class="pf-texte">{{ libelleConsentement }}</p>
          <div class="pf-boutons">
            <button v-if="consentement && consentement.sante" class="petit-btn" type="button" @click="retirer">Retirer mon consentement</button>
            <button v-else class="petit-btn plein" type="button" @click="donner">{{ consentement ? 'Donner mon consentement' : 'Répondre' }}</button>
            <button class="petit-btn" type="button" @click="exporter">Exporter mes données (JSON)</button>
            <RouterLink class="petit-btn" to="/confidentialite?retour=/profil">Confidentialité</RouterLink>
          </div>
        </div>

        <button class="gros contour" type="button" data-c @click="deconnecter">Se déconnecter</button>
      </div>
    </section>
  </main>
</template>
