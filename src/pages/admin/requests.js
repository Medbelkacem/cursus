// Traitement des demandes de documents :
//   1. L'admin téléverse un PDF.
//   2. Marque la demande comme « envoyée » : déclenche l'Edge Function send-document-email
//      qui transmet le PDF à l'étudiant par e-mail (via Resend).

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Select } from '../../components/input.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getApi } from '../../lib/api.js';
import { toast } from '../../components/toast.js';
import { EmptyBlock, ErrorBlock, fmtDate, StatusBadge } from '../../lib/page-helpers.js';

const DOC_LABELS = {
  attestation_scolarite: 'Attestation de scolarité',
  releve_notes: 'Relevé de notes',
  attestation_inscription: 'Attestation d\'inscription',
  attestation_reussite: 'Attestation de réussite',
  autre: 'Autre',
};

export async function adminRequestsPage() {
  const guard = requireAuth({ role: 'admin' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getApi();
  const filterSel = Select({ value: 'pending', options: [
    { value: 'pending', label: 'En attente' },
    { value: 'sent',    label: 'Envoyés' },
    { value: 'rejected', label: 'Refusés' },
    { value: '', label: 'Tous' },
  ]});
  const mount = h('div');

  async function reload() {
    mount.replaceChildren();
    if (!sb) return;
    let q = sb.from('document_requests')
      .select('id, document_type, status, note, requested_at, processed_at, email_sent_to, student_id, profiles!document_requests_student_id_fkey(first_name, last_name, email, establishment_id)')
      .order('requested_at', { ascending: false });
    if (filterSel.value) q = q.eq('status', filterSel.value);
    const r = await q;
    if (r.error) { mount.appendChild(ErrorBlock(r.error)); return; }
    // RLS limitera côté serveur ; mais on filtre aussi côté client pour ne montrer
    // que les étudiants de notre établissement.
    const items = (r.data || []).filter((d) => d.profiles?.establishment_id === profile?.establishment_id);
    if (items.length === 0) {
      mount.appendChild(EmptyBlock('Aucune demande à afficher.', 'file'));
      return;
    }
    mount.appendChild(Card({ padding: 0 }, [
      h('table.table', {}, [
        h('thead', {}, [h('tr', {}, [
          h('th', {}, ['Étudiant']), h('th', {}, ['Document']),
          h('th', {}, ['Demandée le']), h('th', {}, ['Statut']),
          h('th', {}, ['Actions']),
        ])]),
        h('tbody', {}, items.map((d) => h('tr', {}, [
          h('td', {}, [
            h('div', {}, [`${d.profiles?.first_name || ''} ${d.profiles?.last_name || ''}`.trim() || '—']),
            h('div', { class: 'mono small mute' }, [d.profiles?.email || '']),
          ]),
          h('td', {}, [DOC_LABELS[d.document_type] || d.document_type]),
          h('td', { class: 'mono small mute' }, [fmtDate(d.requested_at)]),
          h('td', {}, [StatusBadge(d.status)]),
          h('td', {}, [
            d.status === 'pending' && h('div', { style: { display: 'flex', gap: 6 } }, [
              uploadAndSendBtn(d),
              Button({ label: 'Refuser', size: 'sm', variant: 'ghost', onClick: () => updateStatus(d.id, 'rejected') }),
            ]),
            d.status !== 'pending' && h('span.mono small', { class: 'mono small mute' },
              [d.processed_at ? `Traitée le ${fmtDate(d.processed_at)}` : '']),
          ]),
        ]))),
      ]),
    ]));
  }

  function uploadAndSendBtn(req) {
    const fileInput = h('input', { type: 'file', accept: 'application/pdf', style: { display: 'none' } });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const estab = profile?.establishment_id;
      if (!estab) { toast('Profil sans établissement.', { tone: 'danger' }); return; }
      const ts = Date.now();
      const path = `${estab}/${req.student_id}/${req.document_type}-${ts}.pdf`;
      toast('Téléversement…', { tone: 'info' });
      const up = await sb.storage.from('documents').upload(path, file, { contentType: 'application/pdf', upsert: true });
      if (up.error) { toast(up.error.message, { tone: 'danger' }); return; }

      // Mise à jour de la demande + déclenchement de l'email côté Edge Function.
      const update = await sb.from('document_requests').update({
        status: 'sent',
        processed_at: new Date().toISOString(),
        processed_by: profile.id,
        email_sent_to: req.profiles?.email || null,
      }).eq('id', req.id);
      if (update.error) { toast(update.error.message, { tone: 'danger' }); return; }

      // Invocation de la function (non bloquante si fonction non déployée).
      try {
        const inv = await sb.functions.invoke('email', {
          body: {
            request_id: req.id, storage_path: path,
            recipient_email: req.profiles?.email,
            recipient_name: `${req.profiles?.first_name || ''} ${req.profiles?.last_name || ''}`.trim(),
            document_type: req.document_type,
          },
        });
        if (inv.error) toast(`E-mail non envoyé : ${inv.error.message}. Le document est tout de même disponible.`, { tone: 'warn' });
        else toast('Document envoyé par e-mail.', { tone: 'success' });
      } catch (e) {
        toast(`Document enregistré. Édition Function indisponible : ${e.message || e}`, { tone: 'warn' });
      }
      reload();
    });
    return h('span', {}, [
      Button({ label: 'Téléverser & envoyer', size: 'sm', variant: 'primary', icon: 'upload',
        onClick: () => fileInput.click(),
      }),
      fileInput,
    ]);
  }

  async function updateStatus(id, status) {
    const r = await sb.from('document_requests').update({
      status, processed_at: new Date().toISOString(), processed_by: profile.id,
    }).eq('id', id);
    if (r.error) toast(r.error.message, { tone: 'danger' });
    else { toast('Statut mis à jour.', { tone: 'success' }); reload(); }
  }

  filterSel.addEventListener('change', reload);
  await reload();

  const children = [
    Card({ padding: 16 }, [
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--s-3)' } }, [
        Field({ label: 'Statut', children: filterSel }),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [mount]),
  ];

  return AppShell({
    nav: navFor('admin'),
    active: t('nav.requests'),
    role: roleLabel('admin'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Demandes de documents',
    breadcrumb: 'Administration · Demandes',
    children,
  });
}
