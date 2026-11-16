// Position de défilement après une navigation (pur, testé).
// Espace coach : nouvelle page -> haut ; retour/avance de l'historique -> position mémorisée ; même page ou même écran
// (fiche client ouverte à côté de la liste : meta.cle identique, ou seulement la requête qui change) -> on ne bouge pas.
// App client : ses pages gèrent leur propre défilement -> position mémorisée au retour, sinon rien (comme avant).
export function positionDefilement(to, from, saved) {
  const coach = /^\/coach(\/|$)/.test(to.path)
  if (!coach) return saved || false
  if (to.path === from.path) return false
  if (to.meta?.cle && to.meta.cle === from.meta?.cle) return false
  return saved || { top: 0 }
}
