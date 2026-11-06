// Routes de l'écran Exercices (Studio), chemins relatifs à /coach. REX les branche dans src/coach/routes.js à la fusion,
// à la place des anciennes « exercices » et « bibliotheque » (même URL : aucun lien cassé).
export default [
  { path: 'exercices', component: () => import('./ExercicesStudio.vue'), meta: { studio: true } },
  // L'ancienne bibliothèque vidéo est fondue dans l'écran : elle ouvre la grille filtrée sur « Vidéo à valider ».
  { path: 'bibliotheque', redirect: (to) => ({ path: '/coach/exercices', query: { video: 'propose', ...to.query } }) }
]
