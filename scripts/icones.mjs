// Génère les icônes de l'app (PNG) depuis sources-icones/monogramme.svg : npm run icones
// 192 et 512 (« any »), 512 maskable (monogramme réduit dans la zone sûre), 180 pour l'écran d'accueil iOS, favicon SVG.
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const svg = await readFile('sources-icones/monogramme.svg', 'utf8')
await mkdir('public/icons', { recursive: true })

// Maskable : le fond couvre tout, le monogramme est réduit à 62 % (le système peut rogner jusqu'à 20 % de chaque bord).
const maskable = svg.replace('<g class="mono"', '<g transform="translate(256 256) scale(.62) translate(-256 -256)"')

const sorties = [
  ['public/icons/icon-192.png', svg, 192],
  ['public/icons/icon-512.png', svg, 512],
  ['public/icons/maskable-512.png', maskable, 512],
  ['public/icons/apple-touch-icon.png', svg, 180]
]
for (const [fichier, source, taille] of sorties) {
  await sharp(Buffer.from(source), { density: 384 }).resize(taille, taille).png({ compressionLevel: 9 }).toFile(fichier)
  console.log('écrit', fichier)
}
await writeFile('public/icone.svg', svg)
console.log('écrit public/icone.svg')
