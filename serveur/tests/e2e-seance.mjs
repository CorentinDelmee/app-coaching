// Test de bout en bout : « Claude » reçoit une séance en texte, appelle le VRAI serveur MCP (client MCP SDK, transport stdio),
// puis on vérifie que la séance apparaît côté client (API REST, puis navigateur : captures dans tmp/captures-mcp/, ignoré par Git ; --captures-doc : dans docs/captures-mcp/).
//
// Lancer (depuis la racine du projet) :
//   node serveur/tests/e2e-seance.mjs              -> MCP + API (rapide, sans navigateur)
//   node serveur/tests/e2e-seance.mjs --navigateur -> + app sur le port 5406 et captures Chrome headless
// Ports par défaut : API 5405, app 5406, débogage Chrome 5407 ; modifiables par E2E_PORT_API, E2E_PORT_APP, E2E_PORT_CHROME.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const NAVIGATEUR = process.argv.includes('--navigateur')
// Par défaut les captures vont dans tmp/ (ignoré par Git) ; --captures-doc met à jour les PNG suivis de docs/
const CAPTURES_DOC = process.argv.includes('--captures-doc')
const DOSSIER_CAPTURES_REL = CAPTURES_DOC ? 'docs/captures-mcp' : 'tmp/captures-mcp'
const CLE = 'cle-e2e-0123456789abcdef'
const PORT_API = process.env.E2E_PORT_API || '5405'
const PORT_APP = process.env.E2E_PORT_APP || '5406'
const PORT_CHROME = process.env.E2E_PORT_CHROME || '5407'
const API = `http://127.0.0.1:${PORT_API}`
const APP = `http://127.0.0.1:${PORT_APP}`
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const donnees = mkdtempSync(join(tmpdir(), 'e2e-mcp-'))
const enfants = []
const verifs = []
const ok = (cond, msg) => { verifs.push([!!cond, msg]); console.log(`${cond ? 'OK  ' : 'ECHEC'} ${msg}`) }
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const env = { ...process.env, COACH_API_KEY: CLE, DATA_DIR: donnees, PORT_API, DEMO_SYNC: '1', CORS_ORIGINS: APP }

function lancer(args, options = {}) {
  const p = spawn(process.execPath, args, { cwd: RACINE, env, stdio: 'ignore', ...options })
  enfants.push(p)
  return p
}
async function attendreUrl(url, essais = 60) {
  for (let i = 0; i < essais; i++) { try { if ((await fetch(url)).status < 500) return } catch { /* pas encore prêt */ } await attendre(250) }
  throw new Error(`Injoignable : ${url}`)
}
const rest = (chemin, opts = {}) => fetch(API + chemin, { ...opts, headers: { Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' } })

// Le « message de Corentin » que Claude doit traduire en appels d'outils.
const MESSAGE = `Voici la séance de Fabien pour jeudi :
- Squat 4x8 à 60 kg, repos 2 min, tempo 3-1-1
- Développé couché 4x8 à 50 kg, repos 2 min
- Rowing haltère un bras 3x10 à 20 kg
- Planche 3 x 30 secondes
- Finisher AMRAP 8 minutes : 5 burpees, 10 squats sautés`

function prochainJeudi() {
  const d = new Date()
  const delta = (4 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function principal() {
  console.log(MESSAGE, '\n')
  lancer(['serveur/api.mjs'])
  await attendreUrl(`${API}/api/sante`)

  // --- « Claude » parle MCP (stdio), comme dans Claude Code / Desktop ---
  const transport = new StdioClientTransport({ command: process.execPath, args: ['serveur/mcp.mjs'], cwd: RACINE, env })
  const client = new Client({ name: 'e2e', version: '1.0.0' })
  await client.connect(transport)
  const appel = async (nom, args) => {
    const r = await client.callTool({ name: nom, arguments: args })
    return { erreur: !!r.isError, ...(JSON.parse(r.content[0].text)) }
  }
  const { tools } = await client.listTools()
  ok(['lister_clients', 'chercher_client', 'creer_seance', 'modifier_seance', 'supprimer_seance', 'ajouter_exercice', 'rattacher_video', 'chercher_video_exercice', 'consulter_agenda', 'lister_seances'].every((n) => tools.some((t) => t.name === n)), `10 outils MCP exposés (${tools.length})`)

  const c = await appel('chercher_client', { nom: 'FABIEN vincent' })
  ok(c.resultats?.length === 1 && c.resultats[0].id === 'client-fabien-vincent', 'chercher_client retrouve Fabien Vincent (casse tolérée)')

  const jeudi = prochainJeudi()
  const s = await appel('creer_seance', {
    client: c.resultats[0].id, nom: 'Séance de jeudi', date: jeudi, consignes: 'Échauffement 5 min avant de commencer.',
    blocs: [
      { exercice: { nom: 'Squat', series: 4, reps: 8, charge: 60, repos: 120, tempo: '3-1-1' } },
      { exercice: { nom: 'Développé couché', series: 4, reps: 8, charge: 50, repos: 120 } },
      { exercice: { nom: 'Rowing haltère un bras', series: 3, reps: 10, charge: 20, repos: 90 } },
      { exercice: { nom: 'Planche', series: 3, tempsTravail: 30, repos: 45 } },
      { circuit: { format: 'amrap', nom: 'Finisher', minutes: 8, exercices: [{ nom: 'Burpees', reps: 5 }, { nom: 'Squat sauté', reps: 10 }] } }
    ]
  })
  ok(!s.erreur && s.seance?.blocs.length === 5, 'creer_seance : séance créée avec 5 blocs')
  const sansVideoAvant = s.exercicesSansVideo ?? []
  const avecVideo = s.seance.blocs.filter((b) => b.type === 'exercice' && b.video).length
  console.log(`     vidéos rattachées automatiquement : ${avecVideo}/4 exercices ; sans vidéo : ${sansVideoAvant.join(', ') || 'aucun'}`)
  for (const nom of sansVideoAvant) {
    const r = await appel('chercher_video_exercice', { nom })
    console.log(`     chercher_video_exercice(${nom}) -> ${r.bibliotheque?.length ?? 0} résultat(s) en bibliothèque`)
  }
  ok(avecVideo >= 3, 'au moins 3 des 4 exercices ont une vidéo (bibliothèque importée)')
  const id = s.seance.id

  // Suppression : confirmation obligatoire
  const d1 = await appel('supprimer_seance', { seanceId: id })
  ok(d1.confirmationRequise && d1.jeton, 'supprimer_seance 1er appel : résumé + jeton, rien supprimé')
  ok((await (await rest('/api/seances?client=client-fabien-vincent')).json()).seances.some((x) => x.id === id), 'la séance existe toujours après le 1er appel')
  const ag = await appel('consulter_agenda', { client: 'Fabien Vincent', du: jeudi, au: jeudi })
  ok(ag.seancesProgrammees?.some((x) => x.seanceId === id), `consulter_agenda : la séance est programmée le ${jeudi}`)
  await client.close()

  // --- Côté client : visible via l'API ---
  const liste = await (await rest('/api/seances?client=client-fabien-vincent')).json()
  ok(liste.seances.some((x) => x.id === id && x.jourFixe === 3), 'API REST : la séance de Fabien est placée le jeudi')
  const etat = await (await fetch(`${API}/demo/etat`)).json()
  ok(etat.workouts.some((w) => w.id === id) && !('comptes' in etat), 'synchro démo : séance visible, aucun compte exposé')
  ok((await fetch(`${API}/api/clients`)).status === 401, 'sans clé : 401')

  if (NAVIGATEUR) await verifierNavigateur(id)
}

// --- Navigateur : Chrome headless piloté en CDP (WebSocket natif de Node) ---
async function verifierNavigateur(seanceId) {
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', PORT_APP, '--strictPort', '--host', '127.0.0.1'], { cwd: RACINE, env: { ...process.env, VITE_API_URL: API, VITE_API_KEY: CLE }, stdio: 'ignore' })
  enfants.push(vite)
  await attendreUrl(APP)
  const dossierCaptures = join(RACINE, ...DOSSIER_CAPTURES_REL.split('/'))
  mkdirSync(dossierCaptures, { recursive: true })
  const profil = mkdtempSync(join(tmpdir(), 'e2e-chrome-'))
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT_CHROME}`, `--user-data-dir=${profil}`, '--window-size=390,844', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
  enfants.push(chrome)
  await attendreUrl(`http://127.0.0.1:${PORT_CHROME}/json/version`)
  const cible = await (await fetch(`http://127.0.0.1:${PORT_CHROME}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(cible.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let n = 0
  const attentes = new Map()
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); attentes.get(d.id)?.(d); attentes.delete(d.id) })
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++n; attentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const evalue = async (expression) => (await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
  const aller = async (url, ms = 2500) => { await cdp('Page.navigate', { url }); await attendre(ms) }
  const capture = async (nom) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(dossierCaptures, nom), Buffer.from(r.result.data, 'base64')); console.log(`     capture : ${DOSSIER_CAPTURES_REL}/${nom}`) }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await cdp('Page.enable')

  // Session de Fabien (consentement donné), comme les autres scripts de tests/e2e.
  await aller(`${APP}/bienvenue`)
  await evalue(`localStorage.setItem('cdc-coaching/1:session','amorce')`)
  await aller(`${APP}/bienvenue`)
  await evalue(`(() => { const s = JSON.parse(localStorage.getItem('cdc-coaching/1')); const p = s.profils.find(x => x.identifiant === 'fabien.vincent');
    p.consentementLe = Date.now(); p.preferences = { ...p.preferences, consentement: { version: '2026-10-v1', sante: true } };
    localStorage.setItem('cdc-coaching/1', JSON.stringify(s)); localStorage.setItem('cdc-coaching/1:session', p.id) })()`)
  await aller(`${APP}/programme`, 3500)
  await capture('01-programme-client.png')
  const progTexte = await evalue('document.body.innerText')
  ok(/Séance de jeudi/i.test(progTexte), 'navigateur : « Séance de jeudi » visible dans le programme du client Fabien')
  await aller(`${APP}/workout/${seanceId}`, 3000)
  await capture('02-seance-client.png')
  const wTexte = await evalue('document.body.innerText')
  ok(/Squat/.test(wTexte) && /Planche/.test(wTexte) && /Finisher/i.test(wTexte), 'navigateur : la séance affiche exercices et circuit AMRAP')
  await evalue('document.querySelector(".defile")?.scrollTo(0, 600)')
  await attendre(400)
  await capture('03-seance-client-bas.png')
  // Écran coach : bibliothèque
  await evalue(`(() => { const s = JSON.parse(localStorage.getItem('cdc-coaching/1')); localStorage.setItem('cdc-coaching/1:session', s.profils.find(x => x.role === 'coach').id) })()`)
  await aller(`${APP}/coach/bibliotheque`, 3000)
  await capture('04-coach-bibliotheque.png')
  ws.close()
}

try {
  await principal()
} catch (e) {
  ok(false, `exception : ${e.message}`)
} finally {
  for (const p of enfants) { try { p.kill() } catch { /* déjà arrêté */ } }
  await attendre(500)
  try { rmSync(donnees, { recursive: true, force: true }) } catch { /* verrou Windows : sans importance */ }
  const echecs = verifs.filter(([v]) => !v).length
  console.log(`\n${verifs.length - echecs}/${verifs.length} vérifications OK`)
  process.exit(echecs ? 1 : 0)
}
