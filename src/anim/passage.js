// Élément partagé ENTRE deux écrans (routes différentes). L'écran de départ mémorise l'élément touché (copie + position) ;
// l'écran d'arrivée en pose un « fantôme » invisible au même endroit et le passe à ouvrirPage / fermerPage, qui font naître
// (ou rentrer) la page dans ce rectangle. La mémoire expire vite : un retour par l'historique ne rejoue pas un vieux clic.
import { gsap } from 'gsap'
import { mouvementReduit } from './transitions.js'

let memo = null
let lancement = false

export function memoriserSource(el) {
  memo = el ? { clone: el.cloneNode(true), rect: el.getBoundingClientRect(), t: Date.now() } : null
}
export function prendreSource() {
  const m = memo
  memo = null
  return m && Date.now() - m.t < 4000 ? m : null
}

/** Pose le fantôme dans la racine de l'écran d'arrivée (invisible, sans interaction) et le renvoie. */
export function poserFantome(racine, m) {
  const r = racine.getBoundingClientRect()
  const g = m.clone
  g.removeAttribute('id')
  g.style.cssText = `position:absolute;margin:0;pointer-events:none;visibility:hidden;left:${m.rect.left - r.left}px;top:${m.rect.top - r.top}px;width:${m.rect.width}px;height:${m.rect.height}px`
  racine.appendChild(g)
  return g
}

/* Lancement d'une séance : la page Workout couvre l'écran d'un cercle d'accent depuis « Démarrer », puis la séance
   prend le relais avec un rideau de la même couleur qui s'efface (au lieu de son cercle habituel depuis le bas). */
export function marquerLancement() { lancement = true }
export function consommerLancement() { const l = lancement; lancement = false; return l }

export function leverRideau(racine) {
  const rideau = document.createElement('div')
  rideau.style.cssText = 'position:absolute;inset:0;z-index:500;background:var(--accent);pointer-events:none'
  racine.appendChild(rideau)
  gsap.to(rideau, { opacity: 0, duration: mouvementReduit() ? 0.2 : 0.55, delay: 0.05, ease: 'power2.out', onComplete: () => rideau.remove() })
}
