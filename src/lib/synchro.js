// File d'attente hors connexion : les séances terminées sans réseau sont gardées sur l'appareil (data.enregistrerSeanceOuFile)
// et envoyées dès que le réseau revient. `enAttente` alimente l'indicateur « Hors connexion — enregistré sur l'appareil ».
import { ref } from 'vue'
import { data } from '../data/index.js'

export const enAttente = ref(0)

export async function compterAttente() {
  try { enAttente.value = await data.tailleFile() } catch { enAttente.value = 0 }
  return enAttente.value
}

export async function synchroniser() {
  try {
    if (!(await data.utilisateurCourant())) return
    if ((await compterAttente()) > 0) await data.synchroniserFile()
  } catch { /* réseau encore instable : on réessaiera au prochain événement */ }
  await compterAttente()
}

export function demarrerSynchro() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', synchroniser)
  synchroniser()
}
