// Écran Clients (Studio) : fonctions pures (testées). `aujourdhui` = 'AAAA-MM-JJ' passé en paramètre, jamais Date.now().
import { ajouterJours, jourLocal, lundiDe } from '../../../../domain/dates.js'
import { etatSemaine } from '../../../../domain/programme.js'

/** Texte sans accents ni casse, pour la recherche. */
export const normaliser = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Initiales et teinte : une seule définition pour tous les écrans (studio/avatar.js).
export { initiales, teinteDe as teinteClient } from '../../avatar.js'

/** Nombre de jours entre deux dates 'AAAA-MM-JJ' (b - a). */
export const joursEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

/**
 * Assiduité sur les `nbSemaines` semaines terminées + la semaine en cours : séances faites / prévues par les programmes.
 * @returns {number|null} pourcentage 0-100, null si rien n'était prévu
 */
export function assiduite(programmes, realisations, aujourdhui, nbSemaines = 4) {
  let faits = 0
  let total = 0
  const lundi = lundiDe(aujourdhui)
  for (const p of programmes) {
    for (let k = -nbSemaines; k <= 0; k++) {
      const s = etatSemaine(p, realisations, ajouterJours(lundi, k * 7), aujourdhui)
      // Semaine en cours : seulement ce qui est déjà fait compte (pas de pénalité pour ce qui reste à faire).
      if (k === 0) { faits += s.faits; total += s.faits; continue }
      faits += s.faits
      total += s.total
    }
  }
  return total ? Math.min(100, Math.round((faits / total) * 100)) : null
}

/** Résumé affiché sur la carte : dernière séance, jours écoulés, assiduité, alertes, statut. */
export function resumeClient({ profil, realisations = [], programmes = [], nbAlertes = 0, aujourdhui }) {
  const siennes = realisations.filter((r) => r.clientId === profil.id)
  const derniere = siennes.reduce((m, r) => (!m || r.date > m ? r.date : m), null)
  const depuis = derniere ? joursEntre(derniere, aujourdhui) : null
  const progs = programmes.filter((p) => p.clientId === profil.id)
  let statut = 'actif'
  if (profil.archive) statut = 'archive'
  else if (nbAlertes) statut = 'alerte'
  else if (!progs.length) statut = 'sansProgramme'
  else if (depuis === null || depuis > 14) statut = 'aRelancer'
  // Client créé il y a moins de 14 jours : « Nouveau » (il reste « à surveiller » tant qu'il n'a pas de programme).
  const nouveau = Number.isFinite(profil.creeLe) && joursEntre(jourLocal(profil.creeLe), aujourdhui) < 14
  return { derniere, depuis, assiduite: profil.archive ? null : assiduite(progs, siennes, aujourdhui), nbAlertes, statut, nbProgrammes: progs.length, nouveau }
}

/** Libellé de la puce de statut d'une carte. */
export function libelleStatut(resume) {
  if (resume.statut === 'alerte') return `${resume.nbAlertes} alerte${resume.nbAlertes > 1 ? 's' : ''}`
  if (resume.statut === 'sansProgramme' && resume.nouveau) return 'Nouveau · sans programme'
  return LIBELLES_STATUT[resume.statut]
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** 'AAAA-MM-JJ' -> « 12 mars 1985 » (avec l'année : date de naissance) ; texte inattendu rendu tel quel. */
export function dateAvecAnnee(jour) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(jour || ''))
  if (!m || !MOIS[Number(m[2]) - 1]) return String(jour || '')
  const j = Number(m[3])
  return `${j === 1 ? '1er' : j} ${MOIS[Number(m[2]) - 1]} ${m[1]}`
}

export const LIBELLES_STATUT = { actif: 'Actif', alerte: 'Alerte', sansProgramme: 'Sans programme', aRelancer: 'À relancer', archive: 'Archivé' }
export const VARIANTE_STATUT = { actif: 'ok', alerte: 'alerte', sansProgramme: 'propose', aRelancer: 'propose', archive: 'neutre' }

/** « aujourd'hui », « hier », « il y a 5 j », « jamais ». */
export function libelleDepuis(depuis) {
  if (depuis === null || depuis === undefined) return 'Aucune séance faite'
  if (depuis <= 0) return "Dernière séance aujourd'hui"
  if (depuis === 1) return 'Dernière séance hier'
  return `Dernière séance il y a ${depuis} j`
}

/**
 * Filtre et trie la liste. clients : [{ profil, resume }].
 * filtre : 'actifs' | 'attention' (alerte, à relancer, sans programme) | 'archives'
 */
export function filtrerClients(clients, { filtre = 'actifs', recherche = '' } = {}) {
  const q = normaliser(recherche)
  return clients
    .filter(({ profil, resume }) => {
      if (filtre === 'archives') { if (!profil.archive) return false } else if (profil.archive) return false
      if (filtre === 'attention' && !['alerte', 'aRelancer', 'sansProgramme'].includes(resume.statut)) return false
      return !q || normaliser(profil.nom).includes(q) || normaliser(profil.identifiant).includes(q)
    })
    .sort((a, b) => a.profil.nom.localeCompare(b.profil.nom, 'fr'))
}

/** Compteurs des filtres. */
export function compterFiltres(clients) {
  const n = { actifs: 0, attention: 0, archives: 0 }
  for (const { profil, resume } of clients) {
    if (profil.archive) { n.archives++; continue }
    n.actifs++
    if (['alerte', 'aRelancer', 'sansProgramme'].includes(resume.statut)) n.attention++
  }
  return n
}

/** Options du filtre de réponses : un questionnaire par entrée, avec le nombre de réponses ; ponctuels (PAR-Q, bilans) d'abord. */
export function optionsReponses(reponses, questionnaires) {
  const m = new Map()
  for (const r of reponses) m.set(r.questionnaireId, (m.get(r.questionnaireId) || 0) + 1)
  const rang = { ponctuel: 0, hebdo: 1, quotidien: 2 }
  return [...m.entries()]
    .map(([id, n]) => {
      const q = questionnaires.find((x) => x.id === id)
      return { valeur: id, texte: q?.nom || 'Questionnaire', n, rang: rang[q?.frequence] ?? 0 }
    })
    .sort((a, b) => a.rang - b.rang || a.texte.localeCompare(b.texte, 'fr'))
    .map(({ rang: _r, ...o }) => o)
}

/**
 * Numéro de téléphone au format WhatsApp (international, chiffres seuls) : « 06 12 34 56 78 » -> « 33612345678 »,
 * « +33 6 12 34 56 78 » et « 0033… » -> « 33… ». Renvoie '' si le numéro est vide ou trop court pour être un numéro.
 */
export function normaliserTelephone(brut) {
  let n = String(brut || '').replace(/[^\d+]/g, '')
  if (n.startsWith('+')) n = n.slice(1)
  else if (n.startsWith('00')) n = n.slice(2)
  else if (n.startsWith('0')) n = `33${n.slice(1)}`
  n = n.replace(/\D/g, '').replace(/^330/, '33') // « +33 (0)6… »
  return n.length >= 9 && n.length <= 15 ? n : ''
}

/** Numéro enregistré dans la fiche du client (le même champ que l'import MyPTHub : fiche.contact.telephone), normalisé. */
export const telephoneClient = (profil) => normaliserTelephone(profil?.fiche?.contact?.telephone)

/** Profil modifié pour enregistrer le numéro (sans perdre le reste de la fiche). */
export const patchTelephone = (profil, numero) => ({
  fiche: { ...(profil?.fiche || {}), contact: { ...(profil?.fiche?.contact || {}), telephone: normaliserTelephone(numero) } }
})

/** Message d'accès envoyé au client, au tutoiement (le coach tutoie ses clients). */
export function messageAcces({ nom, identifiant, code, url }) {
  const prenom = String(nom || '').trim().split(/\s+/)[0]
  return `Bonjour ${prenom}, voici ton accès à l'application de coaching :\n${url}\nIdentifiant : ${identifiant}\nCode : ${code}\nTu pourras changer ce code dans ton profil.`
}
