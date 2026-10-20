// Unités de charge. Les poids sont TOUJOURS stockés en kg ; la conversion en lb se fait à l'affichage et à la saisie.
export const KG_PAR_LB = 0.45359237

export const kgVersLb = (kg) => kg / KG_PAR_LB
/** Saisie en lb -> kg stocké (2 décimales, assez fin pour retrouver la même valeur affichée). */
export const lbVersKg = (lb) => Math.round(lb * KG_PAR_LB * 100) / 100

/** Valeur affichée d'un poids stocké en kg : kg tel quel, ou lb arrondies à l'unité. */
export const poidsAffiche = (kg, unite = 'kg') => (typeof kg !== 'number' ? kg : unite === 'lb' ? Math.round(kgVersLb(kg)) : kg)

/** Valeur affichée -> valeur à stocker (kg). */
export const poidsStocke = (affiche, unite = 'kg') => (unite === 'lb' ? lbVersKg(affiche) : affiche)

/** 12.5 -> « 12,5 » (virgule française). */
export const nombreFr = (n) => String(n).replace('.', ',')
