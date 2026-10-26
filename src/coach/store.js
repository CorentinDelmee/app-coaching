// État partagé du tableau de bord coach : session, alertes, helpers. Toutes les données passent par src/data.
import { reactive } from 'vue'
import data from '../data/index.js'
import { toutesLesAlertes } from '../domain/alertes.js'

export const COMPTE_COACH_LOCAL = { identifiant: 'corentin', code: 'COACH2026' }

export const etat = reactive({ alertes: [], alertesAgenda: 0, clients: [], erreur: '' })

export const maintenant = () => Date.now()
export const uuid = () => globalThis.crypto.randomUUID()

/**
 * Ouvre la session coach. Mode local : connexion automatique au compte de démo (le lot 9 ajoutera l'écran de connexion).
 * @returns {Promise<'ok'|'client'|'echec'>} 'client' = un client est connecté (il ne doit pas voir /coach).
 */
export async function ouvrirSessionCoach() {
  const actuel = await data.utilisateurCourant()
  if (actuel?.role === 'coach') return 'ok'
  if (actuel) return 'client'
  if (data.mode !== 'local') return 'echec'
  try {
    await data.connecter(COMPTE_COACH_LOCAL.identifiant, COMPTE_COACH_LOCAL.code)
    return 'ok'
  } catch {
    return 'echec'
  }
}

/** Recharge la liste des clients (actifs) et les alertes de tous. */
export async function rafraichir() {
  const [profils, reponses, douleurs, realisations, alertesVues] = await Promise.all([
    data.profils.lister(), data.reponses.lister(), data.douleurs.lister(), data.realisations.lister(), data.alertesVues.lister()
  ])
  const clients = profils.filter((p) => p.role === 'client').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const de = (liste, id) => liste.filter((x) => x.clientId === id)
  etat.clients = clients
  etat.alertesAgenda = await data.agenda.etat().then((a) => a.alertes.length, () => 0)
  etat.alertes = toutesLesAlertes(
    clients.map((profil) => ({ profil, reponses: de(reponses, profil.id), douleurs: de(douleurs, profil.id), realisations: de(realisations, profil.id) })),
    alertesVues, maintenant()
  )
}

export async function marquerVue(alerte) {
  await data.alertesVues.creer({ id: alerte.id, clientId: alerte.clientId, vueLe: maintenant() })
  await rafraichir()
}

export const nomClient = (id) => etat.clients.find((c) => c.id === id)?.nom || 'Modèle'

/** Message d'erreur lisible depuis une exception de la couche données. */
export const messageErreur = (e) => (e && e.message) || 'Une erreur est survenue'
