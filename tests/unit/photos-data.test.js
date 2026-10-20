import { describe, it, expect } from 'vitest'
import { creerApi } from '../../src/data/commun.js'
import { creerAdapterLocal, stockageMemoire } from '../../src/data/adapters/local.js'

// Backend minimal avec stockage de photos : vérifie l'envoi, la référence enregistrée et l'URL signée.
function backendAvecPhotos() {
  const envoyes = []; const supprimes = []; const lignes = { reponses: [{ id: 'r1', clientId: 'c1', valeurs: { photo: 'photo:c1/a.jpg', poids: 80 } }], nutrition: [{ id: 'n1', clientId: 'c1', valeur: { photo: 'photo:c1/b.jpg' } }, { id: 'n2', clientId: 'c1', valeur: { kcal: 1 } }], douleurs: [], mesures: [] }
  return {
    envoyes, supprimes, lignes,
    backend: {
      mode: 'supabase',
      utilisateurCourant: async () => ({ id: 'c1', role: 'client' }),
      tout: async (e) => lignes[e] || [],
      supprimer: async (e, id) => { lignes[e] = lignes[e].filter((l) => l.id !== id) },
      photos: { envoyer: async (c, b) => envoyes.push([c, b.type]), url: async (c) => `https://signe/${c}?t=1`, supprimer: async (c) => supprimes.push(...c) }
    }
  }
}
const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k='

describe('photos : démo et Supabase', () => {
  it('démo : la photo reste en data URL', async () => {
    const api = creerAdapterLocal({ storage: stockageMemoire() })
    expect(await api.photos.enregistrer('c1', PIXEL)).toBe(PIXEL)
    expect(await api.photos.url(PIXEL)).toBe(PIXEL)
  })
  it('Supabase : envoi dans <client>/<uuid>.jpg, référence + URL signée', async () => {
    const { backend, envoyes } = backendAvecPhotos()
    const api = creerApi(backend, { uuid: () => 'u-1' })
    const ref = await api.photos.enregistrer('c1', PIXEL)
    expect(ref).toBe('photo:c1/u-1.jpg')
    expect(envoyes).toEqual([['c1/u-1.jpg', 'image/jpeg']])
    expect(await api.photos.url(ref)).toBe('https://signe/c1/u-1.jpg?t=1')
  })
  it('« supprimer mes données de santé » supprime aussi les fichiers', async () => {
    const { backend, supprimes, lignes } = backendAvecPhotos()
    const api = creerApi(backend)
    await api.supprimerMesDonneesSante()
    expect(supprimes.sort()).toEqual(['c1/a.jpg', 'c1/b.jpg'])
    expect(lignes.reponses).toHaveLength(0)
  })
})
