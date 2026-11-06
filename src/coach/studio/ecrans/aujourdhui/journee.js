// « Aujourd'hui » (Studio coach) : logique pure de la journée du coach. Aucun accès aux données ni Date.now() :
// tout arrive en paramètre (`jour` = 'AAAA-MM-JJ', `minutes` = heure actuelle en minutes depuis minuit, fuseau du coach).
import { ajouterJours, diffJours } from '../../../../domain/dates.js'
import { normaliserReservation, libelleJourLong } from '../../../../domain/reservations.js'
import { questionnairesDus } from '../../../../domain/questionnairesDus.js'
import { lienWhatsApp } from '../../../../domain/coaching.js'

const DUREE_DEFAUT = 60 // minutes, quand la fin n'est pas connue
export const JOURS_SANS_SEANCE = 14 // relance si aucune séance prévue et la dernière date d'au moins 14 jours

export const enMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
/** « 09:00 » → « 9 h 00 » (heures de la frise : toujours les minutes, plus lisible en colonne). */
export const heureCourte = (hhmm) => {
  const t = enMinutes(hhmm)
  return t === null ? '' : `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')}`
}
const lieuTexte = (lieu) => (lieu === 'salle' ? 'en salle' : 'à domicile')
export const prenomDe = (nom = '') => String(nom).trim().split(/\s+/)[0] || ''

/**
 * Tous les rendez-vous connus (séances de l'appli, agenda Google attribué, réservations du site), dédoublonnés.
 * @returns {{id, date, heure, fin, titre, detail, source:'appli'|'google'|'site', lien, clientId?, faite?}[]} triés par date/heure
 */
export function rendezVous({ seances = [], evenements = [], reservations = [], clients = [] }) {
  const nom = (id) => clients.find((c) => c.id === id)?.nom || ''
  const liste = []
  const cle = new Set()
  for (const s of seances) {
    if (s.statut === 'annulee' || !s.date) continue
    cle.add(`${s.clientId}|${s.date}|${s.heure}`)
    liste.push({
      id: `appli-${s.id}`, date: s.date, heure: s.heure || '', fin: '', titre: nom(s.clientId) || 'Client', clientId: s.clientId,
      detail: `Coaching ${lieuTexte(s.lieu)}${s.statut === 'faite' ? ' · faite' : ''}`, source: 'appli', faite: s.statut === 'faite',
      lien: `/coach/clients/${s.clientId}`
    })
  }
  for (const e of evenements) {
    if (e.statut !== 'attribue' || !e.date) continue
    const heure = e.journee ? '' : e.heure
    if (cle.has(`${e.clientId}|${e.date}|${heure}`)) continue
    liste.push({
      id: `google-${e.id}`, date: e.date, heure, fin: e.finHeure || '', titre: nom(e.clientId) || e.clientNom || 'Client', clientId: e.clientId,
      detail: `Agenda Google · ${e.lieuTexte || lieuTexte(e.lieu)}`, source: 'google', lien: e.clientId ? `/coach/clients/${e.clientId}` : '/coach/agenda'
    })
  }
  for (const brut of reservations) {
    const r = normaliserReservation(brut)
    if (!r.date || brut.statut === 'annulee') continue
    liste.push({
      id: `site-${r.id}`, date: r.date, heure: r.heure, fin: r.heureFin, titre: `${r.prenom} ${r.nom.toUpperCase()}`.trim() || 'Réservation',
      detail: `Réservé sur le site${r.commune ? ` · ${r.commune}` : ''}`, source: 'site', lien: '/coach/reservations'
    })
  }
  return liste.sort((a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`))
}

/**
 * Rendez-vous d'un jour avec leur état par rapport à l'heure : 'passe' | 'en-cours' | 'prochain' | 'a-venir'.
 * Un seul rendez-vous est « en cours » ou « prochain » (le repère de la frise).
 */
export function programmeDuJour(tous, jour, minutes) {
  const items = tous.filter((r) => r.date === jour).map((r) => {
    const debut = enMinutes(r.heure)
    const fin = enMinutes(r.fin) ?? (debut === null ? null : debut + DUREE_DEFAUT)
    return { ...r, debut, finMin: fin, etat: 'a-venir' }
  })
  let repere = false
  for (const it of items) {
    if (it.debut === null) continue // toute la journée : pas de repère
    if (it.finMin <= minutes || it.faite) it.etat = 'passe'
    else if (!repere) { it.etat = it.debut <= minutes ? 'en-cours' : 'prochain'; repere = true }
  }
  return items
}

/** Rendez-vous des `n` prochains jours (après `jour`), regroupés par jour, au plus `max` rendez-vous. */
export function prochainsJours(tous, jour, { jours = 7, max = 5 } = {}) {
  const fin = ajouterJours(jour, jours)
  const groupes = []
  for (const r of tous.filter((x) => x.date > jour && x.date <= fin).slice(0, max)) {
    let g = groupes[groupes.length - 1]
    if (!g || g.date !== r.date) {
      g = { date: r.date, libelle: libelleJour(r.date, jour), items: [] }
      groupes.push(g)
    }
    g.items.push(r)
  }
  return groupes
}
const capitaliser = (s) => s.charAt(0).toUpperCase() + s.slice(1)
/** « Aujourd'hui », « Demain » ou « Mardi 10 novembre ». */
export function libelleJour(date, jour) {
  const ecart = diffJours(date, jour)
  return ecart === 0 ? 'Aujourd’hui' : ecart === 1 ? 'Demain' : capitaliser(libelleJourLong(date))
}

/** Frise 7 h – 21 h (élargie si un rendez-vous déborde) : position en % de chaque rendez-vous et du curseur « maintenant ». */
export function frise(items, minutes) {
  const heures = items.filter((i) => i.debut !== null)
  const debut = Math.min(7 * 60, ...heures.map((i) => Math.floor(i.debut / 60) * 60))
  const fin = Math.max(21 * 60, ...heures.map((i) => Math.ceil(i.finMin / 60) * 60))
  const pct = (m) => Math.round(((m - debut) / (fin - debut)) * 1000) / 10
  const graduations = []
  for (let h = debut / 60; h <= fin / 60; h += 2) graduations.push({ h, x: pct(h * 60) })
  return {
    graduations,
    plots: heures.map((i) => ({ id: i.id, x: pct(i.debut), l: Math.max(pct(i.finMin) - pct(i.debut), 1.5), etat: i.etat, titre: i.titre, heure: i.heure })),
    maintenant: minutes >= debut && minutes <= fin ? pct(minutes) : null
  }
}

/**
 * Clients à relancer : questionnaire (hebdo / ponctuel) pas rempli, ou aucune séance prévue depuis longtemps.
 * Le check-in quotidien manquant est déjà une alerte : il n'est pas répété ici.
 * @returns {{id, clientId, nom, raison, detail, message, lienWhatsApp}[]}
 */
export function aRelancer({ clients = [], questionnaires = [], reponses = [], tous = [], seances = [], jour }) {
  const sortie = []
  for (const c of clients) {
    if (c.role !== 'client' || c.archive) continue
    const prenom = prenomDe(c.nom)
    for (const q of questionnairesDus({ questionnaires, reponses, clientId: c.id, aujourdhui: jour })) {
      if (q.frequence === 'quotidien') continue
      const message = `Bonjour ${prenom}, petit rappel : le questionnaire « ${q.nom} » t'attend dans l'appli. Merci !`
      sortie.push({
        id: `q:${c.id}:${q.id}`, clientId: c.id, nom: c.nom, raison: 'questionnaire',
        detail: `${q.frequence === 'hebdo' ? 'Bilan de la semaine' : 'Questionnaire'} « ${q.nom} » à remplir`, message, lienWhatsApp: lienWhatsApp('', message)
      })
    }
    const aVenir = tous.some((r) => r.clientId === c.id && r.date >= jour && !r.faite)
    if (!aVenir) {
      const passees = seances.filter((s) => s.clientId === c.id && s.statut === 'faite' && s.date < jour).map((s) => s.date).sort()
      const derniere = passees[passees.length - 1]
      const ecart = derniere ? diffJours(jour, derniere) : null
      if (ecart === null || ecart >= JOURS_SANS_SEANCE) {
        const message = `Bonjour ${prenom}, comment ça va ? On cale ta prochaine séance ? Dis-moi tes disponibilités.`
        sortie.push({
          id: `s:${c.id}`, clientId: c.id, nom: c.nom, raison: 'seance',
          detail: derniere ? `Aucune séance prévue · dernière il y a ${ecart} jours` : 'Aucune séance prévue',
          message, lienWhatsApp: lienWhatsApp('', message)
        })
      }
    }
  }
  return sortie
}

/** Check-ins quotidiens remplis aujourd'hui : quelques valeurs lisibles. */
export function checkinsDuJour({ reponses = [], clients = [], jour }) {
  const nom = (id) => clients.find((c) => c.id === id)?.nom
  return reponses
    .filter((r) => r.frequence === 'quotidien' && r.date === jour && nom(r.clientId))
    .map((r) => {
      const v = r.valeurs || {}
      const parties = []
      if (typeof v.sommeil === 'number') parties.push(`Sommeil ${v.sommeil}/10`)
      if (typeof v.stress === 'number') parties.push(`Stress ${v.stress}/10`)
      if (typeof v.douleur === 'number' && v.douleur > 0) parties.push(`Douleur ${v.douleur}/10`)
      return { id: r.id, clientId: r.clientId, nom: nom(r.clientId), resume: parties.join(' · ') || 'Check-in rempli', humeur: typeof v.energie === 'string' ? v.energie : '' }
    })
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** « Vendredi 6 novembre » */
export function dateDuJour(jour) {
  const [a, m, j] = jour.split('-').map(Number)
  return capitaliser(`${JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]} ${j === 1 ? '1er' : j} ${MOIS[m - 1]}`)
}

/** Salutation selon l'heure : avant 18 h « Bonjour », après « Bonsoir ». */
export const salutation = (minutes) => (minutes >= 18 * 60 ? 'Bonsoir' : 'Bonjour')

/** Phrase de synthèse sous le titre. */
export function resumeJour(items, nbAlertes) {
  const restants = items.filter((i) => i.etat !== 'passe').length
  const s = items.length === 0
    ? 'Aucun rendez-vous aujourd’hui'
    : restants === 0 ? `${items.length} rendez-vous, tous passés` : `${restants} rendez-vous à venir sur ${items.length}`
  return nbAlertes ? `${s} · ${nbAlertes} alerte${nbAlertes > 1 ? 's' : ''} à traiter` : s
}
