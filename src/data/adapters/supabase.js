// Adaptateur SUPABASE (actif seulement si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies).
// Le SDK n'est chargé qu'au premier appel réseau (import dynamique) : en mode local il n'est jamais évalué.
// Aucune clé dans le code : url et clé anonyme viennent de l'environnement (voir .env.example).
// Les droits sont garantis par les règles RLS de supabase/schema.sql, pas par ce fichier.
import { creerApi } from '../commun.js'
import { ENTITES, clientDe } from '../entites.js'
import { ErreurData, MESSAGES } from '../erreurs.js'
import { emailTechnique } from '../../domain/identifiants.js'

// Erreur renvoyée par une Edge Function : le message utile est dans le corps de la réponse HTTP.
async function erreurFonction(error, parDefaut) {
  if (/fetch|network|Failed to send/i.test(error.message || '')) return new ErreurData('RESEAU', 'Pas de réseau')
  let message = ''
  try { message = (await error.context?.json?.())?.erreur || '' } catch { /* corps illisible */ }
  return new ErreurData('ECHEC', message || parDefaut)
}

const CLE_FILE = 'cdc-coaching/1:file'

// Profils : vraies colonnes (le client ne peut pas modifier tarif/rôle/modules, voir le trigger SQL).
const profilDepuisLigne = (r) => ({
  id: r.id, role: r.role, identifiant: r.identifiant, nom: r.nom, tarif: r.tarif ?? undefined, lieuDefaut: r.lieu_defaut ?? undefined,
  modules: r.modules ?? undefined, archive: r.archive, preferences: r.preferences ?? undefined,
  consentementLe: r.consentement_le ?? null, creeLe: Number(r.cree_le)
})
const ligneDepuisProfil = (p) => ({
  id: p.id, role: p.role, identifiant: p.identifiant, nom: p.nom, tarif: p.tarif ?? null, lieu_defaut: p.lieuDefaut ?? null,
  modules: p.modules ?? null, archive: !!p.archive, preferences: p.preferences ?? null,
  consentement_le: p.consentementLe ?? null, cree_le: p.creeLe
})
// Autres tables : id, client_id (pour les règles RLS) et l'objet complet dans `data`.
const depuisLigne = (entite, r) => (entite === 'profils' ? profilDepuisLigne(r) : r.data)
const versLigne = (entite, o) => (entite === 'profils' ? ligneDepuisProfil(o) : { id: o.id, client_id: clientDe(entite, o), data: o })

export function creerAdapterSupabase({ url, anonKey, storage = globalThis.localStorage, now, uuid } = {}) {
  if (!url || !anonKey) throw new Error('Supabase : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis')
  let client = null
  let profilCache = null

  async function sb() {
    if (!client) {
      const { createClient } = await import('@supabase/supabase-js')
      client = createClient(url, anonKey) // session persistante (reste connecté)
    }
    return client
  }
  // Traduit les erreurs réseau en ErreurData('RESEAU') pour déclencher la file d'attente hors connexion.
  function echec(error) {
    const reseau = /fetch|network|failed|timeout/i.test(error.message || '')
    return new ErreurData(reseau ? 'RESEAU' : 'VALIDATION', error.message)
  }
  async function requete(promesse) {
    let res
    try {
      res = await promesse
    } catch (e) {
      throw new ErreurData('RESEAU', e.message)
    }
    if (res.error) throw echec(res.error)
    return res.data
  }

  const backend = {
    mode: 'supabase',
    async tout(entite) {
      const c = await sb()
      const lignes = await requete(c.from(ENTITES[entite].table).select('*'))
      return lignes.map((r) => depuisLigne(entite, r))
    },
    async un(entite, id) {
      const c = await sb()
      const ligne = await requete(c.from(ENTITES[entite].table).select('*').eq('id', id).maybeSingle())
      return ligne ? depuisLigne(entite, ligne) : null
    },
    async ecrire(entite, obj) {
      const c = await sb()
      const table = c.from(ENTITES[entite].table)
      // Profils : un client n'a pas le droit d'insérer (RLS) ; on met à jour la ligne existante au lieu d'un upsert.
      if (entite === 'profils' && (await backend.un('profils', obj.id))) {
        await requete(table.update(versLigne(entite, obj)).eq('id', obj.id))
      } else {
        await requete(table.upsert(versLigne(entite, obj)))
      }
    },
    async supprimer(entite, id) {
      const c = await sb()
      await requete(c.from(ENTITES[entite].table).delete().eq('id', id))
    },
    async connecter(identifiant, code) {
      const c = await sb()
      const { data, error } = await c.auth.signInWithPassword({ email: emailTechnique(identifiant), password: code })
      if (error) throw new ErreurData(/fetch|network/i.test(error.message) ? 'RESEAU' : 'IDENTIFIANTS', MESSAGES.IDENTIFIANTS)
      profilCache = await backend.un('profils', data.user.id)
      if (!profilCache || profilCache.archive) {
        await c.auth.signOut()
        throw new ErreurData('IDENTIFIANTS', MESSAGES.IDENTIFIANTS)
      }
      return profilCache
    },
    async deconnecter() {
      const c = await sb()
      profilCache = null
      await c.auth.signOut()
    },
    async utilisateurCourant() {
      const c = await sb()
      const { data } = await c.auth.getSession()
      if (!data.session) return null
      if (!profilCache || profilCache.id !== data.session.user.id) profilCache = await backend.un('profils', data.session.user.id)
      return profilCache
    },
    async changerCode(ancien, nouveau) {
      const c = await sb()
      const user = await backend.utilisateurCourant()
      if (!user) throw new ErreurData('NON_CONNECTE', 'Connexion requise')
      // Vérifie l'ancien code avant de le remplacer.
      const { error: e1 } = await c.auth.signInWithPassword({ email: emailTechnique(user.identifiant), password: ancien })
      if (e1) throw new ErreurData('IDENTIFIANTS', MESSAGES.IDENTIFIANTS)
      const { error } = await c.auth.updateUser({ password: nouveau })
      if (error) throw echec(error)
    },
    // Les inscriptions publiques de Supabase sont désactivées : le compte ET le profil sont créés par l'Edge Function
    // `creer-client` (supabase/functions), qui vérifie que l'appelant est le coach. La clé service ne quitte jamais le serveur.
    profilCreeParCompte: true,
    async creerCompte(identifiant, code, profil) {
      const c = await sb()
      const { data, error } = await c.functions.invoke('creer-client', { body: { identifiant, code, profil } })
      if (error) throw await erreurFonction(error, "Le compte n'a pas pu être créé")
      if (data?.erreur || !data?.id) throw new ErreurData('ECHEC', data?.erreur || "Le compte n'a pas pu être créé")
      return data.id
    },
    // Changer le mot de passe d'un autre compte exige la clé « service » : l'Edge Function `reinitialiser-code` (supabase/functions)
    // vérifie que l'appelant est le coach, puis change le mot de passe. La clé service ne quitte jamais le serveur.
    async reinitialiserCode(identifiant, code) {
      const c = await sb()
      const { data, error } = await c.functions.invoke('reinitialiser-code', { body: { identifiant, code } })
      if (error) throw await erreurFonction(error, "Le nouveau code n'a pas pu être enregistré")
      if (data?.erreur) throw new ErreurData('ECHEC', data.erreur)
    },
    async reinitialiserDemo() {
      throw new ErreurData('NON_SUPPORTE', 'La démo ne se réinitialise qu\'en mode local')
    },
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
