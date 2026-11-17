// Edge Function Supabase : le coach donne un nouveau code (mot de passe) à un client.
// Entrée  (POST JSON) : { "identifiant": "fabien.vincent", "code": "K7M2QX" }
// Sortie  : { "ok": true } ou { "erreur": "..." }
// Sécurité : l'appelant doit être connecté (JWT) ET avoir le rôle « coach » dans la table profiles.
// La clé « service » est lue dans l'environnement de la fonction (fournie par Supabase) : elle ne quitte jamais le serveur.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  // Seule l'origine de l'appli (secret APP_ORIGIN) est autorisée ; sans elle, aucune origine web (en plus du JWT coach).
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'null',
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const reponse = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

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
  let corps: { identifiant?: unknown; code?: unknown }
  try { corps = await req.json() } catch { return reponse({ erreur: 'Requête invalide' }, 400) }
  const identifiant = typeof corps.identifiant === 'string' ? corps.identifiant.trim().toLowerCase() : ''
  const code = typeof corps.code === 'string' ? corps.code : ''
  if (!identifiant) return reponse({ erreur: 'Identifiant manquant' }, 400)
  if (code.length < 8 || code.length > 72) return reponse({ erreur: 'Le code doit faire entre 8 et 72 caractères' }, 400)

  // 4. La cible doit être un client (jamais le coach).
  const { data: cible } = await admin.from('profiles').select('id, role').eq('identifiant', identifiant).maybeSingle()
  if (!cible || cible.role !== 'client') return reponse({ erreur: 'Client introuvable' }, 404)

  // 5. Changement du mot de passe.
  const { error } = await admin.auth.admin.updateUserById(cible.id, { password: code })
  if (error) return reponse({ erreur: 'Changement impossible' }, 500)
  return reponse({ ok: true })
})
