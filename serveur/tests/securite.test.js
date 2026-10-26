// Tests des correctifs de l'audit du 26/10 (docs/AUDIT-SECURITE-26-10.md) : démo publique, corps trop gros, journal, clé.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assembler } from '../src/assembler.js'
import { cleValide } from '../src/auth.js'
import { lireConfig } from '../src/config.js'
import { creerJournal } from '../src/journal.js'
import { creerServeurRest } from '../src/rest.js'

const CLE = 'cle-de-test-0123456789abcdef-0123456789'
let dossier, srv, base

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'srv-sec-'))
  const app = await assembler({ ...lireConfig({ COACH_API_KEY: CLE, DATA_DIR: dossier, DEMO_SYNC: '1' }), youtubeCle: '' })
  srv = creerServeurRest(app)
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${srv.address().port}`
})
afterAll(() => new Promise((ok) => srv.close(() => { rmSync(dossier, { recursive: true, force: true }); ok() })))

describe('/demo/etat', () => {
  it('ne renvoie ni séances de coaching ni comptes', async () => {
    const etat = await (await fetch(`${base}/demo/etat`)).json()
    expect(Object.keys(etat).sort()).toEqual(['exercices', 'programmes', 'workouts'])
  })
  it('le serveur refuse de démarrer avec DEMO_SYNC=1 et SUPABASE_URL', () => {
    expect(() => lireConfig({ DEMO_SYNC: '1', SUPABASE_URL: 'https://x.supabase.co' })).toThrow(/DEMO_SYNC/)
    expect(() => lireConfig({ SUPABASE_URL: 'https://x.supabase.co' })).not.toThrow()
  })
})

describe('corps trop gros', () => {
  it('répond 413 puis coupe la connexion', async () => {
    const statut = await new Promise((ok, ko) => {
      const r = request(`${base}/api/seances`, { method: 'POST', headers: { Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' } }, (res) => { res.resume(); ok(res.statusCode) })
      r.on('error', (e) => (e.code === 'ECONNRESET' ? ok(413) : ko(e)))
      r.end('x'.repeat(300 * 1024))
    })
    expect(statut).toBe(413)
  })
})

describe('clé API', () => {
  it('exige 32 caractères minimum', () => {
    expect(cleValide('Bearer 0123456789abcdef', '0123456789abcdef')).toBe(false)
    expect(cleValide(`Bearer ${CLE}`, CLE)).toBe(true)
  })
})

describe('journal', () => {
  it('purge les lignes plus vieilles que la durée de conservation', () => {
    const f = join(dossier, 'j.jsonl')
    const j = creerJournal(f, () => Date.UTC(2026, 9, 26))
    writeFileSync(f, [{ quand: '2026-01-01T00:00:00Z', outil: 'vieux' }, { quand: '2026-10-20T00:00:00Z', outil: 'recent' }].map((x) => JSON.stringify(x)).join('\n') + '\n')
    expect(j.purger(90)).toBe(1)
    expect(readFileSync(f, 'utf8')).toContain('recent')
    expect(readFileSync(f, 'utf8')).not.toContain('vieux')
  })
})
