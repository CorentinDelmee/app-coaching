// Déplacements de listes (fonctions pures, testées) : utilisés par le glisser-déposer des éditeurs de séance et de programme.

/**
 * Index d'insertion (compté SANS l'élément tiré) d'après la position du pointeur et les milieux des éléments.
 * @param {number[]} milieux  milieux (en px, même axe que `pos`) des éléments de la liste cible, dans l'ordre, élément tiré exclu
 */
export function indexInsertion(milieux, pos) {
  let i = 0
  while (i < milieux.length && milieux[i] < pos) i++
  return i
}

/**
 * Déplace l'élément `de` de `source` vers la position `vers` de `cible` (index compté après retrait).
 * `cible` absente ou identique à `source` = déplacement dans la même liste. Ne modifie pas les tableaux reçus.
 * @returns {{ source: any[], cible: any[] }} (cible === source si même liste)
 */
export function deplacerItem(source, de, vers, cible = source) {
  if (de < 0 || de >= source.length) return { source, cible }
  const s = [...source]
  const [item] = s.splice(de, 1)
  const c = cible === source ? s : [...cible]
  c.splice(Math.max(0, Math.min(vers, c.length)), 0, item)
  return { source: s, cible: c }
}

/** Même chose, en place sur des tableaux réactifs (Vue suit les splice). Renvoie l'élément déplacé. */
export function deplacerEnPlace(source, de, vers, cible = source) {
  if (de < 0 || de >= source.length) return undefined
  const [item] = source.splice(de, 1)
  cible.splice(Math.max(0, Math.min(vers, cible.length)), 0, item)
  return item
}

/** Insère `item` à la position `vers` (bornée). En place. */
export function insererEnPlace(liste, vers, item) {
  liste.splice(Math.max(0, Math.min(vers ?? liste.length, liste.length)), 0, item)
  return item
}
