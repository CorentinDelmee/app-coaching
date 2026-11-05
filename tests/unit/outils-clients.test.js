// Outils coach « clients » (lot 2) : magasin SQLite réel, comptes hachés, archivage en 2 temps, consentement santé.
import { beforeEach, describe, expect, it } from 'vitest'
import { creerOutils, appeler } from '../../serveur/src/outils.js'
import { creerService } from '../../serveur/src/service.js'
import { creerStoreSqlite, ouvrirBase } from '../../serveur/src/magasin-sqlite.js'
import { verifierCode } from '../../serveur/src/app-http.js'
import { VERSION_CONSENTEMENT } from '../../src/domain/consentement.js'

const NOW = Date.UTC(2026, 10, 5, 10)
let backend, db, outils
const journal = { ecrire() {} }
const lancer = (nom, args) => appeler({ outils, journal }, nom, args, 'test')

beforeEach(() => {
  db = ouvrirBase(':memory:')
  backend = creerStoreSqlite(db)
  const service = creerService({ backend, biblio: {}, now: () => NOW })
  outils = creerOutils(service, { service, backend, biblio: {}, config: {}, now: () => NOW })
})

describe('creer_client', () => {
  it('crée profil + compte, code haché, renvoyé une seule fois', async () => {
    const r = await lancer('creer_client', { nom: 'Élodie Martin', tarif: 40 })
    expect(r.ok).toBe(true)
    const { id, identifiant, code } = r.donnees
    expect(identifiant).toBe('elodie.martin')
    expect(code).toMatch(/^[A-Z2-9]{8}$/)
    const compte = db.prepare('SELECT * FROM comptes WHERE identifiant = ?').get(identifiant)
    expect(compte.hash).not.toContain(code)
    expect(await verifierCode(code, compte.hash)).toBe(true)
    expect(compte.role).toBe('client')
    const profil = await backend.un('profils', id)
    expect(profil).toMatchObject({ role: 'client', tarif: 40, lieuDefaut: 'domicile', archive: false, consentementLe: null })
    // Le code n'apparaît nulle part ailleurs (ni dans la fiche).
    const fiche = await lancer('fiche_client', { client: id })
    expect(JSON.stringify(fiche)).not.toContain(code)
  })
  it('identifiant unique pour des homonymes, et AMBIGU sur le nom seul', async () => {
    const a = (await lancer('creer_client', { nom: 'Paul Durand' })).donnees
    const b = (await lancer('creer_client', { nom: 'Paul Durand' })).donnees
    expect(b.identifiant).toBe('paul.durand-2')
    const r = await lancer('fiche_client', { client: 'Paul Durand' })
    expect(r.code).toBe('AMBIGU')
    expect(r.erreur).toContain(a.id)
    expect((await lancer('fiche_client', { client: b.identifiant })).ok).toBe(true)
  })
  it('refuse les entrées invalides', async () => {
    expect((await lancer('creer_client', { nom: 'A' })).code).toBe('VALIDATION')
    expect((await lancer('creer_client', { nom: 'Jean Dupont', tarif: -3 })).code).toBe('VALIDATION')
    expect((await lancer('creer_client', { nom: 'Jean Dupont', role: 'coach' })).code).toBe('VALIDATION')
    expect((await lancer('creer_client', { nom: '!!! ???' })).ok).toBe(false)
    expect(db.prepare('SELECT COUNT(*) n FROM comptes').get().n).toBe(0)
  })
})

describe('modifier_client / fiche_client', () => {
  it('modifie nom, tarif, modules sans toucher identifiant ni rôle', async () => {
    const { id, identifiant } = (await lancer('creer_client', { nom: 'Lou Petit' })).donnees
    const r = await lancer('modifier_client', { client: 'lou', tarif: 55, lieuDefaut: 'salle', modules: { calories: true } })
    expect(r.ok).toBe(true)
    const p = await backend.un('profils', id)
    expect(p).toMatchObject({ identifiant, role: 'client', tarif: 55, lieuDefaut: 'salle' })
    expect(p.modules).toEqual({ habitudes: false, photosRepas: false, calories: true })
    expect((await lancer('modifier_client', { client: id })).code).toBe('VALIDATION')
    expect((await lancer('modifier_client', { client: id, identifiant: 'x.y' })).code).toBe('VALIDATION')
  })
  it('fiche : sans consentement santé, pas de mesures ni de douleurs ; avec, oui — et jamais celles d\'un autre', async () => {
    const a = (await lancer('creer_client', { nom: 'Anna Un' })).donnees
    const b = (await lancer('creer_client', { nom: 'Ben Deux' })).donnees
    await backend.ecrire('mesures', { id: 'm1', clientId: a.id, date: '2026-11-01', poids: 60 })
    await backend.ecrire('mesures', { id: 'm2', clientId: b.id, date: '2026-11-02', poids: 90 })
    await backend.ecrire('douleurs', { id: 'd1', clientId: a.id, zone: 'dos', intensite: 9, date: '2026-11-04' })
    let f = (await lancer('fiche_client', { client: a.id })).donnees
    expect(f.consentement).toEqual({ repondu: false, sante: false })
    expect(typeof f.dernieresMesures).toBe('string')
    expect(f.alertes.some((x) => x.type === 'douleur' || x.type === 'checkin')).toBe(false)

    const p = await backend.un('profils', a.id)
    await backend.ecrire('profils', { ...p, consentementLe: NOW, preferences: { ...p.preferences, consentement: { version: VERSION_CONSENTEMENT, sante: true } } })
    f = (await lancer('fiche_client', { client: a.id })).donnees
    expect(f.consentement).toEqual({ repondu: true, sante: true })
    expect(f.dernieresMesures).toEqual([{ date: '2026-11-01', poids: 60, mensurations: undefined }])
    expect(f.alertes.some((x) => x.type === 'douleur')).toBe(true)
    expect(JSON.stringify(f)).not.toContain('"poids":90')
  })
  it('fiche : programme actif et prochaines séances', async () => {
    const { id } = (await lancer('creer_client', { nom: 'Zoé Plan' })).donnees
    await backend.ecrire('workouts', { id: 'w1', clientId: id, nom: 'Haut du corps', blocs: [] })
    await backend.ecrire('programmes', { id: 'p1', clientId: id, nom: 'Force', mode: 'parSemaine', debut: '2026-11-02', semaines: [['w1']], joursFixes: { w1: 4 } })
    const f = (await lancer('fiche_client', { client: id })).donnees
    expect(f.programmeActif).toMatchObject({ nom: 'Force', semaineCourante: 1 })
    expect(f.prochainesSeances.programmees).toEqual([{ date: '2026-11-06', seanceId: 'w1', nom: 'Haut du corps', fait: false }])
  })
})

describe('archiver / réactiver / nouveau code', () => {
  it('archivage en 2 temps : sans jeton rien ne change, mauvais jeton refusé, bon jeton bloque la connexion mais garde les données', async () => {
    const { id, identifiant } = (await lancer('creer_client', { nom: 'Max Sortant' })).donnees
    await backend.ecrire('mesures', { id: 'm1', clientId: id, date: '2026-11-01', poids: 70 })
    const t1 = (await lancer('archiver_client', { client: id })).donnees
    expect(t1.confirmationRequise).toBe(true)
    expect((await backend.un('profils', id)).archive).toBe(false)
    expect(db.prepare('SELECT archive FROM comptes WHERE identifiant = ?').get(identifiant).archive).toBe(0)
    expect((await lancer('archiver_client', { client: id, jeton: 'f'.repeat(32) })).code).toBe('JETON_INVALIDE')
    expect((await backend.un('profils', id)).archive).toBe(false)
    const svAvant = db.prepare('SELECT sv FROM comptes WHERE identifiant = ?').get(identifiant).sv
    const ok = await lancer('archiver_client', { client: id, jeton: t1.jeton })
    expect(ok.ok).toBe(true)
    expect((await backend.un('profils', id)).archive).toBe(true)
    const c = db.prepare('SELECT * FROM comptes WHERE identifiant = ?').get(identifiant)
    expect(c.archive).toBe(1)
    expect(c.sv).toBe(svAvant + 1)
    expect(await backend.un('mesures', 'm1')).not.toBeNull()
    // Le jeton ne sert qu'une fois.
    expect((await lancer('archiver_client', { client: id, jeton: t1.jeton })).ok).toBe(false)
    // Plus dans la liste, mais toujours consultable.
    expect((await lancer('lister_clients', {})).donnees.clients).toHaveLength(0)
    expect((await lancer('fiche_client', { client: id })).donnees.profil.archive).toBe(true)
  })
  it('un jeton d\'un client ne sert pas pour un autre', async () => {
    const a = (await lancer('creer_client', { nom: 'Ana Un' })).donnees
    const b = (await lancer('creer_client', { nom: 'Bob Deux' })).donnees
    const t = (await lancer('archiver_client', { client: a.id })).donnees
    expect((await lancer('archiver_client', { client: b.id, jeton: t.jeton })).code).toBe('JETON_INVALIDE')
    expect((await backend.un('profils', b.id)).archive).toBe(false)
  })
  it('réactiver remet le compte en service ; refuse un client non archivé', async () => {
    const { id, identifiant } = (await lancer('creer_client', { nom: 'Eva Retour' })).donnees
    expect((await lancer('reactiver_client', { client: id })).code).toBe('CLIENT_INTROUVABLE')
    const t = (await lancer('archiver_client', { client: id })).donnees
    await lancer('archiver_client', { client: id, jeton: t.jeton })
    expect((await lancer('nouveau_code_client', { client: id })).code).toBe('CLIENT_INTROUVABLE')
    expect((await lancer('reactiver_client', { client: 'eva' })).ok).toBe(true)
    expect((await backend.un('profils', id)).archive).toBe(false)
    expect(db.prepare('SELECT archive FROM comptes WHERE identifiant = ?').get(identifiant).archive).toBe(0)
  })
  it('nouveau code : ancien révoqué, nouveau haché et renvoyé une fois', async () => {
    const { id, identifiant, code } = (await lancer('creer_client', { nom: 'Noa Code' })).donnees
    const avant = db.prepare('SELECT * FROM comptes WHERE identifiant = ?').get(identifiant)
    const r = (await lancer('nouveau_code_client', { client: id })).donnees
    const apres = db.prepare('SELECT * FROM comptes WHERE identifiant = ?').get(identifiant)
    expect(r.code).not.toBe(code)
    expect(await verifierCode(r.code, apres.hash)).toBe(true)
    expect(await verifierCode(code, apres.hash)).toBe(false)
    expect(apres.sv).toBe(avant.sv + 1)
  })
  it('ne touche jamais au compte coach', async () => {
    await backend.ecrire('profils', { id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Coach', archive: false, creeLe: 1 })
    for (const o of ['fiche_client', 'archiver_client', 'nouveau_code_client', 'modifier_client']) {
      expect((await lancer(o, o === 'modifier_client' ? { client: 'coach', tarif: 1 } : { client: 'coach' })).code).toBe('CLIENT_INTROUVABLE')
    }
  })
})
