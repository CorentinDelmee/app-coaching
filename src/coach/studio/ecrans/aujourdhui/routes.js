// Routes de l'écran « Aujourd'hui » (Studio), relatives à /coach. REX les branche dans src/coach/routes.js à la fusion
// (elles remplacent la route provisoire 'aujourdhui' de L0 et l'ancienne 'alertes'). meta.studio : rendu sans le pont .coach.
export default [
  { path: 'aujourdhui', component: () => import('./AujourdhuiView.vue'), meta: { studio: true } },
  { path: 'alertes', component: () => import('./AlertesView.vue'), meta: { studio: true } }
]
