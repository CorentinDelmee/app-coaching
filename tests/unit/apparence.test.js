import { describe, it, expect } from 'vitest'
import { normaliserApparence, attributsApparence } from '../../src/domain/apparence.js'
import { messageAccueil } from '../../src/domain/messageAccueil.js'
import { AMBIANCES, AMBIANCE_DEFAUT, CHOIX } from '../../src/config/apparence.js'

describe('réglages d\'apparence du client', () => {
  it('clair par défaut, Grand affichage désactivé', () => {
    expect(AMBIANCE_DEFAUT).toBe('clair')
    expect(normaliserApparence(null)).toEqual({ ambiance: 'clair', grand: false })
    expect(normaliserApparence({ son: true })).toEqual({ ambiance: 'clair', grand: false })
  })
  it('garde une ambiance connue, ignore le reste', () => {
    expect(normaliserApparence({ ambiance: 'bleu', grand: true })).toEqual({ ambiance: 'bleu', grand: true })
    expect(normaliserApparence({ ambiance: 'sombre', grand: 'oui' })).toEqual({ ambiance: 'sombre', grand: false })
    expect(normaliserApparence({ ambiance: 'rose' }).ambiance).toBe('clair')
  })
  it('attributs posés sur <html> : ambiance, échelle et choix ouverts', () => {
    expect(attributsApparence({ ambiance: 'sombre', grand: true }, CHOIX)).toEqual({
      'data-ambiance': 'sombre', 'data-grand': 'oui', 'data-chrono': 'barlow', 'data-aplat': 'fonce'
    })
  })
  it('choix ouverts retenus en provisoire', () => {
    expect(CHOIX).toEqual({ policeChrono: 'barlow', accueil: 'pret', texteAplat: 'fonce', adresse: 'vous' })
    expect(AMBIANCES.map((a) => a.id)).toEqual(['clair', 'sombre', 'bleu'])
  })
})

describe('message d\'accueil', () => {
  const NB = ' '
  it('« Prêt, Fabien ? » avant la séance du jour', () => {
    expect(messageAccueil({ prenom: 'Fabien', etat: 'prevu' })).toEqual({ lignes: ['Prêt,', `Fabien${NB}?`], long: false })
  })
  it('« Bien joué, Fabien. » après la séance du jour', () => {
    expect(messageAccueil({ prenom: 'Fabien', etat: 'fait' }).lignes).toEqual(['Bien joué,', 'Fabien.'])
  })
  it('« Semaine bouclée ! » quand la semaine est finie', () => {
    expect(messageAccueil({ prenom: 'Fabien', etat: 'bouclee' }).lignes).toEqual(['Semaine', `bouclée${NB}!`])
  })
  it('sans programme : simple bonjour', () => {
    expect(messageAccueil({ prenom: 'Inès', etat: 'aucun' }).lignes).toEqual(['Bonjour,', 'Inès.'])
  })
  it('variante « semaine » : accord singulier / pluriel', () => {
    expect(messageAccueil({ variante: 'semaine', prenom: 'F', etat: 'prevu', reste: 2 })).toEqual({ lignes: ['Plus que 2 séances pour boucler la semaine.'], long: true })
    expect(messageAccueil({ variante: 'semaine', prenom: 'F', etat: 'fait', reste: 1 }).lignes[0]).toBe('Plus qu’une séance pour boucler la semaine.')
    expect(messageAccueil({ variante: 'semaine', prenom: 'F', etat: 'bouclee' }).lignes[0]).toBe('Semaine bouclée. Respect.')
  })
})

describe('overview du workout (V2) : pastilles, lettres, dernière fois', async () => {
  const { pastillesPrescription, apercuWorkout } = await import('../../src/domain/workoutUi.js')
  it('prescription en pastilles : valeur en grand, unité en petit, repos en m:ss', () => {
    expect(pastillesPrescription(['4 × 10 reps', '16 kg', 'repos 90 s'])).toEqual([
      { valeur: '4 × 10', unite: 'reps' }, { valeur: '16', unite: 'kg' }, { valeur: '1:30', unite: 'repos' }
    ])
    expect(pastillesPrescription(['3 × 40 s', 'repos 20 s'])).toEqual([{ valeur: '3 × 40', unite: 's' }, { valeur: '0:20', unite: 'repos' }])
    expect(pastillesPrescription(['1 série'])).toEqual([{ valeur: '1', unite: 'série' }])
  })
  it('lettres A, B, C… dans l\'ordre des sections, circuits compris ; dernière fois avant le jour affiché', async () => {
    const { genererDemo } = await import('../../src/data/demo/index.js')
    const demo = genererDemo(new Date(2026, 9, 22, 12).getTime())
    const w3 = demo.workouts.find((w) => w.id === 'w-fabien-3')
    const a = apercuWorkout({ workout: w3, exercices: demo.exercices })
    expect(a.sections.map((s) => s.lettre)).toEqual(a.sections.map((_, i) => 'ABCDEFGH'[i]))
    expect(a.sections.filter((s) => s.kind === 'bloc').map((s) => s.titre)).toEqual(a.sections.filter((s) => s.kind === 'bloc').map((s) => `Bloc ${s.lettre}`))
    expect(a.sections[0].exos[0].pastilles.length).toBeGreaterThan(1)
    const fab = demo.profils.find((p) => p.identifiant === 'fabien.vincent')
    const avecHisto = apercuWorkout({ workout: w3, exercices: demo.exercices, realisations: demo.realisations.filter((r) => r.clientId === fab.id) })
    expect(avecHisto.sections[0].exos.some((x) => x.derniere)).toBe(true)
    expect(a.sections[0].exos.every((x) => x.derniere === null)).toBe(true)
  })
})
