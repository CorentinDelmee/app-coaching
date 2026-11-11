// Importe un programme complet (argument de l'outil creer_programme) séance par séance, en passant par le même
// client que le serveur MCP distant (serveur/src/mcp-distant.js) : aucune réécriture de l'API.
// Pourquoi : un creer_programme / modifier_programme d'une semaine entière dépasse le délai du client MCP
// (création de 5 séances + recherche de vidéos côté serveur) et revient en « Serveur injoignable ».
//
// Usage (depuis Projets/app-coaching) :
//   node programmes/importer-programme.mjs programmes/ludo/programme.json --client ludo --essai
//   node programmes/importer-programme.mjs programmes/ludo/programme.json --client ludo
// Options : --client <identifiant> (sinon le champ « client » du fichier) ; --essai (n'écrit rien) ;
//           --programme <id> (reprendre un programme précis ; sinon celui du client qui porte le même nom).
// Reprise : relancer la même commande. Une séance déjà présente (même semaine + même nom) n'est jamais recréée.
// Config : COACH_API_URL + COACH_API_KEY_FILE (ou COACH_API_KEY) ; à défaut, ceux du serveur MCP « coaching-coach »
// déclaré dans ~/.claude.json. La clé et l'URL ne sont jamais affichées.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { configDistante, creerServeurMcpDistant } from '../serveur/src/mcp-distant.js'

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const args = process.argv.slice(2)
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const essai = args.includes('--essai')
const fichier = args.find((a, i) => !a.startsWith('--') && !['--client', '--programme'].includes(args[i - 1]))
if (!fichier) { console.error('Usage : node programmes/importer-programme.mjs <programme.json> [--client <identifiant>] [--programme <id>] [--essai]'); process.exit(1) }
const source = JSON.parse(readFileSync(fichier, 'utf8'))
const client = opt('--client') ?? source.client
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function env() {
  if (process.env.COACH_API_URL) return process.env
  const conf = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
  const candidats = [conf.mcpServers?.['coaching-coach'], ...Object.values(conf.projects ?? {}).map((p) => p.mcpServers?.['coaching-coach'])].filter(Boolean)
  if (!candidats.length) throw new Error('COACH_API_URL absent et serveur MCP « coaching-coach » introuvable dans ~/.claude.json')
  return candidats[0].env ?? {}
}

// --- Client MCP en mémoire, branché sur le vrai client distant (fetch instrumenté : durée, taille, cause d'erreur) ---
const conf = configDistante(env())
const fetchMesure = async (url, init) => {
  const t0 = Date.now()
  const taille = init?.body ? Buffer.byteLength(init.body) : 0
  try {
    const r = await fetch(url, init)
    if (process.env.TRACE) console.error(`  · HTTP ${r.status} en ${((Date.now() - t0) / 1000).toFixed(1)} s (corps ${(taille / 1024).toFixed(1)} Ko)`)
    return r
  } catch (e) {
    const cause = e.cause ? ` / cause : ${e.cause.code ?? ''} ${e.cause.message ?? ''}` : ''
    console.error(`  · échec réseau après ${((Date.now() - t0) / 1000).toFixed(1)} s (corps ${(taille / 1024).toFixed(1)} Ko) : ${e.name} ${e.message}${cause}`.split(conf.url).join('<api>'))
    throw e
  }
}
const [cote1, cote2] = InMemoryTransport.createLinkedPair()
await creerServeurMcpDistant({ ...conf, fetchFn: fetchMesure }).connect(cote1)
const mcp = new Client({ name: 'importer-programme', version: '1.0.0' })
await mcp.connect(cote2)

/** Appelle un outil ; renvoie { ok, donnees, code, erreur }. */
async function outil(nom, a) {
  const r = await mcp.callTool({ name: nom, arguments: a }, undefined, { timeout: 180e3 })
  let d
  try { d = JSON.parse(r.content?.[0]?.text ?? '{}') } catch { d = { erreur: r.content?.[0]?.text } }
  return r.isError ? { ok: false, code: d.code, erreur: d.erreur, donnees: d } : { ok: true, donnees: d }
}
async function lire(nom, a) {
  for (let i = 1; ; i++) {
    const r = await outil(nom, a)
    if (r.ok) return r.donnees
    if (i >= 4 || !['RESEAU', 'LIMITE', 'INTERNE'].includes(r.code)) throw new Error(`${nom} : ${r.erreur} (${r.code})`)
    await sleep(5000 * i)
  }
}
/** Écriture avec reprise : avant chaque nouvel essai, on vérifie qu'elle n'a pas déjà abouti côté serveur (pas de doublon). */
async function ecrire(libelle, nom, a, dejaFait) {
  for (let i = 1; i <= 4; i++) {
    if (i > 1) {
      await sleep(i === 2 ? 20e3 : 45e3) // laisse le serveur finir une requête dont on a perdu la réponse
      const deja = await dejaFait()
      if (deja) { console.log(`  ${libelle} : déjà présent après coupure, pas de nouvel envoi`); return deja }
    }
    const t0 = Date.now()
    const r = await outil(nom, a)
    if (r.ok) { console.log(`  ${libelle} : ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`); return r.donnees }
    console.error(`  ${libelle} : échec ${i}/4 : ${r.erreur} (${r.code})`)
    if (!['RESEAU', 'LIMITE', 'INTERNE'].includes(r.code)) break
  }
  throw new Error(`Arrêt sur « ${libelle} » : relancer la même commande pour reprendre.`)
}

// --- Plan ----------------------------------------------------------------------------------------------
const toutes = source.semaines.flatMap((sem, i) => sem.seances.map((s) => ({ semaine: i + 1, s })))
const cle = (n, nom) => `${n}|${norm(nom)}`
const programmeDuClient = async () => {
  const { programmes } = await lire('lister_programmes', { client, limite: 200 })
  if (opt('--programme')) return programmes.find((p) => p.id === opt('--programme')) ?? null
  const memes = programmes.filter((p) => norm(p.nom) === norm(source.nom))
  if (memes.length > 1) throw new Error(`Plusieurs programmes « ${source.nom} » pour ${client} : ${memes.map((p) => p.id).join(', ')}. Préciser --programme.`)
  return memes[0] ?? null
}
const presentes = async (id) => {
  const { programme } = await lire('voir_programme', { programme: id })
  return new Set(programme.semaines.flatMap((s) => s.seances.map((x) => cle(s.numero, x.nom))))
}

let prog = await programmeDuClient()
if (opt('--programme') && !prog) throw new Error(`Programme ${opt('--programme')} introuvable pour ${client}`)
let deja = prog ? await presentes(prog.id) : new Set()
const restantes = toutes.filter(({ semaine, s }) => !deja.has(cle(semaine, s.nom)))
console.log(`Programme « ${source.nom} » : ${prog ? `existe (${prog.id}), ${deja.size} séance(s) déjà là` : 'à créer'} ; ${restantes.length}/${toutes.length} séance(s) à envoyer, une par appel.`)

if (essai) {
  if (!prog) console.log(`  [essai] creer_programme : début ${source.debut}, notes ${source.notes?.length ?? 0} car., semaine 1 = « ${restantes[0]?.s.nom} » (${(JSON.stringify(restantes[0]?.s).length / 1024).toFixed(1)} Ko)`)
  for (const { semaine, s } of prog ? restantes : restantes.slice(1)) console.log(`  [essai] modifier_programme : S${semaine} ${s.jour ?? '-'} « ${s.nom} » (${(JSON.stringify(s).length / 1024).toFixed(1)} Ko)`)
  await mcp.close(); process.exit(0)
}

const sansVideo = new Set()
if (!prog) {
  const premiere = restantes.shift()
  const r = await ecrire(`S1 « ${premiere.s.nom} » (création du programme)`, 'creer_programme',
    { client, nom: source.nom, ...(source.debut ? { debut: source.debut } : {}), ...(source.notes ? { notes: source.notes } : {}), semaines: [{ seances: [premiere.s] }] },
    async () => { const p = await programmeDuClient(); return p ? { id: p.id, exercicesSansVideo: [] } : null })
  r.exercicesSansVideo?.forEach((n) => sansVideo.add(n))
  prog = { id: r.id }
  console.log(`Programme créé : ${prog.id}`)
}
for (const { semaine, s } of restantes) {
  const r = await ecrire(`S${semaine} ${s.jour ?? ''} « ${s.nom} »`, 'modifier_programme', { programme: prog.id, ajouterSeances: [{ semaine, ...s }] },
    async () => ((await presentes(prog.id)).has(cle(semaine, s.nom)) ? { exercicesSansVideo: [] } : null))
  r.exercicesSansVideo?.forEach((n) => sansVideo.add(n))
}

// --- Vérification ----------------------------------------------------------------------------------------
const { programme: p } = await lire('voir_programme', { programme: prog.id })
const pb = []
if (p.debut !== source.debut) pb.push(`début ${p.debut} au lieu de ${source.debut}`)
if (!p.notes) pb.push('notes absentes')
if (p.semaines.length !== source.semaines.length) pb.push(`${p.semaines.length} semaines au lieu de ${source.semaines.length}`)
source.semaines.forEach((sem, i) => {
  const ici = p.semaines[i]?.seances ?? []
  if (ici.length !== sem.seances.length) pb.push(`S${i + 1} : ${ici.length} séances au lieu de ${sem.seances.length}`)
  sem.seances.forEach((s, j) => {
    const x = ici[j]
    if (!x || norm(x.nom) !== norm(s.nom) || (s.jour ?? null) !== x.jour) pb.push(`S${i + 1} séance ${j + 1} : attendu ${s.jour} « ${s.nom} », trouvé ${x ? `${x.jour} « ${x.nom} »` : 'rien'}`)
  })
})
const noms = new Set(p.semaines.flatMap((s) => s.seances.flatMap((x) => x.exercices ?? [])).map(norm))
const { exercices: sansVid } = await lire('lister_exercices', { sansVideo: true, limite: 200 })
const exosSansVideo = [...new Set([...sansVid.filter((e) => noms.has(norm(e.nom))).map((e) => e.nom), ...sansVideo])]
if (exosSansVideo.length) pb.push(`exercices sans vidéo : ${exosSansVideo.join(', ')}`)
const parJour = p.semaines.map((s) => s.seances.map((x) => x.jour?.slice(0, 2)).join(''))
console.log(`\nVérification ${p.id} (client ${p.client}) :${p.semaines.length} semaines, ${p.semaines.reduce((n, s) => n + s.seances.length, 0)} séances, début ${p.debut}, notes ${p.notes.length} car., ${noms.size} exercices distincts.`)
console.log(`Jours par semaine : ${[...new Set(parJour)].join(' / ')}`)
console.log(pb.length ? `PROBLÈMES :\n- ${pb.join('\n- ')}` : 'Tout est conforme.')
await mcp.close()
process.exit(pb.length ? 2 : 0)
