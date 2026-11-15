// Cache des lectures récentes (affichage immédiat, puis rafraîchissement : « stale-while-revalidate »).
//
// Règles de sûreté (concurrence optimiste, voir versions.js) :
// - Le cache ne sert QU'À L'AFFICHAGE. Les écritures (`modifier`, `mettreAJour`…) relisent toujours la ligne au serveur
//   (backend.un dans commun.js) : elles ne passent jamais par ce cache.
// - Un éditeur (objet modifié avec `{ version }`) ne lit jamais son objet dans le cache : il le lit frais
//   (`data.<entite>.lire(id)`) avant d'activer l'édition. `lectureRapide` est réservé aux listes et tableaux de bord.
// - Toute écriture passée par `data` invalide l'entité touchée (et ce qui en dépend) AVANT et APRÈS l'appel :
//   une lecture lancée avant une écriture ne peut pas remettre en cache une version d'avant l'écriture.
// - Connexion / déconnexion / toute écriture « globale » : le cache est vidé (jamais les données d'une autre session).
// - Mémoire seulement (rien dans localStorage) ; une entrée vit au plus `ageMax` ms.

const NOMS_LECTURE = new Set(['lister', 'lire', 'recherche', 'detail', 'etat', 'aAttribuer', 'evenements', 'derniereSynchro', 'synchroEtat', 'liste', 'blocages', 'regles', 'url'])
const LECTURES_HAUT = new Set(['utilisateurCourant', 'tailleFile', 'exporterDonnees', 'exporterMesDonnees'])
// Espaces de noms de `data` qui ne sont pas des entités : nom d'invalidation propre.
const ESPACES = { agenda: ['agenda', 'seancesCoaching'], reservations: ['reservations'] }

const copie = (v) => (v === undefined ? undefined : structuredClone(v))

export function creerCacheLectures({ now = () => Date.now(), ageMax = 10 * 60_000, max = 60 } = {}) {
  const gen = new Map() // entite -> compteur d'écritures
  let genTout = 0
  const entrees = new Map() // cle -> { valeur, deps: [[entite, gen]], tout, t }

  const g = (e) => gen.get(e) || 0
  const valide = (x) => x.tout === genTout && now() - x.t <= ageMax && x.deps.every(([e, n]) => g(e) === n)

  return {
    /** Valeur en cache (copie) ou undefined si absente, périmée ou invalidée par une écriture. */
    lire(cle) {
      const x = entrees.get(cle)
      if (!x) return undefined
      if (!valide(x)) { entrees.delete(cle); return undefined }
      entrees.delete(cle); entrees.set(cle, x) // plus récemment utilisée en dernier
      return copie(x.valeur)
    },
    /** Photo des compteurs, à prendre AVANT la requête : `ecrire` refuse si une écriture est passée entre-temps. */
    instantane(entites = []) {
      return { tout: genTout, deps: entites.map((e) => [e, g(e)]) }
    },
    /** Vrai si aucune écriture sur ces entités n'a eu lieu depuis `jeton`. */
    jetonValide(j) { return !!j && j.tout === genTout && j.deps.every(([e, n]) => g(e) === n) },
    /** Range `valeur` sous `cle`. Renvoie false (rien rangé) si une écriture a eu lieu depuis `jeton`. */
    ecrire(cle, valeur, entites = [], jeton = null) {
      if (jeton && !this.jetonValide(jeton)) return false
      entrees.delete(cle)
      entrees.set(cle, { valeur: copie(valeur), deps: entites.map((e) => [e, g(e)]), tout: genTout, t: now() })
      while (entrees.size > max) entrees.delete(entrees.keys().next().value)
      return true
    },
    invalider(...entites) { for (const e of entites) gen.set(e, g(e) + 1) },
    invaliderTout() { genTout++; entrees.clear() },
    taille: () => entrees.size
  }
}

/**
 * Enveloppe l'interface de données (en place) : toute méthode qui n'est pas une lecture invalide le cache.
 * data.<entite>.<ecriture>() -> invalide <entite> ; data.agenda / data.reservations -> leur nom ;
 * fonction de premier niveau (connecter, enregistrerSeance, importerDonnees…) -> tout le cache.
 */
export function avecInvalidation(api, cache) {
  const envelopper = (fn, invalider) => async (...args) => {
    invalider()
    try { return await fn(...args) } finally { invalider() }
  }
  for (const [nom, val] of Object.entries(api)) {
    if (typeof val === 'function') {
      if (!LECTURES_HAUT.has(nom)) api[nom] = envelopper(val, () => cache.invaliderTout())
    } else if (val && typeof val === 'object') {
      const cibles = ESPACES[nom] || [nom]
      const invalider = nom === 'photos' ? () => cache.invaliderTout() : () => cache.invalider(...cibles)
      for (const [m, f] of Object.entries(val)) {
        if (typeof f === 'function' && !NOMS_LECTURE.has(m)) val[m] = envelopper(f, invalider)
      }
    }
  }
  return api
}

/**
 * Lecture « rapide » pour un écran d'affichage (liste, tableau de bord) :
 * 1. si une valeur valide est en cache -> `appliquer(valeur, { depuisCache: true })` tout de suite (même tâche, avant tout await) ;
 * 2. `charger()` est TOUJOURS appelé ; sa réponse est rangée (si aucune écriture n'est passée entre-temps) puis appliquée.
 * `entites` : les entités lues par `charger` (une écriture sur l'une d'elles invalide la valeur).
 * `surAttente(promesse)` (option de creerLectureRapide) : appelé quand rien n'est en cache (attente visible).
 * Renvoie `{ depuisCache, frais }` : `frais` = promesse de la lecture réseau (rejet = erreur de `charger`).
 * Avec `{ attendre: true }` (défaut), la fonction attend la lecture fraîche ; avec `attendre: false`, elle rend la main
 * dès que le cache a été appliqué (s'il y en avait un), la lecture fraîche continue.
 */
export function creerLectureRapide(cache, { surAttente = null } = {}) {
  const enVol = new Map() // cle -> promesse : deux écrans qui lisent la même chose en même temps partagent la requête
  return async function lectureRapide(cle, entites, charger, appliquer, { attendre = true } = {}) {
    const enCache = cache.lire(cle)
    if (enCache !== undefined) appliquer(enCache, { depuisCache: true })
    // On ne rejoint une lecture en vol que si aucune écriture n'est passée depuis son départ.
    const vol = enVol.get(cle)
    let p = vol && cache.jetonValide(vol.jeton) ? vol.p : null
    if (!p) {
      const jeton = cache.instantane(entites)
      p = Promise.resolve().then(charger).then((v) => { cache.ecrire(cle, v, entites, jeton); return v })
      const x = { p, jeton }
      p.finally(() => { if (enVol.get(cle) === x) enVol.delete(cle) }).catch(() => {})
      enVol.set(cle, x)
    }
    const frais = p.then((v) => { appliquer(copie(v), { depuisCache: false }); return v })
    if (enCache === undefined && surAttente) surAttente(frais) // l'écran attend vraiment (rien en cache) : le chargeur peut s'afficher
    if (attendre || enCache === undefined) await frais
    else frais.catch(() => {}) // erreur de rafraîchissement : l'affichage du cache reste ; l'appelant peut écouter `frais`
    return { depuisCache: enCache !== undefined, frais }
  }
}
