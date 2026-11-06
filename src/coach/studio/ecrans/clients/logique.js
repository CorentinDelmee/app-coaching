// Écran Clients (Studio) : fonctions pures (testées). `aujourdhui` = 'AAAA-MM-JJ' passé en paramètre, jamais Date.now().
import { ajouterJours, lundiDe } from '../../../../domain/dates.js'
import { etatSemaine } from '../../../../domain/programme.js'
import { TEINTES_STUDIO } from '../../medias.js'

/** Texte sans accents ni casse, pour la recherche. */
export const normaliser = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** « Fabien Vincent » -> « FV » ; un seul mot -> 2 premières lettres. */
export function initiales(nom) {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean)
  if (!mots.length) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

/** Teinte stable d'un client (décorative : le nom est toujours écrit à côté). */
export function teinteClient(id) {
  let h = 0
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TEINTES_STUDIO[h % TEINTES_STUDIO.length]
}

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
  return { derniere, depuis, assiduite: profil.archive ? null : assiduite(progs, siennes, aujourdhui), nbAlertes, statut, nbProgrammes: progs.length }
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
