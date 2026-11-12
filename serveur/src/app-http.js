// API de l'app (navigateur) : /api/app/*. Session par cookie signé, règles d'accès = policies RLS de supabase/schema.sql.
// Contrat : docs/CONTRAT-VPS.md (« Formes JSON exactes » fait foi). Magasin : SQLite (magasin-sqlite.js).
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, sep } from 'node:path'
import { ENTITES, clientDe, visiblePar } from '../../src/data/entites.js'
import { accesSante } from '../../src/domain/consentement.js'
import { LONGUEUR_CODE_MIN } from '../../src/domain/identifiants.js'
import { idYoutube } from '../../src/domain/video.js'
import { CHAMPS_COACH, NIVEAUX, appliquerPatch, filtrer, indexUsage, nettoyerPut, presenter, schemaCreation, schemaPatch } from './exercices.js'
import { slug } from './util.js'
import { versionDe } from '../../src/data/versions.js'
import { creerSynchroAgenda } from './agenda-synchro.js'

const SESSION_MS = 12 * 3600e3
// « Rester connecté » (coché par défaut, demande de Corentin du 2026-11-07) : 30 jours, prolongés à chaque usage
// (au plus une fois par jour) ; la session n'expire qu'après 30 jours sans ouvrir l'app. Révocable par sv comme avant.
export const SESSION_LONGUE_MS = 30 * 864e5
const RENOUVELER_APRES_MS = 864e5
const JSON_MAX = 1024 * 1024
const FICHIER_MAX = 5 * 1024 * 1024
const PHOTO_MAX = 3 * 1024 * 1024 // photos d'exercices (l'écran réduit avant l'envoi)
const PHOTO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const RE_PHOTO_ID = /^p-[0-9a-f]{12}$/
// Photos d'exercices : dossier public « _exercices ». Le « _ » est impossible dans un UUID de profil : aucun dossier privé ne peut le porter (audit M5).
const DOSSIER_PHOTOS = '_exercices'
const IDS_PROFIL_RESERVES = new Set(['exercices', DOSSIER_PHOTOS])

const RE_PHOTO_FICHIER = /^p-[0-9a-f]{12}\.(jpg|png|webp)$/
const estLien = (chemin) => { try { return lstatSync(chemin).isSymbolicLink() } catch { return false } }

/**
 * Migration (idempotente, relançable) : l'ancien dossier public « exercices » devient « _exercices », et les URL de photos suivent.
 * Seuls les fichiers p-<hex12>.(jpg|png|webp) sont déplacés, un par un, sans jamais écraser ; une URL est réécrite dès que son fichier est en place.
 * Un dossier qui est un lien symbolique n'est jamais touché. Chaque problème est journalisé, le reste continue.
 */
export async function migrerPhotos({ store, fichiersDir, log = (...a) => console.error('[migrerPhotos]', ...a) }) {
  const ancien = join(fichiersDir, 'exercices'), nouveau = join(fichiersDir, DOSSIER_PHOTOS)
  if (estLien(nouveau)) { log('« _exercices » est un lien symbolique : migration ignorée'); return }
  if (existsSync(ancien)) {
    if (estLien(ancien)) log('« exercices » est un lien symbolique : ignoré')
    else {
      try {
        mkdirSync(nouveau, { recursive: true })
        for (const f of readdirSync(ancien)) {
          try {
            if (!RE_PHOTO_FICHIER.test(f) || !lstatSync(join(ancien, f)).isFile()) { log(`fichier ignoré (pas une photo) : ${f}`); continue }
            if (existsSync(join(nouveau, f))) { log(`fichier déjà présent dans _exercices, non écrasé : ${f}`); continue }
            renameSync(join(ancien, f), join(nouveau, f))
          } catch (e) { log(`déplacement impossible : ${f}`, e.message) }
        }
        try { rmdirSync(ancien) } catch { /* non vide : on laisse ce qui reste */ }
      } catch (e) { log('dossier non migré', e.message) }
    }
  }
  for (const ex of await store.tout('exercices')) {
    const url = ex.photo?.url
    if (typeof url !== 'string' || !url.includes('chemin=exercices%2F')) continue
    try {
      const nom = decodeURIComponent(url.split('chemin=exercices%2F')[1] ?? '')
      if (!RE_PHOTO_FICHIER.test(nom) || !existsSync(join(nouveau, nom))) { log(`URL non réécrite (fichier absent de _exercices) : ${ex.id}`); continue }
      await store.ecrire('exercices', { ...ex, photo: { ...ex.photo, url: url.replace('chemin=exercices%2F', `chemin=${DOSSIER_PHOTOS}%2F`) } })
    } catch (e) { log(`URL non réécrite : ${ex.id}`, e.message) }
  }
}
const RE_IDENTIFIANT = /^[a-z0-9][a-z0-9._-]{1,39}$/
// Plafonds par client (un compte client compromis ne remplit pas le disque). Le coach n'a que la limite par ligne.
export const QUOTAS = { lignes: 5000, octetsLigne: 64 * 1024, fichiers: 200, octetsFichiers: 200 * 1024 * 1024 }

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
// Session longue : expiration préfixée de « L » (signée comme le reste ; les anciens cookies restent valides).
export function signerSession(identifiant, sv, secret, now = Date.now(), longue = false) {
  const corps = `${identifiant}.${sv}.${longue ? `L${now + SESSION_LONGUE_MS}` : now + SESSION_MS}`
  return `${corps}.${createHmac('sha256', secret).update(corps).digest('base64url')}`
}
export function lireSession(valeur, secret, now = Date.now()) {
  const p = String(valeur || '').split('.')
  if (p.length < 4) return null
  const sig = p.pop(), exp = p.pop(), sv = p.pop(), identifiant = p.join('.')
  const bonne = createHmac('sha256', secret).update(`${identifiant}.${sv}.${exp}`).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(bonne)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const longue = exp.startsWith('L')
  const fin = Number(longue ? exp.slice(1) : exp)
  if (!(fin >= now)) return null
  return { identifiant, sv: Number(sv), longue, fin }
}

// Limiteur glissant en mémoire (connexion : essais ratés et réussis comptés d'avance).
export function creerLimiteurEssais(max, fenetreMs = 15 * 60e3) {
  const essais = new Map()
  const frais = (k, t) => (essais.get(k) || []).filter((x) => t - x < fenetreMs)
  // Purge des clés sans essai récent (au lieu de tout vider : un attaquant ne remet pas les compteurs à zéro).
  const purger = (t) => { for (const k of [...essais.keys()]) { const f = frais(k, t); if (f.length) essais.set(k, f); else essais.delete(k) } }
  return {
    bloque: (k, t) => frais(k, t).length >= max,
    compter: (k, t) => { essais.set(k, [...frais(k, t), t]); if (essais.size > 10000) purger(t) },
    annuler: (k) => { const a = essais.get(k); if (a?.length > 1) essais.set(k, a.slice(0, -1)); else essais.delete(k) },
    effacer: (k) => essais.delete(k),
    taille: () => essais.size,
    purger
  }
}

const empreinte = (v) => createHash('sha256').update(String(v)).digest()
/** La requête vient-elle de Caddy ? En-tête X-Proxy-Cle = PROXY_KEY (≥ 32 car.), comparé en temps constant. */
export function vientDuProxy(req, proxyCle) {
  const v = req.headers['x-proxy-cle']
  if (!proxyCle || proxyCle.length < 32 || typeof v !== 'string') return false
  return timingSafeEqual(empreinte(v), empreinte(proxyCle))
}
/** IP réelle : dernière valeur de X-Forwarded-For seulement si la requête porte la clé du proxy ; sinon l'adresse de connexion. */
export function ipReelle(req, proxyCle) {
  const xff = req.headers['x-forwarded-for']
  if (xff && vientDuProxy(req, proxyCle)) {
    const v = String(xff).split(',').map((s) => s.trim()).filter(Boolean).pop()
    if (v) return v
  }
  return req.socket.remoteAddress || ''
}

// Écriture par un client (policies RLS) : seulement ces entités, et seulement ses lignes.
const ECRITURE_CLIENT = new Set(['realisations', 'templates', 'reponses', 'mesures', 'douleurs', 'nutrition'])
// Entités de santé : un client sans consentement santé n'y écrit pas (supprimer ses données reste permis).
const ENTITES_SANTE = new Set(['reponses', 'mesures', 'douleurs', 'nutrition'])
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
  const m = /^(_exercices|[A-Za-z0-9-]{1,64})\/([A-Za-z0-9_-]{1,80})\.(jpg|jpeg|png|webp|pdf)$/.exec(c)
  if (!m || posix.normalize(c) !== c) return null
  return { proprietaire: m[1], ext: m[3], relatif: c }
}

// Relais réservations : routes autorisées seulement (méthode + chemin après /api/app/reservations).
const ROUTES_RESA = [
  ['GET', /^$/], ['POST', /^\/[A-Za-z0-9_-]{1,80}\/annuler$/],
  ['GET', /^\/blocages$/], ['POST', /^\/blocages$/], ['DELETE', /^\/blocages\/[A-Za-z0-9_-]{1,80}$/],
  ['GET', /^\/regles$/], ['PUT', /^\/regles$/]
]

// Corps JSON : seulement un objet (null, tableau ou valeur simple -> 400).
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
class Erreur extends Error { constructor(statut, code, extra) { super(code); this.statut = statut; this.code = code; this.extra = extra } }

/** Version attendue par l'écran (en-tête If-Match : 3, "3" ou W/"3", rien d'autre) ; absente = pas de contrôle (anciens clients, outils). */
function versionAttendue(req) {
  const v = req.headers['if-match']
  if (v === undefined) return undefined
  const m = /^(?:W\/"([1-9]\d{0,8})"|"([1-9]\d{0,8})"|([1-9]\d{0,8}))$/.exec(String(v))
  if (!m) throw new Erreur(400, 'invalide')
  return Number(m[1] ?? m[2] ?? m[3])
}
const estConflit = (e) => e?.name === 'ErreurData' && e.code === 'CONFLIT'

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
  let v
  try { v = JSON.parse(b.toString('utf8')) } catch { throw new Erreur(400, 'json_invalide') }
  if (!estObjet(v)) throw new Erreur(400, 'json_invalide')
  return v
}

/**
 * Crée le gestionnaire des routes /api/app/*. Retourne (req, res) => Promise<boolean> (vrai si la route est traitée).
 * config : { production, sessionSecret, appOrigin, resaUrl, resaCle, fichiersDir, confianceProxy }
 */
export function creerAppHttp({ db, store, config, journal = null, biblio = null, now = () => Date.now(), fetchFn = (...a) => globalThis.fetch(...a), agendaSynchro = null }) {
  const synchroAgenda = agendaSynchro ?? creerSynchroAgenda({ db, config, fetchFn, now })
  if (!config.sessionSecret || config.sessionSecret.length < 32) throw new Error('SESSION_SECRET manquant ou trop court (32 caractères minimum)')
  const secure = !!config.production
  const optsCookie = `HttpOnly; SameSite=Strict; Path=/${secure ? '; Secure' : ''}`
  const migration = migrerPhotos({ store, fichiersDir: config.fichiersDir }).catch((e) => console.error('[migrerPhotos]', e.message)) // les routes d'exercices et de fichiers l'attendent
  const NOM_COOKIE = secure ? '__Host-sid' : 'sid' // __Host- : Secure, Path=/, sans Domain (non posable par un sous-domaine)
  const RE_COOKIE = new RegExp(`(?:^|;\\s*)${NOM_COOKIE}=([^;]+)`)
  // Connexion : seuls les ÉCHECS comptent. IP+compte 5 / 15 min ; compte seul 50 (un tiers ne verrouille pas le compte) ; IP seule 30.
  const parIp = creerLimiteurEssais(30), parCompte = creerLimiteurEssais(50), parCouple = creerLimiteurEssais(5)
  // IP « connues » d'un compte (connexion réussie < 30 jours) : le plafond par compte seul ne s'y applique pas,
  // sinon un attaquant distribué bloquerait le coach en boucle. IP stockée en empreinte HMAC, jamais en clair.
  db.exec('CREATE TABLE IF NOT EXISTS ips_connues (identifiant TEXT NOT NULL, ip TEXT NOT NULL, vu_le INTEGER NOT NULL, PRIMARY KEY (identifiant, ip))')
  const empreinteIp = (ip) => createHmac('sha256', config.sessionSecret).update(`ip:${ip}`).digest('hex').slice(0, 32)
  const ipConnue = (id, ip) => !!db.prepare('SELECT 1 FROM ips_connues WHERE identifiant = ? AND ip = ? AND vu_le > ?').get(id, empreinteIp(ip), now() - 30 * 864e5)
  const retenirIp = (id, ip) => {
    db.prepare('INSERT INTO ips_connues (identifiant, ip, vu_le) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET vu_le = excluded.vu_le').run(id, empreinteIp(ip), now())
    db.prepare('DELETE FROM ips_connues WHERE vu_le <= ?').run(now() - 30 * 864e5)
  }
  const empreinteCompte = (id) => createHmac('sha256', config.sessionSecret).update(`compte:${id}`).digest('hex').slice(0, 12)
  const debitIp = creerLimiteurEssais(600, 60e3) // garde-fou général par IP réelle (pas celle de Caddy)
  const compte = (identifiant) => db.prepare('SELECT * FROM comptes WHERE identifiant = ?').get(identifiant)
  const utilisateurPublic = (c) => ({ id: c.profil_id, identifiant: c.identifiant, role: c.role, profil_id: c.profil_id })

  function envoyer(res, statut, corps, enTetes = {}) {
    res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...enTetes })
    res.end(JSON.stringify(corps))
  }
  // Session courte : cookie de navigateur (sans Max-Age, effacé à la fermeture) qui expire aussi côté serveur après 12 h.
  const cookieSession = (c, longue = false) => `${NOM_COOKIE}=${encodeURIComponent(signerSession(c.identifiant, c.sv, config.sessionSecret, now(), longue))}; ${longue ? `Max-Age=${SESSION_LONGUE_MS / 1000}; ` : ''}${optsCookie}`

  // Utilisateur de la requête : cookie valide, compte actif, version de session à jour, profil non archivé.
  async function utilisateurDe(req) {
    const m = RE_COOKIE.exec(req.headers.cookie || '')
    if (!m) return null
    let v
    try { v = decodeURIComponent(m[1]) } catch { return null }
    const s = lireSession(v, config.sessionSecret, now())
    const c = s && compte(s.identifiant)
    if (!c || c.sv !== s.sv || c.archive) return null
    const p = await store.un('profils', c.profil_id)
    if (!p || p.archive) return null
    return { ...utilisateurPublic(c), compte: c, session: s }
  }

  async function connexion(req, res, ip) {
    const corps = await lireJson(req)
    const identifiant = String(corps.identifiant ?? '').toLowerCase().trim().slice(0, 50)
    const t = now()
    const connue = RE_IDENTIFIANT.test(identifiant) && ipConnue(identifiant, ip)
    const cles = connue ? [[parCouple, `${ip}|${identifiant}`]] : [[parIp, ip], [parCompte, identifiant], [parCouple, `${ip}|${identifiant}`]]
    if (cles.some(([l, k]) => l.bloque(k, t))) return envoyer(res, 429, { erreur: 'trop_d_essais' })
    cles.forEach(([l, k]) => l.compter(k, t)) // compté AVANT le hachage (essais parallèles), annulé si la connexion réussit
    const c = RE_IDENTIFIANT.test(identifiant) ? compte(identifiant) : null
    const ok = (await verifierCode(String(corps.code ?? '').slice(0, 200), c?.hash || 'x:y')) && c && !c.archive
    const p = ok ? await store.un('profils', c.profil_id) : null
    if (!ok || !p || p.archive) {
      // Journal : date et empreinte courte de l'identifiant ; ni IP en clair, ni code.
      journal?.ecrire({ acteur: 'app', outil: 'connexion', ok: false, erreur: 'echec', resultat: { compte: empreinteCompte(identifiant) } })
      return envoyer(res, 401, { erreur: 'identifiants' })
    }
    parCouple.effacer(`${ip}|${identifiant}`)
    if (!connue) { parCompte.annuler(identifiant); parIp.annuler(ip) }
    retenirIp(identifiant, ip)
    envoyer(res, 200, { utilisateur: utilisateurPublic(c) }, { 'Set-Cookie': cookieSession(c, corps.resterConnecte !== false) })
  }

  // ---------- Entités ----------
  const egal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  function lisible(entite, obj, u) {
    if (u.role === 'coach') return true
    if (COACH_SEUL.has(entite)) return false
    return visiblePar(entite, obj, { id: u.profil_id, role: u.role })
  }
  // Les notes du coach (programmes.notes) sont privées : jamais renvoyées à un client.
  // Idem pour la fiche du profil (profils.fiche : contact, notes du coach, source d'import).
  // Idem pour les notes privées d'un exercice.
  // Séances venues de Google Agenda : titre, id Google et copie de synchro jamais chez le client (le titre peut nommer
  // un autre client ou porter une note du coach) ; lieu Google seulement si la séance ne concerne que lui (audit agenda 1 et 10).
  const pourLecteur = (entite, o, u) => {
    const prives = { programmes: ['notes'], profils: ['fiche'], exercices: CHAMPS_COACH, seancesCoaching: ['titre', 'googleId', 'synchro', 'partagee'] }[entite]
    if (u.role === 'coach' || !prives || !o) return o
    const reste = { ...o }
    for (const k of prives) delete reste[k]
    if (entite === 'seancesCoaching' && o.partagee) delete reste.lieuTexte
    return reste
  }
  async function entites(req, res, u, entite, id) {
    if (!Object.hasOwn(ENTITES, entite)) throw new Erreur(404, 'entite_inconnue')
    const coach = u.role === 'coach'
    if (!coach && COACH_SEUL.has(entite)) throw new Erreur(403, 'interdit')
    if (req.method === 'GET' && id === undefined) {
      return envoyer(res, 200, { items: (await store.tout(entite)).filter((o) => lisible(entite, o, u)).map((o) => pourLecteur(entite, o, u)) })
    }
    if (id === undefined) throw new Erreur(404, 'route_inconnue')
    const existant = await store.un(entite, id)
    if (req.method === 'GET') {
      if (!existant || !lisible(entite, existant, u)) throw new Erreur(404, 'introuvable')
      return envoyer(res, 200, { item: pourLecteur(entite, existant, u) })
    }
    if (req.method === 'PUT') {
      // Profil écrit par son client : sans If-Match, la version lue AVANT le corps fait foi (audit I1) -> toute écriture intercalée du coach donne 409.
      const attendue = versionAttendue(req) ?? (!coach && entite === 'profils' ? versionDe(existant) : undefined)
      let obj = await lireJson(req)
      if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.id !== id) throw new Erreur(400, 'invalide')
      delete obj.version // la version stockée fait foi (src/data/versions.js) ; le contrôle passe par If-Match
      const ecrireLigne = async (existant) => {
      if (!coach && entite === 'profils' && existant && attendue !== undefined && attendue !== versionDe(existant)) {
        throw new Erreur(409, 'conflit', { actuel: lisible(entite, existant, u) ? pourLecteur(entite, existant, u) : null }) // avant tout 403 : l'état a changé, le client doit recharger
      }
      if (entite === 'exercices' && coach) { obj = nettoyerPut(obj, existant); if (!obj) throw new Erreur(400, 'invalide') } // champs calculés retirés, photo du serveur gardée
      let rattacher = () => {}
      if (entite === 'exercices' && coach && obj.lienVideo && idYoutube(obj.lienVideo)) { // lien hérité non YouTube : laissé tel quel, la validation décide
        rattacher = lienCanonique(obj, obj.nom, existant?.lienVideo) // même forme canonique que le PATCH (audit M1)
      }
      if (!coach && ENTITES_SANTE.has(entite) && !accesSante(await store.un('profils', u.profil_id))) throw new Erreur(403, 'consentement_sante')
      if (!ENTITES[entite].valider(obj).ok) throw new Erreur(400, 'invalide')
      if (Buffer.byteLength(JSON.stringify(obj)) > QUOTAS.octetsLigne) throw new Erreur(413, 'quota')
      if (!coach) {
        if (entite === 'profils') {
          // Un client modifie seulement son profil, sans toucher aux champs sensibles.
          if (id !== u.profil_id || !existant) throw new Erreur(403, 'interdit')
          if (CHAMPS_PROTEGES.some((k) => !egal(obj[k], existant[k]))) throw new Erreur(403, 'champ_protege')
          // Le client ne reçoit jamais la fiche : on garde celle de la base (jamais effacée ni remplacée par lui).
          delete obj.fiche
          if (existant.fiche !== undefined) obj.fiche = existant.fiche
        } else {
          if (!ECRITURE_CLIENT.has(entite)) throw new Erreur(403, 'interdit')
          if (clientDe(entite, obj) !== u.profil_id) throw new Erreur(403, 'interdit')
          if (existant && clientDe(entite, existant) !== u.profil_id) throw new Erreur(403, 'interdit')
          if (!existant && lignesDuClient(u.profil_id) >= QUOTAS.lignes) throw new Erreur(413, 'quota')
        }
      } else if (entite === 'profils' && existant && (obj.identifiant !== existant.identifiant || obj.role !== existant.role)) {
        // Le compte de connexion porte l'identifiant et le rôle : on refuse de les changer (plus sûr que synchroniser).
        // L'archivage, lui, est lu sur le profil à chaque requête (session et connexion) : effet immédiat.
        throw new Erreur(400, 'identifiant_ou_role_non_modifiable')
      }
      let stocke
      try { stocke = await store.ecrire(entite, obj, { versionAttendue: attendue }) } catch (e) {
        if (estConflit(e)) throw new Erreur(409, 'conflit', { actuel: e.actuel && lisible(entite, e.actuel, u) ? pourLecteur(entite, e.actuel, u) : null })
        throw new Erreur(400, 'invalide') // ex. client_id inexistant
      }
      // Lien vidéo changé par le coach : validé d'office (seuls les liens posés par les outils MCP restent « proposés »).
      rattacher()
      return envoyer(res, 200, { item: pourLecteur(entite, stocke ?? obj, u) })
      }
      // Exercices : le corps est lu, puis la ligne est relue SOUS le verrou des écritures (audit N1 : une photo posée entre-temps n'est pas écrasée).
      return entite === 'exercices' && coach ? enSerie(async () => ecrireLigne(await store.un(entite, id))) : ecrireLigne(await store.un(entite, id)) // ligne relue APRÈS le corps (audit I1 : un corps lent ne doit pas valider contre un état périmé)
    }
    if (req.method === 'DELETE') {
      const supprimerLigne = async (existant) => {
        if (!existant) throw new Erreur(404, 'introuvable')
        if (!coach && (!ECRITURE_CLIENT.has(entite) || clientDe(entite, existant) !== u.profil_id)) throw new Erreur(403, 'interdit')
        await store.supprimer(entite, id)
        if (entite === 'exercices') supprimerPhoto(existant.photo)
        return envoyer(res, 200, { ok: true })
      }
      return entite === 'exercices' && coach ? enSerie(async () => supprimerLigne(await store.un(entite, id))) : supprimerLigne(existant)
    }
    throw new Erreur(405, 'methode')
  }

  // ---------- Exercices enrichis (contrat : docs/CONTRAT-EXERCICES-STUDIO.md) ----------
  const dossierPhotos = () => join(config.fichiersDir, DOSSIER_PHOTOS)
  let verrouPhotos = Promise.resolve() // une photo à la fois : pas de fichier orphelin quand deux envois se croisent (audit M3)
  const enSerie = (fn) => { const suite = verrouPhotos.then(fn, fn); verrouPhotos = suite.catch(() => {}); return suite }
  /** Supprime le fichier d'une photo ; l'identifiant est revérifié avant tout rmSync. */
  function supprimerPhoto(photo) {
    const ext = /\.(jpg|png|webp)$/.exec(decodeURIComponent(String(photo?.url ?? '')))?.[1]
    if (!photo || !RE_PHOTO_ID.test(photo.id) || !ext) return
    rmSync(join(dossierPhotos(), `${photo.id}.${ext}`), { force: true })
  }
  async function presenterExercices(liste, coach) {
    const usage = coach ? indexUsage(await store.tout('workouts'), await store.tout('programmes')) : null
    return liste.map((e) => presenter(e, { coach, usage, biblio }))
  }
  /** Le coach a saisi ce lien lui-même : entrée de la bibliothèque créée si besoin puis « validée » (les autres vidéos de l'exercice passent « remplace »). */
  function validerLienCoach(nom, url) {
    try {
      if (!biblio) return
      const e = biblio.chercher(nom).find((x) => x.video.url === url) ?? biblio.proposer({ nom, url, justification: 'Saisie par le coach', score: 100 })
      if (e.statut !== 'valide') biblio.valider(e.id)
    } catch { /* bibliothèque indisponible : le lien reste enregistré */ }
  }
  /**
   * Lien YouTube sous sa forme canonique. Renvoie le rattachement à la bibliothèque, à appeler APRÈS l'écriture de l'exercice (audit M8).
   * Routes réservées au coach : un lien nouveau ou changé (≠ `ancien`) est validé d'office ; un lien renvoyé tel quel garde son statut.
   */
  function lienCanonique(corps, nom, ancien) {
    if (!corps.lienVideo) return () => {}
    corps.lienVideo = `https://www.youtube.com/watch?v=${idYoutube(corps.lienVideo)}`
    const url = corps.lienVideo
    if (url !== ancien) return () => validerLienCoach(nom, url)
    return () => { try { if (biblio && !biblio.chercher(nom).some((e) => e.video.url === url)) biblio.proposer({ nom, url }) } catch { /* bibliothèque indisponible : le lien reste enregistré */ } }
  }
  const entier = (v, min, max, defaut) => {
    if (v === null) return defaut
    if (!/^\d{1,6}$/.test(v) || Number(v) < min || Number(v) > max) throw new Erreur(400, 'invalide')
    return Number(v)
  }
  async function exercices(req, res, u, id, sousRoute, url) {
    await migration
    const coach = u.role === 'coach'
    const lire = async () => { const e = id && (await store.un('exercices', id)); if (!e) throw new Erreur(404, 'introuvable'); return e }
    const rendre = async (statut, ex) => envoyer(res, statut, { item: (await presenterExercices([ex], coach))[0] })
    if (id === undefined) {
      if (req.method === 'GET') {
        const q = url.searchParams, f = Object.fromEntries(['q', 'categorie', 'muscle', 'materiel', 'niveau', 'video'].map((k) => [k, q.get(k) || '']))
        if (Object.values(f).some((v) => v.length > 120) || (f.niveau && !NIVEAUX.includes(f.niveau)) || (f.video && !['aucune', 'propose', 'valide'].includes(f.video))) throw new Erreur(400, 'invalide')
        const limite = entier(q.get('limite'), 1, 500, 500), decalage = entier(q.get('decalage'), 0, 1e6, 0)
        // Filtres sans vidéo avant la préparation : seule la page demandée est préparée (le filtre « video » exige la vidéo calculée de chacun).
        if (f.video) {
          const vus = filtrer(await presenterExercices(await store.tout('exercices'), coach), f)
          return envoyer(res, 200, { items: vus.slice(decalage, decalage + limite), total: vus.length })
        }
        const vus = filtrer(await store.tout('exercices'), f)
        return envoyer(res, 200, { items: await presenterExercices(vus.slice(decalage, decalage + limite), coach), total: vus.length })
      }
      if (req.method === 'POST') {
        if (!coach) throw new Erreur(403, 'interdit')
        const parse = schemaCreation.safeParse(await lireJson(req))
        if (!parse.success) throw new Erreur(400, 'invalide')
        const { id: idDemande, ...champs } = parse.data
        let nouvelId = idDemande
        if (nouvelId) { if (await store.un('exercices', nouvelId)) throw new Erreur(409, 'existe_deja') }
        else {
          nouvelId = `ex-${slug(champs.nom) || randomBytes(3).toString('hex')}`.slice(0, 80)
          if (await store.un('exercices', nouvelId)) nouvelId = `${nouvelId.slice(0, 70)}-${randomBytes(2).toString('hex')}`
        }
        const rattacher = lienCanonique(champs, champs.nom)
        const ex = appliquerPatch({ id: nouvelId, categories: [] }, champs)
        if (!ENTITES.exercices.valider(ex).ok) throw new Erreur(400, 'invalide')
        const stocke = await store.ecrire('exercices', ex)
        rattacher()
        return rendre(201, stocke ?? ex)
      }
      throw new Erreur(405, 'methode')
    }
    if (sousRoute === undefined) {
      if (req.method === 'GET') return rendre(200, await lire())
      if (req.method === 'PATCH') {
        if (!coach) throw new Erreur(403, 'interdit')
        const attendue = versionAttendue(req)
        await lire() // 404 avant de lire le corps
        const parse = schemaPatch.safeParse(await lireJson(req))
        if (!parse.success) throw new Erreur(400, 'invalide')
        return enSerie(async () => {
          const actuel = await lire() // relue sous verrou : la photo courante n'est jamais remplacée par une ancienne
          const conflit = async (ligne) => new Erreur(409, 'conflit', { actuel: (await presenterExercices([ligne], coach))[0] })
          if (attendue !== undefined && attendue !== versionDe(actuel)) throw await conflit(actuel)
          const rattacher = lienCanonique(parse.data, parse.data.nom ?? actuel.nom, actuel.lienVideo)
          const ex = appliquerPatch(actuel, parse.data)
          if (!ENTITES.exercices.valider(ex).ok) throw new Erreur(400, 'invalide')
          let stocke
          try { stocke = await store.ecrire('exercices', ex, { versionAttendue: attendue }) } catch (e) { if (estConflit(e) && e.actuel) throw await conflit(e.actuel); throw e }
          rattacher()
          return rendre(200, stocke ?? ex)
        })
      }
      throw new Erreur(405, 'methode')
    }
    // Validation de la vidéo : /exercices/:id/valider-video (proposée -> validée dans la bibliothèque)
    if (sousRoute === 'valider-video') {
      if (req.method !== 'POST') throw new Erreur(405, 'methode')
      if (!coach) throw new Erreur(403, 'interdit')
      const ex = await lire()
      if (!ex.lienVideo || !idYoutube(ex.lienVideo)) throw new Erreur(409, 'sans_video')
      if (!biblio) throw new Erreur(503, 'bibliotheque_indisponible')
      try {
        let e = biblio.chercher(ex.nom).find((x) => x.video.url === ex.lienVideo)
        if (!e) e = biblio.proposer({ nom: ex.nom, url: ex.lienVideo })
        biblio.valider(e.id)
      } catch { throw new Erreur(503, 'bibliotheque_indisponible') }
      return rendre(200, ex)
    }
    // Photo : /exercices/:id/photo
    if (req.method !== 'POST' && req.method !== 'DELETE') throw new Erreur(405, 'methode')
    if (!coach) throw new Erreur(403, 'interdit')
    const actuel = await lire()
    if (req.method === 'DELETE') {
      return enSerie(async () => {
        const courant = await lire()
        if (!courant.photo) return rendre(200, courant)
        const { photo, ...sans } = courant
        const stocke = await store.ecrire('exercices', sans)
        supprimerPhoto(photo)
        return rendre(200, stocke ?? sans)
      })
    }
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    const ext = PHOTO_EXT[type]
    if (!ext) throw new Erreur(415, 'type_refuse')
    const buf = await lireBrut(req, PHOTO_MAX)
    if (!signatureOk(type, buf)) throw new Erreur(415, 'type_refuse')
    return enSerie(async () => {
      const courant = await lire() // relu sous verrou : l'ancienne photo à supprimer est bien la dernière enregistrée
      const photoId = `p-${randomBytes(6).toString('hex')}` // nom généré ici, jamais celui du client
      const fichier = join(dossierPhotos(), `${photoId}.${ext}`)
      mkdirSync(dossierPhotos(), { recursive: true })
      writeFileSync(fichier, buf)
      const ex = { ...courant, photo: { id: photoId, url: `/api/app/fichiers?chemin=${encodeURIComponent(`${DOSSIER_PHOTOS}/${photoId}.${ext}`)}` } }
      let stocke
      try { stocke = await store.ecrire('exercices', ex) } catch (e) { rmSync(fichier, { force: true }); throw e }
      supprimerPhoto(courant.photo)
      return rendre(200, stocke ?? ex)
    })
  }

  const TABLES_CLIENT = [...new Set(Object.entries(ENTITES).filter(([e]) => e !== 'profils').map(([, d]) => d.table))]
  const lignesDuClient = (id) => TABLES_CLIENT.reduce((n, t) => n + db.prepare(`SELECT count(*) AS n FROM ${t} WHERE client_id = ?`).get(id).n, 0)
  function usageFichiers(dossier) {
    let n = 0, octets = 0
    try { for (const f of readdirSync(dossier)) { n++; octets += statSync(join(dossier, f)).size } } catch { /* dossier absent */ }
    return { n, octets }
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
    await migration
    const f = cheminFichier(url.searchParams.get('chemin'))
    if (!f) throw new Erreur(400, 'chemin_invalide')
    // Photos d'exercices : lisibles par tous les connectés, écrites seulement par les routes /exercices/:id/photo.
    const publique = f.proprietaire === DOSSIER_PHOTOS
    if (!publique && IDS_PROFIL_RESERVES.has(f.proprietaire.toLowerCase())) throw new Erreur(403, 'interdit') // l'ancien « exercices » n'est plus un dossier (audit N2)
    if (publique && req.method !== 'GET') throw new Erreur(403, 'interdit')
    if (u.role !== 'coach' && !publique && f.proprietaire !== u.profil_id) throw new Erreur(403, 'interdit')
    const disque = join(config.fichiersDir, f.proprietaire, f.relatif.split('/')[1])
    // Le dossier du propriétaire doit être un vrai dossier de fichiersDir, pas un lien vers ailleurs (audit N4).
    const dossierSain = () => { try { return realpathSync(dirname(disque)) === join(realpathSync(config.fichiersDir), f.proprietaire) } catch { return false } }
    if (existsSync(dirname(disque)) && !dossierSain()) throw new Erreur(403, 'interdit')
    if (req.method === 'POST') {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      if (!TYPES_FICHIER[type]?.includes(f.ext)) throw new Erreur(415, 'type_refuse')
      const buf = await lireBrut(req, FICHIER_MAX)
      if (!signatureOk(type, buf)) throw new Erreur(415, 'type_refuse')
      // Plafonds par client (dossier du propriétaire), quel que soit l'auteur de l'envoi.
      const usage = usageFichiers(join(config.fichiersDir, f.proprietaire))
      let deja = 0
      try { const st = lstatSync(disque); if (st.isSymbolicLink()) throw new Erreur(403, 'interdit'); deja = st.size } catch (e) { if (e instanceof Erreur) throw e /* sinon : nouveau fichier */ }
      if ((!deja && usage.n >= QUOTAS.fichiers) || usage.octets - deja + buf.length > QUOTAS.octetsFichiers) throw new Erreur(413, 'quota')
      mkdirSync(join(config.fichiersDir, f.proprietaire), { recursive: true })
      writeFileSync(disque, buf)
      return envoyer(res, 201, { ok: true })
    }
    let existe = false
    try { existe = lstatSync(disque).isFile() } catch { /* absent */ } // lstat : un lien symbolique n'est jamais suivi (audit M4)
    if (!existe) throw new Erreur(404, 'introuvable')
    if (req.method === 'GET' && publique) {
      const etag = `"${f.relatif.split('/')[1]}"` // le nom change à chaque nouvelle photo : il tient lieu de version
      const enTetes = { ETag: etag, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, enTetes); return res.end() }
      res.writeHead(200, { 'Content-Type': TYPE_EXT[f.ext], ...enTetes })
      return res.end(readFileSync(disque))
    }
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': TYPE_EXT[f.ext], 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" })
      return res.end(readFileSync(disque))
    }
    if (req.method === 'DELETE') { rmSync(disque); return envoyer(res, 200, { ok: true }) }
    throw new Erreur(405, 'methode')
  }

  // ---------- Agenda Google (rempli par la synchro : serveur/src/agenda-synchro.js, docs/CONTRAT-AGENDA-GOOGLE.md) ----------
  async function agenda(req, res, u, quoi) {
    const coach = u.role === 'coach'
    if (req.method === 'GET' && quoi === 'evenements') {
      const lignes = db.prepare('SELECT client_id, statut_attribution, data FROM seances_agenda').all()
      if (coach) return envoyer(res, 200, { evenements: lignes.map((l) => JSON.parse(l.data)) })
      // Client : seulement les événements où il figure, sans le titre (qui peut nommer un autre client).
      const siens = lignes.filter((l) => l.statut_attribution === 'attribue').map((l) => ({ client: l.client_id, ...JSON.parse(l.data) }))
        .filter((e) => (e.clientIds ?? [e.client]).includes(u.profil_id)).map(({ client: _c, ...e }) => e)
      return envoyer(res, 200, { evenements: siens.map((e) => ({ // liste blanche : ni titre, ni autres clients, ni marques internes ; lieu Google seulement s'il est seul
        ...Object.fromEntries(['id', 'debut', 'fin', 'journee', 'date', 'heure', 'finHeure', 'debutMs', 'lieu', 'statut'].filter((k) => k in e).map((k) => [k, e[k]])),
        ...((e.clientIds?.length ?? 1) === 1 && e.lieuTexte ? { lieuTexte: e.lieuTexte } : {}), clientId: u.profil_id
      })) })
    }
    if (req.method === 'GET' && quoi === 'derniere-synchro') {
      const { derniereSynchro, bilan } = synchroAgenda.dernierBilan()
      return envoyer(res, 200, coach ? { derniereSynchro, bilan } : { derniereSynchro })
    }
    if (!coach) throw new Erreur(403, 'interdit')
    const traduire = (e) => { if (e?.statut && e?.code) throw new Erreur(e.statut, e.code); throw e }
    if (req.method === 'POST' && quoi === 'synchroniser') return envoyer(res, 200, { bilan: await synchroAgenda.synchroniser().catch(traduire) })
    if (req.method === 'GET' && quoi === 'a-attribuer') return envoyer(res, 200, { groupes: synchroAgenda.aAttribuer() })
    if (req.method === 'POST' && quoi === 'attribuer') {
      const { titre, clientIds } = await lireJson(req)
      let bilan
      try { bilan = synchroAgenda.attribuer(titre, clientIds) } catch (e) { traduire(e) }
      return envoyer(res, 200, { bilan })
    }
    throw new Erreur(404, 'route_inconnue')
  }

  return async function traiter(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1')
    const chemin = url.pathname
    if (!chemin.startsWith('/api/app/')) return false
    const route = chemin.slice('/api/app'.length)
    const ip = ipReelle(req, config.proxyCle)
    try {
      if (debitIp.bloque(ip, now())) throw new Erreur(429, 'trop_de_requetes')
      debitIp.compter(ip, now())
      // CSRF : toute requête non-GET doit venir de l'app (Origin exact), en plus de SameSite=Strict.
      if (req.method !== 'GET' && req.method !== 'HEAD' && (!config.appOrigin || req.headers.origin !== config.appOrigin)) throw new Erreur(403, 'origine_refusee')
      if (req.method === 'POST' && route === '/connexion') { await connexion(req, res, ip); return true }
      if (req.method === 'POST' && route === '/deconnexion') {
        const u = await utilisateurDe(req)
        if (u) db.prepare('UPDATE comptes SET sv = sv + 1 WHERE identifiant = ?').run(u.identifiant) // révoque aussi un cookie copié
        envoyer(res, 200, { ok: true }, { 'Set-Cookie': `${NOM_COOKIE}=; Max-Age=0; ${optsCookie}` })
        return true
      }
      const u = await utilisateurDe(req)
      if (!u) throw new Erreur(401, 'non_connecte')
      const coach = u.role === 'coach'
      // Session longue utilisée : prolongée (au plus une fois par jour). Une route qui pose son propre cookie l'emporte.
      if (u.session.longue && u.session.fin - now() < SESSION_LONGUE_MS - RENOUVELER_APRES_MS) res.setHeader('Set-Cookie', cookieSession(u.compte, true))
      if (req.method === 'GET' && route === '/moi') { const { compte: _c, session: _s, ...pub } = u; envoyer(res, 200, { utilisateur: pub }); return true }
      if (req.method === 'POST' && route === '/code') {
        const { ancien, nouveau } = await lireJson(req)
        if (typeof nouveau !== 'string' || nouveau.length < LONGUEUR_CODE_MIN || nouveau.length > 200) throw new Erreur(400, 'code_trop_court')
        if (!(await verifierCode(String(ancien ?? '').slice(0, 200), u.compte.hash))) throw new Erreur(403, 'ancien_code_faux')
        db.prepare('UPDATE comptes SET hash = ?, sv = sv + 1 WHERE identifiant = ?').run(await hacherCode(nouveau), u.identifiant)
        envoyer(res, 200, { ok: true }, { 'Set-Cookie': cookieSession(compte(u.identifiant), u.session.longue) }) // les autres sessions sont révoquées
        return true
      }
      if (req.method === 'POST' && route === '/comptes') {
        if (!coach) throw new Erreur(403, 'interdit')
        const { identifiant, code, profil } = await lireJson(req)
        if (!RE_IDENTIFIANT.test(String(identifiant)) || typeof code !== 'string' || code.length < LONGUEUR_CODE_MIN || code.length > 200) throw new Erreur(400, 'invalide')
        if (!profil || profil.identifiant !== identifiant || !ENTITES.profils.valider(profil).ok) throw new Erreur(400, 'invalide')
        if (IDS_PROFIL_RESERVES.has(String(profil.id))) throw new Erreur(400, 'invalide')
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
      const mX = /^\/exercices(?:\/([^/]+)(?:\/(photo|valider-video))?)?$/.exec(route)
      if (mX) { await exercices(req, res, u, mX[1] === undefined ? undefined : decodeURIComponent(mX[1]), mX[2], url); return true }
      const mE = /^\/e\/([^/]+)(?:\/([^/]+))?$/.exec(route)
      if (mE) { await entites(req, res, u, decodeURIComponent(mE[1]), mE[2] === undefined ? undefined : decodeURIComponent(mE[2])); return true }
      if (route === '/fichiers') { await fichiers(req, res, u, url); return true }
      const mA = /^\/agenda\/([a-z-]+)$/.exec(route)
      if (mA) { await agenda(req, res, u, mA[1]); return true }
      if (route === '/reservations' || route.startsWith('/reservations/')) {
        if (!coach) throw new Erreur(403, 'interdit')
        await relaisResa(req, res, route.slice('/reservations'.length), url)
        return true
      }
      throw new Erreur(404, 'route_inconnue')
    } catch (e) {
      // Corps trop gros : réponse 413 avec « Connection: close » (le client ne réutilise pas la connexion), puis coupure.
      if (e?.code === 'trop_gros') { res.once('finish', () => req.destroy()); return envoyer(res, 413, { erreur: e.code }, { Connection: 'close' }), true }
      if (e instanceof URIError) envoyer(res, 400, { erreur: 'invalide' }) // %xx mal formé dans l'adresse
      else if (e instanceof Erreur) envoyer(res, e.statut, { erreur: e.code, ...e.extra })
      else envoyer(res, 500, { erreur: 'interne' })
      return true
    }
  }
}
