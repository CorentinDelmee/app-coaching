// Outils coach du lot « clients » (voir docs/CONTRAT-OUTILS-COACH.md). Renvoie { nom_outil: def(...) }.
// ctx = { service, backend, biblio, config, now, fetchFn } (voir assembler.js).
// Mêmes règles que l'app : profil + compte de connexion (scrypt « sel:hash »), consentement santé lu dans le profil.
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { def } from './def.js'
import { creerConfirmations } from './confirmer.js'
import { ErreurService } from '../service.js'
import { hacherCode } from '../app-http.js'
import { norm } from '../util.js'
import { ENTITES } from '../../../src/data/entites.js'
import { ajouterJours, jourLocal, lundiDe } from '../../../src/domain/dates.js'
import { etatSemaine, numeroSemaine } from '../../../src/domain/programme.js'
import { alertesClient } from '../../../src/domain/alertes.js'
import { identifiantUnique, genererCode } from '../../../src/domain/identifiants.js'
import { VERSION_CONSENTEMENT } from '../../../src/domain/consentement.js'

const ref = z.string().trim().min(1).max(120).describe('Nom, identifiant ou id du client (voir chercher_client)')
const lieu = z.enum(['domicile', 'salle'])
const modulesPartiels = z.object({
  habitudes: z.boolean().optional(), photosRepas: z.boolean().optional(), calories: z.boolean().optional()
}).strict().describe('Modules activés pour ce client (habitudes, photosRepas, calories) ; ceux non cités restent inchangés')
const jeton = z.string().regex(/^[0-9a-f]{32}$/).optional()

export function outilsClients(ctx) {
  const { service, backend } = ctx
  const now = ctx.now ?? (() => Date.now())
  const confirmations = creerConfirmations(now)
  const api = service?.api
  const db = () => {
    if (!backend?.db) throw new ErreurService('La gestion des comptes clients demande la base SQLite du serveur (DB_FILE).', 'NON_DISPONIBLE')
    return backend.db
  }

  const clientsDe = async (archive) => (await backend.tout('profils')).filter((p) => p.role === 'client' && !!p.archive === archive)

  /** Résout nom / identifiant / id. mode : 'actif', 'archive' ou 'tous' (actifs d'abord, sinon archivés). */
  async function resoudre(q, mode = 'tous') {
    const n = norm(q)
    const mots = n.split(' ').filter(Boolean)
    const chercher = (liste) => {
      const exacts = liste.filter((c) => norm(c.nom) === n || c.id === q || c.identifiant === q.toLowerCase())
      return exacts.length ? exacts : liste.filter((c) => mots.length && mots.every((m) => norm(`${c.nom} ${c.identifiant}`).includes(m)))
    }
    let trouves = []
    if (mode !== 'archive') trouves = chercher(await clientsDe(false))
    if (!trouves.length && mode !== 'actif') trouves = chercher(await clientsDe(true))
    if (!trouves.length) {
      const dit = mode === 'archive' ? 'Aucun client archivé' : mode === 'actif' ? 'Aucun client actif' : 'Client introuvable'
      throw new ErreurService(`${dit} ne correspond à « ${q} ». Utilise lister_clients.`, 'CLIENT_INTROUVABLE')
    }
    if (trouves.length > 1) {
      throw new ErreurService(`Plusieurs clients correspondent à « ${q} » : ${trouves.map((c) => `${c.nom} (${c.id})`).join(', ')}. Précise avec l'id.`, 'AMBIGU')
    }
    return trouves[0]
  }

  const consentement = (p) => ({
    repondu: !!p.consentementLe && p.preferences?.consentement?.version === VERSION_CONSENTEMENT,
    sante: p.preferences?.consentement?.sante === true
  })
  const vue = (p) => ({ id: p.id, nom: p.nom, identifiant: p.identifiant, tarif: p.tarif, lieuDefaut: p.lieuDefaut, modules: p.modules, archive: !!p.archive })

  /** Écrit le profil après la validation de l'app (mêmes règles que /api/app/profils). */
  async function ecrireProfil(p) {
    const v = ENTITES.profils.valider(p)
    if (!v.ok) throw new ErreurService(`Profil invalide : ${v.erreurs.join(' ; ')}`, 'VALIDATION')
    await backend.ecrire('profils', p)
    return p
  }

  /** Nouveau code : haché, sessions révoquées (sv + 1). Le code en clair n'est jamais conservé. */
  async function poserCode(identifiant, code) {
    db().prepare('UPDATE comptes SET hash = ?, sv = sv + 1 WHERE identifiant = ?').run(await hacherCode(code), identifiant)
  }

  return {
    creer_client: def('Crée un client : profil + compte de connexion. Obligatoire : nom (prénom puis nom, ex. « Élodie Martin »). L\'identifiant (prenom.nom, suffixe -2 si déjà pris) et un code d\'accès initial aléatoire de 8 caractères sont générés. Le code n\'est renvoyé qu\'UNE fois, en clair : à transmettre au client, il ne pourra plus être relu (sinon nouveau_code_client). Le client acceptera lui-même le consentement santé à sa première connexion.',
      z.object({ nom: z.string().trim().min(2).max(120), tarif: z.number().min(0).max(1000).optional().describe('Tarif d\'une séance en euros (35 par défaut)'), lieuDefaut: lieu.optional().describe('domicile (défaut) ou salle'), modules: modulesPartiels.optional() }).strict(),
      async ({ nom, tarif = 35, lieuDefaut = 'domicile', modules = {} }) => {
        const base = db()
        const identifiant = identifiantUnique(nom, (await backend.tout('profils')).map((p) => p.identifiant).concat(base.prepare('SELECT identifiant FROM comptes').all().map((c) => c.identifiant)))
        if (!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(identifiant)) throw new ErreurService('Impossible de fabriquer un identifiant à partir de ce nom : écris prénom puis nom avec des lettres.', 'VALIDATION')
        const profil = {
          id: randomUUID(), role: 'client', identifiant, nom, tarif, lieuDefaut,
          modules: { habitudes: false, photosRepas: false, calories: false, ...modules },
          preferences: { son: true, vibration: true, unite: 'kg' }, consentementLe: null, archive: false, creeLe: now()
        }
        const v = ENTITES.profils.valider(profil)
        if (!v.ok) throw new ErreurService(`Profil invalide : ${v.erreurs.join(' ; ')}`, 'VALIDATION')
        const code = genererCode()
        const hash = await hacherCode(code)
        base.exec('BEGIN')
        try {
          await backend.ecrire('profils', profil)
          base.prepare("INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, 'client', ?)").run(identifiant, hash, profil.id)
          base.exec('COMMIT')
        } catch (e) { base.exec('ROLLBACK'); throw new ErreurService('Création impossible (identifiant déjà pris ?). Réessaie.', 'EXISTE_DEJA') }
        return { id: profil.id, nom, identifiant, code, message: `Client créé. Transmets-lui son identifiant (${identifiant}) et son code ${code} : ce code ne sera plus affiché.` }
      }, { mutation: true }),

    modifier_client: def('Modifie un client : nom, tarif, lieu par défaut, modules (habitudes, photosRepas, calories). L\'identifiant et le rôle ne changent pas ; archive/réactivation : archiver_client / reactiver_client. Ne touche ni au consentement santé ni au code.',
      z.object({ client: ref, nom: z.string().trim().min(2).max(120).optional(), tarif: z.number().min(0).max(1000).optional(), lieuDefaut: lieu.optional(), modules: modulesPartiels.optional() }).strict()
        .refine((a) => ['nom', 'tarif', 'lieuDefaut', 'modules'].some((k) => a[k] !== undefined), { message: 'Précise au moins un champ à modifier (nom, tarif, lieuDefaut, modules)' }),
      async ({ client, nom, tarif, lieuDefaut, modules }) => {
        const p = await resoudre(client)
        const maj = { ...p, ...(nom !== undefined ? { nom } : {}), ...(tarif !== undefined ? { tarif } : {}), ...(lieuDefaut ? { lieuDefaut } : {}), ...(modules ? { modules: { ...p.modules, ...modules } } : {}) }
        await ecrireProfil(maj)
        return { id: maj.id, client: vue(maj) }
      }, { mutation: true }),

    fiche_client: def('Fiche complète d\'un client : profil, consentement santé, programme actif, prochaines séances (14 jours), dernières mesures, alertes. Sans consentement santé du client, mesures, douleurs et check-ins ne sont pas lus.',
      z.object({ client: ref }).strict(),
      async ({ client }) => {
        const p = await resoudre(client)
        const c = consentement(p)
        const auj = jourLocal(now())
        const fin = ajouterJours(auj, 13)
        const realisations = await api.realisations.lister({ clientId: p.id })
        const workouts = new Map((await api.workouts.lister({ clientId: p.id })).map((w) => [w.id, w]))
        const programmes = await api.programmes.lister({ clientId: p.id })
        const prochaines = []
        for (const prog of programmes) {
          for (let lundi = lundiDe(auj); lundi <= fin; lundi = ajouterJours(lundi, 7)) {
            for (const x of etatSemaine(prog, realisations, lundi, auj).workouts) {
              if (x.jourPlace && x.jourPlace >= auj && x.jourPlace <= fin) prochaines.push({ date: x.jourPlace, seanceId: x.workoutId, nom: workouts.get(x.workoutId)?.nom ?? x.workoutId, fait: x.fait })
            }
          }
        }
        const coaching = (await api.seancesCoaching.lister({ clientId: p.id })).filter((s) => s.date >= auj && s.date <= fin && s.statut !== 'annulee')
        const prog = programmes[0]
        // Données de santé : seulement si le client a accepté (comme accesSante() dans l'app).
        const reponses = c.sante ? await api.reponses.lister({ clientId: p.id }) : []
        const douleurs = c.sante ? await api.douleurs.lister({ clientId: p.id }) : []
        const mesures = c.sante ? (await api.mesures.lister({ clientId: p.id })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : []
        const alertesVues = await api.alertesVues.lister({ clientId: p.id })
        const alertes = alertesClient({ profil: p, reponses, douleurs, realisations, alertesVues }, now())
          .filter((a) => c.sante || a.type === 'commentaire').map(({ id, type, message, date }) => ({ id, type, message, date }))
        return {
          id: p.id, profil: { ...vue(p), creeLe: p.creeLe }, consentement: c,
          programmeActif: prog ? { id: prog.id, nom: prog.nom, mode: prog.mode, debut: prog.debut, semaineCourante: numeroSemaine(prog, auj) } : null,
          prochainesSeances: {
            programmees: prochaines.sort((a, b) => a.date.localeCompare(b.date)),
            coaching: coaching.sort((a, b) => a.date.localeCompare(b.date)).map(({ id, date, heure, lieu: l, statut }) => ({ id, date, heure, lieu: l, statut }))
          },
          dernieresMesures: c.sante ? mesures.map(({ date, poids, mensurations }) => ({ date, poids, mensurations })) : 'non consenti : le client n\'a pas accepté le partage de ses données de santé',
          alertes
        }
      }),

    archiver_client: def('Archive un client, EN DEUX TEMPS. 1er appel (sans jeton) : renvoie un résumé et un jeton, ne change rien. 2e appel avec le jeton : le client ne peut plus se connecter (sessions coupées), ses données sont gardées et il disparaît des listes ; reactiver_client le remet en service. Ne confirme qu\'après accord explicite du coach.',
      z.object({ client: ref, jeton }).strict(),
      async ({ client, jeton: j }) => {
        const p = await resoudre(client, 'actif')
        const cle = `archiver_client:${p.id}`
        if (!j) return confirmations.demander(cle, `Archiver ${p.nom} (${p.identifiant}) : connexion impossible, données conservées, réactivable.`)
        if (!confirmations.verifier(cle, j)) throw new ErreurService('Jeton de confirmation invalide ou expiré : redemande l\'archivage sans jeton.', 'JETON_INVALIDE')
        await ecrireProfil({ ...p, archive: true })
        db().prepare('UPDATE comptes SET archive = 1, sv = sv + 1 WHERE profil_id = ?').run(p.id)
        return { id: p.id, archive: true, message: `${p.nom} est archivé : il ne peut plus se connecter. Ses données sont conservées.` }
      }, { mutation: true }),

    reactiver_client: def('Réactive un client archivé : il peut de nouveau se connecter avec son code actuel (nouveau_code_client si perdu).',
      z.object({ client: ref }).strict(),
      async ({ client }) => {
        const p = await resoudre(client, 'archive')
        await ecrireProfil({ ...p, archive: false })
        db().prepare('UPDATE comptes SET archive = 0 WHERE profil_id = ?').run(p.id)
        return { id: p.id, archive: false, message: `${p.nom} est réactivé.` }
      }, { mutation: true }),

    nouveau_code_client: def('Donne un nouveau code d\'accès à un client (code perdu) : l\'ancien code et les sessions ouvertes sont révoqués. Le nouveau code (8 caractères) n\'est renvoyé qu\'UNE fois, en clair.',
      z.object({ client: ref }).strict(),
      async ({ client }) => {
        const p = await resoudre(client, 'actif')
        const code = genererCode()
        await poserCode(p.identifiant, code)
        return { id: p.id, identifiant: p.identifiant, code, message: `Nouveau code pour ${p.nom} : ${code} (ne sera plus affiché). L'ancien ne fonctionne plus.` }
      }, { mutation: true })
  }
}
