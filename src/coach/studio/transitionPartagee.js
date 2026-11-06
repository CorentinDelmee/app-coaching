// Élément partagé (le moment fort du Studio) : la vignette « s'envole » vers l'en-tête du panneau ou de la fiche.
// FLIP piloté par requestAnimationFrame : un calque fixe (.st-volant) part du rectangle de départ et rejoint celui
// d'arrivée. Le calque est mis à l'échelle (sx, sy) ; son contenu reçoit une CONTRE-ÉCHELLE (k/sx, k/sy) avec
// k = max(sx, sy) : l'image est recadrée (comme object-fit: cover), jamais étirée, même de 4:3 vers 16:9.
// Seulement transform (+ border-radius sur un petit calque). prefers-reduced-motion : rien ne vole, la promesse se résout tout de suite.
//
// Usage :
//   import { volerVers } from './transitionPartagee.js'
//   await nextTick()                                   // le panneau est rendu
//   volerVers(elMediaVignette, elMediaPanneau, { muscle: 'dos' })

/** Courbe de Bézier cubique (x1, y1, x2, y2) -> fonction t ∈ [0,1] -> progression. Pure, testée. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const x = (s) => ((ax * s + bx) * s + cx) * s
  const y = (s) => ((ay * s + by) * s + cy) * s
  const dx = (s) => (3 * ax * s + 2 * bx) * s + cx
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let s = t
    for (let i = 0; i < 8; i++) { // Newton
      const e = x(s) - t
      if (Math.abs(e) < 1e-6) return y(s)
      const d = dx(s)
      if (Math.abs(d) < 1e-6) break
      s -= e / d
    }
    let lo = 0, hi = 1; s = t // dichotomie de secours
    while (hi - lo > 1e-6) { if (x(s) < t) lo = s; else hi = s; s = (lo + hi) / 2 }
    return y(s)
  }
}

/** Courbe « Vaul » du DESIGN.md (panneau, feuille, élément partagé). */
export const vaul = bezier(0.32, 0.72, 0, 1)

/**
 * État du calque à la progression p (0 = départ, 1 = arrivée). Pure, testée.
 * a, b : rectangles { left, top, width, height } (départ, arrivée). Le calque est posé sur b (origine en haut à gauche).
 * @returns {{ calque: string, contenu: string, rayon: string, sx: number, sy: number }}
 */
export function etapeFlip(a, b, p, { rayonDepart = 20, rayonArrivee = 28 } = {}) {
  const l = (u, v) => u + (v - u) * p
  const sx = l(a.width / b.width, 1)
  const sy = l(a.height / b.height, 1)
  const tx = l(a.left - b.left, 0)
  const ty = l(a.top - b.top, 0)
  const k = Math.max(sx, sy)
  const r = l(rayonDepart, rayonArrivee)
  return {
    sx, sy,
    calque: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`,
    contenu: `scale(${k / sx}, ${k / sy})`,
    // rayon elliptique compensé : à l'écran il reste rond malgré sx ≠ sy
    rayon: `${r / sx}px / ${r / sy}px`
  }
}

const rect = (x) => (x && typeof x.getBoundingClientRect === 'function' ? x.getBoundingClientRect() : x)

/**
 * Rectangle d'arrivée « au repos » : le panneau est souvent encore en train d'entrer (translateY(100%) sur téléphone,
 * translateX(24px) sur ordinateur) quand on mesure. On retire les translations des ancêtres pour viser sa place finale.
 */
export function rectFinal(el) {
  const r = el.getBoundingClientRect()
  let dx = 0, dy = 0
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const t = getComputedStyle(n).transform
    if (t && t !== 'none') { const m = new DOMMatrixReadOnly(t); dx += m.m41; dy += m.m42 }
  }
  return { left: r.left - dx, top: r.top - dy, width: r.width, height: r.height }
}

export const mouvementReduit = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Fait voler une copie de `depuis` jusqu'à `vers`.
 * @param {Element|DOMRect} depuis  élément (son contenu est cloné) ou rectangle de départ
 * @param {Element} vers  élément d'arrivée (masqué pendant le vol, réaffiché à la fin)
 * @param {{ duree?: number, muscle?: string|null, contenu?: Element, rayonDepart?: number, rayonArrivee?: number }} [o]
 *   contenu : nœud à faire voler à la place du clone de `depuis` (ex. quand la vignette n'existe plus)
 * @returns {{ fini: Promise<void>, annuler: () => void }}
 */
export function volerVers(depuis, vers, o = {}) {
  const rien = { fini: Promise.resolve(), annuler() {} }
  if (!vers || typeof document === 'undefined' || mouvementReduit()) return rien
  const a = rect(depuis)
  const b = rectFinal(vers)
  if (!a || !a.width || !b.width || !b.height) return rien
  const { duree = 500, muscle = null, rayonDepart = 20, rayonArrivee = 28 } = o

  const calque = document.createElement('div')
  calque.className = 'st-volant'
  calque.setAttribute('aria-hidden', 'true')
  if (muscle) calque.dataset.m = muscle
  calque.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;transform-origin:0 0`
  const interieur = document.createElement('div')
  interieur.className = 'st-volant-in'
  const source = o.contenu || (depuis instanceof Element ? depuis : null)
  if (source) {
    const clone = source.cloneNode(true)
    clone.removeAttribute?.('id')
    clone.querySelectorAll?.('[id]').forEach((n) => n.removeAttribute('id'))
    interieur.appendChild(clone)
  }
  calque.appendChild(interieur)
  ;(vers.closest('.st-app') || document.body).appendChild(calque)

  const visibiliteAvant = vers.style.visibility
  vers.style.visibility = 'hidden'
  let raf = 0
  let finir
  const fini = new Promise((r) => { finir = r })
  const nettoyer = () => {
    cancelAnimationFrame(raf)
    vers.style.visibility = visibiliteAvant
    calque.remove()
    finir()
  }
  const peindre = (p) => {
    const e = etapeFlip(a, b, p, { rayonDepart, rayonArrivee })
    calque.style.transform = e.calque
    calque.style.borderRadius = e.rayon
    interieur.style.transform = e.contenu
    calque.style.opacity = String(Math.min(1, 0.4 + p * 3))
  }
  peindre(0)
  let t0 = null
  const pas = (t) => {
    if (t0 === null) t0 = t
    const brut = Math.min(1, (t - t0) / duree)
    peindre(vaul(brut))
    if (brut < 1) raf = requestAnimationFrame(pas)
    else nettoyer()
  }
  raf = requestAnimationFrame(pas)
  return { fini, annuler: nettoyer }
}
