import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/base.css'
import './styles/couches.css'
import './styles/ecrans.css'
import './styles/accueil.css'
import './styles/acces.css'

import { demarrerApparence } from './lib/apparence.js'
import { ecouterInstallation } from './lib/installation.js'
import { demarrerSynchro } from './lib/synchro.js'
import { installerPWA } from './lib/pwa.js'
import { data } from './data/index.js'
import { configManquante } from './lib/configuration.js'
import ConfigManquante from './views/ConfigManquante.vue'

demarrerApparence() // ambiance + Grand affichage mémorisés (le profil du client les remet à jour à la connexion)

if (configManquante(import.meta.env, data.mode)) {
  createApp(ConfigManquante).mount('#app') // production sans Supabase : ni comptes de démo, ni service worker
} else {
  ecouterInstallation() // capte `beforeinstallprompt` avant l'affichage de la page
  createApp(App).use(router).mount('#app')
  demarrerSynchro()
  installerPWA(router)
}
