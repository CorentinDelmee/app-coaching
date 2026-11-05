// Outils du lot « suivi » : magasin SQLite sur fichier temporaire, mêmes règles que l'app.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { creerStoreSqlite, ouvrirBase } from '../../serveur/src/magasin-sqlite.js'
import { creerService } from '../../serveur/src/service.js'
import { outilsSuivi } from '../../serveur/src/outils/suivi.js'
import { appeler } from '../../serveur/src/outils.js'
import { VERSION_CONSENTEMENT } from '../../src/domain/consentement.js'

const NOW = new Date(2026, 10, 5, 12, 0).getTime() // 2026-11-05
const consent = (sante) => ({ son: true, consentement: { version: VERSION_CONSENTEMENT, sante } })
const client = (id, nom, sante = true) => ({ id, role: 'client', identifiant: id, nom, tarif: 40, lieuDefaut: 'salle', archive: false, creeLe: NOW - 30 * 86400000, consentementLe: '2026-10-01', preferences: consent(sante) })

let dossier, db, backend, outils, journal
const appel = (nom, args) => appeler({ outils, journal }, nom, args, 'test')

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'suivi-'))
  db = ouvrirBase(join(dossier, 'test.db'))
  backend = creerStoreSqlite(db)
  const service = creerService({ backend, biblio: {}, now: () => NOW })
  outils = outilsSuivi({ service, backend, now: () => NOW })
  journal = { ecrire() {} }
  await backend.ecrire('profils', client('a', 'Alice Martin'))
  await backend.ecrire('profils', client('b', 'Bob Durand'))
  await backend.ecrire('profils', client('c', 'Carole Privée', false))
})
afterEach(() => { db.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('suivi_client', () => {
  it('résume la période et ne mélange pas les clients', async () => {
    await backend.ecrire('mesures', { id: 'm1', clientId: 'a', date: '2026-11-01', poids: 70 })
    await backend.ecrire('mesures', { id: 'm2', clientId: 'a', date: '2026-11-04', poids: 69.2 })
    await backend.ecrire('mesures', { id: 'm3', clientId: 'b', date: '2026-11-04', poids: 90 })
    await backend.ecrire('mesures', { id: 'm4', clientId: 'a', date: '2026-08-01', poids: 80 }) // hors période
    await backend.ecrire('douleurs', { id: 'd1', clientId: 'a', zone: 'genou', intensite: 7, date: '2026-11-03' })
    await backend.ecrire('realisations', { id: 'r1', clientId: 'a', workoutId: 'w', date: '2026-11-02', semaine: '2026-11-02', valeurs: {}, dureeSec: 3600, volume: 5000 })
    await backend.ecrire('realisations', { id: 'r2', clientId: 'b', workoutId: 'w', date: '2026-11-02', semaine: '2026-11-02', valeurs: {}, dureeSec: 600, volume: 100 })
    const r = await appel('suivi_client', { client: 'Alice' })
    expect(r.ok).toBe(true)
    const d = r.donnees
    expect(d.periode).toEqual({ du: '2026-10-07', au: '2026-11-05' })
    expect(d.mesures.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(d.resume).toMatchObject({ seancesFaites: 1, volumeTotal: 5000, dureeTotaleMin: 60, douleurMax: 7, poids: { debut: 70, fin: 69.2, variation: -0.8 } })
    expect(JSON.stringify(d)).not.toContain('"b"')
  })
  it('ne renvoie aucune donnée de santé si le client a refusé', async () => {
    await backend.ecrire('mesures', { id: 'm1', clientId: 'c', date: '2026-11-01', poids: 60 })
    await backend.ecrire('douleurs', { id: 'd1', clientId: 'c', zone: 'dos', intensite: 9, date: '2026-11-03' })
    await backend.ecrire('realisations', { id: 'r1', clientId: 'c', workoutId: 'w', date: '2026-11-02', semaine: '2026-11-02', valeurs: {}, dureeSec: 60, volume: 10 })
    const d = (await appel('suivi_client', { client: 'Carole' })).donnees
    expect(d.sante.accessible).toBe(false)
    expect(d.mesures).toBeUndefined()
    expect(d.douleurs).toBeUndefined()
    expect(d.resume.poids).toBeUndefined()
    expect(d.seancesFaites).toHaveLength(1)
  })
  it('refuse une période inversée et un client inconnu', async () => {
    expect((await appel('suivi_client', { client: 'Alice', du: '2026-11-05', au: '2026-11-01' })).code).toBe('PERIODE_INVALIDE')
    expect((await appel('suivi_client', { client: 'Zorro' })).code).toBe('CLIENT_INTROUVABLE')
    expect((await appel('suivi_client', { client: 'Alice', du: 'hier' })).code).toBe('VALIDATION')
  })
})

describe('alertes', () => {
  it('liste les alertes de tous les clients ; santé refusée = seulement les commentaires ; alerte vue masquée', async () => {
    await backend.ecrire('douleurs', { id: 'd1', clientId: 'a', zone: 'genou', intensite: 8, date: '2026-11-04' })
    await backend.ecrire('douleurs', { id: 'd2', clientId: 'c', zone: 'dos', intensite: 9, date: '2026-11-04' })
    await backend.ecrire('realisations', { id: 'r1', clientId: 'c', workoutId: 'w', date: '2026-11-04', semaine: '2026-11-02', valeurs: {}, dureeSec: 1, volume: 1, commentaire: 'dur' })
    let r = (await appel('alertes', {})).donnees
    expect(r.alertes.some((a) => a.id === 'douleur:d1' && a.client === 'Alice Martin')).toBe(true)
    expect(r.alertes.some((a) => a.id === 'douleur:d2')).toBe(false)
    expect(r.alertes.filter((a) => a.clientId === 'c').map((a) => a.type)).toEqual(['commentaire'])
    await backend.ecrire('alertesVues', { id: 'douleur:d1', clientId: 'a', vueLe: NOW })
    r = (await appel('alertes', {})).donnees
    expect(r.alertes.some((a) => a.id === 'douleur:d1')).toBe(false)
  })
})

describe('mot du coach', () => {
  it('crée le mot pour le bon client', async () => {
    const r = (await appel('ecrire_mot_du_coach', { client: 'Bob', texte: '  Bravo !  ' })).donnees
    const m = await backend.un('motsDuCoach', r.id)
    expect(m).toMatchObject({ clientId: 'b', texte: 'Bravo !', date: '2026-11-05' })
    expect((await appel('ecrire_mot_du_coach', { client: 'Bob', texte: '' })).code).toBe('VALIDATION')
  })
})

describe('séances de coaching', () => {
  it('planifier -> modifier -> lecture, avec valeurs par défaut du client', async () => {
    const p = (await appel('planifier_seance_coaching', { client: 'Alice', date: '2026-11-10', heure: '18:30' })).donnees
    expect(await backend.un('seancesCoaching', p.id)).toMatchObject({ clientId: 'a', lieu: 'salle', tarif: 40, statut: 'prevue' })
    const m = (await appel('modifier_seance_coaching', { seanceId: p.id, heure: '19:00', statut: 'faite' })).donnees
    expect(m).toMatchObject({ heure: '19:00', statut: 'faite', date: '2026-11-10' })
    const d = (await appel('suivi_client', { client: 'Alice', au: '2026-11-30' })).donnees
    expect(d.resume.seancesCoachingFaites).toBe(1)
  })
  it('refuse heure invalide, doublon, modification vide, séance d\'un autre client', async () => {
    expect((await appel('planifier_seance_coaching', { client: 'Alice', date: '2026-11-10', heure: '25:00' })).code).toBe('VALIDATION')
    const p = (await appel('planifier_seance_coaching', { client: 'Alice', date: '2026-11-10', heure: '18:30' })).donnees
    expect((await appel('planifier_seance_coaching', { client: 'Alice', date: '2026-11-10', heure: '18:30' })).code).toBe('SEANCE_EXISTE')
    expect((await appel('modifier_seance_coaching', { seanceId: p.id })).code).toBe('VALIDATION')
    expect((await appel('modifier_seance_coaching', { seanceId: 'nope', date: '2026-11-11' })).code).toBe('SEANCE_INTROUVABLE')
    expect((await appel('modifier_seance_coaching', { seanceId: p.id, client: 'Bob', date: '2026-11-11' })).code).toBe('SEANCE_AUTRE_CLIENT')
    expect((await backend.un('seancesCoaching', p.id)).date).toBe('2026-11-10')
  })
  it('suppression en 2 temps : sans jeton rien n\'est supprimé, mauvais jeton refusé, jeton à usage unique', async () => {
    const p = (await appel('planifier_seance_coaching', { client: 'Alice', date: '2026-11-10', heure: '18:30' })).donnees
    const autre = (await appel('planifier_seance_coaching', { client: 'Alice', date: '2026-11-11', heure: '18:30' })).donnees
    const t1 = (await appel('supprimer_seance_coaching', { seanceId: p.id })).donnees
    expect(t1.confirmationRequise).toBe(true)
    expect(await backend.un('seancesCoaching', p.id)).not.toBeNull()
    const t2 = (await appel('supprimer_seance_coaching', { seanceId: autre.id })).donnees
    expect((await appel('supprimer_seance_coaching', { seanceId: p.id, jeton: t2.jeton })).code).toBe('JETON_INVALIDE') // jeton d'une autre séance
    expect((await appel('supprimer_seance_coaching', { seanceId: p.id, jeton: 'f'.repeat(32) })).code).toBe('JETON_INVALIDE')
    expect(await backend.un('seancesCoaching', p.id)).not.toBeNull()
    const t3 = (await appel('supprimer_seance_coaching', { seanceId: p.id })).donnees
    expect((await appel('supprimer_seance_coaching', { seanceId: p.id, jeton: t3.jeton })).donnees).toEqual({ supprimee: true, id: p.id })
    expect(await backend.un('seancesCoaching', p.id)).toBeNull()
    expect(await backend.un('seancesCoaching', autre.id)).not.toBeNull()
    expect((await appel('supprimer_seance_coaching', { seanceId: p.id, jeton: t3.jeton })).code).toBe('SEANCE_INTROUVABLE')
  })
})
