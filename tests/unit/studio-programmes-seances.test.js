import { describe, expect, it } from 'vitest'
import { blocPour, nbExercices, nettoyerSeance, problemeSeance, resumeBloc, resumeSeries } from '../../src/coach/studio/ecrans/programmes/seances/seance.js'

let n = 0
const uuid = () => `id${++n}`

describe('séance Studio', () => {
  it('problèmes lisibles, dans l\'ordre de l\'ancien éditeur', () => {
    expect(problemeSeance({ nom: ' ', blocs: [] })).toMatch(/nom/)
    expect(problemeSeance({ nom: 'A', blocs: [] })).toMatch(/au moins un bloc/)
    expect(problemeSeance({ nom: 'A', blocs: [{ type: 'circuit', exercices: [] }] })).toMatch(/circuit \(bloc 1\)/)
    expect(problemeSeance({ nom: 'A', blocs: [{ type: 'exercice', exerciceId: '' }] })).toMatch(/bloc 1/)
    expect(problemeSeance({ nom: 'A', blocs: [{ type: 'superset', exercices: [{ exerciceId: 'x' }, { exerciceId: '' }] }] })).toMatch(/superset/)
    expect(problemeSeance({ nom: 'A', blocs: [blocPour('e1', uuid)] })).toBe('')
  })
  it('nettoyage avant écriture', () => {
    const w = { id: 'w', nom: '  Bas du corps ', clientId: '', consignes: ' ', blocs: [{ type: 'circuit', facultatif: false, exercices: [] }, { ...blocPour('e', uuid), consignes: '' }] }
    const c = nettoyerSeance(w)
    expect(c.nom).toBe('Bas du corps')
    expect(c.clientId).toBeNull()
    expect('consignes' in c).toBe(false)
    expect('facultatif' in c.blocs[0]).toBe(false)
    expect('consignes' in c.blocs[1]).toBe(false)
    expect(w.nom).toBe('  Bas du corps ') // l'original ne bouge pas
  })
  it('repos conseillé de la fiche pour un bloc déposé', () => {
    expect(blocPour('e', uuid).repos).toBe(90)
    expect(blocPour('e', uuid, { reposConseille: 45 }).repos).toBe(45)
  })
  it('résumés des blocs repliés', () => {
    const b = blocPour('e', uuid)
    b.series[0].poids = 20
    expect(resumeSeries(b)).toBe('3 × 10 · 20 kg')
    expect(resumeBloc(b, () => 'Squat')).toBe('3 × 10 · 20 kg · repos 90 s')
    expect(resumeBloc({ type: 'circuit', format: 'amrap', exercices: [{ exerciceId: 'a' }, { exerciceId: 'b' }] }, (id) => id.toUpperCase(), (f) => f.toUpperCase())).toBe('AMRAP · 2 exercices · A, B')
    expect(nbExercices({ blocs: [b, { type: 'circuit', exercices: [{}, {}] }] })).toBe(3)
  })
})
