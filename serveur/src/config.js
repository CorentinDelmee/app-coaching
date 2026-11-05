// Configuration lue dans l'environnement (jamais dans le code). Voir serveur/README.md.
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RACINE_SERVEUR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Charge serveur/.env s'il existe (Node 24 : process.loadEnvFile). Les variables déjà définies gagnent. */
export function chargerEnv() {
  const f = join(RACINE_SERVEUR, '.env')
  if (existsSync(f)) process.loadEnvFile(f)
}

export function lireConfig(env = process.env) {
  // Garde : /demo/etat est public ; avec une vraie base (Supabase) ce serait une fuite de données clients.
  if (env.DEMO_SYNC === '1' && env.SUPABASE_URL) throw new Error('DEMO_SYNC=1 est interdit quand SUPABASE_URL est défini (fuite de données réelles) : retirez l’un des deux.')
  if (env.DEMO_SYNC === '1' && env.DB_FILE) throw new Error('DEMO_SYNC=1 est interdit quand DB_FILE est défini (fuite de données réelles) : retirez l’un des deux.')
  const liste = (v, defaut) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : defaut)
  return {
    hote: '127.0.0.1', // jamais autre chose : le serveur n'écoute pas le réseau
    port: Number(env.PORT_API || env.PORT || 5405),
    cleApi: env.COACH_API_KEY || '',
    dossierDonnees: resolve(env.DATA_DIR || join(RACINE_SERVEUR, 'data')),
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseCleService: env.SUPABASE_SERVICE_KEY || '',
    youtubeCle: env.YOUTUBE_API_KEY || '',
    chainesReconnues: liste(env.YOUTUBE_CHAINES_RECONNUES, ['Tibo InShape', 'Julien Quaglierini', 'Hygiène & Musculation']),
    originesCors: liste(env.CORS_ORIGINS, ['http://localhost:5406', 'http://127.0.0.1:5406', 'http://localhost:5173']),
    syncDemo: env.DEMO_SYNC === '1', // expose /demo/etat (sans clé) pour que l'app en mode local lise les séances
    journalJours: Number(env.JOURNAL_RETENTION_DAYS || 90), // purge du journal au démarrage
    limiteParMinute: Number(env.RATE_LIMIT_PER_MIN || 120),
    // API de l'app (/api/app/*, docs/CONTRAT-VPS.md) : active seulement avec DB_FILE (SQLite).
    production: env.NODE_ENV === 'production',
    dbFile: env.DB_FILE || '',
    fichiersDir: resolve(env.FICHIERS_DIR || join(RACINE_SERVEUR, 'data', 'fichiers')),
    sessionSecret: env.SESSION_SECRET || '',
    appOrigin: env.APP_ORIGIN || '',
    resaUrl: (env.RESA_API_URL || 'http://127.0.0.1:5311').replace(/\/$/, ''),
    resaCle: env.RESA_ADMIN_KEY || '',
    proxyCle: env.PROXY_KEY || '' // X-Forwarded-For cru seulement si la requête porte X-Proxy-Cle = PROXY_KEY (ajouté par Caddy)
  }
}

/** En production, refuse de démarrer s'il manque une variable (liste des manquantes, jamais leurs valeurs). */
export function variablesManquantes(env = process.env) {
  if (env.NODE_ENV !== 'production') return []
  const manque = ['DB_FILE', 'FICHIERS_DIR', 'APP_ORIGIN', 'RESA_API_URL'].filter((k) => !env[k])
  for (const k of ['SESSION_SECRET', 'RESA_ADMIN_KEY', 'PROXY_KEY', 'COACH_API_KEY']) if (!env[k] || env[k].length < 32) manque.push(k)
  return manque
}
