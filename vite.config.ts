import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      includeAssets: [
        'pwa.svg',
        'icons/ykhn-32.png',
        'icons/ykhn-192.png',
        'icons/ykhn-512.png',
        'icons/ykhn-192-rounded.png',
      ],
      manifest: {
        name: 'YKHN',
        short_name: 'YKHN',
        description: 'Fast, offline-friendly Hacker News client.',
        theme_color: '#ff6600',
        background_color: '#0b0c0f',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/ykhn-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/ykhn-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/pwa.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/hacker-news\.firebaseio\.com\/v0\/.*\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hn-api',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 800,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
})
