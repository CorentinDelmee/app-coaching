// Outils coach du lot « suivi » (voir docs/CONTRAT-OUTILS-COACH.md). Renvoie { nom_outil: def(...) }.
// ctx = { service, backend, biblio, config, now, fetchFn } (voir assembler.js).
// Mêmes entités, validations et règles que l'app (creerApi, alertesClient, accesSante) : l'app et Claude produisent les mêmes données.
import { z } from 'zod'
import { creerApi } from '../../../src/data/commun.js'
import { alertesClient } from '../../../src/domain/alertes.js'
import { accesSante } from '../../../src/domain/consentement.js'
import { ajouterJours, jourLocal } from '../../../src/domain/dates.js'
import { LIEUX, STATUTS_SEANCE } from '../../../src/domain/modele.js'
import { ErreurService } from '../service.js'
import { creerConfirmations } from './confirmer.js'
import { def } from './def.js'

const jour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format AAAA-MM-JJ')
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'heure attendue au format HH:MM')
const ref = (d) => z.string().trim().min(1).max(120).describe(d)
const limite = z.number().int().min(1).max(200).optional().describe('Nombre maximum d\'éléments par liste (défaut 50, max 200)')
const jeton = z.string().regex(/^[0-9a-f]{32}$/).optional()
const PERIODE_DEFAUT_JOURS = 30

const parDate = (a, b) => a.date.localeCompare(b.date)
const arrondi = (n) => Math.round(n * 10) / 10

export function outilsSuivi(ctx) {
  const { service, backend } = ctx
  const now = ctx.now ?? (() => Date.now())
  const api = creerApi(backend, { now })
  const confirmations = creerConfirmations(now)

  /** Lignes dans la période, triées par date ; `recentes` garde les n plus récentes. */
  const dansPeriode = (liste, du, au) => liste.filter((o) => o.date >= du && o.date <= au).sort(parDate)
  const recentes = (liste, n) => liste.slice(-n)

  async function seanceDe(seanceId, client) {
    const s = await api.seancesCoaching.lire(seanceId)
    if (!s) throw new ErreurService(`Séance de coaching introuvable : « ${seanceId} ». Utilise suivi_client pour retrouver son id.`, 'SEANCE_INTROUVABLE')
    if (client) {
      const c = await service.resoudreClient(client)
      if (c.id !== s.clientId) throw new ErreurService(`Cette séance n'appartient pas à ${c.nom}.`, 'SEANCE_AUTRE_CLIENT')
    }
    return s
  }

  const decrire = (s) => `${s.date} ${s.heure} (${s.lieu}, ${s.statut}, ${s.tarif} €)`
  async function sansDoublon(clientId, date, h, ignorerId) {
    const memes = (await api.seancesCoaching.lister({ clientId })).filter((s) => s.id !== ignorerId && s.date === date && s.heure === h && s.statut !== 'annulee')
    if (memes.length) throw new ErreurService(`Ce client a déjà une séance de coaching le ${date} à ${h} (id ${memes[0].id}). Utilise modifier_seance_coaching.`, 'SEANCE_EXISTE')
  }

  return {
    suivi_client: def('Suivi d\'un client sur une période (défaut : 30 derniers jours) : résumé chiffré (séances faites, volume, évolution du poids, douleur maximale, check-ins, nutrition) puis les détails : mesures, douleurs, nutrition, check-ins, séances faites, séances de coaching. Si le client a refusé de partager ses données de santé, mesures / douleurs / nutrition / check-ins ne sont PAS renvoyés (sante.accessible = false) ; les séances faites le sont toujours.',
      z.object({ client: ref('Nom, identifiant ou id du client'), du: jour.optional(), au: jour.optional(), limite }).strict(),
      async ({ client, du, au, limite: n = 50 }) => {
        const c = await service.resoudreClient(client)
        const fin = au ?? jourLocal(now())
        const debut = du ?? ajouterJours(fin, -(PERIODE_DEFAUT_JOURS - 1))
        if (debut > fin) throw new ErreurService('« du » doit être antérieur ou égal à « au ».', 'PERIODE_INVALIDE')
        const f = { clientId: c.id }
        const realisations = dansPeriode(await api.realisations.lister(f), debut, fin)
        const coaching = dansPeriode(await api.seancesCoaching.lister(f), debut, fin)
        const sante = accesSante(c)
        const reponses = sante ? dansPeriode((await api.reponses.lister(f)).filter((r) => r.frequence === 'quotidien'), debut, fin) : []
        const mesures = sante ? dansPeriode(await api.mesures.lister(f), debut, fin) : []
        const douleurs = sante ? dansPeriode(await api.douleurs.lister(f), debut, fin) : []
        const nutrition = sante ? dansPeriode(await api.nutrition.lister(f), debut, fin) : []

        const poids = mesures.filter((m) => typeof m.poids === 'number')
        const douleurMax = Math.max(0, ...douleurs.map((d) => d.intensite), ...reponses.map((r) => (typeof r.valeurs?.douleur === 'number' ? r.valeurs.douleur : 0)))
        // Moyenne par clé numérique des check-ins (humeur, sommeil, douleur…).
        const valeurs = {}
        for (const r of reponses) for (const [k, v] of Object.entries(r.valeurs ?? {})) if (typeof v === 'number') (valeurs[k] ??= []).push(v)
        const resume = {
          seancesFaites: realisations.length,
          volumeTotal: Math.round(realisations.reduce((t, r) => t + (r.volume || 0), 0)),
          dureeTotaleMin: Math.round(realisations.reduce((t, r) => t + (r.dureeSec || 0), 0) / 60),
          seancesCoachingFaites: coaching.filter((s) => s.statut === 'faite').length,
          seancesCoachingPrevues: coaching.filter((s) => s.statut === 'prevue').length,
          seancesCoachingAnnulees: coaching.filter((s) => s.statut === 'annulee').length,
          ...(sante ? {
            poids: poids.length ? { debut: poids[0].poids, fin: poids.at(-1).poids, variation: arrondi(poids.at(-1).poids - poids[0].poids) } : null,
            douleurMax: douleurMax || null,
            nbDouleurs: douleurs.length,
            nbCheckins: reponses.length,
            moyennesCheckins: Object.fromEntries(Object.entries(valeurs).map(([k, v]) => [k, arrondi(v.reduce((a, b) => a + b, 0) / v.length)])),
            nbEntreesNutrition: nutrition.length
          } : {})
        }
        return {
          client: { id: c.id, nom: c.nom }, periode: { du: debut, au: fin },
          sante: sante ? { accessible: true } : { accessible: false, raison: 'Le client n\'a pas accepté de partager ses données de santé (douleurs, poids, nutrition, check-ins).' },
          resume,
          seancesFaites: recentes(realisations, n).map(({ id, date, workoutId, dureeSec, volume, commentaire }) => ({ id, date, seanceId: workoutId, dureeSec, volume, ...(sante ? { commentaire } : {}) })),
          seancesCoaching: recentes(coaching, n).map(({ id, date, heure: h, lieu, statut, tarif }) => ({ id, date, heure: h, lieu, statut, tarif })),
          ...(sante ? {
            mesures: recentes(mesures, n), douleurs: recentes(douleurs, n), nutrition: recentes(nutrition, n),
            checkins: recentes(reponses, n).map(({ id, date, valeurs: v }) => ({ id, date, valeurs: v }))
          } : {})
        }
      }),

    alertes: def('Alertes de TOUS les clients actifs, non encore vues : pas de check-in depuis 3 jours, douleur > 6/10 sur 7 jours, séance commentée par le client. Pour un client qui a refusé les données de santé, seules les séances commentées sont signalées.',
      z.object({ limite }).strict(),
      async ({ limite: n = 50 }) => {
        const profils = (await api.profils.lister()).filter((p) => p.role === 'client')
        const vues = await api.alertesVues.lister()
        const toutes = []
        for (const profil of profils) {
          const f = { clientId: profil.id }
          const sante = accesSante(profil)
          const realisations = await api.realisations.lister(f)
          const reponses = sante ? await api.reponses.lister(f) : []
          const douleurs = sante ? await api.douleurs.lister(f) : []
          for (const a of alertesClient({ profil, reponses, douleurs, realisations, alertesVues: vues }, now())) {
            if (!sante && a.type !== 'commentaire') continue
            toutes.push({ ...a, client: profil.nom })
          }
        }
        return { total: toutes.length, alertes: toutes.slice(0, n) }
      }),

    ecrire_mot_du_coach: def('Écrit un mot du coach affiché au client dans son application (obligatoires : client, texte). La date est aujourd\'hui par défaut. Renvoie l\'id du mot.',
      z.object({ client: ref('Nom, identifiant ou id du client'), texte: z.string().trim().min(1).max(1000), date: jour.optional() }).strict(),
      async ({ client, texte, date }) => {
        const c = await service.resoudreClient(client)
        const mot = await api.motsDuCoach.creer({ clientId: c.id, texte, date: date ?? jourLocal(now()) })
        return { id: mot.id, client: c.nom, date: mot.date, texte: mot.texte }
      }, { mutation: true }),

    planifier_seance_coaching: def('Planifie une séance de coaching (en personne) pour un client : obligatoires client, date (AAAA-MM-JJ) et heure (HH:MM). lieu : « domicile » ou « salle » (défaut : lieu habituel du client). tarif en euros (défaut : tarif du client, figé à la création). Statut « prevue ». Renvoie l\'id.',
      z.object({ client: ref('Nom, identifiant ou id du client'), date: jour, heure, lieu: z.enum(LIEUX).optional(), tarif: z.number().min(0).max(1000).optional() }).strict(),
      async ({ client, date, heure: h, lieu, tarif }) => {
        const c = await service.resoudreClient(client)
        await sansDoublon(c.id, date, h)
        const s = await api.seancesCoaching.creer({ clientId: c.id, date, heure: h, lieu: lieu ?? c.lieuDefaut ?? 'domicile', statut: 'prevue', tarif: tarif ?? c.tarif ?? 0 })
        return { id: s.id, client: c.nom, date: s.date, heure: s.heure, lieu: s.lieu, statut: s.statut, tarif: s.tarif }
      }, { mutation: true }),

    modifier_seance_coaching: def('Modifie une séance de coaching (par son id) : date, heure, lieu, statut (« prevue », « faite », « annulee ») et/ou tarif. Au moins un champ à changer. `client` (facultatif) vérifie que la séance est bien celle de ce client.',
      z.object({ seanceId: ref('Id de la séance de coaching'), client: ref('Nom, identifiant ou id du client').optional(), date: jour.optional(), heure: heure.optional(), lieu: z.enum(LIEUX).optional(), statut: z.enum(STATUTS_SEANCE).optional(), tarif: z.number().min(0).max(1000).optional() }).strict(),
      async ({ seanceId, client, ...patch }) => {
        const champs = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
        if (!Object.keys(champs).length) throw new ErreurService('Rien à modifier : précise au moins date, heure, lieu, statut ou tarif.', 'VALIDATION')
        const s = await seanceDe(seanceId, client)
        const apres = { ...s, ...champs }
        if (apres.statut !== 'annulee' && (champs.date || champs.heure)) await sansDoublon(s.clientId, apres.date, apres.heure, s.id)
        const m = await api.seancesCoaching.modifier(s.id, champs)
        return { id: m.id, clientId: m.clientId, date: m.date, heure: m.heure, lieu: m.lieu, statut: m.statut, tarif: m.tarif }
      }, { mutation: true }),

    supprimer_seance_coaching: def('Supprime définitivement une séance de coaching, EN DEUX TEMPS. 1er appel (sans jeton) : renvoie un résumé et un jeton, ne supprime rien. 2e appel avec le jeton : supprime. Ne rappelle avec le jeton qu\'après accord explicite du coach. (Pour garder une trace, préfère modifier_seance_coaching avec statut « annulee ».)',
      z.object({ seanceId: ref('Id de la séance de coaching'), client: ref('Nom, identifiant ou id du client').optional(), jeton }).strict(),
      async ({ seanceId, client, jeton: j }) => {
        const s = await seanceDe(seanceId, client)
        const cle = `supprimer_seance_coaching:${s.id}`
        if (!j) {
          const c = await api.profils.lire(s.clientId)
          return confirmations.demander(cle, `Supprimer la séance de coaching de ${c?.nom ?? s.clientId} : ${decrire(s)}`)
        }
        if (!confirmations.verifier(cle, j)) throw new ErreurService('Jeton de confirmation invalide, expiré ou pour une autre séance. Refais le 1er appel sans jeton.', 'JETON_INVALIDE')
        await backend.supprimer('seancesCoaching', s.id)
        return { supprimee: true, id: s.id }
      }, { mutation: true })
  }
}
