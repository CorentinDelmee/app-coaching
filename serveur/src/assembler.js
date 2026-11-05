// Assemble le serveur à partir de la configuration : magasin, bibliothèque, journal, service, outils.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { creerBibliotheque } from './bibliotheque.js'
import { creerJournal } from './journal.js'
import { creerOutils } from './outils.js'
import { creerService } from './service.js'
import { creerStoreFichier, creerStoreSupabase } from './store.js'
import { RACINE_SERVEUR } from './config.js'
import { creerStoreSqlite, ouvrirBase } from './magasin-sqlite.js'
import { creerAppHttp } from './app-http.js'

export async function assembler(config, { now = () => Date.now(), fetchFn } = {}) {
  const dossier = config.dossierDonnees
  // DB_FILE défini -> SQLite (production VPS) ; sinon fichier JSON (démo/tests).
  const backend = config.dbFile
    ? creerStoreSqlite(ouvrirBase(config.dbFile))
    : config.supabaseUrl && config.supabaseCleService
      ? await creerStoreSupabase({ url: config.supabaseUrl, cleService: config.supabaseCleService })
      : creerStoreFichier(join(dossier, 'etat.json'), now)
  const biblio = creerBibliotheque(join(dossier, 'bibliotheque.json'), { now })
  // Premier lancement : importe la sélection de vidéos préparée (serveur/donnees/bibliotheque-videos.json) si elle existe.
  const importDepart = join(RACINE_SERVEUR, 'donnees', 'bibliotheque-videos.json')
  if (!existsSync(join(dossier, 'bibliotheque.json')) && existsSync(importDepart)) biblio.importer(JSON.parse(readFileSync(importDepart, 'utf8')))
  const journal = creerJournal(join(dossier, 'journal.jsonl'), now)
  journal.purger(config.journalJours)
  const service = creerService({ backend, biblio, config, now, fetchFn })
  const outils = creerOutils(service, { service, backend, biblio, config, now, fetchFn })
  // API de l'app (/api/app/*) : seulement avec SQLite et un secret de session.
  const appHttp = backend.mode === 'sqlite' && config.sessionSecret ? creerAppHttp({ db: backend.db, store: backend, config, journal, now, fetchFn }) : null
  return { config, backend, biblio, journal, service, outils, appHttp }
}
