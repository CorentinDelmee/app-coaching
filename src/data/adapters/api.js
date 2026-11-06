// Adaptateur API : l'app parle au serveur app-coaching du VPS (docs/CONTRAT-VPS.md), en same-origin.
// Actif avec VITE_BACKEND=api. Session = cookie HttpOnly posé par le serveur (rien n'est stocké côté navigateur).
// Les droits sont appliqués par le serveur (équivalent des anciennes règles RLS), pas par ce fichier.
import { creerApi } from '../commun.js'
import { ErreurData, MESSAGES } from '../erreurs.js'

const CLE_FILE = 'cdc-coaching/1:file'
const BASE = '/api/app'
const enc = encodeURIComponent

export function creerAdapterApi({ fetchFn = (...a) => globalThis.fetch(...a), storage = globalThis.localStorage, now, uuid } = {}) {
  let profilCache = null

  // Une requête JSON. Traduit les statuts HTTP en ErreurData ; `contexte` précise le sens d'un 401 (connexion = mauvais code).
  async function appel(methode, chemin, { corps, brut, contexte, type } = {}) {
    const init = { method: methode, credentials: 'same-origin', headers: {} }
    if (brut !== undefined) { init.body = brut; init.headers['Content-Type'] = type || 'application/octet-stream' }
    else if (corps !== undefined) { init.body = JSON.stringify(corps); init.headers['Content-Type'] = 'application/json' }
    let res
    try {
      res = await fetchFn(BASE + chemin, init)
    } catch (e) {
      throw new ErreurData('RESEAU', e.message || 'Pas de réseau')
    }
    if (res.ok) {
      if (res.status === 204) return null
      if (contexte === 'binaire') return res
      try { return await res.json() } catch { return null }
    }
    let message = ''
    try { message = (await res.json())?.erreur || '' } catch { /* corps absent ou illisible */ }
    throw erreurHttp(res.status, message, contexte)
  }

  function erreurHttp(statut, message, contexte) {
    if (statut === 401) {
      profilCache = null
      return contexte === 'connexion' ? new ErreurData('IDENTIFIANTS', MESSAGES.IDENTIFIANTS) : new ErreurData('NON_CONNECTE', 'Connexion requise')
    }
    if (statut === 403) return new ErreurData('INTERDIT', message || 'Accès refusé')
    if (statut === 404) return new ErreurData('INTROUVABLE', message || 'Introuvable')
    if (statut === 409) return new ErreurData('EXISTE', message || 'Existe déjà')
    if (statut === 400 || statut === 413 || statut === 415) return new ErreurData('VALIDATION', message || 'Données invalides')
    if (statut === 429) return new ErreurData('ECHEC', message || 'Trop d\'essais, réessayez dans quelques minutes')
    if (statut === 502 || statut === 503) return new ErreurData('ECHEC', message === 'reservation_indisponible' ? 'Le service de réservation est indisponible' : (message || 'Service indisponible'))
    return new ErreurData('ECHEC', message || 'Erreur du serveur')
  }

  const backend = {
    mode: 'api',
    async tout(entite) {
      const r = await appel('GET', `/e/${enc(entite)}`)
      return r?.items ?? []
    },
    async un(entite, id) {
      try {
        return (await appel('GET', `/e/${enc(entite)}/${enc(id)}`))?.item ?? null
      } catch (e) {
        if (e.code === 'INTROUVABLE') return null
        throw e
      }
    },
    async ecrire(entite, obj) {
      await appel('PUT', `/e/${enc(entite)}/${enc(obj.id)}`, { corps: obj })
    },
    async supprimer(entite, id) {
      try {
        await appel('DELETE', `/e/${enc(entite)}/${enc(id)}`)
      } catch (e) {
        if (e.code !== 'INTROUVABLE') throw e // déjà supprimé = succès
      }
    },
    async connecter(identifiant, code) {
      const r = await appel('POST', '/connexion', { corps: { identifiant, code }, contexte: 'connexion' })
      profilCache = r?.utilisateur
      if (!profilCache || profilCache.archive) {
        profilCache = null
        throw new ErreurData('IDENTIFIANTS', MESSAGES.IDENTIFIANTS)
      }
      return profilCache
    },
    async deconnecter() {
      profilCache = null
      await appel('POST', '/deconnexion').catch((e) => { if (e.code !== 'NON_CONNECTE') throw e })
    },
    async utilisateurCourant() {
      if (profilCache) return profilCache
      try {
        profilCache = (await appel('GET', '/moi'))?.utilisateur ?? null
      } catch (e) {
        if (e.code === 'NON_CONNECTE') return null // pas de session (ou expirée) : utilisateur déconnecté
        throw e
      }
      return profilCache
    },
    async changerCode(ancien, nouveau) {
      try {
        await appel('POST', '/code', { corps: { ancien, nouveau } })
      } catch (e) {
        if (e.code === 'NON_CONNECTE') throw new ErreurData('IDENTIFIANTS', MESSAGES.IDENTIFIANTS) // ancien code refusé
        throw e
      }
    },
    // Le serveur crée le compte ET le profil dans la même opération.
    profilCreeParCompte: true,
    async creerCompte(identifiant, code, profil) {
      const r = await appel('POST', '/comptes', { corps: { identifiant, code, profil } })
      if (!r?.id) throw new ErreurData('ECHEC', "Le compte n'a pas pu être créé")
      return r.id
    },
    async reinitialiserCode(identifiant, code) {
      await appel('POST', `/comptes/${enc(identifiant)}/code`, { corps: { code } })
    },
    async reinitialiserDemo() {
      throw new ErreurData('NON_SUPPORTE', 'La démo ne se réinitialise qu\'en mode local')
    },
    // Fichiers (photos) : stockés sur le VPS, chemin `<client_id>/<uuid>.jpg`, même contrôle d'accès que le client propriétaire.
    photos: {
      async envoyer(chemin, blob) {
        await appel('POST', `/fichiers?chemin=${enc(chemin)}`, { brut: blob, type: blob.type || 'image/jpeg' })
      },
      // Même origine + cookie de session : l'adresse suffit pour un <img>, pas d'URL signée.
      async url(chemin) {
        return `${BASE}/fichiers?chemin=${enc(chemin)}`
      },
      async supprimer(chemins) {
        for (const c of chemins) await appel('DELETE', `/fichiers?chemin=${enc(c)}`)
      }
    },
    // Exercices enrichis : routes dédiées (docs/CONTRAT-EXERCICES-STUDIO.md). Les droits sont appliqués par le serveur.
    exercices: {
      async recherche(filtre = {}) {
        const qs = new URLSearchParams(Object.entries(filtre).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString()
        const r = await appel('GET', `/exercices${qs ? `?${qs}` : ''}`)
        return { items: r?.items ?? [], total: r?.total ?? 0 }
      },
      async detail(id) {
        try { return (await appel('GET', `/exercices/${enc(id)}`))?.item ?? null } catch (e) { if (e.code === 'INTROUVABLE') return null; throw e }
      },
      async mettreAJour(id, patch) {
        return (await appel('PATCH', `/exercices/${enc(id)}`, { corps: patch }))?.item
      },
      async envoyerPhoto(id, blob) {
        return (await appel('POST', `/exercices/${enc(id)}/photo`, { brut: blob, type: blob.type })).item
      },
      async retirerPhoto(id) {
        return (await appel('DELETE', `/exercices/${enc(id)}/photo`))?.item
      }
    },
    agenda: {
      async evenements() {
        const r = await appel('GET', '/agenda/evenements')
        return [...(r?.evenements ?? [])].sort((a, b) => a.debutMs - b.debutMs)
      },
      async derniereSynchro() {
        const r = await appel('GET', '/agenda/derniere-synchro')
        const v = r?.derniereSynchro
        if (v == null) return null
        return typeof v === 'number' ? v : (Date.parse(v) || null)
      },
      // 202 : la synchro est immédiate ; on renvoie le message du serveur pour l'afficher.
      async synchroniser() {
        const r = await appel('POST', '/agenda/synchroniser')
        return { message: r?.message || '' }
      }
    },
    // Réservations du site vitrine (coach uniquement), relayées par le serveur.
    reservations: {
      async liste(statut = 'a_venir') {
        const r = await appel('GET', `/reservations?statut=${enc(statut)}`)
        return r?.reservations ?? []
      },
      async annuler(id) {
        await appel('POST', `/reservations/${enc(id)}/annuler`)
      },
      async blocages() {
        const r = await appel('GET', '/reservations/blocages')
        return r?.blocages ?? []
      },
      async bloquer(debut, fin, motif = '') {
        return (await appel('POST', '/reservations/blocages', { corps: { debut, fin, motif } }))?.blocage
      },
      async debloquer(id) {
        await appel('DELETE', `/reservations/blocages/${enc(id)}`)
      },
      async regles() {
        return appel('GET', '/reservations/regles')
      },
      async ecrireRegles(regles) {
        return appel('PUT', '/reservations/regles', { corps: regles })
      }
    },
    // File d'attente hors connexion : reste sur l'appareil.
    file: {
      async lire() {
        const brut = storage?.getItem(CLE_FILE)
        return brut ? JSON.parse(brut) : []
      },
      async ecrire(liste) {
        storage?.setItem(CLE_FILE, JSON.stringify(liste))
      }
    }
  }
  return creerApi(backend, { now, uuid })
}
