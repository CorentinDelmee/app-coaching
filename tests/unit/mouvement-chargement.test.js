// Socle mouvement + chargement : sens des entrées de page, défilement après navigation, chargeur différé et tenu.
import { describe, expect, it, vi } from 'vitest'
import { sensNavigation } from '../../src/coach/studio/mouvement.js'
import { positionDefilement } from '../../src/router/defilement.js'
import { abonner, creerAffichageDiffere, debuter, suivre } from '../../src/lib/chargement.js'

describe('sens de l\'entrée de page', () => {
  it('plus profond = avance, moins profond = recule, même niveau = onglet', () => {
    expect(sensNavigation('/coach/seances', '/coach/seances/w1')).toBe('avance')
    expect(sensNavigation('/coach/seances/w1', '/coach/seances')).toBe('recule')
    expect(sensNavigation('/coach/clients', '/coach/exercices?video=propose')).toBe('onglet')
  })
})

describe('défilement après navigation', () => {
  const r = (path, meta = {}) => ({ path, meta })
  it('coach : nouvelle page en haut, retour à la position mémorisée, même écran immobile', () => {
    expect(positionDefilement(r('/coach/clients'), r('/coach/exercices'), null)).toEqual({ top: 0 })
    expect(positionDefilement(r('/coach/clients'), r('/coach/exercices'), { left: 0, top: 640 })).toEqual({ left: 0, top: 640 })
    expect(positionDefilement(r('/coach/clients/c1', { cle: 'clients' }), r('/coach/clients', { cle: 'clients' }), null)).toBe(false)
    expect(positionDefilement(r('/coach/exercices'), r('/coach/exercices'), null)).toBe(false)
  })
  it('client : rien de changé (position mémorisée au retour seulement)', () => {
    expect(positionDefilement(r('/programme'), r('/'), null)).toBe(false)
    expect(positionDefilement(r('/'), r('/programme'), { top: 10 })).toEqual({ top: 10 })
  })
})

describe('chargeur', () => {
  it('n\'apparaît qu\'après 250 ms d\'attente ; une attente courte ne montre rien', () => {
    vi.useFakeTimers()
    const vus = []
    const changer = creerAffichageDiffere((b) => vus.push(b), { now: () => Date.now() })
    changer(true); vi.advanceTimersByTime(200); changer(false); vi.advanceTimersByTime(1000)
    expect(vus).toEqual([])
    vi.useRealTimers()
  })
  it('une fois visible, reste au moins 400 ms ; une nouvelle attente pendant la tenue le garde', () => {
    vi.useFakeTimers()
    const vus = []
    const changer = creerAffichageDiffere((b) => vus.push([b, Date.now()]), { now: () => Date.now() })
    const t0 = Date.now()
    changer(true); vi.advanceTimersByTime(260)
    expect(vus.map((x) => x[0])).toEqual([true])
    changer(false); vi.advanceTimersByTime(100)
    changer(true); vi.advanceTimersByTime(500)
    expect(vus.length).toBe(1)
    changer(false); vi.advanceTimersByTime(1)
    expect(vus.map((x) => x[0])).toEqual([true, false])
    changer(true); vi.advanceTimersByTime(260); changer(false); vi.advanceTimersByTime(380) // visible depuis 390 ms
    expect(vus.at(-1)[0]).toBe(true)
    vi.advanceTimersByTime(20)
    expect(vus.at(-1)[0]).toBe(false)
    expect(vus[0][1] - t0).toBe(250)
    vi.useRealTimers()
  })
  it('suivre / debuter comptent les attentes jusqu\'à leur fin', async () => {
    const etats = []
    const stop = abonner((b) => etats.push(b))
    let ok
    suivre(new Promise((r) => { ok = r }))
    const fin = debuter()
    fin(); fin()
    ok(); await Promise.resolve(); await Promise.resolve()
    stop()
    expect(etats[0]).toBe(false)
    expect(etats.at(-1)).toBe(false)
    expect(etats).toContain(true)
  })
})
