/* eslint-disable no-restricted-globals */
// Cursus — service worker
//
//   - Precache: app shell (index.html + manifest + icons + offline page).
//   - Runtime:
//       * Navigation requests → network-first, fallback to cached index.html
//         (so the SPA still loads when offline; the router shows what it can).
//       * Static assets (/assets/* with hashed filenames) → cache-first.
//       * Everything else (Supabase REST/Auth/Storage) → network-only,
//         never cached, never intercepted with stale data.
//
// Cache versioning: bump CACHE_VERSION on each deploy that ships new app code.

const CACHE_VERSION = 'cursus-v1';
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const ASSET_CACHE   = `${CACHE_VERSION}-assets`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.startsWith(CACHE_VERSION))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin (Supabase, Google Fonts, etc.) — never intercept.
  if (url.origin !== self.location.origin) return;

  // Navigation requests → network-first, fallback to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch (_) {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Hashed assets (/assets/index-XYZ.js) → cache-first (immutable).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const fresh = await fetch(req);
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })());
    return;
  }

  // Icons / manifest / favicon — stale-while-revalidate.
  if (SHELL_URLS.some((p) => url.pathname === p)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const hit = await cache.match(req);
      const fetchPromise = fetch(req).then((fresh) => {
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      }).catch(() => hit);
      return hit || fetchPromise;
    })());
    return;
  }

  // Default: network-only.
});
