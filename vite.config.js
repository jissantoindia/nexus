import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const isElectronBuild = process.env.ELECTRON_BUILD === 'true';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['flash.png', 'favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Nexus — API Testing & Documentation',
        short_name: 'Nexus',
        description: 'Test APIs, generate beautiful documentation, and collaborate with your team.',
        theme_color: '#6366f1',
        background_color: '#0f0f14',
        display: 'standalone',
        orientation: 'landscape',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/flash.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/flash.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
        categories: ['developer tools', 'productivity'],
        shortcuts: [
          {
            name: 'New Request',
            short_name: 'Request',
            description: 'Open Nexus and start a new request',
            url: '/',
            icons: [{ src: '/flash.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: !isElectronBuild,
        type: 'module',
      },
    }),
  ],
  // Electron needs relative asset paths (file:// protocol)
  // Web PWA uses absolute paths (/)
  base: isElectronBuild ? './' : '/',
})
