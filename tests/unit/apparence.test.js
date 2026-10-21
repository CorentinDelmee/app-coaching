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
    expect(CHOIX).toEqual({ policeChrono: 'barlow', accueil: 'pret', texteAplat: 'fonce' })
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
