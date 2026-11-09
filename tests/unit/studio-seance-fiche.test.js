import { describe, expect, it } from 'vitest'
import { fusionnerExercice } from '../../src/coach/studio/ecrans/programmes/seances/seance.js'
import { mediaDe } from '../../src/coach/studio/medias.js'

// Fiche d'un exercice ouverte depuis l'éditeur de séance : la liste d'exercices de l'éditeur suit les modifications
// (vignette, nom) sans toucher à la séance.
describe('fiche exercice depuis une séance', () => {
  const liste = [
    { id: 'a', nom: 'Squat', version: 3, lienVideo: '' },
    { id: 'b', nom: 'Pompe', version: 1 }
  ]

  it('met à jour l\'exercice modifié (nom, version) sans muter la liste d\'origine', () => {
    const r = fusionnerExercice(liste, { id: 'a', nom: 'Squat goblet', version: 4 })
    expect(r[0]).toEqual({ id: 'a', nom: 'Squat goblet', version: 4, lienVideo: '' })
    expect(r[1]).toBe(liste[1])
    expect(liste[0].nom).toBe('Squat')
    expect(r).not.toBe(liste)
  })

  it('la vignette suit une vidéo puis une photo ajoutées dans la fiche', () => {
    let r = fusionnerExercice(liste, { id: 'a', lienVideo: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    expect(mediaDe(r[0]).type).toBe('youtube')
    r = fusionnerExercice(r, { id: 'a', photo: { url: '/api/app/fichiers/photo-a.webp' } })
    expect(mediaDe(r[0])).toMatchObject({ type: 'photo' })
  })

  it('ignore un exercice inconnu ou sans id (même liste renvoyée)', () => {
    expect(fusionnerExercice(liste, { id: 'z', nom: 'X' })).toBe(liste)
    expect(fusionnerExercice(liste, null)).toBe(liste)
    expect(fusionnerExercice(liste, { nom: 'X' })).toBe(liste)
  })
})
