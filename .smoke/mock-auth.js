// Faux module d'authentification : le rôle testé est lu depuis window.__ROLE__.
import { getSupabase, isSupabaseConfigured } from '../src/lib/supabase.js';

const PROFILES = {
  ministry:  { id: 'm1', role: 'ministry',  first_name: 'Amel',  last_name: 'Ministre',
               email: 'ministere@x.dz', status: 'active', establishment_id: null,
               wilaya_id: null, direction_id: null },
  direction: { id: 'd1', role: 'direction', first_name: 'Nadir', last_name: 'Directeur',
               email: 'direction@x.dz', status: 'active', establishment_id: null,
               wilaya_id: '00000000-0000-4000-8000-000000000001', direction_id: null },
  admin:     { id: 'a1', role: 'admin',     first_name: 'Sara',  last_name: 'Admin',
               email: 'admin@x.dz', status: 'active',
               establishment_id: '00000000-0000-4000-8000-000000000002',
               wilaya_id: '00000000-0000-4000-8000-000000000001', direction_id: null },
  teacher:   { id: 't1', role: 'teacher',   first_name: 'Kamel', last_name: 'Prof',
               email: 'prof@x.dz', status: 'active',
               establishment_id: '00000000-0000-4000-8000-000000000002',
               wilaya_id: '00000000-0000-4000-8000-000000000001', direction_id: null },
  student:   { id: '00000000-0000-4000-8000-000000000020', role: 'student',
               first_name: 'Yacine', last_name: 'Meziane', email: 'y@x.dz', status: 'active',
               establishment_id: '00000000-0000-4000-8000-000000000002',
               wilaya_id: '00000000-0000-4000-8000-000000000001', direction_id: null },
};

const profile = () => PROFILES[window.__ROLE__ || 'ministry'];

export async function initAuth() {}
export function getState() {
  const p = profile();
  return { user: { id: p.id }, session: { user: { id: p.id } }, profile: p,
           isAuthenticated: true, isActive: true, isPending: false, isRejected: false,
           role: p.role };
}
export function onAuthChange() { return () => {}; }
export async function signInWithPassword() { return getState(); }
export async function signUpWithPassword() { return getState(); }
export async function signOut() {}
export function dashboardPathFor(role) {
  return ({ student: '/etudiant', teacher: '/professeur', admin: '/administration',
            direction: '/direction', ministry: '/ministere' })[role] || '/';
}
export function requireAuth(opts = {}) {
  const s = getState();
  if (opts.role) {
    const roles = Array.isArray(opts.role) ? opts.role : [opts.role];
    if (!roles.includes(s.role)) {
      return { ok: false, redirect: `/__WRONG_ROLE__/${roles.join('|')}` };
    }
  }
  return { ok: true, state: s };
}
