// Import MyPTHub, étape 2 (sur le serveur) : JSON normalisé -> base SQLite de l'app, avec les règles de l'app
// (validateurs de creerApi, identifiants et codes comme creer_client, comptes hachés).
// Idempotent : la clé est la source MyPTHub (profil.fiche.source.mypthub.contactId) et des identifiants fixes
// (mp-<contactId>-…) pour tout le reste. Un client déjà présent (même source, même e-mail ou même nom) est
// COMPLÉTÉ : rien d'existant n'est écrasé. `essai` : tout est fait dans une transaction annulée à la fin.
// Choix de Corentin (DECISIONS.md, 2026-11-05) : la santé est importée directement, sans attendre le consentement
// du client (qui le donnera à sa première connexion) ; rien de ce qui touche au paiement n'arrive jusqu'ici.
import { randomUUID } from 'node:crypto'
import { creerApi } from '../../../src/data/commun.js'
import { identifiantUnique, genererCode } from '../../../src/domain/identifiants.js'
import { idMesure } from '../../../src/domain/questionnaireUi.js'
import { hacherCode } from '../app-http.js'
import { norm, slug } from '../util.js'
import { BILAN, MARQUEUR_NOTES } from './normaliser.js'

const TARIF_DEFAUT = 35

/**
 * @param {{ db, backend }} base  db = DatabaseSync, backend = creerStoreSqlite(db)
 * @param {object} normalise sortie de normaliser()
 * @returns {{ codes: {nom, identifiant, code, archive}[], bilan }} codes en clair : à écrire dans un fichier privé, jamais affichés
 */
export async function importer({ db, backend }, normalise, { essai = false, now = () => Date.now(), avantValidation = null } = {}) {
  if (normalise?.version !== 1 || !Array.isArray(normalise.clients)) throw new Error('Fichier normalisé invalide (version 1 attendue).')
  const api = creerApi(backend, { now })
  const codes = []
  const bilan = { essai, clients: [], exercicesCrees: 0, ignores: [] }
  let exos
  db.exec('BEGIN IMMEDIATE')
  try {
    exos = new Map((await backend.tout('exercices')).map((e) => [norm(e.nom), e]))
    for (const [i, c] of normalise.clients.entries()) {
      const ligne = { client: `client-${String(i + 1).padStart(2, '0')}`, action: '', archive: !!c.archive, mesures: 0, mesuresCompletees: 0, reponses: 0, seances: 0, programmes: 0 }
      const r = await trouverOuCreer(c, ligne)
      if (!r) { bilan.ignores.push(ligne.client); bilan.clients.push(ligne); continue }
      const pid = r.id
      const cle = `mp-${slug(c.source.mypthub_contact_id)}`
      await importerMesures(pid, c.mesures || [], ligne)
      await importerQuestionnaire(pid, `${cle}-parq`, 'PAR-Q (MyPTHub)', (c.parq?.questions || []).map((q, k) => ({ cle: `q${k + 1}`, libelle: q.question, type: 'texte', valeur: q.reponse })), c.parq?.date, ligne)
      await importerBilans(pid, cle, c.bilans || [], ligne)
      const ids = await importerSeances(pid, cle, c.seances || [], ligne)
      await importerProgrammes(pid, cle, c.programmes || [], ids, ligne)
      bilan.clients.push(ligne)
    }
    if (essai) db.exec('ROLLBACK')
    else { if (avantValidation) avantValidation(codes); db.exec('COMMIT') } // codes écrits AVANT de valider : jamais de compte sans code connu
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { codes: essai ? [] : codes, nouveauxComptes: codes.length, bilan }

  // --- Clients ------------------------------------------------------------------------------------------------
  async function trouverOuCreer(c, ligne) {
    const clients = (await backend.tout('profils')).filter((p) => p.role === 'client')
    const source = String(c.source.mypthub_contact_id)
    let p = clients.find((x) => x.fiche?.source?.mypthub?.contactId === source)
    if (!p && c.profil.email) p = clients.find((x) => x.fiche?.contact?.email && x.fiche.contact.email.toLowerCase() === c.profil.email)
    if (!p) {
      const memeNom = clients.filter((x) => norm(x.nom) === norm(c.profil.nom) && !x.fiche?.source?.mypthub)
      if (memeNom.length > 1) { ligne.action = 'ignoré (plusieurs clients du même nom)'; return null }
      p = memeNom[0]
    }
    const fiche = ficheDe(c)
    if (p) {
      ligne.action = 'complété'
      ligne.archive = !!p.archive // l'état d'archivage existant n'est pas changé
      const actuelle = p.fiche || {}
      const contact = { ...fiche.contact, ...Object.fromEntries(Object.entries(actuelle.contact || {}).filter(([, v]) => v)) }
      const notes = actuelle.notes?.includes(MARQUEUR_NOTES) ? actuelle.notes : [actuelle.notes, fiche.notes].filter(Boolean).join('\n\n')
      const maj = { ...p, fiche: { ...actuelle, contact, notes, source: { ...actuelle.source, mypthub: actuelle.source?.mypthub || fiche.source.mypthub } } }
      if (JSON.stringify(maj.fiche) !== JSON.stringify(p.fiche)) await api.profils.modifier(p.id, { fiche: maj.fiche })
      return p
    }
    const nom = c.profil.nom?.trim()
    if (!nom || nom.length < 2) { ligne.action = 'ignoré (nom manquant)'; return null }
    // Mêmes règles que creer_client (serveur/src/outils/clients.js) : identifiant prenom.nom unique, code de 8 caractères haché.
    const pris = (await backend.tout('profils')).map((x) => x.identifiant).concat(db.prepare('SELECT identifiant FROM comptes').all().map((x) => x.identifiant))
    const identifiant = identifiantUnique(nom, pris)
    if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(identifiant)) { ligne.action = 'ignoré (identifiant impossible à fabriquer)'; return null }
    const profil = await api.profils.creer({
      id: randomUUID(), role: 'client', identifiant, nom, tarif: TARIF_DEFAUT, lieuDefaut: 'domicile',
      modules: { habitudes: false, photosRepas: false, calories: false },
      preferences: { son: true, vibration: true, unite: 'kg' }, consentementLe: null, archive: !!c.archive, creeLe: now(), fiche
    })
    const code = genererCode()
    db.prepare("INSERT INTO comptes (identifiant, hash, role, profil_id, archive) VALUES (?, ?, 'client', ?, ?)").run(identifiant, await hacherCode(code), profil.id, c.archive ? 1 : 0)
    codes.push({ nom, identifiant, code, archive: !!c.archive })
    ligne.action = 'créé'
    return profil
  }

  function ficheDe(c) {
    const pr = c.profil || {}
    const contact = Object.fromEntries(Object.entries({ email: pr.email, telephone: pr.telephone, dateNaissance: pr.dateNaissance, sexe: pr.sexe, adresse: pr.adresse }).filter(([, v]) => v))
    return { contact, notes: c.notesCoach || '', source: { mypthub: { contactId: String(c.source.mypthub_contact_id), customerId: c.source.customer_id ?? null, importeLe: normalise.exporteLe } } }
  }

  // --- Santé ---------------------------------------------------------------------------------------------------
  async function importerMesures(pid, mesures, ligne) {
    const existantes = await api.mesures.lister({ clientId: pid }, { archives: true })
    for (const m of mesures) {
      const ex = existantes.find((x) => x.date === m.date)
      if (!ex) {
        await api.mesures.creer({ id: idMesure(pid, m.date), clientId: pid, date: m.date, ...(m.poids !== undefined ? { poids: m.poids } : {}), ...(m.mensurations ? { mensurations: m.mensurations } : {}) })
        ligne.mesures++
        continue
      }
      // Déjà une mesure ce jour-là : on n'ajoute que ce qui manque.
      const patch = {}
      if (ex.poids === undefined && m.poids !== undefined) patch.poids = m.poids
      const manquantes = Object.fromEntries(Object.entries(m.mensurations || {}).filter(([k]) => ex.mensurations?.[k] === undefined))
      if (Object.keys(manquantes).length) patch.mensurations = { ...ex.mensurations, ...manquantes }
      if (Object.keys(patch).length) { await api.mesures.modifier(ex.id, patch); ligne.mesuresCompletees++ }
    }
  }

  /** Questionnaire archivé propre au client (invisible dans sa liste « à remplir ») + une réponse ; seulement s'ils manquent. */
  async function importerQuestionnaire(pid, id, nom, questions, date, ligne, idReponse = `${id}-rep`) {
    if (!questions.length) return
    if (!(await api.questionnaires.lire(id))) {
      await api.questionnaires.creer({ id, clientId: pid, nom, frequence: 'ponctuel', archive: true, questions: questions.map(({ cle, libelle, type }) => ({ cle, libelle, type })) })
    }
    if (!(await api.reponses.lire(idReponse))) {
      await api.reponses.creer({ id: idReponse, clientId: pid, questionnaireId: id, frequence: 'ponctuel', date: date || normalise.exporteLe, valeurs: Object.fromEntries(questions.map((q) => [q.cle, q.valeur])) })
      ligne.reponses++
    }
  }

  async function importerBilans(pid, cle, bilans, ligne) {
    if (!bilans.length) return
    const id = `${cle}-bilans`
    const cles = [...new Set(bilans.flatMap((b) => Object.keys(b.valeurs)))]
    const questions = cles.map((k) => ({ cle: k, libelle: BILAN.find((b) => b.cle === k)?.libelle || k, type: 'texte' }))
    const q = await api.questionnaires.lire(id)
    if (!q) await api.questionnaires.creer({ id, clientId: pid, nom: 'Bilans MyPTHub', frequence: 'ponctuel', archive: true, questions })
    else {
      const nouvelles = questions.filter((x) => !q.questions.some((y) => y.cle === x.cle))
      if (nouvelles.length) await api.questionnaires.modifier(id, { questions: [...q.questions, ...nouvelles] })
    }
    for (const b of bilans) {
      const idr = `${id}-${b.date}`
      if (await api.reponses.lire(idr)) continue
      await api.reponses.creer({ id: idr, clientId: pid, questionnaireId: id, frequence: 'ponctuel', date: b.date, valeurs: b.valeurs })
      ligne.reponses++
    }
  }

  // --- Séances et programmes ---------------------------------------------------------------------------------------
  async function exercice(nom) {
    const n = norm(nom)
    if (exos.has(n)) return exos.get(n)
    let id = `ex-${slug(nom)}`
    if (await api.exercices.lire(id)) id += `-${randomUUID().slice(0, 4)}`
    const e = await api.exercices.creer({ id, nom: nom.trim(), categories: [], description: 'Importé de MyPTHub (à compléter par le coach).' })
    exos.set(n, e)
    bilan.exercicesCrees++
    return e
  }

  // Comme seriesEtChamps (service.js) : poids et reps modifiables par le client, le reste fixé par le coach.
  function champsDe(series) {
    const s = series.length ? series : [{}]
    const champs = ['poids', 'reps', 'fourchetteReps', 'tempsTravail', 'tempo', 'rpe'].filter((k) => s.some((x) => k in x)).map((k) => ({ cle: k, modifiableParClient: k === 'poids' || k === 'reps' }))
    return { series: s, champs }
  }

  async function importerSeances(pid, cle, seances, ligne) {
    const ids = new Map()
    for (const s of seances) {
      const id = `${cle}-w-${slug(s.sourceId)}`
      ids.set(s.sourceId, id)
      if (await api.workouts.lire(id)) continue
      const blocs = []
      for (const [k, b] of s.blocs.entries()) {
        const bid = `${id}-b${k + 1}`
        if (b.type === 'superset') {
          const exercices = []
          for (const [j, x] of b.exercices.entries()) exercices.push({ id: `${bid}${'abcdefghij'[j] ?? j}`, exerciceId: (await exercice(x.nom)).id, ...champsDe(x.series), ...(x.consignes ? { consignes: x.consignes } : {}) })
          blocs.push({ type: 'superset', id: bid, ...(b.repos !== undefined ? { repos: b.repos } : {}), exercices })
        } else {
          blocs.push({ type: 'exercice', id: bid, exerciceId: (await exercice(b.nom)).id, ...champsDe(b.series), ...(b.repos !== undefined ? { repos: b.repos } : {}), ...(b.consignes ? { consignes: b.consignes } : {}) })
        }
      }
      await api.workouts.creer({ id, clientId: pid, nom: s.nom, ...(s.consignes ? { consignes: s.consignes } : {}), blocs })
      ligne.seances++
    }
    return ids
  }

  async function importerProgrammes(pid, cle, programmes, ids, ligne) {
    for (const p of programmes) {
      const id = `${cle}-p-${slug(p.sourceId)}`
      if (await api.programmes.lire(id)) continue
      const semaines = p.semaines.map((s) => s.map((w) => ids.get(w)).filter(Boolean))
      if (!semaines.some((s) => s.length)) continue
      const joursFixes = Object.fromEntries(Object.entries(p.joursFixes || {}).filter(([w]) => ids.has(w)).map(([w, j]) => [ids.get(w), j]))
      // Un programme terminé est gardé archivé (historique) ; seul le programme en cours s'affiche chez le client.
      await api.programmes.creer({ id, clientId: pid, nom: p.nom, mode: 'parSemaine', debut: p.debut, nbSemaines: semaines.length, semaines, joursFixes, archive: !!p.termine })
      ligne.programmes++
    }
  }
}
