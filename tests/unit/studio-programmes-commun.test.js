import { describe, expect, it } from 'vitest'
import { deplacerEnPlace, deplacerItem, indexInsertion, insererEnPlace } from '../../src/coach/studio/ecrans/programmes/commun/deplacements.js'
import { filtrerExercices, teinte, teintesSeance, meta } from '../../src/coach/studio/ecrans/programmes/commun/exercices.js'

describe('déplacements', () => {
  it('index d\'insertion d\'après les milieux', () => {
    expect(indexInsertion([10, 30, 50], 5)).toBe(0)
    expect(indexInsertion([10, 30, 50], 31)).toBe(2)
    expect(indexInsertion([10, 30, 50], 99)).toBe(3)
    expect(indexInsertion([], 0)).toBe(0)
  })
  it('même liste : index compté après retrait', () => {
    expect(deplacerItem(['a', 'b', 'c', 'd'], 0, 2).source).toEqual(['b', 'c', 'a', 'd'])
    expect(deplacerItem(['a', 'b', 'c'], 2, 0).source).toEqual(['c', 'a', 'b'])
    expect(deplacerItem(['a', 'b', 'c'], 1, 99).source).toEqual(['a', 'c', 'b'])
  })
  it('entre deux listes, sans muter les entrées', () => {
    const s = ['a', 'b'], c = ['x']
    const r = deplacerItem(s, 1, 0, c)
    expect(r).toEqual({ source: ['a'], cible: ['b', 'x'] })
    expect(s).toEqual(['a', 'b'])
  })
  it('index hors bornes ignoré', () => {
    const s = ['a']
    expect(deplacerItem(s, 5, 0).source).toBe(s)
    expect(deplacerEnPlace(s, -1, 0)).toBeUndefined()
  })
  it('en place', () => {
    const s = ['a', 'b', 'c'], c = []
    expect(deplacerEnPlace(s, 0, 5, c)).toBe('a')
    expect([s, c]).toEqual([['b', 'c'], ['a']])
    insererEnPlace(c, 0, 'z'); insererEnPlace(c, undefined, 'y')
    expect(c).toEqual(['z', 'a', 'y'])
  })
})

describe('exercices des éditeurs', () => {
  const ex = [
    { id: '1', nom: 'Élévation latérale', musclesPrincipaux: ['epaules'], materiel: ['Haltères'], categories: [] },
    { id: '2', nom: 'Squat gobelet', categories: ['jambes'] },
    { id: '3', nom: 'Planche', categories: ['inconnue'] }
  ]
  it('teinte : muscles principaux, puis catégories, sinon null', () => {
    expect(ex.map(teinte)).toEqual(['epaules', 'jambes', null])
  })
  it('recherche sans accents ni casse, filtre de muscles', () => {
    expect(filtrerExercices(ex, { q: 'elevation' }).map((e) => e.id)).toEqual(['1'])
    expect(filtrerExercices(ex, { q: 'HALTERES' }).map((e) => e.id)).toEqual(['1'])
    expect(filtrerExercices(ex, { muscles: ['jambes'] }).map((e) => e.id)).toEqual(['2'])
    expect(filtrerExercices(ex, {}).length).toBe(3)
  })
  it('méta et teintes d\'une séance', () => {
    expect(meta(ex[0])).toBe('Épaules · Haltères')
    const w = { blocs: [{ type: 'exercice', exerciceId: '2' }, { type: 'circuit', exercices: [{ exerciceId: '1' }, { exerciceId: '2' }, { exerciceId: '3' }] }] }
    expect(teintesSeance(w, (id) => ex.find((e) => e.id === id))).toEqual(['jambes', 'epaules'])
  })
})
