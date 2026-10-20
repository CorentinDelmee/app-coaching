import { describe, it, expect } from 'vitest'
import { identifiantDepuisNom, identifiantUnique, genererCode, ALPHABET_CODE, emailTechnique } from '../../src/domain/identifiants.js'
import { ajouterJours, diffJours, jourSemaine, lundiDe, jourLocal, horodatage } from '../../src/domain/dates.js'
import { formaterChrono, formaterEuros, ordinalFeminin } from '../../src/domain/format.js'

describe('identifiants', () => {
  it('prenom.nom sans accents ni espaces', () => {
    expect(identifiantDepuisNom('Fabien Vincent')).toBe('fabien.vincent')
    expect(identifiantDepuisNom('Élodie D\'Arc')).toBe('elodie.darc')
    expect(identifiantDepuisNom('  Jean   Pierre Dupont ')).toBe('jean.pierredupont')
  })
  it('suffixe -2, -3 si déjà pris', () => {
    expect(identifiantUnique('Fabien Vincent', ['fabien.vincent'])).toBe('fabien.vincent-2')
    expect(identifiantUnique('Fabien Vincent', ['fabien.vincent', 'fabien.vincent-2'])).toBe('fabien.vincent-3')
    expect(identifiantUnique('Fabien Vincent', ['autre'])).toBe('fabien.vincent')
  })
  it('1000 codes : 6 caractères lisibles (sans 0 O 1 I L)', () => {
    for (let i = 0; i < 1000; i++) {
      const c = genererCode()
      expect(c).toHaveLength(6)
      for (const ch of c) expect(ALPHABET_CODE.includes(ch)).toBe(true)
      expect(c).not.toMatch(/[0O1IL]/)
    }
  })
  it('e-mail technique pour Supabase', () => {
    expect(emailTechnique('fabien.vincent')).toBe('fabien.vincent@clients.cdc-coaching.invalid')
  })
})

describe('dates', () => {
  it('semaine du lundi au dimanche', () => {
    expect(lundiDe('2026-10-20')).toBe('2026-10-19')
    expect(lundiDe('2026-10-25')).toBe('2026-10-19') // dimanche
    expect(lundiDe('2026-10-26')).toBe('2026-10-26')
    expect(jourSemaine('2026-10-19')).toBe(0)
    expect(jourSemaine('2026-10-25')).toBe(6)
  })
  it('calculs de jours robustes au changement d\'heure', () => {
    expect(ajouterJours('2026-10-24', 2)).toBe('2026-10-26') // passage à l'heure d'hiver le 25/10
    expect(diffJours('2026-10-27', '2026-10-24')).toBe(3)
    expect(jourLocal(horodatage('2026-03-29', '23:30'))).toBe('2026-03-29')
  })
  it('formats FR', () => {
    expect(formaterChrono(272000)).toBe('4:32')
    expect(formaterChrono(3723000)).toBe('1:02:03')
    expect(formaterEuros(70)).toBe('70 €')
    expect(formaterEuros(12.5)).toBe('12,5 €')
    expect(ordinalFeminin(1)).toBe('1re')
    expect(ordinalFeminin(3)).toBe('3e')
  })
})
