// Génère DA/tokens.css depuis DA/tokens.json (mêmes noms de variables que l'app), pour les gabarits et la planche.
// Usage : node DA/outils/generer-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DA = join(dirname(fileURLToPath(import.meta.url)), '..')
const tokens = JSON.parse(readFileSync(join(DA, 'tokens.json'), 'utf8'))

const base = []
const amb = { clair: [], sombre: [], bleu: [] }
;(function parcourir(n) {
  for (const [cle, t] of Object.entries(n)) {
    if (cle.startsWith('$') || !t || typeof t !== 'object') continue
    if (!t.css) { parcourir(t); continue }
    if (t.valeurs) for (const [a, v] of Object.entries(t.valeurs)) amb[a].push(`  ${t.css}: ${v};`)
    else base.push(`  ${t.css}: ${t.valeur};`)
    if (t['css-encre']) base.push(`  ${t['css-encre']}: ${t.encre};`)
  }
})(tokens)

const css = `/* GÉNÉRÉ par DA/outils/generer-tokens.mjs depuis DA/tokens.json — ne pas modifier à la main. */
@font-face { font-family: 'Syne'; font-weight: 400 800; font-display: swap; src: url('polices/syne-latin-wght-normal.woff2') format('woff2-variations'); }
@font-face { font-family: 'Albert Sans'; font-weight: 100 900; font-display: swap; src: url('polices/albert-sans-latin-wght-normal.woff2') format('woff2-variations'); }
@font-face { font-family: 'Barlow Semi Condensed'; font-weight: 600; font-display: swap; src: url('polices/barlow-semi-condensed-latin-600-normal.woff2') format('woff2'); }

:root {
  --e: 1;
  --accent: var(--jaune);
  --accent-texte: var(--jaune-texte);
${base.join('\n')}
}

/* Ambiances (espace client) : clair par défaut, data-ambiance="sombre" | "bleu" sur <html> ou un conteneur. */
:root, [data-ambiance="clair"] {
${amb.clair.join('\n')}
}
[data-ambiance="sombre"] {
${amb.sombre.join('\n')}
}
[data-ambiance="bleu"] {
${amb.bleu.join('\n')}
}
`
writeFileSync(join(DA, 'tokens.css'), css)
console.log(`écrit DA/tokens.css (${base.length} variables + 3 ambiances × ${amb.clair.length})`)
