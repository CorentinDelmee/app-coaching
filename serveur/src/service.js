// COUCHE SERVICE UNIQUE : toute la logique métier du serveur. L'API REST et le serveur MCP ne font que l'appeler.
// Elle réutilise l'interface de données de l'app (creerApi) : mêmes validations, même format de séance.
import { randomBytes } from 'node:crypto'
import { creerApi } from '../../src/data/commun.js'
import { ajouterJours, jourLocal, jourSemaine, lundiDe } from '../../src/domain/dates.js'
import { etatSemaine, numeroSemaine } from '../../src/domain/programme.js'
import { idYoutube } from '../../src/domain/video.js'
import { chercherYoutube } from './youtube.js'
import { norm, slug } from './util.js'

export class ErreurService extends Error {
  constructor(message, code = 'ERREUR') { super(message); this.code = code }
}

const DUREE_JETON_MS = 5 * 60 * 1000
const SCORE_MINI_AUTO = 40 // en dessous, une vidéo trouvée sur YouTube n'est pas rattachée automatiquement

export function creerService({ backend, biblio, config = {}, now = () => Date.now(), fetchFn = globalThis.fetch }) {
  const api = creerApi(backend, { now })
  const jetons = new Map() // jeton de confirmation -> { seanceId, expire }
  const aujourdhui = () => jourLocal(now())

  // --- Clients ---------------------------------------------------------------------------------
  const clientsActifs = async () => (await api.profils.lister()).filter((p) => p.role === 'client')
  const resume = (p) => ({ id: p.id, nom: p.nom, identifiant: p.identifiant, lieuDefaut: p.lieuDefaut })

  async function chercherClient(q) {
    const tous = await clientsActifs()
    const n = norm(q)
    const mots = n.split(' ').filter(Boolean)
    const exacts = tous.filter((c) => norm(c.nom) === n || c.id === q || c.identifiant === q)
    const trouves = exacts.length ? exacts : tous.filter((c) => mots.length && mots.every((m) => norm(`${c.nom} ${c.identifiant}`).includes(m)))
    return {
      resultats: trouves.map(resume),
      ambigu: trouves.length > 1,
      message: trouves.length === 0 ? 'Aucun client ne correspond.' : trouves.length > 1 ? 'Plusieurs clients correspondent (homonymes ?) : demande lequel avant de continuer.' : 'Un client trouvé.'
    }
  }

  /** Accepte un id, un identifiant ou un nom ; refuse l'ambiguïté. */
  async function resoudreClient(ref) {
    const r = await chercherClient(ref)
    if (r.resultats.length === 0) throw new ErreurService(`Client introuvable : « ${ref} ». Utilise lister_clients.`, 'CLIENT_INTROUVABLE')
    if (r.ambigu) throw new ErreurService(`Plusieurs clients correspondent à « ${ref} » : ${r.resultats.map((c) => `${c.nom} (${c.id})`).join(', ')}. Précise avec l'id.`, 'CLIENT_AMBIGU')
    return (await api.profils.lire(r.resultats[0].id))
  }

  // --- Exercices et vidéos ---------------------------------------------------------------------
  /** Exercice de l'app pour ce nom (nom exact, alias de la bibliothèque, sinon création). */
  async function resoudreExercice(nom) {
    const n = norm(nom)
    const tous = await api.exercices.lister()
    let ex = tous.find((e) => norm(e.nom) === n)
    if (!ex) {
      const connue = biblio.connue(nom)
      if (connue) ex = tous.find((e) => norm(e.nom) === norm(connue.nom))
    }
    if (!ex) ex = tous.find((e) => n.length > 3 && (norm(e.nom).includes(n) || n.includes(norm(e.nom))) && Math.abs(norm(e.nom).length - n.length) < 8)
    if (ex) return ex
    let id = `ex-${slug(nom)}`
    if (await api.exercices.lire(id)) id += `-${randomBytes(2).toString('hex')}`
    return api.exercices.creer({ id, nom: nom.trim(), categories: [], description: 'Ajouté par Claude (à compléter par le coach).' })
  }

  /** Vidéo à utiliser pour un exercice : bibliothèque d'abord, puis YouTube si une clé est configurée. */
  async function trouverVideo(nom) {
    const local = biblio.chercher(nom)[0]
    if (local) return { entree: local, source: 'bibliotheque' }
    if (!config.youtubeCle) return null
    try {
      const [meilleure] = await chercherYoutube(nom, { cle: config.youtubeCle, chainesReconnues: config.chainesReconnues, fetchFn })
      if (meilleure && meilleure.score >= SCORE_MINI_AUTO) {
        const entree = biblio.proposer({ nom, ...meilleure })
        return { entree, source: 'youtube' }
      }
    } catch { /* réseau ou quota : on continue sans vidéo, Claude pourra réessayer */ }
    return null
  }

  /** Attache une vidéo à l'exercice de l'app si elle n'en a pas ; renvoie ce que le client verra. */
  async function videoDe(exercice) {
    let ex = exercice
    if (!ex.lienVideo) {
      const t = await trouverVideo(ex.nom)
      if (t) ex = await api.exercices.modifier(ex.id, { lienVideo: t.entree.video.url })
    }
    if (!ex.lienVideo) return null
    const entree = biblio.chercher(ex.nom).find((e) => e.video.url === ex.lienVideo)
    return { url: ex.lienVideo, statut: entree?.statut ?? 'propose' }
  }

  // --- Construction des blocs (format de l'app, voir docs/FORMAT-JSON.md) ---------------------------
  const MODIFIABLES = { poids: true, reps: true }
  function seriesEtChamps(e) {
    const base = []
    const modele = Array.isArray(e.series) ? e.series : Array.from({ length: e.series ?? 3 }, () => ({}))
    const series = modele.map((s) => {
      const v = {}
      const reps = s.reps ?? e.reps
      const charge = s.charge ?? e.charge
      if (charge !== undefined) v.poids = charge
      if (typeof reps === 'number') v.reps = reps
      else if (typeof reps === 'string') v.fourchetteReps = reps
      const t = s.tempsTravail ?? e.tempsTravail
      if (t !== undefined) v.tempsTravail = t
      if (e.tempo) v.tempo = e.tempo
      if (e.rpe !== undefined) v.rpe = e.rpe
      return v
    })
    for (const cle of ['poids', 'reps', 'fourchetteReps', 'tempsTravail', 'tempo', 'rpe']) {
      if (series.some((s) => cle in s)) base.push({ cle, modifiableParClient: !!MODIFIABLES[cle] })
    }
    return { series, champs: base }
  }

  async function blocExercice(id, e) {
    const ex = await resoudreExercice(e.nom)
    const { series, champs } = seriesEtChamps(e)
    const b = { type: 'exercice', id, exerciceId: ex.id, champs, series }
    if (e.repos !== undefined) b.repos = e.repos
    if (e.consignes) b.consignes = e.consignes
    return b
  }

  async function blocCircuit(id, c) {
    const noms = c.exercices.map((x) => x.nom)
    const exercices = []
    for (const x of c.exercices) exercices.push({ exerciceId: (await resoudreExercice(x.nom)).id, ...(x.reps ? { reps: x.reps } : {}), ...(x.consignes ? { consignes: x.consignes } : {}) })
    const params = {
      amrap: { duree: (c.minutes ?? 0) * 60 },
      emom: { minutes: c.minutes, exercices: noms },
      fortime: c.capMinutes ? { cap: c.capMinutes * 60 } : {},
      timecap: { cap: (c.capMinutes ?? 0) * 60 },
      deathby: {},
      tabata: {},
      intervalles: { tours: c.tours, travail: c.travail, repos: c.repos },
      superset: { tours: c.tours, repos: c.repos, exercices: noms }
    }[c.format]
    return { type: 'circuit', id, nom: c.nom || c.format.toUpperCase(), format: c.format, params, exercices, ...(c.facultatif ? { facultatif: true } : {}) }
  }

  async function blocSuperset(id, s) {
    const exercices = []
    for (const [j, e] of s.exercices.entries()) {
      const { repos, ...reste } = await blocExercice(`${id}${'abcdefgh'[j]}`, e)
      void repos
      delete reste.type
      exercices.push(reste)
    }
    return { type: 'superset', id, ...(s.repos !== undefined ? { repos: s.repos } : {}), exercices }
  }

  async function construireBloc(id, entree) {
    if (entree.exercice) return blocExercice(id, entree.exercice)
    if (entree.circuit) return blocCircuit(id, entree.circuit)
    return blocSuperset(id, entree.superset)
  }

  /** Prochain identifiant de bloc libre dans la séance. */
  const idBlocSuivant = (w) => {
    let n = w.blocs.length + 1
    while (w.blocs.some((b) => b.id === `${w.id}-b${n}`)) n++
    return `${w.id}-b${n}`
  }

  // --- Résumés ---------------------------------------------------------------------------------
  async function resumerSeance(w) {
    const exos = new Map((await api.exercices.lister({}, { archives: true })).map((e) => [e.id, e]))
    const clients = new Map((await api.profils.lister()).map((p) => [p.id, p]))
    const progs = (await api.programmes.lister({ clientId: w.clientId })).filter((p) => (p.workouts || p.semaines?.flat() || []).includes(w.id))
    const lib = (id) => exos.get(id)
    const ligneExo = (b) => {
      const s0 = b.series[0] || {}
      return {
        exercice: lib(b.exerciceId)?.nom ?? b.exerciceId,
        series: b.series.length, reps: s0.reps ?? s0.fourchetteReps ?? null, charge: s0.poids ?? null,
        tempsTravail: s0.tempsTravail ?? null, tempo: s0.tempo ?? null, repos: b.repos ?? null,
        video: lib(b.exerciceId)?.lienVideo ?? null
      }
    }
    return {
      id: w.id, nom: w.nom, clientId: w.clientId, client: clients.get(w.clientId)?.nom ?? null, consignes: w.consignes ?? null,
      jourFixe: progs.map((p) => p.joursFixes?.[w.id]).find((j) => Number.isInteger(j)) ?? null,
      blocs: w.blocs.map((b) =>
        b.type === 'exercice' ? { id: b.id, type: 'exercice', ...ligneExo(b) }
          : b.type === 'superset' ? { id: b.id, type: 'superset', repos: b.repos ?? null, exercices: b.exercices.map(ligneExo) }
            : { id: b.id, type: 'circuit', format: b.format, nom: b.nom, params: b.params, exercices: b.exercices.map((x) => ({ exercice: lib(x.exerciceId)?.nom ?? x.exerciceId, reps: x.reps ?? null, video: lib(x.exerciceId)?.lienVideo ?? null })) })
    }
  }

  /** Exercices d'une séance qui n'ont toujours pas de vidéo (à compléter avec chercher_video_exercice / rattacher_video). */
  async function sansVideo(w) {
    const exos = new Map((await api.exercices.lister()).map((e) => [e.id, e]))
    const ids = w.blocs.flatMap((b) => (b.type === 'exercice' ? [b.exerciceId] : b.exercices.map((x) => x.exerciceId)))
    return [...new Set(ids)].map((id) => exos.get(id)).filter((e) => e && !e.lienVideo).map((e) => e.nom)
  }

  async function reponseSeance(w, extra = {}) {
    // Attache les vidéos disponibles à chaque exercice de la séance (bibliothèque, puis YouTube).
    const exos = await api.exercices.lister()
    const ids = new Set(w.blocs.flatMap((b) => (b.type === 'exercice' ? [b.exerciceId] : b.exercices.map((x) => x.exerciceId))))
    for (const e of exos.filter((x) => ids.has(x.id))) await videoDe(e)
    return { seance: await resumerSeance(w), exercicesSansVideo: await sansVideo(w), ...extra }
  }

  // --- Placement dans le programme du client ---------------------------------------------------------
  async function placer(clientId, workoutId, date) {
    const jour = date ?? aujourdhui()
    const programmes = await api.programmes.lister({ clientId })
    let p = programmes[0]
    let note = null
    if (!p) {
      p = await api.programmes.creer({ id: `prog-${clientId}`, clientId, nom: 'Programme', mode: 'parSemaine', debut: lundiDe(jour), semaines: [[]] })
    }
    const joursFixes = { ...(p.joursFixes || {}) }
    if (date) joursFixes[workoutId] = jourSemaine(date)
    if (p.mode === 'repete') {
      await api.programmes.modifier(p.id, { workouts: [...p.workouts, workoutId], joursFixes })
      if (date) note = `Le programme de ce client se répète chaque semaine : la séance reviendra chaque ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][jourSemaine(date)]}.`
    } else {
      const n = numeroSemaine(p, jour)
      if (n < 1) throw new ErreurService(`La date ${jour} est avant le début du programme (${p.debut}).`, 'DATE_INVALIDE')
      const semaines = p.semaines.map((s) => [...s])
      while (semaines.length < n) semaines.push([])
      semaines[n - 1].push(workoutId)
      await api.programmes.modifier(p.id, { semaines, joursFixes })
    }
    return note
  }

  async function retirerDesProgrammes(workoutId) {
    for (const p of await api.programmes.lister({}, { archives: true })) {
      const patch = {}
      if (p.workouts?.includes(workoutId)) patch.workouts = p.workouts.filter((x) => x !== workoutId)
      if (p.semaines?.some((s) => s.includes(workoutId))) patch.semaines = p.semaines.map((s) => s.filter((x) => x !== workoutId))
      if (p.joursFixes && workoutId in p.joursFixes) { const { [workoutId]: _, ...reste } = p.joursFixes; patch.joursFixes = reste }
      if (Object.keys(patch).length) await api.programmes.modifier(p.id, patch)
    }
  }

  async function seanceExistante(seanceId) {
    const w = await api.workouts.lire(seanceId)
    if (!w) throw new ErreurService(`Séance introuvable : « ${seanceId} ». Utilise lister_seances.`, 'SEANCE_INTROUVABLE')
    return w
  }

  // --- Opérations exposées -----------------------------------------------------------------------------
  return {
    api,
    chercherClient,
    resoudreClient,

    async listerClients() {
      return { clients: (await clientsActifs()).map(resume) }
    },

    async creerSeance({ client, nom, date, consignes, blocs = [] }) {
      const c = await resoudreClient(client)
      const id = `w-${slug(c.identifiant)}-${now().toString(36)}${randomBytes(2).toString('hex')}`
      const w = { id, clientId: c.id, nom, ...(consignes ? { consignes } : {}), blocs: [] }
      for (const entree of blocs) w.blocs.push(await construireBloc(idBlocSuivant(w), entree))
      await api.workouts.creer(w) // validation = celle de l'app
      const note = await placer(c.id, id, date)
      return reponseSeance(w, { date: date ?? null, ...(note ? { note } : {}) })
    },

    async ajouterExercice({ seanceId, ...entree }) {
      const w = await seanceExistante(seanceId)
      w.blocs.push(await construireBloc(idBlocSuivant(w), entree))
      await api.workouts.modifier(w.id, { blocs: w.blocs })
      return reponseSeance(w)
    },

    async modifierSeance({ seanceId, nom, consignes, date, retirerBlocId }) {
      const w = await seanceExistante(seanceId)
      const patch = {}
      if (nom) patch.nom = nom
      if (consignes !== undefined) patch.consignes = consignes
      if (retirerBlocId) {
        if (!w.blocs.some((b) => b.id === retirerBlocId)) throw new ErreurService(`Bloc introuvable : « ${retirerBlocId} ».`, 'BLOC_INTROUVABLE')
        patch.blocs = w.blocs.filter((b) => b.id !== retirerBlocId)
      }
      const maj = await api.workouts.modifier(w.id, patch)
      let note = null
      if (date) { await retirerDesProgrammes(w.id); note = await placer(w.clientId, w.id, date) }
      return reponseSeance(maj, { ...(note ? { note } : {}) })
    },

    /** Suppression en 2 temps : sans jeton -> résumé + jeton (valable 5 min, usage unique) ; avec jeton valide -> suppression. */
    async supprimerSeance({ seanceId, jeton }) {
      const w = await seanceExistante(seanceId)
      if (!jeton) {
        const j = randomBytes(16).toString('hex')
        jetons.set(j, { seanceId, expire: now() + DUREE_JETON_MS })
        return { confirmationRequise: true, jeton: j, valableSecondes: DUREE_JETON_MS / 1000, aSupprimer: await resumerSeance(w), message: 'Rien n\'est supprimé. Montre ce résumé à Corentin, puis rappelle supprimer_seance avec ce jeton s\'il confirme.' }
      }
      const t = jetons.get(jeton)
      if (!t || t.seanceId !== seanceId || t.expire < now()) throw new ErreurService('Jeton de confirmation invalide ou expiré : redemande la suppression sans jeton.', 'JETON_INVALIDE')
      jetons.delete(jeton)
      await retirerDesProgrammes(w.id)
      await backend.supprimer('workouts', w.id)
      return { supprimee: true, id: w.id, nom: w.nom }
    },

    async rattacherVideo({ exercice, url, titre, chaine, duree, justification }) {
      if (!idYoutube(url)) throw new ErreurService('Seuls les liens YouTube sont acceptés (youtube.com/watch?v=…, youtu.be/…, /shorts/…).', 'LIEN_INVALIDE')
      const ex = await resoudreExercice(exercice)
      const validee = biblio.chercher(ex.nom).find((e) => e.statut === 'valide')
      if (validee && validee.video.url !== url) throw new ErreurService(`Une vidéo validée par le coach existe déjà pour « ${ex.nom} » : elle n'est pas remplacée.`, 'VIDEO_VALIDEE')
      const entree = biblio.proposer({ nom: ex.nom, url, titre, chaine, duree, justification: justification || 'Proposée par Claude', score: 50 })
      await api.exercices.modifier(ex.id, { lienVideo: entree.video.url })
      return { exercice: ex.nom, video: entree.video.url, statut: entree.statut, message: 'Vidéo rattachée (à valider par le coach dans la bibliothèque).' }
    },

    async chercherVideoExercice({ nom, limite = 5 }) {
      const locales = biblio.chercher(nom).slice(0, limite).map((e) => ({ id: e.id, url: e.video.url, titre: e.video.titre, chaine: e.video.chaine, duree: e.video.duree, statut: e.statut, score: e.score, justification: e.justification }))
      let youtube = []
      let avertissement = null
      if (config.youtubeCle) {
        try { youtube = await chercherYoutube(nom, { cle: config.youtubeCle, chainesReconnues: config.chainesReconnues, limite, fetchFn }) } catch (e) { avertissement = e.message }
      } else avertissement = 'YOUTUBE_API_KEY non configurée : résultats de la bibliothèque locale seulement.'
      return { exercice: nom, bibliotheque: locales, youtube, ...(avertissement ? { avertissement } : {}) }
    },

    /** Validation / remplacement par le coach (écran « Bibliothèque d'exercices ») : propage au lien de l'exercice. */
    async validerVideo(id) {
      const e = biblio.valider(id)
      const ex = await resoudreExercice(e.nom)
      await api.exercices.modifier(ex.id, { lienVideo: e.video.url })
      return e
    },
    async remplacerVideo(id, { url, titre, chaine }) {
      if (!idYoutube(url)) throw new ErreurService('Lien YouTube invalide.', 'LIEN_INVALIDE')
      const e = biblio.remplacer(id, { url, titre, chaine })
      const ex = await resoudreExercice(e.nom)
      await api.exercices.modifier(ex.id, { lienVideo: e.video.url })
      return e
    },

    async listerSeances({ client } = {}) {
      const filtre = client ? { clientId: (await resoudreClient(client)).id } : {}
      const liste = await api.workouts.lister(filtre)
      return { seances: await Promise.all(liste.map(async (w) => { const r = await resumerSeance(w); return { id: r.id, nom: r.nom, client: r.client, clientId: r.clientId, jourFixe: r.jourFixe, nbBlocs: r.blocs.length } })) }
    },

    async consulterAgenda({ client, du, au }) {
      const c = await resoudreClient(client)
      const debut = du ?? aujourdhui()
      const fin = au ?? ajouterJours(debut, 14)
      const realisations = await api.realisations.lister({ clientId: c.id })
      const workouts = new Map((await api.workouts.lister({ clientId: c.id })).map((w) => [w.id, w]))
      const programmees = []
      for (const p of await api.programmes.lister({ clientId: c.id })) {
        for (let lundi = lundiDe(debut); lundi <= fin; lundi = ajouterJours(lundi, 7)) {
          for (const x of etatSemaine(p, realisations, lundi, aujourdhui()).workouts) {
            if (x.jourPlace && x.jourPlace >= debut && x.jourPlace <= fin) programmees.push({ date: x.jourPlace, seanceId: x.workoutId, nom: workouts.get(x.workoutId)?.nom ?? x.workoutId, fait: x.fait })
          }
        }
      }
      const coaching = (await api.seancesCoaching.lister({ clientId: c.id })).filter((s) => s.date >= debut && s.date <= fin && s.statut !== 'annulee')
      return {
        client: c.nom, du: debut, au: fin,
        coaching: coaching.sort((a, b) => a.date.localeCompare(b.date)).map(({ date, heure, lieu, statut }) => ({ date, heure, lieu, statut })),
        seancesProgrammees: programmees.sort((a, b) => a.date.localeCompare(b.date))
      }
    },

    /** Données lisibles par l'app cliente en mode démo (adaptateur « api ») : jamais de comptes, de codes ni de séances de coaching.
     *  Uniquement avec le magasin fichier (données fictives) : jamais avec une vraie base. */
    async etatPublicDemo() {
      if (backend.mode !== 'fichier') throw new ErreurService('Démo indisponible avec une base réelle', 'NON_AUTORISE')
      const out = {}
      for (const e of ['exercices', 'workouts', 'programmes']) out[e] = await backend.tout(e)
      return out
    }
  }
}
