// Géométrie des transitions : toutes les coordonnées sont relatives à la « racine » de l'écran
// (élément marqué data-racine, parent de la couche animée). Le CSS clip-path s'exprime dans ce repère.

export const racineDe = (el) => el.closest('[data-racine]') || document.documentElement

function geo(racine) {
  const r = racine.getBoundingClientRect()
  const W = racine.offsetWidth || r.width
  return { r, W, H: racine.offsetHeight || r.height, k: r.width / (racine.offsetWidth || r.width) }
}

export function rectDe(el, racine) {
  const g = geo(racine)
  const b = el.getBoundingClientRect()
  return {
    t: (b.top - g.r.top) / g.k, l: (b.left - g.r.left) / g.k, r: (b.right - g.r.left) / g.k, b: (b.bottom - g.r.top) / g.k,
    w: b.width / g.k, h: b.height / g.k, W: g.W, H: g.H
  }
}

/** clip-path « inset » qui épouse exactement l'élément `el`. */
export function insetDe(el, racine, rayon = 26) {
  const q = rectDe(el, racine)
  return `inset(${q.t}px ${q.W - q.r}px ${q.H - q.b}px ${q.l}px round ${rayon}px)`
}

export function centreDe(el, racine) {
  const q = rectDe(el, racine)
  return { x: (q.l + q.r) / 2, y: (q.t + q.b) / 2 }
}

/** Rayon du cercle qui couvre tout l'écran depuis le point (x, y). */
export function rayonMax(x, y, racine) {
  const g = geo(racine)
  return Math.hypot(Math.max(x, g.W - x), Math.max(y, g.H - y)) + 4
}

export const cercle = (r, x, y) => `circle(${r}px at ${x}px ${y}px)`
export const hauteurDe = (racine) => geo(racine).H
export const largeurDe = (racine) => geo(racine).W
