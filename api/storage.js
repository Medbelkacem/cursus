// ─────────────────────────────────────────────────────────────────────────────
//  /api/storage — dépôt, téléchargement et suppression de fichiers.
//
//  Remplace Supabase Storage. Les octets sont conservés dans PostgreSQL et
//  l'accès reste gouverné par les politiques RLS de `storage.objects` : un
//  étudiant n'atteint que ses propres pièces, l'administration celles de son
//  périmètre.
//
//  Les liens de téléchargement sont des jetons signés à durée de vie courte.
//  Ils portent l'identité du demandeur : la vérification RLS est refaite au
//  moment du téléchargement, un lien ne confère donc aucun droit propre.
//
//  Limite de taille : 4 Mo, imposée par la taille maximale du corps d'une
//  fonction serverless Vercel. Pour des fichiers plus lourds, brancher un
//  stockage d'objets externe (la colonne `data` devient alors une clé).
// ─────────────────────────────────────────────────────────────────────────────

import { withUser, pgErrorStatus } from './_lib/pg.js';
import { json, fail, methodGuard } from './_lib/http.js';
import { currentUser } from './_lib/session.js';
import { sign, verify } from './_lib/jwt.js';

const MAX_BYTES = 4 * 1024 * 1024;
const SIGN_TTL = 300;

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) {
      throw Object.assign(new Error(`Fichier trop volumineux (maximum ${limit / 1048576} Mo).`),
        { status: 413 });
    }
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const action = String(req.query?.action || '').toLowerCase();

  try {
    // ── Téléchargement par jeton signé ────────────────────────────────────
    if (action === 'download') {
      if (!methodGuard(req, res, ['GET'])) return;
      const payload = verify(String(req.query?.token || ''));
      if (!payload?.b || !payload?.p) return fail(res, 403, 'Lien invalide ou expiré.');

      // L'identité du jeton est réutilisée : RLS tranche à nouveau ici.
      const row = await withUser(payload.sub || null, async (c) => {
        const r = await c.query(
          'select name, mime_type, size, data from storage.objects where bucket_id = $1 and name = $2',
          [payload.b, payload.p]);
        return r.rows[0] || null;
      });
      if (!row) return fail(res, 404, 'Fichier introuvable ou accès refusé.');

      res.statusCode = 200;
      res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', String(row.size));
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Toujours en pièce jointe : un PDF ou une image déposés par un tiers ne
      // doivent jamais s'exécuter dans le contexte de l'application.
      res.setHeader('Content-Disposition',
        `attachment; filename="${encodeURIComponent(row.name.split('/').pop())}"`);
      return res.end(row.data);
    }

    const user = await currentUser(req, res);
    if (!user) return fail(res, 401, 'Authentification requise.');

    // ── Dépôt ─────────────────────────────────────────────────────────────
    if (action === 'upload') {
      if (!methodGuard(req, res, ['POST', 'PUT'])) return;
      const bucket = String(req.query?.bucket || '');
      const path = String(req.query?.path || '');
      const mime = String(req.headers['content-type'] || 'application/octet-stream');
      if (!bucket || !path) return fail(res, 400, 'Bucket et chemin requis.');
      if (path.includes('..')) return fail(res, 400, 'Chemin invalide.');

      const data = await readBody(req, MAX_BYTES);
      if (!data.length) return fail(res, 400, 'Fichier vide.');

      const saved = await withUser(user.id, async (c) => {
        const b = await c.query(
          'select file_size_limit, allowed_mime_types from storage.buckets where id = $1', [bucket]);
        if (!b.rows.length) throw Object.assign(new Error('Bucket inconnu.'), { status: 404 });

        const { file_size_limit, allowed_mime_types } = b.rows[0];
        if (file_size_limit && data.length > Number(file_size_limit)) {
          throw Object.assign(new Error('Fichier trop volumineux pour ce bucket.'), { status: 413 });
        }
        if (allowed_mime_types?.length && !allowed_mime_types.includes(mime.split(';')[0])) {
          throw Object.assign(new Error(`Type de fichier non autorisé : ${mime}`), { status: 415 });
        }

        const r = await c.query(
          `insert into storage.objects (bucket_id, name, owner, mime_type, size, data)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (bucket_id, name) do update
             set mime_type = excluded.mime_type, size = excluded.size,
                 data = excluded.data, owner = excluded.owner
           returning id, bucket_id, name, size, mime_type`,
          [bucket, path, user.id, mime.split(';')[0], data.length, data]);
        return r.rows[0];
      });

      return json(res, 200, { data: saved });
    }

    // ── Lien signé ────────────────────────────────────────────────────────
    if (action === 'sign') {
      if (!methodGuard(req, res, ['POST', 'GET'])) return;
      const bucket = String(req.query?.bucket || '');
      const path = String(req.query?.path || '');
      if (!bucket || !path) return fail(res, 400, 'Bucket et chemin requis.');

      // On vérifie l'accès AVANT d'émettre le lien : pas de jeton pour un
      // fichier que l'appelant ne peut pas lire.
      const ok = await withUser(user.id, async (c) => {
        const r = await c.query(
          'select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, path]);
        return r.rows.length > 0;
      });
      if (!ok) return fail(res, 404, 'Fichier introuvable ou accès refusé.');

      const token = sign({ b: bucket, p: path, sub: user.id }, SIGN_TTL);
      return json(res, 200, {
        data: { signedUrl: `/api/storage?action=download&token=${encodeURIComponent(token)}`,
                expiresIn: SIGN_TTL },
      });
    }

    // ── Suppression ───────────────────────────────────────────────────────
    if (action === 'remove') {
      if (!methodGuard(req, res, ['POST', 'DELETE'])) return;
      const bucket = String(req.query?.bucket || '');
      const paths = String(req.query?.paths || '').split('|').filter(Boolean);
      if (!bucket || !paths.length) return fail(res, 400, 'Bucket et chemins requis.');

      const removed = await withUser(user.id, async (c) => {
        const r = await c.query(
          'delete from storage.objects where bucket_id = $1 and name = any($2) returning name',
          [bucket, paths]);
        return r.rows.map((x) => x.name);
      });
      return json(res, 200, { data: removed });
    }

    return fail(res, 404, `Action inconnue : ${action}`);
  } catch (err) {
    const status = err.status || pgErrorStatus(err);
    if (status >= 500) console.error('[api/storage]', err);
    return fail(res, status, status >= 500 ? 'Erreur serveur.' : err.message);
  }
}
