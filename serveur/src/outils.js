// Registre des outils : UNE définition (nom, description, schéma zod strict, exécution) utilisée par l'API REST ET par le serveur MCP.
import { z } from 'zod'
import { ErreurService } from './service.js'
import { outilsClients } from './outils/clients.js'
import { outilsProgrammes } from './outils/programmes.js'
import { outilsBibliotheque } from './outils/bibliotheque.js'
import { outilsQuestionnaires } from './outils/questionnaires.js'
import { outilsReservations } from './outils/reservations.js'
import { outilsSuivi } from './outils/suivi.js'
import { jour } from './outils/dates.js'

const nomCourt = z.string().trim().min(1).max(120)
const secs = z.number().int().min(0).max(7200)

// Un exercice : séries, répétitions (nombre ou fourchette « 8-10 »), charge en kg, repos en secondes, tempo « 3-1-1 ».
const Exercice = z.object({
  nom: nomCourt.describe('Nom de l\'exercice (ex. « Squat »)'),
  series: z.union([z.number().int().min(1).max(20), z.array(z.object({ reps: z.number().int().min(0).max(500).optional(), charge: z.number().min(0).max(1000).optional(), tempsTravail: secs.optional() }).strict()).min(1).max(20)]).optional().describe('Nombre de séries (3 par défaut) ou liste détaillée série par série'),
  reps: z.union([z.number().int().min(0).max(500), z.string().regex(/^\d{1,3}\s*[-–]\s*\d{1,3}$/, 'fourchette attendue, ex. « 8-10 »')]).optional(),
  charge: z.number().min(0).max(1000).optional().describe('Charge en kg'),
  repos: secs.optional().describe('Repos entre séries, en secondes'),
  tempo: z.string().regex(/^[\dXx]-[\dXx]-[\dXx](-[\dXx])?$/, 'tempo attendu, ex. « 3-1-1 »').optional(),
  tempsTravail: secs.optional().describe('Durée de l\'effort en secondes. Gainage ou exercice tenu : reps: 0 + tempsTravail (ex. 45)'),
  rpe: z.number().min(1).max(10).optional(),
  consignes: z.string().max(500).optional()
}).strict().refine((e) => Array.isArray(e.series) || e.reps !== undefined || e.tempsTravail !== undefined, { message: 'Précise « reps » (ou « tempsTravail », ou des séries détaillées)' })

const FORMATS = ['amrap', 'emom', 'fortime', 'timecap', 'deathby', 'tabata', 'intervalles', 'superset']
const Circuit = z.object({
  format: z.enum(FORMATS),
  nom: nomCourt.optional(),
  minutes: z.number().int().min(1).max(120).optional().describe('AMRAP / EMOM : durée en minutes'),
  capMinutes: z.number().int().min(1).max(120).optional().describe('For time / time cap : limite en minutes'),
  tours: z.number().int().min(1).max(50).optional(), travail: secs.optional(), repos: secs.optional(),
  facultatif: z.boolean().optional().describe('Option de fin de séance'),
  exercices: z.array(z.object({ nom: nomCourt, reps: z.number().int().min(1).max(500).optional(), consignes: z.string().max(300).optional() }).strict()).min(1).max(12)
}).strict().superRefine((c, ctx) => {
  const exige = (cond, msg) => { if (!cond) ctx.addIssue({ code: 'custom', message: msg }) }
  if (c.format === 'amrap' || c.format === 'emom') exige(c.minutes, `${c.format} : « minutes » est obligatoire`)
  if (c.format === 'timecap') exige(c.capMinutes, 'timecap : « capMinutes » est obligatoire')
  if (c.format === 'intervalles') exige(c.tours && c.travail !== undefined && c.repos !== undefined, 'intervalles : « tours », « travail » et « repos » sont obligatoires')
})
const Superset = z.object({ repos: secs.optional(), exercices: z.array(Exercice).min(2).max(4) }).strict()

/** Un bloc de séance : exactement l'une des 3 clés. */
export const Bloc = z.union([
  z.object({ exercice: Exercice }).strict(),
  z.object({ circuit: Circuit }).strict(),
  z.object({ superset: Superset }).strict()
])

const ref = (d) => z.string().trim().min(1).max(120).describe(d)

export function creerOutils(service, ctx = { service }) {
  const def = (description, schema, run, { mutation = false } = {}) => ({ description, schema, run, mutation })
  return {
    lister_clients: def('Liste les clients du coach (id, nom, identifiant).', z.object({}).strict(), () => service.listerClients()),
    chercher_client: def('Cherche un client par nom (tolérant à la casse et aux accents). Signale les homonymes : si « ambigu » est vrai, demande lequel avant de continuer.',
      z.object({ nom: ref('Nom ou partie du nom, ex. « fabien vincent »') }).strict(), ({ nom }) => service.chercherClient(nom)),
    creer_seance: def('Crée une séance pour un client, avec ses exercices, et rattache une vidéo à chaque exercice quand c\'en trouve une. `date` (AAAA-MM-JJ) place la séance ce jour-là dans le programme du client. Renvoie la séance créée et la liste des exercices restés sans vidéo.',
      z.object({ client: ref('Nom, identifiant ou id du client (voir chercher_client)'), nom: nomCourt.describe('Titre de la séance'), date: jour.optional(), consignes: z.string().max(1000).optional(), blocs: z.array(Bloc).max(40).optional().describe('Liste de blocs : { exercice }, { circuit } ou { superset }') }).strict(),
      (a) => service.creerSeance(a), { mutation: true }),
    ajouter_exercice: def('Ajoute à une séance existante un exercice, un circuit (AMRAP, EMOM, For time…) ou un superset. Fournir exactement une des clés : exercice, circuit, superset.',
      z.object({ seanceId: ref('Id de la séance'), exercice: Exercice.optional(), circuit: Circuit.optional(), superset: Superset.optional() }).strict()
        .refine((a) => [a.exercice, a.circuit, a.superset].filter(Boolean).length === 1, { message: 'Fournir exactement une des clés : exercice, circuit, superset' }),
      (a) => service.ajouterExercice(a), { mutation: true }),
    modifier_seance: def('Modifie le titre, les consignes, la date d\'une séance ou retire un bloc (retirerBlocId).',
      z.object({ seanceId: ref('Id de la séance'), nom: nomCourt.optional(), consignes: z.string().max(1000).optional(), date: jour.optional(), retirerBlocId: z.string().max(80).optional() }).strict(),
      (a) => service.modifierSeance(a), { mutation: true }),
    supprimer_seance: def('Supprime une séance, EN DEUX TEMPS. 1er appel (sans jeton) : renvoie un résumé et un jeton de confirmation, ne supprime rien. 2e appel avec le jeton : supprime. Ne rappelle avec le jeton qu\'après accord explicite du coach.',
      z.object({ seanceId: ref('Id de la séance'), jeton: z.string().regex(/^[0-9a-f]{32}$/).optional() }).strict(),
      (a) => service.supprimerSeance(a), { mutation: true }),
    rattacher_video: def('Rattache une vidéo YouTube de démonstration à un exercice (statut « proposé » : le coach la valide ensuite). Refuse de remplacer une vidéo déjà validée par le coach.',
      z.object({ exercice: ref('Nom de l\'exercice'), url: z.string().url().max(300), titre: z.string().max(200).optional(), chaine: z.string().max(120).optional(), duree: z.number().int().min(1).max(7200).optional().describe('Durée en secondes'), justification: z.string().max(400).optional() }).strict(),
      (a) => service.rattacherVideo(a), { mutation: true }),
    chercher_video_exercice: def('Cherche des vidéos de démonstration pour un exercice : bibliothèque du coach, puis YouTube (durée courte, chaîne reconnue, vues, titre pertinent ; score justifié) si une clé est configurée.',
      z.object({ nom: ref('Nom de l\'exercice'), limite: z.number().int().min(1).max(10).optional() }).strict(), (a) => service.chercherVideoExercice(a)),
    consulter_agenda: def('Agenda d\'un client entre deux dates (défaut : 15 jours) : séances de coaching (y compris les « Coaching … » de Google Agenda, source google) et séances programmées.',
      z.object({ client: ref('Nom, identifiant ou id du client'), du: jour.optional(), au: jour.optional() }).strict(), (a) => service.consulterAgenda(a)),
    lister_seances: def('Liste les séances (toutes, ou d\'un client).', z.object({ client: ref('Nom, identifiant ou id du client').optional() }).strict(), (a) => service.listerSeances(a)),
    // Automatisation coach (2026-11-05, docs/CONTRAT-OUTILS-COACH.md) : un module par lot ; un nom d'outil n'existe qu'une fois.
    ...outilsClients(ctx),
    ...outilsProgrammes(ctx),
    ...outilsBibliotheque(ctx),
    ...outilsQuestionnaires(ctx),
    ...outilsReservations(ctx),
    ...outilsSuivi(ctx)
  }
}

/** Messages zod en français (le défaut est en anglais) ; undefined = message par défaut de zod. */
export function erreurZodFr(iss) {
  if (iss.code === 'invalid_type') return iss.input === undefined ? 'champ obligatoire manquant' : `type incorrect (attendu : ${{ string: 'texte', number: 'nombre', boolean: 'vrai/faux', array: 'liste', object: 'objet' }[iss.expected] ?? iss.expected})`
  if (iss.code === 'unrecognized_keys') return `champ(s) inconnu(s) : ${iss.keys.join(', ')}`
  if (iss.code === 'invalid_value') return `valeur non autorisée (valeurs possibles : ${iss.values.join(', ')})`
  if (iss.code === 'too_small') return iss.origin === 'string' ? `texte trop court (minimum ${iss.minimum} caractères)` : iss.origin === 'array' ? `liste trop courte (minimum ${iss.minimum})` : `valeur trop petite (minimum ${iss.minimum})`
  if (iss.code === 'too_big') return iss.origin === 'string' ? `texte trop long (maximum ${iss.maximum} caractères)` : iss.origin === 'array' ? `liste trop longue (maximum ${iss.maximum})` : `valeur trop grande (maximum ${iss.maximum})`
  if (iss.code === 'invalid_format') return 'format incorrect'
  if (iss.code === 'invalid_union') return 'aucune des formes acceptées ne correspond'
  return undefined
}

/** Exécute un outil : validation stricte, journal (qui, quand, outil, client, résultat), erreurs claires. Ne lève jamais. */
export async function appeler({ outils, journal }, nom, args, acteur) {
  const outil = Object.hasOwn(outils, nom) ? outils[nom] : null
  const client = typeof args?.client === 'string' ? args.client : typeof args?.nom === 'string' && nom === 'chercher_client' ? args.nom : null
  const consigner = (ok, resultat, erreur) => journal.ecrire({ acteur, outil: nom, client, ok, resultat, erreur })
  if (!outil) { consigner(false, null, 'outil inconnu'); return { ok: false, code: 'OUTIL_INCONNU', erreur: `Outil inconnu : « ${String(nom).slice(0, 60)} »` } }
  const v = outil.schema.safeParse(args ?? {}, { error: erreurZodFr })
  if (!v.success) {
    const erreur = v.error.issues.map((i) => `${i.path.join('.') || 'arguments'} : ${i.message}`).join(' ; ')
    consigner(false, null, `validation : ${erreur}`.slice(0, 300))
    return { ok: false, code: 'VALIDATION', erreur }
  }
  try {
    const donnees = await outil.run(v.data)
    const id = donnees?.seance?.id ?? donnees?.id ?? null
    consigner(true, { ...(id ? { seanceId: id } : {}), ...(donnees?.confirmationRequise ? { confirmationRequise: true } : {}), ...(donnees?.supprimee ? { supprimee: true } : {}) })
    return { ok: true, donnees }
  } catch (e) {
    if (e instanceof ErreurService || e?.name === 'ErreurData') {
      consigner(false, null, e.message.slice(0, 300))
      return { ok: false, code: e.code || 'ERREUR', erreur: e.message }
    }
    consigner(false, null, `interne : ${e?.message}`.slice(0, 300))
    return { ok: false, code: 'INTERNE', erreur: 'Erreur interne du serveur (voir le journal).' }
  }
}
