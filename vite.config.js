import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['p-pro-s.png', 'p-pro-logo.png', 'vite.svg'],
      manifest: {
        name: 'Pick-Pro OS',
        short_name: 'P-PRO',
        description: 'Real-Time Sports Tournament Engine',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        icons: [
          {
            src: 'p-pro-s.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'p-pro-s.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Cache Google Fonts, images, and standard assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        // Exclude catching dev-dist from the normal build output to prevent loops
        globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'classic', // Classic is often more resilient for opaque dev requests
        navigateFallback: 'index.html',
        suppressWarnings: true
      }
    })
  ],
});
