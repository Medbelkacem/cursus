// ─────────────────────────────────────────────────────────────────────────────
//  /api/db — exécution des requêtes de données.
//
//  Remplace PostgREST. Le client envoie un descripteur JSON ; le serveur
//  construit un SQL entièrement paramétré, valide les noms contre le schéma
//  réel, et l'exécute sous l'identité vérifiée de l'appelant — donc soumis à
//  RLS. Aucun fragment de SQL fourni par le client n'atteint la base.
// ─────────────────────────────────────────────────────────────────────────────

import { withUser, schemaMeta, pgErrorStatus } from './_lib/pg.js';
import { json, fail, readJSON, methodGuard } from './_lib/http.js';
import { currentUser } from './_lib/session.js';
import { buildQuery, QueryError } from './_lib/query.js';

// Tables jamais atteignables par cette route, même si RLS les protège déjà :
// défense en profondeur.
const DENY = new Set(['schema_migrations']);

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  try {
    const user = await currentUser(req, res);
    const body = await readJSON(req);
    const ops = Array.isArray(body?.ops) ? body.ops : [body];

    if (ops.length === 0 || ops.length > 20) {
      return fail(res, 400, 'Entre 1 et 20 opérations par requête.');
    }

    const meta = await schemaMeta();

    for (const op of ops) {
      if (DENY.has(op?.table)) return fail(res, 403, 'Table non accessible.');
      // Les écritures exigent une identité : RLS refuserait de toute façon,
      // mais autant répondre clairement.
      if (op?.action && op.action !== 'select' && !user) {
        return fail(res, 401, 'Authentification requise.');
      }
    }

    const results = await withUser(user?.id || null, async (client) => {
      const out = [];
      for (const op of ops) {
        const { text, values, wantsCount } = buildQuery(meta, op);
        const r = await client.query(text, values);

        let count = null;
        if (wantsCount && op.head) {
          count = Number(r.rows[0]?.__count ?? 0);
          out.push({ data: null, count });
          continue;
        }
        if (wantsCount) {
          const { text: cText, values: cValues } =
            buildQuery(meta, { ...op, head: true, count: 'exact', select: '*', order: [], limit: undefined, offset: undefined });
          const cr = await client.query(cText, cValues);
          count = Number(cr.rows[0]?.__count ?? 0);
        }

        let data = r.rows;
        if (op.single === 'maybe') data = r.rows[0] ?? null;
        else if (op.single === 'one') {
          if (r.rows.length !== 1) {
            throw new QueryError(
              `Attendu exactement une ligne, ${r.rows.length} obtenue(s).`, 406);
          }
          data = r.rows[0];
        }
        out.push({ data, count });
      }
      return out;
    });

    return json(res, 200, ops.length === 1 ? results[0] : { results });
  } catch (err) {
    if (err instanceof QueryError) return fail(res, err.status, err.message);
    const status = err.status || pgErrorStatus(err);
    if (status >= 500) console.error('[api/db]', err);
    return fail(res, status, status >= 500 ? 'Erreur serveur.' : err.message,
      err.detail ? { detail: err.detail } : {});
  }
}
