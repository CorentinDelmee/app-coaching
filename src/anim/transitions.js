// Transitions de la direction M1 « Atelier », portées de design/m1/assets/anim.js.
// Signature : la RÉVÉLATION PAR CLIP-PATH depuis l'élément touché. Chaque fonction reçoit la couche à animer
// (élément DOM) et l'élément source ; elle gère la couche via gsap (timeline stockée dans couche._tl).
// Anime seulement transform / opacity / clip-path (+ le tracé d'un anneau SVG). Mouvement réduit : fondus courts.
import { gsap } from 'gsap'
import { T, E, PLEIN } from './constantes.js'
import { racineDe, rectDe, insetDe, centreDe, rayonMax, cercle, hauteurDe } from './geometrie.js'

export const mouvementReduit = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const rm = mouvementReduit

const $$ = (sel, ec) => Array.from(ec.querySelectorAll(sel))

/** À appeler au démontage d'une couche : stoppe sa timeline. */
export function nettoyer(couche) {
  if (couche && couche._tl) { couche._tl.kill(); couche._tl = null }
}

/* ---------- Cascade d'entrée du contenu d'une couche (éléments data-c) ---------- */
export function cascade(ec, opts = {}) {
  const els = $$('[data-c]', ec)
  if (!els.length) return null
  if (rm()) return gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.25, clearProps: 'opacity' })
  return gsap.fromTo(els, { y: 46, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.9, stagger: T.cascade, ease: E.sortie, delay: opts.delay || 0, clearProps: 'transform,opacity' })
}

/* ---------- Voile : couleur + clone de l'élément source, qui fait le lien visuel ---------- */
// Le .voile est un div vide rendu par le gabarit Vue (jamais de nœuds Vue dedans) ; sinon il est créé ici.
function voileDe(couche) {
  let v = couche.querySelector(':scope > .voile')
  if (!v) { v = document.createElement('div'); v.className = 'voile'; couche.appendChild(v) }
  return v
}
function remplirVoile(couche, src, racine, rayonDefaut, opacite) {
  const v = voileDe(couche)
  v.innerHTML = ''; v.style.display = ''; v.style.opacity = opacite; v.style.clipPath = ''
  if (!src) { v.style.background = 'var(--fond)'; return v }
  const cs = getComputedStyle(src)
  const q = rectDe(src, racine)
  const col = cs.backgroundColor
  v.style.background = col && col !== 'rgba(0, 0, 0, 0)' && col !== 'transparent' ? col : 'var(--surface)'
  const c = src.cloneNode(true)
  c.removeAttribute('id'); $$('[id]', c).forEach((n) => n.removeAttribute('id'))
  c.style.cssText = `position:absolute;margin:0;transition:none;transform:none;opacity:1;left:${q.l}px;top:${q.t}px;width:${q.w}px;height:${q.h}px;border-radius:${cs.borderRadius || rayonDefaut + 'px'}`
  $$('[data-c]', c).forEach((n) => { n.style.opacity = 1; n.style.transform = 'none' })
  v.appendChild(c)
  return v
}

/* ---------- 1. Carte -> page : la page naît du rectangle de l'élément touché ---------- */
export function ouvrirPage(ec, src, opts = {}) {
  nettoyer(ec)
  const racine = racineDe(ec)
  ec.hidden = false
  ec.style.pointerEvents = 'none'
  const v = remplirVoile(ec, src, racine, 26, 1)
  $$('[data-c]', ec).forEach((n) => { n.style.opacity = 0 })
  const fin = () => {
    ec.style.pointerEvents = ''; gsap.set(ec, { clearProps: 'clipPath,opacity' }); v.style.display = 'none'
    if (opts.onFini) opts.onFini()
  }
  if (rm() || (!src && !opts.depuis)) {
    ec._tl = gsap.timeline({ onComplete: fin })
      .fromTo(ec, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0)
      .to(v, { opacity: 0, duration: 0.2 }, 0)
      .add(() => cascade(ec), 0.05)
    return ec._tl
  }
  const dep = src ? insetDe(src, racine, opts.rayon) : opts.depuis
  ec._tl = gsap.timeline({ onComplete: fin })
    .fromTo(ec, { clipPath: dep }, { clipPath: PLEIN, duration: T.ouvre, ease: E.ouvre }, 0)
    .fromTo(v, { clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: `inset(0px 0px ${hauteurDe(racine)}px 0px)`, duration: 0.62, ease: 'expo.inOut', immediateRender: false }, T.ouvre * 0.46)
    .add(() => cascade(ec), T.ouvre * 0.4)
  return ec._tl
}

/* ---------- 2. Page -> carte (plus rapide, asymétrique) ---------- */
export function fermerPage(ec, src, opts = {}) {
  nettoyer(ec)
  const racine = racineDe(ec)
  ec.style.pointerEvents = 'none'
  const fin = () => {
    ec.hidden = true; ec.style.pointerEvents = ''; gsap.set(ec, { clearProps: 'clipPath,opacity' })
    if (opts.onFini) opts.onFini()
  }
  if (rm()) { ec._tl = gsap.timeline({ onComplete: fin }).to(ec, { opacity: 0, duration: 0.2 }); return ec._tl }
  const cible = src && src.isConnected && src.offsetParent !== null ? src : null
  const v = remplirVoile(ec, cible, racine, 26, 0)
  const vers = cible ? insetDe(cible, racine) : `inset(${hauteurDe(racine)}px 0px 0px 0px round 26px)`
  ec._tl = gsap.timeline({ onComplete: fin })
    .to(v, { opacity: cible ? 1 : 0, duration: 0.12, ease: 'power1.out' }, 0)
    .fromTo(ec, { clipPath: PLEIN }, { clipPath: vers, duration: T.ferme, ease: cible ? E.ferme : 'power3.inOut', immediateRender: false }, 0.06)
  return ec._tl
}

/* ---------- 3. Cercle depuis un bouton (chrono, repos, fin…) ---------- */
// `src` : l'élément touché (le cercle naît de son centre) ; sans `src`, depuis le bas de l'écran.
export function ouvrirCercle(couche, src, opts = {}) {
  nettoyer(couche)
  const racine = racineDe(couche)
  couche.hidden = false
  const c = src && src.isConnected ? centreDe(src, racine) : { x: racine.offsetWidth / 2, y: racine.offsetHeight - 90 }
  couche._centre = c
  const R = rayonMax(c.x, c.y, racine)
  const fin = () => { gsap.set(couche, { clearProps: 'clipPath,opacity' }); if (opts.onFini) opts.onFini() }
  if (rm()) { couche._tl = gsap.fromTo(couche, { opacity: 0 }, { opacity: 1, duration: 0.2, onComplete: fin }); return couche._tl }
  couche._tl = gsap.fromTo(couche, { clipPath: cercle(src ? 26 : 0, c.x, c.y) },
    { clipPath: cercle(R, c.x, c.y), duration: opts.duree || T.cercleOuvre, ease: E.cercle, onComplete: fin })
  return couche._tl
}
// `vers` : élément (le cercle se referme sur son centre), point { x, y }, ou rien (retour au point d'ouverture).
export function fermerCercle(couche, vers, opts = {}) {
  nettoyer(couche)
  const racine = racineDe(couche)
  const c = vers && vers.x !== undefined ? vers : vers && vers.isConnected ? centreDe(vers, racine) : couche._centre || { x: racine.offsetWidth / 2, y: racine.offsetHeight - 90 }
  const R = rayonMax(c.x, c.y, racine)
  const fin = () => { couche.hidden = true; gsap.set(couche, { clearProps: 'clipPath,opacity' }); if (opts.onFini) opts.onFini() }
  if (rm()) { couche._tl = gsap.to(couche, { opacity: 0, duration: 0.18, onComplete: fin }); return couche._tl }
  couche._tl = gsap.fromTo(couche, { clipPath: cercle(R, c.x, c.y) },
    { clipPath: cercle(26, c.x, c.y), duration: opts.duree || T.cercleFerme, ease: E.ferme, onComplete: fin, immediateRender: false })
  return couche._tl
}

/* ---------- 4. Rectangle depuis un élément (série, valeur -> roue) ---------- */
export function ouvrirRect(couche, src, opts = {}) {
  nettoyer(couche)
  const racine = racineDe(couche)
  couche.hidden = false
  const v = remplirVoile(couche, src, racine, 22, 1)
  const els = $$('[data-c]', couche)
  gsap.set(els, { opacity: 0 })
  const fin = () => { gsap.set(couche, { clearProps: 'clipPath,opacity' }); v.style.display = 'none'; if (opts.onFini) opts.onFini() }
  if (rm() || !src) {
    couche._tl = gsap.timeline({ onComplete: fin }).fromTo(couche, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
      .to(v, { opacity: 0, duration: 0.15 }, 0).to(els, { opacity: 1, duration: 0.2 }, 0)
    return couche._tl
  }
  couche._tl = gsap.timeline({ onComplete: fin })
    .fromTo(couche, { clipPath: insetDe(src, racine, opts.rayon || 24) }, { clipPath: PLEIN, duration: opts.duree || T.rectOuvre, ease: E.rect }, 0)
    .fromTo(v, { clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: `inset(0px 0px ${hauteurDe(racine)}px 0px)`, duration: 0.5, ease: 'expo.inOut', immediateRender: false }, 0.3)
    .fromTo(els, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: E.sortie, clearProps: 'transform,opacity' }, 0.3)
  return couche._tl
}
export function fermerRect(couche, src, opts = {}) {
  nettoyer(couche)
  const racine = racineDe(couche)
  const fin = () => { couche.hidden = true; gsap.set(couche, { clearProps: 'clipPath,opacity' }); if (opts.onFini) opts.onFini() }
  if (rm() || !src || !src.isConnected) { couche._tl = gsap.to(couche, { opacity: 0, duration: 0.18, onComplete: fin }); return couche._tl }
  // le voile reprend la couleur et le contenu de l'élément cible (son état actuel)
  const v = remplirVoile(couche, src, racine, 22, 0)
  couche._tl = gsap.timeline({ onComplete: fin })
    .to(v, { opacity: 1, duration: 0.18 }, 0)
    .to(couche, { clipPath: insetDe(src, racine, opts.rayon || 24), duration: opts.duree || T.rectFerme, ease: 'power3.inOut' }, 0.05)
  return couche._tl
}

/* ---------- Compteurs : défilent puis décélèrent (jamais d'arrêt net) ---------- */
export function compter(el, de, a, opts = {}) {
  const fmt = opts.fmt || ((v) => String(Math.round(v)))
  el.textContent = fmt(de)
  if (rm()) { el.textContent = fmt(a); return null }
  const o = { v: de }
  return gsap.to(o, {
    v: a, duration: opts.duree || 1.4, delay: opts.delay || 0, ease: opts.ease || 'power3.out',
    onUpdate: () => { el.textContent = fmt(o.v) }, onComplete: () => { el.textContent = fmt(a) }
  })
}

/* ---------- Ressort discret au relâchement d'un bouton ---------- */
let ressortInstalle = false
export function installerRessort() {
  if (ressortInstalle || typeof document === 'undefined') return
  ressortInstalle = true
  document.addEventListener('pointerup', (e) => {
    const b = e.target.closest && e.target.closest('.gros, .rond, .btn-gros, .rang-btn button, .btn-menu, .btn-ressort')
    if (!b || rm() || b.dataset.sansRessort) return
    gsap.fromTo(b, { scale: 0.955 }, { scale: 1, duration: 0.6, ease: 'back.out(2.6)', overwrite: 'auto', clearProps: 'transform' })
  }, true)
}
