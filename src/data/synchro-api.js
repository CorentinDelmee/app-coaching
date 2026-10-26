// Mode DÉMO relié au serveur (VITE_API_URL) : l'app reste en adaptateur local, mais recopie dans son stockage
// les exercices, séances et placements de programme créés côté serveur (par Claude via l'API REST / MCP).
// Lecture seule : l'app lit GET {VITE_API_URL}/demo/etat (le serveur ne l'expose que si DEMO_SYNC=1, sans comptes ni codes).
// Si le serveur est éteint, on ignore l'échec : l'app marche avec ses données locales.
import { ErreurData } from './erreurs.js'

const CLE_SYNCHRO = 'cdc-coaching/1:synchro'
const ENTITES_SYNCHRO = ['exercices', 'workouts', 'programmes']
const CHAMPS_PLACEMENT = ['workouts', 'semaines', 'joursFixes'] // d'un programme : seuls ces champs viennent du serveur

/** Enveloppe l'interface de données : avant chaque lecture, recopie l'état du serveur (au plus toutes les `delaiMs`). */
export function avecSynchroApi(api, url, { fetchFn = (...a) => globalThis.fetch(...a), storage = globalThis.localStorage, delaiMs = 3000, now = () => Date.now() } = {}) {
  const base = url.replace(/\/$/, '')
  const originaux = Object.fromEntries(ENTITES_SYNCHRO.map((e) => [e, { lire: api[e].lire, lister: api[e].lister, creer: api[e].creer, modifier: api[e].modifier, archiver: api[e].archiver }]))
  let derniere = 0
  let enCours = null

  const memorises = () => { try { return JSON.parse(storage?.getItem(CLE_SYNCHRO) || '{}') } catch { return {} } }

  async function recopier() {
    const r = await fetchFn(`${base}/demo/etat`)
    if (!r.ok) return
    const etat = await r.json()
    const ids = memorises()
    for (const e of ENTITES_SYNCHRO) {
      const o = originaux[e]
      const distants = etat[e] || []
      for (const x of distants) {
        try {
          const local = await o.lire(x.id)
          if (e === 'programmes' && local) await o.modifier(x.id, Object.fromEntries(CHAMPS_PLACEMENT.filter((k) => k in x).map((k) => [k, x[k]])))
          else if (!local || JSON.stringify(local) !== JSON.stringify(x)) await (local ? o.modifier(x.id, x) : o.creer(x)).catch((err) => {
            if (!(err instanceof ErreurData) || err.code !== 'EXISTE') throw err
            return o.modifier(x.id, x)
          })
        } catch { /* un élément invalide ne bloque pas les autres */ }
      }
      // Séance supprimée côté serveur : on l'archive ici (elle avait été recopiée avant).
      if (e === 'workouts') {
        const presents = new Set(distants.map((x) => x.id))
        for (const id of ids.workouts || []) if (!presents.has(id)) await o.archiver(id).catch(() => {})
        ids.workouts = [...presents]
      }
    }
    storage?.setItem(CLE_SYNCHRO, JSON.stringify(ids))
  }

  async function synchroniser() {
    if (enCours) return enCours
    if (now() - derniere < delaiMs) return
    derniere = now()
    enCours = recopier().catch(() => {}).finally(() => { enCours = null })
    return enCours
  }

  for (const e of ENTITES_SYNCHRO) {
    api[e].lister = async (...a) => { await synchroniser(); return originaux[e].lister(...a) }
    api[e].lire = async (...a) => { await synchroniser(); return originaux[e].lire(...a) }
  }
  const connecter = api.connecter
  api.connecter = async (...a) => { const r = await connecter(...a); derniere = 0; await synchroniser(); return r }
  api.synchroniserServeur = () => { derniere = 0; return synchroniser() }
  return api
}
