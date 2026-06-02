// ─────────────────────────────────────────────────────────────────────────────
//  Client Supabase
//
//  Singleton — un seul client par onglet. Si les variables d'environnement
//  ne sont pas définies, `getSupabase()` renvoie `null` et les appelants
//  doivent gérer le cas (afficher un message de configuration manquante).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

let _client = null;
let _configured = false;

export function initSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('YOUR-PROJECT-REF')) {
    console.warn(
      '[cursus] Supabase non configuré. Définir VITE_SUPABASE_URL et ' +
        'VITE_SUPABASE_ANON_KEY dans .env (voir .env.example).'
    );
    return null;
  }

  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'cursus.auth',
    },
  });
  _configured = true;
  return _client;
}

export function getSupabase() {
  return _client;
}

export function isSupabaseConfigured() {
  return _configured;
}
