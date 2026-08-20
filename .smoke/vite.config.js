import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// Les spécificateurs relatifs varient selon la profondeur ('./auth.js',
// '../lib/auth.js', '../../lib/auth.js') : la regex doit couvrir tout le
// spécificateur, sinon Vite n'en remplace qu'une partie.
export default defineConfig({
  root: r('.'),
  resolve: {
    alias: [
      { find: /^\.{1,2}\/(?:[\w.\-/]*\/)?api\.js$/, replacement: r('./mock-api.js') },
      { find: /^\.{1,2}\/(?:[\w.\-/]*\/)?auth\.js$/,     replacement: r('./mock-auth.js') },
    ],
  },
  server: { port: 5199, strictPort: true },
});
