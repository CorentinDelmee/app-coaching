// Routes du lot écran « programmes » (séances + programmes), relatives à /coach. Mêmes URL que les anciennes vues.
export default [
  { path: 'seances', component: () => import('./seances/SeancesStudio.vue'), meta: { studio: true } },
  { path: 'seances/:id', component: () => import('./seances/SeanceEditeurStudio.vue'), props: true, meta: { studio: true } },
  { path: 'programmes', component: () => import('./programmes/ProgrammesStudio.vue'), meta: { studio: true } },
  { path: 'programmes/:id', component: () => import('./programmes/ProgrammeEditeurStudio.vue'), props: true, meta: { studio: true } }
]
