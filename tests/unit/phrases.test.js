import { describe, it, expect } from 'vitest'
import { phraseSerie, phraseCircuit } from '../../src/domain/phrases.js'

describe('petites phrases des chronos', () => {
  it('série : préparation, travail, repos puis « On y retourne. » sur les dernières secondes', () => {
    expect(phraseSerie('prep', 3)).toBe('Préparez-vous.')
    expect(phraseSerie('travail', 20)).toBe('Tenez bon.')
    expect(phraseSerie('travail', 0)).toBe('Temps !')
    expect(phraseSerie('repos', 60)).toBe('Respirez.')
    expect(phraseSerie('repos', 5)).toBe('On y retourne.')
    expect(phraseSerie('repos', 0)).toBe('On y retourne.')
  })
  it('circuit : une phrase par thème, « Temps ! » à la fin', () => {
    expect(phraseCircuit({ theme: 'prep' })).toBe('Préparez-vous.')
    expect(phraseCircuit({ theme: 'travail' })).toBe('Tenez bon.')
    expect(phraseCircuit({ theme: 'repos' })).toBe('Respirez.')
    expect(phraseCircuit({ theme: 'travail', termine: true })).toBe('Temps !')
  })
  it('vouvoiement par défaut, tutoiement disponible', () => {
    expect(phraseSerie('repos', 60, 'tu')).toBe('Respire.')
    expect(phraseSerie('repos', 60)).toBe('Respirez.')
  })
})
