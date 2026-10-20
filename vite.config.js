import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// base '/' : l'app est servie à la racine du sous-domaine Netlify (*.netlify.app).
export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Corentin Delmée Coaching',
        short_name: 'CD Coaching',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#25221F',
        theme_color: '#25221F',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html'
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js']
  }
})
