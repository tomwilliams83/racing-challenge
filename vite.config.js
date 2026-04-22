import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',           // prompt user to update rather than force it
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          }
        ],
        // Do NOT skip waiting — let user finish their session first
        skipWaiting: false,
        clientsClaim: false,
      },
      manifest: {
        name: 'StableMates',
        short_name: 'StableMates',
        description: 'Pick nags, win brags',
        theme_color: '#ff007f',
        background_color: '#eef6fd',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ]
      }
    })
  ],
  base: '/',
})
