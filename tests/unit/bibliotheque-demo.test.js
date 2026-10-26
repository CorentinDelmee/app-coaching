import { describe, it, expect } from 'vitest'
import { creerBibliothequeLocale, depuisImport, remplacerEntree, validerEntree } from '../../src/data/demo/bibliothequeLocale.js'

const liste = [
  { id: 'ex-squat', nom: 'Squat', statut: 'propose', video: { url: 'https://www.youtube.com/watch?v=EXFBExFRTBY', titre: 't', chaine: 'c', duree: null } },
  { id: 'ex-pompes', nom: 'Pompes', statut: 'propose', video: { url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', titre: null, chaine: null, duree: null } }
]
const memoire = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v } } }

describe('bibliothèque démo locale', () => {
  it('convertit une entrée importée (duree_s -> duree)', () => {
    const e = depuisImport({ id: 'x', nom: 'X', statut: 'propose', video: { url: 'https://youtu.be/aaaaaaaaaaa', duree_s: 90 } })
    expect(e.video.duree).toBe(90)
  })
  it('valide une entrée sans toucher aux autres exercices', () => {
    const r = validerEntree(liste, 'ex-squat')
    expect(r.find((x) => x.id === 'ex-squat').statut).toBe('valide')
    expect(r.find((x) => x.id === 'ex-pompes').statut).toBe('propose')
  })
  it('remplace : ancienne écartée, nouvelle validée ; lien invalide refusé', () => {
    const r = remplacerEntree(liste, 'ex-squat', 'https://youtu.be/bbbbbbbbbbb')
    expect(r.find((x) => x.id === 'ex-squat').statut).toBe('remplace')
    expect(r.find((x) => x.video?.url.endsWith('bbbbbbbbbbb')).statut).toBe('valide')
    expect(() => remplacerEntree(liste, 'ex-squat', 'https://exemple.fr/v')).toThrow()
  })
  it('garde les actions dans le stockage', async () => {
    const storage = memoire()
    const b = creerBibliothequeLocale({ storage, charger: async () => liste })
    await b.valider('ex-pompes')
    const b2 = creerBibliothequeLocale({ storage, charger: async () => liste })
    expect((await b2.lister()).find((x) => x.id === 'ex-pompes').statut).toBe('valide')
  })
})
