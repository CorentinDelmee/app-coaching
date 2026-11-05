// Import MyPTHub : normalisation d'un export SYNTHÉTIQUE (personnes inventées), import dans une base temporaire,
// idempotence, archivage, aucun champ de paiement, données visibles par le coach via l'API, archivé non connectable.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { normaliser, cleMensuration, jourDe, questionFr, seanceDe } from '../src/import-mypthub/normaliser.js'
import { importer } from '../src/import-mypthub/importer.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'
import { creerAppHttp, hacherCode } from '../src/app-http.js'
import { creerServeurRest } from '../src/rest.js'
import { lireConfig } from '../src/config.js'

const NOW = Date.UTC(2026, 10, 5, 10)

// Export synthétique : 3 contacts inventés (actif complet, inactif, déjà présent dans l'app par son nom).
function exportSynthetique() {
  return {
    exporte_le: '2026-11-05T09:00:00Z',
    contacts: [
      { id: 101, customer_id: 9001, full_name: 'Zoé Testeuse', first_name: 'Zoé', last_name: 'Testeuse', email: 'Zoe@Exemple.test', dob: '1990-04-12', gender: 'female', last_seen: '2026-11-01 08:00:00', active: true, disabled: false, stripe_customer_id: 'cus_X' },
      { id: 102, customer_id: 9002, full_name: 'Marc Inactif', email: 'marc@exemple.test', last_seen: '2026-08-01T10:00:00Z', active: true, disabled: false },
      { id: 103, customer_id: 9003, full_name: 'Léa Déjà', email: 'lea@exemple.test', last_seen: '2026-11-04', active: true }
    ],
    clients: {
      101: {
        api: {
          '/v5/contacts/101': { data: { id: 101, goals: [{ name: 'Perdre 5 kg' }, { name: 'Courir 10 km' }] } },
          '/v4/customers/9001': { data: { id: 9001, phone: '0600000000', card_brand: 'visa', last_four: '4242', payment_method: 'card', favourite_colour: 'bleu' } },
          '/v4/customers/9001/activity_log': { data: [{ created_at: '2026-10-30', description: 'A terminé une séance' }] },
          '/v4/customers/9001/notes': { data: [{ created_at: '2026-09-01', note: 'Genou droit fragile' }] },
          '/v4/customers/9001/parq/questions': { questions: [
            { id: 1, question: 'Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?', answer: 'no' },
            { id: 2, question: 'Do you have a bone or joint problem that could be made worse by a change in your physical activity?', answer: 'yes', details: 'Genou' },
            { id: 3, question: 'Question maison non traduite', answer: 'peut-être' }
          ], nutrition_answers: { allergies: 'Arachides' } },
          '/v4/customers/9001/metrics': { data: { customer_metrics: [
            { date: '2026-09-01', weight: 70.5, height: 168, circ_waist: 80, circ_arm_l: 30, circ_arm_r: 30.5, body_fat: 25, resting_heart_rate: 62, blood_pressure: '120/80', mood_score: 3 },
            { date: '2026-10-01', weight: 69.2, circ_waist: 78 }
          ] } },
          '/v4/customers/9001/workouts': { data: [{ id: 501, name: 'Full body A' }, { id: 502, name: 'Haut du corps' }] },
          '/v4/customers/9001/scheduler/current': { data: { schedules: [
            { id: 77, name: 'Bloc automne', start_date: '2026-10-05', end_date: '2026-12-20', workouts: [{ workout_id: 501, date: '2026-10-06' }, { workout_id: 502, date: '2026-10-08' }, { workout_id: 501, date: '2026-10-13' }] }
          ] } },
          '/v4/customers/9001/progress_photos': { data: [{ date: '2026-09-01', url: 'https://temp' }, { date: '2026-10-01', url: 'https://temp' }] }
        },
        textes: { 'results-tracker': { at: '2026-11-05', texte: 'Squat 60 kg' }, 'progress-photos': { at: '2026-11-05', texte: '2 photos' } }
      },
      102: { api: {}, textes: { 'weight-circumference': { at: '2026-11-05', texte: 'Poids 82 kg le 01/07/2026' } } },
      103: { api: { '/v4/customers/9003/metrics': [{ date: '2026-10-20', weight: 60 }] }, textes: {} }
    },
    workouts: {
      501: { data: { id: 501, name: 'Full body A', description: '<p>Échauffement 10 min</p>', exercises: [
        { name: 'Squat', sets: [{ reps: 10, weight: 40, rest: 90 }, { reps: 8, weight: 45, rest: 90 }], notes: 'Dos droit' },
        { name: 'Pompes', sets: 3, reps: '8-12', superset_id: 'A' },
        { name: 'Rowing haltère', sets: 3, reps: 10, weight: 12, superset_id: 'A', rest: 60 },
        { name: 'Gainage', sets: [{ time: '0:45' }], tempo_magique: 'x' }
      ] } },
      502: { id: 502, name: 'Haut du corps', exercises: [{ name: 'Développé couché', sets: [{ reps: 5, weight: 50 }] }] }
    },
    erreurs: []
  }
}

describe('normaliser (fonctions)', () => {
  it('dates, mensurations, traduction PAR-Q', () => {
    expect(jourDe('2026-11-01 08:00:00')).toBe('2026-11-01')
    expect(jourDe('05/11/2026')).toBe('2026-11-05')
    expect(jourDe(1762333200)).toBe('2025-11-05')
    expect(cleMensuration('circ_waist')).toBe('tourDeTaille')
    expect(cleMensuration('circ_thigh_r')).toBe('tourDeCuisseDroit')
    expect(cleMensuration('weight')).toBe(null)
    expect(questionFr('Do you feel pain in your chest when you do physical activity?')).toMatch(/^Ressentez-vous une douleur/)
    expect(questionFr('Autre chose')).toBe('Autre chose')
  })
  it('séance : séries, fourchettes, superset par superset_id, repos, consignes', () => {
    const s = seanceDe(exportSynthetique().workouts[501].data)
    expect(s.nom).toBe('Full body A')
    expect(s.consignes).toBe('Échauffement 10 min')
    expect(s.blocs).toHaveLength(3)
    expect(s.blocs[0]).toMatchObject({ type: 'exercice', nom: 'Squat', repos: 90, consignes: 'Dos droit', series: [{ reps: 10, poids: 40 }, { reps: 8, poids: 45 }] })
    expect(s.blocs[1].type).toBe('superset')
    expect(s.blocs[1].repos).toBe(60)
    expect(s.blocs[1].exercices.map((x) => x.nom)).toEqual(['Pompes', 'Rowing haltère'])
    expect(s.blocs[1].exercices[0].series).toHaveLength(3)
    expect(s.blocs[1].exercices[0].series[0]).toEqual({ fourchetteReps: '8-12' })
    expect(s.blocs[2].series).toEqual([{ tempsTravail: 45 }])
  })
})

describe('normaliser (export complet)', () => {
  const n = normaliser(exportSynthetique())
  const [zoe, marc, lea] = n.clients
  it('profil, archivage des inactifs (> 30 jours)', () => {
    expect(n.clients).toHaveLength(3)
    expect(zoe.profil).toMatchObject({ nom: 'Zoé Testeuse', email: 'zoe@exemple.test', telephone: '0600000000', dateNaissance: '1990-04-12', sexe: 'femme', objectifs: ['Perdre 5 kg', 'Courir 10 km'] })
    expect(zoe.archive).toBe(false)
    expect(marc.archive).toBe(true)
    expect(lea.archive).toBe(false)
    expect(zoe.source).toEqual({ mypthub_contact_id: '101', customer_id: '9001' })
  })
  it('aucun champ ni valeur de paiement', () => {
    const t = JSON.stringify(n.clients)
    for (const mot of ['stripe', 'cus_X', 'last_four', '4242', 'card_brand', 'payment']) expect(t).not.toContain(mot)
    expect(Object.keys(n.rapport.paiementRetire).sort()).toEqual(['card_brand', 'last_four', 'payment_method', 'stripe_customer_id'])
  })
  it('mesures (poids, tours) et bilans (taille, masse grasse, FC, tension)', () => {
    expect(zoe.mesures).toEqual([
      { date: '2026-09-01', poids: 70.5, mensurations: { tourDeTaille: 80, tourDeBrasGauche: 30, tourDeBrasDroit: 30.5 } },
      { date: '2026-10-01', poids: 69.2, mensurations: { tourDeTaille: 78 } }
    ])
    expect(zoe.bilans).toEqual([{ date: '2026-09-01', valeurs: { taille: 168, masseGrasse: 25, fcRepos: 62, tension: '120/80' } }])
    expect(n.rapport.champsNonConvertis['metrics.mood_score']).toBe(1)
  })
  it('PAR-Q en français, allergies et notes dans les notes du coach', () => {
    expect(zoe.parq.questions[0]).toEqual({ question: expect.stringMatching(/^Un médecin vous a-t-il déjà dit/), reponse: 'Non' })
    expect(zoe.parq.questions[1].reponse).toBe('Oui — Genou')
    expect(zoe.parq.questions[2]).toEqual({ question: 'Question maison non traduite', reponse: 'peut-être' })
    expect(zoe.notesCoach).toContain('Perdre 5 kg')
    expect(zoe.notesCoach).toContain('Arachides')
    expect(zoe.notesCoach).toContain('Genou droit fragile')
    expect(zoe.notesCoach).toContain('Photos de progression (non importées) : 2 (du 01/09/2026 au 01/10/2026)')
    expect(zoe.notesCoach).toContain('A terminé une séance')
    expect(zoe.notesCoach).toContain('« results-tracker »')
    expect(zoe.notesCoach).not.toContain('https://temp')
    // Secours : pas d'API de mesures -> texte de l'écran gardé dans les notes.
    expect(marc.notesCoach).toContain('Poids 82 kg')
  })
  it('séances et programme par semaine avec jours fixes', () => {
    expect(zoe.seances.map((s) => s.sourceId).sort()).toEqual(['501', '502'])
    expect(zoe.programmes).toEqual([{ sourceId: '77', nom: 'Bloc automne', debut: '2026-10-05', fin: '2026-12-20', semaines: [['501', '502'], ['501']], joursFixes: { 501: 1, 502: 3 }, termine: false }])
    expect(n.rapport.champsNonConvertis['customer.favourite_colour']).toBe(1)
    expect(n.rapport.champsNonConvertis['workout.exercises[].sets[].tempo_magique'] ?? n.rapport.champsNonConvertis['workout.exercises[].tempo_magique']).toBe(1)
  })
  it('le rapport ne contient aucun nom ni e-mail', () => {
    const r = JSON.stringify(n.rapport)
    for (const mot of ['Zoé', 'Testeuse', 'exemple.test', '0600000000', 'Genou']) expect(r).not.toContain(mot)
  })
})

describe('importer', () => {
  let db, backend, serveur, base, dossier, coachCookie, res1
  const ORIGINE = 'https://app.exemple.fr'
  const appel = async (methode, chemin, { corps, cookie } = {}) => {
    const headers = { Origin: ORIGINE, ...(cookie ? { Cookie: cookie } : {}), ...(corps ? { 'Content-Type': 'application/json' } : {}) }
    const r = await fetch(base + chemin, { method: methode, headers, body: corps ? JSON.stringify(corps) : undefined })
    return { statut: r.status, json: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] }
  }
  const compter = (t) => db.prepare(`SELECT count(*) n FROM ${t}`).get().n

  beforeAll(async () => {
    dossier = mkdtempSync(join(tmpdir(), 'import-mypthub-'))
    db = ouvrirBase(join(dossier, 'app.db'))
    backend = creerStoreSqlite(db)
    await backend.ecrire('profils', { id: 'pc', role: 'coach', identifiant: 'coach', nom: 'Coach', archive: false, creeLe: 1 })
    db.prepare("INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES ('coach', ?, 'coach', 'pc')").run(await hacherCode('code-coach-123'))
    // Léa existe déjà dans l'app (créée à la main), avec une mesure le 20/10 sans poids et une note.
    await backend.ecrire('profils', { id: 'pl', role: 'client', identifiant: 'lea.deja', nom: 'Léa Déjà', tarif: 50, lieuDefaut: 'salle', modules: { habitudes: true }, archive: false, creeLe: 1, consentementLe: null })
    db.prepare("INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES ('lea.deja', ?, 'client', 'pl')").run(await hacherCode('code-lea-1234'))
    await backend.ecrire('mesures', { id: 'mes-pl-2026-10-20', clientId: 'pl', date: '2026-10-20', mensurations: { tourDeTaille: 70 } })
    await backend.ecrire('exercices', { id: 'ex-squat', nom: 'Squat', categories: ['jambes'] })
    const config = { ...lireConfig({}), sessionSecret: 's'.repeat(40), appOrigin: ORIGINE, fichiersDir: dossier, proxyCle: 'p'.repeat(40) }
    const appHttp = creerAppHttp({ db, store: backend, config, journal: { ecrire() {} } })
    serveur = creerServeurRest({ config, appHttp, outils: {}, journal: { ecrire() {} }, service: {}, biblio: {} })
    await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${serveur.address().port}`
  })
  afterAll(() => { serveur?.close(); db?.close(); rmSync(dossier, { recursive: true, force: true }) })

  it('--essai : compte rendu complet, rien d\'écrit', async () => {
    const avant = ['profiles', 'comptes', 'mesures', 'workouts', 'exercices'].map(compter)
    const r = await importer({ db, backend }, normaliser(exportSynthetique()), { essai: true, now: () => NOW })
    expect(r.codes).toEqual([])
    expect(r.bilan.clients.map((c) => c.action)).toEqual(['créé', 'créé', 'complété'])
    expect(r.bilan.clients[0]).toMatchObject({ mesures: 2, seances: 2, programmes: 1, reponses: 2 })
    expect(['profiles', 'comptes', 'mesures', 'workouts', 'exercices'].map(compter)).toEqual(avant)
  })

  it('import réel : clients, comptes, codes avant validation, complète sans écraser', async () => {
    let codesVus = null
    res1 = await importer({ db, backend }, normaliser(exportSynthetique()), { now: () => NOW, avantValidation: (c) => { codesVus = c } })
    expect(codesVus).toHaveLength(2)
    expect(res1.codes.map((c) => [c.identifiant, c.archive])).toEqual([['zoe.testeuse', false], ['marc.inactif', true]])
    expect(compter('profiles')).toBe(4)
    const zoe = (await backend.tout('profils')).find((p) => p.identifiant === 'zoe.testeuse')
    expect(zoe).toMatchObject({ archive: false, consentementLe: null, tarif: 35 })
    expect(zoe.fiche.contact).toEqual({ email: 'zoe@exemple.test', telephone: '0600000000', dateNaissance: '1990-04-12', sexe: 'femme' })
    expect(zoe.fiche.source.mypthub).toMatchObject({ contactId: '101', customerId: '9001' })
    // Léa : complétée, rien d'écrasé (tarif, lieu, modules, mensuration existante), poids ajouté au 20/10.
    const lea = await backend.un('profils', 'pl')
    expect(lea).toMatchObject({ tarif: 50, lieuDefaut: 'salle', modules: { habitudes: true }, nom: 'Léa Déjà' })
    expect(lea.fiche.source.mypthub.contactId).toBe('103')
    expect(await backend.un('mesures', 'mes-pl-2026-10-20')).toMatchObject({ poids: 60, mensurations: { tourDeTaille: 70 } })
    // Exercice existant réutilisé (Squat), les autres créés.
    expect((await backend.tout('exercices')).filter((e) => e.nom === 'Squat')).toHaveLength(1)
    expect(res1.bilan.exercicesCrees).toBe(4)
    // Aucun champ de paiement dans toute la base.
    const tout = JSON.stringify(db.prepare('SELECT * FROM profiles').all()) + JSON.stringify(['mesures', 'reponses', 'workouts', 'questionnaires', 'programmes'].map((t) => db.prepare(`SELECT data FROM ${t}`).all()))
    for (const mot of ['stripe', 'last_four', '4242', 'payment', 'card_brand']) expect(tout).not.toContain(mot)
  })

  it('idempotent : un 2e passage ne crée rien', async () => {
    const avant = ['profiles', 'comptes', 'mesures', 'workouts', 'programmes', 'questionnaires', 'reponses', 'exercices'].map(compter)
    const r = await importer({ db, backend }, normaliser(exportSynthetique()), { now: () => NOW })
    expect(r.codes).toEqual([])
    expect(r.bilan.clients.map((c) => c.action)).toEqual(['complété', 'complété', 'complété'])
    expect(r.bilan.clients.every((c) => c.mesures + c.mesuresCompletees + c.reponses + c.seances + c.programmes === 0)).toBe(true)
    expect(['profiles', 'comptes', 'mesures', 'workouts', 'programmes', 'questionnaires', 'reponses', 'exercices'].map(compter)).toEqual(avant)
  })

  it('le coach voit mesures, séances, programme, PAR-Q et fiche via l\'API', async () => {
    coachCookie = (await appel('POST', '/api/app/connexion', { corps: { identifiant: 'coach', code: 'code-coach-123' } })).cookie
    const zoe = (await appel('GET', '/api/app/e/profils', { cookie: coachCookie })).json.items.find((p) => p.identifiant === 'zoe.testeuse')
    expect(zoe.fiche.notes).toContain('Genou droit fragile')
    const de = async (e) => (await appel('GET', `/api/app/e/${e}`, { cookie: coachCookie })).json.items.filter((x) => x.clientId === zoe.id)
    expect((await de('mesures')).map((m) => m.poids).sort()).toEqual([69.2, 70.5])
    const seances = await de('workouts')
    expect(seances.map((w) => w.nom).sort()).toEqual(['Full body A', 'Haut du corps'])
    const fb = seances.find((w) => w.nom === 'Full body A')
    expect(fb.blocs.map((b) => b.type)).toEqual(['exercice', 'superset', 'exercice'])
    expect(fb.blocs[0]).toMatchObject({ exerciceId: 'ex-squat', repos: 90, champs: [{ cle: 'poids', modifiableParClient: true }, { cle: 'reps', modifiableParClient: true }] })
    const [prog] = await de('programmes')
    expect(prog).toMatchObject({ nom: 'Bloc automne', mode: 'parSemaine', debut: '2026-10-05', archive: false })
    expect(prog.semaines).toEqual([[fb.id, seances.find((w) => w.nom === 'Haut du corps').id], [fb.id]])
    const qs = await de('questionnaires')
    expect(qs.map((q) => q.nom).sort()).toEqual(['Bilans MyPTHub', 'PAR-Q (MyPTHub)'])
    expect(qs.every((q) => q.archive)).toBe(true) // jamais proposés au client comme « à remplir »
    expect((await de('reponses')).length).toBe(2)
  })

  it('le client connecté ne reçoit jamais la fiche, et ne peut pas l\'effacer', async () => {
    const zoe = res1.codes.find((c) => c.identifiant === 'zoe.testeuse')
    const c = await appel('POST', '/api/app/connexion', { corps: { identifiant: zoe.identifiant, code: zoe.code } })
    expect(c.statut).toBe(200)
    const id = c.json.utilisateur.profil_id
    const moi = (await appel('GET', `/api/app/e/profils/${id}`, { cookie: c.cookie })).json.item
    expect(moi.fiche).toBeUndefined()
    const put = await appel('PUT', `/api/app/e/profils/${id}`, { cookie: c.cookie, corps: { ...moi, preferences: { son: false } } })
    expect(put.statut).toBe(200)
    expect(put.json.item.fiche).toBeUndefined()
    expect((await backend.un('profils', id)).fiche.notes).toContain('Genou droit fragile')
  })

  it('un client archivé ne peut pas se connecter', async () => {
    const marc = res1.codes.find((c) => c.identifiant === 'marc.inactif')
    expect((await appel('POST', '/api/app/connexion', { corps: { identifiant: marc.identifiant, code: marc.code } })).statut).toBe(401)
    expect(db.prepare("SELECT archive FROM comptes WHERE identifiant = 'marc.inactif'").get().archive).toBe(1)
  })
})
