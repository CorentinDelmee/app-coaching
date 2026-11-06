import { describe, expect, it } from 'vitest'
import { colonnes, convertirMode, idsUtilises, libelleMode, poser, pourEcriture, raisonInvalide, initiales, teinteClient } from '../../src/coach/studio/ecrans/programmes/programmes/planning.js'

const sem = { ids: ['a', 'b', 'c', 'd'], joursFixes: { a: 2, c: 2, d: 4 } }

describe('colonnes', () => {
  it('range les séances par jour fixé, ordre de la semaine, « au choix » sinon', () => {
    const c = colonnes(sem.ids, sem.joursFixes)
    expect(c.choix).toEqual(['b'])
    expect(c[2]).toEqual(['a', 'c'])
    expect(c[4]).toEqual(['d'])
    expect(c[0]).toEqual([])
  })
})

describe('poser', () => {
  it('ajoute une séance de la bibliothèque dans Mercredi à la position voulue', () => {
    const r = poser(sem, { id: 'e', cible: { col: 2, index: 1 } })
    expect(colonnes(r.ids, r.joursFixes)[2]).toEqual(['a', 'e', 'c'])
    expect(r.joursFixes.e).toBe(2)
    expect(r.dejaLa).toBe(false)
    expect(r.ids).toHaveLength(5)
  })
  it('déplace une carte de Mercredi vers Vendredi (change le jour fixé)', () => {
    const r = poser(sem, { source: { col: 2, index: 1 }, cible: { col: 4, index: 0 } })
    expect(r.id).toBe('c')
    expect(r.joursFixes.c).toBe(4)
    expect(colonnes(r.ids, r.joursFixes)[4]).toEqual(['c', 'd'])
    expect(r.deplace).toBe(true)
  })
  it('« Au choix » retire le jour fixé', () => {
    const r = poser(sem, { source: { col: 4, index: 0 }, cible: { col: 'choix', index: 0 } })
    expect(r.joursFixes.d).toBeUndefined()
    expect(colonnes(r.ids, r.joursFixes).choix).toEqual(['d', 'b'])
  })
  it('réordonne dans une même colonne (index après retrait)', () => {
    const r = poser(sem, { source: { col: 2, index: 0 }, cible: { col: 2, index: 1 } })
    expect(colonnes(r.ids, r.joursFixes)[2]).toEqual(['c', 'a'])
  })
  it('anti-doublon : une séance déjà dans la semaine est déplacée, pas ajoutée deux fois', () => {
    const r = poser(sem, { id: 'a', cible: { col: 5, index: 0 } })
    expect(r.ids.filter((x) => x === 'a')).toHaveLength(1)
    expect(r.joursFixes.a).toBe(5)
    expect(r.dejaLa).toBe(true)
  })
  it('ne modifie pas les objets reçus et refuse une source vide', () => {
    const avant = JSON.stringify(sem)
    poser(sem, { id: 'z', cible: { col: 0, index: 0 } })
    expect(JSON.stringify(sem)).toBe(avant)
    expect(poser(sem, { source: { col: 0, index: 0 }, cible: { col: 1, index: 0 } })).toBeNull()
  })
  it('semaine réécrite dans l’ordre Lundi … Dimanche puis « au choix »', () => {
    const r = poser(sem, { id: 'e', cible: { col: 0, index: 0 } })
    expect(r.ids).toEqual(['e', 'a', 'c', 'd', 'b'])
  })
})

describe('convertirMode', () => {
  it('répété → par semaine : une semaine par semaine prévue, sans perte', () => {
    const p = { mode: 'repete', workouts: ['a', 'b'], nbSemaines: 3, joursFixes: { a: 1 } }
    const c = convertirMode(p, 'parSemaine')
    expect(c.semaines).toEqual([['a', 'b'], ['a', 'b'], ['a', 'b']])
    expect(c.workouts).toBeUndefined()
    expect(c.joursFixes).toEqual({ a: 1 })
    expect(p.mode).toBe('repete')
  })
  it('par semaine → répété : union des séances', () => {
    const c = convertirMode({ mode: 'parSemaine', semaines: [['a'], ['b', 'a'], []] }, 'repete')
    expect(c.workouts).toEqual(['a', 'b'])
    expect(c.semaines).toBeUndefined()
  })
  it('sans fin : une seule semaine', () => {
    expect(convertirMode({ mode: 'repete', workouts: ['a'] }, 'parSemaine').semaines).toEqual([['a']])
  })
})

describe('écriture et validation', () => {
  it('pourEcriture efface les champs vides et nettoie joursFixes', () => {
    const o = pourEcriture({ id: 'p', clientId: 'c', nom: '  Prog  ', mode: 'parSemaine', debut: '2026-11-02', semaines: [['a']], nbSemaines: 4, joursFixes: { a: 1, x: 3 } })
    expect(o.nom).toBe('Prog')
    expect(o.nbSemaines).toBeUndefined()
    expect(o.workouts).toBeUndefined()
    expect(o.joursFixes).toEqual({ a: 1 })
    expect('nbSemaines' in o).toBe(true) // undefined explicite : efface la valeur stockée par modifier()
    expect(pourEcriture({ mode: 'repete', workouts: [], joursFixes: {}, nbSemaines: '' }).joursFixes).toBeUndefined()
  })
  it('raisonInvalide', () => {
    expect(raisonInvalide({ nom: 'x', debut: '2026-11-02' })).toMatch(/client/)
    expect(raisonInvalide({ clientId: 'c', nom: ' ', debut: '2026-11-02' })).toMatch(/nom/)
    expect(raisonInvalide({ clientId: 'c', nom: 'P', debut: '2026-11-02' })).toBe('')
  })
  it('libellés, initiales, teinte stable', () => {
    expect(libelleMode({ mode: 'repete', workouts: ['a', 'b'] })).toBe('Répété · 2 séances/semaine')
    expect(libelleMode({ mode: 'parSemaine', semaines: [[]] })).toBe('Par semaine · 1 semaine')
    expect(idsUtilises({ mode: 'parSemaine', semaines: [['a'], ['a', 'b']] })).toEqual(['a', 'b'])
    expect(initiales('Hélène Marchal')).toBe('HM')
    expect(teinteClient('abc')).toBe(teinteClient('abc'))
  })
})

describe('restaurerSemaines (retour en « par semaine »)', () => {
  it('rend la répartition mémorisée, sans les séances retirées, avec les ajoutées dans chaque semaine', async () => {
    const { restaurerSemaines } = await import('../../src/coach/studio/ecrans/programmes/programmes/planning.js')
    expect(restaurerSemaines([['a', 'b'], ['c'], []], ['a', 'b', 'c'])).toEqual([['a', 'b'], ['c'], []])
    expect(restaurerSemaines([['a', 'b'], ['c']], ['a', 'c', 'd'])).toEqual([['a', 'd'], ['c', 'd']])
    expect(restaurerSemaines([], ['a'])).toEqual([['a']])
  })
})
