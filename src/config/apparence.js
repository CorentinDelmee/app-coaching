// Choix d'apparence encore ouverts (maquette V2, design-v2/NOTES.md §3) : UN SEUL endroit.
// Valeurs retenues en PROVISOIRE (recommandation de la maquette) ; changer une valeur ici suffit, rien d'autre à toucher.
// Voir aussi DECISIONS.md. Les réglages du client (ambiance, Grand affichage) ne sont pas ici : ils sont dans son Profil.

export const CHOIX = {
  /** Police des chiffres du chrono : 'barlow' (Barlow Semi Condensed 600) | 'inter' (Inter Tight 600) | 'azeret' (Azeret Mono 500). */
  policeChrono: 'barlow',
  /** Message d'accueil du tableau de bord : 'pret' (« Prêt, Fabien ? ») | 'semaine' (« Plus que 2 séances… »). */
  accueil: 'pret',
  /** Texte posé sur l'aplat jaune : 'fonce' (12,1 : 1) | 'blanc' (1,4 : 1, illisible : seulement pour comparer). */
  texteAplat: 'fonce'
}

/** Ambiances proposées au client (clé = valeur de html[data-ambiance]). La première est le défaut (« clair par défaut »). */
export const AMBIANCES = [
  { id: 'clair', nom: 'Clair', fond: '#E3E5E8' },
  { id: 'sombre', nom: 'Sombre', fond: '#202224' },
  { id: 'bleu', nom: 'Bleu profond', fond: '#141B33' }
]
export const AMBIANCE_DEFAUT = AMBIANCES[0].id
