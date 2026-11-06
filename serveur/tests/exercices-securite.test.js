// Correctifs de l'audit sécurité des exercices enrichis (I1, M1-M8).
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAppHttp, hacherCode } from '../src/app-http.js'
import { creerBibliotheque } from '../src/bibliotheque.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'
import { creerServeurRest } from '../src/rest.js'
import { lireConfig } from '../src/config.js'

const ORIGINE = 'https://app.exemple.fr'
const E = '/api/app/exercices'
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('VP8 xxxx')])
let base, serveur, dossier, coach, client, store, db, biblio, config

async function appel(methode, chemin, { corps, cookie, brut, type } = {}) {
  const headers = {}
  if (methode !== 'GET') headers.Origin = ORIGINE
  if (cookie) headers.Cookie = cookie
  let body
  if (brut) { body = brut; headers['Content-Type'] = type } else if (corps !== undefined) { body = JSON.stringify(corps); headers['Content-Type'] = 'application/json' }
  const r = await fetch(base + chemin, { method: methode, headers, body })
  const buf = Buffer.from(await r.arrayBuffer())
  let json = null
  try { json = JSON.parse(buf.toString('utf8')) } catch { /* binaire */ }
  return { statut: r.status, json, buf, h: r.headers }
}
const ouvrir = async (identifiant) => (await fetch(`${base}/api/app/connexion`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGINE }, body: JSON.stringify({ identifiant, code: 'code-secret-123' }) })).headers.get('set-cookie').split(';')[0]

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'exo-sec-'))
  db = ouvrirBase(':memory:')
  store = creerStoreSqlite(db)
  await store.ecrire('profils', { id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Coach', archive: false, creeLe: 1 })
  await store.ecrire('profils', { id: 'pa', role: 'client', identifiant: 'alice', nom: 'Alice', archive: false, creeLe: 1 })
  for (const [i, r, p] of [['coach', 'coach', 'pc'], ['alice', 'client', 'pa']]) db.prepare('INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, ?, ?)').run(i, await hacherCode('code-secret-123'), r, p)
  biblio = creerBibliotheque(join(dossier, 'bib.json'))
  config = { ...lireConfig({}), sessionSecret: 's'.repeat(40), appOrigin: ORIGINE, fichiersDir: dossier }
  const appHttp = creerAppHttp({ db, store, config, biblio })
  serveur = creerServeurRest({ config, appHttp, outils: {}, journal: { ecrire() {} }, service: {}, biblio: {} })
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${serveur.address().port}`
  coach = await ouvrir('coach')
  client = await ouvrir('alice')
})
afterAll(() => { serveur?.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('I1 charge : 500 exercices, bibliothèque de 51 entrées', () => {
  it('une requête client < 20 ms (page et liste complète), la bibliothèque n\'est pas relue à chaque exercice', async () => {
    const entrees = Array.from({ length: 51 }, (_, i) => ({ nom: `Mouvement ${i}`, video: { url: `https://www.youtube.com/watch?v=abcdefg${String(i).padStart(4, '0')}`, titre: 't' }, statut: 'propose' }))
    biblio.importer(entrees)
    for (let i = 0; i < 500; i++) await store.ecrire('exercices', { id: `ch-${i}`, nom: `Mouvement ${i % 60}`, categories: [], lienVideo: i % 3 ? `https://www.youtube.com/watch?v=abcdefg${String(i % 51).padStart(4, '0')}` : undefined })
    for (const [cookie, q] of [[client, '?limite=1'], [client, '?limite=50'], [client, ''], [coach, '?limite=50']]) {
      await appel('GET', E + q, { cookie }) // échauffement
      const durees = [] // médiane : insensible à un pic de charge de la machine pendant les autres tests
      for (let i = 0; i < 7; i++) { const t = performance.now(); expect((await appel('GET', E + q, { cookie })).statut).toBe(200); durees.push(performance.now() - t) }
      expect(durees.sort((x, y) => x - y)[3], q).toBeLessThan(20)
    }
    expect((await appel('GET', `${E}?video=propose`, { cookie: client })).json.total).toBeGreaterThan(0)
  })
  it('la bibliothèque modifiée sur disque est relue (cache selon la date)', async () => {
    const avant = biblio.chercher('Mouvement 0').length
    biblio.importer([{ nom: 'Mouvement 0', video: { url: 'https://www.youtube.com/watch?v=zzzzzzzzzz1' }, statut: 'valide' }])
    expect(biblio.chercher('Mouvement 0').length).toBe(avant + 1)
    const autre = creerBibliotheque(join(dossier, 'bib.json'))
    autre.importer([{ nom: 'Mouvement 0', video: { url: 'https://www.youtube.com/watch?v=yyyyyyyyyy2' }, statut: 'valide' }])
    expect(biblio.chercher('Mouvement 0').length).toBe(avant + 2)
  })
})

describe('M1 / M2 vidéo', () => {
  it('lien non YouTube hérité : video null côté client ; PUT avec javascript: refusé', async () => {
    await store.ecrire('exercices', { id: 'ex-js', nom: 'Js', categories: [], lienVideo: 'javascript:alert(1)' })
    await store.ecrire('exercices', { id: 'ex-vimeo', nom: 'Vimeo', categories: [], lienVideo: 'https://vimeo.com/1' })
    for (const id of ['ex-js', 'ex-vimeo']) {
      const r = await appel('GET', `${E}/${id}`, { cookie: client })
      expect(r.json.item.video, id).toBeNull()
    }
    const put = (lienVideo) => appel('PUT', '/api/app/e/exercices/ex-put', { cookie: coach, corps: { id: 'ex-put', nom: 'P', categories: [], lienVideo } })
    expect((await put('javascript:alert(1)')).statut).toBe(400)
    expect((await put('data:text/html,x')).statut).toBe(400)
    expect((await put('https://vimeo.com/1')).statut).toBe(200)
  })
  it('bibliothèque en panne : la liste répond quand même, statut propose', async () => {
    writeFileSync(join(dossier, 'bib.json'), '{ pas du json')
    const r = await appel('GET', `${E}?limite=500`, { cookie: client })
    expect(r.statut).toBe(200)
    const it = r.json.items.find((e) => e.id === 'ch-1')
    expect(it.video).toMatchObject({ statut: 'propose', titre: null })
  })
})

describe('M3 photos', () => {
  it('écriture en base qui échoue : le fichier posé est supprimé', async () => {
    await store.ecrire('exercices', { id: 'ex-ph', nom: 'Ph', categories: [] })
    const ecrire = store.ecrire
    store.ecrire = async () => { throw new Error('disque plein') }
    const r = await appel('POST', `${E}/ex-ph/photo`, { cookie: coach, brut: WEBP, type: 'image/webp' })
    store.ecrire = ecrire
    expect(r.statut).toBeGreaterThanOrEqual(500)
    expect(existsSync(join(dossier, '_exercices')) ? readdirSync(join(dossier, '_exercices')) : []).toEqual([])
  })
  it('deux envois simultanés : un seul fichier reste', async () => {
    await Promise.all([1, 2, 3].map(() => appel('POST', `${E}/ex-ph/photo`, { cookie: coach, brut: WEBP, type: 'image/webp' })))
    const ex = await store.un('exercices', 'ex-ph')
    expect(readdirSync(join(dossier, '_exercices'))).toEqual([`${ex.photo.id}.webp`])
  })
})

describe('M4 liens symboliques', () => {
  it('un lien posé dans _exercices n\'est pas servi', async () => {
    mkdirSync(join(dossier, '_exercices'), { recursive: true })
    writeFileSync(join(dossier, 'secret.jpg'), 'secret')
    symlinkSync(join(dossier, 'secret.jpg'), join(dossier, '_exercices', 'lien.jpg'))
    expect(lstatSync(join(dossier, '_exercices', 'lien.jpg')).isSymbolicLink()).toBe(true)
    expect((await appel('GET', '/api/app/fichiers?chemin=_exercices%2Flien.jpg', { cookie: client })).statut).toBe(404)
  })
})

describe('M5 espace de noms des photos', () => {
  it('dossier public _exercices ; l\'ancien préfixe n\'est plus public ; id de profil exercices refusé', async () => {
    const photo = (await appel('GET', `${E}/ex-ph`, { cookie: client })).json.item.photo
    expect(photo.url).toContain('chemin=_exercices%2F')
    expect((await appel('GET', photo.url, { cookie: client })).statut).toBe(200)
    mkdirSync(join(dossier, 'exercices'), { recursive: true })
    writeFileSync(join(dossier, 'exercices', 'x.jpg'), 'x')
    expect((await appel('GET', '/api/app/fichiers?chemin=exercices%2Fx.jpg', { cookie: client })).statut).toBe(403)
    for (const id of ['exercices', '_exercices']) {
      const r = await appel('POST', '/api/app/comptes', { cookie: coach, corps: { identifiant: `u${id.length}`, code: 'code-secret-123', profil: { id, role: 'client', identifiant: `u${id.length}`, nom: 'X', archive: false, creeLe: 1 } } })
      expect(r.statut, id).toBe(400)
    }
  })
  it('migration : ancien dossier déplacé, URL des photos réécrites', async () => {
    const d = mkdtempSync(join(tmpdir(), 'exo-mig-'))
    mkdirSync(join(d, 'exercices'))
    writeFileSync(join(d, 'exercices', 'p-aaaaaaaaaaaa.webp'), WEBP)
    const db2 = ouvrirBase(':memory:'), st2 = creerStoreSqlite(db2)
    await st2.ecrire('exercices', { id: 'a', nom: 'A', categories: [], photo: { id: 'p-aaaaaaaaaaaa', url: '/api/app/fichiers?chemin=exercices%2Fp-aaaaaaaaaaaa.webp' } })
    const { migrerPhotos } = await import('../src/app-http.js')
    await migrerPhotos({ store: st2, fichiersDir: d })
    expect(existsSync(join(d, 'exercices'))).toBe(false)
    expect(readdirSync(join(d, '_exercices'))).toEqual(['p-aaaaaaaaaaaa.webp'])
    expect((await st2.un('exercices', 'a')).photo.url).toBe('/api/app/fichiers?chemin=_exercices%2Fp-aaaaaaaaaaaa.webp')
    await migrerPhotos({ store: st2, fichiersDir: d }) // idempotent
    rmSync(d, { recursive: true, force: true })
  })
})

describe('M6 identifiants réservés', () => {
  it('__proto__, constructor, prototype refusés en POST', async () => {
    for (const id of ['__proto__', 'constructor', 'prototype']) expect((await appel('POST', E, { cookie: coach, corps: { id, nom: 'X' } })).statut, id).toBe(400)
  })
})

describe('M7 PUT tolérant et clés inconnues d\'anciennes lignes', () => {
  it('conserve telle quelle une clé inconnue déjà stockée ; refuse d\'en introduire ou d\'en changer une', async () => {
    await store.ecrire('exercices', { id: 'ex-src', nom: 'Src', categories: [], source: 'mypthub', ancien: { a: 1 } })
    const put = (corps) => appel('PUT', '/api/app/e/exercices/ex-src', { cookie: coach, corps })
    expect((await put({ id: 'ex-src', nom: 'Src 2', categories: [], source: 'mypthub', ancien: { a: 1 } })).statut).toBe(200)
    expect(await store.un('exercices', 'ex-src')).toMatchObject({ nom: 'Src 2', source: 'mypthub', ancien: { a: 1 } })
    // le formulaire peut aussi renvoyer l'objet sans la clé : elle reste en stockage
    expect((await put({ id: 'ex-src', nom: 'Src 3', categories: [] })).statut).toBe(200)
    expect(await store.un('exercices', 'ex-src')).toMatchObject({ nom: 'Src 3', source: 'mypthub' })
    expect((await put({ id: 'ex-src', nom: 'Src', categories: [], source: 'autre' })).statut).toBe(400)
    expect((await put({ id: 'ex-src', nom: 'Src', categories: [], nouvelle: 1 })).statut).toBe(400)
    expect((await store.un('exercices', 'ex-src')).nouvelle).toBeUndefined()
  })
})

describe('valider-video', () => {
  it('coach : proposée -> validée dans la bibliothèque ; client 403 ; sans vidéo 409 ; inconnu 404', async () => {
    writeFileSync(join(dossier, 'bib.json'), '[]')
    await store.ecrire('exercices', { id: 'ex-vv', nom: 'Vv', categories: [], lienVideo: 'https://www.youtube.com/watch?v=mKREc_xl_j8' })
    await store.ecrire('exercices', { id: 'ex-vv0', nom: 'Vv0', categories: [] })
    const v = (id, cookie) => appel('POST', `${E}/${id}/valider-video`, { cookie })
    expect((await v('ex-vv', client)).statut).toBe(403)
    expect((await v('ex-vv0', coach)).statut).toBe(409)
    expect((await v('inconnu', coach)).statut).toBe(404)
    expect((await appel('GET', `${E}/ex-vv`, { cookie: coach })).json.item.video.statut).toBe('propose')
    const r = await v('ex-vv', coach)
    expect(r.statut).toBe(200)
    expect(r.json.item.video.statut).toBe('valide')
    expect((await appel('GET', `${E}/ex-vv`, { cookie: client })).json.item.video.statut).toBe('valide')
  })
})

describe('M8 bibliothèque après validation', () => {
  it('un PATCH refusé ne laisse pas de proposition dans la bibliothèque', async () => {
    writeFileSync(join(dossier, 'bib.json'), '[]')
    await store.ecrire('exercices', { id: 'ex-m8', nom: 'Mhuit', categories: [] })
    // lien valide mais ligne résultante invalide (niveau vérifié par le contrat de lecture)
    const avant = biblio.lister().length
    const r = await appel('PATCH', `${E}/ex-m8`, { cookie: coach, corps: { lienVideo: 'https://youtu.be/mKREc_xl_j8', niveau: 'dieu' } })
    expect(r.statut).toBe(400)
    expect(biblio.lister().length).toBe(avant)
    expect((await appel('PATCH', `${E}/ex-m8`, { cookie: coach, corps: { lienVideo: 'https://youtu.be/mKREc_xl_j8' } })).statut).toBe(200)
    expect(biblio.chercher('Mhuit')).toHaveLength(1)
  })
})
