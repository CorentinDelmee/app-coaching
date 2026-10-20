// Écran maintenu allumé pendant la séance (Wake Lock). Réacquis au retour sur l'onglet (le navigateur le libère en arrière-plan).
let verrou = null
let actif = false

async function demander() {
  if (!actif || verrou || !('wakeLock' in navigator)) return
  try {
    verrou = await navigator.wakeLock.request('screen')
    verrou.addEventListener('release', () => { verrou = null })
  } catch { verrou = null /* refusé (économie d'énergie) : tant pis */ }
}
const auRetour = () => { if (document.visibilityState === 'visible') demander() }

export function activerWakeLock() {
  if (actif) return
  actif = true
  document.addEventListener('visibilitychange', auRetour)
  demander()
}
export function libererWakeLock() {
  actif = false
  document.removeEventListener('visibilitychange', auRetour)
  if (verrou) { verrou.release().catch(() => {}); verrou = null }
}
