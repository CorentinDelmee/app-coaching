import { describe, it, expect } from 'vitest'
import { creerAdapterLocal, stockageMemoire } from '../../src/data/adapters/local.js'
import { creerFauxGoogle } from '../../src/data/demo/agendaGoogle.js'
import { synchroniser, etatVide } from '../../src/domain/agendaGoogle.js'

const NOW = Date.parse('2026-10-26T14:00:00Z')
const nouvelle = () => creerAdapterLocal({ storage: stockageMemoire(), now: () => NOW })

describe('Google Agenda en démo (adaptateur local)', () => {
  it('Fabien voit ses séances Coaching, pas celles des autres', async () => {
    const data = nouvelle()
    await data.connecter('fabien.vincent', 'DEMO2024')
    const seances = await data.seancesCoaching.lister({ clientId: 'client-fabien-vincent' })
    const agenda = seances.filter((s) => s.source === 'google')
    expect(agenda.map((s) => s.id).sort()).toEqual(['gcal-demo-ev-1', 'gcal-demo-ev-3'])
    expect(agenda.every((s) => s.statut === 'prevue' && s.clientId === 'client-fabien-vincent')).toBe(true)
  })
  it('le coach voit les alertes (inconnu, ambigu) ; la synchro apporte modif, annulation, correction, nouvel événement', async () => {
    const data = nouvelle()
    await data.connecter('corentin', 'COACH2026')
    let etat = await data.agenda.etat()
    expect(etat.alertes.map((a) => a.type).sort()).toEqual(['ambigu', 'inconnu'])
    const bilan = await data.agenda.synchroniser()
    expect(bilan).toMatchObject({ ajoutes: 1, modifies: 2, supprimes: 1, complet: false })
    etat = await data.agenda.etat()
    expect(etat.alertes.map((a) => a.type).sort()).toEqual(['ambigu', 'sans-nom']) // Camille corrigée en Thomas, nouvel événement sans nom
    expect(etat.evenements.find((e) => e.id === 'demo-ev-1')).toMatchObject({ heure: '19:15', lieu: 'salle' })
    expect(etat.evenements.find((e) => e.id === 'demo-ev-2')).toBeUndefined()
    expect(etat.derniereSynchro).toBe(NOW)
  })
  it('un client ne peut pas déclencher la synchro ; les alertes ne lui sont pas visibles', async () => {
    const data = nouvelle()
    await data.connecter('lea.martin', 'DEMO2024')
    await expect(data.agenda.synchroniser()).rejects.toThrow()
    expect((await data.agenda.etat()).evenements.every((e) => e.statut === 'attribue' && e.clientId === 'client-lea-martin')).toBe(true)
  })
  it('jeton expiré : le faux Google répond 410 et le moteur resynchronise', async () => {
    const r = await synchroniser(creerFauxGoogle(NOW), { ...etatVide(), syncToken: 'perime' }, NOW)
    expect(r.bilan.complet).toBe(true)
    expect(Object.keys(r.etat.evenements)).toHaveLength(7)
  })
})

import { fusionnerSeances } from '../../src/domain/fusionSeances.js'
import { formaterHeure, prochaineSeance } from '../../src/domain/coaching.js'

describe('fusion natives + Google', () => {
  const nat = { id: 'n1', clientId: 'c', date: '2026-11-03', heure: '18:30', statut: 'prevue' }
  const goo = (heure, extra = {}) => ({ id: 'gcal-x', clientId: 'c', date: '2026-11-03', heure, statut: 'prevue', source: 'google', ...extra })
  it('même créneau (±15 min) : une seule entrée, la native enrichie', () => {
    const r = fusionnerSeances([nat], [goo('18:45')])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: 'n1', googleId: 'gcal-x' })
  })
  it('créneau différent, autre client, native annulée : les deux restent', () => {
    expect(fusionnerSeances([nat], [goo('19:00')])).toHaveLength(2)
    expect(fusionnerSeances([nat], [goo('18:30', { clientId: 'd' })])).toHaveLength(2)
    expect(fusionnerSeances([{ ...nat, statut: 'annulee' }], [goo('18:30')])).toHaveLength(2)
  })
  it('journée entière : jamais fusionnée, affichée « journée », reste à venir toute la journée', () => {
    const j = goo('', { journee: true })
    expect(fusionnerSeances([nat], [j])).toHaveLength(2)
    expect(formaterHeure('')).toBe('journée')
    expect(prochaineSeance([j], Date.parse('2026-11-03T20:00:00'))).toBe(j)
  })
})
