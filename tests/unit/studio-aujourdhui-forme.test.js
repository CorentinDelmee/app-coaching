import { describe, expect, it } from 'vitest'
import { creerMemoireForme, tranche } from '../../src/coach/studio/ecrans/aujourdhui/forme.js'

const faux = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

describe('forme de l’écran (dimensionne le squelette)', () => {
  it('tranches de largeur alignées sur la grille', () => {
    expect([tranche(390), tranche(899), tranche(900), tranche(1179), tranche(1366)]).toEqual(['m', 'm', 't', 't', 'd'])
  })
  it('valeurs par défaut puis valeurs notées, par tranche', () => {
    const m = creerMemoireForme(faux())
    expect(m.lire('m').n.items).toBe(3)
    m.noter('m', { n: { items: 5 }, h: { jour: 412.4, resume: NaN, titre: undefined } })
    expect(m.lire('m').n.items).toBe(5)
    expect(m.lire('m').h).toEqual({ jour: 412 })
    expect(m.lire('d').n.items).toBe(3)
  })
  it('survit à un stockage absent ou cassé', () => {
    expect(creerMemoireForme(null).lire('m').n.alertes).toBe(3)
    const casse = { getItem: () => '{pas du json', setItem: () => { throw new Error('plein') } }
    const m = creerMemoireForme(casse)
    expect(() => m.noter('m', { n: { items: 2 } })).not.toThrow()
    expect(m.lire('m').n.items).toBe(2)
  })
  it('relit ce qui a été enregistré', () => {
    const s = faux()
    creerMemoireForme(s).noter('t', { h: { alertes: 200 } })
    expect(creerMemoireForme(s).lire('t').h.alertes).toBe(200)
  })
})
