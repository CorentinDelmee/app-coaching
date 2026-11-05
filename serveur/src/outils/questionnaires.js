// Outils coach du lot « questionnaires » (voir docs/CONTRAT-OUTILS-COACH.md). Renvoie { nom_outil: def(...) }.
// ctx = { service, backend, biblio, config, now, fetchFn } (voir assembler.js).
// Mêmes données et mêmes validations que l'app : on passe par creerApi (src/data/commun.js), comme le service.
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { creerApi } from '../../../src/data/commun.js'
import { accesSante } from '../../../src/domain/consentement.js'
import { FREQUENCES, TYPES_QUESTION } from '../../../src/domain/modele.js'
import { ErreurService } from '../service.js'
import { slug } from '../util.js'
import { def } from './def.js'
import { creerConfirmations } from './confirmer.js'
import { jour } from './dates.js'

const EMOJIS_DEFAUT = ['😫', '😕', '😐', '🙂', '🤩'] // 5 emojis = les 5 libellés de l'app (Très bas … Au top)
const texte = (max) => z.string().trim().min(1).max(max)
const limite = z.number().int().min(1).max(200).optional().describe('Nombre maximum de résultats (50 par défaut, 200 max)')

const Question = z.object({
  libelle: texte(200).describe('La question posée au client'),
  type: z.enum(TYPES_QUESTION).describe('curseur (note min-max), choixUnique, choixMultiple, emojis (5 visages), nombre (avec unité), texte (réponse libre), photo'),
  cle: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9]{0,39}$/, 'lettres et chiffres seulement, commence par une lettre').optional()
    .describe('Identifiant de la réponse (ex. « poids »). Déduit du libellé si absent. « poids » et les mensurations alimentent le suivi.'),
  choix: z.array(texte(80)).min(2).max(12).optional().describe('Obligatoire pour choixUnique et choixMultiple ; pour emojis : 5 emojis (défaut : 😫😕😐🙂🤩)'),
  min: z.number().optional(), max: z.number().optional(), pas: z.number().positive().optional(),
  defaut: z.number().optional().describe('Valeur de départ (curseur, nombre)'),
  unite: z.string().trim().max(12).optional().describe('Unité affichée (nombre) : kg, cm, L…'),
  etiquettes: z.tuple([texte(40), texte(40)]).optional().describe('Curseur : libellés des deux extrémités, ex. ["Très mal", "Très bien"]'),
  optionnel: z.boolean().optional().describe('Le client peut passer la question')
}).strict()

/** Question prête pour l'app : clé unique, champs utiles au type seulement. */
function normaliserQuestions(questions) {
  const prises = new Set()
  return questions.map((q, i) => {
    const ou = `questions[${i}]`
    const err = (m) => new ErreurService(`${ou} (« ${q.libelle} ») : ${m}`, 'VALIDATION')
    if (['choixUnique', 'choixMultiple'].includes(q.type) && !q.choix) throw err(`« choix » est obligatoire pour ${q.type}`)
    if (q.type === 'emojis' && q.choix && q.choix.length !== 5) throw err('« choix » doit contenir exactement 5 emojis (ou être omis)')
    if (q.type === 'curseur' && (q.min === undefined) !== (q.max === undefined)) throw err('donne « min » et « max » ensemble (défaut 0-10)')
    if (q.min !== undefined && q.max !== undefined && q.min >= q.max) throw err('« min » doit être inférieur à « max »')
    if (q.defaut !== undefined && ((q.min !== undefined && q.defaut < q.min) || (q.max !== undefined && q.defaut > q.max))) throw err('« defaut » est hors de min-max')
    let cle = q.cle || slug(q.libelle).split('-').slice(0, 4).map((m, k) => (k ? m.charAt(0).toUpperCase() + m.slice(1) : m)).join('') || `question${i + 1}`
    if (!/^[a-z]/i.test(cle)) cle = `q${cle}`
    for (let n = 2; prises.has(cle); n++) cle = `${q.cle || cle.replace(/\d+$/, '')}${n}`
    prises.add(cle)
    const sortie = { cle, libelle: q.libelle, type: q.type }
    if (['choixUnique', 'choixMultiple'].includes(q.type)) sortie.choix = q.choix
    if (q.type === 'emojis') sortie.choix = q.choix ?? EMOJIS_DEFAUT
    if (q.type === 'curseur') {
      Object.assign(sortie, { min: q.min ?? 0, max: q.max ?? 10 })
      if (q.etiquettes) sortie.etiquettes = q.etiquettes
      if (q.defaut !== undefined) sortie.defaut = q.defaut
    }
    if (q.type === 'nombre') {
      for (const k of ['unite', 'min', 'max', 'pas', 'defaut']) if (q[k] !== undefined) sortie[k] = q[k]
    }
    if (q.optionnel) sortie.optionnel = true
    return sortie
  })
}

export function outilsQuestionnaires(ctx) {
  const { service, backend, now = () => Date.now() } = ctx
  const api = creerApi(backend, { now })
  const confirmations = creerConfirmations(now)

  const existant = async (id) => {
    const q = await api.questionnaires.lire(id)
    if (!q) throw new ErreurService(`Questionnaire introuvable : « ${id} ». Utilise lister_questionnaires.`, 'QUESTIONNAIRE_INTROUVABLE')
    return q
  }
  const nomClient = async (clientId, cache = new Map()) => {
    if (!clientId) return null
    if (!cache.has(clientId)) cache.set(clientId, (await api.profils.lire(clientId))?.nom ?? null)
    return cache.get(clientId)
  }
  const reponsesDe = async (filtre) => (await api.reponses.lister(filtre, { archives: true }))
  const nouvelId = (nom) => `q-${slug(nom).slice(0, 30)}-${now().toString(36)}${randomBytes(2).toString('hex')}`
  const resume = async (q, cache) => ({
    id: q.id, nom: q.nom, frequence: q.frequence, nbQuestions: q.questions.length,
    pour: q.clientId ? { client: await nomClient(q.clientId, cache), clientId: q.clientId } : 'tous les clients',
    nbReponses: (await reponsesDe({ questionnaireId: q.id })).length
  })

  return {
    lister_questionnaires: def('Liste les questionnaires : ceux proposés à tous les clients et ceux envoyés à un client précis. Avec `client`, ne garde que ceux que ce client voit.',
      z.object({ client: texte(120).optional().describe('Nom, identifiant ou id du client'), limite }).strict(),
      async ({ client, limite: lim = 50 }) => {
        const c = client ? await service.resoudreClient(client) : null
        const tous = (await api.questionnaires.lister()).filter((q) => !c || !q.clientId || q.clientId === c.id)
        const cache = new Map()
        const questionnaires = []
        for (const q of tous.slice(0, lim)) questionnaires.push(await resume(q, cache))
        return { total: tous.length, questionnaires }
      }),

    voir_questionnaire: def('Montre un questionnaire en entier : toutes ses questions (type, choix, bornes) et le nombre de réponses reçues.',
      z.object({ id: texte(120).describe('Id du questionnaire (voir lister_questionnaires)') }).strict(),
      async ({ id }) => {
        const q = await existant(id)
        return { ...q, ...(await resume(q)) }
      }),

    creer_questionnaire: def(`Crée un questionnaire que l'app sait afficher. Obligatoires : nom, frequence (${FREQUENCES.join(', ')}), questions. `
      + 'Types de questions : curseur (min/max, défaut 0-10, etiquettes), choixUnique et choixMultiple (choix obligatoires), emojis (5 visages), nombre (unite, min, max, pas, defaut), texte (réponse libre), photo. '
      + 'Sans `client`, il est proposé à tous les clients ; avec `client`, il n\'est visible que de ce client. Renvoie l\'id. Les clients ayant refusé le partage des données de santé ne peuvent pas le remplir.',
      z.object({
        nom: texte(120), frequence: z.enum(FREQUENCES), questions: z.array(Question).min(1).max(30),
        client: texte(120).optional().describe('Nom, identifiant ou id du client (sinon : tous)')
      }).strict(),
      async ({ nom, frequence, questions, client }) => {
        const c = client ? await service.resoudreClient(client) : null
        const q = await api.questionnaires.creer({ id: nouvelId(nom), nom, frequence, ...(c ? { clientId: c.id } : {}), questions: normaliserQuestions(questions) })
        return { id: q.id, nom: q.nom, nbQuestions: q.questions.length, cles: q.questions.map((x) => x.cle), pour: c ? c.nom : 'tous les clients' }
      }, { mutation: true }),

    modifier_questionnaire: def('Modifie un questionnaire : nom, fréquence et/ou questions. `questions` REMPLACE toute la liste (relis-la avec voir_questionnaire, puis renvoie-la complète) ; garde les mêmes `cle` pour que les anciennes réponses restent lisibles.',
      z.object({ id: texte(120), nom: texte(120).optional(), frequence: z.enum(FREQUENCES).optional(), questions: z.array(Question).min(1).max(30).optional() }).strict()
        .refine((a) => a.nom || a.frequence || a.questions, { message: 'Précise au moins un champ à modifier : nom, frequence ou questions' }),
      async ({ id, nom, frequence, questions }) => {
        await existant(id)
        const patch = { ...(nom ? { nom } : {}), ...(frequence ? { frequence } : {}), ...(questions ? { questions: normaliserQuestions(questions) } : {}) }
        const q = await api.questionnaires.modifier(id, patch)
        return { id: q.id, nom: q.nom, frequence: q.frequence, nbQuestions: q.questions.length }
      }, { mutation: true }),

    supprimer_questionnaire: def('Supprime un questionnaire, EN DEUX TEMPS. 1er appel (sans jeton) : renvoie un résumé et un jeton, ne supprime rien. 2e appel avec le jeton : supprime. Les réponses déjà données par les clients sont conservées. Ne rappelle avec le jeton qu\'après accord explicite du coach.',
      z.object({ id: texte(120), jeton: z.string().regex(/^[0-9a-f]{32}$/).optional() }).strict(),
      async ({ id, jeton }) => {
        const q = await existant(id)
        const cle = `supprimer_questionnaire:${id}`
        if (!jeton) {
          const r = await resume(q)
          return confirmations.demander(cle, `Supprimer le questionnaire « ${q.nom} » (${q.questions.length} questions, ${q.frequence}, pour ${typeof r.pour === 'string' ? r.pour : r.pour.client}). ${r.nbReponses} réponse(s) déjà reçue(s) seront conservées.`)
        }
        if (!confirmations.verifier(cle, jeton)) throw new ErreurService('Jeton invalide ou expiré : rappelle avec exactement les mêmes arguments que le premier appel (avec le jeton), ou demande un nouveau jeton : redemande la suppression sans jeton.', 'JETON_INVALIDE')
        await backend.supprimer('questionnaires', id)
        return { supprimee: true, id, nom: q.nom }
      }, { mutation: true }),

    envoyer_questionnaire: def('Rend un questionnaire accessible à UN client. Un questionnaire général (sans client) est déjà visible de tous les clients : rien n\'est copié (pour un questionnaire destiné à un seul client, passe `client` à creer_questionnaire). Un questionnaire réservé à un autre client est refusé. Autorisé sans consentement santé (le client le donne dans l\'app avant de répondre) ; seule la lecture des réponses exige ce consentement.',
      z.object({ id: texte(120).describe('Id du questionnaire à envoyer'), client: texte(120).describe('Nom, identifiant ou id du client') }).strict(),
      async ({ id, client }) => {
        const q = await existant(id)
        const c = await service.resoudreClient(client)
        if (q.clientId === c.id) return { id: q.id, deja: true, client: c.nom, message: 'Ce questionnaire est déjà réservé à ce client.' }
        if (!q.clientId) return { id: q.id, deja: true, client: c.nom, message: 'Ce questionnaire général est déjà visible de ce client : rien à envoyer. Pour un questionnaire destiné à un seul client, passe `client` à creer_questionnaire.' }
        if (q.clientId) throw new ErreurService(`Ce questionnaire est réservé à un autre client (${await nomClient(q.clientId)}). Envoie plutôt un questionnaire général ou crées-en un.`, 'QUESTIONNAIRE_AUTRE_CLIENT')
        return { id: q.id, deja: true, client: c.nom, message: 'Ce questionnaire est déjà accessible à ce client.' }
      }, { mutation: true }),

    lire_reponses: def('Lit les réponses à des questionnaires, de la plus récente à la plus ancienne, avec le libellé de chaque question. Donne `client` ou `questionnaire` (ou les deux), et éventuellement une période. '
      + 'Les réponses sont des données de santé : celles d\'un client qui a refusé le partage ne sont jamais renvoyées.',
      z.object({ client: texte(120).optional(), questionnaire: texte(120).optional().describe('Id du questionnaire'), du: jour.optional(), au: jour.optional(), limite }).strict()
        .refine((a) => a.client || a.questionnaire, { message: 'Précise `client` et/ou `questionnaire`' }),
      async ({ client, questionnaire, du, au, limite: lim = 50 }) => {
        const c = client ? await service.resoudreClient(client) : null
        if (c && !accesSante(c)) throw new ErreurService(`${c.nom} n'a pas accepté le partage des données de santé : ses réponses ne sont pas lisibles.`, 'CONSENTEMENT_SANTE')
        const q = questionnaire ? await existant(questionnaire) : null
        let lignes = await reponsesDe({ ...(c ? { clientId: c.id } : {}), ...(q ? { questionnaireId: q.id } : {}) })
        const profils = new Map((await api.profils.lister({}, { archives: true })).map((p) => [p.id, p]))
        const lisibles = lignes.filter((r) => accesSante(profils.get(r.clientId)))
        const masquees = lignes.length - lisibles.length
        lignes = lisibles.filter((r) => (!du || r.date >= du) && (!au || r.date <= au))
        lignes.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        const modeles = new Map()
        const reponses = []
        for (const r of lignes.slice(0, lim)) {
          if (!modeles.has(r.questionnaireId)) modeles.set(r.questionnaireId, await api.questionnaires.lire(r.questionnaireId))
          const m = modeles.get(r.questionnaireId)
          reponses.push({
            id: r.id, date: r.date, client: profils.get(r.clientId)?.nom ?? r.clientId, clientId: r.clientId,
            questionnaire: m?.nom ?? '(questionnaire supprimé)', questionnaireId: r.questionnaireId,
            reponses: Object.entries(r.valeurs ?? {}).map(([cle, valeur]) => ({ question: m?.questions.find((x) => x.cle === cle)?.libelle ?? cle, cle, valeur }))
          })
        }
        return { total: lignes.length, reponses, ...(masquees > 0 ? { masqueesConsentement: masquees } : {}) }
      })
  }
}
