// Outils coach du lot « programmes » (voir docs/CONTRAT-OUTILS-COACH.md). Renvoie { nom_outil: def(...) }.
// Même forme de données que l'écran coach (validerProgramme) : { id, clientId, nom, mode, debut, semaines | workouts, joursFixes, notes }.
// Les séances sont créées par service.creerSeance (mêmes blocs, mêmes vidéos que creer_seance), puis placées ici.
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { jourLocal, lundiDe } from '../../../src/domain/dates.js'
import { ErreurService } from '../service.js'
import { norm, slug } from '../util.js'
import { Bloc } from '../outils.js'
import { creerConfirmations } from './confirmer.js'
import { def } from './def.js'
import { jour } from './dates.js'

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const ref = (d) => z.string().trim().min(1).max(120).describe(d)
const jeton = z.string().regex(/^[0-9a-f]{32}$/).optional().describe('Jeton reçu au 1er appel (confirmation)')
const MAX_NOTES = 5000

export function outilsProgrammes(ctx) {
  const { service, backend, now = () => Date.now() } = ctx
  const api = service.api
  // Schémas construits à l'appel (et non à l'import) : outils.js importe ce module et exporte Bloc (import circulaire).
  const Seance = z.object({
    nom: z.string().trim().min(1).max(120).describe('Titre de la séance (ex. « Haut du corps A »)'),
    jour: z.enum(JOURS).optional().describe('Jour fixe de la séance dans la semaine (sinon : « à faire cette semaine », sans jour)'),
    consignes: z.string().max(1000).optional(),
    blocs: z.array(Bloc).max(40).optional().describe('Blocs : { exercice }, { circuit } ou { superset } (comme creer_seance)')
  }).strict()
  const Semaine = z.object({ seances: z.array(Seance).min(1).max(14) }).strict()
  const SeanceAjoutee = Seance.extend({ semaine: z.number().int().min(1).max(52).describe('Numéro de la semaine du programme (1 = première) ; créée si elle n\'existe pas encore') }).strict()
  const confirmations = creerConfirmations(now)
  const aujourdhui = () => jourLocal(now())
  const uid = () => `${now().toString(36)}${randomBytes(2).toString('hex')}`

  async function programmeDe(r, client) {
    const tous = await api.programmes.lister({}, { archives: true })
    const direct = tous.find((p) => p.id === r)
    if (direct) {
      if (client && direct.clientId !== (await service.resoudreClient(client)).id) throw new ErreurService('Ce programme appartient à un autre client.', 'PROGRAMME_AUTRE_CLIENT')
      return direct
    }
    const c = client ? await service.resoudreClient(client) : null
    const trouves = tous.filter((p) => !p.archive && norm(p.nom) === norm(r) && (!c || p.clientId === c.id))
    if (trouves.length === 0) throw new ErreurService(`Programme introuvable : « ${r} ». Utilise lister_programmes.`, 'PROGRAMME_INTROUVABLE')
    if (trouves.length > 1) throw new ErreurService(`Plusieurs programmes s'appellent « ${r} » : ${trouves.map((p) => p.id).join(', ')}. Précise avec l'id.`, 'AMBIGU')
    return trouves[0]
  }

  const ajoutNote = (notes, texte) => `${notes ? `${notes}\n` : ''}[${aujourdhui()}] ${texte.trim()}`.slice(-MAX_NOTES)

  /** Place une séance dans un programme (semaine n, jour 0-6 facultatif) ; renvoie le patch à appliquer. */
  function placement(p, workoutId, n, idxJour) {
    const patch = {}
    if (idxJour !== undefined) patch.joursFixes = { ...(p.joursFixes || {}), [workoutId]: idxJour }
    if (p.mode === 'repete') patch.workouts = [...p.workouts, workoutId]
    else {
      const semaines = (patch.semaines ?? p.semaines).map((s) => [...s])
      while (semaines.length < n) semaines.push([])
      semaines[n - 1].push(workoutId)
      patch.semaines = semaines
    }
    return patch
  }

  /** Crée les séances (mêmes fonctions que creer_seance : blocs, exercices, vidéos) SANS les placer ; en cas d'échec, retire ce qui a été créé. */
  async function creerSeances(clientId, liste, creees) {
    const sansVideo = new Set()
    for (const { semaine, s } of liste) {
      const r = await service.creerSeance({ client: clientId, nom: s.nom, consignes: s.consignes, blocs: s.blocs ?? [], sansPlacement: true })
      creees.push({ id: r.seance.id, semaine, jour: s.jour === undefined ? undefined : JOURS.indexOf(s.jour), nom: s.nom })
      r.exercicesSansVideo.forEach((n) => sansVideo.add(n))
    }
    return [...sansVideo]
  }

  async function nettoyer(creees) {
    for (const w of creees) await backend.supprimer('workouts', w.id).catch(() => {})
  }

  async function resume(p) {
    const exos = new Map((await api.exercices.lister({}, { archives: true })).map((e) => [e.id, e.nom]))
    const semaines = p.mode === 'repete' ? [p.workouts] : p.semaines
    const clients = await api.profils.lister()
    const lignes = []
    for (const [i, ids] of semaines.entries()) {
      const seances = []
      for (const id of ids) {
        const w = await api.workouts.lire(id)
        const j = p.joursFixes?.[id]
        seances.push(w
          ? { id, nom: w.nom, jour: Number.isInteger(j) ? JOURS[j] : null, exercices: w.blocs.flatMap((b) => (b.type === 'exercice' ? [exos.get(b.exerciceId) ?? b.exerciceId] : b.exercices.map((x) => exos.get(x.exerciceId) ?? x.exerciceId))) }
          : { id, nom: null, manquante: true })
      }
      lignes.push({ numero: i + 1, seances })
    }
    return {
      id: p.id, nom: p.nom, clientId: p.clientId, client: clients.find((c) => c.id === p.clientId)?.nom ?? null,
      mode: p.mode, debut: p.debut, ...(p.nbSemaines ? { nbSemaines: p.nbSemaines } : {}), archive: !!p.archive, notes: p.notes ?? '',
      ...(p.mode === 'repete' ? { seancesChaqueSemaine: lignes[0].seances } : { semaines: lignes })
    }
  }

  return {
    lister_programmes: def('Liste les programmes (non archivés), ou ceux d\'un client : id, nom, client, mode, début, nombre de semaines et de séances.',
      z.object({ client: ref('Nom, identifiant ou id du client').optional(), limite: z.number().int().min(1).max(200).optional() }).strict(),
      async ({ client, limite = 50 }) => {
        const c = client ? await service.resoudreClient(client) : null
        const noms = new Map((await api.profils.lister()).map((p) => [p.id, p.nom]))
        const liste = (await api.programmes.lister(c ? { clientId: c.id } : {})).slice(0, limite)
        return { programmes: liste.map((p) => ({ id: p.id, nom: p.nom, clientId: p.clientId, client: noms.get(p.clientId) ?? null, mode: p.mode, debut: p.debut, nbSemaines: p.mode === 'repete' ? p.nbSemaines ?? null : p.semaines.length, nbSeances: p.mode === 'repete' ? p.workouts.length : p.semaines.flat().length })) }
      }),

    voir_programme: def('Détail d\'un programme : semaines, séances (id, nom, jour, exercices) et notes du coach. `programme` = id (ou nom exact, avec `client` pour lever un doute).',
      z.object({ programme: ref('Id ou nom du programme'), client: ref('Client, si on désigne le programme par son nom').optional() }).strict(),
      async (a) => ({ programme: await resume(await programmeDe(a.programme, a.client)) })),

    creer_programme: def('Crée un programme pour un client : plusieurs semaines, chaque semaine avec ses séances (nom, jour fixe lundi…dimanche facultatif, consignes, blocs comme creer_seance : exercices, circuits, supersets). Les vidéos des exercices sont rattachées automatiquement. Obligatoires : client, nom, semaines. `debut` (AAAA-MM-JJ) est ramené au lundi de sa semaine (un mercredi donne le lundi précédent) et vaut le lundi de cette semaine par défaut. `repeter: true` : une seule semaine type répétée chaque semaine (`nbSemaines` pour limiter). `notes` : notes du coach sur le programme. Renvoie l\'id du programme, les ids des séances et les exercices restés sans vidéo.',
      z.object({
        client: ref('Nom, identifiant ou id du client'), nom: z.string().trim().min(1).max(120).describe('Nom du programme'),
        debut: jour.optional(), repeter: z.boolean().optional(), nbSemaines: z.number().int().min(1).max(52).optional(),
        semaines: z.array(Semaine).min(1).max(52), notes: z.string().max(MAX_NOTES).optional()
      }).strict().refine((a) => !a.repeter || a.semaines.length === 1, { message: 'Avec « repeter », fournis une seule semaine (la semaine type)' }),
      async (a) => {
        const c = await service.resoudreClient(a.client)
        const debut = lundiDe(a.debut ?? aujourdhui())
        const existants = await api.programmes.lister({ clientId: c.id })
        const deja = existants.length
        const memeNom = existants.find((p) => norm(p.nom) === norm(a.nom))
        const creees = []
        try {
          const liste = a.semaines.flatMap((sem, i) => sem.seances.map((s) => ({ semaine: i + 1, s })))
          const exercicesSansVideo = await creerSeances(c.id, liste, creees)
          const repete = !!a.repeter
          const p = {
            id: `prog-${slug(c.identifiant)}-${uid()}`, clientId: c.id, nom: a.nom, mode: repete ? 'repete' : 'parSemaine', debut,
            ...(repete ? { workouts: creees.map((w) => w.id), ...(a.nbSemaines ? { nbSemaines: a.nbSemaines } : {}) } : { semaines: a.semaines.map((_, i) => creees.filter((w) => w.semaine === i + 1).map((w) => w.id)) }),
            joursFixes: Object.fromEntries(creees.filter((w) => w.jour !== undefined).map((w) => [w.id, w.jour])),
            ...(a.notes ? { notes: ajoutNote('', a.notes) } : {})
          }
          await api.programmes.creer(p)
          return { id: p.id, programme: await resume(await api.programmes.lire(p.id)), exercicesSansVideo, ...(memeNom ? { avertissement: `Un programme actif « ${memeNom.nom} » (${memeNom.id}) existe déjà pour ce client : celui-ci s'ajoute en double. Archive ou supprime l'ancien si celui-ci le remplace.` } : {}), ...(deja ? { note: `Ce client avait déjà ${deja} programme(s) actif(s) : pense à archiver l'ancien si celui-ci le remplace.` } : {}) }
        } catch (e) { await nettoyer(creees); throw e }
      }, { mutation: true }),

    modifier_programme: def('Modifie un programme : renomme (`nom`), change la date de début (`debut`, ramenée au lundi), remplace les notes (`notes`), ajoute des séances (`ajouterSeances` : semaine n° + nom, jour, consignes, blocs ; une semaine inexistante est créée) ou déplace une séance existante à un autre jour (`deplacerSeance`: { seanceId, jour }). Pour retirer une séance : supprimer_seance. Pour ajouter une note datée sans effacer : noter_programme.',
      z.object({
        programme: ref('Id ou nom du programme'), client: ref('Client, si on désigne le programme par son nom').optional(),
        nom: z.string().trim().min(1).max(120).optional(), debut: jour.optional(), notes: z.string().max(MAX_NOTES).optional(),
        ajouterSeances: z.array(SeanceAjoutee).min(1).max(40).optional(),
        deplacerSeance: z.object({ seanceId: ref('Id de la séance'), jour: z.enum(JOURS) }).strict().optional()
      }).strict(),
      async (a) => {
        let p = await programmeDe(a.programme, a.client)
        const patch = {}
        if (a.nom) patch.nom = a.nom
        if (a.debut) patch.debut = lundiDe(a.debut)
        if (a.notes !== undefined) patch.notes = a.notes
        if (a.deplacerSeance) {
          const { seanceId, jour: j } = a.deplacerSeance
          const ids = p.mode === 'repete' ? p.workouts : p.semaines.flat()
          if (!ids.includes(seanceId)) throw new ErreurService(`La séance « ${seanceId} » n'est pas dans ce programme.`, 'SEANCE_INTROUVABLE')
          patch.joursFixes = { ...(p.joursFixes || {}), [seanceId]: JOURS.indexOf(j) }
        }
        let exercicesSansVideo = []
        const creees = []
        try {
          if (a.ajouterSeances) {
            exercicesSansVideo = await creerSeances(p.clientId, a.ajouterSeances.map((s) => ({ semaine: s.semaine, s })), creees)
            let cible = { ...p, ...patch }
            for (const w of creees) Object.assign(patch, placement(cible, w.id, w.semaine, w.jour)), (cible = { ...p, ...patch })
          }
          if (Object.keys(patch).length) p = await api.programmes.modifier(p.id, patch)
        } catch (e) { await nettoyer(creees); throw e }
        return { id: p.id, programme: await resume(p), exercicesSansVideo }
      }, { mutation: true }),

    supprimer_programme: def('Supprime un programme, EN DEUX TEMPS. 1er appel (sans jeton) : renvoie un résumé et un jeton, ne supprime rien. 2e appel avec le jeton : supprime le programme ; ses séances restent dans la base (lister_seances) sauf si `avecSeances` est vrai. Ne rappelle avec le jeton qu\'après accord explicite du coach. Pour seulement le masquer : l\'archivage se fait dans l\'écran coach.',
      z.object({ programme: ref('Id ou nom du programme'), client: ref('Client, si on désigne le programme par son nom').optional(), avecSeances: z.boolean().optional().describe('Supprime aussi ses séances'), jeton }).strict(),
      async (a) => {
        const p = await programmeDe(a.programme, a.client)
        const cle = `supprimer_programme:${p.id}:${a.avecSeances ? 'avec' : 'sans'}`
        if (!a.jeton) return confirmations.demander(cle, { aSupprimer: await resume(p), avecSeances: !!a.avecSeances })
        if (!confirmations.verifier(cle, a.jeton)) throw new ErreurService('Jeton invalide ou expiré : rappelle avec exactement les mêmes arguments que le premier appel (avec le jeton), ou demande un nouveau jeton : redemande la suppression sans jeton.', 'JETON_INVALIDE')
        const ids = [...new Set(p.mode === 'repete' ? p.workouts : p.semaines.flat())]
        await backend.supprimer('programmes', p.id)
        if (a.avecSeances) {
          const autres = new Set((await api.programmes.lister({}, { archives: true })).flatMap((q) => (q.mode === 'repete' ? q.workouts : q.semaines.flat())))
          for (const id of ids.filter((x) => !autres.has(x))) await backend.supprimer('workouts', id)
        }
        return { supprimee: true, id: p.id, nom: p.nom, seancesSupprimees: !!a.avecSeances }
      }, { mutation: true }),

    dupliquer_seance: def('Copie une séance (blocs, séries, charges) sous un nouveau titre, pour le même client ou un autre (`vers`). Pour la placer dans un programme : `programme` (id ou nom) + `semaine` (n°) + `jour` facultatif ; sans cela la copie existe mais n\'est dans aucun programme. Renvoie l\'id de la copie.',
      z.object({
        seanceId: ref('Id de la séance à copier'), vers: ref('Client destinataire (défaut : le même client)').optional(), nom: z.string().trim().min(1).max(120).optional(),
        programme: ref('Id ou nom du programme où placer la copie').optional(), semaine: z.number().int().min(1).max(52).optional(), jour: z.enum(JOURS).optional()
      }).strict().refine((a) => !(a.semaine || a.jour) || a.programme, { message: 'Précise « programme » pour placer la copie' }),
      async (a) => {
        const src = await api.workouts.lire(a.seanceId)
        if (!src) throw new ErreurService(`Séance introuvable : « ${a.seanceId} ». Utilise lister_seances.`, 'SEANCE_INTROUVABLE')
        const c = a.vers ? await service.resoudreClient(a.vers) : null
        const clientId = c ? c.id : src.clientId
        const id = `w-${slug(c?.identifiant ?? src.clientId ?? 'x')}-${uid()}`
        // Nouveaux identifiants de blocs ; les exercices d'un superset gardent leur suffixe a, b, c…
        const blocs = structuredClone(src.blocs).map((b, i) => {
          const bid = `${id}-b${i + 1}`
          return { ...b, id: bid, ...(b.type === 'superset' ? { exercices: b.exercices.map((x, j) => ({ ...x, id: `${bid}${'abcdefgh'[j]}` })) } : {}) }
        })
        const copie = { id, clientId, nom: a.nom ?? `${src.nom} (copie)`, ...(src.consignes ? { consignes: src.consignes } : {}), blocs }
        await api.workouts.creer(copie)
        let place = null
        try {
          if (a.programme) {
            const p = await programmeDe(a.programme, a.vers)
            if (p.clientId !== clientId) throw new ErreurService('Ce programme n\'appartient pas au client de la copie.', 'PROGRAMME_AUTRE_CLIENT')
            const n = a.semaine ?? 1
            await api.programmes.modifier(p.id, placement(p, id, n, a.jour ? JOURS.indexOf(a.jour) : undefined))
            place = { programmeId: p.id, semaine: p.mode === 'repete' ? null : n, jour: a.jour ?? null }
          }
        } catch (e) { await backend.supprimer('workouts', id); throw e }
        return { id, nom: copie.nom, clientId, nbBlocs: blocs.length, place }
      }, { mutation: true }),

    noter_programme: def('Ajoute à la fin des notes du programme le texte dicté par le coach, tel quel, précédé de la date du jour. N\'efface rien.',
      z.object({ programme: ref('Id ou nom du programme'), client: ref('Client, si on désigne le programme par son nom').optional(), texte: z.string().trim().min(1).max(2000).describe('Texte du coach, conservé tel quel') }).strict(),
      async (a) => {
        const p = await programmeDe(a.programme, a.client)
        const maj = await api.programmes.modifier(p.id, { notes: ajoutNote(p.notes, a.texte) })
        return { id: maj.id, notes: maj.notes }
      }, { mutation: true })
  }
}

