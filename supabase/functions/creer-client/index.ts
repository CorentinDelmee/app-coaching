// Edge Function Supabase : le coach crée le compte (Auth + profil) d'un nouveau client.
// Entrée  (POST JSON) : { identifiant, code, profil: { nom, tarif, lieuDefaut, modules, preferences, creeLe } }
// Sortie  : { "id": "<uuid>" } ou { "erreur": "..." }
// Sécurité : l'appelant doit être connecté (JWT) ET avoir le rôle « coach » dans la table profiles.
// Les inscriptions publiques de Supabase sont DÉSACTIVÉES : c'est la seule voie de création de compte.
// La clé « service » est lue dans l'environnement de la fonction : elle ne quitte jamais le serveur.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*', // l'accès réel est protégé par le JWT du coach, pas par l'origine
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const reponse = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Même règle que src/domain/identifiants.js (emailTechnique) : e-mail fictif, jamais lu.
const emailTechnique = (identifiant: string) => `${identifiant}@clients.cdc-coaching.invalid`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reponse({ erreur: 'Méthode non autorisée' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const jeton = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jeton) return reponse({ erreur: 'Connexion requise' }, 401)

  const admin = createClient(url, cleService, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1. Qui appelle ? (le jeton est vérifié par Supabase Auth)
  const { data: appelant, error: errJeton } = await admin.auth.getUser(jeton)
  if (errJeton || !appelant.user) return reponse({ erreur: 'Connexion requise' }, 401)

  // 2. Est-ce le coach (et non archivé) ?
  const { data: profilAppelant } = await admin.from('profiles').select('role, archive').eq('id', appelant.user.id).maybeSingle()
  if (!profilAppelant || profilAppelant.role !== 'coach' || profilAppelant.archive) return reponse({ erreur: 'Réservé au coach' }, 403)

  // 3. Entrée valide ?
  // deno-lint-ignore no-explicit-any
  let corps: any
  try { corps = await req.json() } catch { return reponse({ erreur: 'Requête invalide' }, 400) }
  const identifiant = typeof corps?.identifiant === 'string' ? corps.identifiant.trim().toLowerCase() : ''
  const code = typeof corps?.code === 'string' ? corps.code : ''
  const p = corps?.profil ?? {}
  if (!/^[a-z0-9]+(\.[a-z0-9]+)?(-\d+)?$/.test(identifiant) || identifiant.length > 80) return reponse({ erreur: 'Identifiant invalide' }, 400)
  if (code.length < 8 || code.length > 72) return reponse({ erreur: 'Le code doit faire entre 8 et 72 caractères' }, 400)
  if (typeof p.nom !== 'string' || !p.nom.trim() || p.nom.length > 120) return reponse({ erreur: 'Nom invalide' }, 400)
  if (p.tarif != null && (typeof p.tarif !== 'number' || p.tarif < 0 || p.tarif > 10000)) return reponse({ erreur: 'Tarif invalide' }, 400)
  if (p.lieuDefaut != null && !['domicile', 'salle'].includes(p.lieuDefaut)) return reponse({ erreur: 'Lieu invalide' }, 400)

  // 4. Identifiant déjà pris ?
  const { data: existant } = await admin.from('profiles').select('id').eq('identifiant', identifiant).maybeSingle()
  if (existant) return reponse({ erreur: 'Cet identifiant existe déjà' }, 409)

  // 5. Compte Auth (e-mail technique déjà confirmé : personne ne le lira) puis profil « client ».
  const { data: cree, error: errCreation } = await admin.auth.admin.createUser({
    email: emailTechnique(identifiant), password: code, email_confirm: true
  })
  if (errCreation || !cree.user) return reponse({ erreur: 'Création du compte impossible' }, 500)

  const { error: errProfil } = await admin.from('profiles').insert({
    id: cree.user.id,
    role: 'client', // forcé ici : jamais lu depuis l'entrée
    identifiant,
    nom: p.nom.trim(),
    tarif: p.tarif ?? null,
    lieu_defaut: p.lieuDefaut ?? null,
    modules: p.modules ?? null,
    archive: false,
    preferences: p.preferences ?? null,
    consentement_le: null,
    cree_le: typeof p.creeLe === 'number' ? p.creeLe : Date.now()
  })
  if (errProfil) {
    await admin.auth.admin.deleteUser(cree.user.id) // pas de compte sans profil
    return reponse({ erreur: 'Création du profil impossible' }, 500)
  }
  return reponse({ id: cree.user.id })
})
