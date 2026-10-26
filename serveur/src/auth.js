// Authentification par clé API (Bearer) et limitation de débit. Refus par défaut.
import { createHash, timingSafeEqual } from 'node:crypto'

const empreinte = (s) => createHash('sha256').update(String(s)).digest()

/** Vrai seulement si une clé est configurée ET que l'en-tête « Authorization: Bearer <clé> » correspond (temps constant). */
export function cleValide(enTete, cleAttendue) {
  if (!cleAttendue || cleAttendue.length < 32) return false // pas de clé (ou trop faible) = tout est refusé
  const m = /^Bearer (.+)$/.exec(enTete || '')
  if (!m) return false
  // On compare des empreintes de même longueur : pas de fuite par la longueur ni par le temps.
  return timingSafeEqual(empreinte(m[1]), empreinte(cleAttendue))
}

/** Limiteur à fenêtre fixe : au plus `max` requêtes par `fenetreMs` et par clé. */
export function creerLimiteur({ max = 120, fenetreMs = 60000, now = () => Date.now() } = {}) {
  const compteurs = new Map()
  return (cle) => {
    const t = now()
    const c = compteurs.get(cle)
    if (!c || t - c.debut >= fenetreMs) {
      compteurs.set(cle, { debut: t, n: 1 })
      return true
    }
    c.n++
    return c.n <= max
  }
}
