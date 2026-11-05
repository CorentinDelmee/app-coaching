// Démarre le serveur MCP en stdio : node serveur/mcp.mjs  (lancé par Claude Code / Claude Desktop, voir README)
// Avec COACH_API_URL (ex. https://<domaine>/api/coach) : mode distant, tout passe par l'API du VPS (aucune base locale).
// Sans COACH_API_URL : mode local (base et outils sur cette machine).
import { chargerEnv } from './src/config.js'

chargerEnv()
if (process.env.COACH_API_URL) {
  const { lancerDistant } = await import('./src/mcp-distant.js')
  await lancerDistant()
} else {
  const { assembler } = await import('./src/assembler.js')
  const { lireConfig } = await import('./src/config.js')
  const { lancerStdio } = await import('./src/mcp.js')
  await lancerStdio(await assembler(lireConfig()))
}
