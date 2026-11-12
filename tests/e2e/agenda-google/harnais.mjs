// Banc e2e « agenda Google » : base SQLite neuve + fausse API réservation (5473) + API réelle et app construite (5472, même origine).
// 1. VITE_BACKEND=api npx vite build --outDir <dist>   2. node tests/e2e/agenda-google/harnais.mjs <dossier du projet> <dist>
// 3. playwright-cli -s=ag open http://127.0.0.1:5472/ ; playwright-cli -s=ag resize 1366 690 ;
//    playwright-cli -s=ag run-code --filename=tests/e2e/agenda-google/parcours.js  (base neuve à chaque lancement du harnais ; puis 390 844)
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [WT, DIST] = process.argv.slice(2)
const imp = (p) => import(pathToFileURL(join(WT, p)).href)
const { assembler } = await imp('serveur/src/assembler.js')
const { lireConfig } = await imp('serveur/src/config.js')
const { creerServeurRest } = await imp('serveur/src/rest.js')
const { hacherCode } = await imp('serveur/src/app-http.js')
const { VERSION_CONSENTEMENT } = await imp('src/domain/consentement.js')

const ORIGINE = 'http://127.0.0.1:5472'
const dossier = mkdtempSync(join(tmpdir(), 'agenda-e2e-'))
const config = {
  ...lireConfig({}), port: 5471, dossierDonnees: dossier, dbFile: join(dossier, 'app.db'), fichiersDir: join(dossier, 'fichiers'),
  sessionSecret: 's'.repeat(40), appOrigin: ORIGINE, resaUrl: 'http://127.0.0.1:5473', resaCle: 'k'.repeat(40), cleApi: 'c'.repeat(40)
}
const app = await assembler(config)
const db = app.backend.db
const store = app.backend
const CLIENTS = [['christine', 'Christine Durand'], ['didier', 'Didier Durand'], ['sylvain', 'Sylvain Moreau'], ['guillaume', 'Guillaume Petit'],
  ['fabien', 'Fabien Vincent'], ['denis', 'Denis Leroy'], ['denism', 'Denis Martin'], ['caroline', 'Caroline Mion'], ['cindy', 'Cindy Roux']]
await store.ecrire('profils', { id: 'coach', role: 'coach', identifiant: 'coach', nom: 'Corentin', archive: false, creeLe: 1 })
for (const [id, nom] of CLIENTS) {
  await store.ecrire('profils', { id, role: 'client', identifiant: id, nom, tarif: 40, lieuDefaut: 'domicile', modules: { calories: false }, archive: false, creeLe: 1, consentementLe: 1, preferences: { consentement: { version: VERSION_CONSENTEMENT, sante: true } } })
}
const hash = await hacherCode('code-test-5471')
for (const [id, role] of [['coach', 'coach'], ['fabien', 'client'], ['christine', 'client']]) db.prepare('INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, ?, ?)').run(id, hash, role, id)
// Séance déjà saisie à la main par le coach au même créneau qu'un événement Google : ne doit pas être doublée.
await store.ecrire('seancesCoaching', { id: 'manuelle-fabien', clientId: 'fabien', date: '2026-11-19', heure: '18:30', lieu: 'domicile', statut: 'prevue', tarif: 40 })

const ev = (id, titre, debut, fin, lieu = '') => ({ id, titre, debut, fin, journee: false, lieu, annule: false, maj: '2026-10-01T00:00:00Z' })
const EVENEMENTS = [
  ev('e1', 'Coaching Christine et Didier', '2026-03-10T10:00:00+01:00', '2026-03-10T11:00:00+01:00'),
  ev('e2', 'Coaching Christine et Didier', '2026-10-20T10:00:00+02:00', '2026-10-20T11:00:00+02:00'),
  ev('e3', 'Coaching Didier Christine', '2026-11-17T10:00:00+01:00', '2026-11-17T11:00:00+01:00'),
  ev('e4', 'Coaching Guillaume', '2026-11-13T11:30:00+01:00', '2026-11-13T12:30:00+01:00', 'Danse & Fitness Rambouillet'),
  ev('e5', 'Coaching Fabien', '2026-11-05T18:30:00+01:00', '2026-11-05T19:30:00+01:00'),
  ev('e5b', 'Coaching Fabien', '2026-09-22T18:30:00+02:00', '2026-09-22T19:30:00+02:00'),
  ev('e6', 'Coaching Fabien', '2026-11-19T18:30:00+01:00', '2026-11-19T19:30:00+01:00'),
  ev('e6b', 'Coaching Fabien', '2026-11-26T18:30:00+01:00', '2026-11-26T19:30:00+01:00'),
  ev('e7', 'Coaching (Caroline  Mion)', '2026-11-14T09:00:00+01:00', '2026-11-14T10:00:00+01:00'),
  ev('e8', 'Coaching Ownsport Cindy', '2026-11-16T08:00:00+01:00', '2026-11-16T09:00:00+01:00', 'Ownsport'),
  ev('e9', 'Coaching Denis', '2026-11-03T17:00:00+01:00', '2026-11-03T18:00:00+01:00'),
  ev('e10', 'Coaching Denis', '2026-11-18T17:00:00+01:00', '2026-11-18T18:00:00+01:00'),
  ev('e11', 'Coaching Sylvain', '2026-11-18T09:00:00+01:00', '2026-11-18T10:00:00+01:00'),
  ev('e12', 'Dentiste', '2026-11-15T09:00:00+01:00', '2026-11-15T10:00:00+01:00')
]
let mode503 = false
const resa = createServer((req, res) => {
  if (req.headers['x-resa-admin-key'] !== config.resaCle) { res.writeHead(401); return res.end('{}') }
  if (req.url.startsWith('/api/resa/admin/evenements?')) {
    if (mode503) { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end('{"erreur":"google_lecture_non_autorisee"}') }
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ evenements: EVENEMENTS }))
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(req.url.startsWith('/api/resa/admin/reservations') ? '{"reservations":[]}' : '{"blocages":[]}')
})
resa.listen(5473, '127.0.0.1')

const rest = creerServeurRest(app)
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
createServer((req, res) => {
  const u = new URL(req.url, ORIGINE)
  if (u.pathname === '/__test/503') { mode503 = u.searchParams.get('v') === '1'; res.end('ok'); return }
  if (u.pathname.startsWith('/api/')) return rest.emit('request', req, res)
  let f = join(DIST, decodeURIComponent(u.pathname))
  if (!existsSync(f) || u.pathname === '/') f = join(DIST, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' })
  res.end(readFileSync(f))
}).listen(5472, '127.0.0.1', () => console.log(`prêt ${ORIGINE} pid ${process.pid}`))
