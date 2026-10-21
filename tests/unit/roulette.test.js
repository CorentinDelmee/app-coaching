import { describe, it, expect } from 'vitest'
import { cibleRoulette } from '../../src/anim/roulette.js'

// Chiffre affiché par une case de la colonne (0-19)
const chiffre = (case_) => case_ % 10

describe('roulette de chiffres', () => {
  it('même chiffre : rien ne bouge', () => {
    expect(cibleRoulette(5, 5, -1)).toEqual({ depart: 5, arrivee: 5 })
  })
  it('compte à rebours : la colonne descend (indices décroissants), toujours en moins de 10 cases', () => {
    for (let p = 0; p < 10; p++) for (let d = 0; d < 10; d++) {
      if (p === d) continue
      const { depart, arrivee } = cibleRoulette(p, d, -1)
      expect(chiffre(depart)).toBe(p)
      expect(chiffre(arrivee)).toBe(d)
      expect(arrivee).toBeLessThan(depart)
      expect(depart - arrivee).toBeLessThan(10)
      expect(arrivee).toBeGreaterThanOrEqual(0)
      expect(depart).toBeLessThanOrEqual(19)
    }
  })
  it('compteur : la colonne monte (indices croissants)', () => {
    for (let p = 0; p < 10; p++) for (let d = 0; d < 10; d++) {
      if (p === d) continue
      const { depart, arrivee } = cibleRoulette(p, d, 1)
      expect(chiffre(depart)).toBe(p)
      expect(chiffre(arrivee)).toBe(d)
      expect(arrivee).toBeGreaterThan(depart)
      expect(arrivee - depart).toBeLessThan(10)
      expect(arrivee).toBeLessThanOrEqual(19)
    }
  })
  it('exemples : 3 -> 2 descend d\'une case, 0 -> 9 passe par le haut de la colonne', () => {
    expect(cibleRoulette(3, 2, -1)).toEqual({ depart: 13, arrivee: 12 })
    expect(cibleRoulette(0, 9, -1)).toEqual({ depart: 10, arrivee: 9 })
    expect(cibleRoulette(9, 0, 1)).toEqual({ depart: 9, arrivee: 10 })
  })
  it('enchaîne : la position gardée reste utilisable au tour suivant', () => {
    let pos = 2
    for (const d of [1, 0, 9, 8, 7]) {
      const { arrivee } = cibleRoulette(pos, d, -1)
      expect(chiffre(arrivee)).toBe(d)
      pos = arrivee
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos).toBeLessThanOrEqual(19)
    }
  })
})
