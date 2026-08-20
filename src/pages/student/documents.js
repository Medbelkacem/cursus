// Demande de documents administratifs : étudiant crée une demande,
// admin la traite (cf. /administration/demandes), un e-mail part automatiquement.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Select, Textarea } from '../../components/input.js';
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

export async function studentDocumentsPage() {
  const guard = requireAuth({ role: 'student' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getApi();
  let mine = [], err = null;
  if (sb) {
    const r = await sb.from('document_requests')
      .select('id, document_type, status, note, reason, requested_at, processed_at, email_sent_to')
      .eq('student_id', user.id).order('requested_at', { ascending: false });
    if (r.error) err = r.error; else mine = r.data || [];
  }

  const typeSel = Select({ options: Object.entries(DOC_LABELS).map(([v, l]) => ({ value: v, label: l })) });
  const noteArea = Textarea({ rows: 3, placeholder: 'Précisions (optionnel)' });

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 20 }, [
      h('h3.card__title', { style: { marginBottom: 12 } }, ['Nouvelle demande']),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--s-3)' } }, [
        Field({ label: 'Type de document', required: true, children: typeSel }),
        Field({ label: 'Précisions', children: noteArea }),
      ]),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 12 } }, [
        Button({ label: 'Envoyer la demande', icon: 'send', variant: 'primary',
          onClick: async () => {
            if (!sb) return;
            const r = await sb.from('document_requests').insert({
              student_id: user.id, document_type: typeSel.value, note: noteArea.value || null,
            });
            if (r.error) toast(r.error.message, { tone: 'danger' });
            else { toast('Demande envoyée. Votre administration la traitera bientôt.', { tone: 'success' });
              setTimeout(() => window.location.reload(), 600); }
          },
        }),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Mes demandes']),
        ]),
        mine.length === 0
          ? EmptyBlock('Aucune demande envoyée.', 'file')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Document']), h('th', {}, ['Demandée le']),
                h('th', {}, ['Statut']), h('th', {}, ['Détails']),
              ])]),
              h('tbody', {}, mine.map((d) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [DOC_LABELS[d.document_type] || d.document_type]),
                h('td', { class: 'mono small mute' }, [fmtDate(d.requested_at)]),
                h('td', {}, [StatusBadge(d.status)]),
                h('td', { class: 'mono small mute' }, [
                  d.status === 'sent' && d.email_sent_to ? `Envoyé à ${d.email_sent_to}` :
                  d.status === 'rejected' && d.reason ? `Refusé : ${d.reason}` :
                  d.note || '—',
                ]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('student'),
    active: t('nav.documents'),
    role: roleLabel('student'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Documents administratifs',
    breadcrumb: 'Étudiant · Documents',
    children,
  });
}
