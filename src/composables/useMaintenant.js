// Horloge d'images : `maintenant` (ms, horloge de l'app) est mise à jour à chaque image tant que le composant existe
// (ou, si `actif` est fourni, tant qu'il vaut true : pas de boucle inutile pour un élément masqué).
// Chaque chrono lit son propre `maintenant` : l'écran parent n'est pas redessiné 60 fois par seconde.
import { ref, watch, onBeforeUnmount } from 'vue'
import { horloge } from '../lib/horloge.js'

export function useMaintenant(actif = null) {
  const maintenant = ref(horloge.now())
  let raf = 0
  const boucle = () => { maintenant.value = horloge.now(); raf = requestAnimationFrame(boucle) }
  const demarrer = () => { if (!raf) raf = requestAnimationFrame(boucle) }
  const arreter = () => { cancelAnimationFrame(raf); raf = 0 }
  if (actif) watch(actif, (a) => (a ? demarrer() : arreter()), { immediate: true })
  else demarrer()
  onBeforeUnmount(arreter)
  return maintenant
}
