import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5190, host: true, fs: { allow: ['..'] } },
  preview: { port: 4190, host: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 6000,
    // @privy-io/react-auth imports optional Solana peers; the admin is EVM only (same as the PWA).
    rollupOptions: { shimMissingExports: true },
  },
});
