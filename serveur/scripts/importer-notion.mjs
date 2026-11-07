#!/usr/bin/env node
// Import du récap Notion (CLIENTS PRO + séances Google Agenda) dans les fiches des clients EXISTANTS.
//   node serveur/scripts/importer-notion.mjs <recap.md> --apercu                       (sans base : ce qui est lu)
//   DB_FILE=/var/lib/app-coaching/app.db node serveur/scripts/importer-notion.mjs <recap.md> --essai
//   DB_FILE=/var/lib/app-coaching/app.db node serveur/scripts/importer-notion.mjs <recap.md>
// Options : --creer (crée les clients absents ; hors --essai, --codes <fichier-prive> HORS du dépôt, jamais écrasé)
//           --aligner-archivage (Notion « Actif » -> actif, tout autre statut -> archivé)
//           --archivage-inchange "Nom App 1,Nom App 2" (exceptions : état d'archivage gardé tel quel).
// --essai : transaction annulée, compte rendu de ce qui SERAIT fait. Sinon : sauvegarde (VACUUM INTO) puis import.
import { DatabaseSync } from 'node:sqlite'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { normaliser, blocNotes } from '../src/import-notion/normaliser.js'

const args = process.argv.slice(2)
const essai = args.includes('--essai')
const apercu = args.includes('--apercu')
const creer = args.includes('--creer')
const alignerArchivage = args.includes('--aligner-archivage')
const iGarde = args.indexOf('--archivage-inchange')
const archivageInchange = iGarde >= 0 ? String(args[iGarde + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : []
const iCodes = args.indexOf('--codes')
const fichierCodes = iCodes >= 0 ? args[iCodes + 1] : null
const entree = args.find((a, i) => !a.startsWith('--') && (iCodes < 0 || i !== iCodes + 1) && (iGarde < 0 || i !== iGarde + 1))
const stop = (m) => { console.error(m); process.exit(2) }
if (!entree || !existsSync(entree)) stop('Usage : [DB_FILE=…] node serveur/scripts/importer-notion.mjs <recap.md> (--apercu | --essai | rien = import réel)')
const normalise = normaliser(readFileSync(entree, 'utf8'))

if (apercu) {
  console.log(`Export du ${normalise.exporteLe} : ${normalise.clients.length} fiches`)
  for (const c of normalise.clients) console.log(`- ${c.titre} -> noms ${JSON.stringify(c.noms)} · ${c.proprietes.statut} · lieu ${c.lieuDefaut ?? '—'} · séances ${c.seances.total}/${c.seances.dates.length} · contenu ${c.contenu.length} car.${Object.keys(c.contact).length ? ' · contact ' + Object.keys(c.contact).join(',') : ''}`)
  if (args.includes('--bloc')) console.log('\n' + blocNotes(normalise.clients[Number(args[args.indexOf('--bloc') + 1]) || 0], normalise.exporteLe))
  process.exit(0)
}

const { creerStoreSqlite, ouvrirBase, VERSION_SCHEMA } = await import('../src/magasin-sqlite.js')
const { importer } = await import('../src/import-notion/importer.js')
const dbFile = process.env.DB_FILE
if (!dbFile || !existsSync(dbFile)) stop('DB_FILE doit désigner la base existante de l\'app.')
const verif = new DatabaseSync(dbFile)
const version = verif.prepare('PRAGMA user_version').get().user_version
verif.close()
if (version < VERSION_SCHEMA) stop(`Base au schéma ${version}, ${VERSION_SCHEMA} attendu : déploie d'abord cette version et redémarre le service.`)

const { RACINE_SERVEUR } = await import('../src/config.js')
if (creer && !essai) {
  if (!fichierCodes) stop('--codes <fichier-prive> est obligatoire avec --creer hors --essai (codes d\'accès des nouveaux clients).')
  const r = relative(resolve(RACINE_SERVEUR, '..'), resolve(fichierCodes))
  if (!r.startsWith('..') && !isAbsolute(r)) stop('Refusé : le fichier de codes doit être HORS du dépôt.')
  if (existsSync(fichierCodes)) stop('Le fichier de codes existe déjà : choisis un autre nom (il n\'est jamais écrasé).')
}
const ecrireCodes = (codes) => {
  if (!codes.length) return
  writeFileSync(fichierCodes, ['nom;identifiant;code;archive', ...codes.map((c) => `${c.nom};${c.identifiant};${c.code};${c.archive ? 'oui' : 'non'}`)].join('\n') + '\n', { mode: 0o600, flag: 'wx' })
  try { chmodSync(fichierCodes, 0o600) } catch { /* */ }
}
const db = ouvrirBase(dbFile)
let sauvegarde = null
if (!essai) {
  sauvegarde = `${dbFile}.avant-import-notion-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
  db.prepare('VACUUM INTO ?').run(sauvegarde)
  try { chmodSync(sauvegarde, 0o600) } catch { /* */ }
}
const bilan = await importer({ db, backend: creerStoreSqlite(db) }, normalise, { essai, creer, alignerArchivage, archivageInchange, avantValidation: ecrireCodes })
db.close()

console.log(essai ? 'ESSAI : rien n\'a été écrit (transaction annulée).' : `Import terminé. Sauvegarde avant import : ${sauvegarde}`)
console.log(`\nClients de l'app reliés à une fiche Notion : ${bilan.lignes.length}`)
for (const l of bilan.lignes) console.log(`  ${l.app}  <-  ${l.notion} [${l.par}] · Notion : ${l.statut || '—'}${l.archivage ? ' · ' + l.archivage : l.archive ? ' · archivé' : ' · actif'} · ${l.action}${l.contactAjoute.length ? ' · + ' + l.contactAjoute.join(', ') : ''}`)
if (creer && !essai && bilan.nouveauxComptes) console.log(`\nCodes d'accès de ${bilan.nouveauxComptes} nouveau(x) compte(s) écrits dans ${fichierCodes} (chmod 600) : à transmettre puis supprimer.`)
console.log(`\nFiches Notion sans client dans l'app (rien créé) : ${bilan.nonTrouves.length}`)
for (const n of bilan.nonTrouves) console.log(`  ${n}`)
if (bilan.ambigus.length) { console.log(`\nAmbigus, NON appliqués : ${bilan.ambigus.length}`); for (const a of bilan.ambigus) console.log(`  ${a}`) }
