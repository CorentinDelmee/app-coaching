// Edge Function Supabase : synchronise Google Agenda -> table seances_agenda.
// Appelée par : pg_cron (en-tête x-cron-secret), le webhook Google (en-tête x-goog-channel-token), ou le coach connecté (bouton « Synchroniser maintenant »).
// Déployer avec --no-verify-jwt : l'authentification est faite ici (voir docs/GOOGLE-AGENDA.md).
// Variables (secrets de la fonction, jamais dans Git) : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CRON_SECRET, GOOGLE_CALENDAR_ID (défaut : primary).
// Le jeton de rafraîchissement est lu dans google_agenda_secret (table inaccessible aux utilisateurs).
// Les règles (correspondance, fusion, syncToken/410) viennent du module pur testé par Vitest : src/domain/agendaGoogle.js.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { etatVide, evaluer, synchroniser } from '../../../src/domain/agendaGoogle.js'

const CORS = {
  'Access-Control-Allow-Origin': '*', // l'accès réel est protégé par le JWT du coach / le secret, pas par l'origine
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const reponse = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) ?? ''

// Comparaison en temps constant (évite de deviner le secret par le temps de réponse).
function egal(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** Jeton d'accès Google (1 h) obtenu à partir du jeton de rafraîchissement. */
async function jetonAcces(refresh: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), refresh_token: refresh, grant_type: 'refresh_token'
    })
  })
  if (!res.ok) throw new Error('Google a refusé le jeton de rafraîchissement : reconnectez le compte (docs/GOOGLE-AGENDA.md, étape Connexion)')
  return (await res.json()).access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reponse({ erreur: 'Méthode non autorisée' }, 405)

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })

  // --- Qui appelle ? cron / webhook Google (secret partagé) ou coach (JWT) ---
  const secret = env('CRON_SECRET')
  const parSecret = egal(req.headers.get('x-cron-secret') ?? '', secret) || egal(req.headers.get('x-goog-channel-token') ?? '', secret)
  if (!parSecret) {
    const jeton = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jeton) return reponse({ erreur: 'Connexion requise' }, 401)
    const { data: appelant } = await admin.auth.getUser(jeton)
    if (!appelant?.user) return reponse({ erreur: 'Connexion requise' }, 401)
    const { data: profil } = await admin.from('profiles').select('role, archive').eq('id', appelant.user.id).maybeSingle()
    if (!profil || profil.role !== 'coach' || profil.archive) return reponse({ erreur: 'Réservé au coach' }, 403)
  }
  // Notification push « sync » initiale de Google : rien à faire, on répond OK.
  if (req.headers.get('x-goog-resource-state') === 'sync') return reponse({ ok: true })

  try {
    const { data: sec } = await admin.from('google_agenda_secret').select('*').eq('id', 1).single()
    if (!sec?.refresh_token) return reponse({ erreur: "Google Agenda n'est pas encore connecté (voir docs/GOOGLE-AGENDA.md)" }, 409)
    const acces = await jetonAcces(sec.refresh_token)
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
    const etat = { ...etatVide(), syncToken: sec.sync_token, evenements: Object.fromEntries((lignes ?? []).map((l) => [l.id, l.data])) }
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
      data: { ...e, clientId: undefined, statut: undefined, candidats: undefined }, maj: new Date().toISOString()
    }))
    if (lignesNouvelles.length) await admin.from('seances_agenda').upsert(lignesNouvelles)
    // Supprimés / annulés / plus « Coaching… » : on retire les lignes qui ne sont plus dans l'état.
    const gardes = new Set(lignesNouvelles.map((l: any) => l.id))
    const aSupprimer = (lignes ?? []).map((l) => l.id).filter((id) => !gardes.has(id))
    if (aSupprimer.length) await admin.from('seances_agenda').delete().in('id', aSupprimer)

    await admin.from('google_agenda_secret').update({ sync_token: nouveau.syncToken }).eq('id', 1)
    await admin.from('agenda_synchro').update({ derniere_synchro: new Date(maintenant).toISOString(), bilan }).eq('id', 1)
    return reponse({ ok: true, bilan })
  } catch (e) {
    return reponse({ erreur: (e as Error).message || 'Synchronisation impossible' }, 502)
  }
})
