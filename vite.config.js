// Configuration Vite — Cursus
//
// Application monopage : le routeur maison (src/lib/router.js) n'utilise pas de
// hash, l'hébergeur réécrit donc /* vers /index.html (voir vercel.json).
//
// En développement, les appels /api/* sont relayés vers le serveur d'API local
// (`npm run dev:api`), qui exécute les mêmes fonctions que Vercel en production.

import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split vendor chunks so the initial payload stays small
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('chart.js')) return 'charts';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT || 3001}`,
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: 4173,
  },
});
