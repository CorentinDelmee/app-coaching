// Sauvegarde automatique : debounce + file (une seule écriture en vol, la dernière valeur gagne) + erreurs / réessayer.
// Usage : const s = useSauvegardeAuto((valeur) => data.exercices.modifier(id, valeur), { delai: 600 })
//         s.planifier(valeur) à chaque saisie ; <IndicateurSauvegarde :etat="s.etat.value" @reessayer="s.reessayer" />
import { ref } from 'vue'

/**
 * @param {(valeur:any) => Promise<any>} enregistrer  écriture réelle (passe par src/data)
 * @param {{ delai?: number, dureeOk?: number }} [options]  delai : attente après la dernière saisie ; dureeOk : « Enregistré » visible puis repos
 */
export function useSauvegardeAuto(enregistrer, { delai = 600, dureeOk = 2400 } = {}) {
  const etat = ref('repos') // 'repos' | 'attente' | 'encours' | 'ok' | 'erreur'
  const erreur = ref(null)
  let minuteur = null
  let minuteurOk = null
  let enAttente // valeur pas encore écrite
  let aEnAttente = false
  let enVol = null
  let derniere // dernière valeur tentée (pour réessayer)

  async function ecrire() {
    if (enVol || !aEnAttente) return enVol
    const valeur = enAttente
    aEnAttente = false
    derniere = valeur
    clearTimeout(minuteurOk)
    etat.value = 'encours'
    enVol = (async () => {
      try {
        await enregistrer(valeur)
        erreur.value = null
        if (!aEnAttente) {
          etat.value = 'ok'
          minuteurOk = setTimeout(() => { if (etat.value === 'ok') etat.value = 'repos' }, dureeOk)
        }
      } catch (e) {
        erreur.value = e
        // Une saisie plus récente repartira de toute façon ; sinon on garde l'erreur affichée.
        if (!aEnAttente) etat.value = 'erreur'
      } finally {
        enVol = null
      }
      if (aEnAttente) await ecrire()
    })()
    return enVol
  }

  /** À appeler à chaque modification : écrit `delai` ms après la dernière. */
  function planifier(valeur) {
    enAttente = valeur
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
    if (aEnAttente) return maintenant()
    enAttente = derniere
    aEnAttente = true
    return maintenant()
  }

  /** À appeler au démontage (onBeforeUnmount) : annule les minuteurs, écrit ce qui reste. */
  function arreter() {
    clearTimeout(minuteurOk)
    return aEnAttente ? maintenant() : enVol
  }

  return { etat, erreur, planifier, maintenant, reessayer, arreter }
}
