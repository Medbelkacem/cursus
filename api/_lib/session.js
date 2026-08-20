// Sessions : jeton signé en cookie httpOnly + ligne révocable en base.
import { withPrivileged } from './pg.js';
import { sign, verify, newToken } from './jwt.js';
import { SESSION_COOKIE, parseCookies, setCookie, clearCookie } from './http.js';

const ACCESS_TTL  = 60 * 60 * 8;            // 8 h
const SESSION_TTL = 60 * 60 * 24 * 14;      // 14 j

export const clientIP = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  || req.socket?.remoteAddress || 'inconnu';

export async function createSession(userId, req, res) {
  const refresh = newToken();
  await withPrivileged(async (c) => {
    await c.query(
      `insert into auth.sessions (user_id, refresh_token, user_agent, ip, expires_at)
       values ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
      [userId, refresh, String(req.headers['user-agent'] || '').slice(0, 300),
       clientIP(req), SESSION_TTL]);
  });

  const token = sign({ sub: userId, sid: refresh, role: 'authenticated' }, ACCESS_TTL);
  setCookie(res, SESSION_COOKIE, token, { maxAge: SESSION_TTL });
  return token;
}

/**
 * Identité de l'appelant, ou null.
 * Le jeton est vérifié cryptographiquement PUIS confronté à la base : une
 * session révoquée cesse d'être valide immédiatement, sans attendre l'expiration.
 */
export async function currentUser(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const payload = verify(token);
  if (!payload?.sub || !payload?.sid) return null;

  const row = await withPrivileged(async (c) => {
    const r = await c.query(
      `select s.user_id, s.expires_at, u.is_active
         from auth.sessions s
         join auth.users u on u.id = s.user_id
        where s.refresh_token = $1 and s.revoked_at is null and s.expires_at > now()`,
      [payload.sid]);
    if (!r.rows.length) return null;
    await c.query('update auth.sessions set last_seen_at = now() where refresh_token = $1',
      [payload.sid]);
    return r.rows[0];
  });

  if (!row || row.user_id !== payload.sub || !row.is_active) return null;

  // Prolongation glissante : au-delà de la moitié de vie du jeton, on le réémet.
  const remaining = payload.exp - Math.floor(Date.now() / 1000);
  if (res && remaining < ACCESS_TTL / 2) {
    setCookie(res, SESSION_COOKIE,
      sign({ sub: payload.sub, sid: payload.sid, role: 'authenticated' }, ACCESS_TTL),
      { maxAge: SESSION_TTL });
  }

  return { id: payload.sub, sid: payload.sid };
}

export async function destroySession(req, res) {
  const payload = verify(parseCookies(req)[SESSION_COOKIE]);
  if (payload?.sid) {
    await withPrivileged((c) =>
      c.query('update auth.sessions set revoked_at = now() where refresh_token = $1', [payload.sid]));
  }
  clearCookie(res, SESSION_COOKIE);
}

// Révoque toutes les sessions d'un compte (changement de mot de passe, blocage).
export async function revokeAll(userId) {
  await withPrivileged((c) =>
    c.query('update auth.sessions set revoked_at = now() where user_id = $1 and revoked_at is null',
      [userId]));
}

export async function rateLimit(bucket, limit, windowSeconds = 900) {
  return withPrivileged(async (c) => {
    const r = await c.query(
      'select * from auth.rate_limit_hit($1, $2, make_interval(secs => $3))',
      [bucket, limit, windowSeconds]);
    return r.rows[0];
  });
}

export async function logLogin({ email, userId, success, reason, req }) {
  try {
    await withPrivileged((c) => c.query(
      `insert into auth.login_log (email, user_id, success, reason, ip, user_agent)
       values ($1, $2, $3, $4, $5, $6)`,
      [email || null, userId || null, success, reason || null, clientIP(req),
       String(req.headers['user-agent'] || '').slice(0, 300)]));
  } catch (e) {
    console.warn('[auth] journalisation impossible', e.message);
  }
}
