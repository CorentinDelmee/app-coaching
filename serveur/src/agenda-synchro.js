// Synchro Google Agenda -> app (docs/CONTRAT-AGENDA-GOOGLE.md, partie B).
// Lit les événements par l'API réservation (GET /api/resa/admin/evenements), retient les « Coaching … »,
// reconnaît le ou les clients (src/domain/agendaGoogle.js) et tient à jour :
//   - seances_agenda : un événement « Coaching » par ligne (écran Agenda du coach, liste « à attribuer») ;
//   - seances_coaching : une séance par (événement, client) attribué, id `google:<id événement>:<clientId>`.
// Règles : appels réseau d'abord, puis TOUTES les écritures dans une seule transaction synchrone (BEGIN IMMEDIATE) ;
// une synchro à la fois (verrou mémoire) ; un champ modifié à la main par le coach n'est jamais écrasé
// (chaque séance garde dans `synchro` les valeurs écrites par la dernière synchro : un champ qui en diffère a été modifié).
import { cleTitre, estCoaching, jourHeure, reconnaitreClients } from '../../src/domain/agendaGoogle.js'

export const DEBUT_HISTORIQUE = '2026-01-01'
export const INTERVALLE_MS = 15 * 60e3
const JOUR_MS = 864e5
const MAX_JOURS = 400 // limite d'un appel à l'API réservation
const JOURS_FUTUR = 90
const RECUL_MAX = 400 // jours < aujourd'hui − 400 ignorés
const CHAMPS_SUIVIS = ['date', 'heure', 'duree', 'lieu', 'statut']
const SALLE = /salle|studio|gym|club|fitness|sport/i
const TOLERANCE_MIN = 15 // séance saisie à la main au même créneau : pas de doublon

export class ErreurSynchro extends Error {
  constructor(code, statut) { super(code); this.code = code; this.statut = statut }
}

const ajouterJours = (jour, n) => new Date(Date.parse(`${jour}T00:00:00Z`) + n * JOUR_MS).toISOString().slice(0, 10)

/** Fenêtre de la synchro en jours de Paris : du 2026-01-01 (au plus 400 j en arrière) à aujourd'hui + 90 j. */
export function fenetre(now) {
  const auj = jourHeure(now).date
  const min = ajouterJours(auj, -RECUL_MAX)
  return { depuis: DEBUT_HISTORIQUE > min ? DEBUT_HISTORIQUE : min, jusqua: ajouterJours(auj, JOURS_FUTUR) }
}

/** Périodes d'appel (ISO UTC) couvrant [depuis − 1 j, jusqua + 1 j] (marge de fuseau), chacune ≤ 400 jours. */
export function decouper(depuis, jusqua) {
  const fin = Date.parse(`${ajouterJours(jusqua, 2)}T00:00:00Z`)
  const morceaux = []
  for (let t = Date.parse(`${ajouterJours(depuis, -1)}T00:00:00Z`); t < fin; t += MAX_JOURS * JOUR_MS) {
    morceaux.push([new Date(t).toISOString(), new Date(Math.min(t + MAX_JOURS * JOUR_MS, fin)).toISOString()])
  }
  return morceaux
}

export function creerSynchroAgenda({ db, config, fetchFn = (...a) => globalThis.fetch(...a), now = () => Date.now(), log = (...a) => console.error('[agenda]', ...a) }) {
  let enCours = null
  let minuteur = null

  // ---------- Lecture de l'API réservation (aucune écriture en base ici) ----------
  async function lireEvenements(depuis, jusqua) {
    if (!config.resaCle) throw new ErreurSynchro('non_configure', 503)
    const tous = new Map()
    for (const [d, f] of decouper(depuis, jusqua)) {
      let r, corps
      try {
        r = await fetchFn(`${config.resaUrl}/api/resa/admin/evenements?depuis=${encodeURIComponent(d)}&jusqua=${encodeURIComponent(f)}`, {
          headers: { 'x-resa-admin-key': config.resaCle }, signal: AbortSignal.timeout(20000), redirect: 'error'
        })
        corps = await r.json().catch(() => ({}))
      } catch { throw new ErreurSynchro('reservation_indisponible', 502) }
      if (r.status === 503 && corps.erreur === 'google_lecture_non_autorisee') throw new ErreurSynchro('google_lecture_non_autorisee', 503)
      if (!r.ok || !Array.isArray(corps.evenements)) throw new ErreurSynchro('google_indisponible', 502)
      for (const e of corps.evenements) if (e && typeof e.id === 'string' && e.id) tous.set(e.id, e) // un événement à cheval sur 2 périodes : une fois
    }
    return [...tous.values()]
  }

  // ---------- Écriture (synchrone, une transaction) ----------
  const lignesAgenda = () => new Map(db.prepare('SELECT id, data FROM seances_agenda').all().map((l) => [l.id, JSON.parse(l.data)]))
  const lireAlias = () => Object.fromEntries(db.prepare('SELECT cle, client_ids FROM agenda_alias').all().map((l) => [l.cle, JSON.parse(l.client_ids)]))

  /** Moment d'un événement (heure de Paris) ; null si dates absentes ou illisibles. */
  function moment(ev) {
    if (ev.journee) return /^\d{4}-\d{2}-\d{2}$/.test(ev.debut ?? '') ? { date: ev.debut, heure: '00:00', finHeure: null, debutMs: Date.parse(`${ev.debut}T00:00:00Z`), finMs: Date.parse(`${ev.fin || ev.debut}T00:00:00Z`) } : null
    const debutMs = Date.parse(ev.debut ?? ''), finMs = Date.parse(ev.fin ?? '')
    if (Number.isNaN(debutMs)) return null
    const fin = Number.isNaN(finMs) ? debutMs + 3600e3 : finMs
    return { ...jourHeure(debutMs), finHeure: jourHeure(fin).heure, debutMs, finMs: fin, duree: Math.max(0, Math.round((fin - debutMs) / 60e3)) }
  }

  /**
   * Applique des événements (forme de l'API réservation) à la base.
   * complet : la liste couvre toute la fenêtre -> les séances et lignes de la fenêtre absentes de la liste ont disparu.
   */
  function appliquer(evenements, { complet = false, fen = null } = {}) {
    const t = now()
    const b = { evenements: 0, crees: 0, modifies: 0, supprimes: 0, annules: 0, jumelles: 0, journees: 0 }
    db.exec('BEGIN IMMEDIATE')
    try {
      const clients = db.prepare("SELECT id, nom, tarif, lieu_defaut FROM profiles WHERE role = 'client'").all()
      const parId = new Map(clients.map((c) => [c.id, c]))
      const alias = lireAlias()
      const agenda = lignesAgenda()
      const google = new Map(db.prepare("SELECT id, data FROM seances_coaching WHERE id LIKE 'google:%'").all().map((l) => [l.id, JSON.parse(l.data)]))
      const natives = db.prepare("SELECT data FROM seances_coaching WHERE id NOT LIKE 'google:%'").all().map((l) => JSON.parse(l.data))
      const ecrireSeance = db.prepare('INSERT INTO seances_coaching (id, client_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET client_id = excluded.client_id, data = excluded.data')
      const supprimerSeance = db.prepare('DELETE FROM seances_coaching WHERE id = ?')
      const ecrireAgenda = db.prepare('INSERT INTO seances_agenda (id, client_id, statut_attribution, data, maj) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET client_id = excluded.client_id, statut_attribution = excluded.statut_attribution, data = excluded.data, maj = excluded.maj')
      const supprimerAgenda = db.prepare('DELETE FROM seances_agenda WHERE id = ?')
      const seancesDe = (evId) => [...google.values()].filter((s) => s.googleId === evId)

      /** Événement annulé ou disparu : séance future supprimée ; passée gardée (marquée annulée si l'événement est annulé). */
      function disparition(s, annule) {
        if ((s.synchro?.finMs ?? 0) >= t) { supprimerSeance.run(s.id); google.delete(s.id); b.supprimes++; return }
        if (annule && s.statut !== 'annulee' && s.statut === s.synchro?.statut) {
          const maj = { ...s, statut: 'annulee', synchro: { ...s.synchro, statut: 'annulee' } }
          ecrireSeance.run(s.id, s.clientId, JSON.stringify(maj)); google.set(s.id, maj); b.annules++
        }
      }
      /** Le coach a-t-il changé un champ suivi (date, heure, durée, lieu, statut) depuis la dernière synchro ? */
      const modifiee = (s) => CHAMPS_SUIVIS.some((k) => s[k] !== s.synchro?.[k])
      /** Client retiré de l'événement (titre ou attribution corrigés) : sa séance part, passée comprise, sauf si le coach l'a modifiée (audit 2). */
      function retirer(s) {
        if (modifiee(s)) return
        supprimerSeance.run(s.id); google.delete(s.id); b.supprimes++
      }
      const jumelle = (clientId, m) => natives.some((n) => n.clientId === clientId && n.statut !== 'annulee' && n.date === m.date && /^\d{2}:\d{2}$/.test(n.heure ?? '')
        && Math.abs(Number(n.heure.slice(0, 2)) * 60 + Number(n.heure.slice(3)) - (Number(m.heure.slice(0, 2)) * 60 + Number(m.heure.slice(3)))) <= TOLERANCE_MIN)

      const vus = new Set()
      for (const ev of evenements) {
        vus.add(ev.id)
        const m = ev.annule ? null : moment(ev)
        if (ev.annule || !m || !estCoaching(ev.titre)) {
          // Annulé, illisible ou plus un « Coaching » (titre changé) : il quitte l'agenda de l'app.
          if (agenda.has(ev.id)) { supprimerAgenda.run(ev.id); agenda.delete(ev.id) }
          for (const s of seancesDe(ev.id)) disparition(s, !!ev.annule)
          continue
        }
        b.evenements++
        const att = reconnaitreClients(ev.titre, clients, alias)
        const ids = att.statut === 'attribue' ? att.clientIds : []
        const lieuTexte = String(ev.lieu ?? '')
        const ligne = {
          id: ev.id, titre: String(ev.titre).trim(), debut: ev.debut, fin: ev.fin, journee: !!ev.journee, maj: ev.maj ?? null,
          date: m.date, heure: m.heure, finHeure: ev.journee ? null : m.finHeure, debutMs: m.debutMs, lieuTexte,
          lieu: SALLE.test(lieuTexte) ? 'salle' : 'domicile', statut: att.statut,
          ...(ids.length ? { clientId: ids[0], clientIds: ids, clientNom: ids.map((id) => parId.get(id)?.nom).join(', ') } : {}),
          ...(att.candidats ? { candidats: att.candidats } : {})
        }
        if (JSON.stringify(agenda.get(ev.id)) !== JSON.stringify(ligne)) { ecrireAgenda.run(ev.id, ids[0] ?? null, att.statut, JSON.stringify(ligne), t); agenda.set(ev.id, ligne) }
        // Séances : une par client attribué ; les clients retirés du titre perdent la leur.
        for (const s of seancesDe(ev.id)) if (!ids.includes(s.clientId)) retirer(s)
        if (ev.journee) { if (ids.length) b.journees++; continue } // journée entière : affichée dans l'Agenda, pas de séance (heure inconnue)
        for (const clientId of ids) {
          const client = parId.get(clientId)
          const id = `google:${ev.id}:${clientId}`
          const lieu = lieuTexte ? ligne.lieu : (client.lieu_defaut || 'domicile')
          const cible = { date: m.date, heure: m.heure, duree: m.duree, lieu, statut: m.finMs < t ? 'faite' : 'prevue' }
          const synchro = { ...cible, finMs: m.finMs }
          const avant = google.get(id)
          if (!avant) {
            if (jumelle(clientId, m)) { b.jumelles++; continue }
            const s = { id, clientId, ...cible, tarif: client.tarif ?? 0, source: 'google', googleId: ev.id, titre: ligne.titre, lieuTexte, partagee: ids.length > 1, synchro }
            ecrireSeance.run(id, clientId, JSON.stringify(s)); google.set(id, s); b.crees++
            continue
          }
          const apres = { ...avant, titre: ligne.titre, lieuTexte, partagee: ids.length > 1, synchro }
          for (const k of CHAMPS_SUIVIS) if (avant[k] === avant.synchro?.[k]) apres[k] = cible[k] // champ non modifié à la main : suit Google
          if (JSON.stringify(apres) !== JSON.stringify(avant)) { ecrireSeance.run(id, clientId, JSON.stringify(apres)); google.set(id, apres); b.modifies++ }
        }
      }
      if (complet && fen) {
        // Disparus de Google (supprimés définitivement ou sortis de la fenêtre) : seulement dans la fenêtre lue.
        const dedans = (date) => date >= fen.depuis && date <= fen.jusqua
        for (const [id, l] of agenda) if (!vus.has(id) && dedans(l.date)) { supprimerAgenda.run(id); agenda.delete(id) }
        for (const s of [...google.values()]) if (!vus.has(s.googleId) && dedans(s.synchro?.date ?? s.date)) disparition(s, false)
      }
      b.aAttribuer = groupesAAttribuer(agenda.values()).length
      db.exec('COMMIT')
    } catch (e) { db.exec('ROLLBACK'); throw e }
    return b
  }

  function enregistrerBilan(bilan, succes) {
    if (succes) db.prepare('UPDATE agenda_synchro SET derniere_synchro = ?, bilan = ? WHERE id = 1').run(now(), JSON.stringify(bilan))
    else db.prepare('UPDATE agenda_synchro SET bilan = ? WHERE id = 1').run(JSON.stringify(bilan))
  }

  async function executer() {
    const debut = now()
    const fen = fenetre(debut)
    try {
      const evenements = await lireEvenements(fen.depuis, fen.jusqua) // réseau : hors transaction
      const bilan = { ok: true, le: new Date(now()).toISOString(), ...fen, ...appliquer(evenements, { complet: true, fen }) }
      enregistrerBilan(bilan, true)
      return bilan
    } catch (e) {
      const code = e instanceof ErreurSynchro ? e.code : 'interne'
      if (!(e instanceof ErreurSynchro)) log('échec', e.message)
      enregistrerBilan({ ok: false, le: new Date(now()).toISOString(), erreur: code }, false) // rien n'est supprimé
      throw e instanceof ErreurSynchro ? e : new ErreurSynchro('interne', 500)
    }
  }

  /** Lance une synchro ; si une synchro tourne déjà, renvoie son résultat (jamais deux en même temps). */
  function synchroniser() {
    if (!enCours) enCours = executer().finally(() => { enCours = null })
    return enCours
  }

  /** Événements non attribués, regroupés par titre (un alias règle tout le groupe). */
  function groupesAAttribuer(lignes = lignesAgenda().values()) {
    const groupes = new Map()
    for (const l of lignes) {
      if (l.statut === 'attribue' || !l.titre || !l.date) continue // lignes d'avant la synchro (sans titre ni date) ignorées
      const cle = cleTitre(l.titre)
      const g = groupes.get(cle) ?? { cle, titre: l.titre, statut: l.statut, nb: 0, premier: l.date, dernier: l.date, candidats: [] }
      g.nb++
      if (l.date < g.premier) g.premier = l.date
      if (l.date > g.dernier) g.dernier = l.date
      for (const c of l.candidats ?? []) if (!g.candidats.includes(c)) g.candidats.push(c)
      groupes.set(cle, g)
    }
    return [...groupes.values()].sort((a, b) => b.dernier.localeCompare(a.dernier))
  }

  function aAttribuer() {
    const noms = new Map(db.prepare("SELECT id, nom, archive FROM profiles WHERE role = 'client'").all().map((c) => [c.id, c]))
    return groupesAAttribuer().map((g) => ({ ...g, candidats: g.candidats.filter((id) => noms.has(id)).map((id) => ({ id, nom: noms.get(id).nom, archive: !!noms.get(id).archive })) }))
  }

  /** Le coach attribue un titre à 1 à 6 clients : alias retenu, puis les événements de ce titre sont réappliqués (sans réseau). */
  function attribuer(titre, clientIds) {
    if (typeof titre !== 'string' || !titre.trim() || titre.length > 300 || !estCoaching(titre)) throw new ErreurSynchro('invalide', 400)
    if (!Array.isArray(clientIds) || !clientIds.length || clientIds.length > 6 || clientIds.some((id) => typeof id !== 'string')) throw new ErreurSynchro('invalide', 400)
    const ids = [...new Set(clientIds)]
    const existe = db.prepare("SELECT 1 FROM profiles WHERE id = ? AND role = 'client'")
    if (!ids.every((id) => existe.get(id))) throw new ErreurSynchro('client_inconnu', 400)
    const cle = cleTitre(titre)
    db.prepare('INSERT INTO agenda_alias (cle, client_ids, cree_le) VALUES (?, ?, ?) ON CONFLICT(cle) DO UPDATE SET client_ids = excluded.client_ids').run(cle, JSON.stringify(ids), now())
    const evenements = [...lignesAgenda().values()].filter((l) => cleTitre(l.titre) === cle)
      .map((l) => ({ id: l.id, titre: l.titre, debut: l.debut, fin: l.fin, journee: l.journee, lieu: l.lieuTexte, maj: l.maj, annule: false }))
    return { cle, clientIds: ids, ...appliquer(evenements) }
  }

  function dernierBilan() {
    const l = db.prepare('SELECT derniere_synchro, bilan FROM agenda_synchro WHERE id = 1').get()
    return { derniereSynchro: l?.derniere_synchro ? new Date(Number(l.derniere_synchro)).toISOString() : null, bilan: l?.bilan ? JSON.parse(l.bilan) : null }
  }

  /** Au démarrage (après 5 s) puis toutes les 15 min. Les échecs sont seulement journalisés (code, jamais de secret). */
  function demarrer(intervalleMs = INTERVALLE_MS) {
    const tour = () => synchroniser().catch((e) => log('synchro', e.code ?? e.message))
    const premier = setTimeout(tour, 5000)
    minuteur = setInterval(tour, intervalleMs)
    premier.unref?.(); minuteur.unref?.()
    return () => { clearTimeout(premier); clearInterval(minuteur) }
  }

  return { synchroniser, attribuer, aAttribuer, dernierBilan, demarrer, appliquer }
}
