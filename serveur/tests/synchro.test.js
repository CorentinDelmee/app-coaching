// Synchro démo : l'app (adaptateur local) recopie les séances créées côté serveur.
import { describe, expect, it } from 'vitest'
import { creerData } from '../../src/data/index.js'
import { stockageMemoire } from '../../src/data/adapters/local.js'

const MAINTENANT = Date.UTC(2026, 9, 26, 12)

describe('synchro-api', () => {
  it('recopie une séance du serveur et la rend lisible côté app', async () => {
    const storage = stockageMemoire()
    const seance = { id: 'w-srv-1', clientId: 'client-fabien-vincent', nom: 'Séance du serveur', blocs: [] }
    const fetchFn = async () => ({ ok: true, json: async () => ({ exercices: [], workouts: [seance], programmes: [] }) })
    const data = creerData({ VITE_API_URL: 'http://x' }, { storage, now: () => MAINTENANT })
    // l'adaptateur par défaut utilise fetch global : on le remplace pour ce test
    const orig = globalThis.fetch
    globalThis.fetch = fetchFn
    try {
      await data.connecter('fabien.vincent', 'DEMO2024')
      expect((await data.workouts.lire('w-srv-1'))?.nom).toBe('Séance du serveur')
      expect((await data.workouts.lister({ clientId: 'client-fabien-vincent' })).some((w) => w.id === 'w-srv-1')).toBe(true)
    } finally { globalThis.fetch = orig }
  })

  it('serveur éteint : l\'app continue avec ses données locales', async () => {
    const orig = globalThis.fetch
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED') }
    try {
      const data = creerData({ VITE_API_URL: 'http://x' }, { storage: stockageMemoire(), now: () => MAINTENANT })
      await data.connecter('fabien.vincent', 'DEMO2024')
      expect((await data.workouts.lister()).length).toBeGreaterThan(3)
    } finally { globalThis.fetch = orig }
  })
})
