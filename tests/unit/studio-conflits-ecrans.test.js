// Branchement des conflits dans les écrans Studio : logique pure de la fiche exercice (le reste est vérifié en vrais clics,
// tests/e2e/studio/conflits-ecrans.js, mode api).
import { describe, expect, it } from 'vitest'
import { champsTouchesChangesAilleurs } from '../../src/coach/studio/ecrans/exercices/logique.js'

const base = { id: 'e1', nom: 'Squat', categories: [], consignes: 'Dos droit', tempo: '3-0-1', materiel: ['Haltères'], version: 3 }

describe('fiche exercice : conflit sur les champs touchés ?', () => {
  it('Claude a changé un AUTRE champ : pas de conflit réel (le patch peut repartir sur la nouvelle version)', () => {
    expect(champsTouchesChangesAilleurs(base, { ...base, tempo: '2-0-2', version: 4 }, { consignes: 'Talons au sol' })).toBe(false)
  })
  it('Claude a changé le MÊME champ : conflit (bandeau, Recharger)', () => {
    expect(champsTouchesChangesAilleurs(base, { ...base, consignes: 'Genoux dehors', version: 4 }, { consignes: 'Talons au sol' })).toBe(true)
  })
  it('listes comparées par valeur, champ hors formulaire comparé en JSON', () => {
    expect(champsTouchesChangesAilleurs(base, { ...base, materiel: ['Haltères'], version: 4 }, { materiel: ['Kettlebell'] })).toBe(false)
    expect(champsTouchesChangesAilleurs(base, { ...base, materiel: ['Barre'], version: 4 }, { materiel: ['Kettlebell'] })).toBe(true)
    expect(champsTouchesChangesAilleurs(base, { ...base, archive: true }, { archive: false })).toBe(true)
  })
})
