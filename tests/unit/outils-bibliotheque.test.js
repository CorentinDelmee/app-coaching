// Outils coach « exercices + vidéos » : SQLite sur fichier temporaire, YouTube simulé (aucun appel réseau).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { assembler } from '../../serveur/src/assembler.js'
import { appeler } from '../../serveur/src/outils.js'
import { lireConfig } from '../../serveur/src/config.js'
import { chercherYoutube, scorerVideo } from '../../serveur/src/youtube.js'

const CLE = 'cle-de-test-0123456789abcdef-0123456789'
const LIEN = 'https://www.youtube.com/watch?v=abcdefghijk'
let dossier, app, appels

/** API YouTube simulée : { requetes de search -> ids }, { id -> détails }. */
const VIDEOS = {
  aaaaaaaaaaa: { duree: 'PT15S', titre: 'Squat goblet démonstration', embeddable: true },
  bbbbbbbbbbb: { duree: 'PT45S', titre: 'Squat goblet long', embeddable: true },
  ccccccccccc: { duree: 'PT10S', titre: 'Squat goblet non intégrable', embeddable: false },
  ddddddddddd: { duree: 'PT25S', titre: 'goblet squat form', embeddable: true }
}
function fabriquerFetch(parRecherche) {
  appels = []
  return async (url) => {
    const u = new URL(url)
    appels.push({ chemin: u.pathname.split('/').pop(), q: u.searchParams.get('q'), params: Object.fromEntries(u.searchParams) })
    if (u.pathname.endsWith('/search')) {
      const ids = parRecherche(u.searchParams.get('q')) || []
      return { ok: true, json: async () => ({ items: ids.map((videoId) => ({ id: { videoId } })) }) }
    }
    const items = u.searchParams.get('id').split(',').map((id) => ({
      id, snippet: { title: VIDEOS[id].titre, channelTitle: 'Chaîne' }, status: { embeddable: VIDEOS[id].embeddable, privacyStatus: 'public' },
      contentDetails: { duration: VIDEOS[id].duree }, statistics: { viewCount: '5000' }
    }))
    return { ok: true, json: async () => ({ items }) }
  }
}
const outil = (nom, args) => appeler(app, nom, args, 'test')

beforeAll(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'outils-biblio-'))
  const fetchFn = async (url) => app.fetchSimule(url)
  app = await assembler({ ...lireConfig({ COACH_API_KEY: CLE, DATA_DIR: dossier, DB_FILE: join(dossier, 'test.db'), YOUTUBE_API_KEY: 'cle-yt' }) }, { now: () => Date.UTC(2026, 10, 5, 12), fetchFn })
  app.fetchSimule = fabriquerFetch(() => [])
})
afterAll(() => { app.backend.db?.close?.(); rmSync(dossier, { recursive: true, force: true }) })

describe('recherche YouTube : règle des 30 s', () => {
  it('refuse > 30 s et non intégrable, favorise ≤ 20 s, paramètres de l\'API', async () => {
    const fetchFn = fabriquerFetch(() => ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd'])
    const r = await chercherYoutube('Squat goblet', { cle: 'k', fetchFn })
    expect(r.map((v) => v.url.slice(-11))).toEqual(['aaaaaaaaaaa', 'ddddddddddd'])
    expect(r[0].score).toBeGreaterThan(r[1].score)
    const s = appels[0].params
    expect(s).toMatchObject({ videoDuration: 'short', relevanceLanguage: 'fr', regionCode: 'FR', videoEmbeddable: 'true', safeSearch: 'strict' })
    expect(appels[1].params.part).toContain('contentDetails')
    expect(appels[1].params.part).toContain('status')
    expect(appels).toHaveLength(2) // une recherche + videos.list
  })
  it('repli anglais seulement si rien en français ; 2 recherches au plus', async () => {
    const fetchFn = fabriquerFetch((q) => (q.includes('goblet squat') ? ['ddddddddddd'] : ['bbbbbbbbbbb']))
    const r = await chercherYoutube('Squat gobelet', { cle: 'k', fetchFn, nomEn: 'goblet squat' })
    expect(r).toHaveLength(1)
    expect(appels.filter((a) => a.chemin === 'search')).toHaveLength(2)
    expect(appels.find((a) => a.q?.includes('form')).params.relevanceLanguage).toBe('en')
  })
  it('durée ≤ 20 s mieux notée que 25 s', () => {
    const base = { nom: 'Pompes', titre: 'Pompes', chaine: 'x', vues: 1000 }
    expect(scorerVideo({ ...base, duree: 18 }).score).toBeGreaterThan(scorerVideo({ ...base, duree: 25 }).score)
    expect(scorerVideo({ ...base, duree: 25 }).score).toBeGreaterThan(scorerVideo({ ...base, duree: 40 }).score)
  })
})

describe('outils exercices', () => {
  it('création avec recherche auto -> vidéo proposée, puis lecture, modification, validation', async () => {
    app.fetchSimule = fabriquerFetch(() => ['bbbbbbbbbbb', 'aaaaaaaaaaa'])
    const c = await outil('creer_exercice', { nom: 'Squat goblet', categories: ['jambes'] })
    expect(c.ok).toBe(true)
    expect(c.donnees.id).toBe('ex-squat-goblet')
    expect(c.donnees.video).toMatchObject({ statut: 'propose', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' })

    const l = await outil('lister_exercices', { recherche: 'goblet' })
    expect(l.donnees.exercices[0]).toMatchObject({ nom: 'Squat goblet', categories: ['jambes'], video: { statut: 'propose' } })

    const m = await outil('modifier_exercice', { exercice: 'squat goblet', description: 'Haltère contre la poitrine' })
    expect(m.donnees.exercice.description).toBe('Haltère contre la poitrine')

    const v = await outil('valider_video', { exercice: 'Squat goblet' })
    expect(v.ok).toBe(true)
    expect(v.donnees.video.statut).toBe('valide')

    // une vidéo validée n'est pas écrasée par un simple rattachement
    const m2 = await outil('modifier_exercice', { exercice: 'ex-squat-goblet', lienVideo: LIEN })
    expect(m2.ok).toBe(false)
    expect(m2.code).toBe('VIDEO_VALIDEE')
  })
  it('doublon, lien non YouTube, exercice inconnu, aucun champ', async () => {
    expect((await outil('creer_exercice', { nom: 'squat GOBLET' })).code).toBe('EXISTE')
    expect((await outil('creer_exercice', { nom: 'Truc', lienVideo: 'https://exemple.fr/v' })).code).toBe('LIEN_INVALIDE')
    expect((await outil('modifier_exercice', { exercice: 'inconnu', nom: 'x' })).code).toBe('EXERCICE_INTROUVABLE')
    expect((await outil('modifier_exercice', { exercice: 'Squat goblet' })).code).toBe('VALIDATION')
    expect((await outil('creer_exercice', { nom: '' })).code).toBe('VALIDATION')
  })
  it('sans clé YouTube : exercice créé, avertissement ; avec lien : rattaché', async () => {
    const cleAvant = app.config.youtubeCle
    app.config.youtubeCle = ''
    const c = await outil('creer_exercice', { nom: 'Pompes diamant' })
    app.config.youtubeCle = cleAvant
    expect(c.ok).toBe(true)
    expect(c.donnees.video).toBeNull()
    expect(c.donnees.avertissement).toContain('YOUTUBE_API_KEY')
    const d = await outil('creer_exercice', { nom: 'Gainage latéral', lienVideo: LIEN })
    expect(d.donnees.exercice.video).toMatchObject({ url: LIEN, statut: 'propose' })
    expect((await outil('lister_exercices', { sansVideo: true })).donnees.exercices.map((e) => e.nom)).toContain('Pompes diamant')
  })
  it('suppression en 2 temps : rien sans jeton, mauvais jeton ou jeton d’un autre exercice refusés', async () => {
    const a = await outil('supprimer_exercice', { exercice: 'Pompes diamant' })
    expect(a.donnees.confirmationRequise).toBe(true)
    expect((await outil('lister_exercices', { recherche: 'diamant' })).donnees.total).toBe(1)
    expect((await outil('supprimer_exercice', { exercice: 'Pompes diamant', jeton: '0'.repeat(32) })).code).toBe('JETON_INVALIDE')
    expect((await outil('supprimer_exercice', { exercice: 'Gainage latéral', jeton: a.donnees.jeton })).code).toBe('JETON_INVALIDE')
    expect((await outil('lister_exercices', { recherche: 'diamant' })).donnees.total).toBe(1)
    const a2 = await outil('supprimer_exercice', { exercice: 'Pompes diamant' })
    const ok = await outil('supprimer_exercice', { exercice: 'Pompes diamant', jeton: a2.donnees.jeton })
    expect(ok.donnees).toMatchObject({ supprimee: true })
    expect((await outil('lister_exercices', { recherche: 'diamant' })).donnees.total).toBe(0)
  })
  it('refuse de supprimer un exercice utilisé dans une séance', async () => {
    await app.backend.ecrire('workouts', { id: 'w1', nom: 'Séance jambes', blocs: [{ type: 'exercice', id: 'b1', exerciceId: 'ex-squat-goblet', champs: [], series: [{ reps: 8 }] }] })
    const r = await outil('supprimer_exercice', { exercice: 'Squat goblet' })
    expect(r.code).toBe('EXERCICE_UTILISE')
    expect(r.erreur).toContain('Séance jambes')
  })
})
