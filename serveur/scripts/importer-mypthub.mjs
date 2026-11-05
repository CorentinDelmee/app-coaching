#!/usr/bin/env node
// Import MyPTHub, étape 2 (sur le serveur, utilisateur appcoaching) :
//   DB_FILE=/var/lib/app-coaching/app.db node serveur/scripts/importer-mypthub.mjs <normalise.json> --essai
//   DB_FILE=/var/lib/app-coaching/app.db node serveur/scripts/importer-mypthub.mjs <normalise.json> --codes <fichier-prive>
// --essai : transaction annulée, compte rendu de ce qui SERAIT créé (rien n'est écrit, pas de fichier de codes).
// Sinon : copie de sauvegarde de la base (VACUUM INTO, à côté de DB_FILE), import, codes des nouveaux comptes dans
// <fichier-prive> (créé en chmod 600, refusé s'il existe déjà) : les codes ne sont JAMAIS affichés.
import { DatabaseSync } from 'node:sqlite'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { creerStoreSqlite, ouvrirBase, VERSION_SCHEMA } from '../src/magasin-sqlite.js'
import { importer } from '../src/import-mypthub/importer.js'
import { RACINE_SERVEUR } from '../src/config.js'

const args = process.argv.slice(2)
const essai = args.includes('--essai')
const iCodes = args.indexOf('--codes')
const fichierCodes = iCodes >= 0 ? args[iCodes + 1] : null
const entree = args.find((a, i) => !a.startsWith('--') && (iCodes < 0 || i !== iCodes + 1))
const stop = (m) => { console.error(m); process.exit(2) }
if (!entree) stop('Usage : DB_FILE=… node serveur/scripts/importer-mypthub.mjs <normalise.json> (--essai | --codes <fichier-prive>)')
const dbFile = process.env.DB_FILE
if (!dbFile || !existsSync(dbFile)) stop('DB_FILE doit désigner la base existante de l\'app.')
if (!essai) {
  if (!fichierCodes) stop('--codes <fichier-prive> est obligatoire hors --essai (codes d\'accès des nouveaux clients).')
  const r = relative(resolve(RACINE_SERVEUR, '..'), resolve(fichierCodes))
  if (!r.startsWith('..') && !isAbsolute(r)) stop('Refusé : le fichier de codes doit être HORS du dépôt.')
  if (existsSync(fichierCodes)) stop('Le fichier de codes existe déjà : choisis un autre nom (il n\'est jamais écrasé).')
}

// La base doit déjà être au schéma de ce code (déployé et service redémarré) : l'import ne migre rien lui-même,
// pour qu'un --essai n'écrive vraiment rien.
const verif = new DatabaseSync(dbFile)
const version = verif.prepare('PRAGMA user_version').get().user_version
verif.close()
if (version < VERSION_SCHEMA) stop(`Base au schéma ${version}, ${VERSION_SCHEMA} attendu : déploie d'abord cette version et redémarre le service.`)

const db = ouvrirBase(dbFile)
const normalise = JSON.parse(readFileSync(entree, 'utf8'))
let sauvegarde = null
if (!essai) {
  sauvegarde = `${dbFile}.avant-import-mypthub-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
  db.prepare('VACUUM INTO ?').run(sauvegarde)
  try { chmodSync(sauvegarde, 0o600) } catch { /* */ }
}

const ecrireCodes = (codes) => {
  writeFileSync(fichierCodes, ['nom;identifiant;code;archive', ...codes.map((c) => `${c.nom};${c.identifiant};${c.code};${c.archive ? 'oui' : 'non'}`)].join('\n') + '\n', { mode: 0o600, flag: 'wx' })
  try { chmodSync(fichierCodes, 0o600) } catch { /* */ }
}
const { nouveauxComptes, bilan } = await importer({ db, backend: creerStoreSqlite(db) }, normalise, { essai, avantValidation: ecrireCodes })
db.close()

console.log(essai ? 'ESSAI : rien n\'a été écrit (transaction annulée).' : `Import terminé. Sauvegarde avant import : ${sauvegarde}`)
const nb = (a) => bilan.clients.filter((c) => c.action === a).length
console.log(`Clients : ${nb('créé')} ${essai ? 'seraient créés' : 'créés'} · ${nb('complété')} ${essai ? 'seraient complétés' : 'complétés'} · ${bilan.ignores.length} ignorés · archivés : ${bilan.clients.filter((c) => c.archive).length}`)
for (const c of bilan.clients) console.log(`  ${c.client} : ${c.action}${c.archive ? ' [archivé]' : ''} · mesures +${c.mesures} (complétées ${c.mesuresCompletees}) · réponses +${c.reponses} · séances +${c.seances} · programmes +${c.programmes}`)
console.log(`Exercices ${essai ? 'qui seraient ajoutés' : 'ajoutés'} à la bibliothèque : ${bilan.exercicesCrees}`)
if (!essai) console.log(`Codes d'accès de ${nouveauxComptes} nouveau(x) compte(s) écrits dans ${fichierCodes} (chmod 600) : à transmettre puis supprimer.`)
