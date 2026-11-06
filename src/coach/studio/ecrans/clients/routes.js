// Routes de l'écran Clients (Studio), relatives à /coach. Mêmes URL que les anciennes vues :
// /coach/clients (liste) et /coach/clients/:id (fiche ouverte à côté de la liste, ou en feuille sur téléphone).
// meta.cle : la liste ne doit pas être recréée quand la fiche s'ouvre -> CoachLayout doit utiliser :key="r.meta.cle || r.path".
export default [
  {
    path: 'clients',
    component: () => import('./ClientsEcran.vue'),
    meta: { studio: true, cle: 'clients' },
    children: [{ path: ':id', component: () => import('./FicheClient.vue'), props: true, meta: { studio: true, cle: 'clients' } }]
  }
]
