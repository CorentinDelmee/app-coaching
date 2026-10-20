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

/* Retour animé : quand une page vient de se refermer dans sa carte (fermerPage), la page d'arrivée s'affiche telle quelle
   au lieu de rejouer son entrée (sinon la même arrivée serait animée deux fois). Expire en 3 s. */
let retourLe = 0
export const marquerRetour = () => { retourLe = Date.now() }
export function consommerRetour() { const r = retourLe && Date.now() - retourLe < 3000; retourLe = 0; return !!r }

/* Navigation par le menu : le rideau d'accent couvre déjà l'écran, on ne rejoue pas la fermeture de la page quittée. */
let sautLe = 0
export const sauterFermeture = () => { sautLe = Date.now() }
export function consommerSaut() { const s = sautLe && Date.now() - sautLe < 1500; sautLe = 0; return !!s }

/* Lancement d'une séance : la page Workout couvre l'écran d'un cercle d'accent depuis « Démarrer », puis la séance
   prend le relais avec un rideau de la même couleur qui s'efface (au lieu de son cercle habituel depuis le bas). */
export function marquerLancement() { lancement = true }
export function consommerLancement() { const l = lancement; lancement = false; return l }

/* Séance validée : retour au tableau de bord, où l'écran de fin (copie) se referme dans la carte « Cette semaine », qui gagne
   alors sa séance (anneau + compteur). `realisationId` permet au tableau de bord de calculer le chiffre d'avant. Expire en 4 s. */
let finSeance = null
export function marquerFinSeance(el, realisationId) {
  finSeance = { clone: el ? el.cloneNode(true) : null, realisationId, t: Date.now() }
}
export function consommerFinSeance() { const f = finSeance; finSeance = null; return f && Date.now() - f.t < 4000 ? f : null }

export function leverRideau(racine) {
  const rideau = document.createElement('div')
  rideau.style.cssText = 'position:absolute;inset:0;z-index:500;background:var(--accent);pointer-events:none'
  racine.appendChild(rideau)
  gsap.to(rideau, { opacity: 0, duration: mouvementReduit() ? 0.2 : 0.55, delay: 0.05, ease: 'power2.out', onComplete: () => rideau.remove() })
}
