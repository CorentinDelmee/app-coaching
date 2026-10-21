import { describe, it, expect } from 'vitest'
import { reduire, demarrerSeance, vue, prochaineSerie, optionProposee, obligatoiresFaits } from '../../src/engine/seance.js'
import { validerWorkout } from '../../src/domain/modele.js'
import { exerciceComplet, fractionExercice } from '../../src/domain/seanceUi.js'

const T0 = 9_000_000
const workout = {
  id: 'w', nom: 'Séance avec option',
  blocs: [
    { type: 'exercice', id: 'b1', exerciceId: 'ex', champs: [{ cle: 'reps', modifiableParClient: true }], repos: 0, series: [{ reps: 10 }] },
    { type: 'circuit', id: 'c1', nom: 'Option EMOM', format: 'emom', params: { minutes: 6 }, exercices: [{ exerciceId: 'ex', reps: 10 }], facultatif: true }
  ]
}
const demarrer = () => demarrerSeance({ workout, clientId: 'c' }, T0)

describe('circuit facultatif (l\'option)', () => {
  it('le drapeau est repris dans l\'état, faux par défaut', () => {
    const e = demarrer()
    expect(e.exercices[1].facultatif).toBe(true)
    expect(e.exercices[1].passee).toBe(false)
    const sans = demarrerSeance({ workout: { ...workout, blocs: [{ ...workout.blocs[1], facultatif: undefined }] } }, T0)
    expect(sans.exercices[0].facultatif).toBe(false)
  })
  it('l\'option n\'est proposée qu\'une fois les blocs obligatoires faits', () => {
    let e = demarrer()
    expect(optionProposee(e)).toBe(-1)
    expect(obligatoiresFaits(e)).toBe(false)
    e = reduire(e, { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, T0 + 1000)
    expect(obligatoiresFaits(e)).toBe(true)
    expect(optionProposee(e)).toBe(1)
    expect(vue(e, T0 + 2000).optionProposee).toBe(1)
    expect(prochaineSerie(e)).toEqual({ exIdx: 1, serieIdx: null })
  })
  it('la passer règle la séance sans compter l\'option comme faite', () => {
    let e = reduire(demarrer(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, T0 + 1000)
    e = reduire(e, { type: 'passerOption', exIdx: 1 }, T0 + 2000)
    expect(e.exercices[1].passee).toBe(true)
    expect(e.exercices[1].faite).toBe(false)
    expect(e.evenements.map((x) => x.type)).toEqual(['option-passee', 'seance-complete'])
    expect(optionProposee(e)).toBe(-1)
    expect(prochaineSerie(e)).toBeNull()
    expect(exerciceComplet(e.exercices[1])).toBe(true)
    expect(fractionExercice(e.exercices[1])).toBe(1)
    expect(vue(e, T0 + 3000).exercicesFaits).toBe(1)
    const fin = reduire(e, { type: 'terminer' }, T0 + 4000)
    expect(fin.resume.circuitsFaits).toBe(0)
  })
  it('la faire la marque faite et ne la propose plus', () => {
    let e = reduire(demarrer(), { type: 'validerSerie', exIdx: 0, serieIdx: 0 }, T0 + 1000)
    e = reduire(e, { type: 'terminerCircuit', exIdx: 1, resultat: { type: 'minutes', minutes: 6 } }, T0 + 400000)
    expect(e.exercices[1].faite).toBe(true)
    expect(optionProposee(e)).toBe(-1)
    expect(e.evenements.map((x) => x.type)).toContain('seance-complete')
    expect(vue(e, T0 + 400001).exercicesFaits).toBe(2)
  })
  it('passerOption refuse un bloc qui n\'est pas une option', () => {
    const e = reduire(demarrer(), { type: 'passerOption', exIdx: 0 }, T0 + 1)
    expect(e.evenements).toEqual([{ type: 'refuse', raison: 'pas-une-option' }])
  })
  it('un circuit obligatoire reste nécessaire', () => {
    const w = { ...workout, blocs: [{ ...workout.blocs[1], facultatif: false }] }
    const e = demarrerSeance({ workout: w }, T0)
    expect(obligatoiresFaits(e)).toBe(false)
    expect(optionProposee(e)).toBe(-1)
  })
  it('la validation du modèle accepte un booléen et refuse le reste', () => {
    expect(validerWorkout(workout).ok).toBe(true)
    const r = validerWorkout({ ...workout, blocs: [{ ...workout.blocs[1], facultatif: 'oui' }] })
    expect(r.ok).toBe(false)
    expect(r.erreurs.join(' ')).toMatch(/facultatif/)
  })
})
