// Carte du corps (lot 8) : zones touchables en face / dos, formes SVG, intensité récente d'une zone. Pur, sans DOM.
// Repère SVG : 200 × 430. « droite / gauche » = côté de la PERSONNE (en vue de face, sa droite est à gauche de l'écran ;
// en vue de dos, c'est l'inverse). Les formes sont décrites pour le côté droit en vue de face, le reste est déduit par symétrie.
import { diffJours } from './dates.js'

export const FENETRE_CARTE_JOURS = 14 // une douleur notée il y a plus longtemps ne colore plus la carte
export const LARGEUR_CARTE = 200
export const HAUTEUR_CARTE = 430

// forme : { t: 'rect', x, y, w, h, r } | { t: 'cercle', cx, cy, r } | { t: 'ellipse', cx, cy, rx, ry }
const R = (x, y, w, h, r) => ({ t: 'rect', x, y, w, h, r })
const C = (cx, cy, r) => ({ t: 'cercle', cx, cy, r })

// Zones latérales (une par côté) et zones centrales. `vues` : forme dans chaque vue où la zone existe.
const LATERALES = [
  { base: 'epaule', libelle: 'Épaule', f: true, vues: { face: C(62, 92, 16), dos: C(62, 92, 16) } },
  { base: 'bras', libelle: 'Bras', f: false, vues: { face: R(40, 104, 18, 58, 9), dos: R(40, 104, 18, 58, 9) } },
  { base: 'avant-bras', libelle: 'Avant-bras', f: false, vues: { face: R(36, 166, 17, 60, 8.5), dos: R(36, 166, 17, 60, 8.5) } },
  { base: 'hanche', libelle: 'Hanche', f: true, vues: { face: R(72, 182, 27, 26, 12) } },
  { base: 'fessier', libelle: 'Fessier', f: false, vues: { dos: R(72, 182, 27, 26, 12) } },
  { base: 'cuisse', libelle: 'Cuisse', f: true, vues: { face: R(72, 210, 26, 86, 12) } },
  { base: 'ischio', libelle: 'Ischio-jambier', f: false, vues: { dos: R(72, 210, 26, 86, 12) } },
  { base: 'genou', libelle: 'Genou', f: false, vues: { face: C(85, 304, 13), dos: C(85, 304, 13) } },
  { base: 'mollet', libelle: 'Mollet', f: false, vues: { face: R(73, 320, 24, 74, 11), dos: R(73, 320, 24, 74, 11) } },
  { base: 'cheville-pied', libelle: 'Cheville', f: true, vues: { face: R(71, 396, 26, 20, 9), dos: R(71, 396, 26, 20, 9) } }
]
const CENTRALES = [
  { id: 'tete', libelle: 'Tête', vues: { face: { t: 'ellipse', cx: 100, cy: 34, rx: 22, ry: 27 }, dos: { t: 'ellipse', cx: 100, cy: 34, rx: 22, ry: 27 } } },
  { id: 'cou', libelle: 'Cou', vues: { face: R(91, 62, 18, 18, 6) } },
  { id: 'nuque', libelle: 'Nuque', vues: { dos: R(91, 62, 18, 18, 6) } },
  { id: 'pectoraux', libelle: 'Poitrine', vues: { face: R(72, 82, 56, 48, 10) } },
  { id: 'abdomen', libelle: 'Abdomen', vues: { face: R(74, 132, 52, 46, 10) } },
  { id: 'haut-du-dos', libelle: 'Haut du dos', vues: { dos: R(72, 82, 56, 48, 10) } },
  { id: 'bas-du-dos', libelle: 'Bas du dos', vues: { dos: R(74, 132, 52, 46, 10) } }
]

/** Symétrie gauche-droite d'une forme dans la carte. */
function miroir(f) {
  if (f.t === 'rect') return { ...f, x: LARGEUR_CARTE - f.x - f.w }
  return { ...f, cx: LARGEUR_CARTE - f.cx }
}

/** Toutes les zones : { id, libelle, cote, formes: { face?, dos? } }. Les formes de dos sont inversées pour les zones latérales. */
export const ZONES = [
  ...CENTRALES.map((z) => ({ id: z.id, libelle: z.libelle, cote: null, formes: z.vues })),
  ...LATERALES.flatMap((z) => ['droite', 'gauche'].map((cote) => {
    const formes = {}
    for (const [vue, f] of Object.entries(z.vues)) {
      // vue de face : droite = côté gauche de l'écran (forme telle quelle) ; vue de dos : l'inverse
      const telle = (vue === 'face') === (cote === 'droite')
      formes[vue] = telle ? f : miroir(f)
    }
    const accord = cote === 'droite' && !z.f ? 'droit' : cote
    return { id: `${z.base}-${cote}`, libelle: `${z.libelle} ${accord}`, cote, formes }
  }))
]

export const zonesDeVue = (vue) => ZONES.filter((z) => z.formes[vue])
export const zoneParId = (id) => ZONES.find((z) => z.id === id) || null
/** Libellé d'une zone, même inconnue (données importées) : « epaule-droite » -> « Epaule droite ». */
export const libelleZone = (id) => zoneParId(id)?.libelle || id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** Forme -> attribut `d` d'un <path> (un seul type d'élément à rendre). */
export function cheminForme(f) {
  if (f.t === 'rect') {
    const { x, y, w, h } = f
    const r = Math.min(f.r, w / 2, h / 2)
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  }
  const rx = f.t === 'cercle' ? f.r : f.rx
  const ry = f.t === 'cercle' ? f.r : f.ry
  return `M${f.cx - rx} ${f.cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`
}

/** Historique d'une zone : [{ date, valeur }] trié ; plusieurs notes le même jour -> la dernière saisie. */
export function historiqueZone(douleurs, zoneId) {
  const parJour = new Map()
  for (const d of douleurs) if (d.zone === zoneId) parJour.set(d.date, d.intensite)
  return [...parJour.entries()].map(([date, valeur]) => ({ date, valeur })).sort((a, b) => a.date.localeCompare(b.date))
}

/** Dernière note d'une zone : { intensite, date, recente } ou null. `recente` : dans la fenêtre de la carte. */
export function derniereNote(douleurs, zoneId, aujourdhui) {
  const h = historiqueZone(douleurs, zoneId)
  const d = h[h.length - 1]
  return d ? { intensite: d.valeur, date: d.date, recente: diffJours(aujourdhui, d.date) <= FENETRE_CARTE_JOURS } : null
}

/** Intensité qui colore la zone sur la carte (0 si rien de récent). */
export const intensiteCarte = (douleurs, zoneId, aujourdhui) => {
  const n = derniereNote(douleurs, zoneId, aujourdhui)
  return n && n.recente ? n.intensite : 0
}

/** Pourcentage d'accent pour colorer une zone : 0 -> neutre, 1 -> léger, 10 -> plein. */
export const teinteIntensite = (i) => (i <= 0 ? 0 : Math.round(28 + i * 7.2))

/** Résumé des zones actives pour le lecteur d'écran / la légende : [{ id, libelle, intensite }] triées par intensité. */
export function zonesActives(douleurs, aujourdhui) {
  return ZONES.map((z) => ({ id: z.id, libelle: z.libelle, intensite: intensiteCarte(douleurs, z.id, aujourdhui) }))
    .filter((z) => z.intensite > 0).sort((a, b) => b.intensite - a.intensite)
}

export const idDouleur = (clientId, zone, jour) => `dou-${clientId}-${zone}-${jour}`
