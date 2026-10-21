// Roulette de chiffres (M2) : chaque chiffre est une colonne 0-9-0-9 (20 cases) qui défile. Logique pure, testée.
// `pos` = case actuellement affichée (0-19), `d` = chiffre à afficher, `sens` : +1 le chiffre monte (compteur), -1 il descend (compte à rebours).
// Renvoie { depart, arrivee } : cases de départ et d'arrivée, toutes deux dans 0-19 ; le trajet est toujours dans le bon sens et < 10 cases.
export function cibleRoulette(pos, d, sens = -1) {
  const actuel = ((pos % 10) + 10) % 10
  if (actuel === d) return { depart: pos, arrivee: pos }
  if (sens > 0) {
    // la colonne monte : indices croissants ; on recule d'une dizaine d'avance si on sortirait de la colonne
    const depart = pos >= 10 ? pos - 10 : pos
    const arrivee = d > depart % 10 ? depart - (depart % 10) + d : depart - (depart % 10) + 10 + d
    return { depart, arrivee }
  }
  // la colonne descend : indices décroissants ; on avance d'une dizaine d'avance si on sortirait par le haut
  const depart = pos < 10 ? pos + 10 : pos
  const arrivee = d < depart % 10 ? depart - (depart % 10) + d : depart - (depart % 10) - 10 + d
  return { depart, arrivee }
}
