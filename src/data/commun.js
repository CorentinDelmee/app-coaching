// Construit l'interface de données (identique pour tous les adaptateurs) à partir de primitives de stockage.
//
// Un « backend » fournit :
//   mode, tout(entite), un(entite, id), ecrire(entite, obj)            -> lecture / écriture brutes (async)
//   connecter, deconnecter, utilisateurCourant, changerCode, creerCompte -> session
//   reinitialiserDemo(), file { lire(), ecrire(liste) }                  -> démo et file d'attente hors connexion
// Tout le reste (validation, archivage, import/export, enregistrement de séance…) est ici, donc testé une seule fois.
import { ENTITES, NOMS_ENTITES, clientDe } from './entites.js'
import { ErreurData } from './erreurs.js'
import { identifiantUnique, genererCode } from '../domain/identifiants.js'
import { appliquerRealisation } from '../domain/realisations.js'
import { validerRealisation } from '../domain/modele.js'
import { exporter, exporterMesDonnees, preparerImport } from '../domain/echange.js'

const uuidParDefaut = () => globalThis.crypto.randomUUID()

export function creerApi(backend, { now = () => Date.now(), uuid = uuidParDefaut } = {}) {
  const api = { mode: backend.mode }

  function verifier(entite, obj) {
    const v = ENTITES[entite].valider(obj)
    if (!v.ok) throw new ErreurData('VALIDATION', v.erreurs.join(' ; '))
  }

  // lister / lire / creer / modifier / archiver pour chaque entité
  for (const entite of NOMS_ENTITES) {
    api[entite] = {
      /** lister({ clientId: 'x' }, { archives: true }) — les éléments archivés sont masqués par défaut. */
      async lister(filtre = {}, { archives = false } = {}) {
        const toutes = await backend.tout(entite)
        return toutes.filter((o) => (archives || !o.archive) && Object.entries(filtre).every(([k, v]) => o[k] === v))
      },
      async lire(id) {
        return (await backend.un(entite, id)) || null
      },
      async creer(obj) {
        const id = obj.id ?? uuid()
        const complet = { ...obj, id }
        if (entite === 'profils') {
          complet.archive ??= false
          complet.creeLe ??= now()
        }
        verifier(entite, complet)
        if (await backend.un(entite, id)) throw new ErreurData('EXISTE', `${entite} : l'identifiant « ${id} » existe déjà`)
        await backend.ecrire(entite, complet)
        return complet
      },
      async modifier(id, patch) {
        const actuel = await backend.un(entite, id)
        if (!actuel) throw new ErreurData('INTROUVABLE', `${entite} : « ${id} » est introuvable`)
        const fusion = { ...actuel, ...patch, id }
        verifier(entite, fusion)
        await backend.ecrire(entite, fusion)
        return fusion
      },
      /** Archivage doux : rien n'est supprimé. */
      async archiver(id) {
        return api[entite].modifier(id, { archive: true })
      }
    }
  }

  // --- Session ---------------------------------------------------------------------------------
  api.connecter = (identifiant, code) => backend.connecter(identifiant.trim().toLowerCase(), code)
  api.deconnecter = () => backend.deconnecter()
  api.utilisateurCourant = () => backend.utilisateurCourant()
  api.changerCode = async (ancienCode, nouveauCode) => {
    if (typeof nouveauCode !== 'string' || nouveauCode.length < 6) throw new ErreurData('CODE_TROP_COURT', 'Le code doit faire 6 caractères au minimum')
    return backend.changerCode(ancienCode, nouveauCode)
  }

  /** Le coach crée un client : identifiant + code générés. Renvoie { profil, identifiant, code } à transmettre. */
  api.creerClient = async ({ nom, tarif = 35, lieuDefaut = 'domicile', modules = { habitudes: false, photosRepas: false, calories: false } }) => {
    const existants = (await backend.tout('profils')).map((p) => p.identifiant)
    const identifiant = identifiantUnique(nom, existants)
    const code = genererCode()
    const id = await backend.creerCompte(identifiant, code)
    const profil = await api.profils.creer({
      id, role: 'client', identifiant, nom, tarif, lieuDefaut, modules,
      preferences: { son: true, vibration: true, unite: 'kg' }, consentementLe: null
    })
    return { profil, identifiant, code }
  }

  /** Le coach donne un nouveau code à un client (ancien code perdu). Renvoie { identifiant, code } à transmettre. */
  api.reinitialiserCode = async (clientId) => {
    const user = await backend.utilisateurCourant()
    if (user?.role !== 'coach') throw new ErreurData('NON_AUTORISE', 'Réservé au coach')
    const profil = await backend.un('profils', clientId)
    if (!profil || profil.role !== 'client') throw new ErreurData('INTROUVABLE', 'Client introuvable')
    const code = genererCode()
    await backend.reinitialiserCode(profil.identifiant, code)
    return { identifiant: profil.identifiant, code }
  }

  // --- Séances faites ----------------------------------------------------------------------------
  /** Enregistre une réalisation + met à jour le template. Idempotent (même id = une seule réalisation). */
  api.enregistrerSeance = async (realisation) => {
    const v = validerRealisation(realisation)
    if (!v.ok) throw new ErreurData('VALIDATION', v.erreurs.join(' ; '))
    if (await backend.un('realisations', realisation.id)) return { ajoutee: false }
    const template = await backend.un('templates', realisation.clientId)
    const { template: nouveau } = appliquerRealisation({ realisations: [], template }, realisation)
    await backend.ecrire('realisations', realisation)
    await backend.ecrire('templates', nouveau)
    return { ajoutee: true }
  }

  /** Comme enregistrerSeance, mais sans réseau la séance part dans la file locale (rejouée par synchroniserFile). */
  api.enregistrerSeanceOuFile = async (realisation) => {
    try {
      return await api.enregistrerSeance(realisation)
    } catch (e) {
      if (!(e instanceof ErreurData) || e.code !== 'RESEAU') throw e
      const file = await backend.file.lire()
      if (!file.some((r) => r.id === realisation.id)) await backend.file.ecrire([...file, realisation])
      return { ajoutee: false, enAttente: true }
    }
  }
  api.tailleFile = async () => (await backend.file.lire()).length
  api.synchroniserFile = async () => {
    const file = await backend.file.lire()
    const restantes = []
    let envoyees = 0
    for (const r of file) {
      try {
        const { ajoutee } = await api.enregistrerSeance(r)
        if (ajoutee) envoyees++
      } catch (e) {
        if (e instanceof ErreurData && e.code === 'RESEAU') restantes.push(r)
        else throw e
      }
    }
    await backend.file.ecrire(restantes)
    return { envoyees, restantes: restantes.length }
  }

  // --- Import / export ---------------------------------------------------------------------------
  const lireBiblio = async () => ({
    exercices: await api.exercices.lister(),
    workouts: await api.workouts.lister(),
    programmes: await api.programmes.lister()
  })

  api.exporterDonnees = async () => exporter(await lireBiblio(), now())

  /** Valide TOUT le document, puis écrit. Renvoie { message, rapport } ; refuse un format inconnu. */
  api.importerDonnees = async (doc) => {
    const prep = preparerImport(doc, await lireBiblio())
    if (!prep.ok) throw new ErreurData('FORMAT', prep.message)
    for (const entite of ['exercices', 'workouts', 'programmes']) {
      for (const obj of prep.aEcrire[entite]) await backend.ecrire(entite, obj)
    }
    return { message: prep.message, rapport: prep.rapport }
  }

  /** Export « mes données » (RGPD) du client connecté (ou du client donné, pour le coach). */
  api.exporterMesDonnees = async (clientId) => {
    const user = clientId ? { id: clientId } : await backend.utilisateurCourant()
    if (!user) throw new ErreurData('NON_CONNECTE', 'Connexion requise')
    const donnees = {}
    for (const entite of NOMS_ENTITES) {
      if (['profils', 'exercices', 'questionnaires', 'templates', 'workouts', 'programmes'].includes(entite)) continue
      donnees[entite] = (await backend.tout(entite)).filter((o) => clientDe(entite, o) === user.id)
    }
    donnees.profil = await backend.un('profils', user.id)
    donnees.template = await backend.un('templates', user.id)
    donnees.programmes = (await backend.tout('programmes')).filter((o) => o.clientId === user.id)
    donnees.workouts = (await backend.tout('workouts')).filter((o) => o.clientId === user.id)
    return exporterMesDonnees(donnees, now())
  }

  api.reinitialiserDemo = () => backend.reinitialiserDemo()
  return api
}
