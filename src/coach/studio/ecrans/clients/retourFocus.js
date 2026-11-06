// Carte à refocaliser à la fermeture de la fiche (Échap, croix, glissé). Survit à un remontage de la liste
// (si le layout parent recrée l'écran à chaque changement de chemin, l'ancienne liste disparaît après le focus :
// la demande reste donc valable 1,5 s pour la nouvelle liste).
let attente = null
let minuteur = null
export function demanderFocus(id) {
  attente = id
  clearTimeout(minuteur)
  minuteur = setTimeout(() => { attente = null }, 1500)
}
export function rendreFocus() {
  if (!attente) return
  const carte = document.querySelector(`.st-clients-carte[data-client="${CSS.escape(attente)}"]`)
  // Carte disparue (client archivé) : première carte de la liste, sinon le champ de recherche.
  const cible = carte || document.querySelector('.st-clients-carte') || document.querySelector('.st-clients-recherche input')
  cible?.focus({ preventScroll: !carte })
}
