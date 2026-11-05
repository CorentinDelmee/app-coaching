// Toast du Studio (un seul à la fois, affiché par <ToastSt /> monté dans CoachLayout).
// Usage : toast('Vidéo validée', { action: 'Annuler', surAction: () => annuler(), duree: 5000 })
import { reactive } from 'vue'

export const etatToast = reactive({ visible: false, message: '', action: '', surAction: null, cle: 0 })
let minuteur = null

export function toast(message, { action = '', surAction = null, duree = 4500 } = {}) {
  clearTimeout(minuteur)
  Object.assign(etatToast, { visible: true, message, action, surAction, cle: etatToast.cle + 1 })
  minuteur = setTimeout(fermerToast, duree)
}

export function fermerToast() {
  clearTimeout(minuteur)
  etatToast.visible = false
}

export function agirToast() {
  const f = etatToast.surAction
  fermerToast()
  if (f) f()
}
