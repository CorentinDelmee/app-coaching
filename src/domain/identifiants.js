// Identifiants (prenom.nom) et codes de connexion (8 caractères lisibles).

const retirerAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const nettoyer = (s) => retirerAccents(s).toLowerCase().replace(/[^a-z0-9]/g, '')

/** « Élodie D'Arc » -> « elodie.darc ». Premier mot = prénom, le reste = nom. */
export function identifiantDepuisNom(nomComplet) {
  const mots = nomComplet.trim().split(/\s+/)
  const prenom = nettoyer(mots[0] || '')
  const nom = nettoyer(mots.slice(1).join(''))
  return nom ? `${prenom}.${nom}` : prenom
}

/** Ajoute « -2 », « -3 »… si l'identifiant est déjà pris. */
export function identifiantUnique(nomComplet, existants) {
  const base = identifiantDepuisNom(nomComplet)
  const pris = new Set(existants)
  if (!pris.has(base)) return base
  let n = 2
  while (pris.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// Sans 0, O, 1, I, L (confusions à la lecture).
export const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Longueur du code généré et minimum accepté quand un client choisit son code (audit I3). */
export const LONGUEUR_CODE = 8
export const LONGUEUR_CODE_MIN = 8

/** Code aléatoire de 8 caractères (crypto.getRandomValues, sans biais de modulo) : environ 39 bits. */
export function genererCode(longueur = LONGUEUR_CODE, crypto = globalThis.crypto) {
  const limite = 256 - (256 % ALPHABET_CODE.length)
  let code = ''
  while (code.length < longueur) {
    const octets = crypto.getRandomValues(new Uint8Array(longueur * 2))
    for (const o of octets) {
      if (o < limite && code.length < longueur) code += ALPHABET_CODE[o % ALPHABET_CODE.length]
    }
  }
  return code
}

/** E-mail technique utilisé par Supabase Auth. */
export const emailTechnique = (identifiant) => `${identifiant}@clients.cdc-coaching.invalid`

/** Contrôle d'un nouveau code saisi deux fois : renvoie le message d'erreur à afficher, ou null si tout va bien. */
export function validerNouveauCode(nouveau, confirmation) {
  if (typeof nouveau !== 'string' || nouveau.length < LONGUEUR_CODE_MIN) return `Le nouveau code doit faire ${LONGUEUR_CODE_MIN} caractères au minimum.`
  if (nouveau !== confirmation) return 'La confirmation ne correspond pas au nouveau code.'
  return null
}
