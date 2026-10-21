// Bug « récap de la semaine » : toucher le workout d'un autre jour doit ouvrir CE jour-là
// (séance faite : ce qui a été réalisé ; séance à venir : le template).
import { describe, it, expect } from 'vitest'
import { apercuWorkout, templatePourJour } from '../../src/domain/workoutUi.js'
import { colonnesSemaine } from '../../src/domain/calendrierUi.js'

const workout = {
  id: 'w1', nom: 'Workout 1 — Bas du corps',
  blocs: [{ type: 'exercice', id: 'b1', exerciceId: 'sq', champs: [{ cle: 'poids', modifiableParClient: true }, { cle: 'reps', modifiableParClient: true }], series: [{ poids: 50, reps: 8 }] }]
}
const exercices = [{ id: 'sq', nom: 'Squat' }]
const real = (id, date, poids, termineLe) => ({ id, clientId: 'c1', workoutId: 'w1', date, valeurs: { b1: { exerciceId: 'sq', series: [{ poids, reps: 8 }] } }, termineLe })
const realisations = [real('r1', '2026-10-19', 60, 1), real('r2', '2026-10-21', 70, 2)]
// Template courant = dernière séance (70 kg), comme l'app le tient à jour.
const template = { id: 'c1', valeurs: { w1: { b1: [{ poids: 70, reps: 8 }] } } }
const poidsAffiche = (tpl) => apercuWorkout({ workout, exercices, template: tpl }).sections[0].exos[0].puces.map((p) => p.texte ?? p).join(' ')

describe('workout d\'un autre jour', () => {
  it('séance faite un autre jour : montre ce qui a été réalisé ce jour-là', () => {
    const tpl = templatePourJour({ template, realisations, workoutId: 'w1', jour: '2026-10-19' })
    expect(tpl.valeurs.w1.b1[0].poids).toBe(60)
  })
  it('séance faite aujourd\'hui : sa propre réalisation', () => {
    expect(templatePourJour({ template, realisations, workoutId: 'w1', jour: '2026-10-21' }).valeurs.w1.b1[0].poids).toBe(70)
  })
  it('séance à venir (ou sans jour) : le template tel quel', () => {
    expect(templatePourJour({ template, realisations, workoutId: 'w1', jour: '2026-10-25' })).toBe(template)
    expect(templatePourJour({ template, realisations, workoutId: 'w1', jour: null })).toBe(template)
  })
  it('l\'aperçu affiche bien les valeurs du jour demandé', () => {
    const jour19 = templatePourJour({ template, realisations, workoutId: 'w1', jour: '2026-10-19' })
    expect(poidsAffiche(jour19)).toContain('60')
    expect(poidsAffiche(jour19)).not.toContain('70')
  })
  it('les puces du calendrier transmettent leur jour', () => {
    const etat = { lundi: '2026-10-19', parJour: [['w1'], [], [], [], [], [], []] }
    const cols = colonnesSemaine(etat, [{ workoutId: 'w1', code: 'W1', statut: 'fait' }], '2026-10-21')
    expect(cols[0].puces[0].jour).toBe('2026-10-19')
  })
})
