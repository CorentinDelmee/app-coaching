import { describe, expect, it } from 'vitest'
import { choixDepuisTexte, documentPropre, emojisDepuisTexte, probleme, pluriel } from '../../src/coach/studio/ecrans/questionnaires/logique.js'
import { validerQuestionnaire } from '../../src/domain/modele.js'

const base = () => ({ id: 'a', clientId: null, nom: ' Bilan ', frequence: 'hebdo', questions: [{ cle: 'q', libelle: 'Sommeil ?', type: 'texte', _u: 1, cleFigee: true }] })

describe('questionnaires Studio', () => {
  it('signale ce qui manque', () => {
    expect(probleme({ ...base(), nom: ' ' })).toMatch(/nom/)
    expect(probleme({ ...base(), questions: [] })).toMatch(/au moins une question/)
    expect(probleme({ ...base(), questions: [{ libelle: ' ' }] })).toMatch(/question 1/)
    expect(probleme(base())).toBeNull()
  })
  it('document propre : champs d’interface retirés, valide pour le modèle', () => {
    const d = documentPropre(base(), { creation: true })
    expect(d.nom).toBe('Bilan')
    expect('clientId' in d).toBe(false)
    expect(d.questions[0]._u).toBeUndefined()
    expect(d.questions[0].cleFigee).toBeUndefined()
    expect(() => validerQuestionnaire(d)).not.toThrow()
    expect(documentPropre(base()).clientId).toBeNull()
  })
  it('choix et émojis', () => {
    expect(choixDepuisTexte('A\n\n  B  \n')).toEqual(['A', 'B'])
    expect(emojisDepuisTexte('😫 😕🙂')).toEqual(['😫', '😕', '🙂'])
    expect(pluriel(2, 'réponse')).toBe('2 réponses')
  })
})
