// Edge Function Supabase : connexion unique du compte Google du coach (OAuth 2.0, lecture seule).
//   GET  ?action=demarrer&cle=<CRON_SECRET>  -> redirige vers l'écran de consentement Google
//   GET  ?code=...&state=...                 -> retour de Google : échange le code, range le jeton de rafraîchissement
//                                              dans google_agenda_secret (table serveur uniquement), puis affiche « Connecté ».
// Déployer avec --no-verify-jwt (Google appelle sans jeton Supabase). Variables : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// GOOGLE_REDIRECT_URI (= l'URL de CETTE fonction, déclarée dans la console Google), CRON_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
const page = (texte: string, status = 200) =>
  new Response(`<!doctype html><meta charset="utf-8"><title>Google Agenda</title><body style="font:18px system-ui;padding:2rem"><p>${texte}</p>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (url.searchParams.get('action') === 'demarrer') {
    if (url.searchParams.get('cle') !== env('CRON_SECRET') || !env('CRON_SECRET')) return page('Clé invalide.', 403)
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    auth.search = new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: env('GOOGLE_REDIRECT_URI'), response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events.readonly', // lecture seule des événements
      access_type: 'offline', prompt: 'consent',                           // « offline » = jeton de rafraîchissement
      state: env('CRON_SECRET')
    }).toString()
    return Response.redirect(auth.toString(), 302)
  }

  const code = url.searchParams.get('code')
  if (!code || url.searchParams.get('state') !== env('CRON_SECRET')) return page('Demande invalide.', 400)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: env('GOOGLE_REDIRECT_URI'), grant_type: 'authorization_code'
    })
  })
  const jetons = await res.json()
  if (!res.ok || !jetons.refresh_token) return page("Google n'a pas fourni de jeton de rafraîchissement. Révoquez l'accès de l'application dans votre compte Google puis recommencez.", 400)

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  await admin.from('google_agenda_secret').update({ refresh_token: jetons.refresh_token, sync_token: null }).eq('id', 1)
  return page('Google Agenda est connecté. Vous pouvez fermer cet onglet et cliquer sur « Synchroniser maintenant » dans le tableau de bord coach.')
})
