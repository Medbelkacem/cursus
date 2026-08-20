#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Applique les migrations SQL à la base désignée par DATABASE_URL.
//
//    node scripts/migrate.mjs            # applique ce qui manque
//    node scripts/migrate.mjs --status   # liste sans rien appliquer
//    node scripts/migrate.mjs --seed     # applique puis exécute db/setup/*.sql
//
//  Chaque fichier s'exécute dans une transaction et est enregistré dans
//  `public.schema_migrations` : relancer la commande est sans effet.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');
const SETUP_DIR = join(ROOT, 'db', 'setup');

const args = new Set(process.argv.slice(2));
const STATUS_ONLY = args.has('--status');
const WITH_SEED = args.has('--seed');

// Charge .env.local puis .env s'ils existent (sans dépendance)
function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const f = join(ROOT, name);
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}
loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL absent. Définissez-le dans .env ou dans l’environnement.');
  console.error('Exemple : postgres://user:pass@host/db?sslmode=require');
  process.exit(1);
}

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  create table if not exists public.schema_migrations (
    name       text primary key,
    checksum   text not null,
    applied_at timestamptz not null default now()
  )`);

const { rows } = await client.query('select name, checksum from public.schema_migrations');
const applied = new Map(rows.map((r) => [r.name, r.checksum]));

let pending = 0, drifted = 0;
for (const f of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
  const sum = sha(sql);
  if (applied.has(f)) {
    if (applied.get(f) !== sum) {
      drifted++;
      console.log(`  ~ ${f} — déjà appliquée mais le fichier a changé depuis`);
    }
    continue;
  }
  pending++;
  if (STATUS_ONLY) { console.log(`  + ${f} — à appliquer`); continue; }

  process.stdout.write(`  → ${f} … `);
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query(
      'insert into public.schema_migrations (name, checksum) values ($1, $2)', [f, sum]);
    await client.query('commit');
    console.log('ok');
  } catch (e) {
    await client.query('rollback');
    console.log('ÉCHEC');
    console.error(`\n${f} : ${e.message}\n`);
    if (e.position) {
      const around = sql.slice(Math.max(0, e.position - 200), Number(e.position) + 200);
      console.error('--- extrait ---\n' + around + '\n---------------');
    }
    await client.end();
    process.exit(1);
  }
}

if (STATUS_ONLY) {
  console.log(pending ? `\n${pending} migration(s) en attente.` : '\nBase à jour.');
} else {
  console.log(pending ? `\n${pending} migration(s) appliquée(s).` : '\nBase déjà à jour.');
}
if (drifted) {
  console.log(`${drifted} fichier(s) modifié(s) après application — créez plutôt une nouvelle migration.`);
}

if (WITH_SEED && existsSync(SETUP_DIR)) {
  const setups = readdirSync(SETUP_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const f of setups) {
    process.stdout.write(`  → setup/${f} … `);
    const sql = readFileSync(join(SETUP_DIR, f), 'utf8');
    try {
      const res = await client.query(sql);
      console.log('ok');
      const last = Array.isArray(res) ? res[res.length - 1] : res;
      if (last?.rows?.length) console.table(last.rows);
    } catch (e) {
      console.log('ÉCHEC');
      console.error(`${f} : ${e.message}`);
    }
  }
}

await client.end();
