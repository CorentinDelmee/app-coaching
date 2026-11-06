// data.exercices.* enrichi : adaptateur local (démo) et adaptateur api (routes du contrat, fetch simulé).
import { describe, expect, it } from 'vitest'
import { creerAdapterApi } from '../../src/data/adapters/api.js'
import { creerAdapterLocal, stockageMemoire } from '../../src/data/adapters/local.js'

const NOW = new Date(2026, 9, 20, 10, 0).getTime()
const local = () => creerAdapterLocal({ storage: stockageMemoire(), now: () => NOW })

describe('local : recherche, détail, mise à jour, photo', () => {
  it('recherche filtrée et paginée', async () => {
    const d = local()
    await d.connecter('corentin', 'COACH2026')
    const tout = await d.exercices.recherche()
    expect(tout.total).toBe(80); expect(tout.items).toHaveLength(80)
    expect((await d.exercices.recherche({ muscle: 'fessiers', niveau: 'debutant' })).items.map((e) => e.nom)).toContain('Squat gobelet')
    expect((await d.exercices.recherche({ materiel: 'kettlebell' })).items.every((e) => e.materiel.includes('Kettlebell'))).toBe(true)
    expect((await d.exercices.recherche({ video: 'propose' })).total).toBeGreaterThanOrEqual(20)
    expect((await d.exercices.recherche({ video: 'aucune' })).total).toBe(80 - (await d.exercices.recherche({ video: 'propose' })).total)
    expect(await d.exercices.recherche({ limite: 5, decalage: 78, q: 'ZZZ' })).toEqual({ items: [], total: 0 })
    expect((await d.exercices.recherche({ limite: 3 })).items).toHaveLength(3)
  })
  it('détail : utiliseDans pour le coach, rien de privé pour un client', async () => {
    const d = local()
    await d.connecter('corentin', 'COACH2026')
    await d.exercices.mettreAJour('ex-squat', { notesPrivees: 'genou droit fragile' })
    const c = await d.exercices.detail('ex-squat')
    expect(c.notesPrivees).toBe('genou droit fragile'); expect(c.utiliseDans).toBeGreaterThan(0); expect(c.video.statut).toBe('propose')
    expect(await d.exercices.detail('nope')).toBeNull()
    await d.deconnecter()
    await d.connecter('fabien.vincent', 'DEMO2024')
    const k = await d.exercices.detail('ex-squat')
    expect(k.nom).toBe('Squat')
    for (const champ of ['notesPrivees', 'utiliseDans', 'utiliseDansProgrammes']) expect(k).not.toHaveProperty(champ)
  })
  it('mettreAJour : fusion, effacement, champs calculés et valeurs hors limites refusés', async () => {
    const d = local()
    await d.connecter('corentin', 'COACH2026')
    const m = await d.exercices.mettreAJour('ex-squat', { tempo: '', niveau: 'confirme', reposConseille: 90 })
    expect(m).toMatchObject({ niveau: 'confirme', reposConseille: 90, nom: 'Squat' }); expect(m).not.toHaveProperty('tempo')
    for (const patch of [{ video: null }, { photo: null }, { utiliseDans: 2 }, { niveau: 'dieu' }, { reposConseille: 601 }, { nom: '' }]) await expect(d.exercices.mettreAJour('ex-squat', patch)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(d.exercices.mettreAJour('nope', { tempo: '1' })).rejects.toMatchObject({ code: 'INTROUVABLE' })
  })
  it('photo en data-URL, puis retrait ; creer accepte les nouveaux champs', async () => {
    const d = local()
    await d.connecter('corentin', 'COACH2026')
    const e = await d.exercices.envoyerPhoto('ex-squat', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }))
    expect(e.photo.url).toBe('data:image/webp;base64,AQID'); expect(e.photo.id).toMatch(/^p-/)
    expect((await d.exercices.detail('ex-squat')).photo.url).toMatch(/^data:/)
    expect((await d.exercices.retirerPhoto('ex-squat')).photo).toBeNull()
    // validation de la vidéo : proposée -> validée ; refusée sans vidéo
    expect((await d.exercices.detail('ex-squat')).video.statut).toBe('propose')
    expect((await d.exercices.validerVideo('ex-squat')).video.statut).toBe('valide')
    await expect(d.exercices.validerVideo('nope')).rejects.toMatchObject({ code: 'INTROUVABLE' })
    const n = await d.exercices.creer({ nom: 'Test', categories: [], niveau: 'debutant', materiel: ['Haltères'] })
    expect((await d.exercices.detail(n.id)).materiel).toEqual(['Haltères'])
  })
})

function faux(routes) {
  const appels = []
  const fetchFn = async (url, init) => {
    appels.push({ url, ...init })
    const r = routes[`${init.method} ${url}`]
    return r ? new Response(JSON.stringify(r[1]), { status: r[0] }) : new Response(JSON.stringify({ erreur: 'introuvable' }), { status: 404 })
  }
  return { appels, api: creerAdapterApi({ fetchFn, storage: stockageMemoire() }) }
}

describe('api : routes du contrat', () => {
  const item = { id: 'e1', nom: 'Squat', categories: [], photo: null, video: null }
  it('recherche (filtres vides ignorés), détail 404 -> null, patch, photo', async () => {
    const { api, appels } = faux({
      'GET /api/app/exercices?q=squat&muscle=fessiers&limite=10': [200, { items: [item], total: 1 }],
      'GET /api/app/exercices': [200, { items: [], total: 0 }],
      'GET /api/app/exercices/e1': [200, { item }],
      'PATCH /api/app/exercices/e1': [200, { item: { ...item, tempo: '3-1-1' } }],
      'POST /api/app/exercices/e1/photo': [200, { item: { ...item, photo: { id: 'p-1', url: '/u' } } }],
      'POST /api/app/exercices/e2/photo': [415, { erreur: 'type_refuse' }],
      'POST /api/app/exercices/e3/photo': [413, { erreur: 'trop_gros' }],
      'DELETE /api/app/exercices/e1/photo': [200, { item }]
    })
    expect(await api.exercices.recherche({ q: 'squat', muscle: 'fessiers', limite: 10, niveau: '', video: undefined })).toEqual({ items: [item], total: 1 })
    expect(await api.exercices.recherche()).toEqual({ items: [], total: 0 })
    expect((await api.exercices.detail('e1')).id).toBe('e1')
    expect(await api.exercices.detail('nope')).toBeNull()
    expect((await api.exercices.mettreAJour('e1', { tempo: '3-1-1' })).tempo).toBe('3-1-1')
    expect(JSON.parse(appels.find((a) => a.method === 'PATCH').body)).toEqual({ tempo: '3-1-1' })
    const blob = new Blob([new Uint8Array([1])], { type: 'image/webp' })
    expect((await api.exercices.envoyerPhoto('e1', blob)).photo.id).toBe('p-1')
    const post = appels.find((a) => a.url.endsWith('/photo') && a.method === 'POST')
    expect(post.headers['Content-Type']).toBe('image/webp'); expect(post.body).toBe(blob)
    await expect(api.exercices.envoyerPhoto('e2', blob)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.exercices.envoyerPhoto('e3', blob)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await api.exercices.retirerPhoto('e1')).photo).toBeNull()
  })
})
