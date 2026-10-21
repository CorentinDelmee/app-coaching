// Applique l'apparence (ambiance, Grand affichage + choix de src/config/apparence.js) sur <html>, et la garde en cache local.
// Le cache sert à éviter tout « flash » : index.html le lit avant le premier affichage (voir le petit script de l'en-tête),
// puis la source de vérité est le profil du client (preferences.ambiance / preferences.grand, via src/data).
import { reactive } from 'vue'
import { AMBIANCES, CHOIX } from '../config/apparence.js'
import { attributsApparence, normaliserApparence } from '../domain/apparence.js'

export const CLE_CACHE = 'cdc-apparence'

/** État courant (réactif) : lu par le Profil pour afficher l'ambiance choisie et l'interrupteur. */
export const apparence = reactive(normaliserApparence(null))

function lireCache() {
  try { return normaliserApparence(JSON.parse(localStorage.getItem(CLE_CACHE) || 'null')) } catch { return normaliserApparence(null) }
}

/** Pose les attributs data-* sur <html> + la couleur de la barre du navigateur, et mémorise. */
export function appliquer(prefs) {
  const a = normaliserApparence(prefs)
  apparence.ambiance = a.ambiance
  apparence.grand = a.grand
  const html = document.documentElement
  for (const [k, v] of Object.entries(attributsApparence(a, CHOIX))) html.setAttribute(k, v)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', AMBIANCES.find((x) => x.id === a.ambiance).fond)
  try { localStorage.setItem(CLE_CACHE, JSON.stringify(a)) } catch { /* stockage plein ou privé : sans conséquence */ }
}

/** Au démarrage : cache local (instantané), avant le premier affichage. */
export function demarrerApparence() { appliquer(lireCache()) }

/** Quand le profil du client est connu : ses préférences enregistrées l'emportent sur le cache. */
export function appliquerDepuisProfil(user) {
  if (!user || user.role === 'coach') return
  const a = normaliserApparence(user.preferences)
  if (a.ambiance !== apparence.ambiance || a.grand !== apparence.grand) appliquer(a)
}
