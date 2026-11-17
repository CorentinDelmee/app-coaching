// Edge Function Supabase : synchronise Google Agenda -> table seances_agenda.
// Appelée par : pg_cron (en-tête x-cron-secret = CRON_SECRET), le webhook Google (en-tête x-goog-channel-token = WEBHOOK_SECRET),
// ou le coach connecté (bouton « Synchroniser maintenant »). Trois secrets distincts (le troisième, STATE_SECRET, sert à la connexion OAuth).
// Déployer avec --no-verify-jwt : l'authentification est faite ici (voir docs/GOOGLE-AGENDA.md).
// Variables (secrets de la fonction, jamais dans Git) : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CRON_SECRET, WEBHOOK_SECRET, APP_ORIGIN (origine de l'appli, pour CORS), GOOGLE_CALENDAR_ID (défaut : primary).
// Le jeton de rafraîchissement est lu dans le Vault Supabase (chiffré) via la fonction SQL lire_refresh_token_google().
// Les règles (correspondance, fusion, syncToken/410) viennent du module pur testé par Vitest : src/domain/agendaGoogle.js.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { etatVide, evaluer, synchroniser } from '../_shared/agendaGoogle.js'
import { champsStockes, corsPour, egalConstant } from '../_shared/securite.js'

const reponse = (corps: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(corps), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Erreur dont le message est écrit par nous (jamais celui de Google) : seul cas où le texte est renvoyé à l'appelant.
class ErreurPublique extends Error {}

const env = (k: string) => Deno.env.get(k) ?? ''

/** Jeton d'accès Google (1 h) obtenu à partir du jeton de rafraîchissement. */
async function jetonAcces(refresh: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), refresh_token: refresh, grant_type: 'refresh_token'
    })
  })
  if (!res.ok) { console.error('sync: jeton de rafraîchissement refusé', res.status); throw new ErreurPublique('Google a refusé le jeton : reconnectez le compte (docs/GOOGLE-AGENDA.md, étape Connexion)') }
  return (await res.json()).access_token
}

Deno.serve(async (req) => {
  const CORS = corsPour(req, env('APP_ORIGIN'), 'authorization, x-client-info, apikey, content-type')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reponse({ erreur: 'Méthode non autorisée' }, 405, CORS)

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })

  // --- Qui appelle ? cron / webhook Google (secret partagé) ou coach (JWT) ---
  const parSecret = (await egalConstant(req.headers.get('x-cron-secret') ?? '', env('CRON_SECRET'))) ||
    (await egalConstant(req.headers.get('x-goog-channel-token') ?? '', env('WEBHOOK_SECRET')))
  if (!parSecret) {
    const jeton = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jeton) return reponse({ erreur: 'Connexion requise' }, 401, CORS)
    const { data: appelant } = await admin.auth.getUser(jeton)
    if (!appelant?.user) return reponse({ erreur: 'Connexion requise' }, 401, CORS)
    const { data: profil } = await admin.from('profiles').select('role, archive').eq('id', appelant.user.id).maybeSingle()
    if (!profil || profil.role !== 'coach' || profil.archive) return reponse({ erreur: 'Réservé au coach' }, 403, CORS)
  }
  // Notification push « sync » initiale de Google : rien à faire, on répond OK.
  if (req.headers.get('x-goog-resource-state') === 'sync') return reponse({ ok: true }, 200, CORS)

  try {
    const { data: sec } = await admin.from('google_agenda_secret').select('sync_token').eq('id', 1).single()
    const { data: refresh } = await admin.rpc('lire_refresh_token_google')
    if (!refresh) return reponse({ erreur: "Google Agenda n'est pas encore connecté (voir docs/GOOGLE-AGENDA.md)" }, 409, CORS)
    const acces = await jetonAcces(refresh)
    const calendrier = encodeURIComponent(env('GOOGLE_CALENDAR_ID') || 'primary')

    // Source : events.list. 410 Gone (jeton expiré) est remonté avec .status pour que le moteur resynchronise tout.
    const source = {
      async lister({ syncToken, pageToken }: { syncToken?: string | null; pageToken?: string | null }) {
        const q = new URLSearchParams({ maxResults: '250', singleEvents: 'true', showDeleted: 'true' })
        if (syncToken) q.set('syncToken', syncToken)
        else q.set('timeMin', new Date(Date.now() - 7 * 864e5).toISOString()) // synchro complète : depuis 7 jours
        if (pageToken) q.set('pageToken', pageToken)
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendrier}/events?${q}`, { headers: { Authorization: `Bearer ${acces}` } })
        if (!res.ok) { const e = new Error(`Google Calendar ${res.status}`) as Error & { status: number }; e.status = res.status; throw e }
        return await res.json()
      }
    }

    // État précédent reconstruit depuis la base (les événements et le syncToken).
    const { data: lignes } = await admin.from('seances_agenda').select('id, data')
    const etat = { ...etatVide(), syncToken: sec?.sync_token ?? null, evenements: Object.fromEntries((lignes ?? []).map((l) => [l.id, l.data])) }
    const maintenant = Date.now()
    const { etat: nouveau, bilan } = await synchroniser(source, etat, maintenant)

    // Attribution : clients actifs + identifiants courts.
    const [{ data: profils }, { data: alias }] = await Promise.all([
      admin.from('profiles').select('id, nom').eq('role', 'client').eq('archive', false),
      admin.from('agenda_alias').select('tag, client_id')
    ])
    const evalues = evaluer(nouveau, profils ?? [], Object.fromEntries((alias ?? []).map((a) => [a.tag, a.client_id])))
    const lignesNouvelles = evalues.map((e: any) => ({
      id: e.id, client_id: e.statut === 'attribue' ? e.clientId : null, statut_attribution: e.statut,
      data: champsStockes(e), maj: new Date().toISOString()
    }))
    if (lignesNouvelles.length) await admin.from('seances_agenda').upsert(lignesNouvelles)
    // Supprimés / annulés / plus « Coaching… » : on retire les lignes qui ne sont plus dans l'état.
    const gardes = new Set(lignesNouvelles.map((l: any) => l.id))
    const aSupprimer = (lignes ?? []).map((l) => l.id).filter((id) => !gardes.has(id))
    if (aSupprimer.length) await admin.from('seances_agenda').delete().in('id', aSupprimer)

    await admin.from('google_agenda_secret').update({ sync_token: nouveau.syncToken }).eq('id', 1)
    await admin.from('agenda_synchro').update({ derniere_synchro: new Date(maintenant).toISOString(), bilan }).eq('id', 1)
    return reponse({ ok: true, bilan }, 200, CORS)
  } catch (e) {
    // Détail (réponse de Google, etc.) dans les journaux de la fonction ; message générique pour l'appelant.
    console.error('sync: échec', (e as Error).message)
    return reponse({ erreur: e instanceof ErreurPublique ? e.message : 'Synchronisation impossible, consultez les journaux de la fonction' }, 502, CORS)
  }
})
