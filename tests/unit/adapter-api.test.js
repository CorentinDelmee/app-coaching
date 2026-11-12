import { describe, it, expect } from 'vitest'
import { creerAdapterApi } from '../../src/data/adapters/api.js'
import { creerAdapterLocal, stockageMemoire } from '../../src/data/adapters/local.js'
import { ErreurData } from '../../src/data/erreurs.js'

// fetch simulé : routes[`METHODE chemin`] = [statut, corps] ; journalise les appels.
function faux(routes) {
  const appels = []
  const fetchFn = async (url, init) => {
    appels.push({ url, ...init })
    const r = routes[`${init.method} ${url}`]
    if (r === 'reseau') throw new TypeError('Failed to fetch')
    if (!r) return new Response(JSON.stringify({ erreur: 'x' }), { status: 404 })
    return new Response(r[1] === undefined ? null : JSON.stringify(r[1]), { status: r[0] })
  }
  return { appels, api: creerAdapterApi({ fetchFn, storage: stockageMemoire() }) }
}
const coach = { id: 'c0', role: 'coach', identifiant: 'corentin', nom: 'Corentin', archive: false, creeLe: 1 }

describe('adaptateur api', () => {
  it('connexion, session, déconnexion', async () => {
    const { api, appels } = faux({ 'POST /api/app/connexion': [200, { utilisateur: coach }], 'POST /api/app/deconnexion': [200, {}], 'GET /api/app/moi': [401, {}] })
    expect((await api.connecter(' Corentin ', 'abc')).id).toBe('c0')
    expect(appels[0].credentials).toBe('same-origin')
    expect(JSON.parse(appels[0].body)).toEqual({ identifiant: 'corentin', code: 'abc', resterConnecte: true })
    expect((await api.utilisateurCourant()).id).toBe('c0')
    await api.deconnecter()
    expect(await api.utilisateurCourant()).toBeNull() // 401 de /moi
  })
  it('401 à la connexion = IDENTIFIANTS ; réseau coupé = RESEAU', async () => {
    const f = faux({ 'POST /api/app/connexion': [401, { erreur: 'non' }] })
    await expect(f.api.connecter('a', 'b')).rejects.toMatchObject({ code: 'IDENTIFIANTS' })
    const r = faux({ 'POST /api/app/connexion': 'reseau' })
    await expect(r.api.connecter('a', 'b')).rejects.toMatchObject({ code: 'RESEAU' })
  })
  it('entités : lire, écrire (PUT), supprimer, 404 -> null', async () => {
    const ex = { id: 'e1', nom: 'Squat', categories: [] }
    const { api, appels } = faux({ 'GET /api/app/e/exercices': [200, { items: [ex] }], 'GET /api/app/e/exercices/e1': [200, { item: ex }], 'PUT /api/app/e/exercices/e1': [200, {}], 'DELETE /api/app/e/exercices/e1': [204] })
    expect(await api.exercices.lister()).toHaveLength(1)
    expect((await api.exercices.lire('e1')).nom).toBe('Squat')
    expect(await api.exercices.lire('nope')).toBeNull()
    await api.exercices.modifier('e1', { nom: 'Squat 2' })
    expect(appels.some((a) => a.method === 'PUT' && JSON.parse(a.body).nom === 'Squat 2')).toBe(true)
  })
  it('403 -> INTERDIT, 400 -> VALIDATION, 401 hors connexion -> NON_CONNECTE', async () => {
    const { api } = faux({ 'GET /api/app/e/mesures': [403, { erreur: 'refusé' }], 'GET /api/app/e/douleurs': [400, { erreur: 'mauvais' }], 'GET /api/app/e/nutrition': [401, {}] })
    await expect(api.mesures.lister()).rejects.toMatchObject({ code: 'INTERDIT' })
    await expect(api.douleurs.lister()).rejects.toMatchObject({ code: 'VALIDATION', message: 'mauvais' })
    await expect(api.nutrition.lister()).rejects.toMatchObject({ code: 'NON_CONNECTE' })
  })
  it('agenda : evenements triés, dernière synchro + bilan, synchroniser renvoie le bilan, à attribuer, attribuer', async () => {
    const { api, appels } = faux({
      'GET /api/app/agenda/evenements': [200, { evenements: [{ id: 'b', debutMs: 2 }, { id: 'a', debutMs: 1 }] }],
      'GET /api/app/agenda/derniere-synchro': [200, { derniereSynchro: '2026-11-12T10:00:00.000Z', bilan: { ok: true, crees: 3 } }],
      'POST /api/app/agenda/synchroniser': [200, { bilan: { ok: true, crees: 2 } }],
      'GET /api/app/agenda/a-attribuer': [200, { groupes: [{ cle: 'coaching x', titre: 'Coaching X', nb: 2 }] }],
      'POST /api/app/agenda/attribuer': [200, { bilan: { crees: 2 } }]
    })
    const etat = await api.agenda.etat()
    expect(etat.evenements.map((e) => e.id)).toEqual(['a', 'b'])
    expect(etat.derniereSynchro).toBe(Date.parse('2026-11-12T10:00:00.000Z'))
    expect(etat.bilan).toEqual({ ok: true, crees: 3 })
    expect(await api.agenda.aAttribuer()).toHaveLength(1)
    expect(await api.agenda.attribuer('Coaching X', ['c1'])).toEqual({ crees: 2 })
    expect(JSON.parse(appels.at(-1).body)).toEqual({ titre: 'Coaching X', clientIds: ['c1'] })
  })
  it('agenda : 503 google_lecture_non_autorisee -> GOOGLE_AUTORISATION « Autorisation Google à renouveler »', async () => {
    const { api } = faux({ 'GET /api/app/moi': [200, { utilisateur: coach }], 'GET /api/app/e/profils/c0': [200, { item: coach }], 'POST /api/app/agenda/synchroniser': [503, { erreur: 'google_lecture_non_autorisee' }] })
    await expect(api.agenda.synchroniser()).rejects.toMatchObject({ code: 'GOOGLE_AUTORISATION', message: expect.stringMatching(/^Autorisation Google à renouveler/) })
  })
  it('client : ses coachings viennent seulement de la base (aucune fusion du flux Google, pas de doublon)', async () => {
    const client = { id: 'p1', role: 'client', identifiant: 'fabien', nom: 'Fabien', archive: false, creeLe: 1 }
    const s = { id: 'google:g1:p1', clientId: 'p1', date: '2099-01-01', heure: '10:00', lieu: 'domicile', statut: 'prevue', tarif: 40, source: 'google', googleId: 'g1' }
    const { api, appels } = faux({
      'GET /api/app/moi': [200, { utilisateur: client }], 'GET /api/app/e/profils/p1': [200, { item: client }],
      'GET /api/app/e/seancesCoaching': [200, { items: [s] }],
      'GET /api/app/agenda/evenements': [200, { evenements: [{ id: 'g1', statut: 'attribue', clientId: 'p1', date: '2099-01-01', heure: '10:00', debutMs: 4070912400000 }] }]
    })
    expect((await api.seancesCoaching.lister({ clientId: 'p1' })).map((x) => x.id)).toEqual(['google:g1:p1'])
    expect(appels.some((a) => a.url.includes('/agenda/'))).toBe(false)
  })
  it('réservations : chaque méthode vise le bon endpoint', async () => {
    const { api, appels } = faux({
      'GET /api/app/reservations?statut=annulees': [200, { reservations: [{ id: 'r1' }] }], 'POST /api/app/reservations/r1/annuler': [200, { ok: true, reservation: { id: 'r1' } }],
      'GET /api/app/reservations/blocages': [200, { blocages: [] }], 'POST /api/app/reservations/blocages': [201, { ok: true, blocage: { id: 'b1' } }],
      'DELETE /api/app/reservations/blocages/b1': [200, { ok: true }], 'GET /api/app/reservations/regles': [200, { dureeMin: 60 }], 'PUT /api/app/reservations/regles': [200, { dureeMin: 45 }]
    })
    expect(await api.reservations.liste('annulees')).toHaveLength(1)
    await api.reservations.annuler('r1')
    expect(await api.reservations.blocages()).toEqual([])
    expect((await api.reservations.bloquer('2026-11-05T09:00:00Z', '2026-11-05T10:00:00Z', 'x')).id).toBe('b1')
    await api.reservations.debloquer('b1')
    expect((await api.reservations.regles()).dureeMin).toBe(60)
    expect((await api.reservations.ecrireRegles({ dureeMin: 45 })).dureeMin).toBe(45)
    expect(appels).toHaveLength(7)
  })
  it('réservation indisponible (502) -> ErreurData lisible', async () => {
    const { api } = faux({ 'GET /api/app/reservations?statut=a_venir': [502, { erreur: 'reservation_indisponible' }] })
    await expect(api.reservations.liste('a_venir')).rejects.toBeInstanceOf(ErreurData)
  })
})

describe('data.reservations (démo locale)', () => {
  const NOW = Date.UTC(2026, 10, 2, 10)
  const d = () => creerAdapterLocal({ storage: stockageMemoire(), now: () => NOW }).reservations
  it('jeu de données : 4 à venir, 2 passées, 2 annulées, 2 blocages', async () => {
    const r = d()
    expect((await r.liste('a_venir')).length).toBe(4)
    expect((await r.liste('passees')).length).toBe(2)
    expect((await r.liste('annulees')).length).toBe(2)
    expect((await r.blocages()).length).toBe(2)
  })
  it('annuler déplace la réservation ; passée non annulable', async () => {
    const r = d()
    await r.annuler('rs-1')
    expect((await r.liste('annulees')).length).toBe(3)
    await expect(r.annuler('rs-5')).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('bloquer / débloquer / règles', async () => {
    const r = d()
    const b = await r.bloquer('2026-11-10T09:00:00Z', '2026-11-10T12:00:00Z', 'Perso')
    expect((await r.blocages()).length).toBe(3)
    await r.debloquer(b.id)
    expect((await r.blocages()).length).toBe(2)
    await expect(r.bloquer('2026-11-10T12:00:00Z', '2026-11-10T09:00:00Z')).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await r.regles()).dureeMin).toBe(60)
    expect((await r.ecrireRegles({ ...(await r.regles()), dureeMin: 45 })).dureeMin).toBe(45)
  })
})

// Bug de production (2026-11-11) : /moi ne renvoie que { id, identifiant, role, profil_id } ; la garde lisait ce profil vide
// et renvoyait le client vers /consentement pour toujours, même après avoir consenti.
describe('adaptateur api : profil de la session et consentement', () => {
  const moi = { id: 'p1', identifiant: 'coaching.test', role: 'client', profil_id: 'p1' }
  function serveurProfil(profil) {
    const etat = { profil: { ...profil } }
    const fetchFn = async (url, init) => {
      const cle = `${init.method} ${url}`
      if (cle === 'GET /api/app/moi') return Response.json({ utilisateur: moi })
      if (cle === 'POST /api/app/connexion') return Response.json({ utilisateur: moi })
      if (cle === 'GET /api/app/e/profils/p1') return Response.json({ item: etat.profil })
      if (cle === 'PUT /api/app/e/profils/p1') { etat.profil = JSON.parse(init.body); return Response.json({ item: etat.profil }) }
      return new Response('{}', { status: 404 })
    }
    return { etat, creer: () => creerAdapterApi({ fetchFn, storage: stockageMemoire() }) }
  }
  // forme exacte d'un profil créé par l'outil MCP creer_client (serveur/src/outils/clients.js)
  const profilNeuf = { id: 'p1', role: 'client', identifiant: 'coaching.test', nom: 'Test Coaching', tarif: 50, lieuDefaut: 'domicile', modules: { habitudes: false, photosRepas: false, calories: false }, preferences: { son: true, vibration: true, unite: 'kg' }, consentementLe: null, archive: false, creeLe: 1 }

  it('client neuf : redirigé vers /consentement, puis plus après avoir consenti (même session et après rechargement)', async () => {
    const { redirection } = await import('../../src/router/garde.js')
    const { patchConsentement } = await import('../../src/domain/consentement.js')
    const s = serveurProfil(profilNeuf)
    const api = s.creer()
    const u = await api.utilisateurCourant()
    expect(u.nom).toBe('Test Coaching') // profil complet, pas seulement l'identité de session
    expect(redirection({ user: u, nom: 'programme', chemin: '/programme' })).toBe('/consentement')
    await api.profils.modifier(u.id, patchConsentement(u, true, 1000))
    expect(redirection({ user: await api.utilisateurCourant(), nom: 'programme', chemin: '/programme' })).toBeNull()
    // rechargement de la page = nouvel adaptateur, cache vide : relu depuis le serveur
    const recharge = s.creer()
    const u2 = await recharge.utilisateurCourant()
    expect(u2.role).toBe('client')
    expect(redirection({ user: u2, nom: 'accueil', chemin: '/' })).toBeNull()
    // reconnexion : même chose
    expect(redirection({ user: await s.creer().connecter('coaching.test', 'x'), nom: 'programme', chemin: '/programme' })).toBeNull()
  })
})
