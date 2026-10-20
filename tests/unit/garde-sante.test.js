import { describe, it, expect } from 'vitest'
import { redirection } from '../../src/router/garde.js'
import { VERSION_CONSENTEMENT } from '../../src/domain/consentement.js'

const client = (sante) => ({ role: 'client', consentementLe: 1, preferences: { consentement: { version: VERSION_CONSENTEMENT, sante } } })

describe('garde : rubriques santé', () => {
  it('questionnaires et suivi ouverts si la santé est acceptée', () => {
    for (const nom of ['questionnaires', 'questionnaire', 'suivi']) expect(redirection({ user: client(true), nom, chemin: '/x' })).toBeNull()
  })
  it("refus de la santé : renvoi vers l'écran « Santé désactivée »", () => {
    expect(redirection({ user: client(false), nom: 'suivi', chemin: '/suivi' })).toBe('/bientot/suivi')
    expect(redirection({ user: client(false), nom: 'questionnaire', chemin: '/questionnaires/q1' })).toBe('/bientot/questionnaires')
    expect(redirection({ user: client(false), nom: 'programme', chemin: '/programme' })).toBeNull()
  })
})
