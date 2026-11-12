// Démarre l'API REST : node serveur/api.mjs  (port PORT_API, 127.0.0.1 uniquement)
import { assembler } from './src/assembler.js'
import { chargerEnv, lireConfig, variablesManquantes } from './src/config.js'
import { creerServeurRest } from './src/rest.js'

chargerEnv()
const manquantes = variablesManquantes()
if (manquantes.length) {
  console.error(`Refus de démarrer en production : variables manquantes ou trop courtes : ${manquantes.join(', ')}`)
  process.exit(1)
}
const config = lireConfig()
if (config.cleApi.length < 32) console.warn('Attention : COACH_API_KEY absente ou trop courte : toutes les requêtes protégées seront refusées (401).')
const app = await assembler(config)
// Synchro Google Agenda : au démarrage puis toutes les 15 min (AGENDA_SYNCHRO=0 la coupe, ex. en test ou sans API réservation).
if (app.agendaSynchro && process.env.AGENDA_SYNCHRO !== '0' && config.resaCle) app.agendaSynchro.demarrer()
creerServeurRest(app).listen(config.port, config.hote, () => console.log(`API sur http://${config.hote}:${config.port} (stockage : ${app.backend.mode}${app.appHttp ? ', API app active' : ''})`))
