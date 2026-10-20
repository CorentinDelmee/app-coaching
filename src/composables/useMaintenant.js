// Horloge d'images : `maintenant` (ms, horloge de l'app) est mise à jour à chaque image tant que le composant existe.
// Chaque chrono lit son propre `maintenant` : l'écran parent n'est pas redessiné 60 fois par seconde.
import { ref, onBeforeUnmount } from 'vue'
import { horloge } from '../lib/horloge.js'

export function useMaintenant() {
  const maintenant = ref(horloge.now())
  let raf = 0
  const boucle = () => { maintenant.value = horloge.now(); raf = requestAnimationFrame(boucle) }
  raf = requestAnimationFrame(boucle)
  onBeforeUnmount(() => cancelAnimationFrame(raf))
  return maintenant
}
