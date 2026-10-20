// Cycle de vie d'une page ouverte par une transition « élément partagé » (Programme, Workout) :
// ouvrir() fait naître la page depuis l'élément touché, la sortie (bouton retour ou retour du téléphone) la fait rentrer dedans.
import { onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { fermerPage, nettoyer, ouvrirPage } from '../anim/transitions.js'
import { poserFantome, prendreSource } from '../anim/passage.js'

export function usePageAnimee(retourDefaut) {
  const route = useRoute()
  const router = useRouter()
  const racine = ref(null) // élément [data-racine]
  const couche = ref(null) // la page animée (cachée jusqu'à ouvrir())
  let fantome = null
  let quitte = false

  /** À appeler quand le contenu est prêt (après nextTick). */
  function ouvrir(opts = {}) {
    const m = prendreSource()
    if (m) fantome = poserFantome(racine.value, m)
    return ouvrirPage(couche.value, fantome, opts)
  }
  const fermer = () => new Promise((fin) => fermerPage(couche.value, fantome, { onFini: fin }))

  /** Prévient que la sortie est déjà animée par l'appelant (ex. vers la séance) : pas de fermeture en plus. */
  const partir = () => { quitte = true }

  onBeforeRouteLeave(async () => {
    if (!quitte && couche.value && !couche.value.hidden) { quitte = true; await fermer() }
    return true
  })
  const retour = () => router.replace(route.query.retour || retourDefaut)

  onBeforeUnmount(() => { if (couche.value) nettoyer(couche.value); if (fantome) fantome.remove() })
  return { racine, couche, ouvrir, partir, retour }
}
