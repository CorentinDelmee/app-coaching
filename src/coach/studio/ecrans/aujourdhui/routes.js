// Routes de l'écran « Aujourd'hui » (Studio), relatives à /coach. REX les branche dans src/coach/routes.js à la fusion,
// avec la redirection { path: '', redirect: '/coach/aujourdhui' }.
export default [
  { path: 'aujourdhui', component: () => import('./AujourdhuiView.vue') },
  { path: 'alertes', component: () => import('./AlertesView.vue') }
]
