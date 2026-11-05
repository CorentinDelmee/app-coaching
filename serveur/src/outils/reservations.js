// Outils coach du lot « reservations » (voir docs/CONTRAT-OUTILS-COACH.md). Renvoie { nom_outil: def(...) }.
// Passent par l'API réservation (même clé et mêmes formes JSON que le relais /api/app/reservations/*, voir docs/CONTRAT-VPS.md) :
// config.resaUrl (RESA_API_URL) + config.resaCle (RESA_ADMIN_KEY), appel via ctx.fetchFn (injectable en test).
import { z } from 'zod'
import { def } from './def.js'
import { creerConfirmations } from './confirmer.js'
import { ErreurService } from '../service.js'

const FUSEAU = 'Europe/Paris'
const jeton = z.string().regex(/^[0-9a-f]{32}$/).optional()
const idResa = z.string().trim().min(1).max(80).describe('Id de la réservation (voir lister_reservations)')
const JOUR = /^\d{4}-\d{2}-\d{2}$/
const INSTANT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/
const instant = (d) => z.string().regex(INSTANT, 'format attendu : AAAA-MM-JJ ou AAAA-MM-JJTHH:MM (heure de Paris)').describe(d)

/** Décalage Europe/Paris (ex. « +01:00 ») à un instant donné. */
function decalageParis(ms) {
  const p = new Intl.DateTimeFormat('en', { timeZone: FUSEAU, timeZoneName: 'longOffset' }).formatToParts(ms).find((x) => x.type === 'timeZoneName').value
  const m = /GMT([+-]\d{2}):(\d{2})/.exec(p)
  return m ? `${m[1]}:${m[2]}` : '+00:00'
}

/** « 2026-11-06T14:00 » (heure de Paris) -> ISO avec décalage ; une date seule reste telle quelle (journée entière pour l'API). */
export function versIsoParis(v) {
  if (JOUR.test(v)) return v
  const approx = Date.parse(`${v}:00Z`)
  if (Number.isNaN(approx)) throw new ErreurService(`Date/heure invalide : « ${v} ».`, 'VALIDATION')
  // Deux passes : le décalage dépend de l'instant, lui-même dépendant du décalage (changements d'heure).
  const off = decalageParis(Date.parse(`${v}:00${decalageParis(approx)}`))
  return `${v}:00${off}`
}

// Champs utiles pour le coach ; google_event_id et détails techniques écartés.
const resume = (r) => ({
  id: r.id, debut: r.debut, fin: r.fin, statut: r.statut,
  client: `${r.prenom} ${r.nom}`, email: r.email, telephone: r.telephone, adresse: `${r.adresse}, ${r.commune}`,
  agenda: { a_creer: 'ajout à l\'agenda en cours', cree: 'dans l\'agenda', a_supprimer: 'retrait de l\'agenda en cours', supprime: 'pas dans l\'agenda' }[r.synchro_etat] ?? r.synchro_etat
})

export function outilsReservations(ctx) {
  const { config = {}, fetchFn = globalThis.fetch } = ctx
  const now = ctx.now ?? (() => Date.now())
  const confirmations = creerConfirmations(now)

  /** Appel de l'API réservation ; traduit les erreurs en ErreurService (message français). */
  async function appel(methode, chemin, corps) {
    if (!config.resaCle) throw new ErreurService('L\'API de réservation n\'est pas configurée (RESA_ADMIN_KEY absente).', 'NON_DISPONIBLE')
    let r, donnees
    try {
      r = await fetchFn(`${config.resaUrl}/api/resa/admin/${chemin}`, {
        method: methode, body: corps === undefined ? undefined : JSON.stringify(corps), signal: AbortSignal.timeout(8000),
        headers: { 'X-Resa-Admin-Key': config.resaCle, ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}) }
      })
      donnees = await r.json().catch(() => ({}))
    } catch {
      throw new ErreurService('L\'API de réservation ne répond pas. Réessaie dans un instant.', 'RESERVATION_INDISPONIBLE')
    }
    if (r.status >= 500) throw new ErreurService('L\'API de réservation est indisponible (Google injoignable ?). Réessaie dans un instant.', 'RESERVATION_INDISPONIBLE')
    if (r.status === 404) throw new ErreurService('Introuvable (réservation ou blocage inconnu). Vérifie l\'id avec lister_reservations / lister_blocages.', 'INTROUVABLE')
    if (r.status === 400) throw new ErreurService(`Valeur refusée par l'API de réservation : ${(donnees.champs ?? []).join(', ') || 'requête invalide'}.`, 'VALIDATION')
    if (r.status === 409) {
      const raison = {
        creneau_pris: 'Ce créneau n\'est pas libre (autre réservation, blocage ou événement dans l\'agenda).',
        annulee: 'Cette réservation est déjà annulée.', deja_passee: 'Cette réservation est déjà passée.',
        synchro_en_cours: 'La réservation est en cours de synchronisation avec l\'agenda : réessaie dans une minute.'
      }[donnees.erreur] ?? `Conflit (${donnees.erreur ?? 409}).`
      throw new ErreurService(raison, 'CONFLIT')
    }
    if (!r.ok) throw new ErreurService(`Refusé par l'API de réservation (${r.status}).`, 'REFUSE')
    return donnees
  }

  return {
    lister_reservations: def('Liste les réservations de bilans faites par les clients depuis le site (avec nom, e-mail, téléphone, adresse, état dans l\'agenda). Filtres : statut a_venir (défaut), passees ou annulees ; période du / au (AAAA-MM-JJ, jours inclus, selon la date du rendez-vous).',
      z.object({
        statut: z.enum(['a_venir', 'passees', 'annulees']).optional(),
        du: z.string().regex(JOUR).optional().describe('Premier jour inclus, AAAA-MM-JJ'),
        au: z.string().regex(JOUR).optional().describe('Dernier jour inclus, AAAA-MM-JJ'),
        limite: z.number().int().min(1).max(200).optional().describe('50 par défaut, 200 au maximum')
      }).strict(),
      async ({ statut = 'a_venir', du, au, limite = 50 }) => {
        const { reservations = [] } = await appel('GET', `reservations?statut=${statut}`)
        const jourDe = (r) => r.debut.slice(0, 10) // ISO avec décalage de Paris : les 10 premiers caractères = jour local
        const filtrees = reservations.filter((r) => (!du || jourDe(r) >= du) && (!au || jourDe(r) <= au))
        return { total: filtrees.length, reservations: filtrees.slice(0, limite).map(resume) }
      }),

    annuler_reservation: def('Annule la réservation d\'un client, EN DEUX TEMPS. 1er appel (sans jeton) : renvoie un résumé et un jeton, n\'annule rien. 2e appel avec le jeton : annule ; le créneau redevient libre, l\'événement est retiré de l\'agenda et le client est prévenu par Google (comme quand le coach annule dans l\'app). Ne confirme qu\'après accord explicite du coach.',
      z.object({ id: idResa, jeton }).strict(),
      async ({ id, jeton: j }) => {
        const cle = `annuler_reservation:${id}`
        if (!j) {
          const { reservations = [] } = await appel('GET', 'reservations?statut=a_venir')
          const r = reservations.find((x) => x.id === id)
          if (!r) throw new ErreurService('Aucune réservation à venir avec cet id (déjà annulée, passée ou inconnue). Vérifie avec lister_reservations.', 'INTROUVABLE')
          return confirmations.demander(cle, `Annuler le rendez-vous de ${r.prenom} ${r.nom} le ${r.debut.slice(0, 10)} à ${r.debut.slice(11, 16)}. Le client sera prévenu par l'invitation Google.`)
        }
        if (!confirmations.verifier(cle, j)) throw new ErreurService('Jeton de confirmation invalide ou expiré : redemande l\'annulation sans jeton.', 'JETON_INVALIDE')
        const { reservation } = await appel('POST', `reservations/${encodeURIComponent(id)}/annuler`)
        return { annulee: true, reservation: resume(reservation) }
      }, { mutation: true }),

    deplacer_reservation: def('Déplace une réservation à venir vers un autre horaire (même durée). Appliqué directement : l\'événement de l\'agenda est mis à jour et le client est prévenu par Google. Refusé si le créneau n\'est pas libre (autre réservation, blocage, agenda occupé). Les horaires d\'ouverture ne sont pas imposés : le coach décide.',
      z.object({
        id: idResa,
        debut: instant('Nouveau début : AAAA-MM-JJTHH:MM, heure de Paris, ex. 2026-11-06T14:00')
          .refine((d) => d.includes('T'), 'une heure est nécessaire : AAAA-MM-JJTHH:MM')
      }).strict(),
      async ({ id, debut }) => {
        const r = await appel('POST', `reservations/${encodeURIComponent(id)}/deplacer`, { debut: versIsoParis(debut) })
        return {
          deplacee: true, reservation: resume(r.reservation),
          ...(r.agenda_a_jour === false ? { avertissement: 'Réservation déplacée, mais l\'événement de l\'agenda n\'a pas pu être mis à jour (Google injoignable) : corrige-le à la main et préviens le client.' } : { client_prevenu: true })
        }
      }, { mutation: true }),

    lister_blocages: def('Liste les blocages à venir (congés, rendez-vous perso…) qui empêchent les clients de réserver : id, début, fin, motif.',
      z.object({}).strict(),
      async () => {
        const { blocages = [] } = await appel('GET', 'blocages')
        return { total: blocages.length, blocages }
      }),

    bloquer_creneau: def('Bloque une période : les clients ne pourront plus réserver dessus. Journée entière : debut et fin au format AAAA-MM-JJ (le jour de fin est inclus). Créneau précis : AAAA-MM-JJTHH:MM (heure de Paris). 92 jours au maximum. Renvoie l\'id du blocage (pour debloquer_creneau).',
      z.object({
        debut: instant('Début, ex. 2026-11-06 (journée) ou 2026-11-06T14:00'),
        fin: instant('Fin, ex. 2026-11-06 (journée incluse) ou 2026-11-06T16:00'),
        motif: z.string().trim().max(100).optional().describe('Facultatif, 100 caractères max (ex. « Congé »)')
      }).strict(),
      async ({ debut, fin, motif }) => {
        const { blocage } = await appel('POST', 'blocages', { debut: versIsoParis(debut), fin: versIsoParis(fin), ...(motif ? { motif } : {}) })
        return { id: blocage.id, blocage }
      }, { mutation: true }),

    debloquer_creneau: def('Supprime un blocage (le créneau redevient réservable). Prend l\'id donné par lister_blocages ou bloquer_creneau.',
      z.object({ id: z.string().trim().min(1).max(80).describe('Id du blocage') }).strict(),
      async ({ id }) => {
        await appel('DELETE', `blocages/${encodeURIComponent(id)}`)
        return { debloque: true, id }
      }, { mutation: true })
  }
}
