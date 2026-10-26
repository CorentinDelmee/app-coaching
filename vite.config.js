import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { garderCleApi } from './scripts/garde-cle-api.mjs'

// base '/' : l'app est servie à la racine du sous-domaine Netlify (*.netlify.app).
export default defineConfig({
  base: '/',
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
        id: '/',
        start_url: '/',
        scope: '/',
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
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'serveur/tests/**/*.test.js']
  }
})
