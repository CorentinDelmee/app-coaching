// API de l'app /api/app/* : sessions, règles d'accès (policies RLS), CSRF, relais réservations, fichiers, agenda.
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAppHttp, hacherCode, ipReelle, cheminFichier, signerSession, QUOTAS } from '../src/app-http.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'
import { creerServeurRest } from '../src/rest.js'
import { VERSION_CONSENTEMENT } from '../../src/domain/consentement.js'
import { lireConfig, variablesManquantes } from '../src/config.js'

const ORIGINE = 'https://app.exemple.fr'
const SECRET = 's'.repeat(40)
const PROXY = 'p'.repeat(40)
const journalApp = []
const profilClient = (id, identifiant) => ({ id, role: 'client', identifiant, nom: identifiant, tarif: 40, lieuDefaut: 'domicile', modules: { calories: false }, archive: false, creeLe: 1, consentementLe: 1, preferences: { consentement: { version: VERSION_CONSENTEMENT, sante: true } } })
let base, serveur, resa, resaRecu, resaPanne = false, db, dossier, agendaReponse = null

async function appel(methode, chemin, { corps, cookie, origine = ORIGINE, brut, type, entetes = {} } = {}) {
  const headers = { ...entetes }
  if (origine && methode !== 'GET') headers.Origin = origine
  if (cookie) headers.Cookie = cookie
  let body
  if (brut) { body = brut; headers['Content-Type'] = type } else if (corps !== undefined) { body = JSON.stringify(corps); headers['Content-Type'] = 'application/json' }
  const r = await fetch(base + chemin, { method: methode, headers, body })
  const texte = await r.text()
  let json = null
  try { json = JSON.parse(texte) } catch { /* binaire */ }
  return { statut: r.status, json, texte, cookie: (r.headers.get('set-cookie') || '').split(';')[0], setCookie: r.headers.get('set-cookie') || '' }
}
const connecter = async (identifiant, code, ip, cle = PROXY) => (await appel('POST', '/api/app/connexion', { corps: { identifiant, code }, entetes: ip ? { 'X-Forwarded-For': ip, 'X-Proxy-Cle': cle } : {} }))

let coach, clientA, clientB
beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'app-http-'))
  db = ouvrirBase(':memory:')
  const store = creerStoreSqlite(db)
  await store.ecrire('profils', { id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Coach', archive: false, creeLe: 1 })
  await store.ecrire('profils', profilClient('pa', 'alice'))
  await store.ecrire('profils', profilClient('pb', 'bob'))
  for (const [i, r, p] of [['coach', 'coach', 'pc'], ['alice', 'client', 'pa'], ['bob', 'client', 'pb']]) {
    db.prepare('INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, ?, ?)').run(i, await hacherCode('code-secret-123'), r, p)
  }
  // Une ligne de B dans chaque entité à client_id.
  await store.ecrire('mesures', { id: 'mb', clientId: 'pb', date: 1, poids: 80 })
  db.prepare("INSERT INTO seances_agenda (id, client_id, statut_attribution, data) VALUES ('ea', 'pa', 'attribue', '{\"id\":\"ea\"}'), ('eb', 'pb', 'attribue', '{\"id\":\"eb\"}')").run()
  db.prepare('UPDATE agenda_synchro SET derniere_synchro = ? WHERE id = 1').run(Date.UTC(2026, 10, 2, 19))

  // Faux service de réservation : enregistre les en-têtes reçus.
  resa = createServer((req, res) => {
    resaRecu = { url: req.url, methode: req.method, headers: req.headers }
    if (resaPanne) { res.writeHead(500); return res.end('{}') }
    if (req.url.startsWith('/api/resa/admin/evenements?')) {
      const [statut, corps] = agendaReponse ?? [200, { evenements: [{ id: 'g1', titre: 'Coaching Alice et Bob', debut: '2026-11-20T10:00:00+01:00', fin: '2026-11-20T11:00:00+01:00', journee: false, lieu: '', annule: false, maj: null }, { id: 'g2', titre: 'Coaching Zoé', debut: '2026-11-21T10:00:00+01:00', fin: '2026-11-21T11:00:00+01:00', journee: false, lieu: '', annule: false, maj: null }] }]
      res.writeHead(statut, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(corps))
    }
    res.writeHead(req.url.startsWith('/api/resa/admin/blocages') && req.method === 'POST' ? 201 : 200, { 'Content-Type': 'application/json' })
    res.end(req.url.startsWith('/api/resa/admin/reservations?') ? '{"reservations":[{"id":"r1","synchro_etat":"cree"}]}' : '{"ok":true}')
  })
  await new Promise((r) => resa.listen(0, '127.0.0.1', r))

  const config = { ...lireConfig({}), sessionSecret: SECRET, appOrigin: ORIGINE, resaUrl: `http://127.0.0.1:${resa.address().port}`, resaCle: 'k'.repeat(40), fichiersDir: dossier, proxyCle: PROXY }
  const appHttp = creerAppHttp({ db, store, config, journal: { ecrire: (l) => journalApp.push(l) } })
  serveur = creerServeurRest({ config, appHttp, outils: {}, journal: { ecrire() {} }, service: {}, biblio: {} })
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${serveur.address().port}`
  coach = (await connecter('coach', 'code-secret-123', '10.0.0.1')).cookie
  clientA = (await connecter('alice', 'code-secret-123', '10.0.0.2')).cookie
  clientB = (await connecter('bob', 'code-secret-123', '10.0.0.3')).cookie
})
afterAll(() => { serveur?.close(); resa?.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('session', () => {
  it('connexion : forme du contrat, cookie HttpOnly SameSite=Strict, « rester connecté » par défaut (30 jours)', async () => {
    const r = await connecter('alice', 'code-secret-123', '10.0.1.1')
    expect(r.statut).toBe(200)
    expect(r.json).toEqual({ utilisateur: { id: 'pa', identifiant: 'alice', role: 'client', profil_id: 'pa' } })
    expect(r.setCookie).toMatch(/HttpOnly/); expect(r.setCookie).toMatch(/SameSite=Strict/); expect(r.setCookie).toMatch(/Max-Age=2592000/)
    const moi = await appel('GET', '/api/app/moi', { cookie: r.cookie })
    expect(moi.json).toEqual({ utilisateur: { id: 'pa', identifiant: 'alice', role: 'client', profil_id: 'pa' } }) // ni compte ni session exposés
    expect(moi.setCookie).toBe('') // session neuve : pas de renouvellement
  })
  it('resterConnecte: false : cookie de navigateur (sans Max-Age), 12 h côté serveur, jamais prolongé', async () => {
    const r = await appel('POST', '/api/app/connexion', { corps: { identifiant: 'alice', code: 'code-secret-123', resterConnecte: false }, entetes: { 'X-Forwarded-For': '10.0.1.1', 'X-Proxy-Cle': PROXY } })
    expect(r.statut).toBe(200)
    expect(r.setCookie).not.toMatch(/Max-Age/)
    expect((await appel('GET', '/api/app/moi', { cookie: r.cookie })).statut).toBe(200)
    const vieille = `sid=${encodeURIComponent(signerSession('alice', 0, SECRET, Date.now() - 11 * 3600e3))}`
    const m = await appel('GET', '/api/app/moi', { cookie: vieille })
    expect(m.statut).toBe(200); expect(m.setCookie).toBe('')
    expect((await appel('GET', '/api/app/moi', { cookie: `sid=${encodeURIComponent(signerSession('alice', 0, SECRET, Date.now() - 13 * 3600e3))}` })).statut).toBe(401)
  })
  it('session longue : prolongée à l\'usage après 1 jour, expirée après 30 jours sans usage, « L » non falsifiable', async () => {
    const jour = 864e5
    const ancienne = `sid=${encodeURIComponent(signerSession('alice', 0, SECRET, Date.now() - 2 * jour, true))}`
    const m = await appel('GET', '/api/app/moi', { cookie: ancienne })
    expect(m.statut).toBe(200)
    expect(m.setCookie).toMatch(/Max-Age=2592000/)
    expect(m.cookie).not.toBe(ancienne)
    expect((await appel('GET', '/api/app/moi', { cookie: m.cookie })).statut).toBe(200)
    expect((await appel('GET', '/api/app/moi', { cookie: `sid=${encodeURIComponent(signerSession('alice', 0, SECRET, Date.now() - 31 * jour, true))}` })).statut).toBe(401)
    // Transformer une session courte en longue (ajouter « L ») casse la signature.
    const courte = signerSession('alice', 0, SECRET).split('.')
    expect(courte[courte.length - 2].startsWith('L')).toBe(false)
    courte[courte.length - 2] = `L${Date.now() + 29 * jour}`
    expect((await appel('GET', '/api/app/moi', { cookie: `sid=${encodeURIComponent(courte.join('.'))}` })).statut).toBe(401)
  })
  it('mauvais code : 401 générique ; sans cookie : 401', async () => {
    expect((await connecter('alice', 'faux', '10.0.1.2')).json).toEqual({ erreur: 'identifiants' })
    expect((await connecter('inconnu', 'faux', '10.0.1.2')).json).toEqual({ erreur: 'identifiants' })
    expect((await appel('GET', '/api/app/moi')).statut).toBe(401)
  })
  it('cookie falsifié refusé', async () => {
    const faux = `sid=${encodeURIComponent(signerSession('coach', 0, 'x'.repeat(40)))}`
    expect((await appel('GET', '/api/app/moi', { cookie: faux })).statut).toBe(401)
    const modifie = clientA.replace('alice', 'coach')
    expect((await appel('GET', '/api/app/moi', { cookie: modifie })).statut).toBe(401)
  })
  it('limite 5 essais / 15 min par IP réelle + identifiant (X-Forwarded-For : dernière valeur)', async () => {
    for (let i = 0; i < 5; i++) expect((await connecter('bob', 'faux', '1.1.1.1, 10.9.9.9')).statut).toBe(401)
    expect((await connecter('bob', 'code-secret-123', '2.2.2.2, 10.9.9.9')).statut).toBe(429)
    expect((await connecter('bob', 'code-secret-123', '10.9.9.8')).statut).toBe(200) // autre IP réelle : pas bloquée
  })
  it('IP réelle : X-Forwarded-For cru seulement avec X-Proxy-Cle = PROXY_KEY', () => {
    const req = (cle) => ({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', ...(cle ? { 'x-proxy-cle': cle } : {}) }, socket: { remoteAddress: '127.0.0.1' } })
    expect(ipReelle(req(PROXY), PROXY)).toBe('5.6.7.8')
    expect(ipReelle(req(), PROXY)).toBe('127.0.0.1')
    expect(ipReelle(req('faux'), PROXY)).toBe('127.0.0.1')
    expect(ipReelle(req('court'), 'court')).toBe('127.0.0.1') // clé < 32 car. : jamais crue
  })
  it('X-Forwarded-For forgé sans la clé du proxy : toujours bloqué au 6e essai', async () => {
    for (let i = 0; i < 5; i++) expect((await connecter('dan', 'faux', `7.7.7.${i}`, 'mauvaise-cle')).statut).toBe(401)
    expect((await connecter('dan', 'faux', '7.7.7.99', 'mauvaise-cle')).statut).toBe(429)
  })
  it('seuls les échecs comptent ; succès = remise à zéro ; échecs journalisés sans IP ni code', async () => {
    for (let i = 0; i < 7; i++) expect((await connecter('alice', 'code-secret-123', '10.4.4.4')).statut).toBe(200)
    for (let i = 0; i < 4; i++) await connecter('alice', 'faux-code-xyz', '10.4.4.5')
    expect((await connecter('alice', 'code-secret-123', '10.4.4.5')).statut).toBe(200)
    for (let i = 0; i < 4; i++) expect((await connecter('alice', 'faux-code-xyz', '10.4.4.5')).statut).toBe(401) // compteur remis à zéro
    const l = journalApp.at(-1)
    expect(l).toMatchObject({ outil: 'connexion', ok: false })
    expect(l.resultat.compte).toMatch(/^[0-9a-f]{12}$/)
    expect(JSON.stringify(journalApp)).not.toMatch(/10\.4\.4|faux-code|alice/)
  })
  it('attaque distribuée : 60 IP inconnues échouent -> IP connue + bon code passe, IP inconnue reste en 429', { timeout: 30000 }, async () => { // 60 hachages scrypt : lent quand la machine est chargée
    expect((await connecter('coach', 'code-secret-123', '10.8.8.8')).statut).toBe(200) // IP connue
    for (let i = 0; i < 60; i++) await connecter('coach', 'faux', `198.51.100.${i}`)
    expect((await connecter('coach', 'code-secret-123', '198.51.100.200')).statut).toBe(429)
    expect((await connecter('coach', 'code-secret-123', '10.8.8.8')).statut).toBe(200)
    expect(JSON.stringify(db.prepare('SELECT * FROM ips_connues').all())).not.toMatch(/10\.8\.8\.8/) // IP jamais en clair
  })
  it('corps null ou %xx mal formé : 400', async () => {
    const r = await fetch(base + '/api/app/connexion', { method: 'POST', headers: { Origin: ORIGINE, 'Content-Type': 'application/json' }, body: 'null' })
    expect(r.status).toBe(400)
    expect((await appel('GET', '/api/app/e/mesures/%E0%A4%A', { cookie: coach })).statut).toBe(400)
  })
  it('le limiteur global de 120/min ne s\'applique pas à /api/app', async () => {
    const rs = await Promise.all(Array.from({ length: 130 }, () => appel('GET', '/api/app/moi', { cookie: coach })))
    expect(rs.every((r) => r.statut === 200)).toBe(true)
  })
  it('déconnexion et changement de code révoquent les sessions', async () => {
    const c1 = (await connecter('alice', 'code-secret-123', '10.0.2.1')).cookie
    const c2 = (await connecter('alice', 'code-secret-123', '10.0.2.1')).cookie
    const r = await appel('POST', '/api/app/code', { cookie: c1, corps: { ancien: 'code-secret-123', nouveau: 'nouveau-code-456' } })
    expect(r.json).toEqual({ ok: true })
    expect((await appel('GET', '/api/app/moi', { cookie: c2 })).statut).toBe(401)
    expect((await appel('GET', '/api/app/moi', { cookie: r.cookie })).statut).toBe(200)
    await appel('POST', '/api/app/deconnexion', { cookie: r.cookie })
    expect((await appel('GET', '/api/app/moi', { cookie: r.cookie })).statut).toBe(401)
    expect((await appel('POST', '/api/app/comptes/alice/code', { cookie: coach, corps: { code: 'code-secret-123' } })).json).toEqual({ ok: true })
    clientA = (await connecter('alice', 'code-secret-123', '10.0.2.2')).cookie
  })
  it('comptes : coach seulement, 201 {id}', async () => {
    const corps = { identifiant: 'carla', code: 'code-carla-1', profil: profilClient('pcarla', 'carla') }
    expect((await appel('POST', '/api/app/comptes', { cookie: clientA, corps })).statut).toBe(403)
    const r = await appel('POST', '/api/app/comptes', { cookie: coach, corps })
    expect(r.statut).toBe(201); expect(r.json).toEqual({ id: 'pcarla' })
    expect((await connecter('carla', 'code-carla-1', '10.0.3.1')).statut).toBe(200)
    expect((await appel('POST', '/api/app/comptes', { cookie: coach, corps })).statut).toBe(409)
  })
})

describe('CSRF et taille', () => {
  it('non-GET sans Origin ou avec une autre Origin : 403', async () => {
    expect((await appel('POST', '/api/app/connexion', { origine: null, corps: { identifiant: 'alice', code: 'x' } })).statut).toBe(403)
    expect((await appel('PUT', '/api/app/e/mesures/m1', { cookie: clientA, origine: 'https://pirate.fr', corps: { id: 'm1', clientId: 'pa', date: 1 } })).statut).toBe(403)
  })
  it('corps JSON > 1 Mo : 413', async () => {
    const r = await appel('PUT', '/api/app/e/mesures/m1', { cookie: clientA, corps: { id: 'm1', clientId: 'pa', x: 'a'.repeat(1100000) } }).catch(() => ({ statut: 413 }))
    expect(r.statut).toBe(413)
  })
})

describe('entités (policies RLS)', () => {
  it('entité inconnue : 404 ; liste blanche', async () => {
    expect((await appel('GET', '/api/app/e/comptes', { cookie: coach })).statut).toBe(404)
  })
  it('le client A ne lit ni n\'écrit les lignes de B, pour chaque entité à client_id', async () => {
    const PROPRES = ['realisations', 'reponses', 'mesures', 'douleurs', 'nutrition', 'workouts', 'programmes', 'seancesCoaching', 'motsDuCoach', 'questionnaires']
    for (const e of PROPRES) {
      const liste = await appel('GET', `/api/app/e/${e}`, { cookie: clientA })
      expect(liste.statut).toBe(200)
      expect(liste.json.items.every((o) => !o.clientId || o.clientId === 'pa')).toBe(true)
      const w = await appel('PUT', `/api/app/e/${e}/x-${e}`, { cookie: clientA, corps: { id: `x-${e}`, clientId: 'pb' } })
      expect([400, 403]).toContain(w.statut)
    }
    expect((await appel('GET', '/api/app/e/templates/pb', { cookie: clientA })).statut).toBe(404)
    expect((await appel('GET', '/api/app/e/mesures/mb', { cookie: clientA })).statut).toBe(404)
    expect((await appel('GET', '/api/app/e/mesures', { cookie: clientA })).json.items).toEqual([])
    expect((await appel('DELETE', '/api/app/e/mesures/mb', { cookie: clientA })).statut).toBe(403)
    expect((await appel('GET', '/api/app/e/mesures/mb', { cookie: clientB })).json.item.poids).toBe(80)
    expect((await appel('GET', '/api/app/e/profils', { cookie: clientA })).json.items.map((p) => p.id)).toEqual(['pa'])
  })
  it('les notes du coach sur un programme ne sont jamais renvoyées au client (le coach les voit)', async () => {
    await appel('PUT', '/api/app/e/programmes/prog-pa', { cookie: coach, corps: { id: 'prog-pa', clientId: 'pa', nom: 'P', mode: 'parSemaine', debut: '2026-11-02', semaines: [[]], notes: 'note privée du coach' } })
    const l = await appel('GET', '/api/app/e/programmes', { cookie: clientA })
    expect(l.json.items.map((p) => p.id)).toEqual(['prog-pa'])
    expect(JSON.stringify(l.json)).not.toContain('note privée')
    expect(JSON.stringify((await appel('GET', '/api/app/e/programmes/prog-pa', { cookie: clientA })).json)).not.toContain('note privée')
    expect((await appel('GET', '/api/app/e/programmes/prog-pa', { cookie: coach })).json.item.notes).toBe('note privée du coach')
    await appel('DELETE', '/api/app/e/programmes/prog-pa', { cookie: coach })
  })
  it('un client sans consentement santé ne peut pas écrire de données de santé (403)', async () => {
    const st = creerStoreSqlite(db)
    const refus = profilClient('pb', 'bob'); refus.preferences = { consentement: { version: VERSION_CONSENTEMENT, sante: false } }
    await st.ecrire('profils', refus)
    try {
      for (const e of ['reponses', 'mesures', 'douleurs', 'nutrition']) {
        const r = await appel('PUT', `/api/app/e/${e}/z-${e}`, { cookie: clientB, corps: { id: `z-${e}`, clientId: 'pb', date: '2026-11-01', poids: 70, zone: 'dos', intensite: 2, questionnaireId: 'q', frequence: 'quotidien', valeurs: {} } })
        expect(r.statut).toBe(403); expect(r.json).toEqual({ erreur: 'consentement_sante' })
      }
    } finally { await st.ecrire('profils', profilClient('pb', 'bob')) }
  })
  it('le client ne réattribue pas une ligne de B à lui-même', async () => {
    const r = await appel('PUT', '/api/app/e/mesures/mb', { cookie: clientA, corps: { id: 'mb', clientId: 'pa', date: '2026-11-01', poids: 1 } })
    expect(r.statut).toBe(403)
  })
  it('le client écrit ses lignes (forme {item}) mais pas les entités du coach', async () => {
    const m = { id: 'ma', clientId: 'pa', date: '2026-11-02', poids: 70 }
    const r = await appel('PUT', '/api/app/e/mesures/ma', { cookie: clientA, corps: m })
    expect(r.statut).toBe(200); expect(r.json).toEqual({ item: m })
    expect((await appel('DELETE', '/api/app/e/mesures/ma', { cookie: clientA })).json).toEqual({ ok: true })
    expect((await appel('PUT', '/api/app/e/exercices/e1', { cookie: clientA, corps: { id: 'e1', nom: 'Squat', categories: [] } })).statut).toBe(403)
  })
  it('le client ne change ni rôle, ni tarif, ni modules ; il peut changer ses préférences', async () => {
    const p = profilClient('pa', 'alice')
    for (const modif of [{ role: 'coach' }, { tarif: 0 }, { modules: { calories: true } }, { archive: true }]) {
      expect((await appel('PUT', '/api/app/e/profils/pa', { cookie: clientA, corps: { ...p, ...modif } })).statut).toBe(403)
    }
    expect((await appel('PUT', '/api/app/e/profils/pa', { cookie: clientA, corps: { ...p, preferences: { ...p.preferences, theme: 'sombre' } } })).statut).toBe(200)
    expect((await appel('PUT', '/api/app/e/profils/pb', { cookie: clientA, corps: profilClient('pb', 'bob') })).statut).toBe(403)
  })
  it('alertesVues : coach seulement', async () => {
    expect((await appel('GET', '/api/app/e/alertesVues', { cookie: clientA })).statut).toBe(403)
    expect((await appel('GET', '/api/app/e/alertesVues', { cookie: coach })).statut).toBe(200)
  })
  it('quotas : 413 quota au-delà des lignes par client et de 64 Ko par ligne (coach compris)', async () => {
    const avant = QUOTAS.lignes
    QUOTAS.lignes = 1
    try {
      expect((await appel('PUT', '/api/app/e/douleurs/d1', { cookie: clientA, corps: { id: 'd1', clientId: 'pa', zone: 'dos', intensite: 2, date: '2026-11-01' } })).statut).toBe(200)
      const r = await appel('PUT', '/api/app/e/douleurs/d2', { cookie: clientA, corps: { id: 'd2', clientId: 'pa', zone: 'dos', intensite: 2, date: '2026-11-01' } })
      expect(r.statut).toBe(413); expect(r.json).toEqual({ erreur: 'quota' })
      expect((await appel('PUT', '/api/app/e/douleurs/d1', { cookie: clientA, corps: { id: 'd1', clientId: 'pa', zone: 'genou', intensite: 3, date: '2026-11-01' } })).statut).toBe(200) // mise à jour permise
      expect((await appel('PUT', '/api/app/e/douleurs/d3', { cookie: coach, corps: { id: 'd3', clientId: 'pa', zone: 'dos', intensite: 2, date: '2026-11-01' } })).statut).toBe(200) // coach exempté
    } finally { QUOTAS.lignes = avant }
    const gros = { id: 'e2', nom: 'x', categories: [], description: 'a'.repeat(70 * 1024) }
    expect((await appel('PUT', '/api/app/e/exercices/e2', { cookie: coach, corps: gros })).statut).toBe(413)
  })
  it('coach : changer le rôle d\'un profil est refusé (le compte porte le rôle)', async () => {
    expect((await appel('PUT', '/api/app/e/profils/pb', { cookie: coach, corps: { ...profilClient('pb', 'bob'), role: 'coach' } })).statut).toBe(400)
  })
  it('le coach lit et écrit tout', async () => {
    expect((await appel('GET', '/api/app/e/mesures/mb', { cookie: coach })).statut).toBe(200)
    expect((await appel('PUT', '/api/app/e/exercices/e1', { cookie: coach, corps: { id: 'e1', nom: 'Squat', categories: [] } })).statut).toBe(200)
  })
})

describe('relais réservations', () => {
  it('coach : corps renvoyé tel quel, clé envoyée, aucun en-tête de proxy transmis', async () => {
    const r = await appel('GET', '/api/app/reservations?statut=a_venir', { cookie: coach, entetes: { 'X-Forwarded-For': '9.9.9.9', 'X-Real-IP': '9.9.9.9', Forwarded: 'for=9.9.9.9' } })
    expect(r.statut).toBe(200)
    expect(r.texte).toBe('{"reservations":[{"id":"r1","synchro_etat":"cree"}]}')
    expect(resaRecu.url).toBe('/api/resa/admin/reservations?statut=a_venir')
    expect(resaRecu.headers['x-resa-admin-key']).toBe('k'.repeat(40))
    for (const h of ['x-forwarded-for', 'x-real-ip', 'forwarded', 'cookie']) expect(resaRecu.headers[h]).toBeUndefined()
    const b = await appel('POST', '/api/app/reservations/blocages', { cookie: coach, corps: { debut: 'a', fin: 'b', motif: 'c' } })
    expect(b.statut).toBe(201); expect(resaRecu.url).toBe('/api/resa/admin/blocages')
    await appel('POST', '/api/app/reservations/r1/annuler', { cookie: coach })
    expect(resaRecu.url).toBe('/api/resa/admin/reservations/r1/annuler')
  })
  it('client : 403', async () => {
    expect((await appel('GET', '/api/app/reservations?statut=a_venir', { cookie: clientA })).statut).toBe(403)
  })
  it('API en panne ou injoignable : 502 reservation_indisponible', async () => {
    resaPanne = true
    const r = await appel('GET', '/api/app/reservations/regles', { cookie: coach })
    resaPanne = false
    expect(r.statut).toBe(502); expect(r.json).toEqual({ erreur: 'reservation_indisponible' })
  })
})

describe('agenda', () => {
  it('événements filtrés par client, dernière synchro', async () => {
    expect((await appel('GET', '/api/app/agenda/evenements', { cookie: clientA })).json).toEqual({ evenements: [{ id: 'ea', clientId: 'pa' }] })
    expect((await appel('GET', '/api/app/agenda/evenements', { cookie: coach })).json.evenements).toHaveLength(2)
    expect((await appel('GET', '/api/app/agenda/derniere-synchro', { cookie: coach })).json).toEqual({ derniereSynchro: '2026-11-02T19:00:00.000Z', bilan: null })
  })
  it('synchroniser, à attribuer, attribuer : coach seulement ; 503 « autorisation Google » relayé', async () => {
    for (const [m, r] of [['POST', 'synchroniser'], ['GET', 'a-attribuer'], ['POST', 'attribuer']]) expect((await appel(m, `/api/app/agenda/${r}`, { cookie: clientA, ...(m === "POST" ? { corps: {} } : {}) })).statut).toBe(403)
    const s = await appel('POST', '/api/app/agenda/synchroniser', { cookie: coach })
    expect(s.statut).toBe(200); expect(s.json.bilan).toMatchObject({ ok: true, evenements: 2, crees: 2, aAttribuer: 1 })
    expect(resaRecu.headers['x-resa-admin-key']).toBe('k'.repeat(40))
    // Le client voit sa séance en base (pas de doublon : le flux Google n'est plus fusionné côté app), sans le titre qui nomme Bob.
    expect((await appel('GET', '/api/app/e/seancesCoaching', { cookie: clientA })).json.items.map((x) => x.id)).toEqual(['google:g1:pa'])
    expect((await appel('GET', '/api/app/agenda/evenements', { cookie: clientA })).json.evenements.find((e) => e.id === 'g1').titre).toBeUndefined()
    const g = await appel('GET', '/api/app/agenda/a-attribuer', { cookie: coach })
    expect(g.json.groupes).toMatchObject([{ titre: 'Coaching Zoé', nb: 1, statut: 'inconnu' }])
    expect((await appel('POST', '/api/app/agenda/attribuer', { cookie: coach, corps: { titre: 'Coaching Zoé', clientIds: ['pc'] } })).json).toEqual({ erreur: 'client_inconnu' })
    const a = await appel('POST', '/api/app/agenda/attribuer', { cookie: coach, corps: { titre: 'Coaching Zoé', clientIds: ['pb'] } })
    expect(a.statut).toBe(200); expect(a.json.bilan).toMatchObject({ crees: 1, aAttribuer: 0 })
    agendaReponse = [503, { erreur: 'google_lecture_non_autorisee' }]
    try {
      const e = await appel('POST', '/api/app/agenda/synchroniser', { cookie: coach })
      expect(e.statut).toBe(503); expect(e.json).toEqual({ erreur: 'google_lecture_non_autorisee' })
      expect((await appel('GET', '/api/app/agenda/derniere-synchro', { cookie: coach })).json.bilan).toMatchObject({ ok: false, erreur: 'google_lecture_non_autorisee' })
    } finally { agendaReponse = null }
  })
})

describe('fichiers', () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)])
  it('quota de fichiers par client : 413', async () => {
    const avant = QUOTAS.fichiers
    QUOTAS.fichiers = 1
    try {
      expect((await appel('POST', '/api/app/fichiers?chemin=pb/q1.png', { cookie: clientB, brut: PNG, type: 'image/png' })).statut).toBe(201)
      expect((await appel('POST', '/api/app/fichiers?chemin=pb/q1.png', { cookie: clientB, brut: PNG, type: 'image/png' })).statut).toBe(201) // remplacement permis
      expect((await appel('POST', '/api/app/fichiers?chemin=pb/q2.png', { cookie: clientB, brut: PNG, type: 'image/png' })).json).toEqual({ erreur: 'quota' })
    } finally { QUOTAS.fichiers = avant }
  })
  it('chemins normalisés', () => {
    expect(cheminFichier('pa/photo.png')).toBeTruthy()
    for (const c of ['../pa/x.png', 'pa/../pb/x.png', '/pa/x.png', 'pa/x.exe', 'pa//x.png', 'pa/sub/x.png']) expect(cheminFichier(c)).toBeNull()
  })
  it('propriétaire : envoi, lecture, suppression ; autre client : 403 ; signature vérifiée', async () => {
    expect((await appel('POST', '/api/app/fichiers?chemin=pa/p1.png', { cookie: clientA, brut: PNG, type: 'image/png' })).statut).toBe(201)
    expect((await appel('GET', '/api/app/fichiers?chemin=pa/p1.png', { cookie: clientA })).statut).toBe(200)
    expect((await appel('GET', '/api/app/fichiers?chemin=pa/p1.png', { cookie: clientB })).statut).toBe(403)
    expect((await appel('GET', '/api/app/fichiers?chemin=pa/p1.png', { cookie: coach })).statut).toBe(200)
    expect((await appel('POST', '/api/app/fichiers?chemin=pa/p2.png', { cookie: clientA, brut: Buffer.from('<html>'), type: 'image/png' })).statut).toBe(415)
    expect((await appel('POST', '/api/app/fichiers?chemin=pb/p1.png', { cookie: clientA, brut: PNG, type: 'image/png' })).statut).toBe(403)
    expect((await appel('POST', '/api/app/fichiers?chemin=..%2Fx.png', { cookie: clientA, brut: PNG, type: 'image/png' })).statut).toBe(400)
    expect((await appel('DELETE', '/api/app/fichiers?chemin=pa/p1.png', { cookie: clientA })).json).toEqual({ ok: true })
    expect((await appel('GET', '/api/app/fichiers?chemin=pa/p1.png', { cookie: clientA })).statut).toBe(404)
  })
})

describe('démarrage en production', () => {
  it('cookie __Host-sid Secure en production', async () => {
    const config = { ...lireConfig({}), production: true, sessionSecret: SECRET, appOrigin: ORIGINE, fichiersDir: dossier, proxyCle: PROXY }
    const h = creerAppHttp({ db, store: creerStoreSqlite(db), config })
    const srv = createServer((req, res) => h(req, res))
    await new Promise((r) => srv.listen(0, '127.0.0.1', r))
    try {
      const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/app/connexion`, { method: 'POST', headers: { Origin: ORIGINE, 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiant: 'coach', code: 'code-secret-123' }) })
      const c = r.headers.get('set-cookie')
      expect(c).toMatch(/^__Host-sid=/); expect(c).toMatch(/; Secure/); expect(c).toMatch(/Path=\//); expect(c).not.toMatch(/Domain/i)
      const moi = await fetch(`http://127.0.0.1:${srv.address().port}/api/app/moi`, { headers: { Cookie: c.split(';')[0] } })
      expect(moi.status).toBe(200)
    } finally { srv.close() }
  })
  it('liste les variables manquantes', () => {
    expect(variablesManquantes({ NODE_ENV: 'development' })).toEqual([])
    expect(variablesManquantes({ NODE_ENV: 'production', SESSION_SECRET: 'court' })).toEqual(expect.arrayContaining(['DB_FILE', 'SESSION_SECRET', 'RESA_ADMIN_KEY', 'APP_ORIGIN', 'PROXY_KEY']))
  })
})
