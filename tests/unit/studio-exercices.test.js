import { describe, it, expect } from 'vitest'
import { filtrer, compteParTeinte, materielsDe, categoriesDe, compteVideo, versFormulaire, construirePatch, basculer, tailleReduite, voisin, messageErreurExo, teintesDe } from '../../src/coach/studio/ecrans/exercices/logique.js'
import routes from '../../src/coach/studio/ecrans/exercices/routes.js'

const YT = 'https://www.youtube.com/watch?v=mKREc_xl_j8'
const ex = [
  { id: 'a', nom: 'Squat gobelet', description: 'Charge contre la poitrine', categories: ['jambes'], musclesPrincipaux: ['jambes'], musclesSecondaires: ['gainage'], materiel: ['Haltères'], niveau: 'debutant', categorie: 'Renforcement', lienVideo: YT, video: { url: YT, statut: 'propose' } },
  { id: 'b', nom: 'Élévations latérales', categories: ['poussee'], musclesPrincipaux: ['Épaules'], materiel: ['Élastique'], niveau: 'intermediaire', categorie: 'Renforcement', lienVideo: YT, video: { url: YT, statut: 'valide' } },
  { id: 'c', nom: 'Planche', categories: ['gainage'], categorie: 'Gainage' },
  { id: 'd', nom: 'Rowing', categories: ['tirage'], materiel: ['Haltères'], niveau: 'confirme' }
]

describe('filtrer', () => {
  it('trie par nom et cherche sans accents ni casse, aussi dans la description', () => {
    expect(filtrer(ex).map((e) => e.id)).toEqual(['b', 'c', 'd', 'a'])
    expect(filtrer(ex, { q: 'elevations' }).map((e) => e.id)).toEqual(['b'])
    expect(filtrer(ex, { q: 'POITRINE' }).map((e) => e.id)).toEqual(['a'])
  })
  it('muscle : principaux OU secondaires OU catégories historiques, mots libres reconnus', () => {
    expect(filtrer(ex, { muscles: ['gainage'] }).map((e) => e.id).sort()).toEqual(['a', 'c'])
    expect(filtrer(ex, { muscles: ['epaules'] }).map((e) => e.id)).toEqual(['b'])
    expect(filtrer(ex, { muscles: ['dos'] }).map((e) => e.id)).toEqual(['d'])
    expect(filtrer(ex, { muscles: ['dos', 'epaules'] }).length).toBe(2)
  })
  it('matériel, niveau, catégorie (unique ou historique), statut vidéo', () => {
    expect(filtrer(ex, { materiel: 'Haltères' }).map((e) => e.id).sort()).toEqual(['a', 'd'])
    expect(filtrer(ex, { niveau: 'confirme' }).map((e) => e.id)).toEqual(['d'])
    expect(filtrer(ex, { categorie: 'renforcement' }).length).toBe(2)
    expect(filtrer(ex, { categorie: 'tirage' }).map((e) => e.id)).toEqual(['d'])
    expect(filtrer(ex, { video: 'propose' }).map((e) => e.id)).toEqual(['a'])
    expect(filtrer(ex, { video: 'aucune' }).map((e) => e.id).sort()).toEqual(['c', 'd'])
  })
  it('reste instantané sur 2 000 exercices', () => {
    const beaucoup = Array.from({ length: 2000 }, (_, i) => ({ ...ex[i % 4], id: `x${i}`, nom: `Exo ${i}` }))
    const t = performance.now()
    filtrer(beaucoup, { q: 'exo 1', muscles: ['jambes'] })
    expect(performance.now() - t).toBeLessThan(150)
  })
})

describe('comptes et options', () => {
  it('compte par teinte, matériel et catégories uniques, compte vidéo', () => {
    const n = compteParTeinte(ex)
    expect(n.jambes).toBe(1); expect(n.gainage).toBe(2); expect(n.epaules).toBe(1); expect(n.pecs).toBe(1)
    expect(materielsDe(ex)).toContain('Élastique')
    expect(materielsDe(ex)).toContain('Kettlebell')
    expect(categoriesDe(ex)).toEqual(['Gainage', 'Renforcement'])
    expect(compteVideo(ex, 'propose')).toBe(1)
    expect([...teintesDe(ex[0])].sort()).toEqual(['gainage', 'jambes'])
  })
})

describe('construirePatch', () => {
  it('ne renvoie que ce qui change ; chaîne vide = effacer', () => {
    const f = versFormulaire(ex[0])
    expect(construirePatch(ex[0], f)).toEqual({ patch: {}, erreurs: {} })
    f.tempo = '3-1-1'; f.description = ''; f.reposConseille = '90'
    expect(construirePatch(ex[0], f).patch).toEqual({ tempo: '3-1-1', description: '', reposConseille: 90 })
  })
  it('listes : envoie la nouvelle liste entière', () => {
    const f = versFormulaire(ex[0])
    f.materiel = basculer(f.materiel, 'Banc')
    f.musclesSecondaires = basculer(f.musclesSecondaires, 'gainage')
    expect(construirePatch(ex[0], f).patch).toEqual({ materiel: ['Haltères', 'Banc'], musclesSecondaires: [] })
  })
  it('refuse : nom vide, lien non YouTube, repos hors 0-600, textes trop longs, trop de muscles', () => {
    const f = versFormulaire(ex[2])
    Object.assign(f, { nom: '  ', lienVideo: 'https://vimeo.com/1', reposConseille: '601', tempo: 'x'.repeat(21), musclesPrincipaux: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
    const { erreurs } = construirePatch(ex[2], f)
    expect(Object.keys(erreurs).sort()).toEqual(['lienVideo', 'musclesPrincipaux', 'nom', 'reposConseille', 'tempo'])
    expect(construirePatch(ex[2], { ...versFormulaire(ex[2]), reposConseille: '1.5' }).erreurs.reposConseille).toBeTruthy()
  })
  it('repos vide efface, lien youtu.be accepté', () => {
    const avec = { ...ex[2], reposConseille: 60 }
    const f = versFormulaire(avec)
    f.reposConseille = ''; f.lienVideo = 'https://youtu.be/mKREc_xl_j8'
    expect(construirePatch(avec, f)).toEqual({ patch: { reposConseille: null, lienVideo: 'https://youtu.be/mKREc_xl_j8' }, erreurs: {} })
  })
})

describe('divers', () => {
  it('tailleReduite : 1600 px de large au plus, proportions gardées', () => {
    expect(tailleReduite(4000, 3000)).toEqual({ largeur: 1600, hauteur: 1200 })
    expect(tailleReduite(800, 600)).toEqual({ largeur: 800, hauteur: 600 })
  })
  it('voisin, messages d\'erreur du contrat', () => {
    expect(voisin(ex, 'b', 1).id).toBe('c')
    expect(voisin(ex, 'a', -1)).toBe(null)
    expect(voisin(ex, 'zz', 1)).toBe(null)
    expect(messageErreurExo({ code: 'trop_gros' })).toMatch(/3 Mo/)
    expect(messageErreurExo({ code: 'VALIDATION', message: 'type_refuse' })).toMatch(/JPG/)
    expect(messageErreurExo(new Error('?'))).toMatch(/connexion/)
  })
  it('routes : mêmes URL que les anciennes vues, bibliothèque -> filtre « à valider »', () => {
    expect(routes.map((r) => r.path)).toEqual(['exercices', 'bibliotheque'])
    expect(routes[0].meta.studio).toBe(true)
    expect(routes[1].redirect({ query: {} })).toEqual({ path: '/coach/exercices', query: { video: 'propose' } })
  })
})
