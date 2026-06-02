// Vite configuration for Cursus
// Single-page app (SPA) with a custom hash-free router that lives in /src/lib/router.js.
// Netlify is configured with a /* -> /index.html redirect so deep links work.

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
            if (id.includes('@supabase')) return 'supabase';
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
  },
  preview: {
    port: 4173,
  },
});
