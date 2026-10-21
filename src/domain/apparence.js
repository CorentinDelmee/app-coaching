// Réglages d'apparence du client (ambiance + Grand affichage) : validation pure, sans DOM (testée).
// Les choix encore ouverts (police du chrono, message d'accueil, texte de l'aplat) sont dans src/config/apparence.js.
import { AMBIANCES, AMBIANCE_DEFAUT } from '../config/apparence.js'

/** Prend `profil.preferences` (ou n'importe quoi) et renvoie { ambiance, grand } toujours valides. */
export function normaliserApparence(prefs) {
  const p = prefs && typeof prefs === 'object' ? prefs : {}
  return {
    ambiance: AMBIANCES.some((a) => a.id === p.ambiance) ? p.ambiance : AMBIANCE_DEFAUT,
    grand: p.grand === true
  }
}

/** Attributs à poser sur <html> : les variables CSS de tokens.css font le reste. */
export function attributsApparence({ ambiance, grand }, choix) {
  return { 'data-ambiance': ambiance, 'data-grand': grand ? 'oui' : 'non', 'data-chrono': choix.policeChrono, 'data-aplat': choix.texteAplat }
}
