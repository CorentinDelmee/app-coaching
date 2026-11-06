// Après la fermeture d'un panneau sous le pointeur, le 2e clic d'un double-clic tomberait sur ce qui remonte à sa place
// (ex. une carte qui ouvre une autre page) : on ignore les clics pendant un court instant.
export function ignorerClics(ms = 400) {
  const f = (e) => { e.stopPropagation(); e.preventDefault() }
  window.addEventListener('click', f, true)
  setTimeout(() => window.removeEventListener('click', f, true), ms)
}
