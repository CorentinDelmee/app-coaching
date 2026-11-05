// Outils coach « réservations » (lot 6) : API réservation simulée par fetchFn (aucun réseau).
import { beforeEach, describe, expect, it } from 'vitest'
import { creerOutils, appeler } from '../../serveur/src/outils.js'
import { creerService } from '../../serveur/src/service.js'
import { creerStoreSqlite, ouvrirBase } from '../../serveur/src/magasin-sqlite.js'
import { versIsoParis } from '../../serveur/src/outils/reservations.js'

const NOW = Date.UTC(2026, 10, 5, 10)
const ID_A = '6f1c0000-0000-4000-8000-000000000001'
const ID_B = '6f1c0000-0000-4000-8000-000000000002'
const resa = (id, debut, prenom, extra = {}) => ({
  id, debut, fin: debut.replace(/T(\d\d)/, (_, h) => `T${String(Number(h) + 1).padStart(2, '0')}`), prenom, nom: 'DUPONT',
  email: `${prenom}@exemple.fr`, telephone: '0612345678', adresse: '12 rue des Lilas', commune: 'Épernon',
  statut: 'a_venir', cree_le: '2026-11-01T08:00:00.000Z', annulee_le: null, google_event_id: 'resaX', synchro_etat: 'cree', ...extra
})

let outils, appels, reponses
const journal = { ecrire() {} }
const lancer = (nom, args) => appeler({ outils, journal }, nom, args, 'test')
const json = (statut, corps) => ({ status: statut, ok: statut < 300, json: async () => corps })

beforeEach(() => {
  appels = []
  reponses = {}
  const fetchFn = async (url, opts) => {
    appels.push({ url, methode: opts.method, corps: opts.body ? JSON.parse(opts.body) : undefined, cle: opts.headers['X-Resa-Admin-Key'], headers: opts.headers })
    const cle = `${opts.method} ${url.replace('http://resa.test/api/resa/admin/', '')}`
    const r = reponses[cle]
    if (r instanceof Error) throw r
    return r ?? json(404, { erreur: 'introuvable' })
  }
  const backend = creerStoreSqlite(ouvrirBase(':memory:'))
  const service = creerService({ backend, biblio: {}, now: () => NOW })
  const config = { resaUrl: 'http://resa.test', resaCle: 'k'.repeat(40) }
  outils = creerOutils(service, { service, backend, biblio: {}, config, now: () => NOW, fetchFn })
})

describe('versIsoParis', () => {
  it('ajoute le décalage de Paris (hiver et été)', () => {
    expect(versIsoParis('2026-11-06T14:00')).toBe('2026-11-06T14:00:00+01:00')
    expect(versIsoParis('2026-07-06T14:00')).toBe('2026-07-06T14:00:00+02:00')
    expect(versIsoParis('2026-11-06')).toBe('2026-11-06')
  })
})

describe('lister_reservations', () => {
  it('filtre par statut et période, sans exposer google_event_id, avec la clé admin', async () => {
    reponses['GET reservations?statut=a_venir'] = json(200, { reservations: [resa(ID_A, '2026-11-06T09:00:00+01:00', 'Jeanne'), resa(ID_B, '2026-11-12T09:00:00+01:00', 'Paul', { synchro_etat: 'a_creer' })] })
    const tout = await lancer('lister_reservations', {})
    expect(tout.ok).toBe(true)
    expect(tout.donnees.total).toBe(2)
    expect(JSON.stringify(tout.donnees)).not.toContain('resaX')
    expect(appels[0].cle).toBe('k'.repeat(40))
    expect(appels[0].headers['X-Forwarded-For']).toBeUndefined()
    const p = (await lancer('lister_reservations', { du: '2026-11-10', au: '2026-11-12' })).donnees
    expect(p.reservations.map((r) => r.id)).toEqual([ID_B])
    expect(p.reservations[0].agenda).toContain('en cours')
    reponses['GET reservations?statut=annulees'] = json(200, { reservations: [] })
    expect((await lancer('lister_reservations', { statut: 'annulees' })).donnees.total).toBe(0)
    expect((await lancer('lister_reservations', { statut: 'toutes' })).code).toBe('VALIDATION')
  })
  it('erreurs : API en panne -> RESERVATION_INDISPONIBLE ; clé absente -> NON_DISPONIBLE', async () => {
    reponses['GET reservations?statut=a_venir'] = json(503, { erreur: 'indisponible' })
    expect((await lancer('lister_reservations', {})).code).toBe('RESERVATION_INDISPONIBLE')
    reponses['GET reservations?statut=a_venir'] = new Error('ECONNREFUSED')
    expect((await lancer('lister_reservations', {})).code).toBe('RESERVATION_INDISPONIBLE')
    const service = creerService({ backend: creerStoreSqlite(ouvrirBase(':memory:')), biblio: {}, now: () => NOW })
    const sans = creerOutils(service, { service, backend: {}, config: { resaUrl: 'http://resa.test', resaCle: '' }, fetchFn: async () => json(200, {}) })
    expect((await appeler({ outils: sans, journal }, 'lister_reservations', {}, 't')).code).toBe('NON_DISPONIBLE')
  })
})

describe('annuler_reservation (2 temps)', () => {
  beforeEach(() => {
    reponses['GET reservations?statut=a_venir'] = json(200, { reservations: [resa(ID_A, '2026-11-06T09:00:00+01:00', 'Jeanne')] })
    reponses[`POST reservations/${ID_A}/annuler`] = json(200, { ok: true, reservation: resa(ID_A, '2026-11-06T09:00:00+01:00', 'Jeanne', { statut: 'annulee', synchro_etat: 'supprime' }) })
  })
  it('sans jeton : résumé + jeton, aucun POST', async () => {
    const r = await lancer('annuler_reservation', { id: ID_A })
    expect(r.donnees.confirmationRequise).toBe(true)
    expect(r.donnees.resume).toContain('Jeanne')
    expect(appels.some((a) => a.methode === 'POST')).toBe(false)
  })
  it('mauvais jeton refusé, bon jeton annule, jeton à usage unique et lié à l\'id', async () => {
    const { jeton } = (await lancer('annuler_reservation', { id: ID_A })).donnees
    expect((await lancer('annuler_reservation', { id: ID_A, jeton: '0'.repeat(32) })).code).toBe('JETON_INVALIDE')
    expect((await lancer('annuler_reservation', { id: ID_B, jeton })).code).toBe('JETON_INVALIDE')
    expect(appels.some((a) => a.methode === 'POST')).toBe(false)
    const ok = await lancer('annuler_reservation', { id: ID_A, jeton: (await lancer('annuler_reservation', { id: ID_A })).donnees.jeton })
    expect(ok.ok).toBe(true)
    expect(ok.donnees.annulee).toBe(true)
    expect(ok.donnees.reservation.statut).toBe('annulee')
    expect(appels.filter((a) => a.methode === 'POST')).toHaveLength(1)
  })
  it('id inconnu -> INTROUVABLE dès le 1er temps', async () => {
    expect((await lancer('annuler_reservation', { id: ID_B })).code).toBe('INTROUVABLE')
  })
})

describe('deplacer_reservation', () => {
  it('envoie l\'horaire de Paris à l\'API et signale le client prévenu', async () => {
    reponses[`POST reservations/${ID_A}/deplacer`] = json(200, { ok: true, reservation: resa(ID_A, '2026-11-06T14:00:00+01:00', 'Jeanne'), agenda_a_jour: true })
    const r = await lancer('deplacer_reservation', { id: ID_A, debut: '2026-11-06T14:00' })
    expect(r.ok).toBe(true)
    expect(appels[0].corps).toEqual({ debut: '2026-11-06T14:00:00+01:00' })
    expect(r.donnees).toMatchObject({ deplacee: true, client_prevenu: true })
  })
  it('agenda non mis à jour -> avertissement ; conflit -> CONFLIT ; date seule refusée', async () => {
    reponses[`POST reservations/${ID_A}/deplacer`] = json(200, { ok: true, reservation: resa(ID_A, '2026-11-06T14:00:00+01:00', 'Jeanne'), agenda_a_jour: false })
    expect((await lancer('deplacer_reservation', { id: ID_A, debut: '2026-11-06T14:00' })).donnees.avertissement).toContain('agenda')
    reponses[`POST reservations/${ID_B}/deplacer`] = json(409, { erreur: 'creneau_pris' })
    const c = await lancer('deplacer_reservation', { id: ID_B, debut: '2026-11-06T14:00' })
    expect([c.ok, c.code]).toEqual([false, 'CONFLIT'])
    expect((await lancer('deplacer_reservation', { id: ID_A, debut: '2026-11-06' })).code).toBe('VALIDATION')
  })
})

describe('blocages', () => {
  it('bloquer -> lister -> débloquer', async () => {
    const bl = { id: '0b1c0000-0000-4000-8000-000000000009', debut: '2026-11-07T00:00:00+01:00', fin: '2026-11-08T00:00:00+01:00', motif: 'Congé' }
    reponses['POST blocages'] = json(201, { ok: true, blocage: bl })
    reponses['GET blocages'] = json(200, { blocages: [bl] })
    reponses[`DELETE blocages/${bl.id}`] = json(200, { ok: true })
    const c = await lancer('bloquer_creneau', { debut: '2026-11-07', fin: '2026-11-07', motif: 'Congé' })
    expect(c.donnees.id).toBe(bl.id)
    expect(appels[0].corps).toEqual({ debut: '2026-11-07', fin: '2026-11-07', motif: 'Congé' })
    await lancer('bloquer_creneau', { debut: '2026-11-07T14:00', fin: '2026-11-07T16:00' })
    expect(appels[1].corps).toEqual({ debut: '2026-11-07T14:00:00+01:00', fin: '2026-11-07T16:00:00+01:00' })
    expect((await lancer('lister_blocages', {})).donnees.blocages).toEqual([bl])
    expect((await lancer('debloquer_creneau', { id: bl.id })).donnees.debloque).toBe(true)
    expect((await lancer('debloquer_creneau', { id: 'inconnu' })).code).toBe('INTROUVABLE')
  })
  it('API : fin invalide -> VALIDATION avec les champs', async () => {
    reponses['POST blocages'] = json(400, { erreur: 'invalide', champs: ['fin'] })
    const r = await lancer('bloquer_creneau', { debut: '2026-11-07', fin: '2026-11-06' })
    expect(r.code).toBe('VALIDATION')
    expect(r.erreur).toContain('fin')
  })
})
