// Routes de l'écran Agenda / Réservations / Données (Studio), relatives à /coach. Mêmes URL que les anciennes vues.
export default [
  { path: 'agenda', component: () => import('./AgendaStudio.vue') },
  { path: 'reservations', component: () => import('./ReservationsStudio.vue') },
  { path: 'donnees', component: () => import('./DonneesStudio.vue') }
]
