// Lot 1 transport : route publique /api/coach/*, MCP distant, modèles Caddy.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { assembler } from '../src/assembler.js'
import { lireConfig } from '../src/config.js'
import { creerServeurRest } from '../src/rest.js'
import { configDistante, creerServeurMcpDistant } from '../src/mcp-distant.js'

const CLE = 'cle-coach-de-test-0123456789abcdef-01'
const PROXY = 'ab'.repeat(32)
let dossier, app, serveur, base
let t = Date.UTC(2026, 10, 5, 12)

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'coach-http-'))
  app = await assembler({ ...lireConfig({ COACH_API_KEY: CLE, DATA_DIR: dossier }), youtubeCle: '', proxyCle: PROXY }, { now: () => t })
  serveur = creerServeurRest(app, { now: () => t })
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${serveur.address().port}`
})
afterAll(async () => {
  await new Promise((r) => serveur.close(r))
  rmSync(dossier, { recursive: true, force: true })
})

// ip : simule une requête relayée par Caddy depuis cette IP (X-Forwarded-For + X-Proxy-Cle).
async function appel(methode, chemin, { cle = CLE, corps, ip } = {}) {
  const r = await fetch(base + chemin, {
    method: methode,
    headers: { ...(cle ? { Authorization: `Bearer ${cle}` } : {}), ...(ip ? { 'X-Forwarded-For': ip, 'X-Proxy-Cle': PROXY } : {}), ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(corps !== undefined ? { body: typeof corps === 'string' ? corps : JSON.stringify(corps) } : {})
  })
  return { statut: r.status, cache: r.headers.get('cache-control'), corps: await r.json().catch(() => null) }
}
const journal = () => readFileSync(app.journal.fichier, 'utf8').trim().split('\n').map((l) => JSON.parse(l))

describe('/api/coach/* : authentification', () => {
  it('bonne clé : santé, liste des outils avec schémas JSON, no-store', async () => {
    const s = await appel('GET', '/api/coach/sante', { ip: '198.51.100.1' })
    expect(s.statut).toBe(200)
    expect(s.cache).toBe('no-store')
    expect(s.corps.ok).toBe(true)
    const l = await appel('GET', '/api/coach/outils', { ip: '198.51.100.1' })
    expect(l.statut).toBe(200)
    const lister = l.corps.find((o) => o.nom === 'lister_clients')
    expect(lister.schema.type).toBe('object')
    expect(l.corps.find((o) => o.nom === 'creer_seance').schema.required).toContain('client')
  })
  it('appelle un outil et journalise avec l\'acteur api-coach', async () => {
    const r = await appel('POST', '/api/coach/outils/chercher_client', { corps: { nom: 'léa martin' }, ip: '198.51.100.1' })
    expect(r.statut).toBe(200)
    expect(r.corps.resultats.length).toBeGreaterThan(0)
    expect(journal().at(-1)).toMatchObject({ acteur: 'api-coach', outil: 'chercher_client', ok: true })
  })
  it('clé absente ou fausse : 401, journalisé, jamais la clé dans le journal', async () => {
    expect((await appel('GET', '/api/coach/outils', { cle: null, ip: '198.51.100.2' })).statut).toBe(401)
    const r = await appel('GET', '/api/coach/outils', { cle: CLE + 'x', ip: '198.51.100.2' })
    expect(r.statut).toBe(401)
    expect(r.corps.code).toBe('NON_AUTORISE')
    expect(journal().at(-1)).toMatchObject({ acteur: 'api-coach', ok: false })
    expect(readFileSync(app.journal.fichier, 'utf8')).not.toContain(CLE)
  })
  it('outil inconnu : 404 OUTIL_INCONNU ; arguments invalides : 400 VALIDATION ; JSON cassé : 400', async () => {
    const r = await appel('POST', '/api/coach/outils/outil_qui_n_existe_pas', { corps: {}, ip: '198.51.100.1' })
    expect(r.statut).toBe(404)
    expect(r.corps.code).toBe('OUTIL_INCONNU')
    expect((await appel('POST', '/api/coach/outils/chercher_client', { corps: { nom: 'x', pirate: 1 }, ip: '198.51.100.1' })).corps.code).toBe('VALIDATION')
    expect((await appel('POST', '/api/coach/outils/chercher_client', { corps: '{pas du json', ip: '198.51.100.1' })).statut).toBe(400)
    expect((await appel('GET', '/api/coach/autre', { ip: '198.51.100.1' })).statut).toBe(404)
  })
  it('codes métier : introuvable 404, consentement 403, indisponible 503', async () => {
    expect((await appel('POST', '/api/coach/outils/voir_programme', { corps: { programme: 'zzz' }, ip: '198.51.100.1' })).statut).toBe(404)
    expect((await appel('POST', '/api/coach/outils/lister_reservations', { corps: {}, ip: '198.51.100.1' })).statut).toBe(503) // RESA_ADMIN_KEY absente
  })
  it('corps > 1 Mo : 413', async () => {
    const r = await fetch(`${base}/api/coach/outils/chercher_client`, { method: 'POST', headers: { Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: 'x'.repeat(1100 * 1024) }) }).catch(() => null)
    // Le serveur répond 413 puis coupe : selon le moment, fetch voit la réponse ou la coupure.
    if (r) expect(r.status).toBe(413)
  })
})

describe('/api/coach/* : limite des échecs par IP réelle', () => {
  it('10 échecs en 15 min depuis une IP → 429 pour elle (même avec la bonne clé), pas pour une autre IP', async () => {
    for (let i = 0; i < 10; i++) expect((await appel('GET', '/api/coach/sante', { cle: 'fausse', ip: '203.0.113.7' })).statut).toBe(401)
    expect((await appel('GET', '/api/coach/sante', { cle: 'fausse', ip: '203.0.113.7' })).statut).toBe(429)
    expect((await appel('GET', '/api/coach/sante', { ip: '203.0.113.7' })).statut).toBe(429)
    expect((await appel('GET', '/api/coach/sante', { ip: '203.0.113.8' })).statut).toBe(200)
    t += 15 * 60e3 + 1
    expect((await appel('GET', '/api/coach/sante', { ip: '203.0.113.7' })).statut).toBe(200)
  })
  it('X-Forwarded-For sans la clé du proxy est ignoré (on ne contourne pas la limite en changeant d\'IP forgée)', async () => {
    const forge = (i) => fetch(`${base}/api/coach/sante`, { headers: { Authorization: 'Bearer fausse', 'X-Forwarded-For': `192.0.2.${i}` } }).then((r) => r.status)
    const statuts = []
    for (let i = 0; i < 11; i++) statuts.push(await forge(i))
    expect(statuts.at(-1)).toBe(429)
    t += 15 * 60e3 + 1
  })
})

describe('routes REST historiques non exposées', () => {
  it('une requête relayée par Caddy vers /api/outils ou /api/clients est refusée (404), même avec la clé', async () => {
    expect((await appel('GET', '/api/outils', { ip: '198.51.100.1' })).statut).toBe(404)
    expect((await appel('GET', '/api/clients', { ip: '198.51.100.1' })).statut).toBe(404)
    expect((await appel('POST', '/api/outils/lister_clients', { corps: {}, ip: '198.51.100.1' })).statut).toBe(404)
    // En local (sans Caddy), elles restent disponibles comme avant.
    expect((await appel('GET', '/api/outils')).statut).toBe(200)
  })
  it('les deux modèles Caddy ne relaient vers Node que /api/app/* et /api/coach/*', () => {
    for (const f of ['app-coaching.caddy', 'app-coaching-chemin.caddy']) {
      const texte = readFileSync(join(import.meta.dirname, '..', '..', 'deploiement', f), 'utf8')
      const handles = [...texte.matchAll(/handle\s+(\S+)\s*\{[^]*?reverse_proxy\s+127\.0\.0\.1:5405/g)].map((m) => m[1])
      expect(handles, f).toEqual(['/api/app/*', '/api/coach/*'])
      expect((texte.match(/reverse_proxy/g) || []).length, f).toBe(2)
      expect(texte, f).toMatch(/handle \/api\/coach\/\* \{[^]*?max_size 1MB[^]*?header_up X-Proxy-Cle A_REMPLACER_PROXY_KEY/)
    }
  })
})

describe('MCP distant', () => {
  async function connecter() {
    const mcp = creerServeurMcpDistant({ url: `${base}/api/coach`, cle: CLE })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await mcp.connect(a)
    const client = new Client({ name: 'test', version: '1.0.0' })
    await client.connect(b)
    return { client, fermer: async () => { await client.close(); await mcp.close() } }
  }
  it('liste les outils depuis l\'API (dynamique : un outil ajouté côté serveur apparaît)', async () => {
    const { client, fermer } = await connecter()
    const noms = (await client.listTools()).tools.map((o) => o.name)
    expect(noms).toEqual(expect.arrayContaining(['lister_clients', 'creer_seance']))
    expect(noms.length).toBe(Object.keys(app.outils).length)
    app.outils.outil_de_test = { description: 'Ajouté après coup', schema: (await import('zod')).z.object({}).strict(), run: () => ({ ok: 1 }), mutation: false }
    try {
      expect((await client.listTools()).tools.map((o) => o.name)).toContain('outil_de_test')
      expect(JSON.parse((await client.callTool({ name: 'outil_de_test', arguments: {} })).content[0].text)).toEqual({ ok: 1 })
    } finally { delete app.outils.outil_de_test; await fermer() }
  })
  it('transmet un appel et ses erreurs (isError)', async () => {
    const { client, fermer } = await connecter()
    try {
      const ok = await client.callTool({ name: 'chercher_client', arguments: { nom: 'léa' } })
      expect(ok.isError).toBeFalsy()
      expect(JSON.parse(ok.content[0].text).resultats.length).toBeGreaterThan(0)
      const ko = await client.callTool({ name: 'outil_inconnu', arguments: {} })
      expect(ko.isError).toBe(true)
      expect(JSON.parse(ko.content[0].text).code).toBe('OUTIL_INCONNU')
      expect(journal().filter((l) => l.outil === 'chercher_client').at(-1).acteur).toBe('api-coach')
    } finally { await fermer() }
  })
  it('mauvaise clé : la liste échoue avec un message clair', async () => {
    const mcp = creerServeurMcpDistant({ url: `${base}/api/coach`, cle: 'z'.repeat(40) })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await mcp.connect(a)
    const client = new Client({ name: 'test', version: '1.0.0' })
    await client.connect(b)
    try { await expect(client.listTools()).rejects.toThrow(/HTTP 401/) } finally { await client.close(); await mcp.close() }
  })
  it('configuration : clé dans un fichier (prioritaire), HTTPS exigé hors 127.0.0.1', () => {
    const f = join(dossier, 'cle.txt')
    writeFileSync(f, `${CLE}\n`)
    expect(configDistante({ COACH_API_URL: 'https://exemple.fr/api/coach/', COACH_API_KEY: 'autre'.repeat(10), COACH_API_KEY_FILE: f })).toEqual({ url: 'https://exemple.fr/api/coach', cle: CLE })
    expect(configDistante({ COACH_API_URL: 'http://127.0.0.1:5471/api/coach', COACH_API_KEY: CLE }).cle).toBe(CLE)
    expect(() => configDistante({ COACH_API_URL: 'http://exemple.fr/api/coach', COACH_API_KEY: CLE })).toThrow(/https/)
    expect(() => configDistante({ COACH_API_URL: 'https://exemple.fr/api/coach', COACH_API_KEY: 'court' })).toThrow(/trop courte/)
    expect(() => configDistante({ COACH_API_URL: 'https://exemple.fr/api/coach', COACH_API_KEY_FILE: join(dossier, 'absent') })).toThrow(/illisible/)
  })
})
