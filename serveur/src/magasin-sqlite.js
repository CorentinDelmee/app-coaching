// Magasin SQLite (production, VPS) : même interface que creerStoreFichier (tout, un, ecrire, supprimer)
// pour que service.js et le MCP marchent sans changement. Schéma : serveur/schema.sql.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ENTITES, clientDe } from '../../src/data/entites.js'
import { RACINE_SERVEUR } from './config.js'

// 2 : fiche du profil (JSON réservé au coach : contact, notes, source d'import ; retirée des réponses aux clients, voir app-http.js).
const MIGRATIONS = [() => readFileSync(join(RACINE_SERVEUR, 'schema.sql'), 'utf8'), () => 'ALTER TABLE profiles ADD COLUMN fiche TEXT;']
export const VERSION_SCHEMA = MIGRATIONS.length

export function ouvrirBase(fichier) {
  if (fichier !== ':memory:') mkdirSync(dirname(fichier), { recursive: true })
  const db = new DatabaseSync(fichier)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  if (fichier !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  const version = db.prepare('PRAGMA user_version').get().user_version
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN')
    try { db.exec(MIGRATIONS[v]()); db.exec(`PRAGMA user_version = ${v + 1}`); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e }
  }
  return db
}

const json = (v) => (v === undefined || v === null ? null : JSON.stringify(v))
const lireJson = (v) => (v === null || v === undefined ? undefined : JSON.parse(v))

const profilDepuisLigne = (r) => ({
  id: r.id, role: r.role, identifiant: r.identifiant, nom: r.nom, tarif: r.tarif ?? undefined, lieuDefaut: r.lieu_defaut ?? undefined,
  modules: lireJson(r.modules), archive: !!r.archive, preferences: lireJson(r.preferences),
  consentementLe: r.consentement_le ?? null, creeLe: Number(r.cree_le), ...(r.fiche ? { fiche: lireJson(r.fiche) } : {})
})

export function creerStoreSqlite(db) {
  const table = (entite) => {
    if (!Object.hasOwn(ENTITES, entite)) throw new Error(`Entité inconnue : ${entite}`)
    return ENTITES[entite].table // nom issu de la liste blanche, jamais de l'entrée
  }
  const depuis = (entite, r) => (entite === 'profils' ? profilDepuisLigne(r) : JSON.parse(r.data))
  return {
    mode: 'sqlite',
    db,
    async tout(entite) { return db.prepare(`SELECT * FROM ${table(entite)}`).all().map((r) => depuis(entite, r)) },
    async un(entite, id) {
      const r = db.prepare(`SELECT * FROM ${table(entite)} WHERE id = ?`).get(String(id))
      return r ? depuis(entite, r) : null
    },
    // ON CONFLICT DO UPDATE (et non INSERT OR REPLACE, qui supprimerait la ligne et déclencherait les ON DELETE CASCADE).
    async ecrire(entite, o) {
      if (entite === 'profils') {
        db.prepare(`INSERT INTO profiles (id, role, identifiant, nom, tarif, lieu_defaut, modules, archive, preferences, consentement_le, cree_le, fiche)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET role = excluded.role, identifiant = excluded.identifiant,
          nom = excluded.nom, tarif = excluded.tarif, lieu_defaut = excluded.lieu_defaut, modules = excluded.modules, archive = excluded.archive,
          preferences = excluded.preferences, consentement_le = excluded.consentement_le, cree_le = excluded.cree_le, fiche = excluded.fiche`)
          .run(o.id, o.role, o.identifiant, o.nom, o.tarif ?? null, o.lieuDefaut ?? null, json(o.modules), o.archive ? 1 : 0, json(o.preferences), o.consentementLe ?? null, o.creeLe, json(o.fiche))
        return
      }
      db.prepare(`INSERT INTO ${table(entite)} (id, client_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET client_id = excluded.client_id, data = excluded.data`)
        .run(o.id, clientDe(entite, o) ?? null, JSON.stringify(o))
    },
    async supprimer(entite, id) { db.prepare(`DELETE FROM ${table(entite)} WHERE id = ?`).run(String(id)) }
  }
}
