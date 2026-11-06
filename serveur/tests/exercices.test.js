// Module exercices.js : validation, patch, usage, vue client, filtres (contrat docs/CONTRAT-EXERCICES-STUDIO.md).
import { describe, expect, it } from 'vitest'
import { appliquerPatch, filtrer, indexUsage, nettoyerPut, presenter, schemaCreation, schemaPatch, videoDe } from '../src/exercices.js'

const LIEN = 'https://www.youtube.com/watch?v=mKREc_xl_j8'
const biblio = { chercher: (nom) => (nom === 'Squat' ? [{ statut: 'valide', video: { url: LIEN, titre: 'T', chaine: 'C', duree: 20 } }] : []) }

describe('schémas', () => {
  it('création : nom obligatoire, clés inconnues refusées, calculés refusés', () => {
    expect(schemaCreation.safeParse({ nom: 'Squat', niveau: 'debutant', reposConseille: 60 }).success).toBe(true)
    expect(schemaCreation.safeParse({ description: 'x' }).success).toBe(false)
    expect(schemaCreation.safeParse({ nom: 'x', zzz: 1 }).success).toBe(false)
    for (const k of ['photo', 'video', 'utiliseDans', 'utiliseDansProgrammes']) expect(schemaPatch.safeParse({ [k]: 1 }).success).toBe(false)
  })
  it('limites', () => {
    expect(schemaPatch.safeParse({ niveau: 'expert' }).success).toBe(false)
    expect(schemaPatch.safeParse({ reposConseille: 601 }).success).toBe(false)
    expect(schemaPatch.safeParse({ reposConseille: 1.5 }).success).toBe(false)
    expect(schemaPatch.safeParse({ musclesPrincipaux: Array(7).fill('a') }).success).toBe(false)
    expect(schemaPatch.safeParse({ lienVideo: 'https://exemple.fr/v' }).success).toBe(false)
    expect(schemaPatch.safeParse({ lienVideo: LIEN }).success).toBe(true)
    expect(schemaPatch.safeParse({ lienVideo: '', niveau: '', tempo: '' }).success).toBe(true)
    expect(schemaPatch.safeParse({ tempo: 'x'.repeat(21) }).success).toBe(false)
  })
})

describe('appliquerPatch', () => {
  it('fusionne, efface sur "" / null / liste vide, garde categories', () => {
    const a = { id: 'e', nom: 'A', categories: ['jambes'], tempo: '3-1-1', materiel: ['Haltères'], reposConseille: 60 }
    expect(appliquerPatch(a, { tempo: '', materiel: [], reposConseille: null, niveau: 'confirme' })).toEqual({ id: 'e', nom: 'A', categories: ['jambes'], niveau: 'confirme' })
    expect(appliquerPatch(a, { categories: [] }).categories).toEqual([])
  })
})

describe('nettoyerPut', () => {
  it('ligne héritée (lienVideo null, lien non YouTube) acceptée, calculés retirés, photo du serveur gardée', () => {
    const photo = { id: 'p-1', url: '/u' }
    const r = nettoyerPut({ id: 'e', nom: 'A', categories: [], lienVideo: null, video: { x: 1 }, utiliseDans: 3, photo: { id: 'faux' } }, { photo })
    expect(r).toEqual({ id: 'e', nom: 'A', categories: [], photo })
    expect(nettoyerPut({ id: 'e', nom: 'A', categories: [], lienVideo: 'https://vimeo.com/1' }, null)).not.toBeNull()
  })
  it('refuse un objet invalide ou avec clé inconnue', () => {
    expect(nettoyerPut({ id: 'e', categories: [] }, null)).toBeNull()
    expect(nettoyerPut({ id: 'e', nom: 'A', categories: [], pirate: 1 }, null)).toBeNull()
    expect(nettoyerPut({ id: 'e', nom: 'A', niveau: 'expert' }, null)).toBeNull()
  })
})

describe('usage et présentation', () => {
  const workouts = [
    { id: 'w1', blocs: [{ exerciceId: 'a' }, { exercices: [{ exerciceId: 'b' }, { exerciceId: 'a' }] }] },
    { id: 'w2', blocs: [{ exerciceId: 'a' }] }, { id: 'w3', blocs: [{ exerciceId: 'b' }] }
  ]
  const programmes = [{ id: 'p1', workouts: ['w1', 'w2'] }, { id: 'p2', semaines: [['w2'], ['w3']] }]
  const usage = indexUsage(workouts, programmes)
  it('compte séances et programmes distincts', () => {
    expect(usage.get('a').seances.size).toBe(2)
    expect(usage.get('a').programmes.size).toBe(2)
    expect(usage.get('b').seances.size).toBe(2)
    expect(usage.get('b').programmes.size).toBe(2)
  })
  it('vue coach / client', () => {
    const ex = { id: 'a', nom: 'Squat', categories: [], lienVideo: LIEN, notesPrivees: 'secret' }
    const c = presenter(ex, { coach: true, usage, biblio })
    expect(c).toMatchObject({ notesPrivees: 'secret', utiliseDans: 2, utiliseDansProgrammes: 2, photo: null, video: { url: LIEN, statut: 'valide', titre: 'T', chaine: 'C', duree: 20 } })
    const k = presenter(ex, { coach: false, usage, biblio })
    expect(k).not.toHaveProperty('notesPrivees'); expect(k).not.toHaveProperty('utiliseDans'); expect(k).not.toHaveProperty('utiliseDansProgrammes')
    expect(presenter({ id: 'z', nom: 'Z', categories: [] }, { coach: true, usage, biblio })).toMatchObject({ utiliseDans: 0, video: null })
  })
  it('vidéo proposée si inconnue de la bibliothèque', () => {
    expect(videoDe({ nom: 'Autre', lienVideo: LIEN }, biblio)).toEqual({ url: LIEN, titre: null, chaine: null, duree: null, statut: 'propose' })
  })
})

describe('filtrer', () => {
  const l = [
    { id: '1', nom: 'Squat gobelet', description: 'Pour les jambes', categories: ['jambes'], categorie: 'Renforcement', musclesPrincipaux: ['quadriceps'], musclesSecondaires: ['gainage'], materiel: ['Haltères'], niveau: 'debutant', video: { statut: 'valide' } },
    { id: '2', nom: 'Écartés', categories: ['poussee'], materiel: ['Élastique'], niveau: 'confirme', video: { statut: 'propose' } },
    { id: '3', nom: 'Abdos', categories: [], archive: true },
    { id: '4', nom: 'Burpees', categories: ['cardio'], video: null }
  ]
  const ids = (f) => filtrer(l, f).map((e) => e.id)
  it('tri par nom, archivés masqués', () => expect(ids({})).toEqual(['4', '2', '1']))
  it('q sans accents ni casse', () => { expect(ids({ q: 'ECARTES' })).toEqual(['2']); expect(ids({ q: 'jambes' })).toEqual(['1']) })
  it('categorie (unique ou tag), muscle (principal ou secondaire), matériel, niveau', () => {
    expect(ids({ categorie: 'renforcement' })).toEqual(['1']); expect(ids({ categorie: 'cardio' })).toEqual(['4'])
    expect(ids({ muscle: 'gainage' })).toEqual(['1']); expect(ids({ muscle: 'quadriceps' })).toEqual(['1'])
    expect(ids({ materiel: 'elastique' })).toEqual(['2']); expect(ids({ niveau: 'confirme' })).toEqual(['2'])
  })
  it('video aucune / propose / valide', () => {
    expect(ids({ video: 'aucune' })).toEqual(['4']); expect(ids({ video: 'propose' })).toEqual(['2']); expect(ids({ video: 'valide' })).toEqual(['1'])
  })
})
