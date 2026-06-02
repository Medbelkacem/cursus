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

// Register the service worker (PWA). Only in production builds — in dev
// Vite already does HMR and a SW would just cache stale modules.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((e) => console.warn('[cursus] SW registration failed', e));
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
