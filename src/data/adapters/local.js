// Adaptateur LOCAL : tout dans localStorage (clé versionnée), initialisé avec les données factices.
// Aucun serveur, aucun compte. Les vues ne l'utilisent jamais directement : elles passent par data/index.js.
import { creerApi } from '../commun.js'
import { visiblePar } from '../entites.js'
import { ErreurData, MESSAGES } from '../erreurs.js'
import { genererDemo } from '../demo/index.js'
import { creerFauxGoogle, HOMONYMES_DEMO, ALIAS_DEMO } from '../demo/agendaGoogle.js'
import { etatVide, evaluer, synchroniser } from '../../domain/agendaGoogle.js'

export const CLE_STOCKAGE = 'cdc-coaching/1'
const CLE_SESSION = `${CLE_STOCKAGE}:session`
const CLE_FILE = `${CLE_STOCKAGE}:file`
const CLE_AGENDA = `${CLE_STOCKAGE}:agenda`

/** Stockage en mémoire (tests, ou navigateur sans localStorage). */
export function stockageMemoire() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }
}

const estQuotaPlein = (e) => e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)

export function creerAdapterLocal({ storage = globalThis.localStorage || stockageMemoire(), now = () => Date.now(), uuid } = {}) {
  let cache = null

  function ecrireStockage(cle, valeur) {
    try {
      storage.setItem(cle, valeur)
    } catch (e) {
      if (estQuotaPlein(e)) throw new ErreurData('STOCKAGE_PLEIN', MESSAGES.STOCKAGE_PLEIN)
      throw e
    }
  }

  function charger() {
    if (cache) return cache
    const brut = storage.getItem(CLE_STOCKAGE)
    if (brut) {
      cache = JSON.parse(brut)
    } else {
      cache = genererDemo(now())
      ecrireStockage(CLE_STOCKAGE, JSON.stringify(cache))
    }
    return cache
  }

  // Écrit puis annule en mémoire si le stockage refuse (rien n'est « à moitié » enregistré).
  function sauver(modif) {
    const etat = charger()
    const avant = JSON.stringify(etat)
    modif(etat)
    try {
      ecrireStockage(CLE_STOCKAGE, JSON.stringify(etat))
    } catch (e) {
      cache = JSON.parse(avant)
      throw e
    }
  }

  const profilCourant = () => {
    const id = storage.getItem(CLE_SESSION)
    return id ? charger().profils.find((p) => p.id === id && !p.archive) || null : null
  }

  const backend = {
    mode: 'local',
    async tout(entite) {
      const user = profilCourant()
      return charger()[entite].filter((o) => visiblePar(entite, o, user)).map((o) => structuredClone(o))
    },
    async un(entite, id) {
      const o = charger()[entite].find((x) => x.id === id)
      return o && visiblePar(entite, o, profilCourant()) ? structuredClone(o) : null
    },
    async ecrire(entite, obj) {
      sauver((etat) => {
        const i = etat[entite].findIndex((x) => x.id === obj.id)
        if (i >= 0) etat[entite][i] = structuredClone(obj)
        else etat[entite].push(structuredClone(obj))
      })
    },
    async supprimer(entite, id) {
      sauver((etat) => { etat[entite] = etat[entite].filter((x) => x.id !== id) })
    },
    async connecter(identifiant, code) {
      const compte = charger().comptes[identifiant]
      const profil = compte && compte.code === code ? charger().profils.find((p) => p.id === compte.id) : null
      if (!profil || profil.archive) throw new ErreurData('IDENTIFIANTS', MESSAGES.IDENTIFIANTS)
      ecrireStockage(CLE_SESSION, profil.id)
      return structuredClone(profil)
    },
    async deconnecter() {
      storage.removeItem(CLE_SESSION)
    },
    async utilisateurCourant() {
      const p = profilCourant()
      return p ? structuredClone(p) : null
    },
    async changerCode(ancien, nouveau) {
      const p = profilCourant()
      if (!p) throw new ErreurData('NON_CONNECTE', 'Connexion requise')
      if (charger().comptes[p.identifiant]?.code !== ancien) throw new ErreurData('IDENTIFIANTS', MESSAGES.IDENTIFIANTS)
      sauver((etat) => { etat.comptes[p.identifiant].code = nouveau })
    },
    async reinitialiserCode(identifiant, code) {
      if (!charger().comptes[identifiant]) throw new ErreurData('INTROUVABLE', 'Compte introuvable')
      sauver((etat) => { etat.comptes[identifiant].code = code })
    },
    async creerCompte(identifiant, code) {
      const id = (uuid || (() => globalThis.crypto.randomUUID()))()
      sauver((etat) => { etat.comptes[identifiant] = { id, code } })
      return id
    },
    async reinitialiserDemo() {
      storage.removeItem(CLE_STOCKAGE)
      storage.removeItem(CLE_SESSION)
      storage.removeItem(CLE_FILE)
      storage.removeItem(CLE_AGENDA)
      cache = null
      charger()
    },
    // Google Agenda en démo : faux flux d'événements (src/data/demo/agendaGoogle.js), état gardé à part dans localStorage.
    agenda: {
      async evenements() {
        const user = profilCourant()
        // Démo : la 1re lecture déclenche la 1re synchro (comme si la planification avait déjà tourné) ;
        // « Synchroniser maintenant » amène ensuite les modifications / suppressions du faux agenda.
        if (!storage.getItem(CLE_AGENDA)) await backend.agenda.synchroniser()
        const etat = JSON.parse(storage.getItem(CLE_AGENDA))
        const clients = [...charger().profils.filter((p) => p.role === 'client' && !p.archive), ...HOMONYMES_DEMO]
        const noms = Object.fromEntries(clients.map((c) => [c.id, c.nom]))
        const tous = evaluer(etat, clients, ALIAS_DEMO).map((e) => ({ ...e, clientNom: noms[e.clientId] }))
        // même règle que la RLS : un client ne voit que ses séances attribuées
        return !user || user.role === 'coach' ? tous : tous.filter((e) => e.statut === 'attribue' && e.clientId === user.id)
      },
      async derniereSynchro() {
        const brut = storage.getItem(CLE_AGENDA)
        return brut ? JSON.parse(brut).derniereSynchro : null
      },
      async synchroniser() {
        const brut = storage.getItem(CLE_AGENDA)
        const { etat, bilan } = await synchroniser(creerFauxGoogle(now()), brut ? JSON.parse(brut) : etatVide(), now())
        ecrireStockage(CLE_AGENDA, JSON.stringify(etat))
        return bilan
      }
    },
    file: {
      async lire() {
        const brut = storage.getItem(CLE_FILE)
        return brut ? JSON.parse(brut) : []
      },
      async ecrire(liste) {
        ecrireStockage(CLE_FILE, JSON.stringify(liste))
      }
    }
  }
  return creerApi(backend, { now, uuid })
}
