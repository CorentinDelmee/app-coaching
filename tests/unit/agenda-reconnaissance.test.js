// Reconnaissance des clients dans les vrais titres de l'agenda de Corentin (docs/CONTRAT-AGENDA-GOOGLE.md, partie B).
import { describe, expect, it } from 'vitest'
import { cleTitre, estCoaching, reconnaitreClients } from '../../src/domain/agendaGoogle.js'

const CLIENTS = [
  { id: 'christine', nom: 'Christine Durand' }, { id: 'didier', nom: 'Didier Durand' },
  { id: 'sylvain', nom: 'Sylvain Moreau' }, { id: 'guillaume', nom: 'Guillaume Petit' },
  { id: 'fabien', nom: 'Fabien Vincent' }, { id: 'denis', nom: 'Denis Leroy' },
  { id: 'caroline', nom: 'Caroline Mion' }, { id: 'cindy', nom: 'Cindy Roux' }
]
const r = (titre, clients = CLIENTS, alias) => reconnaitreClients(titre, clients, alias)

describe('estCoaching', () => {
  it('casse et accents ignorés ; « Coachings » ou un autre mot refusés', () => {
    expect(estCoaching('Coaching Sylvain')).toBe(true)
    expect(estCoaching('COACHING sylvain')).toBe(true)
    expect(estCoaching('Côaching Sylvain')).toBe(true)
    expect(estCoaching('Coaching (Caroline  Mion)')).toBe(true)
    expect(estCoaching('Coachings')).toBe(false)
    expect(estCoaching('RDV Coaching Sylvain')).toBe(false)
    expect(estCoaching('')).toBe(false)
  })
})

describe('reconnaitreClients : vrais titres', () => {
  it.each([
    ['Coaching Christine (domicile)', ['christine']],
    ['Coaching Sylvain', ['sylvain']],
    ['Coaching Guillaume', ['guillaume']],
    ['Coaching Fabien', ['fabien']],
    ['Coaching Denis', ['denis']],
    ['Coaching Caroline', ['caroline']],
    ['Coaching Christine et Didier', ['christine', 'didier']],
    ['Coaching (Caroline  Mion)', ['caroline']],
    ['Coaching Ownsport Cindy', ['cindy']],
    ['Coaching Didier Christine', ['didier', 'christine']],
    ['Coaching Fabien Vincent', ['fabien']],
    ['coaching vincent fabien', ['fabien']]
  ])('%s', (titre, ids) => {
    expect(r(titre)).toEqual({ statut: 'attribue', clientIds: ids })
  })
  it('sans nom, nom inconnu, nom de famille seul : jamais deviné', () => {
    expect(r('Coaching')).toEqual({ statut: 'sans-nom' })
    expect(r('Coaching ()')).toEqual({ statut: 'sans-nom' })
    expect(r('Coaching Bertrand')).toEqual({ statut: 'inconnu' })
    expect(r('Coaching Vincent')).toEqual({ statut: 'inconnu' })
  })
  it('prénom partagé par 2 clients (même archivé) -> ambigu ; le nom complet tranche', () => {
    const avecHomonyme = [...CLIENTS, { id: 'christine2', nom: 'Christine Mallet', archive: true }]
    expect(r('Coaching Christine (domicile)', avecHomonyme)).toEqual({ statut: 'ambigu', candidats: ['christine', 'christine2'] })
    expect(r('Coaching Christine et Didier', avecHomonyme)).toEqual({ statut: 'ambigu', candidats: ['didier', 'christine', 'christine2'] })
    expect(r('Coaching Christine Mallet', avecHomonyme)).toEqual({ statut: 'attribue', clientIds: ['christine2'] })
  })
  it('homonymes complets -> ambigu', () => {
    const doubles = [{ id: 'a', nom: 'Marc Dupont' }, { id: 'b', nom: 'Marc Dupont' }]
    expect(r('Coaching Marc Dupont', doubles)).toEqual({ statut: 'ambigu', candidats: ['a', 'b'] })
  })
  it('alias retenu par le coach : prioritaire, ids inconnus ignorés', () => {
    const avecHomonyme = [...CLIENTS, { id: 'christine2', nom: 'Christine Mallet' }]
    const alias = { [cleTitre('Coaching Christine (domicile)')]: ['christine2', 'disparu'] }
    expect(r('coaching  CHRISTINE (domicile)', avecHomonyme, alias)).toEqual({ statut: 'attribue', clientIds: ['christine2'] })
    expect(r('Coaching Christine', avecHomonyme, alias).statut).toBe('ambigu') // autre titre : autre clé
  })
  it('cleTitre normalise parenthèses, espaces, accents', () => {
    expect(cleTitre('Coaching (Caroline  Mion)')).toBe('coaching caroline mion')
    expect(cleTitre('COACHING Caroline Mion')).toBe('coaching caroline mion')
  })
})
