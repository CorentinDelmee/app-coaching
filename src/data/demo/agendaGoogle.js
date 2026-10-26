// FAUX Google Agenda pour le mode démo : même forme que la réponse de l'API Calendar v3 (events.list),
// sans compte Google ni réseau. Les dates sont relatives à `now` (la démo reste vivante).
//
// Trois « moments » enchaînés par le syncToken, comme avec la vraie API :
//   pas de jeton      -> liste complète (cas normaux, ordre inversé, accents, inconnu, ambigu, sans nom, autre événement)
//   « demo-1 »        -> changements : heure/lieu modifiés, une annulation, un titre corrigé, un nouvel événement
//   « demo-2 »        -> plus rien de neuf
// Tout autre jeton => erreur 410 « Gone » (jeton expiré) : le moteur repart d'une synchro complète.
import { ajouterJours, jourLocal } from '../../domain/dates.js'
import { jourHeure } from '../../domain/agendaGoogle.js'

/** Deux clients fictifs de MÊME NOM, visibles seulement par l'agenda démo, pour montrer l'alerte « ambigu ». */
export const HOMONYMES_DEMO = [
  { id: 'demo-homonyme-1', nom: 'Marc Dupont' },
  { id: 'demo-homonyme-2', nom: 'Marc Dupont' }
]
/** Identifiants courts de démo (« #md2 » dans le titre ou la description). */
export const ALIAS_DEMO = { md2: 'demo-homonyme-2' }

/** 'AAAA-MM-JJ' + 'HH:MM' -> instant ISO avec le décalage de Paris (+01:00 l'hiver, +02:00 l'été). */
function iso(date, heure) {
  for (const decalage of ['+01:00', '+02:00']) {
    const candidat = `${date}T${heure}:00${decalage}`
    const lu = jourHeure(candidat)
    if (lu.date === date && lu.heure === heure) return candidat
  }
  return `${date}T${heure}:00+01:00`
}

export function creerFauxGoogle(now) {
  const jour = (n) => ajouterJours(jourLocal(now), n)
  const modifie = new Date(now).toISOString()
  const un = (id, summary, n, heure, fin, extra = {}) => ({
    kind: 'calendar#event', id, status: 'confirmed', etag: `"${id}-v1"`, updated: modifie, summary,
    start: { dateTime: iso(jour(n), heure) }, end: { dateTime: iso(jour(n), fin) }, ...extra
  })

  const complet = [
    un('demo-ev-1', 'Coaching Fabien Vincent', 3, '18:30', '19:30'),
    un('demo-ev-2', 'coaching  LÉA-martin', 4, '10:00', '11:00'),
    un('demo-ev-3', 'COACHING Vincent Fabien', 10, '18:30', '19:30'), // ordre prénom/nom inversé
    un('demo-ev-4', 'Coaching - Thomas Bernard', 6, '19:00', '20:00'),
    un('demo-ev-5', 'Coaching Camille Durand', 5, '12:15', '13:15'), // aucun client de ce nom
    un('demo-ev-6', 'Coaching Marc Dupont', 7, '09:00', '10:00'), // deux clients de ce nom
    un('demo-ev-7', 'Coaching Marc Dupont #md2', 8, '09:00', '10:00'), // levé par l'identifiant court
    un('demo-ev-8', 'Rendez-vous dentiste', 2, '14:00', '15:00') // pas un coaching : ignoré
  ]
  const changements = [
    un('demo-ev-1', 'Coaching Fabien Vincent', 3, '19:15', '20:15', { etag: '"demo-ev-1-v2"', location: 'Salle Pulse, Lyon', updated: new Date(now + 1000).toISOString() }),
    { kind: 'calendar#event', id: 'demo-ev-2', status: 'cancelled' },
    un('demo-ev-5', 'Coaching Thomas Bernard', 5, '12:15', '13:15', { etag: '"demo-ev-5-v2"', updated: new Date(now + 1000).toISOString() }), // titre corrigé
    un('demo-ev-9', 'Coaching', 9, '17:00', '18:00') // sans nom
  ]

  return {
    /** Même contrat que events.list : { items, nextPageToken?, nextSyncToken? }. */
    async lister({ syncToken }) {
      if (!syncToken) return { items: complet, nextSyncToken: 'demo-1' }
      if (syncToken === 'demo-1') return { items: changements, nextSyncToken: 'demo-2' }
      if (syncToken === 'demo-2') return { items: [], nextSyncToken: 'demo-2' }
      const gone = new Error('Sync token is no longer valid')
      gone.status = 410
      throw gone
    }
  }
}
