// Alertes coach : pas de check-in depuis 3 jours, douleur > 6, séance commentée.
import { diffJours, jourLocal } from './dates.js'

export const SEUIL_JOURS_SANS_CHECKIN = 3
export const SEUIL_DOULEUR = 6 // alerte si strictement supérieur
export const FENETRE_DOULEUR_JOURS = 7

/**
 * Alertes d'UN client.
 * @param {{profil, reponses, douleurs, realisations, alertesVues}} donnees
 *   reponses : toutes les réponses du client (le check-in quotidien a frequence 'quotidien')
 *   alertesVues : AlerteVue[] — une alerte vue ne revient pas (clé identique)
 * @returns {{id, type:'checkin'|'douleur'|'commentaire', clientId, message, date?}[]}
 */
export function alertesClient({ profil, reponses = [], douleurs = [], realisations = [], alertesVues = [] }, now) {
  if (!profil || profil.role !== 'client' || profil.archive) return []
  const aujourdhui = jourLocal(now)
  const alertes = []

  // 1. Pas de check-in quotidien depuis 3 jours (ou jamais, si client créé il y a 3 jours ou plus).
  const checkins = reponses.filter((r) => r.frequence === 'quotidien').map((r) => r.date).sort()
  const dernier = checkins[checkins.length - 1]
  const refJour = dernier || jourLocal(profil.creeLe)
  const ecart = diffJours(aujourdhui, refJour)
  if (ecart >= SEUIL_JOURS_SANS_CHECKIN) {
    alertes.push({
      id: `checkin:${profil.id}:${dernier || 'jamais'}`, type: 'checkin', clientId: profil.id,
      message: dernier ? `Pas de check-in depuis ${ecart} jours` : 'Aucun check-in depuis la création du compte'
    })
  }

  // 2. Douleur > 6 sur les 7 derniers jours (check-in ou carte du corps).
  const recent = (date) => diffJours(aujourdhui, date) >= 0 && diffJours(aujourdhui, date) < FENETRE_DOULEUR_JOURS
  for (const r of reponses) {
    const v = r.valeurs?.douleur
    if (typeof v === 'number' && v > SEUIL_DOULEUR && recent(r.date)) {
      alertes.push({ id: `douleur:reponse:${r.id}`, type: 'douleur', clientId: profil.id, date: r.date, message: `Douleur ${v}/10 au check-in du ${r.date}` })
    }
  }
  for (const d of douleurs) {
    if (d.intensite > SEUIL_DOULEUR && recent(d.date)) {
      alertes.push({ id: `douleur:${d.id}`, type: 'douleur', clientId: profil.id, date: d.date, message: `Douleur ${d.intensite}/10 (${d.zone}) le ${d.date}` })
    }
  }

  // 3. Séance commentée.
  for (const r of realisations) {
    if (r.commentaire && r.commentaire.trim()) {
      alertes.push({ id: `commentaire:${r.id}`, type: 'commentaire', clientId: profil.id, date: r.date, message: `Séance commentée : « ${r.commentaire} »` })
    }
  }

  const vues = new Set(alertesVues.map((a) => a.id))
  return alertes.filter((a) => !vues.has(a.id))
}

/** Alertes de tous les clients (clients = [{ profil, reponses, douleurs, realisations }]). */
export function toutesLesAlertes(clients, alertesVues, now) {
  return clients.flatMap((c) => alertesClient({ ...c, alertesVues }, now))
}
