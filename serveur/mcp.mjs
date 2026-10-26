// Démarre le serveur MCP en stdio : node serveur/mcp.mjs  (lancé par Claude Code / Claude Desktop, voir README)
import { assembler } from './src/assembler.js'
import { chargerEnv, lireConfig } from './src/config.js'
import { lancerStdio } from './src/mcp.js'

chargerEnv()
await lancerStdio(await assembler(lireConfig()))
