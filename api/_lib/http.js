// Utilitaires HTTP partagés par les fonctions serverless.

export const SESSION_COOKIE = 'cursus_session';

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function fail(res, status, message, extra = {}) {
  json(res, status, { error: { message, ...extra } });
}

export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setCookie(res, name, value, opts = {}) {
  const {
    maxAge, httpOnly = true, sameSite = 'Lax', path = '/',
    secure = process.env.NODE_ENV !== 'development',
  } = opts;
  const bits = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) bits.push('HttpOnly');
  if (secure) bits.push('Secure');
  if (maxAge != null) bits.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('Set-Cookie', [...list, bits.join('; ')]);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

// Corps JSON (Vercel le parse déjà ; on gère aussi le flux brut en local).
export async function readJSON(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 6 * 1024 * 1024) throw Object.assign(new Error('corps trop volumineux'), { status: 413 });
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON invalide'), { status: 400 }); }
}

export function methodGuard(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  fail(res, 405, `Méthode ${req.method} non autorisée.`);
  return false;
}
