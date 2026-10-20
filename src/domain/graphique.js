// Géométrie pure des courbes SVG du suivi (lot 8) : échelle lisible, positions des points, tracé lissé. Aucune dépendance au DOM.
import { diffJours } from './dates.js'

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const arrondir = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d

/** « 2026-10-20 » -> « 20 oct. » */
export function dateCourte(jour) {
  const [, m, d] = jour.split('-')
  return `${Number(d)} ${MOIS[Number(m) - 1]}`
}

/** Pas « rond » (1, 2, 5 × 10^k) pour couper `etendue` en ~`n` intervalles. */
export function pasRond(etendue, n = 3) {
  const brut = etendue / n
  const p = 10 ** Math.floor(Math.log10(brut))
  const f = brut / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

/** Échelle verticale : bornes et graduations rondes englobant les valeurs (ex. 80,6 à 82,4 -> 80 à 83 par 1). */
export function echelleNice(min, max) {
  if (max - min < 1e-9) { min -= 1; max += 1 }
  const pas = pasRond(max - min, 3)
  const bas = Math.floor(min / pas + 1e-9) * pas
  const haut = Math.ceil(max / pas - 1e-9) * pas
  const ticks = []
  for (let v = bas; v <= haut + pas / 2; v += pas) ticks.push(arrondir(v, 6))
  return { min: arrondir(bas, 6), max: arrondir(haut, 6), pas, ticks }
}

/**
 * Courbe prête à dessiner. points : [{ date, valeur }] triés par date.
 * @returns {{ pts, chemin, aire, ticksY, ticksX, bas, zone }} ; pts[i] = { x, y, date, valeur }
 * Les x respectent l'écart réel entre les dates ; un point unique est centré ; `domaine` ([min, max]) fixe l'échelle (ex. 0-10).
 */
export function construireCourbe(points, { largeur = 340, hauteur = 190, marge = { g: 44, d: 16, h: 16, b: 30 }, domaine } = {}) {
  const zone = { x0: marge.g, x1: largeur - marge.d, y0: marge.h, y1: hauteur - marge.b }
  const valeurs = points.map((p) => p.valeur)
  const ech = domaine
    ? { min: domaine[0], max: domaine[1], ticks: [domaine[0], (domaine[0] + domaine[1]) / 2, domaine[1]] }
    : echelleNice(Math.min(...valeurs), Math.max(...valeurs))
  const y = (v) => zone.y1 - ((v - ech.min) / (ech.max - ech.min)) * (zone.y1 - zone.y0)
  const total = points.length > 1 ? diffJours(points[points.length - 1].date, points[0].date) : 0
  const x = (date) => (total > 0 ? zone.x0 + (diffJours(date, points[0].date) / total) * (zone.x1 - zone.x0) : (zone.x0 + zone.x1) / 2)
  const pts = points.map((p) => ({ x: arrondir(x(p.date)), y: arrondir(y(p.valeur)), date: p.date, valeur: p.valeur }))

  // tracé lissé : tangentes horizontales aux points (jamais de dépassement entre deux mesures)
  let chemin = ''
  pts.forEach((p, i) => {
    if (i === 0) { chemin = `M${p.x} ${p.y}`; return }
    const q = pts[i - 1]
    const mx = arrondir((q.x + p.x) / 2)
    chemin += `C${mx} ${q.y} ${mx} ${p.y} ${p.x} ${p.y}`
  })
  const aire = pts.length > 1 ? `${chemin}L${pts[pts.length - 1].x} ${zone.y1}L${pts[0].x} ${zone.y1}Z` : ''

  const ticksY = ech.ticks.map((v) => ({ valeur: v, y: arrondir(y(v)) }))
  const ticksX = []
  if (pts.length) {
    ticksX.push({ x: pts[0].x, label: dateCourte(points[0].date), ancre: pts.length > 1 ? 'start' : 'middle' })
    if (pts.length > 1) ticksX.push({ x: pts[pts.length - 1].x, label: dateCourte(points[points.length - 1].date), ancre: 'end' })
  }
  return { pts, chemin, aire, ticksY, ticksX, bas: zone.y1, zone }
}
