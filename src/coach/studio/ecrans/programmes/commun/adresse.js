// Après la 1re écriture d'un nouvel élément : « …/nouveau » devient « …/<id> » dans la barre d'adresse SANS navigation.
// (CoachLayout clé la page par r.path : un router.replace remonterait l'éditeur en pleine saisie / en plein glisser.)
// L'état d'historique de vue-router est conservé ; un rechargement ou un retour arrière ouvre bien l'élément créé.
export function remplacerAdresse(chemin) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const etat = { ...(history.state || {}), current: chemin }
  history.replaceState(etat, '', base + chemin)
}
