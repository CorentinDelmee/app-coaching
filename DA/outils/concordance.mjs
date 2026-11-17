// Vérifie que DA/tokens.json correspond aux feuilles de l'app (src/styles/tokens.css, src/coach/studio/tokens.css).
// Usage (depuis la racine du projet ou n'importe où) : node DA/outils/concordance.mjs   → « OK » ou la liste des écarts (code 1).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DA = join(dirname(fileURLToPath(import.meta.url)), '..')
const RACINE = join(DA, '..')
const tokens = JSON.parse(readFileSync(join(DA, 'tokens.json'), 'utf8'))

// Lit une feuille : { sélecteur normalisé : { --variable : valeur } } (commentaires retirés, blocs fusionnés).
function lireFeuille(chemin) {
  const css = readFileSync(join(RACINE, chemin), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '') // valeurs de base seulement (les @media téléphone sont décrites dans README)
  const blocs = {}
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ')
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) (blocs[sel] ??= {})[d[1]] = d[2].trim()
  }
  return blocs
}
const norm = (v) => String(v).toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/(^|[ ,(])0\./g, '$1.').trim()

const feuilles = { client: lireFeuille(tokens.$sources.client), studio: lireFeuille(tokens.$sources.studio) }
const PORTEE = {
  clair: ':root, html[data-ambiance="clair"]',
  sombre: 'html[data-ambiance="sombre"]',
  bleu: 'html[data-ambiance="bleu"]'
}
// Valeur d'une variable : pour le client, d'abord les blocs :root ; pour le Studio, .st-app.
function chercher(source, nom, portee) {
  const f = feuilles[source]
  if (portee) return f[portee]?.[nom]
  const ordre = source === 'studio' ? ['.st-app'] : Object.keys(f).filter((s) => s.startsWith(':root'))
  for (const s of ordre) if (f[s]?.[nom] !== undefined) return f[s][nom]
  return undefined
}

const ecarts = []
let verifies = 0
function comparer(chemin, attendu, source, nom, portee) {
  verifies++
  const trouve = chercher(source, nom, portee)
  if (trouve === undefined) ecarts.push(`${chemin} : ${nom} absent de ${tokens.$sources[source]}${portee ? ` (${portee})` : ''}`)
  else if (norm(trouve) !== norm(attendu)) ecarts.push(`${chemin} : ${nom} = « ${trouve} » dans ${tokens.$sources[source]}, « ${attendu} » dans tokens.json`)
}
function parcourir(noeud, chemin) {
  for (const [cle, t] of Object.entries(noeud)) {
    if (cle.startsWith('$') || typeof t !== 'object') continue
    const ici = chemin ? `${chemin}.${cle}` : cle
    if (t.css && t.source) {
      if (t.valeurs) for (const [amb, v] of Object.entries(t.valeurs)) comparer(`${ici}[${amb}]`, v, t.source, t.css, PORTEE[amb])
      else if (t.valeur !== undefined) comparer(ici, t.valeur, t.source, t.css)
      if (t['css-encre']) comparer(`${ici}.encre`, t.encre, t.source, t['css-encre'])
    } else parcourir(t, ici)
  }
}
parcourir(tokens, '')

// Sens inverse : variables de couleur de l'app absentes de tokens.json (information, pas une erreur).
const connus = new Set()
;(function noms(n) { for (const t of Object.values(n)) if (t && typeof t === 'object') { if (t.css) { connus.add(t.css); if (t['css-encre']) connus.add(t['css-encre']) } else noms(t) } })(tokens)
const nonRepris = new Set()
for (const f of Object.values(feuilles)) for (const vars of Object.values(f)) for (const [n, v] of Object.entries(vars)) if (!connus.has(n) && /#|rgb|color-mix/.test(v)) nonRepris.add(n)

if (ecarts.length) {
  console.log(`ÉCARTS (${ecarts.length} sur ${verifies} valeurs vérifiées) :`)
  for (const e of ecarts) console.log(' - ' + e)
} else console.log(`OK : ${verifies} valeurs de tokens.json identiques aux feuilles de l'app.`)
if (nonRepris.size) console.log(`Info : ${nonRepris.size} variables de couleur de l'app non reprises dans la DA (alias ou usage interne) : ${[...nonRepris].join(', ')}`)
process.exit(ecarts.length ? 1 : 0)
