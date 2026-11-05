import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { garderCleApi } from './scripts/garde-cle-api.mjs'

// Adresse réglable au build (deploiement/deployer.sh les lit dans /etc/app-coaching.env) :
// APP_BASE = chemin de l'app ('/' = domaine propre, '/app/' = sous-chemin du site) ;
// APP_SCOPE = portée du manifeste (défaut APP_BASE ; '/' pour installer l'app depuis une page du site).
const avecBarres = (v) => `/${String(v).replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/')
const APP_BASE = avecBarres(process.env.APP_BASE || '/')
const APP_SCOPE = avecBarres(process.env.APP_SCOPE || APP_BASE)
const echapper = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default defineConfig({
  base: APP_BASE,
  plugins: [
    garderCleApi(), // bloque un build de production qui embarquerait VITE_API_KEY
    vue(),
    VitePWA({
      // « prompt » : la mise à jour n'est appliquée qu'à une navigation hors séance (voir src/lib/pwa.js), jamais en pleine séance.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icone.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Corentin Delmée Coaching',
        short_name: 'CD Coaching',
        lang: 'fr',
        id: APP_BASE,
        start_url: APP_BASE,
        scope: APP_SCOPE,
        display: 'standalone',
        orientation: 'portrait',
        categories: ['health', 'fitness', 'sports'],
        background_color: '#E3E5E8',
        theme_color: '#E3E5E8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${APP_BASE}index.html`,
        // Le SW ne répond qu'aux navigations sous APP_BASE : jamais l'app à la place d'une page du site.
        navigateFallbackAllowlist: [new RegExp(`^${echapper(APP_BASE)}`)],
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'serveur/tests/**/*.test.js']
  }
})
