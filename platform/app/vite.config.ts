import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // DEV-PLAN 2.3: the player accepts an update ("Update ready"); API and chain responses are never cached.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'assets/*.svg', 'assets/img/*.svg'],
      manifest: {
        id: '/',
        name: 'Cojam',
        short_name: 'Cojam',
        description: 'Predict five questions a day. Earn points, convert them to CT.',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        background_color: '#ffffff',
        theme_color: '#124CC4',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/v1\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5180, host: true },
  preview: { port: 4180, host: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 6000,
    // @privy-io/react-auth imports optional Solana peers; this app is EVM only (same as the spike).
    rollupOptions: { shimMissingExports: true },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
} as never);
