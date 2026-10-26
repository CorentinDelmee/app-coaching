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
  if (mouvementReduit()) { gsap.to(rideau, { opacity: 0, duration: 0.2, onComplete: () => rideau.remove() }); return }
  // le voile jaune se relève (maquette V2) : un fondu jaune -> fond passerait par une teinte sale en ambiance sombre
  gsap.fromTo(rideau, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.62, delay: 0.05, ease: 'expo.inOut', onComplete: () => rideau.remove() })
}

/* Page « dessous » (M5 ouvrirCarte / fermerCarte) : quand une carte du tableau de bord ouvre sa page, une copie inerte du tableau de
   bord reste derrière la nouvelle page et recule (scale .92) ; au retour elle se rapproche (scale 1) pendant que la page se referme
   dans sa carte, puis le vrai tableau de bord la remplace (retirerDessous). La copie n'est jamais touchable ni lue (inert). */
let dessous = null
let minuterie = 0
export function poserDessous(ecran) {
  retirerDessous()
  if (!ecran) return
  const c = ecran.cloneNode(true)
  c.removeAttribute('data-racine')
  c.className = 'ecran-dessous'
  c.inert = true
  c.setAttribute('aria-hidden', 'true')
  c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
  document.body.appendChild(c)
  dessous = c
}
/** La page qui s'ouvre fait reculer la copie (rien si aucune copie, ou mouvement réduit). */
export function reculerDessous(duree, ease) {
  if (!dessous || mouvementReduit()) return false
  gsap.to(dessous, { scale: 0.92, duration: duree, ease })
  return true
}
/** Page refermée dans sa carte : la copie revient (la carte soulevée se repose) ; retirée par le tableau de bord une fois prêt. */
export function rapprocherDessous(duree, ease) {
  if (!dessous) return false
  dessous.style.visibility = ''
  if (mouvementReduit()) { gsap.set(dessous, { scale: 1 }); return true }
  gsap.to(dessous, { scale: 1, duration: duree, ease })
  const carte = dessous.querySelector('.carte[style*="scale"]')
  if (carte) gsap.to(carte, { '--lev': 0, z: 0, scale: 1, duration: 0.5, delay: 0.3, ease: 'expo.out' })
  clearTimeout(minuterie)
  minuterie = setTimeout(retirerDessous, 3000) // filet : si le tableau de bord n'arrive pas, la copie ne reste pas
  return true
}
/** Page ouverte et pleine : la copie, cachée derrière, n'est plus peinte (mais gardée pour le retour). */
export function cacherDessous() { if (dessous) dessous.style.visibility = 'hidden' }
export function retirerDessous() {
  clearTimeout(minuterie)
  if (dessous) { gsap.killTweensOf(dessous); dessous.remove(); dessous = null }
}
