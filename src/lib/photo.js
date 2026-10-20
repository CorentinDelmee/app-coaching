// Photo prise ou choisie par le client : redimensionnée et recompressée côté navigateur avant tout stockage.
// Redessiner l'image dans un canvas retire les métadonnées EXIF (position GPS, appareil) ; l'orientation est appliquée avant.

/** Dimensions cibles : le grand côté ne dépasse pas `max`, jamais d'agrandissement. */
export function dimensionsCibles(largeur, hauteur, max) {
  const k = Math.min(1, max / Math.max(largeur, hauteur))
  return { largeur: Math.max(1, Math.round(largeur * k)), hauteur: Math.max(1, Math.round(hauteur * k)) }
}

/** File -> data URL JPEG. `max` : 1280 px par défaut (questionnaires), plus petit pour les photos de repas. */
export async function compresserPhoto(fichier, { max = 1280, qualite = 0.8 } = {}) {
  if (!fichier || !/^image\//.test(fichier.type || '')) throw new Error("Ce fichier n'est pas une image")
  const bitmap = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  const { largeur, hauteur } = dimensionsCibles(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  canvas.getContext('2d').drawImage(bitmap, 0, 0, largeur, hauteur)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', qualite)
}
