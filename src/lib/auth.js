// ─────────────────────────────────────────────────────────────────────────────
//  Auth — couche fine au-dessus de Supabase Auth.
//
//   - Tient à jour un cache mémoire `{ session, profile }`.
//   - Recharge le profil quand la session change (login / logout / refresh).
//   - Expose `requireAuth({ role })` pour la garde de routes.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, isSupabaseConfigured } from './supabase.js';

let _session = null;
let _profile = null;
let _listeners = new Set();
let _bootPromise = null;

export async function initAuth() {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    _session = data.session || null;
    if (_session) await loadProfile();

    sb.auth.onAuthStateChange(async (_event, session) => {
      _session = session;
      _profile = null;
      if (session) await loadProfile();
      _listeners.forEach((fn) => fn(getState()));
    });
  })();
  return _bootPromise;
}

async function loadProfile() {
  const sb = getSupabase();
  if (!sb || !_session) return;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', _session.user.id)
    .maybeSingle();
  if (error) {
    console.warn('[auth] failed to load profile', error);
    return;
  }
  _profile = data || null;
}

export function getState() {
  return {
    user: _session?.user || null,
    session: _session,
    profile: _profile,
    isAuthenticated: !!_session,
    isActive: _profile?.status === 'active',
    isPending: _profile?.status === 'pending',
    isRejected: _profile?.status === 'rejected',
    role: _profile?.role || null,
  };
}

export function onAuthChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export async function signInWithPassword(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('SUPABASE_UNCONFIGURED');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _session = data.session;
  await loadProfile();
  return getState();
}

export async function signUpWithPassword(email, password, metadata = {}) {
  const sb = getSupabase();
  if (!sb) throw new Error('SUPABASE_UNCONFIGURED');
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (error) throw error;
  _session = data.session;
  if (_session) await loadProfile();
  return { ...getState(), needsConfirmation: !data.session };
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  _session = null;
  _profile = null;
}

// Redirige vers le bon dashboard selon le rôle.
export function dashboardPathFor(role) {
  switch (role) {
    case 'student':   return '/etudiant';
    case 'teacher':   return '/professeur';
    case 'admin':     return '/administration';
    case 'direction': return '/direction';
    case 'ministry':  return '/ministere';
    default:          return '/';
  }
}

// Garde de route — à appeler depuis chaque page d'espace authentifié.
// Retourne { ok: boolean, redirect?: string }.
export function requireAuth(opts = {}) {
  if (!isSupabaseConfigured()) return { ok: false, redirect: '/login?reason=unconfigured' };
  const s = getState();
  if (!s.isAuthenticated) return { ok: false, redirect: '/login' };
  if (s.isPending)        return { ok: false, redirect: '/en-attente' };
  if (s.isRejected)       return { ok: false, redirect: '/refuse' };
  if (opts.role && s.role !== opts.role && (Array.isArray(opts.role) ? !opts.role.includes(s.role) : true)) {
    return { ok: false, redirect: dashboardPathFor(s.role) };
  }
  return { ok: true, state: s };
}
