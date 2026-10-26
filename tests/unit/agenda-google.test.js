import { describe, it, expect } from 'vitest'
import { normaliser, analyserTitre, attribuer, fusionner, synchroniser, etatVide, evaluer, alertesAgenda, seancesPourClient, jourHeure } from '../../src/domain/agendaGoogle.js'

const clients = [
  { id: 'c1', nom: 'Fabien Vincent' }, { id: 'c2', nom: 'Léa Martin' },
  { id: 'c3', nom: 'Marc Dupont' }, { id: 'c4', nom: 'Marc Dupont' }
]
const ev = (id, summary, extra = {}) => ({
  id, summary, etag: `"e-${id}-1"`, updated: '2026-10-26T10:00:00Z',
  start: { dateTime: '2026-11-03T18:30:00+01:00' }, end: { dateTime: '2026-11-03T19:30:00+01:00' }, ...extra
})

describe('titre', () => {
  it('normalise accents, casse, tirets et espaces', () => {
    expect(normaliser('  LÉA   Martin-Dupré ')).toBe('lea martin dupre')
  })
  it('ignore ce qui ne commence pas par Coaching', () => {
    expect(analyserTitre('Rdv dentiste')).toBeNull()
    expect(analyserTitre('Coachingxyz Léa')).toBeNull()
    expect(analyserTitre('Séance Coaching Léa')).toBeNull()
  })
  it('extrait nom et tag', () => {
    expect(analyserTitre('coaching - Fabien  Vincent #FV2')).toEqual({ nom: 'Fabien  Vincent', tag: 'fv2' })
    expect(analyserTitre('Coaching', 'Client : #fv2')).toEqual({ nom: '', tag: 'fv2' })
    expect(analyserTitre('COACHING :   ')).toEqual({ nom: '', tag: null })
  })
})

describe('attribution', () => {
  const att = (titre, alias, desc) => attribuer(analyserTitre(titre, desc), clients, alias)
  it("attribue sans tenir compte de la casse, des accents ni de l'ordre", () => {
    expect(att('Coaching Fabien Vincent')).toEqual({ statut: 'attribue', clientId: 'c1' })
    expect(att('COACHING vincent  fabien')).toEqual({ statut: 'attribue', clientId: 'c1' })
    expect(att('Coaching lea martin')).toEqual({ statut: 'attribue', clientId: 'c2' })
    expect(att('Coaching Léa-Martin')).toEqual({ statut: 'attribue', clientId: 'c2' })
  })
  it('nom inconnu et titre sans nom', () => {
    expect(att('Coaching Jean Inconnu').statut).toBe('inconnu')
    expect(att('Coaching').statut).toBe('sans-nom')
  })
  it('homonymes : ambigu, sauf identifiant court', () => {
    expect(att('Coaching Marc Dupont')).toEqual({ statut: 'ambigu', candidats: ['c3', 'c4'] })
    expect(att('Coaching Marc Dupont #md2', { md2: 'c4' })).toEqual({ statut: 'attribue', clientId: 'c4' })
    expect(att('Coaching Marc Dupont', { md2: 'c4' }, 'ref #md2')).toEqual({ statut: 'attribue', clientId: 'c4' })
  })
  it('tag inconnu : retombe sur le nom, sinon inconnu', () => {
    expect(att('Coaching Léa Martin #zz', {}).statut).toBe('attribue')
    expect(att('Coaching #zz', {}).statut).toBe('inconnu')
  })
})

describe('dates', () => {
  it('convertit dans le fuseau du coach (hiver et été)', () => {
    expect(jourHeure('2026-11-03T17:30:00Z')).toEqual({ date: '2026-11-03', heure: '18:30' })
    expect(jourHeure('2026-07-03T16:30:00Z')).toEqual({ date: '2026-07-03', heure: '18:30' })
  })
})

describe('fusion', () => {
  it('crée, ignore les événements non coaching', () => {
    const { etat, bilan } = fusionner(etatVide(), [ev('a', 'Coaching Léa Martin'), ev('b', 'Dentiste')])
    expect(Object.keys(etat.evenements)).toEqual(['a'])
    expect(bilan).toEqual({ ajoutes: 1, modifies: 0, supprimes: 0 })
    expect(etat.evenements.a).toMatchObject({ date: '2026-11-03', heure: '18:30', finHeure: '19:30', lieu: 'domicile' })
  })
  it('modification (heure, lieu) et même etag = inchangé', () => {
    const { etat } = fusionner(etatVide(), [ev('a', 'Coaching Léa Martin')])
    expect(fusionner(etat, [ev('a', 'Coaching Léa Martin')]).bilan).toEqual({ ajoutes: 0, modifies: 0, supprimes: 0 })
    const modif = ev('a', 'Coaching Léa Martin', { etag: '"e-a-2"', updated: '2026-10-27T08:00:00Z', start: { dateTime: '2026-11-03T19:00:00+01:00' }, location: 'Salle Pulse' })
    const r2 = fusionner(etat, [modif])
    expect(r2.bilan.modifies).toBe(1)
    expect(r2.etat.evenements.a).toMatchObject({ heure: '19:00', lieu: 'salle' })
  })
  it('titre changé : réattribution au nouveau client sans doublon', () => {
    let { etat } = fusionner(etatVide(), [ev('a', 'Coaching Léa Martin')])
    etat = fusionner(etat, [ev('a', 'Coaching Fabien Vincent', { etag: '"2"' })]).etat
    const e = evaluer(etat, clients)
    expect(e).toHaveLength(1)
    expect(e[0].clientId).toBe('c1')
  })
  it('suppression, annulation et titre devenu non-coaching', () => {
    const { etat } = fusionner(etatVide(), [ev('a', 'Coaching Léa Martin'), ev('b', 'Coaching Fabien Vincent'), ev('c', 'Coaching Marc Dupont')])
    const r = fusionner(etat, [{ id: 'a', status: 'cancelled' }, ev('b', 'Pause', { etag: '"2"' }), { id: 'zzz', status: 'cancelled' }])
    expect(Object.keys(r.etat.evenements)).toEqual(['c'])
    expect(r.bilan.supprimes).toBe(2)
  })
  it('resynchro complète retire ce qui manque', () => {
    const { etat } = fusionner(etatVide(), [ev('a', 'Coaching Léa Martin'), ev('b', 'Coaching Fabien Vincent')])
    const r = fusionner(etat, [ev('b', 'Coaching Fabien Vincent')], { complet: true })
    expect(Object.keys(r.etat.evenements)).toEqual(['b'])
    expect(r.bilan.supprimes).toBe(1)
  })
})

describe('synchroniser (syncToken)', () => {
  const NOW = Date.parse('2026-10-26T12:00:00Z')
  it('1re synchro complète, pages multiples, puis incrémentale', async () => {
    const appels = []
    const source = {
      async lister(p) {
        appels.push(p)
        if (!p.syncToken && !p.pageToken) return { items: [ev('a', 'Coaching Léa Martin')], nextPageToken: 'p2' }
        if (p.pageToken === 'p2') return { items: [ev('b', 'Coaching Fabien Vincent')], nextSyncToken: 'T1' }
        return { items: [{ id: 'a', status: 'cancelled' }], nextSyncToken: 'T2' }
      }
    }
    const r1 = await synchroniser(source, etatVide(), NOW)
    expect(r1.etat.syncToken).toBe('T1')
    expect(r1.bilan).toMatchObject({ ajoutes: 2, complet: true })
    const r2 = await synchroniser(source, r1.etat, NOW + 1)
    expect(appels.at(-1).syncToken).toBe('T1')
    expect(r2.etat.syncToken).toBe('T2')
    expect(Object.keys(r2.etat.evenements)).toEqual(['b'])
    expect(r2.bilan).toMatchObject({ supprimes: 1, complet: false })
  })
  it('syncToken expiré (410) : resynchro complète automatique', async () => {
    const source = {
      async lister(p) {
        if (p.syncToken) { const e = new Error('Gone'); e.status = 410; throw e }
        return { items: [ev('b', 'Coaching Fabien Vincent')], nextSyncToken: 'T9' }
      }
    }
    const ancien = { ...etatVide(), syncToken: 'perime', evenements: fusionner(etatVide(), [ev('a', 'Coaching Léa Martin')]).etat.evenements }
    const r = await synchroniser(source, ancien, NOW)
    expect(Object.keys(r.etat.evenements)).toEqual(['b'])
    expect(r.etat.syncToken).toBe('T9')
    expect(r.bilan.complet).toBe(true)
  })
  it('autre erreur : propagée', async () => {
    await expect(synchroniser({ lister: async () => { throw new Error('boom') } }, etatVide(), NOW)).rejects.toThrow('boom')
  })
})

describe('lecture', () => {
  const NOW = Date.parse('2026-10-26T12:00:00Z')
  it('alertes (inconnu, ambigu, sans nom) et séances du client', () => {
    const { etat } = fusionner(etatVide(), [
      ev('a', 'Coaching Fabien Vincent'), ev('b', 'Coaching Inconnu Total'), ev('c', 'Coaching Marc Dupont'), ev('d', 'Coaching'),
      ev('e', 'Coaching Fabien Vincent', { start: { dateTime: '2026-10-01T10:00:00Z' }, end: { dateTime: '2026-10-01T11:00:00Z' } })
    ])
    const evalues = evaluer(etat, clients)
    expect(alertesAgenda(evalues, NOW).map((x) => x.type).sort()).toEqual(['ambigu', 'inconnu', 'sans-nom'])
    const seances = seancesPourClient(evalues, 'c1', 35, NOW)
    expect(seances).toHaveLength(1)
    expect(seances[0]).toMatchObject({ id: 'gcal-a', clientId: 'c1', date: '2026-11-03', heure: '18:30', statut: 'prevue', tarif: 35 })
    expect(seancesPourClient(evalues, 'c2', 35, NOW)).toEqual([])
  })
})

import { readFileSync } from 'node:fs'
describe('copie pour l\'Edge Function', () => {
  it('supabase/functions/_shared/agendaGoogle.js est identique à src/domain/agendaGoogle.js', () => {
    const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    expect(lire('../../supabase/functions/_shared/agendaGoogle.js')).toBe(lire('../../src/domain/agendaGoogle.js'))
  })
})
