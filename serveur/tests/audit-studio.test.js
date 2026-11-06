// Correctifs de l'audit de sécurité final de Studio (2026-11-06) : I1, M1, M2, M4.
import { request } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assembler } from '../src/assembler.js'
import { hacherCode } from '../src/app-http.js'
import { lireConfig } from '../src/config.js'
import { appeler } from '../src/outils.js'
import { creerServeurRest } from '../src/rest.js'

const ORIGINE = 'https://app.exemple.fr'
let app, serveur, base, dossier, coach, client
const outil = async (nom, args) => { const r = await appeler(app, nom, args, 'test'); if (!r.ok) throw new Error(`${nom} : ${r.message ?? r.code}`); return r.donnees }

async function appel(cookie, methode, chemin, { corps, entetes = {} } = {}) {
  const headers = { Cookie: cookie, Origin: ORIGINE, ...entetes }
  if (corps !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + chemin, { method: methode, headers, body: corps === undefined ? undefined : JSON.stringify(corps) })
  return { statut: r.status, json: await r.json().catch(() => null) }
}
const lire = async (entite, id) => (await appel(coach, 'GET', `/api/app/e/${entite}/${id}`)).json.item
const connexion = async (identifiant, code) => (await fetch(`${base}/api/app/connexion`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGINE }, body: JSON.stringify({ identifiant, code }) })).headers.get('set-cookie').split(';')[0]

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'audit-studio-'))
  const config = { ...lireConfig({ COACH_API_KEY: 'cle-de-test-0123456789abcdef-0123456789', DATA_DIR: dossier, DB_FILE: join(dossier, 'base.db'), SESSION_SECRET: 's'.repeat(40), APP_ORIGIN: ORIGINE, FICHIERS_DIR: join(dossier, 'f') }), youtubeCle: '' }
  app = await assembler(config, { now: () => Date.UTC(2026, 10, 5, 12) })
  const { api } = app.service
  await api.profils.creer({ id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Coach', archive: false, creeLe: 1 })
  await api.profils.creer({ id: 'alice', role: 'client', identifiant: 'alice', nom: 'Alice Durand', tarif: 50, lieuDefaut: 'domicile', modules: { habitudes: false }, archive: false, creeLe: 1, fiche: { notes: 'ANCIENNE' } })
  for (const [i, r, p] of [['coach', 'coach', 'pc'], ['alice', 'client', 'alice']]) app.backend.db.prepare('INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, ?, ?)').run(i, await hacherCode('code-secret-123'), r, p)
  serveur = creerServeurRest(app)
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${serveur.address().port}`
  coach = await connexion('coach', 'code-secret-123')
  client = await connexion('alice', 'code-secret-123')
})
afterAll(() => { serveur?.close(); app?.backend.db?.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('I1 : corps lent du client pendant que le coach écrit', () => {
  it('409, le client reste archivé, tarif et fiche du coach intacts', async () => {
    const moi = (await appel(client, 'GET', '/api/app/e/profils/alice')).json.item
    const corps = Buffer.from(JSON.stringify({ ...moi, nom: 'Client lent' }))
    const fin = new Promise((ok, ko) => {
      const r = request(`${base}/api/app/e/profils/alice`, { method: 'PUT', headers: { Cookie: client, Origin: ORIGINE, 'Content-Type': 'application/json', 'Content-Length': corps.length } }, (res) => { let t = ''; res.on('data', (c) => (t += c)); res.on('end', () => ok([res.statusCode, t])) })
      r.on('error', ko)
      r.write(corps.subarray(0, 10))
      setTimeout(async () => {
        const plein = await lire('profils', 'alice')
        const c = await appel(coach, 'PUT', '/api/app/e/profils/alice', { corps: { ...plein, archive: true, tarif: 80, fiche: { notes: 'NOTE-APRES' } } })
        expect(c.statut).toBe(200)
        r.end(corps.subarray(10))
      }, 300)
    })
    expect((await fin)[0]).toBe(409)
    expect(await lire('profils', 'alice')).toMatchObject({ archive: true, tarif: 80, fiche: { notes: 'NOTE-APRES' }, nom: 'Alice Durand' })
    // remise en état pour la suite
    const p = await lire('profils', 'alice')
    await appel(coach, 'PUT', '/api/app/e/profils/alice', { corps: { ...p, archive: false, tarif: 50 } })
  })

  it('écriture normale du client sans If-Match : toujours acceptée', async () => {
    const moi = (await appel(client, 'GET', '/api/app/e/profils/alice')).json.item
    const r = await appel(client, 'PUT', '/api/app/e/profils/alice', { corps: { ...moi, preferences: { son: false } } })
    expect(r.statut).toBe(200)
    expect(r.json.item).not.toHaveProperty('fiche')
  })
})

describe('M1 : PUT coach d\'un exercice canonise le lien vidéo', () => {
  it('forme canonique stockée, lien dangereux refusé', async () => {
    const e = { id: 'ex-put', nom: 'Pompe', categories: [] }
    expect((await appel(coach, 'PUT', '/api/app/e/exercices/ex-put', { corps: { ...e, lienVideo: 'https://user:pw@m.youtube.com:444/watch?v=bbbbbbbbbbb&x=%3Cb%3E' } })).statut).toBe(200)
    expect((await lire('exercices', 'ex-put')).lienVideo).toBe('https://www.youtube.com/watch?v=bbbbbbbbbbb')
    expect((await appel(coach, 'PUT', '/api/app/e/exercices/ex-put', { corps: { ...e, lienVideo: 'javascript:alert(1)' } })).statut).toBe(400)
  })
})

describe('M4 : If-Match strict', () => {
  it('"n", W/"n" et n acceptés ; le reste refusé en 400', async () => {
    const v = (await lire('profils', 'alice')).version
    const put = (h) => appel(coach, 'PUT', '/api/app/e/profils/alice', { corps: { ...{ id: 'alice', role: 'client', identifiant: 'alice', nom: 'Alice Durand', tarif: 50, lieuDefaut: 'domicile', modules: { habitudes: false }, archive: false, creeLe: 1 } }, entetes: { 'If-Match': h } })
    for (const mauvais of ['"2', '"1", "2"', '*', 'W/2', 'w/"2"', '""', '1e3']) expect((await put(mauvais)).statut, mauvais).toBe(400)
    expect((await put(`W/"${v + 99}"`)).statut).toBe(409)
    expect((await put(`"${v + 99}"`)).statut).toBe(409)
    expect((await put(String(v + 99))).statut).toBe(409)
  })
})

describe('M2 : les outils MCP n\'écrasent jamais une écriture de l\'écran', () => {
  it('modifier_client : écriture intercalée -> relecture et fusion, rien de perdu', async () => {
    const orig = app.backend.ecrire.bind(app.backend)
    let une = true
    app.backend.ecrire = async (entite, obj, opt) => {
      if (une && entite === 'profils') { une = false; await orig('profils', { ...(await app.backend.un('profils', 'alice')), fiche: { notes: 'ECRAN' } }) } // l'écran écrit entre la lecture et l'écriture de l'outil
      return orig(entite, obj, opt)
    }
    try { await outil('modifier_client', { client: 'alice', tarif: 42 }) } finally { app.backend.ecrire = orig }
    expect(une).toBe(false)
    expect(await lire('profils', 'alice')).toMatchObject({ tarif: 42, fiche: { notes: 'ECRAN' } })
  })
  it('commun.modifier sans version : même protection', async () => {
    const orig = app.backend.ecrire.bind(app.backend)
    let une = true
    app.backend.ecrire = async (entite, obj, opt) => {
      if (une && entite === 'profils') { une = false; await orig('profils', { ...(await app.backend.un('profils', 'alice')), tarif: 77 }) }
      return orig(entite, obj, opt)
    }
    try { await app.service.api.profils.modifier('alice', { nom: 'Alice D.' }) } finally { app.backend.ecrire = orig }
    expect(await lire('profils', 'alice')).toMatchObject({ nom: 'Alice D.', tarif: 77 })
  })
})
