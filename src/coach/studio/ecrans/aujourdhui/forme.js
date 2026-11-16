// Mémoire de la « forme » de l'écran (hauteurs des zones et nombre d'éléments vus la dernière fois).
// Sert uniquement à dimensionner le squelette pour que le contenu le remplace sans que la page saute.
// Aucune donnée personnelle (que des nombres) ; localStorage facultatif (try/catch), sinon mémoire seule.

const CLE = 'cdc-coaching/1:auj-forme'
const DEFAUT = { n: { items: 3, alertes: 3, relances: 2, checkins: 2, resas: 2 }, h: {} }

/** Tranche de largeur : la mise en page (grille) change aux mêmes seuils que aujourdhui.css. */
export const tranche = (largeur) => (largeur < 900 ? 'm' : largeur < 1180 ? 't' : 'd')

export function creerMemoireForme(stockage = null) {
  let etat = null
  const charger = () => {
    if (etat) return etat
    etat = {}
    try { etat = JSON.parse(stockage?.getItem(CLE) || '{}') || {} } catch { etat = {} }
    return etat
  }
  const enregistrer = () => { try { stockage?.setItem(CLE, JSON.stringify(etat)) } catch { /* mémoire seule */ } }
  return {
    /** Forme connue pour cette tranche (valeurs par défaut sinon). */
    lire(t) {
      const x = charger()[t] || {}
      return { n: { ...DEFAUT.n, ...(x.n || {}) }, h: { ...DEFAUT.h, ...(x.h || {}) } }
    },
    /** Note nombres et hauteurs (seules les valeurs finies et positives sont gardées). */
    noter(t, { n = {}, h = {} } = {}) {
      const x = charger()
      const cur = x[t] || { n: {}, h: {} }
      const bon = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => Number.isFinite(v) && v >= 0).map(([k, v]) => [k, Math.round(v)]))
      x[t] = { n: { ...cur.n, ...bon(n) }, h: { ...cur.h, ...bon(h) } }
      enregistrer()
    }
  }
}

let stockage = null
try { stockage = typeof localStorage !== 'undefined' ? localStorage : null } catch { stockage = null }
export const memoireForme = creerMemoireForme(stockage)
