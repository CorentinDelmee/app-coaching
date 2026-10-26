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
  const liste = (v, defaut) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : defaut)
  return {
    hote: '127.0.0.1', // jamais autre chose : le serveur n'écoute pas le réseau
    port: Number(env.PORT_API || 5405),
    cleApi: env.COACH_API_KEY || '',
    dossierDonnees: resolve(env.DATA_DIR || join(RACINE_SERVEUR, 'data')),
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseCleService: env.SUPABASE_SERVICE_KEY || '',
    youtubeCle: env.YOUTUBE_API_KEY || '',
    chainesReconnues: liste(env.YOUTUBE_CHAINES_RECONNUES, ['Tibo InShape', 'Julien Quaglierini', 'Hygiène & Musculation']),
    originesCors: liste(env.CORS_ORIGINS, ['http://localhost:5406', 'http://127.0.0.1:5406', 'http://localhost:5173']),
    syncDemo: env.DEMO_SYNC === '1', // expose /demo/etat (sans clé) pour que l'app en mode local lise les séances
    journalJours: Number(env.JOURNAL_RETENTION_DAYS || 90), // purge du journal au démarrage
    limiteParMinute: Number(env.RATE_LIMIT_PER_MIN || 120)
  }
}
