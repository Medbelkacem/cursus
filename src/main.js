// ─────────────────────────────────────────────────────────────────────────────
//  Cursus — point d'entrée
//
//  Ordre d'amorçage :
//    1. Styles globaux (tokens, base, RTL, thèmes).
//    2. i18n + thème (instantanés).
//    3. Supabase + Auth (réseau, mais asynchrone non-bloquant pour les pages
//       publiques — le router gère la redirection si une page protégée est
//       demandée pendant le chargement de la session).
//    4. Router : monte la page courante.
// ─────────────────────────────────────────────────────────────────────────────

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/rtl.css';

import { initI18n } from './lib/i18n.js';
import { initTheme } from './lib/theme.js';
import { initSupabase } from './lib/supabase.js';
import { initAuth } from './lib/auth.js';
import { initRouter } from './lib/router.js';

async function boot() {
  const root = document.getElementById('app');

  await initI18n();
  initTheme();
  initSupabase();
  await initAuth();         // attend la session avant le premier render
  await initRouter(root);

  root.setAttribute('aria-busy', 'false');
}

// ─────────────────────────────────────────────────────────────────────────────
//  Service worker (PWA) — uniquement en production : en développement, Vite
//  gère déjà le rechargement à chaud et un SW ne ferait que servir des modules
//  périmés.
// ─────────────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // Le premier chargement récupère ses fichiers AVANT que le SW ne prenne
      // la main : sans cela, le cache d'assets resterait vide et la toute
      // première visite hors ligne n'aurait que la coquille, sans le code.
      // On lui transmet donc la liste des ressources déjà présentes.
      const warm = () => {
        const sw = navigator.serviceWorker.controller || reg.active;
        if (!sw) return;
        const urls = [
          ...document.querySelectorAll('script[src], link[rel="stylesheet"][href]'),
        ]
          .map((el) => el.src || el.href)
          .filter((u) => u && new URL(u, location.href).origin === location.origin);
        if (urls.length) sw.postMessage({ type: 'WARM_ASSETS', urls });
      };

      if (navigator.serviceWorker.controller) warm();
      else navigator.serviceWorker.addEventListener('controllerchange', warm, { once: true });
    } catch (e) {
      console.warn('[cursus] échec d’enregistrement du service worker', e);
    }
  });
}

boot().catch((err) => {
  console.error('[cursus] boot failed', err);
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="app-fatal">
      <h1>Une erreur est survenue au démarrage.</h1>
      <p>Vérifiez la console et vos variables d'environnement (<code>.env</code>).</p>
      <pre>${String(err && err.message ? err.message : err)}</pre>
    </div>
  `;
});
