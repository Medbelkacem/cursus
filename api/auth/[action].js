// ─────────────────────────────────────────────────────────────────────────────
//  /api/auth/{login|signup|logout|session|password}
//
//  Remplace GoTrue. Le jeton de session ne quitte jamais le cookie httpOnly :
//  même en cas de faille XSS, il ne peut pas être lu par du JavaScript.
// ─────────────────────────────────────────────────────────────────────────────

import { withPrivileged, withUser, pgErrorStatus } from '../_lib/pg.js';
import { json, fail, readJSON, methodGuard } from '../_lib/http.js';
import {
  createSession, currentUser, destroySession, revokeAll,
  rateLimit, logLogin, clientIP,
} from '../_lib/session.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Profil complet renvoyé au client (identique à ce que lisait l'ancien code).
async function loadProfile(userId) {
  return withUser(userId, async (c) => {
    const r = await c.query('select * from public.profiles where id = $1', [userId]);
    return r.rows[0] || null;
  });
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '').toLowerCase();

  try {
    switch (action) {
      // ── Connexion ───────────────────────────────────────────────────────
      case 'login': {
        if (!methodGuard(req, res, ['POST'])) return;
        const { email, password } = await readJSON(req);

        if (!email || !password) return fail(res, 400, 'Email et mot de passe requis.');

        // Deux limites : par adresse IP (attaque distribuée sur un compte)
        // et par compte (bourrage d'identifiants).
        const byIP = await rateLimit(`login:ip:${clientIP(req)}`, 20);
        if (!byIP.allowed) {
          await logLogin({ email, success: false, reason: 'rate_limit_ip', req });
          res.setHeader('Retry-After', String(byIP.retry_after));
          return fail(res, 429, 'Trop de tentatives. Réessayez dans quelques minutes.');
        }
        const byAccount = await rateLimit(`login:acct:${String(email).toLowerCase()}`, 10);
        if (!byAccount.allowed) {
          await logLogin({ email, success: false, reason: 'rate_limit_account', req });
          res.setHeader('Retry-After', String(byAccount.retry_after));
          return fail(res, 429, 'Trop de tentatives sur ce compte. Réessayez plus tard.');
        }

        const auth = await withPrivileged(async (c) => {
          const r = await c.query('select * from auth.authenticate($1, $2)', [email, password]);
          return r.rows[0] || null;
        });

        if (!auth) {
          await logLogin({ email, success: false, reason: 'bad_credentials', req });
          // Message volontairement identique quel que soit le motif.
          return fail(res, 401, 'Identifiants incorrects.');
        }
        if (auth.locked) {
          await logLogin({ email, userId: auth.id, success: false, reason: 'locked', req });
          return fail(res, 423, 'Compte temporairement verrouillé après plusieurs échecs.');
        }

        await createSession(auth.id, req, res);
        await logLogin({ email, userId: auth.id, success: true, req });
        return json(res, 200, { user: { id: auth.id, email: auth.email },
                                profile: await loadProfile(auth.id) });
      }

      // ── Inscription (compte en attente de validation) ────────────────────
      case 'signup': {
        if (!methodGuard(req, res, ['POST'])) return;
        const body = await readJSON(req);
        const { email, password, metadata = {} } = body;

        if (!email || !EMAIL_RE.test(email)) return fail(res, 400, 'Adresse email invalide.');

        const byIP = await rateLimit(`signup:ip:${clientIP(req)}`, 5, 3600);
        if (!byIP.allowed) return fail(res, 429, 'Trop d’inscriptions depuis cette adresse.');

        // Seuls étudiant et professeur peuvent s'auto-inscrire : les rôles
        // d'administration sont créés par une autorité supérieure (§2, §6).
        const role = ['student', 'teacher'].includes(metadata.role) ? metadata.role : 'student';

        try {
          const userId = await withPrivileged(async (c) => {
            await c.query('select auth.check_password_policy($1, $2)', [password, email]);

            const dup = await c.query('select 1 from auth.users where lower(email) = lower($1)', [email]);
            if (dup.rows.length) {
              throw Object.assign(new Error('Un compte existe déjà avec cette adresse.'), { status: 409 });
            }

            const r = await c.query(
              `insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
               values (lower($1), auth.hash_password($2), now(), $3)
               returning id`,
              [email, password, JSON.stringify({ ...metadata, role })]);
            return r.rows[0].id;
          });

          // Pas de session : le compte reste « pending » jusqu'à validation.
          return json(res, 201, {
            user: { id: userId, email },
            needsApproval: true,
            message: 'Compte créé. Il doit être activé par votre administration.',
          });
        } catch (e) {
          if (e.status) return fail(res, e.status, e.message);
          if (e.code === '22023') return fail(res, 400, e.message);
          throw e;
        }
      }

      // ── Déconnexion ─────────────────────────────────────────────────────
      case 'logout': {
        if (!methodGuard(req, res, ['POST'])) return;
        await destroySession(req, res);
        return json(res, 200, { ok: true });
      }

      // ── Session courante ────────────────────────────────────────────────
      case 'session': {
        if (!methodGuard(req, res, ['GET'])) return;
        const user = await currentUser(req, res);
        if (!user) return json(res, 200, { user: null, profile: null });
        const profile = await loadProfile(user.id);
        return json(res, 200, { user: { id: user.id }, profile });
      }

      // ── Changement de mot de passe ──────────────────────────────────────
      case 'password': {
        if (!methodGuard(req, res, ['POST'])) return;
        const user = await currentUser(req, res);
        if (!user) return fail(res, 401, 'Non authentifié.');

        const { currentPassword, newPassword } = await readJSON(req);
        if (!currentPassword || !newPassword) {
          return fail(res, 400, 'Mot de passe actuel et nouveau mot de passe requis.');
        }

        const ok = await withPrivileged(async (c) => {
          const u = await c.query('select email from auth.users where id = $1', [user.id]);
          if (!u.rows.length) return false;
          const a = await c.query('select * from auth.authenticate($1, $2)',
            [u.rows[0].email, currentPassword]);
          return a.rows.length > 0 && !a.rows[0].locked;
        });
        if (!ok) return fail(res, 401, 'Mot de passe actuel incorrect.');

        try {
          await withPrivileged((c) => c.query('select auth.set_password($1, $2)', [user.id, newPassword]));
        } catch (e) {
          if (e.code === '22023') return fail(res, 400, e.message);
          throw e;
        }

        // Un changement de mot de passe invalide toutes les autres sessions.
        await revokeAll(user.id);
        await createSession(user.id, req, res);
        return json(res, 200, { ok: true });
      }

      default:
        return fail(res, 404, `Action inconnue : ${action}`);
    }
  } catch (err) {
    console.error('[api/auth]', action, err);
    const status = err.status || pgErrorStatus(err);
    return fail(res, status, status >= 500 ? 'Erreur serveur.' : err.message);
  }
}
