// Synchro Google Agenda -> séances de coaching (docs/CONTRAT-AGENDA-GOOGLE.md, partie B). L'API réservation est simulée.
import { beforeEach, describe, expect, it } from 'vitest'
import { creerSynchroAgenda, decouper, fenetre } from '../src/agenda-synchro.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'

const NOW = Date.parse('2026-11-12T10:00:00Z')
const CLIENTS = [
  ['christine', 'Christine Durand'], ['didier', 'Didier Durand'], ['sylvain', 'Sylvain Moreau'], ['guillaume', 'Guillaume Petit'],
  ['fabien', 'Fabien Vincent'], ['denis', 'Denis Leroy'], ['caroline', 'Caroline Mion'], ['cindy', 'Cindy Roux']
]
const ev = (id, titre, debut, fin, extra = {}) => ({ id, titre, debut, fin, journee: false, lieu: '', annule: false, maj: '2026-10-01T00:00:00Z', ...extra })
const BASE = () => [
  ev('e-passe', 'Coaching Christine et Didier', '2026-03-10T10:00:00+01:00', '2026-03-10T11:00:00+01:00'),
  ev('e-guil', 'Coaching Guillaume', '2026-11-13T11:30:00+01:00', '2026-11-13T12:30:00+01:00', { lieu: 'Danse & Fitness Rambouillet' }),
  ev('e-fab', 'Coaching Fabien', '2026-11-20T18:30:00+01:00', '2026-11-20T19:30:00+01:00'),
  ev('e-caro', 'Coaching (Caroline  Mion)', '2026-06-02T09:00:00+02:00', '2026-06-02T10:00:00+02:00'),
  ev('e-inconnu', 'Coaching Bertrand', '2026-11-14T09:00:00+01:00', '2026-11-14T10:00:00+01:00'),
  ev('e-perso', 'Dentiste', '2026-11-15T09:00:00+01:00', '2026-11-15T10:00:00+01:00')
]

let db, store, evenements, appels, reponse, synchro
beforeEach(async () => {
  db = ouvrirBase(':memory:')
  store = creerStoreSqlite(db)
  for (const [id, nom] of CLIENTS) await store.ecrire('profils', { id, role: 'client', identifiant: id, nom, tarif: 40, lieuDefaut: 'domicile', archive: false, creeLe: 1 })
  evenements = BASE()
  appels = []
  reponse = null
  const fetchFn = async (url, opts) => {
    appels.push({ url, cle: opts.headers['x-resa-admin-key'] })
    if (reponse) return reponse
    return { ok: true, status: 200, json: async () => ({ evenements }) }
  }
  synchro = creerSynchroAgenda({ db, config: { resaUrl: 'http://resa', resaCle: 'k'.repeat(40) }, fetchFn, now: () => NOW, log: () => {} })
})
const seances = async () => Object.fromEntries((await store.tout('seancesCoaching')).map((s) => [s.id, s]))
const zero = { crees: 0, modifies: 0, supprimes: 0, annules: 0 }
const compte = (b) => ({ crees: b.crees, modifies: b.modifies, supprimes: b.supprimes, annules: b.annules })

describe('fenêtre et découpage', () => {
  it('du 2026-01-01 à aujourd\'hui + 90 j, appels ≤ 400 jours, paramètres encodés', async () => {
    expect(fenetre(NOW)).toEqual({ depuis: '2026-01-01', jusqua: '2027-02-10' })
    expect(fenetre(Date.parse('2028-06-01T10:00:00Z')).depuis).toBe('2027-04-28') // au plus 400 jours en arrière
    const morceaux = decouper('2026-01-01', '2027-02-10')
    expect(morceaux).toHaveLength(2)
    for (const [d, f] of morceaux) expect(Date.parse(f) - Date.parse(d)).toBeLessThanOrEqual(400 * 864e5)
    await synchro.synchroniser()
    expect(appels).toHaveLength(2)
    expect(appels[0].url).toBe('http://resa/api/resa/admin/evenements?depuis=2025-12-31T00%3A00%3A00.000Z&jusqua=2027-02-04T00%3A00%3A00.000Z')
    expect(appels[0].cle).toBe('k'.repeat(40))
  })
})

describe('synchroniser', () => {
  it('crée une séance par (événement, client) ; passées faites, futures prévues ; à attribuer comptés', async () => {
    const b = await synchro.synchroniser()
    expect(b).toMatchObject({ ok: true, evenements: 5, crees: 5, modifies: 0, supprimes: 0, aAttribuer: 1 })
    const s = await seances()
    expect(Object.keys(s).sort()).toEqual(['google:e-caro:caroline', 'google:e-fab:fabien', 'google:e-guil:guillaume', 'google:e-passe:christine', 'google:e-passe:didier'])
    expect(s['google:e-passe:christine']).toMatchObject({ clientId: 'christine', date: '2026-03-10', heure: '10:00', duree: 60, statut: 'faite', tarif: 40, lieu: 'domicile', source: 'google' })
    expect(s['google:e-guil:guillaume']).toMatchObject({ date: '2026-11-13', heure: '11:30', statut: 'prevue', lieu: 'salle', lieuTexte: 'Danse & Fitness Rambouillet' })
    expect(synchro.aAttribuer()).toEqual([{ cle: 'coaching bertrand', titre: 'Coaching Bertrand', statut: 'inconnu', nb: 1, premier: '2026-11-14', dernier: '2026-11-14', candidats: [] }])
    expect(synchro.dernierBilan().derniereSynchro).toBe(new Date(NOW).toISOString())
  })

  it('idempotente : 2 passes = 0 changement', async () => {
    await synchro.synchroniser()
    const avant = await seances()
    expect(compte(await synchro.synchroniser())).toEqual(zero)
    expect(await seances()).toEqual(avant)
  })

  it('événement déplacé : date/heure/durée suivent ; un statut changé à la main est gardé', async () => {
    await synchro.synchroniser()
    const fab = (await seances())['google:e-fab:fabien']
    await store.ecrire('seancesCoaching', { ...fab, statut: 'annulee', note: 'reporté' })
    evenements[2] = ev('e-fab', 'Coaching Fabien', '2026-11-21T10:00:00+01:00', '2026-11-21T11:30:00+01:00')
    expect(compte(await synchro.synchroniser())).toEqual({ ...zero, modifies: 1 })
    expect((await seances())['google:e-fab:fabien']).toMatchObject({ date: '2026-11-21', heure: '10:00', duree: 90, statut: 'annulee', note: 'reporté' })
    expect(compte(await synchro.synchroniser())).toEqual(zero) // et toujours stable
  })

  it('heure changée à la main : gardée même si Google change', async () => {
    await synchro.synchroniser()
    const g = (await seances())['google:e-guil:guillaume']
    await store.ecrire('seancesCoaching', { ...g, heure: '12:00' })
    evenements[1] = { ...evenements[1], debut: '2026-11-13T15:00:00+01:00', fin: '2026-11-13T16:00:00+01:00' }
    await synchro.synchroniser()
    expect((await seances())['google:e-guil:guillaume']).toMatchObject({ heure: '12:00', date: '2026-11-13' })
  })

  it('annulé : séance future supprimée, passée marquée annulée (dates vides tolérées)', async () => {
    await synchro.synchroniser()
    evenements[1] = { id: 'e-guil', titre: '', debut: '', fin: '', journee: false, lieu: '', annule: true, maj: null }
    evenements[0] = { ...evenements[0], annule: true }
    const b = await synchro.synchroniser()
    expect(compte(b)).toEqual({ ...zero, supprimes: 1, annules: 2 })
    const s = await seances()
    expect(s['google:e-guil:guillaume']).toBeUndefined()
    expect(s['google:e-passe:christine'].statut).toBe('annulee')
    expect(db.prepare("SELECT 1 FROM seances_agenda WHERE id = 'e-guil'").get()).toBeUndefined()
  })

  it('disparu de Google : future supprimée, passée gardée telle quelle', async () => {
    await synchro.synchroniser()
    evenements = evenements.filter((e) => !['e-fab', 'e-caro'].includes(e.id))
    expect(compte(await synchro.synchroniser())).toEqual({ ...zero, supprimes: 1 })
    const s = await seances()
    expect(s['google:e-fab:fabien']).toBeUndefined()
    expect(s['google:e-caro:caroline'].statut).toBe('faite')
  })

  it('titre changé vers un autre client : l\'ancienne séance future part, la nouvelle arrive', async () => {
    await synchro.synchroniser()
    evenements[2] = { ...evenements[2], titre: 'Coaching Denis' }
    expect(compte(await synchro.synchroniser())).toEqual({ ...zero, crees: 1, supprimes: 1 })
    const s = await seances()
    expect(s['google:e-fab:fabien']).toBeUndefined()
    expect(s['google:e-fab:denis']).toMatchObject({ statut: 'prevue' })
  })

  it('audit 2 : client corrigé sur un coaching PASSÉ : la séance « faite » de l\'ancien client part, sauf s\'il a été modifié à la main', async () => {
    evenements.push(ev('e-p2', 'Coaching Sylvain', '2026-10-06T10:00:00+02:00', '2026-10-06T11:00:00+02:00'))
    await synchro.synchroniser()
    const caro = (await seances())['google:e-caro:caroline']
    await store.ecrire('seancesCoaching', { ...caro, lieu: 'salle' }) // modifiée à la main : gardée
    evenements = evenements.map((e) => (e.id === 'e-p2' ? { ...e, titre: 'Coaching Denis' } : e.id === 'e-caro' ? { ...e, titre: 'Coaching Cindy' } : e))
    expect(compte(await synchro.synchroniser())).toEqual({ ...zero, crees: 2, supprimes: 1 })
    const s = await seances()
    expect(s['google:e-p2:sylvain']).toBeUndefined()
    expect(s['google:e-p2:denis']).toMatchObject({ statut: 'faite' })
    expect(s['google:e-caro:caroline']).toMatchObject({ lieu: 'salle' })
    expect(compte(await synchro.synchroniser())).toEqual(zero)
  })

  it('séance déjà saisie à la main au même créneau (±15 min) : pas de doublon', async () => {
    await store.ecrire('seancesCoaching', { id: 'manuelle', clientId: 'fabien', date: '2026-11-20', heure: '18:40', lieu: 'domicile', statut: 'prevue', tarif: 35 })
    const b = await synchro.synchroniser()
    expect(b.jumelles).toBe(1)
    expect((await seances())['google:e-fab:fabien']).toBeUndefined()
  })

  it('503 google_lecture_non_autorisee : erreur claire, rien supprimé, dernière synchro inchangée', async () => {
    await synchro.synchroniser()
    const avant = await seances()
    reponse = { ok: false, status: 503, json: async () => ({ erreur: 'google_lecture_non_autorisee' }) }
    await expect(synchro.synchroniser()).rejects.toMatchObject({ code: 'google_lecture_non_autorisee', statut: 503 })
    expect(await seances()).toEqual(avant)
    expect(synchro.dernierBilan().bilan).toMatchObject({ ok: false, erreur: 'google_lecture_non_autorisee' })
    reponse = { ok: false, status: 502, json: async () => ({ erreur: 'google_indisponible' }) }
    await expect(synchro.synchroniser()).rejects.toMatchObject({ code: 'google_indisponible', statut: 502 })
  })

  it('jamais deux synchros en même temps : la 2e reçoit le résultat de la 1re', async () => {
    const [a, b] = await Promise.all([synchro.synchroniser(), synchro.synchroniser()])
    expect(a).toBe(b)
    expect(appels).toHaveLength(2) // une seule synchro (2 périodes)
  })

  it('journée entière : visible dans l\'agenda, pas de séance', async () => {
    evenements.push({ id: 'e-jour', titre: 'Coaching Sylvain', debut: '2026-11-18', fin: '2026-11-19', journee: true, lieu: '', annule: false, maj: null })
    const b = await synchro.synchroniser()
    expect(b.journees).toBe(1)
    expect(Object.keys(await seances()).some((id) => id.startsWith('google:e-jour'))).toBe(false)
    expect(JSON.parse(db.prepare("SELECT data FROM seances_agenda WHERE id = 'e-jour'").get().data)).toMatchObject({ statut: 'attribue', clientId: 'sylvain', journee: true })
  })
})

describe('attribuer', () => {
  it('alias retenu : les événements du titre deviennent des séances, et le restent aux synchros suivantes', async () => {
    await synchro.synchroniser()
    const b = synchro.attribuer('Coaching Bertrand', ['sylvain'])
    expect(b).toMatchObject({ cle: 'coaching bertrand', clientIds: ['sylvain'], crees: 1 })
    expect((await seances())['google:e-inconnu:sylvain']).toMatchObject({ date: '2026-11-14', statut: 'prevue' })
    expect(synchro.aAttribuer()).toEqual([])
    expect(compte(await synchro.synchroniser())).toEqual(zero)
  })
  it('refuse un client inconnu, une liste vide ou un titre qui n\'est pas un coaching', () => {
    expect(() => synchro.attribuer('Coaching Bertrand', ['personne'])).toThrow('client_inconnu')
    expect(() => synchro.attribuer('Coaching Bertrand', [])).toThrow('invalide')
    expect(() => synchro.attribuer('Dentiste', ['sylvain'])).toThrow('invalide')
  })
  it('prénom partagé : à attribuer avec les candidats', async () => {
    await store.ecrire('profils', { id: 'christine2', role: 'client', identifiant: 'christine2', nom: 'Christine Mallet', archive: true, creeLe: 1 })
    evenements.push(ev('e-chr', 'Coaching Christine (domicile)', '2026-11-16T10:00:00+01:00', '2026-11-16T11:00:00+01:00'))
    await synchro.synchroniser()
    const g = synchro.aAttribuer().find((x) => x.cle === 'coaching christine domicile')
    expect(g).toMatchObject({ statut: 'ambigu', candidats: [{ id: 'christine', nom: 'Christine Durand', archive: false }, { id: 'christine2', nom: 'Christine Mallet', archive: true }] })
  })
})

describe('MCP consulter_agenda', () => {
  it('les coachings Google (en base) sont inclus, marqués source google', async () => {
    const { creerService } = await import('../src/service.js')
    await synchro.synchroniser()
    const service = creerService({ backend: store, biblio: null, now: () => NOW })
    const r = await service.consulterAgenda({ client: 'Guillaume Petit', du: '2026-11-01', au: '2026-11-30' })
    expect(r.coaching).toEqual([{ date: '2026-11-13', heure: '11:30', lieu: 'salle', statut: 'prevue', source: 'google', duree: 60 }])
  })
})
