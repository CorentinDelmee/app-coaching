// Sauvegarde automatique : debounce + file (une seule écriture en vol, la dernière valeur gagne) + erreurs / réessayer.
// Usage : const s = useSauvegardeAuto((valeur, opts) => data.exercices.mettreAJour(id, valeur, opts), { delai: 600, recharger, resumer })
//         s.planifier(valeur) à chaque saisie ; <IndicateurSauvegarde :etat="s.etat.value" :conflit="s.conflit.value" @reessayer="s.reessayer" @recharger="s.recharger" />
// Conflits (Claude ou un autre appareil a modifié l'objet entre-temps) : voir la section « Conflits » de LISEZMOI.md.
import { ref, shallowRef } from 'vue'

/**
 * @param {(valeur:any, opts:{ version?: number }) => Promise<any>} enregistrer  écriture réelle (passe par src/data) ; renvoie l'objet enregistré
 * @param {{ delai?: number, dureeOk?: number, recharger?: (actuel:any) => void, resumer?: (valeur:any) => string }} [options]
 *   delai : attente après la dernière saisie ; dureeOk : « Enregistré » visible puis repos ;
 *   recharger : applique l'objet à jour à l'écran après un conflit ; resumer : texte court de la saisie perdue (« ta dernière saisie : … »)
 */
export function useSauvegardeAuto(enregistrer, { delai = 600, dureeOk = 2400, recharger: appliquer, resumer } = {}) {
  const etat = ref('repos') // 'repos' | 'attente' | 'encours' | 'ok' | 'erreur' | 'conflit'
  const erreur = ref(null)
  const conflit = shallowRef(null) // { actuel, saisie, resume } tant que l'utilisateur n'a pas rechargé
  let minuteur = null
  let minuteurOk = null
  let enAttente // valeur pas encore écrite
  let aEnAttente = false
  let enVol = null
  let derniere // dernière valeur tentée (pour réessayer)
  // Version de l'objet ouvert (null = l'écran ne la suit pas : écriture sans contrôle, comme avant).
  // `generation` change à chaque suivreVersion : la réponse d'une écriture lancée pour un AUTRE objet ne la modifie pas.
  let version = null
  let generation = 0
  const resumerSur = (v) => { try { return resumer ? String(resumer(v) ?? '') : '' } catch { return '' } }

  async function ecrire() {
    if (enVol || !aEnAttente || conflit.value) return enVol
    const valeur = enAttente
    aEnAttente = false
    derniere = valeur
    clearTimeout(minuteurOk)
    etat.value = 'encours'
    const gen = generation
    enVol = (async () => {
      try {
        const r = await (version === null ? enregistrer(valeur) : enregistrer(valeur, { version }))
        if (gen === generation && version !== null && Number.isInteger(r?.version)) version = r.version
        erreur.value = null
        if (!aEnAttente) {
          etat.value = 'ok'
          minuteurOk = setTimeout(() => { if (etat.value === 'ok') etat.value = 'repos' }, dureeOk)
        }
      } catch (e) {
        erreur.value = e
        if (e?.code === 'CONFLIT' && gen === generation) {
          // On arrête la file : rien ne sera réécrit tant que l'utilisateur n'a pas vu l'objet à jour (jamais d'écrasement silencieux).
          clearTimeout(minuteur)
          const saisie = aEnAttente ? enAttente : valeur
          aEnAttente = false
          conflit.value = { actuel: e.actuel ?? null, saisie, resume: resumerSur(saisie) }
          etat.value = 'conflit'
        } else if (!aEnAttente) etat.value = 'erreur' // une saisie plus récente repartira de toute façon ; sinon on garde l'erreur affichée
      } finally {
        enVol = null
      }
      if (aEnAttente) await ecrire()
    })()
    return enVol
  }

  /** À appeler à chaque modification : écrit `delai` ms après la dernière. En conflit : retenue, pas écrite. */
  function planifier(valeur) {
    enAttente = valeur
    if (conflit.value) { conflit.value = { ...conflit.value, saisie: valeur, resume: resumerSur(valeur) }; return }
    aEnAttente = true
    clearTimeout(minuteur)
    if (etat.value !== 'encours') etat.value = 'attente'
    minuteur = setTimeout(ecrire, delai)
  }

  /** Écrit tout de suite (fermeture du panneau, changement d'exercice). Renvoie une promesse. */
  async function maintenant() {
    clearTimeout(minuteur)
    if (enVol) await enVol
    return ecrire()
  }

  /** Après une erreur : retente la dernière valeur. */
  function reessayer() {
    if (conflit.value) return Promise.resolve()
    if (aEnAttente) return maintenant()
    enAttente = derniere
    aEnAttente = true
    return maintenant()
  }

  /**
   * Version de l'objet que l'écran vient de charger (data.x.lire(id).version). À rappeler à CHAQUE chargement
   * (autre objet, rafraîchissement) : les écritures suivantes l'envoient et un changement fait ailleurs donne un conflit.
   */
  function suivreVersion(v) {
    generation++
    version = Number.isInteger(v) && v > 0 ? v : null
  }

  /**
   * Bouton « Recharger » : prend l'objet à jour (`actuel`), abandonne la saisie non enregistrée, reprend les sauvegardes.
   * Appelle l'option `recharger(actuel)` (l'écran remplace son état) ; renvoie `actuel`.
   */
  function recharger() {
    const actuel = conflit.value?.actuel ?? null
    clearTimeout(minuteur)
    aEnAttente = false
    conflit.value = null
    erreur.value = null
    etat.value = 'repos'
    suivreVersion(actuel?.version)
    if (actuel && appliquer) appliquer(actuel)
    return actuel
  }

  /** Une saisie attend d'être écrite, est en cours d'écriture, a échoué ou est bloquée par un conflit (ne pas recharger l'écran). */
  const occupe = () => aEnAttente || !!enVol || etat.value === 'erreur' || !!conflit.value

  /** À appeler au démontage (onBeforeUnmount) : annule les minuteurs, écrit ce qui reste (jamais en conflit). */
  function arreter() {
    clearTimeout(minuteurOk)
    if (conflit.value) { clearTimeout(minuteur); return enVol }
    return aEnAttente ? maintenant() : enVol
  }

  return { etat, erreur, conflit, planifier, maintenant, reessayer, suivreVersion, recharger, occupe, arreter }
}
