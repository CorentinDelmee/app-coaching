// Migration : 181 exercices « d'avant » (sans les champs Studio, formes variées) restent intacts, lisibles et modifiables.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAppHttp, hacherCode } from '../src/app-http.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'
import { creerServeurRest } from '../src/rest.js'
import { lireConfig } from '../src/config.js'

const ORIGINE = 'https://app.exemple.fr'
let base, serveur, dossier, cookie, store
const anciens = Array.from({ length: 181 }, (_, i) => {
  const e = { id: `ex-ancien-${i}`, nom: `Ancien ${i}`, categories: i % 3 ? ['jambes'] : [] }
  if (i % 2) e.description = i % 7 === 0 ? `Importé\nlong ${'x'.repeat(1500)}` : 'Description'
  e.lienVideo = i % 5 === 0 ? null : i % 11 === 0 ? 'https://vimeo.com/123' : i % 4 === 0 ? 'https://youtu.be/abcdefghijk' : undefined
  if (i % 13 === 0) e.archive = true
  return JSON.parse(JSON.stringify(e)) // comme une ligne JSON de la base (undefined retiré)
})
const req = async (methode, chemin, corps) => {
  const r = await fetch(base + chemin, { method: methode, headers: { Cookie: cookie, Origin: ORIGINE, 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined })
  return { statut: r.status, json: await r.json() }
}

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'exo-migr-'))
  const db = ouvrirBase(':memory:')
  store = creerStoreSqlite(db)
  await store.ecrire('profils', { id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Coach', archive: false, creeLe: 1 })
  db.prepare('INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, ?, ?)').run('coach', await hacherCode('code-secret-123'), 'coach', 'pc')
  for (const e of anciens) await store.ecrire('exercices', e)
  const config = { ...lireConfig({}), sessionSecret: 's'.repeat(40), appOrigin: ORIGINE, fichiersDir: dossier }
  serveur = creerServeurRest({ config, appHttp: creerAppHttp({ db, store, config }), outils: {}, journal: { ecrire() {} }, service: {}, biblio: {} })
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${serveur.address().port}`
  const c = await fetch(`${base}/api/app/connexion`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGINE }, body: JSON.stringify({ identifiant: 'coach', code: 'code-secret-123' }) })
  cookie = c.headers.get('set-cookie').split(';')[0]
})
afterAll(() => { serveur?.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('migration des exercices existants', () => {
  it('tous lisibles par la nouvelle liste (hors archivés), champs d\'origine inchangés, valeurs par défaut', async () => {
    const r = (await req('GET', '/api/app/exercices?limite=500')).json
    const actifs = anciens.filter((e) => !e.archive)
    expect(r.total).toBe(actifs.length)
    for (const item of r.items) {
      const { photo, video, utiliseDans, utiliseDansProgrammes, ...origine } = item
      expect(origine).toEqual(anciens.find((e) => e.id === item.id))
      expect(photo).toBeNull(); expect(utiliseDans).toBe(0); expect(utiliseDansProgrammes).toBe(0)
    }
    expect((await req('GET', '/api/app/e/exercices')).json.items).toHaveLength(181) // route générique : tout, archivés compris
  })
  it('PUT générique (ancienne UI) accepte chaque ancienne ligne, sans perte', async () => {
    for (const e of anciens) expect((await req('PUT', `/api/app/e/exercices/${e.id}`, e)).statut, e.id).toBe(200)
    // seul changement toléré : « lienVideo: null » devient simplement absent (même sens)
    for (const e of anciens) expect(await store.un('exercices', e.id)).toEqual(Object.fromEntries(Object.entries(e).filter(([, v]) => v !== null)))
  })
  it('PATCH sur une ancienne ligne ajoute les nouveaux champs sans perdre les anciens', async () => {
    const e = anciens[7] // description longue importée
    const r = (await req('PATCH', `/api/app/exercices/${e.id}`, { niveau: 'debutant', musclesPrincipaux: ['jambes'] })).json.item
    expect(r).toMatchObject({ ...e, niveau: 'debutant', musclesPrincipaux: ['jambes'] })
  })
})
