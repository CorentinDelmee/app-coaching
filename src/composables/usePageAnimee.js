// Cycle de vie d'une page ouverte par une transition « élément partagé » (Programme, Workout) :
// ouvrir() fait naître la page depuis l'élément touché, la sortie (bouton retour ou retour du téléphone) la fait rentrer dedans.
import { onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { fermerPage, nettoyer, ouvrirPage } from '../anim/transitions.js'
import { cacherDessous, consommerRetour, consommerSaut, marquerRetour, poserFantome, prendreSource, rapprocherDessous, reculerDessous, reposerFantome, retirerDessous } from '../anim/passage.js'
import { M5, T } from '../anim/constantes.js'

export function usePageAnimee(retourDefaut) {
  const route = useRoute()
  const router = useRouter()
  const racine = ref(null) // élément [data-racine]
  const couche = ref(null) // la page animée (cachée jusqu'à ouvrir())
  let fantome = null
  let quitte = false

  /** À appeler quand le contenu est prêt (après nextTick). Renvoie la timeline, ou null si l'entrée est sautée. */
  function ouvrir(opts = {}) {
    if (!couche.value) return null // page sans contenu (ex. workout introuvable) : rien à animer
    const m = prendreSource()
    // retour depuis une page qui vient de se refermer dans sa carte : on montre la page telle quelle (renvoie null)
    if (consommerRetour()) { couche.value.hidden = false; return null }
    if (m) fantome = poserFantome(racine.value, m)
    // M5 : la page d'où l'on vient (copie du tableau de bord) recule derrière pendant que celle-ci s'ouvre
    // (le fond de l'écran est rendu transparent le temps de l'ouverture : seule la page découpée le couvre)
    const avecDessous = reculerDessous(M5.T.page, M5.E.page)
    if (avecDessous) racine.value.style.background = 'transparent'
    return ouvrirPage(couche.value, fantome, { ...opts, onFini: () => { cacherDessous(); if (racine.value) racine.value.style.background = ''; opts.onFini?.() } })
  }
  const fermer = () => new Promise((fin) => {
    // la page se referme dans la carte AU REPOS, et la copie du tableau de bord revient en même temps que la fermeture
    // (0,06 + T.ferme) : quand le vrai tableau de bord la remplace, tout est déjà à sa place
    if (fantome && racine.value) reposerFantome(racine.value, fantome)
    if (rapprocherDessous(Math.min(M5.T.retour, 0.06 + T.ferme), M5.E.page) && racine.value) racine.value.style.background = 'transparent'
    fermerPage(couche.value, fantome, { onFini: fin })
  })

  /** Prévient que la sortie est déjà animée par l'appelant (ex. vers la séance) : pas de fermeture en plus. */
  const partir = () => { quitte = true }

  onBeforeRouteLeave(async () => {
    if (!quitte && couche.value && !couche.value.hidden) {
      quitte = true
      if (!consommerSaut()) { await fermer(); marquerRetour() }
    }
    return true
  })
  // la copie du tableau de bord ne sert qu'au retour vers lui : partout ailleurs (menu, autre page), elle disparaît
  onBeforeRouteLeave((to) => { if (to.name !== 'accueil') retirerDessous() })
  // Vrai retour si la page précédente de l'historique est la cible (pas de copie empilée) ; sinon (adresse ouverte directement) replace.
  const retour = () => {
    const cible = route.query.retour || retourDefaut
    const avant = (window.history.state?.back || '').split('?')[0]
    if (avant && avant === String(cible).split('?')[0]) return router.back()
    return router.replace(cible)
  }

  onBeforeUnmount(() => { if (couche.value) nettoyer(couche.value); if (fantome) fantome.remove() })
  return { racine, couche, ouvrir, partir, retour }
}
