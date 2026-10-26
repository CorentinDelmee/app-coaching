// Construit l'interface de données (identique pour tous les adaptateurs) à partir de primitives de stockage.
//
// Un « backend » fournit :
//   mode, tout(entite), un(entite, id), ecrire(entite, obj)            -> lecture / écriture brutes (async)
//   connecter, deconnecter, utilisateurCourant, changerCode, creerCompte(identifiant, code, profil) -> session
//   (profilCreeParCompte = true si creerCompte crée aussi la ligne de profil, comme l'Edge Function Supabase)
//   reinitialiserDemo(), file { lire(), ecrire(liste) }                  -> démo et file d'attente hors connexion
// Tout le reste (validation, archivage, import/export, enregistrement de séance…) est ici, donc testé une seule fois.
import { ENTITES, NOMS_ENTITES, clientDe } from './entites.js'
import { ErreurData } from './erreurs.js'
import { identifiantUnique, genererCode, LONGUEUR_CODE_MIN } from '../domain/identifiants.js'
import { appliquerRealisation } from '../domain/realisations.js'
import { validerRealisation } from '../domain/modele.js'
import { alertesAgenda, seancesPourClient } from '../domain/agendaGoogle.js'
import { fusionnerSeances } from '../domain/fusionSeances.js'
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

  // --- Google Agenda -> séances de coaching ---------------------------------------------------------------
  // Le client voit ses séances « Coaching <son nom> » créées dans l'agenda du coach, mêlées à ses séances habituelles
  // (futures et prévues, marquées source:'google'). Si l'agenda est injoignable, l'accueil ne casse pas : on n'ajoute rien.
  if (backend.agenda) {
    const listerBase = api.seancesCoaching.lister
    api.seancesCoaching.lister = async (filtre = {}, options) => {
      const base = await listerBase(filtre, options)
      const user = await backend.utilisateurCourant()
      if (user?.role !== 'client' || (filtre.clientId && filtre.clientId !== user.id) || options?.archives) return base
      if (filtre.statut && filtre.statut !== 'prevue') return base
      try {
        return fusionnerSeances(base, seancesPourClient(await backend.agenda.evenements(), user.id, user.tarif, now()))
      } catch {
        return base
      }
    }
  }
  /** Réservé au coach : panneau « Agenda Google » (dernière synchro, séances, alertes) et synchronisation immédiate. */
  api.agenda = {
    disponible: !!backend.agenda,
    async etat() {
      if (!backend.agenda) return { derniereSynchro: null, evenements: [], alertes: [] }
      const evenements = await backend.agenda.evenements()
      return { derniereSynchro: await backend.agenda.derniereSynchro(), evenements, alertes: alertesAgenda(evenements, now()) }
    },
    async synchroniser() {
      const user = await backend.utilisateurCourant()
      if (user?.role !== 'coach') throw new ErreurData('NON_AUTORISE', 'Réservé au coach')
      if (!backend.agenda) throw new ErreurData('ECHEC', "La synchronisation Google Agenda n'est pas disponible")
      return backend.agenda.synchroniser()
    }
  }

  // --- Session ---------------------------------------------------------------------------------
  api.connecter = (identifiant, code) => backend.connecter(identifiant.trim().toLowerCase(), code)
  // À la déconnexion, la file hors connexion (séances non envoyées) est vidée : pas de données de santé qui restent sur un appareil partagé (audit M6).
  // L'interface prévient avant, tant que tailleFile() > 0.
  api.deconnecter = async () => {
    try { await backend.deconnecter() } finally { await backend.file.ecrire([]) }
  }
  api.utilisateurCourant = () => backend.utilisateurCourant()
  api.changerCode = async (ancienCode, nouveauCode) => {
    if (typeof nouveauCode !== 'string' || nouveauCode.length < LONGUEUR_CODE_MIN) throw new ErreurData('CODE_TROP_COURT', `Le code doit faire ${LONGUEUR_CODE_MIN} caractères au minimum`)
    return backend.changerCode(ancienCode, nouveauCode)
  }

  /** Le coach crée un client : identifiant + code générés. Renvoie { profil, identifiant, code } à transmettre. */
  api.creerClient = async ({ nom, tarif = 35, lieuDefaut = 'domicile', modules = { habitudes: false, photosRepas: false, calories: false } }) => {
    const existants = (await backend.tout('profils')).map((p) => p.identifiant)
    const identifiant = identifiantUnique(nom, existants)
    const code = genererCode()
    const donnees = { role: 'client', identifiant, nom, tarif, lieuDefaut, modules, preferences: { son: true, vibration: true, unite: 'kg' }, consentementLe: null }
    verifier('profils', { ...donnees, id: 'a-creer', archive: false, creeLe: now() }) // refuse un nom/tarif invalide avant de créer un compte
    const id = await backend.creerCompte(identifiant, code, { ...donnees, creeLe: now() })
    // Supabase : l'Edge Function a déjà créé le profil avec le compte ; sinon (local) on l'écrit ici.
    const profil = backend.profilCreeParCompte ? await backend.un('profils', id) : await api.profils.creer({ ...donnees, id })
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

  // --- Photos (questionnaires, repas) ------------------------------------------------------------------------------
  // Mode démo (backend sans `photos`) : la photo reste en data URL dans la ligne. Supabase : envoi dans le bucket privé `photos`
  // au chemin `<client_id>/<uuid>.jpg`, la ligne ne garde que la référence « photo:<chemin> » ; affichage par URL signée courte.
  const REF_PHOTO = 'photo:'
  const cheminDe = (ref) => (typeof ref === 'string' && ref.startsWith(REF_PHOTO) ? ref.slice(REF_PHOTO.length) : null)
  api.photos = {
    /** data URL (image déjà réduite côté client) -> valeur à enregistrer dans la ligne. */
    async enregistrer(clientId, dataUrl) {
      if (!backend.photos) return dataUrl
      const blob = await (await fetch(dataUrl)).blob()
      const chemin = `${clientId}/${uuid()}.jpg`
      await backend.photos.envoyer(chemin, blob)
      return REF_PHOTO + chemin
    },
    /** Valeur enregistrée -> adresse affichable (URL signée de 5 min, ou la data URL telle quelle). */
    async url(ref) {
      const chemin = cheminDe(ref)
      return chemin && backend.photos ? backend.photos.url(chemin) : ref
    },
    /** Toutes les références de photos d'un ensemble de lignes (réponses : valeurs ; nutrition : valeur.photo). */
    references(lignes) {
      return lignes.flatMap((l) => [...Object.values(l.valeurs || {}), l.valeur?.photo]).filter((v) => cheminDe(v))
    }
  }

  /** « Supprimer mes données de santé » (RGPD) : douleurs, mesures, nutrition et réponses aux questionnaires du client connecté. */
  api.supprimerMesDonneesSante = async () => {
    const user = await backend.utilisateurCourant()
    if (!user) throw new ErreurData('NON_CONNECTE', 'Connexion requise')
    const supprimes = {}
    for (const entite of ['douleurs', 'mesures', 'nutrition', 'reponses']) {
      const lignes = (await backend.tout(entite)).filter((o) => clientDe(entite, o) === user.id)
      // les fichiers des photos partent avec les lignes
      if (backend.photos) await backend.photos.supprimer(api.photos.references(lignes).map(cheminDe))
      for (const l of lignes) await backend.supprimer(entite, l.id)
      supprimes[entite] = lignes.length
    }
    return supprimes
  }

  api.reinitialiserDemo = () => backend.reinitialiserDemo()
  return api
}
