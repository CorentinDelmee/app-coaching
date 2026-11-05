#!/usr/bin/env node
// Import MyPTHub, étape 1 (sur le PC) : node serveur/scripts/normaliser-mypthub.mjs <export brut.json> <sortie.json>
// Écrit le JSON normalisé (données PRIVÉES, santé : hors du dépôt) et <sortie>.rapport.json (compteurs + noms de champs).
// N'affiche aucune donnée personnelle : seulement des comptes et des noms de champs.
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import { normaliser } from '../src/import-mypthub/normaliser.js'
import { RACINE_SERVEUR } from '../src/config.js'

// Options : --seances <fichier> (détail des séances { id: { workout } } ; par défaut seances.json à côté de l'export),
//           --exclure "Prénom Nom" (répétable ; par défaut le compte de test du coach « Corentin Delmee »).
const args = process.argv.slice(2)
const valeurs = (opt) => args.flatMap((a, i) => (a === opt && args[i + 1] ? [args[i + 1]] : []))
const options = new Set(args.flatMap((a, i) => (a.startsWith('--') ? [i, i + 1] : [])))
const [entree, sortie] = args.filter((_, i) => !options.has(i))
if (!entree || !sortie) { console.error('Usage : node serveur/scripts/normaliser-mypthub.mjs <export brut.json> <sortie.json> [--seances <seances.json>] [--exclure "Prénom Nom"]'); process.exit(2) }
const fichierSeances = valeurs('--seances')[0] || join(dirname(entree), 'seances.json')
const exclure = valeurs('--exclure').length ? valeurs('--exclure') : ['Corentin Delmee']
const depot = resolve(RACINE_SERVEUR, '..')
const dansDepot = (f) => { const r = relative(depot, resolve(f)); return !r.startsWith('..') && !isAbsolute(r) }
if (dansDepot(sortie)) { console.error('Refusé : la sortie contient des données de santé, elle doit être écrite HORS du dépôt.'); process.exit(2) }

const seances = existsSync(fichierSeances) ? JSON.parse(readFileSync(fichierSeances, 'utf8')) : {}
const n = normaliser(JSON.parse(readFileSync(entree, 'utf8')), { seances, exclure })
const ecrirePrive = (f, v) => { writeFileSync(f, JSON.stringify(v, null, 1), { mode: 0o600 }); try { chmodSync(f, 0o600) } catch { /* Windows */ } }
ecrirePrive(sortie, n)
ecrirePrive(`${sortie}.rapport.json`, n.rapport)

const r = n.rapport
const somme = (k) => r.clients.reduce((s, c) => s + (typeof c[k] === 'number' ? c[k] : 0), 0)
console.log(`Clients : ${r.clients.length} (archivés : ${r.clients.filter((c) => c.archive).length}) · exclus : ${r.exclus} · détail des séances : ${Object.keys(seances).length ? `${Object.keys(seances).length} lues` : 'ABSENT'} (sans détail : ${r.seancesSansDetail})`)
console.log(`Mesures ${somme('mesures')} · bilans ${somme('bilans')} · questions PAR-Q ${somme('parq')} · séances ${somme('seances')} (exercices ${somme('exercices')}) · programmes ${somme('programmes')} · photos comptées ${somme('photos')}`)
console.log('Par client :')
for (const c of r.clients) console.log(`  ${c.client}${c.archive ? ' [archivé]' : ''} : mesures ${c.mesures}, bilans ${c.bilans}, parq ${c.parq}, séances ${c.seances}, programmes ${c.programmes}, photos ${c.photos}${c.textesSecours.length ? `, textes de secours : ${c.textesSecours.join(', ')}` : ''}${c.manque.length ? `, MANQUE : ${c.manque.join(', ')}` : ''}`)
const champs = Object.entries(r.champsNonConvertis).sort((a, b) => b[1] - a[1])
console.log(`Champs non convertis (${champs.length}) :`)
for (const [k, v] of champs) console.log(`  ${k} × ${v}`)
const pay = Object.keys(r.paiementRetire)
console.log(`Champs de paiement retirés : ${pay.length ? pay.join(', ') : 'aucun'} · erreurs de l'export : ${r.erreursExport}`)
console.log(`Écrit : ${sortie} (+ .rapport.json)`)
