// Route publique /api/coach/* (exposée par Caddy) : les outils du coach pour Claude, à distance.
// GET /api/coach/sante · GET /api/coach/outils (liste + schémas JSON) · POST /api/coach/outils/<nom> (corps = arguments).
// Tout exige « Authorization: Bearer <COACH_API_KEY> » (temps constant). Les échecs sont comptés par IP réelle
// (X-Forwarded-For cru seulement avec X-Proxy-Cle) : 10 échecs / 15 min → 429 pour cette IP, même avec la bonne clé.
import { z } from 'zod'
import { appeler } from './outils.js'
import { cleValide, creerLimiteur } from './auth.js'
import { creerLimiteurEssais, ipReelle } from './app-http.js'

export const PREFIXE_COACH = '/api/coach/'
export const ACTEUR_COACH = 'api-coach'
const TAILLE_MAX = 1024 * 1024 // 1 Mo
const ECHECS_MAX = 10
const STATUT = { VALIDATION: 400, JSON_INVALIDE: 400, OUTIL_INCONNU: 404, CLIENT_INTROUVABLE: 404, SEANCE_INTROUVABLE: 404, BLOC_INTROUVABLE: 404, AMBIGU: 409, JETON_INVALIDE: 409, VIDEO_VALIDEE: 409,
  EXERCICE_INTROUVABLE: 404, PROGRAMME_INTROUVABLE: 404, QUESTIONNAIRE_INTROUVABLE: 404, INTROUVABLE: 404, CONSENTEMENT_SANTE: 403, CLIENT_ARCHIVE: 409, DOUBLON: 409, CLIENT_ARCHIVE: 409, DOUBLON: 409, REFUSE: 403, NON_DISPONIBLE: 503, RESERVATION_INDISPONIBLE: 503,
  CONFLIT: 409, EXISTE: 409, EXISTE_DEJA: 409, SEANCE_EXISTE: 409, EXERCICE_UTILISE: 409, PROGRAMME_AUTRE_CLIENT: 409, QUESTIONNAIRE_AUTRE_CLIENT: 409, SEANCE_AUTRE_CLIENT: 409, INTERNE: 500 }

class ErreurHttp extends Error {
  constructor(statut, code, message) { super(message); this.statut = statut; this.code = code }
}

function lireJson(req) {
  return new Promise((resolve, reject) => {
    let taille = 0
    const morceaux = []
    req.on('data', (c) => {
      taille += c.length
      if (taille > TAILLE_MAX) { morceaux.length = 0; reject(new ErreurHttp(413, 'TROP_GROS', 'Corps de requête trop gros (1 Mo maximum)')) } else morceaux.push(c)
    })
    req.on('end', () => {
      if (!morceaux.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(morceaux).toString('utf8'))) } catch { reject(new ErreurHttp(400, 'JSON_INVALIDE', 'JSON invalide')) }
    })
    req.on('error', reject)
  })
}

/** Schéma JSON d'entrée d'un outil (ce que Claude doit envoyer). Un schéma non représentable ne casse pas la liste. */
function schemaJson(schema) {
  try { return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) } catch { return { type: 'object' } }
}

/** Renvoie un gestionnaire (req, res) => Promise<boolean> : vrai si la requête concernait /api/coach/. */
export function creerCoachHttp(app, { now = () => Date.now() } = {}) {
  const { config, outils, journal } = app
  const echecs = creerLimiteurEssais(ECHECS_MAX) // 15 min
  const debit = creerLimiteur({ max: config.limiteParMinute, now }) // garde-fou général, par IP réelle

  const repondre = (res, statut, corps) => {
    res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(JSON.stringify(corps))
  }

  return async function traiter(req, res, chemin) {
    if (!chemin.startsWith(PREFIXE_COACH)) return false
    const ip = ipReelle(req, config.proxyCle)
    const t = now()
    try {
      if (echecs.bloque(ip, t)) throw new ErreurHttp(429, 'LIMITE', 'Trop d\'échecs d\'authentification : réessaie dans 15 minutes')
      if (!debit(ip)) throw new ErreurHttp(429, 'LIMITE', 'Trop de requêtes, réessaie dans une minute')
      if (!cleValide(req.headers.authorization, config.cleApi)) {
        echecs.compter(ip, t)
        journal.ecrire({ acteur: ACTEUR_COACH, outil: `${req.method} ${chemin}`.slice(0, 80), ok: false, erreur: `authentification refusée (ip ${ip})` })
        throw new ErreurHttp(401, 'NON_AUTORISE', 'Clé API absente ou invalide')
      }
      const route = chemin.slice(PREFIXE_COACH.length)
      if (req.method === 'GET' && route === 'sante') { repondre(res, 200, { ok: true, outils: Object.keys(outils).length }); return true }
      if (req.method === 'GET' && route === 'outils') {
        repondre(res, 200, Object.entries(outils).map(([nom, o]) => ({ nom, description: o.description, mutation: o.mutation, schema: schemaJson(o.schema) })))
        return true
      }
      const m = /^outils\/([a-z0-9_]{1,60})$/.exec(route)
      if (req.method === 'POST' && m) {
        const r = await appeler(app, m[1], await lireJson(req), ACTEUR_COACH)
        repondre(res, r.ok ? 200 : STATUT[r.code] ?? 400, r.ok ? r.donnees : { erreur: r.erreur, code: r.code })
        return true
      }
      throw new ErreurHttp(404, 'ROUTE_INCONNUE', 'Route inconnue')
    } catch (e) {
      // Corps trop gros : on répond 413 puis on coupe la connexion (on ne lit pas le reste du flux).
      if (e.code === 'TROP_GROS') res.once('finish', () => req.destroy())
      if (e instanceof ErreurHttp) repondre(res, e.statut, { erreur: e.message, code: e.code })
      else repondre(res, 500, { erreur: 'Erreur interne', code: 'INTERNE' })
      return true
    }
  }
}
