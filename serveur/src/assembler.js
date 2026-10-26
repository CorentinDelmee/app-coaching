// Assemble le serveur à partir de la configuration : magasin, bibliothèque, journal, service, outils.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { creerBibliotheque } from './bibliotheque.js'
import { creerJournal } from './journal.js'
import { creerOutils } from './outils.js'
import { creerService } from './service.js'
import { creerStoreFichier, creerStoreSupabase } from './store.js'
import { RACINE_SERVEUR } from './config.js'

export async function assembler(config, { now = () => Date.now(), fetchFn } = {}) {
  const dossier = config.dossierDonnees
  const backend = config.supabaseUrl && config.supabaseCleService
    ? await creerStoreSupabase({ url: config.supabaseUrl, cleService: config.supabaseCleService })
    : creerStoreFichier(join(dossier, 'etat.json'), now)
  const biblio = creerBibliotheque(join(dossier, 'bibliotheque.json'), { now })
  // Premier lancement : importe la sélection de vidéos préparée (serveur/donnees/bibliotheque-videos.json) si elle existe.
  const importDepart = join(RACINE_SERVEUR, 'donnees', 'bibliotheque-videos.json')
  if (!existsSync(join(dossier, 'bibliotheque.json')) && existsSync(importDepart)) biblio.importer(JSON.parse(readFileSync(importDepart, 'utf8')))
  const journal = creerJournal(join(dossier, 'journal.jsonl'), now)
  const service = creerService({ backend, biblio, config, now, fetchFn })
  const outils = creerOutils(service)
  return { config, backend, biblio, journal, service, outils }
}
