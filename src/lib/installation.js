// Installation de l'app (PWA) : l'événement `beforeinstallprompt` est capté dès le démarrage (il part avant l'affichage de la page).
import { ref } from 'vue'

/** iPhone / iPad (y compris iPadOS qui se présente comme un Mac tactile). Pur : testé. */
export function estIOS(ua = '', pointsTactiles = 0) {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && pointsTactiles > 1)
}

/** iPhone / iPad dans un autre navigateur que Safari (Chrome, Firefox, Edge, ou navigateur intégré d'Instagram/Facebook) : l'installation n'y est pas possible. Pur : testé. */
export function estIOSHorsSafari(ua = '') {
  return /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram/.test(ua)
}

export const installee = ref(false)      // déjà lancée comme une app : le bouton disparaît
export const peutInstaller = ref(false)  // le navigateur propose l'installation en un geste
export const surIOS = ref(false)
export const horsSafari = ref(false)    // sur iOS mais pas dans Safari : demander d'ouvrir l'adresse dans Safari
let evenement = null

export function ecouterInstallation() {
  if (typeof window === 'undefined') return
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  installee.value = standalone()
  surIOS.value = estIOS(window.navigator.userAgent, window.navigator.maxTouchPoints)
  horsSafari.value = surIOS.value && estIOSHorsSafari(window.navigator.userAgent)
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); evenement = e; peutInstaller.value = true })
  window.addEventListener('appinstalled', () => { installee.value = true; peutInstaller.value = false; evenement = null })
}

/** Lance l'invite du navigateur. Renvoie 'accepte' | 'refuse' | 'indisponible' (pas d'invite : montrer les instructions). */
export async function installer() {
  if (!evenement) return 'indisponible'
  evenement.prompt()
  const { outcome } = await evenement.userChoice
  evenement = null
  peutInstaller.value = false
  return outcome === 'accepted' ? 'accepte' : 'refuse'
}
