<script setup>
// Connexion : identifiant + code. Session persistante (gérée par la couche data). En mode local, les comptes de démo sont listés.
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import Icone from '../components/Icone.vue'
import { data, mode } from '../data/index.js'
import { COMPTES_DEMO } from '../data/demo/index.js'
import { installerRessort, mouvementReduit, nettoyer, ouvrirCercle } from '../anim/transitions.js'
import { sauterFermeture } from '../anim/passage.js'
import { usePageAnimee } from '../composables/usePageAnimee.js'

const router = useRouter()
const { racine, couche, ouvrir, partir, retour } = usePageAnimee('/bienvenue')
const identifiant = ref('')
const code = ref('')
const voir = ref(false)
const erreur = ref('')
const occupe = ref(false)
const bouton = ref(null)
const rideau = ref(null)
const formulaire = ref(null)
const demo = mode === 'local'
const COMPTES = COMPTES_DEMO.map((c) => ({ ...c, libelle: c.role === 'coach' ? 'Corentin (coach)' : c.identifiant === 'fabien.vincent' ? 'Fabien Vincent (client)' : c.identifiant }))

onMounted(async () => {
  installerRessort()
  await nextTick()
  ouvrir()
})

function remplir(c) {
  identifiant.value = c.identifiant
  code.value = c.code
  erreur.value = ''
}

function secouer() {
  if (mouvementReduit()) return
  gsap.fromTo(formulaire.value, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1,.25)', clearProps: 'transform' })
}

async function envoyer() {
  if (occupe.value) return
  erreur.value = ''
  if (!identifiant.value.trim() || !code.value) { erreur.value = 'Entrez votre identifiant et votre code.'; secouer(); return }
  occupe.value = true
  try {
    const user = await data.connecter(identifiant.value.trim(), code.value)
    // succès : un cercle d'accent naît du bouton, puis on entre dans l'app (le tableau de bord a sa propre entrée)
    const aller = () => { partir(); sauterFermeture(); router.replace(user.role === 'coach' ? '/coach' : '/') }
    ouvrirCercle(rideau.value, bouton.value, { onFini: aller })
  } catch (e) {
    erreur.value = e?.code === 'IDENTIFIANTS' ? 'Identifiant ou code incorrect' : (e?.message || 'Connexion impossible. Réessayez.')
    occupe.value = false
    secouer()
  }
}
</script>

<template>
  <main ref="racine" class="ecran" data-racine>
    <section ref="couche" class="page" hidden aria-label="Connexion">
      <div class="voile"></div>
      <div class="defile defile-prog">
        <div class="p-top" data-c>
          <button class="rond" type="button" aria-label="Retour" @click="retour"><Icone nom="gauche" /></button>
          <span class="sur-titre">Connexion</span>
        </div>
        <div class="p-entete" data-c>
          <p class="sur-titre">Bon retour</p>
          <h1 class="titre-page">Votre identifiant<br>et votre code</h1>
        </div>

        <form ref="formulaire" class="cx-form" data-c novalidate @submit.prevent="envoyer">
          <label class="champ">
            <span>Identifiant</span>
            <input v-model="identifiant" type="text" name="identifiant" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="text" placeholder="prenom.nom" />
          </label>
          <label class="champ">
            <span>Code</span>
            <span class="champ-code">
              <input v-model="code" :type="voir ? 'text' : 'password'" name="code" autocomplete="current-password" autocapitalize="none" spellcheck="false" placeholder="Votre code" />
              <button type="button" class="voir" :aria-pressed="voir" @click="voir = !voir">{{ voir ? 'Masquer' : 'Afficher' }}</button>
            </span>
          </label>
          <p v-if="erreur" class="cx-erreur" role="alert">{{ erreur }}</p>
          <button ref="bouton" class="gros" type="submit" :disabled="occupe">Se connecter</button>
        </form>

        <!-- Comptes de démonstration : mode local uniquement -->
        <div v-if="demo" class="bloc cx-demo" data-c>
          <p class="sur-titre">Comptes de démonstration</p>
          <button v-for="c in COMPTES" :key="c.identifiant" class="cx-compte" type="button" @click="remplir(c)">
            <span>{{ c.libelle }}</span><small>{{ c.identifiant }} · {{ c.code }}</small>
          </button>
        </div>
      </div>
      <div ref="rideau" class="lancement" hidden></div>
    </section>
  </main>
</template>
