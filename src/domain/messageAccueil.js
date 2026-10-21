// Message d'accueil du tableau de bord (grand titre dans l'aplat jaune). Pur : testé dans tests/unit/message-accueil.test.js.
// La variante vient de src/config/apparence.js (CHOIX.accueil). Vouvoiement comme le reste de l'app.
const NB = ' ' // espace insécable : « ? » et « ! » ne passent jamais seuls à la ligne

/**
 * @param {{variante?:'pret'|'semaine', prenom:string, etat:'prevu'|'fait'|'bouclee'|'aucun', reste?:number}} p
 *   etat = hero.etat de syntheseAccueil ; reste = séances restantes cette semaine.
 * @returns {{lignes:string[], long:boolean}} lignes du titre (une par <br>) ; long = phrase longue (taille réduite)
 */
export function messageAccueil({ variante = 'pret', prenom, etat, reste = 0 }) {
  if (etat === 'bouclee') return variante === 'semaine' ? { lignes: ['Semaine bouclée. Respect.'], long: true } : { lignes: ['Semaine', `bouclée${NB}!`], long: false }
  if (etat === 'aucun') return { lignes: ['Bonjour,', `${prenom}.`], long: false }
  if (variante === 'semaine') {
    const n = reste
    return { lignes: [n <= 1 ? 'Plus qu’une séance pour boucler la semaine.' : `Plus que ${n} séances pour boucler la semaine.`], long: true }
  }
  return etat === 'fait' ? { lignes: ['Bien joué,', `${prenom}.`], long: false } : { lignes: ['Prêt,', `${prenom}${NB}?`], long: false }
}
