// Erreur typée de la couche de données. `code` : STOCKAGE_PLEIN | VALIDATION | EXISTE | INTROUVABLE |
// IDENTIFIANTS | NON_CONNECTE | INTERDIT | CODE_TROP_COURT | FORMAT | RESEAU | NON_SUPPORTE |
// CONFLIT (modifié ailleurs depuis la lecture : `actuel` = l'objet à jour, voir versions.js)
export class ErreurData extends Error {
  constructor(code, message, details) {
    super(message || code)
    this.name = 'ErreurData'
    this.code = code
    if (details) Object.assign(this, details)
  }
}

export const MESSAGES = {
  STOCKAGE_PLEIN: 'Stockage plein sur cet appareil — non enregistré',
  IDENTIFIANTS: 'Identifiant ou code incorrect'
}
