// Correctifs de l'audit sécurité des exercices enrichis (I1, M1-M8).
import http from 'node:http'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
      const durees = [] // meilleur de 10 : mesure le coût de la requête, pas un pic de charge de la machine pendant les autres tests
      for (let i = 0; i < 10; i++) { const t = performance.now(); expect((await appel('GET', E + q, { cookie })).statut).toBe(200); durees.push(performance.now() - t) }
      expect(Math.min(...durees), q).toBeLessThan(20)
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

describe('N1 écritures concurrentes', () => {
  /** PATCH / PUT dont le corps arrive 300 ms après les en-têtes, pendant qu'une photo est envoyée. */
  const lent = (methode, chemin, corps) => new Promise((resolve) => {
    const txt = JSON.stringify(corps)
    const rq = http.request(base + chemin, { method: methode, headers: { Cookie: coach, Origin: ORIGINE, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(txt) } }, (r) => { r.resume(); r.on('end', () => resolve(r.statusCode)) })
    rq.flushHeaders(); setTimeout(() => rq.end(txt), 300)
  })
  for (const [nom, methode, chemin, corps] of [['PATCH', 'PATCH', `${E}/ex-n1`, { tempo: 'lent' }], ['PUT', 'PUT', '/api/app/e/exercices/ex-n1', { id: 'ex-n1', nom: 'N1', categories: [] }]]) {
    it(`${nom} lent croisé avec un envoi de photo : la photo courante reste en base et sur le disque`, async () => {
      await store.ecrire('exercices', { id: 'ex-n1', nom: 'N1', categories: [] })
      await appel('POST', `${E}/ex-n1/photo`, { cookie: coach, brut: WEBP, type: 'image/webp' })
      const p = lent(methode, chemin, corps)
      await new Promise((r) => setTimeout(r, 100))
      const nouvelle = (await appel('POST', `${E}/ex-n1/photo`, { cookie: coach, brut: WEBP, type: 'image/webp' })).json.item.photo.id
      expect(await p).toBe(200)
      const ex = await store.un('exercices', 'ex-n1')
      expect(ex.photo.id).toBe(nouvelle)
      expect(readdirSync(join(dossier, '_exercices')).filter((f) => f.startsWith(nouvelle))).toHaveLength(1)
    })
  }
  it('DELETE photo croisé avec un envoi : pas de fichier orphelin', async () => {
    await store.ecrire('exercices', { id: 'ex-n1', nom: 'N1', categories: [] })
    const reference = new Set((await store.tout('exercices')).filter((e) => e.photo).map((e) => e.photo.id))
    for (const f of readdirSync(join(dossier, '_exercices'))) if (!reference.has(f.replace(/\.\w+$/, ''))) rmSync(join(dossier, '_exercices', f), { force: true }) // restes des tests précédents
    await Promise.all([appel('DELETE', `${E}/ex-n1/photo`, { cookie: coach }), appel('POST', `${E}/ex-n1/photo`, { cookie: coach, brut: WEBP, type: 'image/webp' }), appel('DELETE', `${E}/ex-n1/photo`, { cookie: coach })])
    const ex = await store.un('exercices', 'ex-n1')
    const fichiers = readdirSync(join(dossier, '_exercices')).filter((f) => /^p-/.test(f))
    const attendus = (await store.tout('exercices')).filter((e) => e.photo).map((e) => e.photo.id)
    expect(fichiers.map((f) => f.replace(/\.\w+$/, '')).sort()).toEqual(attendus.sort())
    void ex
  })
})

describe('N2 / N4 propriétaires réservés et dossiers liés', () => {
  it('écrire ou lire dans l\'ancien « exercices » est refusé, même pour le coach', async () => {
    for (const m of ['POST', 'GET', 'DELETE']) {
      const r = await appel(m, '/api/app/fichiers?chemin=exercices%2Fp-aaaaaaaaaaaa.jpg', { cookie: coach, brut: m === 'POST' ? Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1]) : undefined, type: 'image/jpeg' })
      expect(r.statut, m).toBe(403)
    }
    expect((await appel('POST', '/api/app/fichiers?chemin=Exercices%2Fdoc.pdf', { cookie: coach, brut: Buffer.from('%PDF-1'), type: 'application/pdf' })).statut).toBe(403)
  })
  it('un dossier client qui est un lien vers un autre n\'est pas suivi', async () => {
    mkdirSync(join(dossier, 'pb'), { recursive: true })
    writeFileSync(join(dossier, 'pb', 'secret.jpg'), 'secret')
    symlinkSync(join(dossier, 'pb'), join(dossier, 'pa'))
    expect((await appel('GET', '/api/app/fichiers?chemin=pa%2Fsecret.jpg', { cookie: client })).statut).toBe(403)
    expect((await appel('GET', '/api/app/fichiers?chemin=pa%2Fsecret.jpg', { cookie: coach })).statut).toBe(403)
  })
})

describe('N2 / N3 / N4 migration', () => {
  const fabrique = async () => {
    const d = mkdtempSync(join(tmpdir(), 'exo-mig2-'))
    const db2 = ouvrirBase(':memory:'), st = creerStoreSqlite(db2)
    return { d, st, log: [], ecrireEx: (id, nom) => st.ecrire('exercices', { id, nom: 'X', categories: [], photo: { id: nom.replace(/\.\w+$/, ''), url: `/api/app/fichiers?chemin=exercices%2F${nom}` } }) }
  }
  it('ne déplace que les photos, sans écraser, un fichier à la fois ; URL réécrite dès que le fichier est en place ; erreurs journalisées', async () => {
    const { d, st, log, ecrireEx } = await fabrique()
    mkdirSync(join(d, 'exercices')); mkdirSync(join(d, '_exercices'))
    writeFileSync(join(d, 'exercices', 'p-aaaaaaaaaaaa.webp'), 'ancienne')
    writeFileSync(join(d, 'exercices', 'p-bbbbbbbbbbbb.webp'), 'b')
    writeFileSync(join(d, 'exercices', 'doc.pdf'), 'pdf')
    mkdirSync(join(d, 'exercices', 'sous'))
    writeFileSync(join(d, '_exercices', 'p-aaaaaaaaaaaa.webp'), 'vraie')
    await ecrireEx('a', 'p-aaaaaaaaaaaa.webp'); await ecrireEx('b', 'p-bbbbbbbbbbbb.webp'); await ecrireEx('c', 'p-cccccccccccc.webp')
    const { migrerPhotos } = await import('../src/app-http.js')
    await migrerPhotos({ store: st, fichiersDir: d, log: (...a) => log.push(a.join(' ')) })
    expect(readFileSync(join(d, '_exercices', 'p-aaaaaaaaaaaa.webp'), 'utf8')).toBe('vraie')
    expect(readdirSync(join(d, '_exercices')).sort()).toEqual(['p-aaaaaaaaaaaa.webp', 'p-bbbbbbbbbbbb.webp'])
    expect(existsSync(join(d, 'exercices', 'doc.pdf'))).toBe(true) // laissé en place, jamais rendu public
    expect((await st.un('exercices', 'b')).photo.url).toContain('_exercices%2F')
    expect((await st.un('exercices', 'c')).photo.url).toContain('chemin=exercices%2F') // fichier absent : non réécrite
    expect(log.length).toBeGreaterThanOrEqual(3)
    await migrerPhotos({ store: st, fichiersDir: d, log: () => {} }) // relance : va au bout sans rien casser
    rmSync(d, { recursive: true, force: true })
  })
  it('dossiers qui sont des liens symboliques : ignorés et journalisés', async () => {
    const { d, st, log, ecrireEx } = await fabrique()
    mkdirSync(join(d, 'pa'))
    writeFileSync(join(d, 'pa', 'p-aaaaaaaaaaaa.webp'), 'prive')
    symlinkSync(join(d, 'pa'), join(d, 'exercices'))
    await ecrireEx('a', 'p-aaaaaaaaaaaa.webp')
    const { migrerPhotos } = await import('../src/app-http.js')
    await migrerPhotos({ store: st, fichiersDir: d, log: (...a) => log.push(a.join(' ')) })
    expect(existsSync(join(d, '_exercices'))).toBe(false)
    expect(log.join()).toMatch(/lien symbolique/)
    rmSync(d, { recursive: true, force: true })
  })
})

describe('N5 filtres', () => {
  it('un paramètre de plus de 120 caractères : 400 ; 120 : accepté', async () => {
    for (const k of ['q', 'categorie', 'muscle', 'materiel']) {
      expect((await appel('GET', `${E}?${k}=${'a'.repeat(121)}`, { cookie: client })).statut, k).toBe(400)
      expect((await appel('GET', `${E}?${k}=${'a'.repeat(120)}`, { cookie: client })).statut, k).toBe(200)
    }
  })
})
