// Erreur typée de la couche de données. `code` : STOCKAGE_PLEIN | VALIDATION | EXISTE | INTROUVABLE |
// IDENTIFIANTS | NON_CONNECTE | CODE_TROP_COURT | FORMAT | RESEAU | NON_SUPPORTE
export class ErreurData extends Error {
  constructor(code, message) {
    super(message || code)
    this.name = 'ErreurData'
    this.code = code
  }
}

export const MESSAGES = {
  STOCKAGE_PLEIN: 'Stockage plein sur cet appareil — non enregistré',
  IDENTIFIANTS: 'Identifiant ou code incorrect'
}
