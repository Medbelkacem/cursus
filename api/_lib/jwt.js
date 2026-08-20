// JWT HS256 — signature et vérification sans dépendance (node:crypto).
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const SECRET = process.env.AUTH_SECRET || '';

if (!SECRET || SECRET.length < 32) {
  console.error('[cursus] AUTH_SECRET manquant ou trop court (32 caractères minimum).');
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const fromB64url = (s) => Buffer.from(s, 'base64url');

export function sign(payload, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${head}.${b64url(JSON.stringify(body))}`;
  const sig = b64url(createHmac('sha256', SECRET).update(data).digest());
  return `${data}.${sig}`;
}

export function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const data = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', SECRET).update(data).digest();
  const given = fromB64url(parts[2]);
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  let payload;
  try { payload = JSON.parse(fromB64url(parts[1]).toString('utf8')); }
  catch { return null; }

  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export const newToken = () => randomBytes(32).toString('base64url');
