#!/usr/bin/env node
// Import MyPTHub (complément du 2026-11-09) : node serveur/scripts/plan-historique-mypthub.mjs <dossier v2> <etat-app.json> <plan.json> [--normalise <normalise.json>]
// Lit les fichiers c-<contactId>.json du dossier v2, l'état actuel de l'app et normalise.json (par défaut : dossier parent de v2),
// écrit plan.json = { exercices, workouts, realisations, templates, rapport } (objets complets, un PUT chacun).
// Données de santé : plan.json doit être HORS du dépôt. La console n'affiche que des compteurs (client-NN), jamais de nom.
import { readFileSync, readdirSync, writeFileSync, chmodSync, existsSync } from 'node:fs'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import { planifierHistorique } from '../src/import-mypthub/historique.js'
import { QUOTAS } from '../src/app-http.js'
import { RACINE_SERVEUR } from '../src/config.js'

const args = process.argv.slice(2)
const iN = args.indexOf('--normalise')
const fichierNormalise = iN >= 0 ? args[iN + 1] : null
const [dossier, fichierEtat, sortie] = args.filter((_, i) => iN < 0 || (i !== iN && i !== iN + 1))
if (!dossier || !fichierEtat || !sortie) { console.error('Usage : node serveur/scripts/plan-historique-mypthub.mjs <dossier v2> <etat-app.json> <plan.json> [--normalise <normalise.json>]'); process.exit(2) }
const depot = resolve(RACINE_SERVEUR, '..')
const dansDepot = (f) => { const r = relative(depot, resolve(f)); return !r.startsWith('..') && !isAbsolute(r) }
if (dansDepot(sortie)) { console.error('Refusé : le plan contient des données de santé, il doit être écrit HORS du dépôt.'); process.exit(2) }

const lire = (f) => JSON.parse(readFileSync(f, 'utf8'))
const dossiers = readdirSync(dossier).filter((f) => /^c-\d+\.json$/.test(f)).map((f) => lire(join(dossier, f)))
const cheminNormalise = fichierNormalise || join(dirname(resolve(dossier)), 'normalise.json')
const normalise = existsSync(cheminNormalise) ? lire(cheminNormalise) : null
if (!normalise) console.warn('normalise.json introuvable : aucune séance existante ne sera mise à jour (toutes signalées).')

const plan = planifierHistorique(dossiers, lire(fichierEtat), normalise, { octetsLigne: QUOTAS.octetsLigne })
const r = plan.rapport
if (r.erreurs.length) {
  console.error(`Plan refusé : ${r.erreurs.length} objet(s) invalide(s) :`)
  for (const e of r.erreurs.slice(0, 50)) console.error(`- ${e}`)
  process.exit(1)
}
writeFileSync(sortie, JSON.stringify(plan, null, 1), { mode: 0o600 })
try { chmodSync(sortie, 0o600) } catch { /* Windows */ }

// Console : compteurs seulement.
console.log(`Plan écrit : ${plan.exercices.length} exercice(s) (${r.exercicesCrees} créé(s), ${r.exercicesDecrits} description(s) complétée(s)), ${plan.workouts.length} séance(s), ${plan.realisations.length} réalisation(s), ${plan.templates.length} template(s).`)
for (const c of r.clients) {
  if (c.action !== 'traité') { console.log(`${c.client} : ${c.action}`); continue }
  console.log(`${c.client} : séances créées ${c.seancesCreees}, mises à jour ${c.seancesMisesAJour}, retouchées non écrasées ${c.seancesRetouchees.length} ; réalisations ${c.realisations} (+${c.realisationsDejaLa} déjà là), versions ${c.versions}, sessions ignorées ${c.sessionsIgnorees}`)
}
console.log('Colonnes ignorées (valeurs faites non reprises) :', JSON.stringify(r.colonnesIgnorees))
