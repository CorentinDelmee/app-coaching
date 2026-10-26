// Synchronisation Google Agenda -> séances de coaching : règles pures (aucun réseau, aucune horloge, aucun Vue).
// Partagé par l'adaptateur local (démo) et par l'Edge Function Supabase (supabase/functions/sync-google-agenda).
// Un événement « Coaching Fabien Vincent » (ou « Coaching - Vincent Fabien #fv2 ») est attribué au client correspondant.

export const FUSEAU_COACH = 'Europe/Paris'

/** Minuscules, sans accents, tirets/apostrophes/espaces multiples ramenés à un seul espace. */
export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-–—_'’]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Ordre prénom/nom indifférent : on compare les mots triés.
const cleNom = (s) => normaliser(s).split(' ').filter(Boolean).sort().join(' ')

/**
 * Lit le titre (et la description pour l'identifiant #xxx).
 * @returns {null | {nom: string, tag: string|null}} null si le titre ne commence pas par « Coaching » ; nom '' si aucun nom.
 */
export function analyserTitre(titre, description = '') {
  const brut = String(titre ?? '').trim()
  if (!/^coaching(?![\p{L}\p{N}])/iu.test(brut)) return null
  let reste = brut.slice('coaching'.length)
  // un tag « #fv2 » peut être dans le titre ou la description (le titre l'emporte)
  const lireTag = (s) => /#([\p{L}\p{N}_]+)/u.exec(s)?.[1]?.toLowerCase() ?? null
  const tag = lireTag(reste) ?? lireTag(String(description ?? ''))
  reste = reste.replace(/#[\p{L}\p{N}_]+/gu, ' ').replace(/^[\s:–—-]+/, '')
  reste = reste.replace(/^(avec|de|pour)\s+/i, '')
  return { nom: reste.trim(), tag }
}

/**
 * Attribue une analyse à un client.
 * @param {{nom:string, tag:string|null}} analyse
 * @param {{id:string, nom:string}[]} clients clients actifs
 * @param {Record<string,string>} alias identifiant court -> clientId (ex. { fv2: 'id-client' })
 * @returns {{statut:'attribue', clientId:string} | {statut:'ambigu', candidats:string[]} | {statut:'inconnu'} | {statut:'sans-nom'}}
 */
export function attribuer(analyse, clients, alias = {}) {
  const idsActifs = new Set(clients.map((c) => c.id))
  if (analyse.tag) {
    const id = alias[analyse.tag]
    if (id && idsActifs.has(id)) return { statut: 'attribue', clientId: id }
    if (!analyse.nom) return { statut: 'inconnu' }
  }
  if (!analyse.nom) return { statut: 'sans-nom' }
  const cle = cleNom(analyse.nom)
  const trouves = clients.filter((c) => cleNom(c.nom) === cle)
  if (trouves.length === 1) return { statut: 'attribue', clientId: trouves[0].id }
  if (trouves.length > 1) return { statut: 'ambigu', candidats: trouves.map((c) => c.id) }
  return { statut: 'inconnu' }
}

// --- Dates --------------------------------------------------------------------------------------

/** Découpe un instant en { date:'AAAA-MM-JJ', heure:'HH:MM' } dans le fuseau du coach. */
export function jourHeure(dateTimeIso, fuseau = FUSEAU_COACH) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(dateTimeIso)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` }
}

/** Début/fin d'un événement Google ({dateTime} ou {date} pour « toute la journée »). */
function lireMoment(m, fuseau) {
  if (!m) return null
  if (m.dateTime) return { ...jourHeure(m.dateTime, fuseau), instant: Date.parse(m.dateTime), journee: false }
  if (m.date) return { date: m.date, heure: '00:00', instant: Date.parse(`${m.date}T00:00:00Z`), journee: true }
  return null
}

/** « salle »/« studio » dans le lieu -> en salle, sinon à domicile (défaut d'un coaching à domicile). */
export const lieuDepuis = (location) => (/salle|studio|gym|club/i.test(String(location ?? '')) ? 'salle' : 'domicile')

// --- Fusion des changements -------------------------------------------------------------------------

/** État vide d'une synchro : événements « Coaching » connus (clé = id Google) + jeton incrémental. */
export const etatVide = () => ({ syncToken: null, evenements: {}, derniereSynchro: null })

/**
 * Transforme un événement Google en événement « Coaching » stocké, ou null s'il n'est pas un coaching.
 * L'attribution au client n'est PAS figée ici : elle est recalculée à la lecture (evaluer), donc un client
 * renommé ou un alias ajouté se corrige sans nouvelle synchro.
 */
export function lireEvenement(item, fuseau = FUSEAU_COACH) {
  const analyse = analyserTitre(item.summary, item.description)
  if (!analyse) return null
  const debut = lireMoment(item.start, fuseau)
  if (!debut) return null
  const fin = lireMoment(item.end, fuseau)
  return {
    id: item.id, etag: item.etag ?? null, updated: item.updated ?? null,
    titre: String(item.summary ?? '').trim(), nom: analyse.nom, tag: analyse.tag,
    date: debut.date, heure: debut.heure, finHeure: fin && !fin.journee ? fin.heure : null, journee: debut.journee,
    debutMs: debut.instant, lieu: lieuDepuis(item.location), lieuTexte: item.location ?? ''
  }
}

/**
 * Applique un lot de changements Google à l'état (sans le modifier : renvoie un nouvel état).
 * @param {object} etat état précédent
 * @param {object[]} items événements Google (status 'cancelled' = supprimé/annulé)
 * @param {{complet?: boolean}} opts complet = resynchro complète : tout ce qui n'est pas dans `items` disparaît
 * @returns {{etat, bilan:{ajoutes:number, modifies:number, supprimes:number}}}
 */
export function fusionner(etat, items, { complet = false, fuseau = FUSEAU_COACH } = {}) {
  const evenements = complet ? {} : { ...etat.evenements }
  const bilan = { ajoutes: 0, modifies: 0, supprimes: 0 }
  const avant = etat.evenements
  for (const item of items) {
    const ancien = avant[item.id]
    const lu = item.status === 'cancelled' ? null : lireEvenement(item, fuseau)
    if (!lu) {
      // annulé, supprimé, ou titre modifié en autre chose que « Coaching… » : l'événement disparaît
      delete evenements[item.id]
      if (ancien) bilan.supprimes++
      continue
    }
    if (ancien && ancien.etag && ancien.etag === lu.etag && ancien.updated === lu.updated) { evenements[item.id] = ancien; continue }
    evenements[item.id] = lu
    if (ancien) bilan.modifies++
    else bilan.ajoutes++
  }
  if (complet) for (const id of Object.keys(avant)) if (!(id in evenements) && !items.some((i) => i.id === id)) bilan.supprimes++
  return { etat: { ...etat, evenements }, bilan }
}

/**
 * Boucle de synchronisation incrémentale.
 * @param {{lister:(p:{syncToken?:string|null, pageToken?:string|null})=>Promise<{items:object[], nextPageToken?:string, nextSyncToken?:string}>}} source
 *   `lister` lève une erreur avec `.status === 410` quand le syncToken a expiré : on repart de zéro.
 */
export async function synchroniser(source, etat, now) {
  let complet = !etat.syncToken
  for (let essai = 0; essai < 2; essai++) {
    try {
      const items = []
      let pageToken = null
      let suivant = null
      do {
        const page = await source.lister({ syncToken: complet ? null : etat.syncToken, pageToken })
        items.push(...page.items)
        pageToken = page.nextPageToken ?? null
        suivant = page.nextSyncToken ?? suivant
      } while (pageToken)
      const { etat: fusionne, bilan } = fusionner(etat, items, { complet })
      return { etat: { ...fusionne, syncToken: suivant, derniereSynchro: now }, bilan: { ...bilan, complet } }
    } catch (e) {
      if (e && e.status === 410 && !complet) { complet = true; continue } // jeton expiré -> resynchro complète
      throw e
    }
  }
  throw new Error('Synchronisation impossible')
}

// --- Lecture (attribution calculée à la volée) -------------------------------------------------------

/** Événements enrichis de leur attribution : { …événement, statut, clientId?, candidats? }, triés par date. */
export function evaluer(etat, clients, alias = {}) {
  return Object.values(etat.evenements)
    .map((e) => ({ ...e, ...attribuer({ nom: e.nom, tag: e.tag }, clients, alias) }))
    .sort((a, b) => a.debutMs - b.debutMs)
}

const CAUSES = {
  inconnu: 'Aucun client ne porte ce nom : corrigez le titre dans Google Agenda, ou ajoutez un identifiant court (#xx).',
  ambigu: 'Plusieurs clients portent ce nom : ajoutez un identifiant court au titre (ex. « Coaching Fabien Vincent #fv2 »).',
  'sans-nom': 'Le titre « Coaching » ne contient aucun nom de client.'
}

/** Alertes du tableau de bord coach : événements récents ou à venir non attribués. */
export function alertesAgenda(evenementsEvalues, now) {
  return evenementsEvalues
    .filter((e) => e.statut !== 'attribue' && e.debutMs >= now - 86400000)
    .map((e) => ({ id: `agenda-${e.id}`, type: e.statut, titre: e.titre, date: e.date, heure: e.heure, message: CAUSES[e.statut] }))
}

/** Séances au format « séance de coaching » de l'appli, pour un client : futures seulement, prévues. */
export function seancesPourClient(evenementsEvalues, clientId, tarif, now) {
  return evenementsEvalues
    .filter((e) => e.statut === 'attribue' && e.clientId === clientId && e.debutMs >= now)
    .map((e) => ({
      id: `gcal-${e.id}`, clientId, date: e.date, heure: e.heure, lieu: e.lieu, statut: 'prevue', tarif: tarif ?? 0,
      source: 'google', titre: e.titre
    }))
}
