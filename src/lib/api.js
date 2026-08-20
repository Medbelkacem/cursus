// ─────────────────────────────────────────────────────────────────────────────
//  Client de données — remplace @supabase/supabase-js.
//
//  Expose volontairement la même forme chaînable que l'ancien client, afin que
//  `db.js` et les pages restent inchangés :
//
//     api.from('wilayas').select('*').order('code')          → { data, error }
//     api.rpc('stats_national')                              → { data, error }
//     api.storage.from('contracts').upload(path, file)
//
//  Différence de fond : plus aucune clé n'est embarquée dans le navigateur et
//  la session vit dans un cookie httpOnly. L'identité est établie par le
//  serveur, jamais déclarée par le client.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/api';

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    // Compatibilité avec le code qui lisait err.code
    this.code = status === 403 ? '42501' : status === 409 ? '23505' : String(status);
  }
}

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });

  let body = null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try { body = await res.json(); } catch { /* réponse vide */ }
  }

  if (!res.ok) {
    const msg = body?.error?.message || `Erreur ${res.status}`;
    throw new ApiError(msg, res.status, body?.error?.detail);
  }
  return body;
}

// ── Constructeur de requête ─────────────────────────────────────────────────
class QueryBuilder {
  constructor(table) {
    this._d = { table, action: 'select', select: '*', filters: [], order: [] };
  }

  select(cols = '*', opts = {}) {
    this._d.select = cols;
    if (opts.count) this._d.count = opts.count;
    if (opts.head) this._d.head = true;
    if (this._d.action === 'select') this._d.action = 'select';
    return this;
  }

  insert(values)  { this._d.action = 'insert'; this._d.values = values; return this; }
  update(values)  { this._d.action = 'update'; this._d.values = values; return this; }
  delete()        { this._d.action = 'delete'; return this; }
  upsert(values, opts = {}) {
    this._d.action = 'upsert';
    this._d.values = values;
    if (opts.onConflict) this._d.onConflict = opts.onConflict;
    if (opts.ignoreDuplicates) this._d.ignoreDuplicates = true;
    return this;
  }

  eq(col, val)  { this._d.filters.push({ op: 'eq',  col, val }); return this; }
  neq(col, val) { this._d.filters.push({ op: 'neq', col, val }); return this; }
  gt(col, val)  { this._d.filters.push({ op: 'gt',  col, val }); return this; }
  gte(col, val) { this._d.filters.push({ op: 'gte', col, val }); return this; }
  lt(col, val)  { this._d.filters.push({ op: 'lt',  col, val }); return this; }
  lte(col, val) { this._d.filters.push({ op: 'lte', col, val }); return this; }
  like(col, val)  { this._d.filters.push({ op: 'like',  col, val }); return this; }
  ilike(col, val) { this._d.filters.push({ op: 'ilike', col, val }); return this; }
  is(col, val)  { this._d.filters.push({ op: 'is', col, val }); return this; }
  in(col, val)  { this._d.filters.push({ op: 'in', col, val }); return this; }

  order(col, opts = {}) {
    this._d.order.push({ col, asc: opts.ascending !== false, nullsFirst: !!opts.nullsFirst });
    return this;
  }
  limit(n)  { this._d.limit = n; return this; }
  range(from, to) { this._d.offset = from; this._d.limit = to - from + 1; return this; }

  maybeSingle() { this._d.single = 'maybe'; return this; }
  single()      { this._d.single = 'one';   return this; }

  // Rend l'objet « thenable » : `await api.from(...).select(...)` fonctionne.
  then(onOk, onErr) {
    return request('/db', { method: 'POST', body: JSON.stringify(this._d) })
      .then((r) => ({ data: r.data, error: null, count: r.count ?? null }))
      .then(onOk, onErr ? (e) => onErr(e) : undefined)
      .catch((e) => {
        if (onErr) return onErr(e);
        return { data: null, error: e, count: null };
      });
  }
  catch(fn) { return this.then(undefined, fn); }
  finally(fn) { return this.then().finally(fn); }
}

// ── Stockage ────────────────────────────────────────────────────────────────
function storageBucket(bucket) {
  return {
    async upload(path, file, opts = {}) {
      try {
        const res = await fetch(
          `${BASE}/storage?action=upload&bucket=${encodeURIComponent(bucket)}`
          + `&path=${encodeURIComponent(path)}`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': opts.contentType || file.type || 'application/octet-stream' },
            body: file,
          });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new ApiError(body?.error?.message || `Erreur ${res.status}`, res.status);
        return { data: body.data, error: null };
      } catch (error) { return { data: null, error }; }
    },

    async createSignedUrl(path, _expiresIn) {
      try {
        const body = await request(
          `/storage?action=sign&bucket=${encodeURIComponent(bucket)}`
          + `&path=${encodeURIComponent(path)}`, { method: 'POST' });
        return { data: body.data, error: null };
      } catch (error) { return { data: null, error }; }
    },

    async remove(paths) {
      try {
        const body = await request(
          `/storage?action=remove&bucket=${encodeURIComponent(bucket)}`
          + `&paths=${encodeURIComponent(paths.join('|'))}`, { method: 'POST' });
        return { data: body.data, error: null };
      } catch (error) { return { data: null, error }; }
    },
  };
}

// ── Client ──────────────────────────────────────────────────────────────────
const client = {
  from: (table) => new QueryBuilder(table),

  async rpc(fn, args = {}) {
    try {
      const body = await request('/rpc', { method: 'POST', body: JSON.stringify({ fn, args }) });
      return { data: body.data, error: null };
    } catch (error) { return { data: null, error }; }
  },

  storage: { from: storageBucket },

  // Fonctions serveur ponctuelles (envoi de courriel, etc.).
  functions: {
    async invoke(name, { body } = {}) {
      try {
        const data = await request(`/${name}`, { method: 'POST', body: JSON.stringify(body || {}) });
        return { data, error: null };
      } catch (error) { return { data: null, error }; }
    },
  },

  auth: {
    async signInWithPassword({ email, password }) {
      try {
        const body = await request('/auth/login',
          { method: 'POST', body: JSON.stringify({ email, password }) });
        return { data: body, error: null };
      } catch (error) { return { data: null, error }; }
    },
    async signUp({ email, password, options = {} }) {
      try {
        const body = await request('/auth/signup',
          { method: 'POST', body: JSON.stringify({ email, password, metadata: options.data || {} }) });
        return { data: body, error: null };
      } catch (error) { return { data: null, error }; }
    },
    async signOut() {
      try { await request('/auth/logout', { method: 'POST' }); return { error: null }; }
      catch (error) { return { error }; }
    },
    async getSession() {
      try {
        const body = await request('/auth/session');
        return { data: { session: body.user ? { user: body.user, profile: body.profile } : null },
                 error: null };
      } catch (error) { return { data: { session: null }, error }; }
    },
    async changePassword(currentPassword, newPassword) {
      try {
        await request('/auth/password',
          { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
        return { error: null };
      } catch (error) { return { error }; }
    },
  },
};

let _configured = false;

export function initApi() {
  _configured = true;
  return client;
}

export function getApi() { return _configured ? client : null; }
export function isApiConfigured() { return _configured; }
export { client as api, ApiError };
