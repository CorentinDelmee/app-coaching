// Démarre l'API REST : node serveur/api.mjs  (port PORT_API, 127.0.0.1 uniquement)
import { assembler } from './src/assembler.js'
import { chargerEnv, lireConfig } from './src/config.js'
import { creerServeurRest } from './src/rest.js'

chargerEnv()
const config = lireConfig()
if (config.cleApi.length < 16) console.warn('Attention : COACH_API_KEY absente ou trop courte : toutes les requêtes protégées seront refusées (401).')
const app = await assembler(config)
creerServeurRest(app).listen(config.port, config.hote, () => console.log(`API sur http://${config.hote}:${config.port} (stockage : ${app.backend.mode})`))
