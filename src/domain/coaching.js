// Calculs de la page Coaching : prochaine séance, rang dans le mois, paiement, délai d'annulation, WhatsApp.
import { horodatage, jourLocal, lundiDe, ajouterJours, moisDe } from './dates.js'
import { formaterEuros, ordinalFeminin, pluriel } from './format.js'

const HEURE_MS = 3600000
const quand = (s) => horodatage(s.date, s.heure)
const parDate = (a, b) => quand(a) - quand(b)

/** Prochaine séance « prévue » à venir, sinon null. */
export function prochaineSeance(seances, now) {
  const futures = seances.filter((s) => s.statut === 'prevue' && quand(s) >= now).sort(parDate)
  return futures[0] || null
}

/** Rang de la séance dans son mois (séances non annulées triées par date/heure) : 1, 2, 3… ou null si annulée. */
export function rangDansLeMois(seances, seance) {
  if (seance.statut === 'annulee') return null
  const mois = moisDe(seance.date)
  const liste = seances.filter((s) => s.statut !== 'annulee' && moisDe(s.date) === mois).sort(parDate)
  const i = liste.findIndex((s) => s.id === seance.id)
  return i < 0 ? null : i + 1
}

/** « C'est votre 3e séance du mois » / « C'est votre 1re séance du mois ». */
export const phraseRang = (rang) => `C'est votre ${ordinalFeminin(rang)} séance du mois`

export function nbSeancesMois(seances, now) {
  const mois = moisDe(jourLocal(now))
  return seances.filter((s) => s.statut !== 'annulee' && moisDe(s.date) === mois).length
}

export function nbSeancesSemaine(seances, now) {
  const lundi = lundiDe(jourLocal(now))
  const dimanche = ajouterJours(lundi, 6)
  return seances.filter((s) => s.statut !== 'annulee' && s.date >= lundi && s.date <= dimanche).length
}

/** Payé ce mois : Σ tarifs figés des séances « faite » du mois (annulées et prévues exclues). */
export function payeCeMois(seances, now) {
  const mois = moisDe(jourLocal(now))
  const faites = seances.filter((s) => s.statut === 'faite' && moisDe(s.date) === mois)
  const total = faites.reduce((n, s) => n + s.tarif, 0)
  return { nb: faites.length, total, libelle: `Payé ce mois : ${recapPaye(faites, total)}` }
}

function recapPaye(faites, total) {
  if (faites.length === 0) return '0 €'
  const tarifs = [...new Set(faites.map((s) => s.tarif))]
  // Tarif unique : « 2 × 35 € = 70 € » ; tarifs mélangés : seulement le total.
  return tarifs.length === 1 ? `${faites.length} × ${formaterEuros(tarifs[0])} = ${formaterEuros(total)}` : formaterEuros(total)
}

/** Vrai si la séance (future) a lieu dans moins de 24 h : l'annulation gratuite n'est plus possible. */
export function moinsDe24h(seance, now) {
  const delta = quand(seance) - now
  return delta >= 0 && delta < 24 * HEURE_MS
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** '18:30' -> « 18 h 30 », '09:00' -> « 9 h ». */
export function formaterHeure(heure) {
  const [h, m] = heure.split(':')
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`
}

/** « mardi 21 octobre, 18 h 30, à domicile » */
export function libelleSeance(seance) {
  const d = new Date(quand(seance))
  const heure = formaterHeure(seance.heure)
  const jour = d.getDate() === 1 ? '1er' : d.getDate()
  const lieu = seance.lieu === 'domicile' ? 'à domicile' : 'en salle'
  return `${JOURS[d.getDay()]} ${jour} ${MOIS[d.getMonth()]}, ${heure}, ${lieu}`
}

export const libelleNbSeances = (n) => `${n} ${pluriel(n, 'séance', 'séances')}`

/** Lien WhatsApp pré-rempli (numéro au format international sans « + », peut être vide). */
export function lienWhatsApp(numero, texte) {
  return `https://wa.me/${String(numero || '').replace(/\D/g, '')}?text=${encodeURIComponent(texte)}`
}

export const messageModifier = (seance, nomClient) =>
  `Bonjour Corentin, c'est ${nomClient}. Je voudrais modifier ma séance du ${libelleSeance(seance)}.`
export const messageAnnuler = (seance, nomClient) =>
  `Bonjour Corentin, c'est ${nomClient}. Je dois annuler ma séance du ${libelleSeance(seance)}.`
export const messageEcrire = (nomClient) => `Bonjour Corentin, c'est ${nomClient}. Je voudrais planifier une séance.`
