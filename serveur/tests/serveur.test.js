// Tests unitaires du serveur : auth, limitation, journal, confirmation de suppression, format de séance, bibliothèque, REST.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assembler } from '../src/assembler.js'
import { cleValide, creerLimiteur } from '../src/auth.js'
import { lireConfig } from '../src/config.js'
import { appeler } from '../src/outils.js'
import { creerServeurRest } from '../src/rest.js'
import { scorerVideo, dureeIso, chercherYoutube } from '../src/youtube.js'
import { validerWorkout } from '../../src/domain/modele.js'

const CLE = 'cle-de-test-0123456789abcdef'
const VIDEO = 'https://www.youtube.com/watch?v=abcdefghijk'
let dossier
let app

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'srv-test-'))
  app = await assembler({ ...lireConfig({ COACH_API_KEY: CLE, DATA_DIR: dossier }), youtubeCle: '' }, { now: () => Date.UTC(2026, 9, 26, 12) })
})
afterAll(() => rmSync(dossier, { recursive: true, force: true }))

const outil = (nom, args) => appeler(app, nom, args, 'test')
const journalLignes = () => readFileSync(app.journal.fichier, 'utf8').trim().split('\n').map((l) => JSON.parse(l))

describe('authentification', () => {
  it('refuse par défaut : sans clé configurée, tout est rejeté', () => {
    expect(cleValide(`Bearer ${CLE}`, '')).toBe(false)
    expect(cleValide(`Bearer ${CLE}`, 'court')).toBe(false)
  })
  it('accepte la bonne clé, refuse le reste', () => {
    expect(cleValide(`Bearer ${CLE}`, CLE)).toBe(true)
    expect(cleValide(`Bearer ${CLE}x`, CLE)).toBe(false)
    expect(cleValide(CLE, CLE)).toBe(false)
    expect(cleValide(undefined, CLE)).toBe(false)
  })
  it('limiteur de débit : bloque au-delà du maximum puis repart avec la fenêtre', () => {
    let t = 0
    const ok = creerLimiteur({ max: 2, fenetreMs: 1000, now: () => t })
    expect([ok('a'), ok('a'), ok('a')]).toEqual([true, true, false])
    expect(ok('b')).toBe(true)
    t = 1500
    expect(ok('a')).toBe(true)
  })
})

describe('clients', () => {
  it('trouve un client malgré la casse et les accents', async () => {
    const r = await outil('chercher_client', { nom: 'LÉA martin' })
    expect(r.donnees.resultats.map((c) => c.id)).toEqual(['client-lea-martin'])
  })
  it('signale les homonymes', async () => {
    await app.service.api.creerClient({ nom: 'Fabien Vincent' }).catch(() => null)
    // le mode fichier n'a pas de comptes : on crée l'homonyme directement
    await app.service.api.profils.creer({ id: 'client-homonyme', role: 'client', identifiant: 'fabien.vincent2', nom: 'Fabien Vincent', tarif: 35, lieuDefaut: 'domicile', modules: {}, archive: false, creeLe: 1 })
    const r = await outil('chercher_client', { nom: 'fabien vincent' })
    expect(r.donnees.ambigu).toBe(true)
    const c = await outil('creer_seance', { client: 'fabien vincent', nom: 'X' })
    expect(c.ok).toBe(false)
    expect(c.code).toBe('CLIENT_AMBIGU')
  })
})

describe('séances', () => {
  let seanceId
  it("crée une séance au format de l'app (valide), avec circuits et vidéo de la bibliothèque", async () => {
    app.biblio.proposer({ nom: 'Squat', url: VIDEO, chaine: 'Test', duree: 60, titre: 'Squat', score: 90 })
    const r = await outil('creer_seance', {
      client: 'client-thomas-bernard', nom: 'Séance du jeudi', date: '2026-10-29',
      blocs: [
        { exercice: { nom: 'squat', series: 4, reps: 8, charge: 60, repos: 120, tempo: '3-1-1' } },
        { exercice: { nom: 'Planche', series: 3, tempsTravail: 30, repos: 45 } },
        { superset: { repos: 60, exercices: [{ nom: 'Pompes', reps: '8-10' }, { nom: 'Fentes arrière', reps: 12 }] } },
        { circuit: { format: 'amrap', minutes: 8, exercices: [{ nom: 'Burpees', reps: 5 }, { nom: 'Squat sauté', reps: 10 }] } },
        { circuit: { format: 'emom', minutes: 6, exercices: [{ nom: 'Pompes', reps: 10 }] } },
        { circuit: { format: 'fortime', capMinutes: 12, exercices: [{ nom: 'Burpees', reps: 20 }] } }
      ]
    })
    expect(r.ok, r.erreur).toBe(true)
    seanceId = r.donnees.seance.id
    const w = await app.service.api.workouts.lire(seanceId)
    expect(validerWorkout(w).ok).toBe(true)
    expect(w.blocs[0].series).toEqual(Array(4).fill({ poids: 60, reps: 8, tempo: '3-1-1' }))
    expect(w.blocs[0].repos).toBe(120)
    expect(w.blocs[3]).toMatchObject({ type: 'circuit', format: 'amrap', params: { duree: 480 } })
    expect(w.blocs[5].params).toEqual({ cap: 720 })
    expect(r.donnees.seance.blocs[0].video).toBe(VIDEO)
    // placée le jeudi dans le programme de Thomas
    expect((await app.service.api.programmes.lire('prog-client-thomas-bernard')).joursFixes[seanceId]).toBe(3)
  })
  it('refuse les arguments invalides (zod strict)', async () => {
    const r = await outil('creer_seance', { client: 'x', nom: 'y', inconnu: 1, date: '29/10' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('VALIDATION')
    expect((await outil('ajouter_exercice', { seanceId, exercice: { nom: 'A', reps: 1 }, circuit: { format: 'amrap', minutes: 1, exercices: [{ nom: 'B' }] } })).ok).toBe(false)
  })
  it('ajoute un exercice et rattache une vidéo', async () => {
    const a = await outil('ajouter_exercice', { seanceId, exercice: { nom: 'Mouvement inédit zzz', reps: 1, tempsTravail: 30 } })
    expect(a.ok, a.erreur).toBe(true)
    expect(a.donnees.exercicesSansVideo).toContain('Mouvement inédit zzz')
    const v = await outil('rattacher_video', { exercice: 'Mouvement inédit zzz', url: 'https://youtu.be/ZYXWVUTSRQP' })
    expect(v.ok, v.erreur).toBe(true)
    expect((await outil('rattacher_video', { exercice: 'x', url: 'https://exemple.com/video' })).ok).toBe(false)
  })
  it('ne remplace pas une vidéo validée par le coach', async () => {
    const e = app.biblio.chercher('Squat')[0]
    await app.service.validerVideo(e.id)
    const r = await outil('rattacher_video', { exercice: 'Squat', url: 'https://youtu.be/ZYXWVUTSRQP' })
    expect(r.code).toBe('VIDEO_VALIDEE')
  })
  it('suppression : confirmation obligatoire (jeton à usage unique)', async () => {
    const premier = await outil('supprimer_seance', { seanceId })
    expect(premier.donnees.confirmationRequise).toBe(true)
    expect(await app.service.api.workouts.lire(seanceId)).not.toBeNull() // rien supprimé
    const faux = await outil('supprimer_seance', { seanceId, jeton: '0'.repeat(32) })
    expect(faux.code).toBe('JETON_INVALIDE')
    const ok = await outil('supprimer_seance', { seanceId, jeton: premier.donnees.jeton })
    expect(ok.donnees.supprimee).toBe(true)
    expect(await app.service.api.workouts.lire(seanceId)).toBeNull()
    expect((await app.service.api.programmes.lire('prog-client-thomas-bernard')).joursFixes[seanceId]).toBeUndefined()
    expect((await outil('supprimer_seance', { seanceId, jeton: premier.donnees.jeton })).ok).toBe(false)
  })
  it('agenda : séances programmées et coaching', async () => {
    const r = await outil('consulter_agenda', { client: 'Léa Martin', du: '2026-10-26', au: '2026-11-08' })
    expect(r.ok).toBe(true)
    expect(Array.isArray(r.donnees.seancesProgrammees)).toBe(true)
  })
})

describe('journal', () => {
  it('consigne qui, quand, outil, client et résultat, sans jamais la clé', () => {
    const l = journalLignes()
    expect(l.length).toBeGreaterThan(5)
    const creation = l.find((x) => x.outil === 'creer_seance' && x.ok)
    expect(creation).toMatchObject({ acteur: 'test', client: 'client-thomas-bernard' })
    expect(creation.quand).toMatch(/^2026-10-26T/)
    expect(l.some((x) => x.ok === false && x.erreur)).toBe(true)
    expect(JSON.stringify(l)).not.toContain(CLE)
  })
})

describe('bibliothèque et YouTube', () => {
  it('importe un fichier tolérant, rejette les liens non YouTube', () => {
    const r = app.biblio.importer({ exercices: [
      { exercice: 'Rowing barre', chaîne: 'Chaîne X', duree: '1:30', url: 'https://youtu.be/12345678901', justification: 'ok' },
      { nom: 'Mauvais', url: 'https://exemple.com/x' }, { pas: 'de nom' }
    ] })
    expect(r).toEqual({ ajoutees: 1, miseAJour: 0, rejetees: 2 })
    expect(app.biblio.chercher('rowing barre')[0].video.duree).toBe(90)
  })
  it('a importé la sélection de vidéos au premier lancement', () => {
    expect(app.biblio.lister().filter((e) => e.video).length).toBeGreaterThan(40)
  })
  it('score : court + chaîne reconnue + titre pertinent > long inconnu', () => {
    const bon = scorerVideo({ nom: 'Squat gobelet', titre: 'Squat gobelet : technique', chaine: 'Tibo InShape', duree: 75, vues: 500000 }, ['Tibo InShape'])
    const mauvais = scorerVideo({ nom: 'Squat gobelet', titre: 'Mes vacances', chaine: 'Inconnue', duree: 900, vues: 10 }, ['Tibo InShape'])
    expect(bon.score).toBeGreaterThan(mauvais.score + 50)
    expect(bon.justification).toContain('chaîne reconnue')
    expect(dureeIso('PT1M45S')).toBe(105)
  })
  it('recherche YouTube (API simulée) triée par score', async () => {
    const fetchFn = async (url) => ({ ok: true, json: async () => (String(url).includes('/search')
      ? { items: [{ id: { videoId: 'aaaaaaaaaaa' } }, { id: { videoId: 'bbbbbbbbbbb' } }] }
      : { items: [
        { id: 'aaaaaaaaaaa', snippet: { title: 'Vlog', channelTitle: 'X' }, contentDetails: { duration: 'PT20M' }, statistics: { viewCount: '10' } },
        { id: 'bbbbbbbbbbb', snippet: { title: 'Pompes parfaites', channelTitle: 'Y' }, contentDetails: { duration: 'PT50S' }, statistics: { viewCount: '90000' } }] }) })
    const r = await chercherYoutube('Pompes', { cle: 'k', fetchFn })
    expect(r[0].url).toContain('bbbbbbbbbbb')
  })
})

describe('API REST', () => {
  let srv, base
  beforeAll(async () => {
    srv = creerServeurRest(app)
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok))
    base = `http://127.0.0.1:${srv.address().port}`
  })
  afterAll(() => new Promise((ok) => srv.close(ok)))
  const req = (chemin, { cle = CLE, ...opts } = {}) => fetch(base + chemin, { ...opts, headers: { ...(cle ? { Authorization: `Bearer ${cle}` } : {}), 'Content-Type': 'application/json' } })

  it('401 sans clé ou avec une mauvaise clé ; /api/sante publique', async () => {
    expect((await req('/api/clients', { cle: null })).status).toBe(401)
    expect((await req('/api/clients', { cle: 'mauvaise-cle-mauvaise-cle' })).status).toBe(401)
    expect((await req('/api/sante', { cle: null })).status).toBe(200)
    expect((await req('/demo/etat', { cle: null })).status).toBe(401) // DEMO_SYNC non activé
  })
  it('liste les clients et crée une séance en REST', async () => {
    expect((await (await req('/api/clients')).json()).clients.length).toBeGreaterThan(2)
    const r = await req('/api/seances', { method: 'POST', body: JSON.stringify({ client: 'lea martin', nom: 'REST', blocs: [{ exercice: { nom: 'Pompes', reps: 10 } }] }) })
    expect(r.status).toBe(200)
    expect((await r.json()).seance.nom).toBe('REST')
    expect((await req('/api/seances', { method: 'POST', body: '{pas du json' })).status).toBe(400)
  })
  it('suppression REST en 2 temps', async () => {
    const { seances } = await (await req('/api/seances?client=lea martin')).json()
    const id = seances.find((s) => s.nom === 'REST').id
    const a = await (await req(`/api/seances/${id}`, { method: 'DELETE' })).json()
    expect(a.confirmationRequise).toBe(true)
    expect((await (await req(`/api/seances/${id}?jeton=${a.jeton}`, { method: 'DELETE' })).json()).supprimee).toBe(true)
  })
  it('refuse les corps trop gros', async () => {
    const r = await req('/api/outils/lister_clients', { method: 'POST', body: JSON.stringify({ x: 'a'.repeat(300000) }) })
    expect(r.status).toBe(413)
  })
})
