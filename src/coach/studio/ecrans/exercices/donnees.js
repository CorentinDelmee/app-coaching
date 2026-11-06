// Accès aux exercices pour l'écran Studio : UNIQUEMENT data.exercices.* (docs/CONTRAT-EXERCICES-STUDIO.md).
import data from '../../../../data/index.js'
import { tailleReduite } from './logique.js'

const ex = () => data.exercices

/** Tous les exercices non archivés (le contrat plafonne à 500 ; 181 en production) : le filtrage se fait en mémoire. */
export async function chargerTous() {
  const tous = []
  let total = Infinity
  while (tous.length < total) {
    const r = await ex().recherche({ limite: 500, decalage: tous.length })
    total = r.total ?? r.items.length
    if (!r.items.length) break
    tous.push(...r.items)
  }
  return tous
}

export const detail = (id) => ex().detail(id)

export const mettreAJour = (id, patch) => ex().mettreAJour(id, patch)

export const creer = (obj) => ex().creer(obj)
export const archiver = (id) => ex().archiver(id)
export const envoyerPhoto = (id, blob) => ex().envoyerPhoto(id, blob)
export const retirerPhoto = (id) => ex().retirerPhoto(id)
/** Validation d'une vidéo proposée : pas dans le contrat (outil Claude valider_video) ; utilisée si data l'expose. */
export const validationPossible = () => typeof ex().validerVideo === 'function'
export const validerVideo = (id) => ex().validerVideo(id)

/** Réduit une image (≤ 1600 px de large, WebP ~0,8, JPEG sinon) avant l'envoi : ~200 Ko au lieu de plusieurs Mo. */
export async function reduireImage(fichier) {
  const bmp = await createImageBitmap(fichier)
  const { largeur, hauteur } = tailleReduite(bmp.width, bmp.height)
  const toile = document.createElement('canvas')
  toile.width = largeur
  toile.height = hauteur
  toile.getContext('2d').drawImage(bmp, 0, 0, largeur, hauteur)
  bmp.close?.()
  const blob = (type) => new Promise((r) => toile.toBlob(r, type, 0.8))
  let b = await blob('image/webp')
  if (!b || b.type !== 'image/webp') b = await blob('image/jpeg')
  return b
}
