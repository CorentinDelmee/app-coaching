// Constantes de mouvement de la direction M1 « Atelier » (design/DESIGN.md §4). À garder en un seul endroit.
// Règle : entrée ample, sortie rapide (≈ 0,55 à 0,65 × l'entrée).
export const T = {
  ouvre: 0.85,       // carte -> page (clip-path)
  ferme: 0.52,       // page -> carte
  cascade: 0.07,     // décalage entre éléments de la cascade
  cercleOuvre: 0.72, // chrono, repos, fin : cercle depuis le bouton
  cercleFerme: 0.46,
  rectOuvre: 0.62,   // ligne -> série, valeur -> roue
  rectFerme: 0.42,
  slide: 0.75        // glissement entre exercices
}
export const E = {
  ouvre: 'expo.inOut', sortie: 'expo.out', ferme: 'power4.inOut',
  rect: 'power3.out',   // action fréquente : réponse immédiate, pose douce
  cercle: 'power4.inOut',
  slide: 'expo.out'
}
export const PLEIN = 'inset(0px 0px 0px 0px round 0px)'
