// Import MyPTHub : normalisation d'un export SYNTHÉTIQUE (personnes inventées), import dans une base temporaire,
// idempotence, archivage, aucun champ de paiement, données visibles par le coach via l'API, archivé non connectable.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { normaliser, cleMensuration, jourDe, questionFr, seanceDe, fourchette } from '../src/import-mypthub/normaliser.js'
import { importer } from '../src/import-mypthub/importer.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'
import { creerAppHttp, hacherCode } from '../src/app-http.js'
import { creerServeurRest } from '../src/rest.js'
import { lireConfig } from '../src/config.js'

const NOW = Date.UTC(2026, 10, 5, 10)

// Export synthétique (personnes inventées), aux FORMES de l'export réel du 2026-11-05 : actif complet, inactif,
// déjà présent dans l'app par son nom (actif, séances sans programme), compte de test du coach (exclu).
function exportSynthetique() {
  const jours = { day_1: false, day_2: false, day_3: false, day_4: false, day_5: false, day_6: false, day_7: false }
  return {
    exporte_le: '2026-11-05T09:00:00Z',
    contacts: [
      { id: 101, customer_id: 9001, full_name: 'Zoé Testeuse', first_name: 'Zoé', last_name: 'Testeuse', email: 'Zoe@Exemple.test', dob: '1990-04-12', gender: 'female', last_seen: Date.UTC(2026, 10, 1) / 1000, active: true, disabled: false, stripe_customer_id: 'cus_X' },
      { id: 102, customer_id: 9002, full_name: 'Marc Inactif', email: 'marc@exemple.test', last_seen: Date.UTC(2026, 7, 1) / 1000, active: true, disabled: false },
      { id: 103, customer_id: 9003, full_name: 'Léa Déjà', email: 'lea@exemple.test', last_seen: Date.UTC(2026, 10, 4) / 1000, active: true },
      { id: 104, customer_id: 9004, full_name: 'Corentin Delmee', email: 'coach@exemple.test', last_seen: Date.UTC(2026, 10, 4) / 1000, active: true }
    ],
    clients: {
      101: {
        api: {
          '/v5/contacts/101?customer_id=9001': { contact: { id: 101, goals: 'Perdre 5 kg\nCourir 10 km', telephone: null, active_purchases: 1 } },
          '/v4/customers/9001': { customer: { id: 9001, telephone: '0600000000', injuries: 'Épaule gauche', height: 168, card_brand: 'visa', payment_method: 'card', favourite_colour: 'bleu', user: { email: 'zoe@exemple.test', dob: '1990-04-12', gender: 'female', last_four: '4242' } } },
          '/v4/customers/9001/activity_log&search=&infinite=true&customerId=9001&current_page=1': { activityLog: { data: [
            { id: 1, type: 'session', action: 'completed', date: '2026-10-30 10:00:00', subject: { date_completed: '2026-10-30 10:40:00', time_elapsed: 2400, feedback: 'Dur mais top', workout: { title: 'Full body A' } } },
            { id: 2, type: 'customermetric', action: 'updated', date: '2026-10-15 08:00:00', subject: { date: '2026-10-15', weight: 69.8, circ_legacy: 0 } }
          ], pagination: { totalPages: 1 } } },
          '/v4/customers/9001/notes': { notes: [{ id: 1, created_at: '2026-09-01 10:00:00', content: 'Genou droit fragile', user: { first_name: 'Coach' } }] },
          '/v4/customers/9001/parq/questions': { questions: [
            { id: 1, question_text: 'Do you have diabetes?', answer: { id: 1, yes: 0, additional_info: null, updated_at: '2026-03-01 10:00:00' } },
            { id: 2, question_text: 'Do you have back pain or joint conditions that could be exacerbated by exercise?', answer: { id: 2, yes: 1, additional_info: 'Genou' } },
            { id: 3, question_text: 'Are you pregnant? Or have you given birth in the past 6 weeks?', for_gender: 'female', answer: null },
            { id: 4, question_text: 'Question maison non traduite', answer: { id: 4, yes: 1 } }
          ], nutrition_answers: { allergy_peanuts: true, allergy_milk: false, allergy_other_notes: null, no_allergies: false }, injury_answers: 'Entorse 2024' },
          '/v5/customers/9001/metrics&filter[type]=bodyweight_circumference': { customer_metrics: [
            { date: '2026-09-01', weight: 70.5, height: 168, circ_waist_l: null, circ_arm_l: 30, circ_arm_r: 30.5, circ_waist: 80, bodyfat_percent: 25, resting_heart_rate: 62, blood_pressure_systolic: 120, mood_score: 3 },
            { date: '2026-10-01', weight: 69.2, circ_waist: 78 }
          ], pagination: { total: 2, per_page: 10, current_page: 1, last_page: 1 } },
          '/v4/customers/9001/metrics/latest': { error: { message: 'x', statusCode: 404 } },
          '/v4/customers/9001/workouts': { workouts: [{ id: 501, title: 'Full body A', note: null, ...jours }, { id: 502, title: 'Haut du corps', note: 'Note d\'assignation', ...jours }] },
          '/v4/customers/9001/scheduler/current': { schedules: [
            { id: 77, name: 'Bloc automne', start_date: '2026-10-05', end_date: '2026-12-20', workouts: [{ workout_id: 501, date: '2026-10-06' }, { workout_id: 502, date: '2026-10-08' }, { workout_id: 501, date: '2026-10-13' }] }
          ] },
          '/v4/customers/9001/progress_photos': { data: [{ date: '2026-09-01', url: 'https://temp' }, { date: '2026-10-01', url: 'https://temp' }] }
        },
        textes: { 'results-tracker': { at: '2026-11-05', texte: 'Squat 60 kg' }, financials: { at: '2026-11-05', texte: 'Paiement 40 €' } }
      },
      102: { api: {}, textes: { 'weight-circumference': { at: '2026-11-05', texte: 'Poids 82 kg le 01/07/2026' }, financials: { at: '2026-11-05', texte: 'Paiement 40 €' } } },
      103: { api: {
        '/v5/customers/9003/metrics&filter[type]=bodyweight_circumference': { customer_metrics: [{ date: '2026-10-20', weight: 60 }] },
        '/v4/customers/9003/workouts': { workouts: [{ id: 601, title: 'Mobilité', ...jours, day_3: true }] },
        '/v4/customers/9003/scheduler/current': { schedules: [] }
      }, textes: { notes: { at: '2026-11-05', texte: 'Autre Client\nAC' } } },
      104: { api: { '/v4/customers/9004/workouts': { workouts: [{ id: 501, title: 'Full body A' }] } }, textes: {} }
    },
    workouts: {
      502: { id: 502, name: 'Haut du corps', exercises: [{ name: 'Développé couché', sets: [{ reps: 5, weight: 50 }] }] }
    },
    erreurs: []
  }
}
// Détail des séances (fichier seances.json : { id: { workout } }).
const SEANCES = {
  501: { workout: { id: 501, name: 'Full body A', description: '<p>Échauffement 10 min</p>', exercises: [
    { name: 'Squat', sets: [{ reps: 10, weight: 40, rest: 90 }, { reps: 8, weight: 45, rest: 90 }], notes: 'Dos droit' },
    { name: 'Pompes', sets: 3, reps: '8-12', superset_id: 'A' },
    { name: 'Rowing haltère', sets: 3, reps: 10, weight: 12, superset_id: 'A', rest: 60 },
    { name: 'Gainage', sets: [{ time: '0:45' }], tempo_magique: 'x' }
  ] } },
  601: { workout: { id: 601, name: 'Mobilité', exercises: [{ name: 'Chat-vache', sets: [{ reps: 10 }] }] } }
}
const OPTIONS = { seances: SEANCES, exclure: ['Corentin Delmée'] }

describe('normaliser (fonctions)', () => {
  it('dates, mensurations, traduction PAR-Q', () => {
    expect(jourDe('2026-11-01 08:00:00')).toBe('2026-11-01')
    expect(jourDe('05/11/2026')).toBe('2026-11-05')
    expect(jourDe(1762333200)).toBe('2025-11-05')
    expect(cleMensuration('circ_waist')).toBe('tourDeTaille')
    expect(cleMensuration('circ_thigh_r')).toBe('tourDeCuisseDroit')
    expect(cleMensuration('weight')).toBe(null)
    expect(cleMensuration('circ_legacy')).toBe(null)
    expect(questionFr('Do you feel pain in your chest when you do physical activity?')).toMatch(/^Ressentez-vous une douleur/)
    expect(questionFr('Autre chose')).toBe('Autre chose')
  })
  it('séance : séries, fourchettes, superset par superset_id, repos, consignes', () => {
    const s = seanceDe(SEANCES[501].workout)
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

describe('séances au format réel (workout.groups)', () => {
  // Séance inventée, à la forme de GET /v4/workouts/<id> -> { workout } (assigned_customers jamais lu).
  const w = { title: 'Jambes', note: 'Bien chauffer', metadata: { description: 'Bloc force' }, assigned_customers: [{ user: { email: 'x@exemple.test' } }], groups: [
    { group_type: 'standalone', exercises: [{ exercise: { name: 'Squat', note: 'Talons au sol', description: 'Pieds largeur épaules', video_type: 'youtube', video_id: 'abcDEF12345' },
      meta: { field_1: 'weight', field_1_label: 'kg', field_2: 'rep_range', field_3: 'tempo', field_4: 'rest_period', sets: [{ field_1: 60, field_2: '8.12', field_3: 3010, field_4: 90 }, { field_1: 65, field_2: '7.80', field_3: 3010, field_4: 90 }] } }] },
    { group_type: 'giantset', exercises: [
      { exercise: { name: 'Fentes' }, meta: { field_1: 'bodyweight', field_2: 'reps', sets: [{ field_2: 12 }] } },
      { exercise: { name: 'Gainage' }, meta: { field_2: 'time', field_4: 'rest_period', sets: [{ field_2: 45, field_4: 60 }] } },
      { exercise: { name: 'Course' }, meta: { type: 'interval', field_2: 'time', field_3: 'speed', field_3_label: 'kph', field_5: 'state', sets: [{ field_2: 60, field_3: 11.5, field_5: 1 }] } }
    ] }
  ] }
  const rapport = {}
  const s = seanceDe(w, rapport)
  it('exercices, séries (charge, fourchette, tempo), repos, consignes, vidéo', () => {
    expect(s).toMatchObject({ nom: 'Jambes', consignes: 'Bien chauffer\nBloc force' })
    expect(s.blocs[0]).toEqual({ type: 'exercice', nom: 'Squat', repos: 90, consignes: 'Talons au sol', description: 'Pieds largeur épaules', video: 'https://www.youtube.com/watch?v=abcDEF12345',
      series: [{ poids: 60, fourchetteReps: '8-12', tempo: '3010' }, { poids: 65, fourchetteReps: '7-8', tempo: '3010' }] })
  })
  it('giantset -> superset ; poids du corps, temps, vitesse et méthode en consignes ; colonne inconnue signalée', () => {
    const b = s.blocs[1]
    expect(b.type).toBe('superset')
    expect(b.repos).toBe(60)
    expect(b.exercices.map((x) => x.nom)).toEqual(['Fentes', 'Gainage', 'Course'])
    expect(b.exercices[0].series).toEqual([{ poidsDuCorps: true, reps: 12 }])
    expect(b.exercices[2].series).toEqual([{ tempsTravail: 60 }])
    expect(b.exercices[2].consignes).toBe('Méthode : intervalles.\nvitesse 11,5 kph.')
    expect(rapport['seance.sets.state']).toBe(1)
    expect(JSON.stringify(s)).not.toContain('exemple.test')
  })
  it('fourchettes de répétitions', () => {
    expect(['8.12', '5.08', '15.20', '7.80', '10-15'].map(fourchette)).toEqual(['8-12', '5-8', '15-20', '7-8', '10-15'])
  })
})

describe('normaliser (export complet)', () => {
  const n = normaliser(exportSynthetique(), OPTIONS)
  const [zoe, marc, lea] = n.clients
  it('profil, archivage des inactifs (> 30 jours), compte du coach exclu', () => {
    expect(n.clients).toHaveLength(3)
    expect(n.rapport.exclus).toBe(1)
    expect(zoe.profil).toMatchObject({ nom: 'Zoé Testeuse', email: 'zoe@exemple.test', telephone: '0600000000', dateNaissance: '1990-04-12', sexe: 'femme', objectifs: ['Perdre 5 kg', 'Courir 10 km'] })
    expect(zoe.archive).toBe(false)
    expect(marc.archive).toBe(true)
    expect(lea.archive).toBe(false)
    expect(zoe.source).toEqual({ mypthub_contact_id: '101', customer_id: '9001' })
  })
  it('aucun champ ni valeur de paiement', () => {
    const t = JSON.stringify(n.clients)
    for (const mot of ['stripe', 'cus_X', 'last_four', '4242', 'card_brand', 'payment', 'Paiement 40']) expect(t).not.toContain(mot)
    expect(Object.keys(n.rapport.paiementRetire).sort()).toEqual(['card_brand', 'last_four', 'payment_method', 'stripe_customer_id'])
  })
  it('mesures (poids, tours) et bilans (taille, masse grasse, FC, tension)', () => {
    // La mesure du 15/10 vient du journal d'activité (page de mesures non exportée).
    expect(zoe.mesures).toEqual([
      { date: '2026-09-01', poids: 70.5, mensurations: { tourDeBrasGauche: 30, tourDeBrasDroit: 30.5, tourDeTaille: 80 } },
      { date: '2026-10-01', poids: 69.2, mensurations: { tourDeTaille: 78 } },
      { date: '2026-10-15', poids: 69.8 }
    ])
    expect(zoe.bilans).toEqual([{ date: '2026-09-01', valeurs: { taille: 168, masseGrasse: 25, fcRepos: 62, tensionSystolique: 120 } }])
    expect(n.rapport.champsNonConvertis['metrics.mood_score']).toBe(1)
  })
  it('PAR-Q en français, allergies et notes dans les notes du coach', () => {
    expect(zoe.parq.questions).toEqual([
      { question: 'Êtes-vous diabétique ?', reponse: 'Non' },
      { question: expect.stringMatching(/^Avez-vous des douleurs de dos/), reponse: 'Oui — Genou' },
      { question: 'Question maison non traduite', reponse: 'Oui' }
    ]) // question sans réponse (autre sexe / non posée) écartée
    expect(zoe.parq.date).toBe('2026-03-01')
    expect(zoe.notesCoach).toContain('Blessures (PAR-Q) : Entorse 2024')
    expect(zoe.notesCoach).toContain('Blessures : Épaule gauche')
    expect(zoe.notesCoach).toContain('Perdre 5 kg')
    expect(zoe.notesCoach).toContain('Allergies : arachides')
    expect(zoe.notesCoach).toContain('Genou droit fragile')
    expect(zoe.notesCoach).toContain('Photos de progression (non importées) : 2 (du 01/09/2026 au 01/10/2026)')
    expect(zoe.notesCoach).toContain('Séance faite : Full body A (40 min) — ressenti : « Dur mais top »')
    expect(zoe.notesCoach).not.toContain('Squat 60 kg') // rubriques texte ignorées quand l'API est là
    // Texte d'écran jamais repris quand le client a des données d'API (il peut contenir la liste des autres clients).
    expect(lea.notesCoach).not.toContain('Autre Client')
    expect(zoe.notesCoach).not.toContain('https://temp')
    // Secours : pas d'API de mesures -> texte de l'écran gardé dans les notes.
    expect(marc.notesCoach).toContain('Poids 82 kg')
  })
  it('séances et programme par semaine avec jours fixes', () => {
    expect(zoe.seances.map((s) => s.sourceId).sort()).toEqual(['501', '502'])
    expect(zoe.programmes).toEqual([{ sourceId: '77', nom: 'Bloc automne', debut: '2026-10-05', fin: '2026-12-20', semaines: [['501', '502'], ['501']], joursFixes: { 501: 1, 502: 3 }, termine: false }])
    expect(zoe.seances.find((s) => s.sourceId === '502').consignes).toBe('Note d\'assignation')
    // Séances assignées sans programme : client actif -> programme répété ; client archivé -> séances simples.
    expect(lea.programmes).toEqual([{ sourceId: 'assignees', nom: 'Séances MyPTHub', mode: 'repete', debut: '2026-11-02', workouts: ['601'], joursFixes: { 601: 2 }, termine: false }])
    expect(lea.seances[0].blocs[0].nom).toBe('Chat-vache')
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
    const r = await importer({ db, backend }, normaliser(exportSynthetique(), OPTIONS), { essai: true, now: () => NOW })
    expect(r.codes).toEqual([])
    expect(r.bilan.clients.map((c) => c.action)).toEqual(['créé', 'créé', 'complété'])
    expect(r.bilan.clients[0]).toMatchObject({ mesures: 3, seances: 2, programmes: 1, reponses: 2 })
    expect(['profiles', 'comptes', 'mesures', 'workouts', 'exercices'].map(compter)).toEqual(avant)
  })

  it('import réel : clients, comptes, codes avant validation, complète sans écraser', async () => {
    let codesVus = null
    res1 = await importer({ db, backend }, normaliser(exportSynthetique(), OPTIONS), { now: () => NOW, avantValidation: (c) => { codesVus = c } })
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
    expect(res1.bilan.exercicesCrees).toBe(5)
    // Aucun champ de paiement dans toute la base.
    const tout = JSON.stringify(db.prepare('SELECT * FROM profiles').all()) + JSON.stringify(['mesures', 'reponses', 'workouts', 'questionnaires', 'programmes'].map((t) => db.prepare(`SELECT data FROM ${t}`).all()))
    for (const mot of ['stripe', 'last_four', '4242', 'payment', 'card_brand']) expect(tout).not.toContain(mot)
  })

  it('idempotent : un 2e passage ne crée rien', async () => {
    const avant = ['profiles', 'comptes', 'mesures', 'workouts', 'programmes', 'questionnaires', 'reponses', 'exercices'].map(compter)
    const r = await importer({ db, backend }, normaliser(exportSynthetique(), OPTIONS), { now: () => NOW })
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
    expect((await de('mesures')).map((m) => m.poids).sort()).toEqual([69.2, 69.8, 70.5])
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
