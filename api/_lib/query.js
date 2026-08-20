// ─────────────────────────────────────────────────────────────────────────────
//  Traduction d'un descripteur de requête JSON en SQL paramétré.
//
//  Remplace la couche PostgREST : le client décrit ce qu'il veut, le serveur
//  construit le SQL. Aucun fragment de SQL ne vient du client — les noms de
//  table et de colonne sont validés contre le schéma réel, les valeurs sont
//  toujours des paramètres liés. L'autorisation reste assurée par RLS.
// ─────────────────────────────────────────────────────────────────────────────

const OPERATORS = {
  eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=',
  like: 'like', ilike: 'ilike',
};

class QueryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const q = (id) => `"${String(id).replace(/"/g, '""')}"`;

function assertTable(meta, table) {
  if (!meta.tables.has(table)) throw new QueryError(`Table inconnue : ${table}`, 404);
}

function assertColumn(meta, table, column) {
  const cols = meta.columns.get(table);
  if (!cols || !cols.has(column)) {
    throw new QueryError(`Colonne inconnue : ${table}.${column}`, 400);
  }
}

// ── Analyse d'une chaîne « select » façon PostgREST ──────────────────────────
//    'id, name, wilayas(id, code)'  ou  'specialties!inner(id, name)'
export function parseSelect(input) {
  const src = (input || '*').trim();
  const parts = [];
  let depth = 0, buf = '';
  for (const ch of src) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);

  const columns = [];
  const embeds = [];
  for (const raw of parts) {
    const piece = raw.trim();
    if (!piece) continue;
    const m = piece.match(/^([\w]+)(?:!([\w]+))?\s*\((.*)\)$/s);
    if (m) {
      const [, name, hint, inner] = m;
      embeds.push({
        name,
        inner: hint === 'inner',
        fkName: hint && hint !== 'inner' ? hint : null,
        select: parseSelect(inner),
      });
    } else {
      columns.push(piece);
    }
  }
  return { columns: columns.length ? columns : ['*'], embeds };
}

// ── Résolution d'une relation entre deux tables ──────────────────────────────
function resolveRelation(meta, base, embed) {
  const target = embed.name;
  assertTable(meta, target);

  if (embed.fkName) {
    const fk = meta.fks.find((f) => f.constraint_name === embed.fkName);
    if (!fk) throw new QueryError(`Contrainte inconnue : ${embed.fkName}`, 400);
    if (fk.src_table === base) {
      return { kind: 'one', localCol: fk.src_column, foreignCol: fk.tgt_column, foreignTable: fk.tgt_table };
    }
    return { kind: 'many', localCol: fk.tgt_column, foreignCol: fk.src_column, foreignTable: fk.src_table };
  }

  // base → target  (plusieurs-à-un)
  const toOne = meta.fks.filter((f) => f.src_table === base && f.tgt_table === target);
  if (toOne.length === 1) {
    return { kind: 'one', localCol: toOne[0].src_column, foreignCol: toOne[0].tgt_column, foreignTable: target };
  }
  // target → base  (un-à-plusieurs)
  const toMany = meta.fks.filter((f) => f.src_table === target && f.tgt_table === base);
  if (toMany.length === 1) {
    return { kind: 'many', localCol: toMany[0].tgt_column, foreignCol: toMany[0].src_column, foreignTable: target };
  }

  if (toOne.length > 1 || toMany.length > 1) {
    throw new QueryError(
      `Relation ambiguë entre ${base} et ${target} : précisez la contrainte (${target}!nom_de_contrainte)`, 400);
  }
  throw new QueryError(`Aucune relation entre ${base} et ${target}`, 400);
}

function columnList(meta, table, columns) {
  if (columns.includes('*')) return '*';
  return columns.map((c) => {
    assertColumn(meta, table, c);
    return q(c);
  }).join(', ');
}

// Construit l'expression JSON d'une ressource imbriquée.
function embedExpression(meta, baseAlias, base, embed, params) {
  const rel = resolveRelation(meta, base, embed);
  const t = rel.foreignTable;
  const inner = buildProjection(meta, t, embed.select, params, `e_${embed.name}`);
  const alias = q(`__${embed.name}`);

  const where = `${alias}.${q(rel.foreignCol)} = ${baseAlias}.${q(rel.localCol)}`;

  if (rel.kind === 'one') {
    return `(select to_jsonb(x) from (select ${inner} from ${q(t)} ${alias} where ${where} limit 1) x)`;
  }
  return `coalesce((select jsonb_agg(x) from (select ${inner} from ${q(t)} ${alias} where ${where}) x), '[]'::jsonb)`;
}

function buildProjection(meta, table, parsed, params, aliasPrefix) {
  const alias = aliasPrefix ? q(`__${aliasPrefix.replace(/^e_/, '')}`) : q('b');
  const cols = parsed.columns.includes('*')
    ? `${alias}.*`
    : parsed.columns.map((c) => { assertColumn(meta, table, c); return `${alias}.${q(c)}`; }).join(', ');

  const embedCols = parsed.embeds.map((e) =>
    `${embedExpression(meta, alias, table, e, params)} as ${q(e.name)}`);

  return [cols, ...embedCols].filter(Boolean).join(', ');
}

// ── Filtres ─────────────────────────────────────────────────────────────────
function buildFilters(meta, table, filters, params, baseAlias, parsedEmbeds = []) {
  const clauses = [];

  for (const f of filters || []) {
    const { op, col, val } = f;
    if (typeof col !== 'string') throw new QueryError('Filtre invalide.');

    // Filtre portant sur une ressource imbriquée : specialties.establishment_id
    if (col.includes('.')) {
      const [embedName, embedCol] = col.split('.');
      const embed = parsedEmbeds.find((e) => e.name === embedName)
        || { name: embedName, inner: true, fkName: null, select: { columns: ['*'], embeds: [] } };
      const rel = resolveRelation(meta, table, embed);
      assertColumn(meta, rel.foreignTable, embedCol);
      const a = q(`__f_${embedName}`);
      const sub = `exists (select 1 from ${q(rel.foreignTable)} ${a}
        where ${a}.${q(rel.foreignCol)} = ${baseAlias}.${q(rel.localCol)}
          and ${a}.${q(embedCol)} ${operatorSQL(op, val, params)})`;
      clauses.push(sub);
      continue;
    }

    assertColumn(meta, table, col);
    clauses.push(`${baseAlias}.${q(col)} ${operatorSQL(op, val, params)}`);
  }

  // `!inner` : la ressource imbriquée doit exister
  for (const e of parsedEmbeds) {
    if (!e.inner) continue;
    const rel = resolveRelation(meta, table, e);
    const a = q(`__i_${e.name}`);
    clauses.push(`exists (select 1 from ${q(rel.foreignTable)} ${a}
      where ${a}.${q(rel.foreignCol)} = ${baseAlias}.${q(rel.localCol)})`);
  }

  return clauses;
}

function operatorSQL(op, val, params) {
  if (op === 'is') {
    if (val === null || val === 'null') return 'is null';
    if (val === true || val === 'true') return 'is true';
    if (val === false || val === 'false') return 'is false';
    throw new QueryError('`is` accepte null, true ou false.');
  }
  if (op === 'in') {
    if (!Array.isArray(val)) throw new QueryError('`in` attend un tableau.');
    if (val.length === 0) return '= any(array[]::text[])';
    params.push(val);
    return `= any($${params.length})`;
  }
  const sqlOp = OPERATORS[op];
  if (!sqlOp) throw new QueryError(`Opérateur non supporté : ${op}`);
  params.push(val);
  return `${sqlOp} $${params.length}`;
}

// ── Construction complète ───────────────────────────────────────────────────
export function buildQuery(meta, desc) {
  const {
    table, action = 'select', select = '*', filters = [], order = [],
    limit, offset, values, onConflict, count, head, ignoreDuplicates,
  } = desc || {};

  if (!table || typeof table !== 'string') throw new QueryError('Table manquante.');
  assertTable(meta, table);

  const params = [];
  const parsed = parseSelect(select);
  const B = q('b');

  if (action === 'select') {
    const projection = head ? '1' : buildProjection(meta, table, parsed, params, null);
    const where = buildFilters(meta, table, filters, params, B, parsed.embeds);

    let sql = `select ${count === 'exact' && head ? 'count(*)::bigint as __count' : projection}`
      + ` from ${q(table)} ${B}`;
    if (where.length) sql += ` where ${where.join(' and ')}`;

    if (!head) {
      if (order.length) {
        sql += ' order by ' + order.map((o) => {
          assertColumn(meta, table, o.col);
          return `${B}.${q(o.col)} ${o.asc === false ? 'desc' : 'asc'}`
            + ` nulls ${o.nullsFirst ? 'first' : 'last'}`;
        }).join(', ');
      }
      if (Number.isInteger(limit)) { params.push(limit); sql += ` limit $${params.length}`; }
      if (Number.isInteger(offset)) { params.push(offset); sql += ` offset $${params.length}`; }
    }
    return { text: sql, values: params, wantsCount: count === 'exact' };
  }

  if (action === 'insert' || action === 'upsert') {
    const rows = Array.isArray(values) ? values : [values];
    if (!rows.length || !rows[0] || typeof rows[0] !== 'object') {
      throw new QueryError('Aucune donnée à insérer.');
    }
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    cols.forEach((c) => assertColumn(meta, table, c));

    const tuples = rows.map((r) => '(' + cols.map((c) => {
      params.push(r[c] === undefined ? null : r[c]);
      return `$${params.length}`;
    }).join(', ') + ')').join(', ');

    let sql = `insert into ${q(table)} (${cols.map(q).join(', ')}) values ${tuples}`;

    if (action === 'upsert') {
      const conflictCols = (onConflict || meta.primaryKey.get(table) || 'id')
        .split(',').map((c) => c.trim());
      conflictCols.forEach((c) => assertColumn(meta, table, c));
      sql += ` on conflict (${conflictCols.map(q).join(', ')})`;
      if (ignoreDuplicates) {
        sql += ' do nothing';
      } else {
        const updatable = cols.filter((c) => !conflictCols.includes(c));
        sql += updatable.length
          ? ' do update set ' + updatable.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')
          : ' do nothing';
      }
    }

    sql += ` returning ${parsed.columns.includes('*') ? '*' : columnList(meta, table, parsed.columns)}`;
    return { text: sql, values: params, wrapEmbeds: parsed.embeds.length ? { table, parsed } : null };
  }

  if (action === 'update') {
    if (!values || typeof values !== 'object') throw new QueryError('Aucune donnée à mettre à jour.');
    const cols = Object.keys(values);
    if (!cols.length) throw new QueryError('Aucun champ à mettre à jour.');
    cols.forEach((c) => assertColumn(meta, table, c));

    const sets = cols.map((c) => {
      params.push(values[c] === undefined ? null : values[c]);
      return `${q(c)} = $${params.length}`;
    }).join(', ');

    const where = buildFilters(meta, table, filters, params, q(table), []);
    if (!where.length) throw new QueryError('Une mise à jour sans filtre est refusée.', 400);

    const sql = `update ${q(table)} set ${sets} where ${where.join(' and ')}`
      + ` returning ${parsed.columns.includes('*') ? '*' : columnList(meta, table, parsed.columns)}`;
    return { text: sql, values: params, wrapEmbeds: parsed.embeds.length ? { table, parsed } : null };
  }

  if (action === 'delete') {
    const where = buildFilters(meta, table, filters, params, q(table), []);
    if (!where.length) throw new QueryError('Une suppression sans filtre est refusée.', 400);
    const sql = `delete from ${q(table)} where ${where.join(' and ')} returning *`;
    return { text: sql, values: params };
  }

  throw new QueryError(`Action inconnue : ${action}`);
}

export { QueryError };
