// Cache des lectures récentes (src/data/cache.js) : affichage immédiat, invalidation par les écritures,
// jamais de version périmée envoyée par un éditeur, jamais les données d'une autre session.
import { describe, expect, it } from 'vitest'
import { creerAdapterLocal, stockageMemoire } from '../../src/data/adapters/local.js'
import { avecInvalidation, creerCacheLectures, creerLectureRapide } from '../../src/data/cache.js'

const NOW = Date.UTC(2026, 10, 6, 10)
async function monter() {
  const storage = stockageMemoire()
  const data = creerAdapterLocal({ storage, now: () => NOW })
  await data.connecter('corentin', 'COACH2026')
  // « Claude » (outils MCP) ou un autre appareil : écrit dans la même base sans passer par l'enveloppe du cache
  const autre = { workouts: { modifier: data.workouts.modifier }, connecter: async () => {} }
  const cache = creerCacheLectures({ now: () => NOW })
  avecInvalidation(data, cache)
  return { data, cache, lecture: creerLectureRapide(cache), autre }
}
const differe = () => { let ok; const p = new Promise((r) => { ok = r }); return { p, ok } }

describe('cache de lectures', () => {
  it('rend une copie : modifier la valeur lue ne change pas le cache', () => {
    const c = creerCacheLectures()
    c.ecrire('k', { a: [1] }, ['workouts'])
    const v = c.lire('k'); v.a.push(2)
    expect(c.lire('k')).toEqual({ a: [1] })
  })
  it('expire après ageMax et oublie les plus anciennes au-delà de max', () => {
    let t = 0
    const c = creerCacheLectures({ now: () => t, ageMax: 1000, max: 2 })
    c.ecrire('a', 1); c.ecrire('b', 2); c.ecrire('c', 3)
    expect(c.lire('a')).toBeUndefined()
    t = 1001
    expect(c.lire('b')).toBeUndefined()
  })
  it('une écriture passée par data invalide l\'entité (avant et après l\'appel), pas les autres', async () => {
    const { data, cache } = await monter()
    const [w] = await data.workouts.lister()
    cache.ecrire('liste-w', [w], ['workouts'])
    cache.ecrire('liste-q', [], ['questionnaires'])
    await data.workouts.modifier(w.id, { nom: 'Nouveau nom' })
    expect(cache.lire('liste-w')).toBeUndefined()
    expect(cache.lire('liste-q')).toEqual([])
  })
  it('les méthodes d\'exercices enrichis (mettreAJour, validerVideo…) invalident « exercices »', async () => {
    const { data, cache } = await monter()
    const { items } = await data.exercices.recherche({ limite: 1 })
    cache.ecrire('exos', items, ['exercices'])
    await data.exercices.mettreAJour(items[0].id, { notes: 'x' }).catch(() => {})
    expect(cache.lire('exos')).toBeUndefined()
  })
  it('connexion / déconnexion vident tout le cache (jamais les données d\'une autre session)', async () => {
    const { data, cache } = await monter()
    cache.ecrire('k', 1, [])
    await data.deconnecter()
    expect(cache.lire('k')).toBeUndefined()
    cache.ecrire('k', 1, [])
    await data.connecter('corentin', 'COACH2026')
    expect(cache.lire('k')).toBeUndefined()
  })
  it('une lecture partie AVANT une écriture n\'est pas rangée en cache', async () => {
    const { data, cache } = await monter()
    const [w] = await data.workouts.lister()
    const jeton = cache.instantane(['workouts'])
    await data.workouts.modifier(w.id, { nom: 'Écrit pendant la lecture' })
    expect(cache.ecrire('k', [w], ['workouts'], jeton)).toBe(false)
    expect(cache.lire('k')).toBeUndefined()
  })
})

describe('lectureRapide', () => {
  it('applique le cache tout de suite puis la lecture fraîche', async () => {
    const { lecture } = await monter()
    const vus = []
    await lecture('k', ['workouts'], async () => 'v1', (v, o) => vus.push([v, o.depuisCache]))
    await lecture('k', ['workouts'], async () => 'v2', (v, o) => vus.push([v, o.depuisCache]))
    expect(vus).toEqual([['v1', false], ['v1', true], ['v2', false]])
  })
  it('attendre:false rend la main dès le cache appliqué ; sans cache, attend la lecture', async () => {
    const { lecture } = await monter()
    await lecture('k', [], async () => 1, () => {})
    const d = differe()
    const vus = []
    const r = await lecture('k', [], () => d.p, (v) => vus.push(v), { attendre: false })
    expect(r.depuisCache).toBe(true)
    expect(vus).toEqual([1])
    d.ok(2); await r.frais
    expect(vus).toEqual([1, 2])
  })
  it('deux lectures simultanées partagent la requête ; après une écriture, une nouvelle lecture repart', async () => {
    const { data, lecture } = await monter()
    let appels = 0
    const d = differe()
    const charger = () => { appels++; return d.p }
    const a = lecture('k', ['workouts'], charger, () => {})
    const b = lecture('k', ['workouts'], charger, () => {})
    await Promise.resolve(); await Promise.resolve()
    expect(appels).toBe(1)
    const [w] = await data.workouts.lister()
    await data.workouts.modifier(w.id, { nom: 'x' })
    const c = lecture('k', ['workouts'], async () => { appels++; return 'apres' }, () => {})
    d.ok('avant'); await Promise.all([a, b, c])
    expect(appels).toBe(2)
  })
  it('erreur de la lecture fraîche sans cache : rejetée (l\'écran affiche son erreur)', async () => {
    const { lecture } = await monter()
    await expect(lecture('k', [], async () => { throw new Error('réseau') }, () => {})).rejects.toThrow('réseau')
  })
})

describe('jamais de version périmée envoyée par un éditeur', () => {
  it('liste en cache périmée (Claude a écrit) : l\'éditeur relit frais avant d\'éditer, sa version passe', async () => {
    const { data, lecture, autre } = await monter()
    await autre.connecter('corentin', 'COACH2026')
    let liste = []
    await lecture('w', ['workouts'], () => data.workouts.lister(), (v) => { liste = v })
    const w0 = liste[0]
    await autre.workouts.modifier(w0.id, { nom: 'Changé par Claude' }) // hors de ce `data` : le cache ne le sait pas
    // l'écran revient sur la liste : le cache (périmé) s'affiche d'abord, puis la lecture fraîche
    const vus = []
    await lecture('w', ['workouts'], () => data.workouts.lister(), (v, o) => vus.push([v[0].version, o.depuisCache]))
    expect(vus).toEqual([[1, true], [2, false]])
    // l'éditeur ne part pas de la liste : il relit l'objet (data.<entite>.lire n'est jamais servi par le cache)
    const frais = await data.workouts.lire(w0.id)
    expect(frais).toMatchObject({ version: 2, nom: 'Changé par Claude' })
    const ok = await data.workouts.modifier(w0.id, { ...frais, nom: 'Écran' }, { version: frais.version })
    expect(ok.version).toBe(3)
  })
  it('si un écran envoyait quand même la version du cache : CONFLIT, rien n\'est écrasé', async () => {
    const { data, cache, autre } = await monter()
    await autre.connecter('corentin', 'COACH2026')
    const [w] = await data.workouts.lister()
    cache.ecrire('w', [w], ['workouts'])
    await autre.workouts.modifier(w.id, { nom: 'Changé par Claude' })
    const perime = cache.lire('w')[0]
    await expect(data.workouts.modifier(w.id, { ...perime, nom: 'Écran' }, { version: perime.version })).rejects.toMatchObject({ code: 'CONFLIT' })
    expect((await data.workouts.lire(w.id)).nom).toBe('Changé par Claude')
  })
  it('modifier sans version relit la ligne au stockage (jamais au cache) : le changement de Claude est gardé', async () => {
    const { data, cache, autre } = await monter()
    await autre.connecter('corentin', 'COACH2026')
    const [w] = await data.workouts.lister()
    cache.ecrire('w', [w], ['workouts'])
    await autre.workouts.modifier(w.id, { consignes: 'Ajouté par Claude' })
    const r = await data.workouts.modifier(w.id, { nom: 'Renommé à l\'écran' })
    expect(r).toMatchObject({ nom: 'Renommé à l\'écran', consignes: 'Ajouté par Claude', version: 3 })
  })
})
