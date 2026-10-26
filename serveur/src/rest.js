// Façade API REST (HTTP, 127.0.0.1 uniquement). Refus par défaut : tout exige « Authorization: Bearer <COACH_API_KEY> ».
// Exceptions publiques : GET /api/sante, et GET /demo/etat seulement si DEMO_SYNC=1 (lecture seule, sans comptes).
import { createServer } from 'node:http'
import { z } from 'zod'
import { appeler } from './outils.js'
import { cleValide, creerLimiteur } from './auth.js'
import { ErreurService } from './service.js'

const TAILLE_MAX = 256 * 1024

function lireCorps(req) {
  return new Promise((resolve, reject) => {
    let taille = 0
    const morceaux = []
    req.on('data', (c) => {
      taille += c.length
      if (taille > TAILLE_MAX) { reject(new ErreurService('Corps de requête trop gros', 'TROP_GROS')) } else morceaux.push(c)
    })
    req.on('end', () => {
      if (!morceaux.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(morceaux).toString('utf8'))) } catch { reject(new ErreurService('JSON invalide', 'JSON_INVALIDE')) }
    })
    req.on('error', reject)
  })
}

// Routes « REST » qui s'appuient sur les outils (même validation, même journal).
const ROUTES = [
  ['GET', /^\/api\/clients$/, () => ['lister_clients', {}]],
  ['GET', /^\/api\/clients\/recherche$/, (m, q) => ['chercher_client', { nom: q.get('nom') ?? '' }]],
  ['GET', /^\/api\/seances$/, (m, q) => ['lister_seances', q.get('client') ? { client: q.get('client') } : {}]],
  ['POST', /^\/api\/seances$/, (m, q, corps) => ['creer_seance', corps]],
  ['POST', /^\/api\/seances\/([^/]+)\/exercices$/, (m, q, corps) => ['ajouter_exercice', { ...corps, seanceId: m[1] }]],
  ['PATCH', /^\/api\/seances\/([^/]+)$/, (m, q, corps) => ['modifier_seance', { ...corps, seanceId: m[1] }]],
  ['DELETE', /^\/api\/seances\/([^/]+)$/, (m, q) => ['supprimer_seance', { seanceId: m[1], ...(q.get('jeton') ? { jeton: q.get('jeton') } : {}) }]],
  ['GET', /^\/api\/agenda$/, (m, q) => ['consulter_agenda', Object.fromEntries([...q].filter(([k]) => ['client', 'du', 'au'].includes(k)))]],
  ['GET', /^\/api\/videos$/, (m, q) => ['chercher_video_exercice', { nom: q.get('nom') ?? '' }]],
  ['POST', /^\/api\/videos$/, (m, q, corps) => ['rattacher_video', corps]]
]
const STATUT_HTTP = { VALIDATION: 400, JSON_INVALIDE: 400, TROP_GROS: 413, OUTIL_INCONNU: 404, CLIENT_INTROUVABLE: 404, SEANCE_INTROUVABLE: 404, BLOC_INTROUVABLE: 404, CLIENT_AMBIGU: 409, JETON_INVALIDE: 409, VIDEO_VALIDEE: 409, INTERNE: 500 }

export function creerServeurRest(app, { now = () => Date.now() } = {}) {
  const { config, outils, journal, service, biblio } = app
  const limiteur = creerLimiteur({ max: config.limiteParMinute, now })
  const ACTEUR = 'rest'

  const repondre = (res, statut, corps, origine) => {
    res.writeHead(statut, {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      ...(origine ? { 'Access-Control-Allow-Origin': origine, Vary: 'Origin' } : {})
    })
    res.end(JSON.stringify(corps))
  }
  const sortieOutil = (res, r, origine) => repondre(res, r.ok ? 200 : STATUT_HTTP[r.code] ?? 400, r.ok ? r.donnees : { erreur: r.erreur, code: r.code }, origine)

  const serveur = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const chemin = url.pathname
    const o = req.headers.origin
    const origine = o && config.originesCors.includes(o) ? o : null
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(origine ? 204 : 403, origine ? { 'Access-Control-Allow-Origin': origine, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE', Vary: 'Origin' } : {})
        return res.end()
      }
      if (!limiteur(req.socket.remoteAddress)) return repondre(res, 429, { erreur: 'Trop de requêtes, réessaie dans une minute', code: 'LIMITE' }, origine)
      if (req.method === 'GET' && chemin === '/api/sante') return repondre(res, 200, { ok: true }, origine)
      if (req.method === 'GET' && chemin === '/demo/etat' && config.syncDemo) return repondre(res, 200, await service.etatPublicDemo(), origine)

      if (!cleValide(req.headers.authorization, config.cleApi)) {
        journal.ecrire({ acteur: ACTEUR, outil: `${req.method} ${chemin}`.slice(0, 80), ok: false, erreur: 'authentification refusée' })
        return repondre(res, 401, { erreur: 'Clé API absente ou invalide', code: 'NON_AUTORISE' }, origine)
      }

      if (req.method === 'GET' && chemin === '/api/outils') {
        return repondre(res, 200, Object.entries(outils).map(([nom, o2]) => ({ nom, description: o2.description, schema: z.toJSONSchema(o2.schema) })), origine)
      }
      const mOutil = /^\/api\/outils\/([a-z_]+)$/.exec(chemin)
      if (req.method === 'POST' && mOutil) return sortieOutil(res, await appeler(app, mOutil[1], await lireCorps(req), ACTEUR), origine)

      // Bibliothèque d'exercices : liste / validation / remplacement par le coach (écran du dashboard).
      if (req.method === 'GET' && chemin === '/api/bibliotheque') return repondre(res, 200, biblio.lister(), origine)
      const mBib = /^\/api\/bibliotheque\/([^/]+)\/(valider|remplacer)$/.exec(chemin)
      if (req.method === 'POST' && mBib) {
        const id = decodeURIComponent(mBib[1])
        try {
          let e
          if (mBib[2] === 'valider') e = await service.validerVideo(id)
          else {
            const corps = z.object({ url: z.string().url().max(300), titre: z.string().max(200).optional(), chaine: z.string().max(120).optional() }).strict().parse(await lireCorps(req))
            e = await service.remplacerVideo(id, corps)
          }
          journal.ecrire({ acteur: ACTEUR, outil: `bibliotheque.${mBib[2]}`, ok: true, resultat: { id } })
          return repondre(res, 200, e, origine)
        } catch (e) {
          journal.ecrire({ acteur: ACTEUR, outil: `bibliotheque.${mBib[2]}`, ok: false, erreur: String(e.message).slice(0, 200) })
          return repondre(res, e instanceof z.ZodError ? 400 : 404, { erreur: e instanceof z.ZodError ? 'Lien invalide' : e.message }, origine)
        }
      }

      for (const [methode, re, versOutil] of ROUTES) {
        const m = req.method === methode && re.exec(chemin)
        if (!m) continue
        const corps = methode === 'GET' || methode === 'DELETE' ? {} : await lireCorps(req)
        const [nom, args] = versOutil(m.map(decodeURIComponent), url.searchParams, corps)
        return sortieOutil(res, await appeler(app, nom, args, ACTEUR), origine)
      }
      repondre(res, 404, { erreur: 'Route inconnue', code: 'ROUTE_INCONNUE' }, origine)
    } catch (e) {
      repondre(res, STATUT_HTTP[e.code] ?? 500, { erreur: e instanceof ErreurService ? e.message : 'Erreur interne', code: e.code || 'INTERNE' }, origine)
    }
  })
  return serveur
}
