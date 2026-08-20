// ─────────────────────────────────────────────────────────────────────────────
//  Accès PostgreSQL côté serveur.
//
//  Point essentiel : chaque requête d'un utilisateur s'exécute dans une
//  transaction où `request.jwt.claim.sub` est posé à partir d'un jeton
//  VÉRIFIÉ côté serveur, sous un rôle non privilégié. Les politiques RLS
//  écrites pour Supabase s'appliquent donc telles quelles — et le client ne
//  peut plus choisir son identité, contrairement au modèle à clé anonyme.
// ─────────────────────────────────────────────────────────────────────────────

import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[cursus] DATABASE_URL absent — l’API ne peut pas démarrer.');
}

const isLocal = /localhost|127\.0\.0\.1|host\.docker\.internal/.test(connectionString || '');

// Erreur explicite et distinguable d'une panne : l'API est joignable mais la
// plateforme n'est pas encore raccordée à une base.
export class NotConfiguredError extends Error {
  constructor() {
    super('Plateforme non configurée : définissez DATABASE_URL et AUTH_SECRET.');
    this.status = 503;
  }
}

function assertConfigured() {
  if (!connectionString) throw new NotConfiguredError();
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new NotConfiguredError();
}

// Un seul pool par instance de fonction (réutilisé entre invocations tièdes).
let _pool = null;
export function pool() {
  assertConfigured();
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
    });
    _pool.on('error', (e) => console.error('[pg] erreur de pool', e.message));
  }
  return _pool;
}

// Rôle non privilégié sous lequel tournent les requêtes utilisateur.
const APP_ROLE = process.env.PG_APP_ROLE || 'app_authenticated';

/**
 * Exécute `fn(client)` dans une transaction cloisonnée par RLS.
 * @param {string|null} userId  identité vérifiée, ou null pour un accès anonyme
 */
export async function withUser(userId, fn) {
  const client = await pool().connect();
  try {
    await client.query('begin');
    // set_config(..., true) = local à la transaction : aucune fuite entre
    // requêtes qui réutiliseraient la même connexion du pool.
    await client.query('select set_config($1, $2, true)',
      ['request.jwt.claim.sub', userId || '']);
    await client.query('select set_config($1, $2, true)',
      ['request.jwt.claim.role', userId ? 'authenticated' : 'anon']);
    await client.query(`set local role ${APP_ROLE}`);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    try { await client.query('rollback'); } catch (_) { /* connexion perdue */ }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Exécute `fn(client)` avec les pleins droits (propriétaire), sans RLS.
 * Réservé à l'authentification, qui doit lire auth.users avant qu'une
 * identité n'existe. Jamais exposé à une requête cliente.
 */
export async function withPrivileged(fn) {
  const client = await pool().connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    try { await client.query('rollback'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

// ── Métadonnées du schéma (mises en cache par instance) ─────────────────────

let _meta = null;

export async function schemaMeta() {
  if (_meta) return _meta;
  const client = await pool().connect();
  try {
    const tables = await client.query(`
      select table_name, table_type
      from information_schema.tables
      where table_schema = 'public'`);

    const cols = await client.query(`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'`);

    const fks = await client.query(`
      select
        con.conname                            as constraint_name,
        src.relname                            as src_table,
        srccol.attname                         as src_column,
        tgt.relname                            as tgt_table,
        tgtcol.attname                         as tgt_column
      from pg_constraint con
      join pg_class src        on src.oid = con.conrelid
      join pg_class tgt        on tgt.oid = con.confrelid
      join pg_namespace nsp    on nsp.oid = src.relnamespace
      join lateral unnest(con.conkey)  with ordinality as sk(attnum, ord) on true
      join lateral unnest(con.confkey) with ordinality as tk(attnum, ord) on sk.ord = tk.ord
      join pg_attribute srccol on srccol.attrelid = con.conrelid and srccol.attnum = sk.attnum
      join pg_attribute tgtcol on tgtcol.attrelid = con.confrelid and tgtcol.attnum = tk.attnum
      where con.contype = 'f' and nsp.nspname = 'public'`);

    const pks = await client.query(`
      select cl.relname as table_name, a.attname as column_name
      from pg_index i
      join pg_class cl      on cl.oid = i.indrelid
      join pg_namespace n   on n.oid = cl.relnamespace
      join pg_attribute a   on a.attrelid = cl.oid and a.attnum = any(i.indkey)
      where i.indisprimary and n.nspname = 'public'`);

    const columns = new Map();
    for (const r of cols.rows) {
      if (!columns.has(r.table_name)) columns.set(r.table_name, new Set());
      columns.get(r.table_name).add(r.column_name);
    }
    const primaryKey = new Map();
    for (const r of pks.rows) primaryKey.set(r.table_name, r.column_name);

    _meta = {
      tables: new Set(tables.rows.map((r) => r.table_name)),
      columns,
      primaryKey,
      fks: fks.rows,
    };
    return _meta;
  } finally {
    client.release();
  }
}

// Traduction des erreurs PostgreSQL en réponses HTTP compréhensibles.
export function pgErrorStatus(err) {
  switch (err.code) {
    case '42501': return 403;               // droits insuffisants / policy
    case '23505': return 409;               // doublon
    case '23503': return 409;               // clé étrangère
    case '23514': case '22P02': return 400; // contrainte / format
    case '42P01': case '42883': return 404; // table / fonction inconnue
    case '57014': return 504;               // statement_timeout
    default: return err.code?.startsWith('P0') ? 400 : 500;
  }
}
