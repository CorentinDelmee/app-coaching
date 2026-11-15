// Attentes en cours (lecture réseau sans cache, chargement d'une page) : alimente le chargeur (src/components/Chargeur.vue).
// Pur (sans Vue) : un compteur + des abonnés. `suivre(promesse)` compte l'attente jusqu'à la fin de la promesse.
let enCours = 0
const abonnes = new Set()
const prevenir = () => abonnes.forEach((f) => f(enCours > 0))

export function suivre(promesse) {
  enCours++
  prevenir()
  const fin = () => { enCours = Math.max(0, enCours - 1); prevenir() }
  Promise.resolve(promesse).then(fin, fin)
  return promesse
}
/** Commence une attente ; renvoie la fonction qui la termine (idempotente). */
export function debuter() {
  let fini = false
  let terminer
  suivre(new Promise((r) => { terminer = r }))
  return () => { if (!fini) { fini = true; terminer() } }
}
export function abonner(fn) { abonnes.add(fn); fn(enCours > 0); return () => abonnes.delete(fn) }
export const occupe = () => enCours > 0

/**
 * Affichage différé et tenu : le chargeur n'apparaît qu'après `delai` ms d'attente (une attente courte ne montre rien)
 * et, une fois visible, reste au moins `minimum` ms (pas de clignotement). `afficher(bool)` est appelé aux changements.
 */
export function creerAffichageDiffere(afficher, { delai = 250, minimum = 400, now = () => Date.now(), minuterie = globalThis } = {}) {
  let visible = false
  let depuis = 0
  let tAttente = null
  let tCacher = null
  const montrer = () => { tAttente = null; visible = true; depuis = now(); afficher(true) }
  return function changer(attente) {
    if (attente) {
      if (tCacher) { minuterie.clearTimeout(tCacher); tCacher = null }
      if (!visible && !tAttente) tAttente = minuterie.setTimeout(montrer, delai)
      return
    }
    if (tAttente) { minuterie.clearTimeout(tAttente); tAttente = null }
    if (visible && !tCacher) {
      tCacher = minuterie.setTimeout(() => { tCacher = null; visible = false; afficher(false) }, Math.max(0, minimum - (now() - depuis)))
    }
  }
}
