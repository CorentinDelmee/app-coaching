// Edge Function Supabase : connexion unique du compte Google du coach (OAuth 2.0, lecture seule, PKCE S256).
//   POST ?action=demarrer + en-tête x-state-secret: <STATE_SECRET> -> renvoie { url } : l'adresse de l'écran de consentement Google
//                                              (le secret n'est jamais dans une URL)
//   GET  ?code=...&state=...                 -> retour de Google : vérifie le « state », consomme le nonce (usage unique),
//                                              échange le code avec le code_verifier PKCE, range le jeton de rafraîchissement
//                                              dans le Vault Supabase (chiffré), puis affiche « Connecté ».
// Déployer avec --no-verify-jwt (Google appelle sans jeton Supabase). Variables : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// GOOGLE_REDIRECT_URI (= l'URL de CETTE fonction, déclarée dans la console Google), STATE_SECRET (distinct de CRON_SECRET et WEBHOOK_SECRET).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aleatoire, defiPkce, egalConstant, hmacHex } from '../_shared/securite.js'

const env = (k: string) => Deno.env.get(k) ?? ''
const VALIDITE_MS = 10 * 60000 // un lien de consentement est valable 10 minutes, une seule fois
const MAX_DEMANDES_EN_COURS = 5 // limitation de ?action=demarrer : au plus 5 demandes non consommées à la fois

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })
const page = (texte: string, status = 200) =>
  new Response(`<!doctype html><meta charset="utf-8"><title>Google Agenda</title><body style="font:18px system-ui;padding:2rem"><p>${texte}</p>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const secretEtat = env('STATE_SECRET')

  if (url.searchParams.get('action') === 'demarrer') {
    if (req.method !== 'POST' || !secretEtat || !(await egalConstant(req.headers.get('x-state-secret') ?? '', secretEtat))) return json({ erreur: 'Clé invalide' }, 403)
    // Limitation : on purge les demandes expirées, puis on refuse s'il y en a déjà trop en attente.
    await admin.from('google_agenda_oauth').delete().lt('expire', new Date().toISOString())
    const { count } = await admin.from('google_agenda_oauth').select('nonce', { count: 'exact', head: true })
    if ((count ?? 0) >= MAX_DEMANDES_EN_COURS) return json({ erreur: 'Trop de demandes, réessayez dans quelques minutes' }, 429)

    const nonce = aleatoire(24)
    const verifier = aleatoire(48) // PKCE : ne quitte jamais le serveur avant l'échange du code
    const { error } = await admin.from('google_agenda_oauth').insert({ nonce, verifier, expire: new Date(Date.now() + VALIDITE_MS).toISOString() })
    if (error) { console.error('connexion: insertion nonce', error.message); return json({ erreur: 'Demande impossible' }, 500) }
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    auth.search = new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: env('GOOGLE_REDIRECT_URI'), response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events.readonly', // lecture seule des événements
      access_type: 'offline', prompt: 'consent',                           // « offline » = jeton de rafraîchissement
      code_challenge: await defiPkce(verifier), code_challenge_method: 'S256',
      state: `${nonce}.${await hmacHex(secretEtat, nonce)}`
    }).toString()
    return json({ url: auth.toString() })
  }

  // --- Retour de Google : le state doit être signé (temps constant) ET son nonce encore valide ; il est consommé (rejeu impossible) ---
  const code = url.searchParams.get('code')
  const [nonce, signature] = (url.searchParams.get('state') ?? '').split('.')
  if (!code || !nonce || !signature || !secretEtat || !(await egalConstant(signature, await hmacHex(secretEtat, nonce)))) return page('Demande invalide.', 400)
  const { data: consomme } = await admin.from('google_agenda_oauth').delete().eq('nonce', nonce).gt('expire', new Date().toISOString()).select('verifier')
  const verifier = consomme?.[0]?.verifier
  if (!verifier) return page('Demande invalide ou expirée. Recommencez la connexion.', 400)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, code_verifier: verifier, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: env('GOOGLE_REDIRECT_URI'), grant_type: 'authorization_code'
    })
  })
  const jetons = await res.json().catch(() => ({}))
  if (!res.ok || !jetons.refresh_token) {
    console.error('connexion: échange du code refusé', res.status, jetons?.error) // détail dans les journaux seulement
    return page("Google n'a pas fourni de jeton de rafraîchissement. Révoquez l'accès de l'application dans votre compte Google puis recommencez.", 400)
  }

  // Jeton chiffré dans le Vault (voir la migration) ; on repart d'une synchro complète.
  const { error } = await admin.rpc('ecrire_refresh_token_google', { jeton: jetons.refresh_token })
  if (error) { console.error('connexion: écriture Vault', error.message); return page('Enregistrement impossible. Réessayez plus tard.', 500) }
  await admin.from('google_agenda_secret').update({ sync_token: null }).eq('id', 1)
  return page('Google Agenda est connecté. Vous pouvez fermer cet onglet et cliquer sur « Synchroniser maintenant » dans le tableau de bord coach.')
})
