// Routes de l'écran Clients (Studio), relatives à /coach. Mêmes URL que les anciennes vues :
// /coach/clients (liste) et /coach/clients/:id (fiche ouverte à côté de la liste, ou en feuille sur téléphone).
export default [
  {
    path: 'clients',
    component: () => import('./ClientsEcran.vue'),
    children: [{ path: ':id', component: () => import('./FicheClient.vue'), props: true }]
  }
]
