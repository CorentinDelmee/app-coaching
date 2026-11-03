// API de l'app (navigateur) : /api/app/*. Session par cookie signé, règles d'accès = policies RLS de supabase/schema.sql.
// Contrat : docs/CONTRAT-VPS.md (« Formes JSON exactes » fait foi). Magasin : SQLite (magasin-sqlite.js).
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { ENTITES, clientDe, visiblePar } from '../../src/data/entites.js'
import { LONGUEUR_CODE_MIN } from '../../src/domain/identifiants.js'

const SESSION_MS = 12 * 3600e3
const JSON_MAX = 1024 * 1024
const FICHIER_MAX = 5 * 1024 * 1024
const RE_IDENTIFIANT = /^[a-z0-9][a-z0-9._-]{1,39}$/

// ---------- Mots de passe (scrypt « sel:hash ») et session signée ----------
const scryptAsync = (pw, sel) => new Promise((ok, ko) => scrypt(pw, sel, 64, (e, k) => (e ? ko(e) : ok(k))))
export async function hacherCode(code, sel = randomBytes(16).toString('hex')) {
  return `${sel}:${(await scryptAsync(code, sel)).toString('hex')}`
}
export async function verifierCode(code, stocke) {
  const [sel, hash] = String(stocke || '').split(':')
  if (!sel || !hash) return false
  const test = await scryptAsync(code, sel)
  const ref = Buffer.from(hash, 'hex')
  return ref.length === test.length && timingSafeEqual(ref, test)
}
// Cookie sans état : « identifiant.sv.expiration.signature » (HMAC-SHA256). sv permet de révoquer.
export function signerSession(identifiant, sv, secret, now = Date.now()) {
  const corps = `${identifiant}.${sv}.${now + SESSION_MS}`
  return `${corps}.${createHmac('sha256', secret).update(corps).digest('base64url')}`
}
export function lireSession(valeur, secret, now = Date.now()) {
  const p = String(valeur || '').split('.')
  if (p.length < 4) return null
  const sig = p.pop(), exp = p.pop(), sv = p.pop(), identifiant = p.join('.')
  const bonne = createHmac('sha256', secret).update(`${identifiant}.${sv}.${exp}`).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(bonne)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!(Number(exp) >= now)) return null
  return { identifiant, sv: Number(sv) }
}

// Limiteur glissant en mémoire (connexion : essais ratés et réussis comptés d'avance).
export function creerLimiteurEssais(max, fenetreMs = 15 * 60e3) {
  const essais = new Map()
  const frais = (k, t) => (essais.get(k) || []).filter((x) => t - x < fenetreMs)
  return {
    bloque: (k, t) => frais(k, t).length >= max,
    compter: (k, t) => { essais.set(k, [...frais(k, t), t]); if (essais.size > 10000) essais.clear() },
    effacer: (k) => essais.delete(k)
  }
}

/** IP réelle : dernière valeur de X-Forwarded-For (posée par Caddy) seulement si on fait confiance au proxy. */
export function ipReelle(req, confianceProxy) {
  const xff = req.headers['x-forwarded-for']
  if (confianceProxy && xff) {
    const v = String(xff).split(',').map((s) => s.trim()).filter(Boolean).pop()
    if (v) return v
  }
  return req.socket.remoteAddress || ''
}

// Écriture par un client (policies RLS) : seulement ces entités, et seulement ses lignes.
const ECRITURE_CLIENT = new Set(['realisations', 'templates', 'reponses', 'mesures', 'douleurs', 'nutrition'])
const CHAMPS_PROTEGES = ['role', 'tarif', 'modules', 'identifiant', 'archive', 'creeLe']
const COACH_SEUL = new Set(['alertesVues'])
const TYPES_FICHIER = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'application/pdf': ['pdf'] }
const TYPE_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' }

/** Le contenu correspond-il vraiment au type annoncé ? (signature des premiers octets) */
export function signatureOk(type, buf) {
  if (type === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  if (type === 'image/png') return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (type === 'image/webp') return buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP'
  if (type === 'application/pdf') return buf.subarray(0, 5).toString('latin1') === '%PDF-'
  return false
}

/** « <client_id>/<nom>.<ext> » normalisé, sans « .. » ni barre initiale ; null sinon. */
export function cheminFichier(brut) {
  const c = String(brut ?? '')
  const m = /^([A-Za-z0-9-]{1,64})\/([A-Za-z0-9_-]{1,80})\.(jpg|jpeg|png|webp|pdf)$/.exec(c)
  if (!m || posix.normalize(c) !== c) return null
  return { proprietaire: m[1], ext: m[3], relatif: c }
}

// Relais réservations : routes autorisées seulement (méthode + chemin après /api/app/reservations).
const ROUTES_RESA = [
  ['GET', /^$/], ['POST', /^\/[A-Za-z0-9_-]{1,80}\/annuler$/],
  ['GET', /^\/blocages$/], ['POST', /^\/blocages$/], ['DELETE', /^\/blocages\/[A-Za-z0-9_-]{1,80}$/],
  ['GET', /^\/regles$/], ['PUT', /^\/regles$/]
]

class Erreur extends Error { constructor(statut, code) { super(code); this.statut = statut; this.code = code } }

function lireBrut(req, max) {
  return new Promise((resolve, reject) => {
    let taille = 0
    const morceaux = []
    req.on('data', (c) => {
      taille += c.length
      if (taille > max) { morceaux.length = 0; reject(new Erreur(413, 'trop_gros')) } else morceaux.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(morceaux)))
    req.on('error', reject)
  })
}
async function lireJson(req) {
  const b = await lireBrut(req, JSON_MAX)
  if (!b.length) return {}
  try { return JSON.parse(b.toString('utf8')) } catch { throw new Erreur(400, 'json_invalide') }
}

/**
 * Crée le gestionnaire des routes /api/app/*. Retourne (req, res) => Promise<boolean> (vrai si la route est traitée).
 * config : { production, sessionSecret, appOrigin, resaUrl, resaCle, fichiersDir, confianceProxy }
 */
export function creerAppHttp({ db, store, config, now = () => Date.now(), fetchFn = (...a) => globalThis.fetch(...a) }) {
  if (!config.sessionSecret || config.sessionSecret.length < 32) throw new Error('SESSION_SECRET manquant ou trop court (32 caractères minimum)')
  const secure = !!config.production
  const optsCookie = `HttpOnly; SameSite=Strict; Path=/${secure ? '; Secure' : ''}`
  const parIp = creerLimiteurEssais(20), parCompte = creerLimiteurEssais(10), parCouple = creerLimiteurEssais(5)
  const debitIp = creerLimiteurEssais(600, 60e3) // garde-fou général par IP réelle (pas celle de Caddy)
  const compte = (identifiant) => db.prepare('SELECT * FROM comptes WHERE identifiant = ?').get(identifiant)
  const utilisateurPublic = (c) => ({ id: c.profil_id, identifiant: c.identifiant, role: c.role, profil_id: c.profil_id })

  function envoyer(res, statut, corps, enTetes = {}) {
    res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...enTetes })
    res.end(JSON.stringify(corps))
  }
  const cookieSession = (c) => `sid=${encodeURIComponent(signerSession(c.identifiant, c.sv, config.sessionSecret, now()))}; Max-Age=${SESSION_MS / 1000}; ${optsCookie}`

  // Utilisateur de la requête : cookie valide, compte actif, version de session à jour, profil non archivé.
  async function utilisateurDe(req) {
    const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '')
    if (!m) return null
    let v
    try { v = decodeURIComponent(m[1]) } catch { return null }
    const s = lireSession(v, config.sessionSecret, now())
    const c = s && compte(s.identifiant)
    if (!c || c.sv !== s.sv || c.archive) return null
    const p = await store.un('profils', c.profil_id)
    if (!p || p.archive) return null
    return { ...utilisateurPublic(c), compte: c }
  }

  async function connexion(req, res, ip) {
    const corps = await lireJson(req)
    const identifiant = String(corps.identifiant ?? '').toLowerCase().trim().slice(0, 50)
    const t = now()
    const cles = [[parIp, ip], [parCompte, identifiant], [parCouple, `${ip}|${identifiant}`]]
    if (cles.some(([l, k]) => l.bloque(k, t))) return envoyer(res, 429, { erreur: 'trop_d_essais' })
    cles.forEach(([l, k]) => l.compter(k, t)) // compté AVANT le hachage : des essais en parallèle ne passent pas sous le plafond
    const c = RE_IDENTIFIANT.test(identifiant) ? compte(identifiant) : null
    const ok = (await verifierCode(String(corps.code ?? '').slice(0, 200), c?.hash || 'x:y')) && c && !c.archive
    const p = ok ? await store.un('profils', c.profil_id) : null
    if (!ok || !p || p.archive) return envoyer(res, 401, { erreur: 'identifiants' })
    parCouple.effacer(`${ip}|${identifiant}`)
    envoyer(res, 200, { utilisateur: utilisateurPublic(c) }, { 'Set-Cookie': cookieSession(c) })
  }

  // ---------- Entités ----------
  const egal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  function lisible(entite, obj, u) {
    if (u.role === 'coach') return true
    if (COACH_SEUL.has(entite)) return false
    return visiblePar(entite, obj, { id: u.profil_id, role: u.role })
  }
  async function entites(req, res, u, entite, id) {
    if (!Object.hasOwn(ENTITES, entite)) throw new Erreur(404, 'entite_inconnue')
    const coach = u.role === 'coach'
    if (!coach && COACH_SEUL.has(entite)) throw new Erreur(403, 'interdit')
    if (req.method === 'GET' && id === undefined) {
      return envoyer(res, 200, { items: (await store.tout(entite)).filter((o) => lisible(entite, o, u)) })
    }
    if (id === undefined) throw new Erreur(404, 'route_inconnue')
    const existant = await store.un(entite, id)
    if (req.method === 'GET') {
      if (!existant || !lisible(entite, existant, u)) throw new Erreur(404, 'introuvable')
      return envoyer(res, 200, { item: existant })
    }
    if (req.method === 'PUT') {
      const obj = await lireJson(req)
      if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.id !== id) throw new Erreur(400, 'invalide')
      if (!ENTITES[entite].valider(obj).ok) throw new Erreur(400, 'invalide')
      if (!coach) {
        if (entite === 'profils') {
          // Un client modifie seulement son profil, sans toucher aux champs sensibles.
          if (id !== u.profil_id || !existant) throw new Erreur(403, 'interdit')
          if (CHAMPS_PROTEGES.some((k) => !egal(obj[k], existant[k]))) throw new Erreur(403, 'champ_protege')
        } else {
          if (!ECRITURE_CLIENT.has(entite)) throw new Erreur(403, 'interdit')
          if (clientDe(entite, obj) !== u.profil_id) throw new Erreur(403, 'interdit')
          if (existant && clientDe(entite, existant) !== u.profil_id) throw new Erreur(403, 'interdit')
        }
      } else if (entite === 'profils' && existant && obj.identifiant !== existant.identifiant) {
        throw new Erreur(400, 'identifiant_non_modifiable') // le compte de connexion porte l'identifiant
      }
      try { await store.ecrire(entite, obj) } catch { throw new Erreur(400, 'invalide') } // ex. client_id inexistant
      return envoyer(res, 200, { item: obj })
    }
    if (req.method === 'DELETE') {
      if (!existant) throw new Erreur(404, 'introuvable')
      if (!coach && (!ECRITURE_CLIENT.has(entite) || clientDe(entite, existant) !== u.profil_id)) throw new Erreur(403, 'interdit')
      await store.supprimer(entite, id)
      return envoyer(res, 200, { ok: true })
    }
    throw new Erreur(405, 'methode')
  }

  // ---------- Relais réservations (coach) ----------
  async function relaisResa(req, res, reste, url) {
    const route = ROUTES_RESA.find(([m, re]) => m === req.method && re.test(reste))
    if (!route) throw new Erreur(404, 'route_inconnue')
    const cible = reste === '' || /\/annuler$/.test(reste) ? `/reservations${reste}` : reste
    const corps = req.method === 'GET' || req.method === 'DELETE' ? undefined : JSON.stringify(await lireJson(req))
    const qs = reste === '' && url.searchParams.get('statut') ? `?statut=${encodeURIComponent(url.searchParams.get('statut'))}` : ''
    let r, texte
    try {
      // En-têtes construits de zéro : jamais d'X-Forwarded-For / Forwarded / X-Real-IP ni de cookie transmis.
      r = await fetchFn(`${config.resaUrl}/api/resa/admin${cible}${qs}`, {
        method: req.method, body: corps, signal: AbortSignal.timeout(8000),
        headers: { 'X-Resa-Admin-Key': config.resaCle, ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}) }
      })
      texte = await r.text()
    } catch { throw new Erreur(502, 'reservation_indisponible') }
    if (r.status >= 500) throw new Erreur(502, 'reservation_indisponible')
    res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(texte) // corps renvoyé tel quel (formes du contrat)
  }

  // ---------- Fichiers ----------
  async function fichiers(req, res, u, url) {
    const f = cheminFichier(url.searchParams.get('chemin'))
    if (!f) throw new Erreur(400, 'chemin_invalide')
    if (u.role !== 'coach' && f.proprietaire !== u.profil_id) throw new Erreur(403, 'interdit')
    const disque = join(config.fichiersDir, f.proprietaire, f.relatif.split('/')[1])
    if (req.method === 'POST') {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      if (!TYPES_FICHIER[type]?.includes(f.ext)) throw new Erreur(415, 'type_refuse')
      const buf = await lireBrut(req, FICHIER_MAX)
      if (!signatureOk(type, buf)) throw new Erreur(415, 'type_refuse')
      mkdirSync(join(config.fichiersDir, f.proprietaire), { recursive: true })
      writeFileSync(disque, buf)
      return envoyer(res, 201, { ok: true })
    }
    let existe = false
    try { existe = statSync(disque).isFile() } catch { /* absent */ }
    if (!existe) throw new Erreur(404, 'introuvable')
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': TYPE_EXT[f.ext], 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" })
      return res.end(readFileSync(disque))
    }
    if (req.method === 'DELETE') { rmSync(disque); return envoyer(res, 200, { ok: true }) }
    throw new Erreur(405, 'methode')
  }

  // ---------- Agenda (lu en base, rempli par la synchro du soir) ----------
  function agenda(req, res, u, quoi) {
    if (req.method === 'GET' && quoi === 'evenements') {
      const lignes = u.role === 'coach'
        ? db.prepare('SELECT data FROM seances_agenda').all()
        : db.prepare('SELECT data FROM seances_agenda WHERE client_id = ?').all(u.profil_id)
      return envoyer(res, 200, { evenements: lignes.map((l) => JSON.parse(l.data)) })
    }
    if (req.method === 'GET' && quoi === 'derniere-synchro') {
      const d = db.prepare('SELECT derniere_synchro FROM agenda_synchro WHERE id = 1').get()?.derniere_synchro
      return envoyer(res, 200, { derniereSynchro: d ? new Date(Number(d)).toISOString() : null })
    }
    if (req.method === 'POST' && quoi === 'synchroniser') return envoyer(res, 202, { message: 'La synchronisation se fait chaque soir à 20 h.' })
    throw new Erreur(404, 'route_inconnue')
  }

  return async function traiter(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1')
    const chemin = url.pathname
    if (!chemin.startsWith('/api/app/')) return false
    const route = chemin.slice('/api/app'.length)
    const ip = ipReelle(req, config.confianceProxy)
    try {
      if (debitIp.bloque(ip, now())) throw new Erreur(429, 'trop_de_requetes')
      debitIp.compter(ip, now())
      // CSRF : toute requête non-GET doit venir de l'app (Origin exact), en plus de SameSite=Strict.
      if (req.method !== 'GET' && req.method !== 'HEAD' && (!config.appOrigin || req.headers.origin !== config.appOrigin)) throw new Erreur(403, 'origine_refusee')
      if (req.method === 'POST' && route === '/connexion') { await connexion(req, res, ip); return true }
      if (req.method === 'POST' && route === '/deconnexion') {
        const u = await utilisateurDe(req)
        if (u) db.prepare('UPDATE comptes SET sv = sv + 1 WHERE identifiant = ?').run(u.identifiant) // révoque aussi un cookie copié
        envoyer(res, 200, { ok: true }, { 'Set-Cookie': `sid=; Max-Age=0; ${optsCookie}` })
        return true
      }
      const u = await utilisateurDe(req)
      if (!u) throw new Erreur(401, 'non_connecte')
      const coach = u.role === 'coach'
      if (req.method === 'GET' && route === '/moi') { const { compte: _c, ...pub } = u; envoyer(res, 200, { utilisateur: pub }); return true }
      if (req.method === 'POST' && route === '/code') {
        const { ancien, nouveau } = await lireJson(req)
        if (typeof nouveau !== 'string' || nouveau.length < LONGUEUR_CODE_MIN || nouveau.length > 200) throw new Erreur(400, 'code_trop_court')
        if (!(await verifierCode(String(ancien ?? '').slice(0, 200), u.compte.hash))) throw new Erreur(403, 'ancien_code_faux')
        db.prepare('UPDATE comptes SET hash = ?, sv = sv + 1 WHERE identifiant = ?').run(await hacherCode(nouveau), u.identifiant)
        envoyer(res, 200, { ok: true }, { 'Set-Cookie': cookieSession(compte(u.identifiant)) }) // les autres sessions sont révoquées
        return true
      }
      if (req.method === 'POST' && route === '/comptes') {
        if (!coach) throw new Erreur(403, 'interdit')
        const { identifiant, code, profil } = await lireJson(req)
        if (!RE_IDENTIFIANT.test(String(identifiant)) || typeof code !== 'string' || code.length < LONGUEUR_CODE_MIN || code.length > 200) throw new Erreur(400, 'invalide')
        if (!profil || profil.identifiant !== identifiant || !ENTITES.profils.valider(profil).ok) throw new Erreur(400, 'invalide')
        if (compte(identifiant) || (await store.un('profils', profil.id))) throw new Erreur(409, 'existe_deja')
        const hash = await hacherCode(code)
        try { await store.ecrire('profils', profil) } catch { throw new Erreur(409, 'existe_deja') }
        db.prepare('INSERT INTO comptes (identifiant, hash, role, profil_id) VALUES (?, ?, ?, ?)').run(identifiant, hash, profil.role, profil.id)
        envoyer(res, 201, { id: profil.id })
        return true
      }
      const mCode = /^\/comptes\/([^/]+)\/code$/.exec(route)
      if (req.method === 'POST' && mCode) {
        if (!coach) throw new Erreur(403, 'interdit')
        const cible = compte(decodeURIComponent(mCode[1]).toLowerCase())
        const { code } = await lireJson(req)
        if (!cible) throw new Erreur(404, 'introuvable')
        if (typeof code !== 'string' || code.length < LONGUEUR_CODE_MIN || code.length > 200) throw new Erreur(400, 'code_trop_court')
        db.prepare('UPDATE comptes SET hash = ?, sv = sv + 1 WHERE identifiant = ?').run(await hacherCode(code), cible.identifiant)
        envoyer(res, 200, { ok: true })
        return true
      }
      const mE = /^\/e\/([^/]+)(?:\/([^/]+))?$/.exec(route)
      if (mE) { await entites(req, res, u, decodeURIComponent(mE[1]), mE[2] === undefined ? undefined : decodeURIComponent(mE[2])); return true }
      if (route === '/fichiers') { await fichiers(req, res, u, url); return true }
      const mA = /^\/agenda\/([a-z-]+)$/.exec(route)
      if (mA) { agenda(req, res, u, mA[1]); return true }
      if (route === '/reservations' || route.startsWith('/reservations/')) {
        if (!coach) throw new Erreur(403, 'interdit')
        await relaisResa(req, res, route.slice('/reservations'.length), url)
        return true
      }
      throw new Erreur(404, 'route_inconnue')
    } catch (e) {
      // Corps trop gros : réponse 413 avec « Connection: close » (le client ne réutilise pas la connexion), puis coupure.
      if (e?.code === 'trop_gros') { res.once('finish', () => req.destroy()); return envoyer(res, 413, { erreur: e.code }, { Connection: 'close' }), true }
      if (e instanceof Erreur) envoyer(res, e.statut, { erreur: e.code })
      else envoyer(res, 500, { erreur: 'interne' })
      return true
    }
  }
}
