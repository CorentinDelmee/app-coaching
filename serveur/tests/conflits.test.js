// Concurrence optimiste (src/data/versions.js) : Claude écrit par les outils MCP pendant qu'un écran du coach est ouvert.
// Règle : l'écran envoie la version lue (If-Match) ; si la ligne a changé entre-temps -> 409 { erreur: 'conflit', actuel } et RIEN n'est écrasé.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assembler } from '../src/assembler.js'
import { hacherCode } from '../src/app-http.js'
import { lireConfig } from '../src/config.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'
import { appeler } from '../src/outils.js'
import { creerServeurRest } from '../src/rest.js'
import { creerStoreFichier } from '../src/store.js'

const ORIGINE = 'https://app.exemple.fr'
let app, serveur, base, dossier, coach
const outil = async (nom, args) => { const r = await appeler(app, nom, args, 'test'); if (!r.ok) throw new Error(`${nom} : ${r.message ?? r.code}`); return r.donnees }

async function appel(methode, chemin, { corps, version } = {}) {
  const headers = { Cookie: coach, Origin: ORIGINE }
  if (corps !== undefined) headers['Content-Type'] = 'application/json'
  if (version !== undefined) headers['If-Match'] = String(version)
  const r = await fetch(base + chemin, { method: methode, headers, body: corps === undefined ? undefined : JSON.stringify(corps) })
  return { statut: r.status, json: await r.json().catch(() => null) }
}
const lire = async (entite, id) => (await appel('GET', `/api/app/e/${entite}/${id}`)).json.item

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'conflits-'))
  const config = { ...lireConfig({ COACH_API_KEY: 'cle-de-test-0123456789abcdef-0123456789', DATA_DIR: dossier, DB_FILE: join(dossier, 'base.db'), SESSION_SECRET: 's'.repeat(40), APP_ORIGIN: ORIGINE, FICHIERS_DIR: join(dossier, 'f') }), youtubeCle: '' }
  app = await assembler(config, { now: () => Date.UTC(2026, 10, 5, 12) })
  const { api } = app.service
  await api.profils.creer({ id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Coach', archive: false, creeLe: 1 })
  await api.profils.creer({ id: 'alice', role: 'client', identifiant: 'alice', nom: 'Alice Durand', tarif: 35, lieuDefaut: 'domicile', modules: { habitudes: false }, archive: false, creeLe: 1 })
  app.backend.db.prepare("INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES ('coach', ?, 'coach', 'pc')").run(await hacherCode('code-secret-123'))
  serveur = creerServeurRest(app)
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${serveur.address().port}`
  const c = await fetch(`${base}/api/app/connexion`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGINE }, body: JSON.stringify({ identifiant: 'coach', code: 'code-secret-123' }) })
  coach = c.headers.get('set-cookie').split(';')[0]
})
afterAll(() => { serveur?.close(); app?.backend.db?.close(); rmSync(dossier, { recursive: true, force: true }) })

describe('outil MCP puis écran avec l\'ancienne version -> 409, rien d\'écrasé', () => {
  it('séance : ajouter_exercice par Claude, puis sauvegarde de l\'éditeur ouvert avant', async () => {
    const { seance } = await outil('creer_seance', { client: 'alice', nom: 'Bas du corps', blocs: [{ exercice: { nom: 'Squat', reps: 8 } }] })
    const ouverte = await lire('workouts', seance.id) // l'écran ouvre la séance
    expect(ouverte.version).toBe(1)
    await outil('ajouter_exercice', { seanceId: seance.id, exercice: { nom: 'Fente', reps: 10 } }) // Claude ajoute pendant ce temps
    const r = await appel('PUT', `/api/app/e/workouts/${seance.id}`, { corps: { ...ouverte, nom: 'Bas du corps (modifié)' }, version: ouverte.version })
    expect(r.statut).toBe(409)
    expect(r.json.erreur).toBe('conflit')
    expect(r.json.actuel).toMatchObject({ id: seance.id, version: 2, nom: 'Bas du corps' })
    expect(r.json.actuel.blocs).toHaveLength(2)
    const apres = await lire('workouts', seance.id)
    expect(apres.blocs).toHaveLength(2) // l'exercice ajouté par Claude est toujours là
    expect(apres.nom).toBe('Bas du corps')
    // Après « Recharger » (version 2), la sauvegarde passe et la version avance.
    const ok = await appel('PUT', `/api/app/e/workouts/${seance.id}`, { corps: { ...apres, nom: 'Bas du corps (modifié)' }, version: apres.version })
    expect(ok.statut).toBe(200)
    expect(ok.json.item).toMatchObject({ version: 3, nom: 'Bas du corps (modifié)' })
    expect(ok.json.item.blocs).toHaveLength(2)
  })

  it('écriture sans version (ancienne app, outils) : acceptée, la version avance quand même', async () => {
    const w = (await outil('lister_seances', { client: 'alice' })).seances[0]
    const avant = await lire('workouts', w.id)
    const r = await appel('PUT', `/api/app/e/workouts/${w.id}`, { corps: { ...avant, version: 1 } }) // `version` du corps ignorée
    expect(r.statut).toBe(200)
    expect(r.json.item.version).toBe(avant.version + 1)
  })

  it('programme : modifier_programme par Claude puis éditeur -> 409', async () => {
    const p = await outil('creer_programme', { client: 'alice', nom: 'Prépa', debut: '2026-11-02', semaines: [{ seances: [{ nom: 'S1', blocs: [{ exercice: { nom: 'Squat', reps: 5 } }] }] }] })
    const ouvert = await lire('programmes', p.id)
    await outil('modifier_programme', { programme: p.id, nom: 'Prépa été' })
    const r = await appel('PUT', `/api/app/e/programmes/${p.id}`, { corps: { ...ouvert, nom: 'Prépa hiver' }, version: ouvert.version })
    expect(r.statut).toBe(409)
    expect((await lire('programmes', p.id)).nom).toBe('Prépa été')
  })

  it('questionnaire : modifier_questionnaire par Claude puis éditeur -> 409', async () => {
    const q = await outil('creer_questionnaire', { nom: 'Bilan', frequence: 'ponctuel', questions: [{ libelle: 'Forme ?', type: 'curseur' }] })
    const ouvert = await lire('questionnaires', q.id)
    await outil('modifier_questionnaire', { id: q.id, nom: 'Bilan du mois' })
    const r = await appel('PUT', `/api/app/e/questionnaires/${q.id}`, { corps: { ...ouvert, nom: 'Autre' }, version: ouvert.version })
    expect(r.statut).toBe(409)
    expect((await lire('questionnaires', q.id)).nom).toBe('Bilan du mois')
  })

  it('profil : modifier_client par Claude puis fiche client -> 409', async () => {
    const ouvert = await lire('profils', 'alice')
    await outil('modifier_client', { client: 'alice', tarif: 40 })
    const r = await appel('PUT', '/api/app/e/profils/alice', { corps: { ...ouvert, nom: 'Alice D.' }, version: ouvert.version })
    expect(r.statut).toBe(409)
    expect(r.json.actuel.tarif).toBe(40)
    expect(await lire('profils', 'alice')).toMatchObject({ tarif: 40, nom: 'Alice Durand' })
  })

  it('exercice (PATCH) : modifier_exercice par Claude puis fiche Studio -> 409 avec l\'exercice présenté', async () => {
    const ouvert = (await appel('GET', '/api/app/exercices/ex-squat')).json.item
    expect(ouvert.version).toBeGreaterThanOrEqual(1)
    await outil('modifier_exercice', { exercice: 'ex-squat', consignes: 'Dos droit (Claude)' })
    const r = await appel('PATCH', '/api/app/exercices/ex-squat', { corps: { consignes: 'Talons au sol' }, version: ouvert.version })
    expect(r.statut).toBe(409)
    expect(r.json.actuel).toMatchObject({ id: 'ex-squat', consignes: 'Dos droit (Claude)', utiliseDans: expect.any(Number) })
    const ok = await appel('PATCH', '/api/app/exercices/ex-squat', { corps: { consignes: 'Talons au sol' }, version: r.json.actuel.version })
    expect(ok.statut).toBe(200)
    expect(ok.json.item.version).toBe(r.json.actuel.version + 1)
  })

  it('If-Match mal formé : 400', async () => {
    expect((await appel('PATCH', '/api/app/exercices/ex-squat', { corps: { tempo: '2-0-2' }, version: 'abc' })).statut).toBe(400)
  })
})

describe('liens vidéo : saisis par le coach = validés, posés par Claude = proposés', () => {
  it('rattacher_video (MCP) -> « propose » ; PATCH du coach avec un autre lien -> « valide »', async () => {
    await outil('rattacher_video', { exercice: 'Fente', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' })
    const id = (await appel('GET', '/api/app/exercices?q=Fente')).json.items[0].id
    expect((await appel('GET', `/api/app/exercices/${id}`)).json.item.video.statut).toBe('propose')
    const r = await appel('PATCH', `/api/app/exercices/${id}`, { corps: { lienVideo: 'https://youtu.be/bbbbbbbbbbb' } })
    expect(r.json.item.video).toMatchObject({ url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb', statut: 'valide' })
  })
  it('le coach renvoie le même lien (formulaire complet) : le statut ne change pas', async () => {
    await outil('rattacher_video', { exercice: 'Squat', url: 'https://www.youtube.com/watch?v=ccccccccccc' })
    const r = await appel('PATCH', '/api/app/exercices/ex-squat', { corps: { lienVideo: 'https://www.youtube.com/watch?v=ccccccccccc', tempo: '3-0-1' } })
    expect(r.json.item.video.statut).toBe('propose')
  })
})

describe('magasins', () => {
  it('migration : une base d\'avant les versions garde toutes ses lignes, en version 1', () => {
    const f = join(dossier, 'ancienne.db')
    const db = ouvrirBase(f)
    for (const t of ['profiles', 'exercices', 'workouts', 'programmes', 'questionnaires']) db.exec(`ALTER TABLE ${t} DROP COLUMN version`)
    db.exec('PRAGMA user_version = 2') // état « avant »
    db.prepare("INSERT INTO workouts (id, client_id, data) VALUES ('w-old', NULL, ?)").run(JSON.stringify({ id: 'w-old', nom: 'Ancienne', blocs: [] }))
    db.close()
    const db2 = ouvrirBase(f)
    expect(db2.prepare('PRAGMA user_version').get().user_version).toBe(3)
    expect(JSON.parse(db2.prepare("SELECT data FROM workouts WHERE id = 'w-old'").get().data)).toEqual({ id: 'w-old', nom: 'Ancienne', blocs: [] })
    expect(db2.prepare("SELECT version FROM workouts WHERE id = 'w-old'").get().version).toBe(1)
    db2.close()
  })

  it('SQLite : écriture avec une version périmée refusée (CONFLIT, actuel), ligne intacte ; entités non versionnées inchangées', async () => {
    const store = creerStoreSqlite(ouvrirBase(':memory:'))
    const v1 = await store.ecrire('exercices', { id: 'e1', nom: 'A', categories: [] })
    expect(v1.version).toBe(1)
    await store.ecrire('exercices', { ...v1, nom: 'B' }) // « en dessous », sans version
    await expect(store.ecrire('exercices', { ...v1, nom: 'C' }, { versionAttendue: 1 })).rejects.toMatchObject({ code: 'CONFLIT', actuel: { nom: 'B', version: 2 } })
    expect(await store.un('exercices', 'e1')).toEqual({ id: 'e1', nom: 'B', categories: [], version: 2 })
    expect(JSON.parse(store.db.prepare("SELECT data FROM exercices WHERE id = 'e1'").get().data)).not.toHaveProperty('version') // la colonne fait foi
    await store.ecrire('profils', { id: 'p1', role: 'coach', identifiant: 'c', nom: 'C', archive: false, creeLe: 1 })
    expect(await store.ecrire('alertesVues', { id: 'a1', clientId: 'p1', cle: 'x' })).toBeUndefined()
  })

  it('magasin fichier (démo) : même règle', async () => {
    const store = creerStoreFichier(join(dossier, 'etat-demo.json'))
    const [w] = await store.tout('workouts')
    expect(w.version).toBe(1) // ligne de démo jamais réécrite
    await store.ecrire('workouts', { ...w, nom: 'Par Claude' })
    await expect(store.ecrire('workouts', { ...w, nom: 'Écran' }, { versionAttendue: 1 })).rejects.toMatchObject({ code: 'CONFLIT' })
    expect((await store.un('workouts', w.id)).nom).toBe('Par Claude')
  })
})

