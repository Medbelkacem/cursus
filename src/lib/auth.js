// ─────────────────────────────────────────────────────────────────────────────
//  Authentification — couche fine au-dessus de /api/auth.
//
//  La session vit dans un cookie httpOnly posé par le serveur : le navigateur
//  ne détient aucun jeton lisible par JavaScript, et le client ne peut pas
//  déclarer son identité. Ce module ne conserve qu'un cache mémoire du profil.
// ─────────────────────────────────────────────────────────────────────────────

import { getApi, isApiConfigured } from './api.js';

let _user = null;
let _profile = null;
const _listeners = new Set();
let _bootPromise = null;

function emit() {
  const state = getState();
  _listeners.forEach((fn) => { try { fn(state); } catch (_) { /* isole les abonnés */ } });
}

export async function initAuth() {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    const api = getApi();
    if (!api) return;
    try {
      const { data } = await api.auth.getSession();
      const session = data?.session || null;
      _user = session?.user || null;
      _profile = session?.profile || null;
    } catch (e) {
      console.warn('[auth] session indisponible', e.message);
    }
  })();
  return _bootPromise;
}

export function getState() {
  return {
    user: _user,
    session: _user ? { user: _user } : null,
    profile: _profile,
    isAuthenticated: !!_user,
    isActive:   _profile?.status === 'active',
    isPending:  _profile?.status === 'pending',
    isRejected: _profile?.status === 'rejected',
    role: _profile?.role || null,
  };
}

export function onAuthChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export async function signInWithPassword(email, password) {
  const api = getApi();
  if (!api) throw new Error('API_UNCONFIGURED');
  const { data, error } = await api.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _user = data.user;
  _profile = data.profile;
  emit();
  return getState();
}

export async function signUpWithPassword(email, password, metadata = {}) {
  const api = getApi();
  if (!api) throw new Error('API_UNCONFIGURED');
  const { data, error } = await api.auth.signUp({ email, password, options: { data: metadata } });
  if (error) throw error;
  // Un compte auto-inscrit reste en attente de validation : aucune session.
  return { ...getState(), needsConfirmation: !!data?.needsApproval, message: data?.message };
}

export async function changePassword(currentPassword, newPassword) {
  const api = getApi();
  if (!api) throw new Error('API_UNCONFIGURED');
  const { error } = await api.auth.changePassword(currentPassword, newPassword);
  if (error) throw error;
  return true;
}

export async function signOut() {
  const api = getApi();
  if (api) { try { await api.auth.signOut(); } catch (_) { /* on nettoie quand même */ } }
  _user = null;
  _profile = null;
  emit();
}

// Redirige vers le bon espace selon le rôle.
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

// Garde de route — appelée par chaque page d'un espace authentifié.
// Elle ne fait que masquer l'interface : l'autorisation réelle est appliquée
// par PostgreSQL (RLS et fonctions), qui refuse indépendamment de cet écran.
export function requireAuth(opts = {}) {
  if (!isApiConfigured()) return { ok: false, redirect: '/login?reason=unconfigured' };
  const s = getState();
  if (!s.isAuthenticated) return { ok: false, redirect: '/login' };
  if (s.isPending)        return { ok: false, redirect: '/en-attente' };
  if (s.isRejected)       return { ok: false, redirect: '/refuse' };
  if (opts.role) {
    const roles = Array.isArray(opts.role) ? opts.role : [opts.role];
    if (!roles.includes(s.role)) return { ok: false, redirect: dashboardPathFor(s.role) };
  }
  return { ok: true, state: s };
}
