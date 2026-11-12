import { describe, expect, it } from 'vitest'
import { grouperEvenements, heureLisible, libelleBilan, libelleHeureEvt, libelleSynchro, partiesDate } from '../../src/coach/studio/ecrans/agenda/agendaOutils.js'
import routes from '../../src/coach/studio/ecrans/agenda/routes.js'

describe('agendaOutils', () => {
  it('partiesDate', () => {
    expect(partiesDate('2026-11-10')).toMatchObject({ jour: 'mar.', num: '10', mois: 'nov.', court: 'mar. 10/11' })
  })
  it('libellés d\'heure', () => {
    expect(heureLisible('09:30')).toBe('09 h 30')
    expect(libelleHeureEvt({ journee: true })).toBe('toute la journée')
    expect(libelleHeureEvt({ heure: '09:00', finHeure: '10:00' })).toBe('09 h 00 – 10 h 00')
    expect(libelleHeureEvt({ heure: '09:00' })).toBe('09 h 00')
  })
  it('grouper par jour, trié, 120 créneaux', () => {
    const l = [{ date: '2026-11-11', heure: '18:00' }, { date: '2026-11-10', heure: '18:00' }, { date: '2026-11-10', heure: '09:00' }]
    const g = grouperEvenements(l)
    expect(g.map((x) => x.date)).toEqual(['2026-11-10', '2026-11-11'])
    expect(g[0].items.map((e) => e.heure)).toEqual(['09:00', '18:00'])
    const beaucoup = Array.from({ length: 120 }, (_, i) => ({ date: `2027-01-${String(1 + (i % 30)).padStart(2, '0')}`, heure: '10:00' }))
    expect(grouperEvenements(beaucoup)).toHaveLength(30)
  })
  it('synchro jamais faite', () => { expect(libelleSynchro(null)).toBe('Jamais synchronisé') })
  it('bilan : séances faites annulées dans Google signalées', () => {
    expect(libelleBilan({ evenements: 3, annulesAVerifier: 2, aAttribuer: 1 })).toBe('Synchronisé : 3 coachings lus, 2 séances faites annulée(s) dans Google à vérifier · 1 titre à attribuer.')
  })
  it('routes : mêmes URL que les anciennes vues', () => {
    expect(routes.map((r) => r.path)).toEqual(['agenda', 'reservations', 'donnees'])
  })
})
