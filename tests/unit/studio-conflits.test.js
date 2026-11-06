// Conflits d'écriture (Claude / autre appareil) : couche de données (local, api) + useSauvegardeAuto + useRafraichirAuRetour.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerAdapterApi } from '../../src/data/adapters/api.js'
import { creerAdapterLocal, stockageMemoire } from '../../src/data/adapters/local.js'
import { useSauvegardeAuto } from '../../src/coach/studio/useSauvegardeAuto.js'
import { creerRafraichirAuRetour } from '../../src/coach/studio/useRafraichirAuRetour.js'

const local = async () => {
  const d = creerAdapterLocal({ storage: stockageMemoire(), now: () => Date.UTC(2026, 10, 6, 10) })
  await d.connecter('corentin', 'COACH2026')
  return d
}

describe('adaptateur local : version et conflit simulé', () => {
  it('les lignes de démo valent 1 ; chaque écriture +1 ; une version périmée -> CONFLIT avec actuel, rien d\'écrasé', async () => {
    const d = await local()
    const [w] = await d.workouts.lister()
    expect(w.version).toBe(1)
    const ouvert = await d.workouts.lire(w.id) // l'écran ouvre la séance
    const dessous = await d.workouts.modifier(w.id, { nom: 'Changé par Claude' }) // « en dessous », sans version
    expect(dessous.version).toBe(2)
    await expect(d.workouts.modifier(w.id, { ...ouvert, nom: 'Écran' }, { version: ouvert.version }))
      .rejects.toMatchObject({ code: 'CONFLIT', actuel: { nom: 'Changé par Claude', version: 2 } })
    expect((await d.workouts.lire(w.id)).nom).toBe('Changé par Claude')
    const ok = await d.workouts.modifier(w.id, { nom: 'Écran' }, { version: 2 })
    expect(ok).toMatchObject({ nom: 'Écran', version: 3 })
  })
  it('creer renvoie la version 1 ; une `version` dans l\'objet est ignorée (la version stockée fait foi)', async () => {
    const d = await local()
    const q = await d.questionnaires.creer({ nom: 'Bilan', frequence: 'ponctuel', clientId: null, questions: [{ id: 'q1', cle: 'forme', libelle: 'Forme', type: 'curseur' }] })
    expect(q.version).toBe(1)
    expect((await d.questionnaires.modifier(q.id, { version: 99, nom: 'B2' })).version).toBe(2)
  })
  it('exercices.mettreAJour : même règle ; un lien saisi par le coach est validé', async () => {
    const d = await local()
    const [e] = (await d.exercices.recherche({ limite: 1 })).items
    await d.exercices.mettreAJour(e.id, { tempo: '2-0-2' })
    await expect(d.exercices.mettreAJour(e.id, { tempo: '3-0-3' }, { version: e.version })).rejects.toMatchObject({ code: 'CONFLIT' })
    const r = await d.exercices.mettreAJour(e.id, { lienVideo: 'https://www.youtube.com/watch?v=zzzzzzzzzzz' }, { version: e.version + 1 })
    expect(r.video.statut).toBe('valide')
    expect(r.tempo).toBe('2-0-2')
  })
  it('profils : même règle', async () => {
    const d = await local()
    const [c] = (await d.profils.lister()).filter((p) => p.role === 'client')
    await d.profils.modifier(c.id, { tarif: 50 })
    await expect(d.profils.modifier(c.id, { tarif: 40 }, { version: c.version })).rejects.toMatchObject({ code: 'CONFLIT', actuel: { tarif: 50 } })
  })
})

describe('adaptateur api : If-Match et 409 conflit', () => {
  function faux(routes) {
    const appels = []
    const fetchFn = async (url, init) => {
      appels.push({ url, ...init })
      const [statut, corps] = routes[`${init.method} ${url}`] ?? [404, { erreur: 'x' }]
      return new Response(JSON.stringify(corps), { status: statut })
    }
    return { appels, api: creerAdapterApi({ fetchFn, storage: stockageMemoire() }) }
  }
  const w = { id: 'w1', nom: 'S', blocs: [], version: 3 }
  it('modifier avec version : en-tête If-Match ; réponse 200 -> objet du serveur (nouvelle version)', async () => {
    const { api, appels } = faux({ 'GET /api/app/e/workouts/w1': [200, { item: w }], 'PUT /api/app/e/workouts/w1': [200, { item: { ...w, nom: 'T', version: 4 } }] })
    expect(await api.workouts.modifier('w1', { nom: 'T' }, { version: 3 })).toMatchObject({ nom: 'T', version: 4 })
    expect(appels[1].headers['If-Match']).toBe('3')
  })
  it('sans version donnée : la version lue est envoyée (audit M2, pas d écrasement)', async () => {
    const { api, appels } = faux({ 'GET /api/app/e/workouts/w1': [200, { item: w }], 'PUT /api/app/e/workouts/w1': [200, { item: w }] })
    await api.workouts.modifier('w1', { nom: 'T' })
    expect(appels[1].headers['If-Match']).toBe(String(w.version ?? 1))
  })
  it('409 conflit -> ErreurData CONFLIT avec actuel ; 409 existe_deja reste EXISTE', async () => {
    const actuel = { ...w, nom: 'Par Claude', version: 4 }
    const { api } = faux({ 'GET /api/app/e/workouts/w1': [200, { item: w }], 'PUT /api/app/e/workouts/w1': [409, { erreur: 'conflit', actuel }], 'PATCH /api/app/exercices/e1': [409, { erreur: 'conflit', actuel: { id: 'e1' } }], 'PUT /api/app/e/workouts/w2': [409, { erreur: 'existe_deja' }] })
    await expect(api.workouts.modifier('w1', { nom: 'T' }, { version: 3 })).rejects.toMatchObject({ code: 'CONFLIT', actuel })
    await expect(api.exercices.mettreAJour('e1', { tempo: '1' }, { version: 1 })).rejects.toMatchObject({ code: 'CONFLIT', actuel: { id: 'e1' } })
    await expect(api.workouts.creer({ id: 'w2', nom: 'N', blocs: [] })).rejects.toMatchObject({ code: 'EXISTE' })
  })
})

describe('useSauvegardeAuto : conflits', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  const conflit = (actuel) => Object.assign(new Error('Modifié ailleurs'), { code: 'CONFLIT', actuel })

  it('envoie la version suivie, la met à jour après chaque écriture', async () => {
    let v = 5
    const ecrit = vi.fn(async (val, opts) => ({ ...val, version: ++v }))
    const s = useSauvegardeAuto(ecrit, { delai: 10 })
    s.suivreVersion(5)
    s.planifier({ nom: 'a' }); await vi.advanceTimersByTimeAsync(10)
    s.planifier({ nom: 'b' }); await vi.advanceTimersByTimeAsync(10)
    expect(ecrit.mock.calls.map((c) => c[1])).toEqual([{ version: 5 }, { version: 6 }])
  })
  it('sans suivreVersion : appel inchangé (une seule valeur)', async () => {
    const ecrit = vi.fn(async () => ({ version: 9 }))
    const s = useSauvegardeAuto(ecrit, { delai: 10 })
    s.planifier('x'); await vi.advanceTimersByTimeAsync(10)
    expect(ecrit.mock.calls[0]).toEqual(['x'])
  })
  it('CONFLIT : file arrêtée, état « conflit » avec la saisie et son résumé ; Recharger applique actuel et reprend avec sa version', async () => {
    const actuel = { nom: 'Par Claude', version: 7 }
    const ecrit = vi.fn(async () => { throw conflit(actuel) })
    const applique = vi.fn()
    const s = useSauvegardeAuto(ecrit, { delai: 10, recharger: applique, resumer: (v) => v.nom })
    s.suivreVersion(6)
    s.planifier({ nom: 'Ma saisie' }); await vi.advanceTimersByTimeAsync(10)
    expect(s.etat.value).toBe('conflit')
    expect(s.conflit.value).toMatchObject({ actuel, resume: 'Ma saisie' })
    s.planifier({ nom: 'Encore' }); await vi.advanceTimersByTimeAsync(100) // rien n'est réécrit
    expect(ecrit).toHaveBeenCalledTimes(1)
    expect(s.conflit.value.resume).toBe('Encore')
    expect(s.occupe()).toBe(true)
    await s.arreter() // démontage : pas d'écriture en conflit
    expect(ecrit).toHaveBeenCalledTimes(1)
    expect(s.recharger()).toBe(actuel)
    expect(applique).toHaveBeenCalledWith(actuel)
    expect(s.etat.value).toBe('repos')
    ecrit.mockImplementation(async (v) => ({ ...v, version: 8 }))
    s.planifier({ nom: 'Après' }); await vi.advanceTimersByTimeAsync(10)
    expect(ecrit.mock.calls[1][1]).toEqual({ version: 7 })
    expect(s.etat.value).toBe('ok')
  })
  it('réponse d\'une écriture lancée avant un changement d\'objet : la version du nouvel objet est gardée', async () => {
    let finir
    const ecrit = vi.fn((v, o) => (o.version === 1 ? new Promise((r) => { finir = () => r({ version: 2 }) }) : Promise.resolve({ version: 11 })))
    const s = useSauvegardeAuto(ecrit, { delai: 10 })
    s.suivreVersion(1)
    s.planifier('A'); await vi.advanceTimersByTimeAsync(10)
    s.suivreVersion(10) // on ouvre l'objet B
    finir(); await vi.advanceTimersByTimeAsync(0)
    s.planifier('B'); await vi.advanceTimersByTimeAsync(10)
    expect(ecrit.mock.calls[1][1]).toEqual({ version: 10 })
  })
})

describe('useRafraichirAuRetour', () => {
  function cible() {
    const ev = { document: {}, window: {} }
    const doc = { visibilityState: 'visible', l: {}, addEventListener: (t, f) => { doc.l[t] = f }, removeEventListener: (t) => { delete doc.l[t] } }
    const win = { l: {}, addEventListener: (t, f) => { win.l[t] = f }, removeEventListener: (t) => { delete win.l[t] } }
    ev.document = doc; ev.window = win
    return ev
  }
  it('recharge au retour (visible / focus), au plus une fois par intervalle, jamais pendant une saisie', async () => {
    let t = 0
    const c = cible()
    const fn = vi.fn()
    let occupe = false
    const r = creerRafraichirAuRetour(fn, { cible: c, now: () => t, sauvegarde: { occupe: () => occupe } })
    r.brancher()
    t = 1000; await c.document.l.visibilitychange()
    expect(fn).not.toHaveBeenCalled() // < 2 s après le chargement
    t = 5000; await c.document.l.visibilitychange(); await c.window.l.focus()
    expect(fn).toHaveBeenCalledTimes(1) // visibilité + focus ensemble = un seul rechargement
    occupe = true; t = 10000; await c.window.l.focus()
    expect(fn).toHaveBeenCalledTimes(1)
    occupe = false; c.document.visibilityState = 'hidden'; await c.document.l.visibilitychange()
    expect(fn).toHaveBeenCalledTimes(1)
    r.debrancher()
    expect(c.document.l.visibilitychange).toBeUndefined()
  })
})
