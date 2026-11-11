// Bout en bout client <-> vrai serveur (bug de production du 2026-11-11) : un client créé par l'outil MCP creer_client
// consent à sa 1re connexion, puis doit accéder au programme (même session, rechargement, reconnexion).
// Avant le correctif, /moi ne renvoyait que { id, identifiant, role, profil_id } : la garde le renvoyait vers /consentement pour toujours.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAppHttp } from '../src/app-http.js'
import { creerStoreSqlite, ouvrirBase } from '../src/magasin-sqlite.js'
import { creerServeurRest } from '../src/rest.js'
import { lireConfig } from '../src/config.js'
import { outilsClients } from '../src/outils/clients.js'
import { creerAdapterApi } from '../../src/data/adapters/api.js'
import { stockageMemoire } from '../../src/data/adapters/local.js'
import { redirection } from '../../src/router/garde.js'
import { patchConsentement } from '../../src/domain/consentement.js'

const ORIGINE = 'https://app.exemple.fr'
let serveur, base, client

// fetch du navigateur simulé : chemins relatifs vers le serveur de test, Origin, cookie de session conservé (une « page » = un pot).
function navigateur(pot = { cookie: '' }) {
  const fetchFn = async (url, init) => {
    const headers = { ...init.headers, Origin: ORIGINE }
    if (pot.cookie) headers.Cookie = pot.cookie
    const r = await fetch(base + url, { ...init, headers })
    const sc = r.headers.get('set-cookie')
    if (sc) pot.cookie = sc.split(';')[0]
    return r
  }
  return { pot, data: creerAdapterApi({ fetchFn, storage: stockageMemoire() }) }
}
const vers = (user, nom, chemin) => redirection({ user, nom, chemin })

beforeAll(async () => {
  const db = ouvrirBase(':memory:')
  const store = creerStoreSqlite(db)
  const config = { ...lireConfig({}), sessionSecret: 's'.repeat(40), appOrigin: ORIGINE, fichiersDir: null }
  const appHttp = creerAppHttp({ db, store, config, journal: { ecrire() {} } })
  serveur = creerServeurRest({ config, appHttp, outils: {}, journal: { ecrire() {} }, service: {}, biblio: {} })
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${serveur.address().port}`
  client = await outilsClients({ backend: store, service: {} }).creer_client.run({ nom: 'Coaching Test' })
})
afterAll(() => serveur?.close())

describe('client créé par creer_client : consentement puis programme', () => {
  it('1re connexion -> /consentement ; après consentement : programme, rechargement et reconnexion sans retour au consentement', async () => {
    const { pot, data } = navigateur()
    const u = await data.connecter(client.identifiant, client.code)
    expect(vers(u, 'programme', '/programme')).toBe('/consentement')

    await data.profils.modifier(u.id, patchConsentement(u, true, Date.now()))
    expect(vers(await data.utilisateurCourant(), 'programme', '/programme')).toBeNull()

    // Rechargement de la page : nouvel adaptateur (cache vide), même cookie -> /moi + profil relus.
    const recharge = navigateur({ cookie: pot.cookie }).data
    const u2 = await recharge.utilisateurCourant()
    expect(u2).toMatchObject({ id: u.id, role: 'client', nom: 'Coaching Test' })
    expect(vers(u2, 'accueil', '/')).toBeNull()
    expect(vers(u2, 'suivi', '/suivi')).toBeNull() // santé acceptée

    // Déconnexion puis reconnexion.
    await recharge.deconnecter()
    const autre = navigateur().data
    expect(vers(await autre.connecter(client.identifiant, client.code), 'programme', '/programme')).toBeNull()
  })
})
