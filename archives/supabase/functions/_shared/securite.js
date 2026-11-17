// Outils de sécurité communs aux Edge Functions (WebCrypto : Deno et Node 20+). Testés par tests/unit/securite-fonctions.test.js.
const enc = new TextEncoder()
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Empreinte SHA-256 (octets). */
export const sha256 = async (texte) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(texte))))

/** Comparaison en temps constant : on compare les empreintes SHA-256 (même longueur), donc ni la longueur ni le contenu ne fuient par le temps. */
export async function egalConstant(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)])
  let d = 0
  for (let i = 0; i < ha.length; i++) d |= ha[i] ^ hb[i]
  return d === 0
}

/** Signature HMAC-SHA256 (hexadécimal) d'un texte avec un secret. */
export async function hmacHex(secret, texte) {
  const cle = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', cle, enc.encode(texte)))
}

/** Chaîne aléatoire sûre (base64url) de `octets` octets. */
export const aleatoire = (octets = 32) => b64url(crypto.getRandomValues(new Uint8Array(octets)))

/** PKCE S256 : challenge = base64url(SHA-256(verifier)). */
export async function defiPkce(verifier) { return b64url(await sha256(verifier)) }

/** En-têtes CORS : seule l'origine de l'application (APP_ORIGIN) est autorisée ; sans APP_ORIGIN, aucune origine web. */
export function corsPour(req, appOrigin, entetes = 'authorization, x-client-info, apikey, content-type') {
  const origine = req.headers.get('Origin')
  const base = { 'Access-Control-Allow-Headers': entetes, 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
  return origine && appOrigin && origine === appOrigin ? { ...base, 'Access-Control-Allow-Origin': origine } : base
}

/** Ne garde de l'événement Google que le nécessaire (titre, début, fin, lieu) : ni description ni invités. */
const CHAMPS_EVENEMENT = ['id', 'etag', 'updated', 'titre', 'nom', 'tag', 'date', 'heure', 'finHeure', 'journee', 'debutMs', 'lieu', 'lieuTexte']
export function champsStockes(evenement) {
  const out = {}
  for (const k of CHAMPS_EVENEMENT) if (evenement[k] !== undefined) out[k] = typeof evenement[k] === 'string' ? evenement[k].slice(0, 200) : evenement[k]
  return out
}
