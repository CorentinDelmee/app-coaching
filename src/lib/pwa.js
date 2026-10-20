// Service worker : précache de l'app (le build le génère), mise à jour « propre ». Une nouvelle version est mise en attente ;
// elle s'applique à la première navigation hors séance et sans séance sauvegardée, jamais en plein exercice.
import { registerSW } from 'virtual:pwa-register'
import { lireSeanceEnCours } from './seanceEnCours.js'

export function installerPWA(router) {
  let enAttente = false
  const appliquer = registerSW({
    onNeedRefresh() { enAttente = true },
    onRegisteredSW(_url, reg) {
      // cherche une nouvelle version toutes les heures quand l'app reste ouverte
      if (reg) setInterval(() => reg.update().catch(() => {}), 3600000)
    }
  })
  router.beforeEach((to) => {
    if (enAttente && to.name !== 'seance' && !lireSeanceEnCours()) {
      enAttente = false
      appliquer(true) // active la nouvelle version puis recharge la page
    }
  })
}
