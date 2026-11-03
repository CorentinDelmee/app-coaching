// Créer (ou réinitialiser) le compte coach : npm run coach:creer <identifiant>  (saisie masquée, DB_FILE requis)
import { randomUUID } from 'node:crypto'
import { chargerEnv } from './src/config.js'
import { ouvrirBase, creerStoreSqlite } from './src/magasin-sqlite.js'
import { hacherCode } from './src/app-http.js'

chargerEnv()
const identifiant = String(process.argv[2] || '').toLowerCase().trim()
if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(identifiant) || !process.env.DB_FILE) {
  console.error('Usage : DB_FILE=/var/lib/app-coaching/app.db npm run coach:creer <identifiant>')
  process.exit(1)
}

// Lecture sans écho : mode « raw » du terminal, caractères non affichés.
function demander(libelle) {
  return new Promise((resolve) => {
    process.stdout.write(libelle)
    let buf = ''
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    const lu = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { process.stdin.setRawMode?.(false); process.stdin.pause(); process.stdin.off('data', lu); process.stdout.write('\n'); return resolve(buf) }
        if (c === '\u0003') process.exit(1)
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1)
        else buf += c
      }
    }
    process.stdin.on('data', lu)
  })
}

const a = await demander(`Code pour le coach ${identifiant} (12 caractères minimum) : `)
const b = await demander('Confirmer : ')
if (a !== b) { console.error('Les deux saisies sont différentes.'); process.exit(1) }
if (a.length < 12) { console.error('Trop court (12 caractères minimum).'); process.exit(1) }
const db = ouvrirBase(process.env.DB_FILE)
const hash = await hacherCode(a)
const existant = db.prepare('SELECT role FROM comptes WHERE identifiant = ?').get(identifiant)
if (existant) {
  if (existant.role !== 'coach') { console.error('Ce compte existe déjà et n\'est pas un compte coach.'); process.exit(1) }
  db.prepare('UPDATE comptes SET hash = ?, sv = sv + 1 WHERE identifiant = ?').run(hash, identifiant) // révoque les sessions
  console.log('Code du coach changé.')
} else {
  const id = randomUUID()
  await creerStoreSqlite(db).ecrire('profils', { id, role: 'coach', identifiant, nom: identifiant, archive: false, creeLe: Date.now() })
  db.prepare("INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, 'coach', ?)").run(identifiant, hash, id)
  console.log('Compte coach créé.')
}
