#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Serveur d'API local — exécute les mêmes fonctions que Vercel en production.
//
//  Chaque fichier de `api/` devient une route :
//     api/db.js            → /api/db
//     api/rpc.js           → /api/rpc
//     api/storage.js       → /api/storage
//     api/auth/[action].js → /api/auth/<action>
//
//  Vite relaie /api vers ce serveur (voir vite.config.js).
// ─────────────────────────────────────────────────────────────────────────────

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const f = join(ROOT, name);
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      if (!(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();
process.env.NODE_ENV ||= 'development';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL absent — définissez-le dans .env.local');
  process.exit(1);
}
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error('AUTH_SECRET absent ou trop court (32 caractères minimum).');
  process.exit(1);
}

const PORT = Number(process.env.API_PORT || 3001);

// Résout un chemin d'URL vers un module de api/
function resolveHandler(pathname) {
  const rel = pathname.replace(/^\/api\/?/, '');
  const segments = rel.split('/').filter(Boolean);

  // Route exacte : api/<a>/<b>.js puis api/<a>.js
  for (let i = segments.length; i > 0; i--) {
    const direct = join(ROOT, 'api', ...segments.slice(0, i)) + '.js';
    if (existsSync(direct)) {
      return { file: direct, params: {} };
    }
  }
  // Route dynamique : api/<a>/[param].js
  if (segments.length >= 2) {
    const dir = join(ROOT, 'api', ...segments.slice(0, -1));
    const last = segments[segments.length - 1];
    // On ne connaît pas le nom du paramètre : on tente les fichiers [x].js
    for (const candidate of ['action', 'name', 'id', 'slug']) {
      const f = join(dir, `[${candidate}].js`);
      if (existsSync(f)) return { file: f, params: { [candidate]: last } };
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (!url.pathname.startsWith('/api')) {
    res.statusCode = 404;
    return res.end('Seules les routes /api sont servies ici.');
  }

  const found = resolveHandler(url.pathname);
  if (!found) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: { message: `Route inconnue : ${url.pathname}` } }));
  }

  // Reproduit l'interface Vercel : req.query fusionne params dynamiques et
  // paramètres d'URL.
  req.query = { ...found.params };
  for (const [k, v] of url.searchParams) req.query[k] = v;

  try {
    // Rechargement à chaud : on invalide le cache de modules à chaque appel.
    const mod = await import(pathToFileURL(found.file).href + `?t=${Date.now()}`);
    await mod.default(req, res);
  } catch (e) {
    console.error(`[api] ${url.pathname}`, e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: e.message } }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`API Cursus  →  http://localhost:${PORT}/api`);
  console.log(`base        →  ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
});
