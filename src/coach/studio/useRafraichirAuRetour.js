// Recharge l'écran quand le coach y revient (onglet de nouveau visible, ou fenêtre qui reprend le focus : Mac + téléphone),
// pour voir ce que Claude ou un autre appareil a changé. Jamais pendant une saisie non enregistrée (sauvegarde.occupe()).
// Usage : useRafraichirAuRetour(charger, { sauvegarde: s })   — charger() relit les données ET rappelle s.suivreVersion(...)
import { onBeforeUnmount, onMounted } from 'vue'

/**
 * @param {() => any} fn  rechargement (peut être async)
 * @param {{ sauvegarde?: { occupe: () => boolean }, intervalle?: number, cible?: { document, window } }} [options]
 *   intervalle : au plus un rechargement par intervalle (ms) — visibilitychange et focus arrivent souvent ensemble
 */
export function creerRafraichirAuRetour(fn, { sauvegarde, intervalle = 2000, cible = globalThis, now = () => Date.now() } = {}) {
  let dernier = now() // l'écran vient d'être chargé
  let enCours = false
  const doc = cible.document
  async function surRetour() {
    if (doc?.visibilityState === 'hidden' || enCours) return
    if (sauvegarde?.occupe?.()) return
    if (now() - dernier < intervalle) return
    dernier = now()
    enCours = true
    try { await fn() } catch { /* l'écran affiche ses propres erreurs de chargement */ } finally { enCours = false }
  }
  return {
    surRetour,
    brancher() { doc?.addEventListener('visibilitychange', surRetour); cible.window?.addEventListener?.('focus', surRetour) },
    debrancher() { doc?.removeEventListener('visibilitychange', surRetour); cible.window?.removeEventListener?.('focus', surRetour) }
  }
}

/** Version composable (à appeler dans setup) : branché au montage, débranché au démontage. */
export function useRafraichirAuRetour(fn, options = {}) {
  const r = creerRafraichirAuRetour(fn, options)
  onMounted(r.brancher)
  onBeforeUnmount(r.debrancher)
  return r
}
