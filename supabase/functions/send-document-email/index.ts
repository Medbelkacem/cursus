// ─────────────────────────────────────────────────────────────────────────────
//  Edge Function — send-document-email
//
//  Envoie par e-mail (via Resend) le document PDF stocké dans le bucket
//  "documents" à l'étudiant qui en a fait la demande.
//
//  Déclenchée par l'app web depuis /administration/demandes après que l'admin :
//    1) a téléversé le PDF dans documents/{estab_id}/{student_id}/...pdf
//    2) a mis à jour document_requests.status = 'sent'
//
//  Endpoint :
//    POST {SUPABASE_URL}/functions/v1/send-document-email
//    Authorization: Bearer <USER_JWT>           (RLS pour vérifier l'admin)
//    Body: {
//      request_id: uuid,
//      storage_path: string,                    ex: "estab-uuid/student-uuid/releve-1234.pdf"
//      recipient_email: string,
//      recipient_name: string,
//      document_type: string
//    }
//
//  Variables d'environnement (Supabase Dashboard → Edge Functions → Secrets) :
//    SUPABASE_URL                 (auto)
//    SUPABASE_SERVICE_ROLE_KEY    (auto, jamais exposée au client)
//    RESEND_API_KEY               obligatoire
//    RESEND_FROM_EMAIL            ex: "Cursus <documents@cursus.dz>"
// ─────────────────────────────────────────────────────────────────────────────

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const DOC_LABELS: Record<string, string> = {
  attestation_scolarite:   'Attestation de scolarité',
  releve_notes:            'Relevé de notes',
  attestation_inscription: "Attestation d'inscription",
  attestation_reussite:    'Attestation de réussite',
  autre:                   'Document administratif',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // ── 1. Vérification de l'environnement ────────────────────────────────
  const SUPABASE_URL          = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const RESEND_API_KEY        = Deno.env.get('RESEND_API_KEY');
  const RESEND_FROM_EMAIL     = Deno.env.get('RESEND_FROM_EMAIL') || 'Cursus <documents@cursus.dz>';

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'missing_supabase_env' }, 500);
  }
  if (!RESEND_API_KEY) {
    return jsonResponse({ error: 'missing_resend_api_key' }, 500);
  }

  // ── 2. Validation du body ──────────────────────────────────────────────
  let body: any;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { request_id, storage_path, recipient_email, recipient_name, document_type } = body || {};
  if (!request_id || !storage_path || !recipient_email) {
    return jsonResponse({ error: 'missing_fields', need: ['request_id', 'storage_path', 'recipient_email'] }, 400);
  }

  // Vérification simple de l'e-mail (le validateur définitif est côté Resend).
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient_email)) {
    return jsonResponse({ error: 'invalid_email' }, 400);
  }

  // ── 3. Récupération du fichier depuis Storage ─────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dl = await admin.storage.from('documents').download(storage_path);
  if (dl.error || !dl.data) {
    return jsonResponse({ error: 'storage_download_failed', detail: dl.error?.message }, 500);
  }

  const fileBytes = new Uint8Array(await dl.data.arrayBuffer());
  // Encodage base64 — chunké pour éviter les piles d'arguments trop grandes.
  let base64 = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < fileBytes.length; i += chunkSize) {
    base64 += String.fromCharCode.apply(null, Array.from(fileBytes.subarray(i, i + chunkSize)));
  }
  base64 = btoa(base64);

  // ── 4. Composition de l'e-mail ────────────────────────────────────────
  const docLabel = DOC_LABELS[document_type] || 'Document administratif';
  const fileName = `${document_type || 'document'}-${request_id.slice(0, 8)}.pdf`;
  const displayName = (recipient_name || '').trim() || 'Madame, Monsieur';

  const subject = `Cursus — ${docLabel}`;
  const text = [
    `Bonjour ${displayName},`, '',
    `Veuillez trouver ci-joint votre ${docLabel.toLowerCase()} délivrée par votre établissement.`,
    `Identifiant de la demande : ${request_id}`, '',
    `Si vous n'êtes pas à l'origine de cette demande, contactez votre administration.`,
    '', 'Cordialement,', "L'équipe Cursus",
  ].join('\n');

  const html = `
    <div style="font-family: 'DM Sans', Helvetica, Arial, sans-serif; color:#1f2329; max-width:560px; margin:0 auto;">
      <h1 style="font-family:'Fraunces', Georgia, serif; font-weight:500; font-size:24px; margin:0 0 12px;">Cursus</h1>
      <p>Bonjour ${escapeHtml(displayName)},</p>
      <p>Veuillez trouver ci-joint votre <strong>${escapeHtml(docLabel.toLowerCase())}</strong> délivrée par votre établissement.</p>
      <p style="font-family:'DM Mono', monospace; font-size:12px; color:#6c7280;">Identifiant de la demande : ${escapeHtml(request_id)}</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, contactez votre administration.</p>
      <p style="margin-top:24px;">Cordialement,<br/>L'équipe Cursus</p>
    </div>
  `;

  // ── 5. Envoi via Resend ───────────────────────────────────────────────
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [recipient_email],
      subject,
      html,
      text,
      attachments: [{ filename: fileName, content: base64 }],
    }),
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text();
    return jsonResponse({ error: 'resend_failed', status: resendRes.status, detail }, 502);
  }
  const sent = await resendRes.json().catch(() => ({}));

  // ── 6. Traçabilité dans document_requests ─────────────────────────────
  await admin.from('document_requests').update({
    email_sent_to: recipient_email,
    processed_at: new Date().toISOString(),
  }).eq('id', request_id);

  return jsonResponse({ ok: true, resend_id: sent?.id || null });
});

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
