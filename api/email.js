// ─────────────────────────────────────────────────────────────────────────────
//  /api/email — envoi par courriel d'un document administratif.
//
//  Remplace l'Edge Function Supabase. Le fichier est lu dans le stockage sous
//  l'identité de l'appelant : RLS vérifie qu'il a bien le droit d'y accéder,
//  la fonction ne fait donc jamais confiance au chemin fourni.
//
//  Variables : RESEND_API_KEY, RESEND_FROM_EMAIL (facultative).
// ─────────────────────────────────────────────────────────────────────────────

import { withUser, pgErrorStatus } from './_lib/pg.js';
import { json, fail, readJSON, methodGuard } from './_lib/http.js';
import { currentUser } from './_lib/session.js';
import { rateLimit } from './_lib/session.js';

const DOC_LABELS = {
  attestation_scolarite:   'Attestation de scolarité',
  releve_notes:            'Relevé de notes',
  attestation_inscription: "Attestation d'inscription",
  attestation_reussite:    'Attestation de réussite',
  autre:                   'Document administratif',
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;

  try {
    const user = await currentUser(req, res);
    if (!user) return fail(res, 401, 'Authentification requise.');

    const key = process.env.RESEND_API_KEY;
    if (!key) return fail(res, 503, 'Envoi de courriel non configuré (RESEND_API_KEY).');

    const limit = await rateLimit(`email:${user.id}`, 30, 3600);
    if (!limit.allowed) return fail(res, 429, 'Trop d’envois. Réessayez plus tard.');

    const { request_id, storage_path, recipient_email, recipient_name, document_type } =
      await readJSON(req);

    if (!request_id || !storage_path || !recipient_email) {
      return fail(res, 400, 'request_id, storage_path et recipient_email sont requis.');
    }
    if (!EMAIL_RE.test(recipient_email)) return fail(res, 400, 'Adresse destinataire invalide.');

    // Lecture du fichier ET de la demande sous l'identité de l'appelant :
    // si RLS refuse, rien ne sort.
    const ctx = await withUser(user.id, async (c) => {
      const f = await c.query(
        'select name, mime_type, size, data from storage.objects where bucket_id = $1 and name = $2',
        ['documents', storage_path]);
      if (!f.rows.length) return null;

      const r = await c.query(
        'select id, status from public.document_requests where id = $1', [request_id]);
      if (!r.rows.length) return null;

      return { file: f.rows[0], request: r.rows[0] };
    });

    if (!ctx) return fail(res, 404, 'Document ou demande introuvable, ou accès refusé.');

    const label = DOC_LABELS[document_type] || DOC_LABELS.autre;
    const name = esc(recipient_name || 'Madame, Monsieur');

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Cursus <documents@cursus.dz>',
        to: [recipient_email],
        subject: `${label} — Cursus`,
        html: `<p>Bonjour ${name},</p>
               <p>Veuillez trouver ci-joint votre <strong>${esc(label)}</strong>.</p>
               <p>Ce document vous est adressé par votre établissement de formation via
                  la plateforme Cursus.</p>
               <p style="color:#6c675e;font-size:12px">Message automatique — merci de ne pas y répondre.</p>`,
        attachments: [{
          filename: ctx.file.name.split('/').pop(),
          content: Buffer.from(ctx.file.data).toString('base64'),
        }],
      }),
    });

    if (!send.ok) {
      const detail = await send.text();
      console.error('[api/email] Resend', send.status, detail.slice(0, 300));
      return fail(res, 502, 'L’envoi du courriel a échoué.');
    }

    // Trace l'envoi sur la demande (toujours sous RLS).
    await withUser(user.id, (c) => c.query(
      `update public.document_requests
          set email_sent_to = $2, processed_at = now(), processed_by = $3
        where id = $1`,
      [request_id, recipient_email, user.id]));

    return json(res, 200, { ok: true });
  } catch (err) {
    const status = err.status || pgErrorStatus(err);
    if (status >= 500) console.error('[api/email]', err);
    return fail(res, status, status >= 500 ? 'Erreur serveur.' : err.message);
  }
}
