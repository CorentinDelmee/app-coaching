// Élément partagé ENTRE deux écrans (routes différentes). L'écran de départ mémorise l'élément touché (copie + position) ;
// l'écran d'arrivée en pose un « fantôme » invisible au même endroit et le passe à ouvrirPage / fermerPage, qui font naître
// (ou rentrer) la page dans ce rectangle. La mémoire expire vite : un retour par l'historique ne rejoue pas un vieux clic.
import { gsap } from 'gsap'
import { mouvementReduit } from './transitions.js'

let memo = null
let lancement = false

// `repos` : rectangle de l'élément AVANT qu'il ne se soulève (carte du tableau de bord) ; la page s'y refermera au retour.
// La taille de mise en page (offsetWidth/Height) est gardée : la copie est mise en page à cette taille puis mise à l'échelle,
// sinon son texte se remet en forme dans un rectangle agrandi (puces qui changent de ligne = micro-saut).
export function memoriserSource(el, repos) {
  memo = el ? { clone: el.cloneNode(true), rect: el.getBoundingClientRect(), repos: repos || null, lw: el.offsetWidth, lh: el.offsetHeight, t: Date.now() } : null
}
export function prendreSource() {
  const m = memo
  memo = null
  return m && Date.now() - m.t < 4000 ? m : null
}

/** Pose le fantôme dans la racine de l'écran d'arrivée (invisible, sans interaction) et le renvoie. */
export function poserFantome(racine, m) {
  const g = m.clone
  g.removeAttribute('id')
  g._repos = m.repos
  placerFantome(racine, g, m.rect, m.lw, m.lh)
  racine.appendChild(g)
  return g
}
// Le fantôme occupe le rectangle `rect` (vu à l'écran) ; mis en page à sa taille d'origine (lw × lh) puis mis à l'échelle.
function placerFantome(racine, g, rect, lw, lh) {
  const r = racine.getBoundingClientRect()
  const w = lw || rect.width, h = lh || rect.height
  const sx = rect.width / w, sy = rect.height / h
  const ech = Math.abs(sx - 1) > 0.002 || Math.abs(sy - 1) > 0.002 ? `;transform-origin:0 0;transform:scale(${sx},${sy})` : ''
  g.style.cssText = `position:absolute;margin:0;transition:none;pointer-events:none;visibility:hidden;left:${rect.left - r.left}px;top:${rect.top - r.top}px;width:${w}px;height:${h}px${ech}`
}
/** Retour : le fantôme reprend la place de la carte au repos (celle de la copie du tableau de bord quand la page s'y referme). */
export function reposerFantome(racine, g) {
  if (g && g._repos) placerFantome(racine, g, g._repos, g._repos.width, g._repos.height)
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
  // la carte soulevée se repose PENDANT que la page se referme dans son rectangle de repos : tout est en place quand le vrai
  // tableau de bord remplace la copie (sinon la carte, encore soulevée, sautait à sa place)
  const carte = dessous.querySelector('.carte[style*="scale"]')
  if (carte) gsap.to(carte, { '--lev': 0, z: 0, scale: 1, duration: duree, ease })
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
