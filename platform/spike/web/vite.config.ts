import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      // @privy-io/react-auth imports optional Solana peers (@solana/kit, @solana-program/*) in its
      // Solana funding screens. This app is EVM only and does not install them; Vite replaces them
      // with empty placeholders, so let Rollup shim the missing named exports instead of failing.
      // Those code paths are never reached (email login, Kaia embedded wallet only).
      shimMissingExports: true,
    },
  },
});
