import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* The service worker precaches the app shell only: index.html, the entry chunk and everything it imports statically,
   its CSS, the icons and the category images. Privy (a dynamic import with ~250 optional chunks) is not precached: its
   chunks load on first use and are kept by a CacheFirst runtime route (hashed, immutable file names). */
type Chunk = { file: string; css?: string[]; imports?: string[]; isEntry?: boolean };
function shellFiles(outDir: string): Set<string> {
  const m: Record<string, Chunk> = JSON.parse(readFileSync(outDir + '/.vite/manifest.json', 'utf8'));
  const keep = new Set<string>();
  const walk = (key: string) => {
    const c = m[key]; if (!c || keep.has(c.file)) return;
    keep.add(c.file); (c.css || []).forEach((f) => keep.add(f)); (c.imports || []).forEach(walk);
  };
  Object.keys(m).filter((k) => m[k].isEntry).forEach(walk);
  return keep;
}
const OUT = fileURLToPath(new URL('./dist', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // DEV-PLAN 2.3: the player accepts an update ("Update ready"); API and chain responses are never cached.
      registerType: 'prompt',
      injectRegister: false,
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
        globPatterns: ['index.html', 'assets/**/*.{js,css}', 'assets/*.svg', 'assets/img/*.svg', 'icons/*.{png,svg}'],
        globIgnores: ['**/.vite/**'],
        // keep the shell: entry chunk and its static imports (and every non JS file the patterns matched)
        manifestTransforms: [async (entries) => {
          const shell = shellFiles(OUT);
          return { manifest: entries.filter((e) => !/^assets\/.*\.(js|css)$/.test(e.url) || shell.has(e.url)), warnings: [] };
        }],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/v1\//, /^\/admin\//, /^\/dev\//],
        runtimeCaching: [
          // API and chain answers are never cached (fresh balances, picks and receipts): network only
          { urlPattern: ({ url }) => /\/(v1|admin\/v1|dev\/rpc)(\/|$)/.test(url.pathname) || /(^|\.)kaia\.io$|kaiascan\.io$/.test(url.hostname), handler: 'NetworkOnly' },
          // lazy chunks (Privy and its optional screens): fetched on first use, then served from the cache
          { urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/.+\.js$/.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'cojam-lazy-chunks', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 24 * 3600 } } },
          // fonts (cross origin: Google Fonts and the Pretendard CDN): CSS revalidates, font files are immutable
          { urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || (url.hostname === 'cdn.jsdelivr.net' && /\.css$/.test(url.pathname)), handler: 'StaleWhileRevalidate', options: { cacheName: 'cojam-font-css' } },
          { urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com' || (url.hostname === 'cdn.jsdelivr.net' && /\.woff2?$/.test(url.pathname)), handler: 'CacheFirst', options: { cacheName: 'cojam-fonts', expiration: { maxEntries: 300, maxAgeSeconds: 365 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } } },
        ],
      },
    }),
  ],
  server: { port: 5180, host: true },
  preview: { port: 4180, host: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    manifest: true,
    chunkSizeWarningLimit: 6000,
    // @privy-io/react-auth imports optional Solana peers; this app is EVM only (same as the spike).
    rollupOptions: { shimMissingExports: true },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
} as never);
