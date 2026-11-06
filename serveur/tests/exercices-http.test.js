// Routes /api/app/exercices (contrat docs/CONTRAT-EXERCICES-STUDIO.md) : droits, validation, photo, vue client.
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAppHttp, hacherCode } from '../src/app-http.js'
import { creerBibliotheque } from '../src/bibliotheque.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'
import { creerServeurRest } from '../src/rest.js'
import { lireConfig } from '../src/config.js'

const ORIGINE = 'https://app.exemple.fr'
const SECRET = 's'.repeat(40)
const LIEN = 'https://www.youtube.com/watch?v=mKREc_xl_j8'
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('VP8 xxxx')])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('xxxx')])
let base, serveur, dossier, coach, client, store, biblio

async function appel(methode, chemin, { corps, cookie, origine = ORIGINE, brut, type, entetes = {} } = {}) {
  const headers = { ...entetes }
  if (origine && methode !== 'GET') headers.Origin = origine
  if (cookie) headers.Cookie = cookie
  let body
  if (brut) { body = brut; headers['Content-Type'] = type } else if (corps !== undefined) { body = JSON.stringify(corps); headers['Content-Type'] = 'application/json' }
  const r = await fetch(base + chemin, { method: methode, headers, body })
  const buf = Buffer.from(await r.arrayBuffer())
  let json = null
  try { json = JSON.parse(buf.toString('utf8')) } catch { /* binaire */ }
  return { statut: r.status, json, buf, h: r.headers }
}
const E = '/api/app/exercices'
const ouvrir = async (identifiant) => (await fetch(`${base}/api/app/connexion`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGINE }, body: JSON.stringify({ identifiant, code: 'code-secret-123' }) })).headers.get('set-cookie').split(';')[0]

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'exo-http-'))
  const db = ouvrirBase(':memory:')
  store = creerStoreSqlite(db)
  await store.ecrire('profils', { id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Coach', archive: false, creeLe: 1 })
  await store.ecrire('profils', { id: 'pa', role: 'client', identifiant: 'alice', nom: 'Alice', archive: false, creeLe: 1 })
  for (const [i, r, p] of [['coach', 'coach', 'pc'], ['alice', 'client', 'pa']]) db.prepare('INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, ?, ?)').run(i, await hacherCode('code-secret-123'), r, p)
  await store.ecrire('exercices', { id: 'ex-ancien', nom: 'Ancien', categories: ['jambes'], lienVideo: null, description: 'vieux' }) // ligne héritée
  await store.ecrire('workouts', { id: 'w1', clientId: 'pa', nom: 'S1', blocs: [{ id: 'b1', type: 'exercice', exerciceId: 'ex-ancien', series: [{}] }] })
  await store.ecrire('programmes', { id: 'pr1', clientId: 'pa', nom: 'P', mode: 'repete', debut: '2026-11-02', workouts: ['w1'] })
  biblio = creerBibliotheque(join(dossier, 'bib.json'))
  const config = { ...lireConfig({}), sessionSecret: SECRET, appOrigin: ORIGINE, fichiersDir: dossier }
  const appHttp = creerAppHttp({ db, store, config, biblio })
  serveur = creerServeurRest({ config, appHttp, outils: {}, journal: { ecrire() {} }, service: {}, biblio: {} })
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${serveur.address().port}`
  coach = await ouvrir('coach')
  client = await ouvrir('alice')
})
afterAll(() => { serveur?.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('droits et CSRF', () => {
  it('non connecté : 401 ; client : écritures 403 ; non-GET sans Origin : 403 origine_refusee', async () => {
    expect((await appel('GET', E)).json).toEqual({ erreur: 'non_connecte' })
    expect((await appel('POST', E, { cookie: client, corps: { nom: 'X' } })).json).toEqual({ erreur: 'interdit' })
    expect((await appel('PATCH', `${E}/ex-ancien`, { cookie: client, corps: { tempo: '1' } })).statut).toBe(403)
    expect((await appel('POST', `${E}/ex-ancien/photo`, { cookie: client, brut: WEBP, type: 'image/webp' })).statut).toBe(403)
    expect((await appel('DELETE', `${E}/ex-ancien/photo`, { cookie: client })).statut).toBe(403)
    expect((await appel('POST', E, { cookie: coach, origine: null, corps: { nom: 'X' } })).json).toEqual({ erreur: 'origine_refusee' })
  })
})

describe('création, lecture, patch', () => {
  it('ligne héritée lisible avec valeurs par défaut', async () => {
    const r = await appel('GET', `${E}/ex-ancien`, { cookie: coach })
    expect(r.json.item).toMatchObject({ id: 'ex-ancien', nom: 'Ancien', categories: ['jambes'], photo: null, video: null, utiliseDans: 1, utiliseDansProgrammes: 1 })
  })
  it('POST : 201, id généré, champs conservés, lien rattaché à la bibliothèque (validé : saisi par le coach)', async () => {
    const r = await appel('POST', E, { cookie: coach, corps: { nom: 'Squat gobelet', categorie: 'Renforcement', musclesPrincipaux: ['jambes'], materiel: ['Haltères'], niveau: 'debutant', tempo: '3-1-1', reposConseille: 60, notesPrivees: 'genou', lienVideo: 'https://youtu.be/mKREc_xl_j8' } })
    expect(r.statut).toBe(201)
    expect(r.json.item).toMatchObject({ id: 'ex-squat-gobelet', categories: [], lienVideo: LIEN, notesPrivees: 'genou', reposConseille: 60, utiliseDans: 0, version: 1, video: { url: LIEN, statut: 'valide', titre: null, chaine: null, duree: null } })
    expect(biblio.chercher('Squat gobelet')).toHaveLength(1)
  })
  it('POST : 409 si id existe, 400 si invalide (nom manquant, clé inconnue, champ calculé)', async () => {
    expect((await appel('POST', E, { cookie: coach, corps: { id: 'ex-ancien', nom: 'Z' } })).json).toEqual({ erreur: 'existe_deja' })
    for (const corps of [{ description: 'x' }, { nom: 'A', zzz: 1 }, { nom: 'A', utiliseDans: 3 }, { nom: 'A', niveau: 'dieu' }, { nom: 'A', lienVideo: 'https://vimeo.com/1' }, { id: '../x', nom: 'A' }])
      expect((await appel('POST', E, { cookie: coach, corps })).json).toEqual({ erreur: 'invalide' })
  })
  it('PATCH : fusion, "" efface, calculés refusés, 404', async () => {
    const r = await appel('PATCH', `${E}/ex-squat-gobelet`, { cookie: coach, corps: { tempo: '', niveau: 'confirme', consignes: 'Dos droit' } })
    expect(r.statut).toBe(200)
    expect(r.json.item).toMatchObject({ niveau: 'confirme', consignes: 'Dos droit', reposConseille: 60 })
    expect(r.json.item).not.toHaveProperty('tempo')
    for (const corps of [{ photo: null }, { video: null }, { utiliseDansProgrammes: 1 }, { reposConseille: 9999 }]) expect((await appel('PATCH', `${E}/ex-squat-gobelet`, { cookie: coach, corps })).statut).toBe(400)
    expect((await appel('PATCH', `${E}/inconnu`, { cookie: coach, corps: { tempo: '1' } })).json).toEqual({ erreur: 'introuvable' })
    expect((await appel('GET', `${E}/inconnu`, { cookie: coach })).statut).toBe(404)
  })
  it('PUT générique : accepte une ligne héritée, refuse une valeur invalide, garde la photo', async () => {
    const put = (corps) => appel('PUT', '/api/app/e/exercices/ex-ancien', { cookie: coach, corps })
    expect((await put({ id: 'ex-ancien', nom: 'Ancien', categories: [], lienVideo: null, video: { x: 1 }, utiliseDans: 9 })).statut).toBe(200)
    expect((await put({ id: 'ex-ancien', nom: 'Ancien', categories: [], niveau: 'dieu' })).statut).toBe(400)
    expect((await store.un('exercices', 'ex-ancien')).utiliseDans).toBeUndefined()
  })
})

describe('liste et filtres', () => {
  it('forme { items, total }, tri par nom, filtres, pagination', async () => {
    const tout = (await appel('GET', E, { cookie: coach })).json
    expect(tout.total).toBe(2); expect(tout.items.map((e) => e.nom)).toEqual(['Ancien', 'Squat gobelet'])
    const f = async (q) => (await appel('GET', `${E}?${q}`, { cookie: coach })).json
    expect((await f('q=GOBELET')).items).toHaveLength(1)
    expect((await f('muscle=jambes&materiel=haltères&niveau=confirme')).total).toBe(1)
    expect((await f('video=valide')).total).toBe(1); expect((await f('video=propose')).total).toBe(0); expect((await f('video=aucune')).total).toBe(1)
    expect(await f('limite=1&decalage=1')).toMatchObject({ total: 2, items: [{ nom: 'Squat gobelet' }] })
    for (const q of ['niveau=x', 'video=x', 'limite=0', 'limite=501', 'decalage=-1']) expect((await appel('GET', `${E}?${q}`, { cookie: coach })).statut).toBe(400)
  })
})

describe('vue client : pas de notes privées ni d\'usage', () => {
  it('liste, détail, et routes génériques', async () => {
    const v = (o) => { for (const k of ['notesPrivees', 'utiliseDans', 'utiliseDansProgrammes']) expect(o).not.toHaveProperty(k) }
    const l = (await appel('GET', E, { cookie: client })).json
    expect(l.total).toBe(2); l.items.forEach(v)
    const d = (await appel('GET', `${E}/ex-squat-gobelet`, { cookie: client })).json.item
    v(d); expect(d.consignes).toBe('Dos droit')
    v((await appel('GET', '/api/app/e/exercices/ex-squat-gobelet', { cookie: client })).json.item)
    ;(await appel('GET', '/api/app/e/exercices', { cookie: client })).json.items.forEach(v)
  })
})

describe('photo', () => {
  let url, premier
  it('refus : type, signature fausse, trop gros', async () => {
    const p = (brut, type) => appel('POST', `${E}/ex-squat-gobelet/photo`, { cookie: coach, brut, type })
    expect((await p(WEBP, 'image/gif')).json).toEqual({ erreur: 'type_refuse' })
    expect((await p(Buffer.from('<?php echo 1;'), 'image/webp')).json).toEqual({ erreur: 'type_refuse' })
    expect((await p(PNG, 'image/webp')).statut).toBe(415)
    expect((await p(Buffer.concat([WEBP, Buffer.alloc(3 * 1024 * 1024)]), 'image/webp')).statut).toBe(413)
    expect((await appel('POST', `${E}/inconnu/photo`, { cookie: coach, brut: WEBP, type: 'image/webp' })).statut).toBe(404)
    expect(existsSync(join(dossier, '_exercices')) ? readdirSync(join(dossier, '_exercices')) : []).toEqual([])
  })
  it('envoi : nom généré côté serveur, lecture par un client avec ETag/304', async () => {
    const r = await appel('POST', `${E}/ex-squat-gobelet/photo`, { cookie: coach, brut: WEBP, type: 'image/webp', entetes: { 'X-Nom': 'evil.php' } })
    expect(r.statut).toBe(200)
    premier = r.json.item.photo
    expect(premier.id).toMatch(/^p-[0-9a-f]{12}$/)
    expect(premier.url).toBe(`/api/app/fichiers?chemin=_exercices%2F${premier.id}.webp`)
    url = premier.url
    const g = await appel('GET', url, { cookie: client })
    expect(g.statut).toBe(200); expect(g.h.get('content-type')).toBe('image/webp'); expect(g.h.get('cache-control')).toBe('private, max-age=86400'); expect(g.buf.equals(WEBP)).toBe(true)
    const etag = g.h.get('etag')
    expect(etag).toBeTruthy()
    expect((await appel('GET', url, { cookie: client, entetes: { 'If-None-Match': etag } })).statut).toBe(304)
    expect((await appel('GET', url)).statut).toBe(401)
    expect((await appel('GET', `${E}/ex-squat-gobelet`, { cookie: client })).json.item.photo).toEqual(premier)
  })
  it('nouvelle photo : ancienne supprimée du disque ; PATCH/PUT ne l\'écrasent pas', async () => {
    const r = await appel('POST', `${E}/ex-squat-gobelet/photo`, { cookie: coach, brut: PNG, type: 'image/png' })
    expect(r.json.item.photo.url).toMatch(/\.png$/)
    expect(readdirSync(join(dossier, '_exercices'))).toEqual([`${r.json.item.photo.id}.png`])
    expect((await appel('GET', premier.url, { cookie: coach })).statut).toBe(404)
    expect((await appel('PATCH', `${E}/ex-squat-gobelet`, { cookie: coach, corps: { tempo: '2-0-2' } })).json.item.photo.id).toBe(r.json.item.photo.id)
    const ancien = (await store.un('exercices', 'ex-squat-gobelet'))
    const { photo: _, ...sans } = ancien
    expect((await appel('PUT', '/api/app/e/exercices/ex-squat-gobelet', { cookie: coach, corps: sans })).statut).toBe(200)
    expect((await store.un('exercices', 'ex-squat-gobelet')).photo.id).toBe(r.json.item.photo.id)
  })
  it('fichiers/exercices : écriture refusée par la route générique ; chemin invalide', async () => {
    expect((await appel('POST', '/api/app/fichiers?chemin=_exercices%2Fp-aaaaaaaaaaaa.webp', { cookie: coach, brut: WEBP, type: 'image/webp' })).statut).toBe(403)
    expect((await appel('GET', '/api/app/fichiers?chemin=_exercices%2F..%2Fx.webp', { cookie: client })).statut).toBe(400)
  })
  it('DELETE photo puis suppression de l\'exercice : fichiers retirés', async () => {
    const r = await appel('DELETE', `${E}/ex-squat-gobelet/photo`, { cookie: coach })
    expect(r.json.item.photo).toBeNull(); expect(readdirSync(join(dossier, '_exercices'))).toEqual([])
    expect((await appel('DELETE', `${E}/ex-squat-gobelet/photo`, { cookie: coach })).statut).toBe(200)
    await appel('POST', `${E}/ex-squat-gobelet/photo`, { cookie: coach, brut: WEBP, type: 'image/webp' })
    expect((await appel('DELETE', '/api/app/e/exercices/ex-squat-gobelet', { cookie: coach })).statut).toBe(200)
    expect(readdirSync(join(dossier, '_exercices'))).toEqual([])
  })
})
