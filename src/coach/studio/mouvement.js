// Mouvement Studio (LISEZMOI « Mouvement ») : fonctions pures, testées.

/** Sens de l'entrée de page : 'avance' (plus profond : liste -> éditeur), 'recule' (moins profond), 'onglet' (même niveau). */
export function sensNavigation(de, vers) {
  const p = (c) => String(c || '').split('?')[0].split('/').filter(Boolean).length
  const a = p(de), b = p(vers)
  return b > a ? 'avance' : b < a ? 'recule' : 'onglet'
}
