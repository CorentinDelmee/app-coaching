import { describe, expect, it } from 'vitest'
import { formulaireRegles, grouperParJour, libelleBlocage, libelleJourLong, validerBlocage, validerRegles, versIso } from '../../src/domain/reservations.js'

describe('réservations', () => {
  it('libellé de jour', () => {
    expect(libelleJourLong('2026-11-10')).toBe('mardi 10 novembre')
    expect(libelleJourLong('2026-12-01')).toBe('mardi 1er décembre')
  })
  it('regroupe par jour, trie, convertit en heure de Paris', () => {
    const g = grouperParJour([
      { id: 'b', debut: '2026-11-10T14:00:00+01:00', prenom: 'B', nom: 'X', synchro: 'a_ajouter' },
      { id: 'a', debut: '2026-11-10T09:00:00+01:00', prenom: 'A', nom: 'Y' },
      { id: 'c', debut: '2026-11-12T08:30:00Z', prenom: 'C', nom: 'Z' }
    ])
    expect(g.map((x) => x.libelle)).toEqual(['mardi 10 novembre', 'jeudi 12 novembre'])
    expect(g[0].items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(g[0].items[1].synchro).toBe('a_ajouter')
    expect(g[1].items[0].heure).toBe('09:30')
    expect(grouperParJour([{ debut: '2026-11-10T09:00:00+01:00' }, { debut: '2026-11-12T09:00:00+01:00' }], 'desc')[0].date).toBe('2026-11-12')
  })
  it('décalage été/hiver', () => {
    expect(versIso('2026-11-10', '09:00')).toBe('2026-11-10T09:00:00+01:00')
    expect(versIso('2026-07-10', '09:00')).toBe('2026-07-10T09:00:00+02:00')
  })
  it('blocages', () => {
    expect(validerBlocage({ date: '', debut: '', fin: '' }).erreur).toBeTruthy()
    expect(validerBlocage({ date: '2026-11-10', debut: '12:00', fin: '09:00' }).erreur).toMatch(/après/)
    const j = validerBlocage({ date: '2026-11-10', journee: true })
    expect(libelleBlocage(j)).toBe('mardi 10 novembre, toute la journée')
    expect(libelleBlocage(validerBlocage({ date: '2026-11-10', debut: '09:00', fin: '12:30' }))).toBe('mardi 10 novembre, 9 h – 12 h 30')
  })
  it('règles : valides, chevauchement, nombres', () => {
    const base = { fuseau: 'Europe/Paris', pasMin: 30, dureeMin: 60, tamponMin: 30, delaiMinHeures: 24, horizonJours: 21, maxParJour: 3, plages: { lun: [['09:00', '19:00']] }, fermetures: [] }
    const f = formulaireRegles(base)
    const ok = validerRegles(f, base)
    expect(ok.regles.pasMin).toBe(30)
    expect(ok.regles.plages.lun).toEqual([['09:00', '19:00']])
    f.plages.lun.push({ debut: '18:00', fin: '20:00' })
    expect(validerRegles(f, base).erreurs[0]).toMatch(/chevauchent/)
    f.plages.lun = [{ debut: '10:00', fin: '09:00' }]
    expect(validerRegles(f, base).erreurs[0]).toMatch(/après le début/)
    f.plages.lun = [{ debut: '09:00', fin: '10:00' }]; f.horizonJours = 'abc'
    expect(validerRegles(f, base).erreurs[0]).toMatch(/Horizon/)
    f.horizonJours = 21; f.plages.lun = []
    expect(validerRegles(f, base).erreurs[0]).toMatch(/au moins une plage/)
  })
})
