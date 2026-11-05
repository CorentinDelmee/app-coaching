// MCP distant (stdio côté Claude) : aucune base locale, chaque appel est transmis à l'API du VPS (/api/coach/*).
// La liste des outils est relue à chaque « tools/list » depuis GET <url>/outils : un outil ajouté côté serveur
// apparaît sans toucher à ce fichier.
import { readFileSync } from 'node:fs'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

/** Lit l'URL et la clé dans l'environnement. Clé : fichier COACH_API_KEY_FILE (prioritaire) ou COACH_API_KEY. Lève une erreur claire sinon. */
export function configDistante(env = process.env) {
  const url = String(env.COACH_API_URL || '').replace(/\/+$/, '')
  let u
  try { u = new URL(url) } catch { throw new Error(`COACH_API_URL invalide : « ${url} » (attendu : https://<domaine>/api/coach)`) }
  // La clé ne part jamais en clair sur le réseau : HTTPS obligatoire, sauf en local (tests).
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) throw new Error('COACH_API_URL doit commencer par https:// (http seulement vers 127.0.0.1).')
  let cle = env.COACH_API_KEY || ''
  if (env.COACH_API_KEY_FILE) {
    try { cle = readFileSync(env.COACH_API_KEY_FILE, 'utf8').trim() } catch { throw new Error(`Fichier de clé illisible : ${env.COACH_API_KEY_FILE} (COACH_API_KEY_FILE)`) }
  }
  if (cle.length < 32) throw new Error('Clé absente ou trop courte (32 caractères minimum) : renseigner COACH_API_KEY_FILE (recommandé) ou COACH_API_KEY.')
  return { url, cle }
}

/** Construit le serveur MCP distant (sans le connecter). fetchFn injectable pour les tests. */
export function creerServeurMcpDistant({ url, cle, fetchFn = (...a) => globalThis.fetch(...a) }) {
  const appel = async (methode, chemin, corps) => {
    const r = await fetchFn(`${url}${chemin}`, {
      method: methode,
      headers: { Authorization: `Bearer ${cle}`, ...(corps ? { 'Content-Type': 'application/json' } : {}) },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
      signal: AbortSignal.timeout(60e3)
    })
    let donnees
    try { donnees = await r.json() } catch { donnees = { erreur: `Réponse illisible du serveur (HTTP ${r.status})` } }
    return { statut: r.status, donnees }
  }

  const serveur = new Server({ name: 'coaching-seances', version: '1.1.0' }, { capabilities: { tools: {} } })
  serveur.setRequestHandler(ListToolsRequestSchema, async () => {
    const { statut, donnees } = await appel('GET', '/outils')
    if (statut !== 200 || !Array.isArray(donnees)) throw new Error(`Liste des outils indisponible (HTTP ${statut}) : ${donnees?.erreur ?? 'réponse inattendue'}`)
    return {
      tools: donnees.map((o) => {
        const { $schema: _s, ...schema } = o.schema ?? {}
        return { name: o.nom, description: o.description, inputSchema: schema.type === 'object' ? schema : { type: 'object', ...schema } }
      })
    }
  })
  serveur.setRequestHandler(CallToolRequestSchema, async (req) => {
    const nom = req.params.name
    if (!/^[a-z0-9_]{1,60}$/.test(nom)) return { content: [{ type: 'text', text: JSON.stringify({ erreur: 'Nom d\'outil invalide', code: 'OUTIL_INCONNU' }) }], isError: true }
    try {
      const { statut, donnees } = await appel('POST', `/outils/${nom}`, req.params.arguments ?? {})
      return { content: [{ type: 'text', text: JSON.stringify(donnees, null, 1) }], ...(statut === 200 ? {} : { isError: true }) }
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ erreur: `Serveur injoignable : ${e.message}`, code: 'RESEAU' }) }], isError: true }
    }
  })
  return serveur
}

export async function lancerDistant(env = process.env) {
  let conf
  try { conf = configDistante(env) } catch (e) { console.error(`${e.message} Voir serveur/README.md (« Brancher Claude Code en distant »).`); process.exit(1) }
  await creerServeurMcpDistant(conf).connect(new StdioServerTransport())
}
