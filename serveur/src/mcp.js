// Façade MCP (stdio) pour Claude Code / Claude Desktop. Mêmes outils, même validation, même journal que l'API REST.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { appeler } from './outils.js'

/** Construit le serveur MCP (sans le connecter : les tests le branchent comme ils veulent). */
export function creerServeurMcp(app, acteur = 'mcp-stdio') {
  const serveur = new McpServer({ name: 'coaching-seances', version: '1.0.0' })
  for (const [nom, outil] of Object.entries(app.outils)) {
    // Le schéma complet (strict) revalide les arguments dans `appeler` ; le SDK reçoit la forme pour décrire l'outil à Claude.
    const forme = outil.schema.shape ?? outil.schema._zod?.def?.in?.shape ?? {}
    serveur.registerTool(nom, { description: outil.description, inputSchema: forme }, async (args) => {
      const r = await appeler(app, nom, args, acteur)
      return { content: [{ type: 'text', text: JSON.stringify(r.ok ? r.donnees : { erreur: r.erreur, code: r.code }, null, 1) }], ...(r.ok ? {} : { isError: true }) }
    })
  }
  return serveur
}

export async function lancerStdio(app) {
  // Refus par défaut : sans clé configurée (même variable que l'API REST), le serveur MCP ne démarre pas.
  if (!app.config.cleApi || app.config.cleApi.length < 16) {
    console.error('COACH_API_KEY absente ou trop courte (16 caractères minimum) : serveur MCP non démarré. Voir serveur/README.md.')
    process.exit(1)
  }
  await creerServeurMcp(app).connect(new StdioServerTransport())
}
