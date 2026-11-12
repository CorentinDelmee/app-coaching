// Magasin SQLite : migration, aller-retour des objets, profils en colonnes, pas de cascade à la mise à jour.
import { describe, expect, it } from 'vitest'
import { creerStoreSqlite, ouvrirBase, VERSION_SCHEMA } from '../src/magasin-sqlite.js'

const profil = { id: 'p1', role: 'client', identifiant: 'fabien', nom: 'Fabien', tarif: 35, lieuDefaut: 'domicile', modules: { calories: false }, archive: false, creeLe: 1 }

describe('magasin SQLite', () => {
  it('migre une seule fois (user_version)', () => {
    const db = ouvrirBase(':memory:')
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(VERSION_SCHEMA)
    expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type = 'table'").get().n).toBe(18) // + agenda_alias (migration 4)
  })
  it('écrit et relit profils et entités ; mise à jour sans cascade', async () => {
    const s = creerStoreSqlite(ouvrirBase(':memory:'))
    await s.ecrire('profils', profil)
    expect(await s.un('profils', 'p1')).toMatchObject({ identifiant: 'fabien', modules: { calories: false }, archive: false })
    await s.ecrire('mesures', { id: 'm1', clientId: 'p1', poids: 80 })
    await s.ecrire('profils', { ...profil, nom: 'Fabien V' })
    expect(await s.tout('mesures')).toEqual([{ id: 'm1', clientId: 'p1', poids: 80 }])
    await s.supprimer('profils', 'p1')
    expect(await s.tout('mesures')).toEqual([]) // RGPD : effacer un client efface ses lignes
  })
  it('refuse une entité inconnue et un client inexistant', async () => {
    const s = creerStoreSqlite(ouvrirBase(':memory:'))
    await expect(s.tout('comptes')).rejects.toThrow()
    await expect(s.ecrire('mesures', { id: 'x', clientId: 'absent' })).rejects.toThrow()
  })
})
