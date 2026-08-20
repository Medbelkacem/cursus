// Liste / création d'examens du professeur.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Select, Input, Textarea } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getApi } from '../../lib/api.js';
import { toast } from '../../components/toast.js';
import { EmptyBlock, ErrorBlock, fmtDateTime } from '../../lib/page-helpers.js';

export async function teacherExamsPage() {
  const guard = requireAuth({ role: 'teacher' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getApi();
  let subjects = [], exams = [], err = null;
  if (sb) {
    try {
      const [s, e] = await Promise.all([
        sb.from('subjects').select('id, name').eq('teacher_id', user.id),
        sb.from('exams').select('id, title, kind, mode, start_at, end_at, duration_minutes, total_points, subject_id, subjects(name, teacher_id)')
          .order('start_at', { ascending: false }).limit(50),
      ]);
      subjects = s.data || [];
      exams = (e.data || []).filter((x) => x.subjects?.teacher_id === user.id);
    } catch (ex) { err = ex; }
  }

  const form = createExamForm(subjects, user.id);

  const children = [
    err && ErrorBlock(err),
    form,
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Examens programmés']),
        ]),
        exams.length === 0
          ? EmptyBlock('Aucun examen pour le moment.', 'file-text')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Titre']), h('th', {}, ['Matière']), h('th', {}, ['Type']),
                h('th', {}, ['Début']), h('th', {}, ['Durée']),
              ])]),
              h('tbody', {}, exams.map((ex) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [ex.title]),
                h('td', {}, [ex.subjects?.name || '—']),
                h('td', {}, [Badge({ tone: ex.kind === 'tp' ? 'accent' : 'default' }, [ex.kind === 'tp' ? 'TP' : 'Examen'])]),
                h('td', { class: 'mono small mute' }, [fmtDateTime(ex.start_at)]),
                h('td', { class: 'mono small mute' }, [`${ex.duration_minutes} min`]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('teacher'),
    active: t('nav.exams'),
    role: roleLabel('teacher'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Examens & TP',
    breadcrumb: 'Professeur · Examens',
    children,
  });
}

function createExamForm(subjects, uid) {
  const sb = getApi();
  const title = Input({ placeholder: 'Examen final — Mathématiques' });
  const subjectSel = Select({ options: [{ value: '', label: '— matière —' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))] });
  const kind = Select({ value: 'exam', options: [{ value: 'exam', label: 'Examen' }, { value: 'tp', label: 'TP' }] });
  const mode = Select({ value: 'direct', options: [
    { value: 'direct', label: 'Question directe' }, { value: 'qcm', label: 'QCM' }, { value: 'file', label: 'Dépôt de fichier' },
  ]});
  const start = Input({ type: 'datetime-local' });
  const end = Input({ type: 'datetime-local' });
  const dur = Input({ type: 'number', value: '60', min: '5', step: '5' });
  const desc = Textarea({ rows: 2, placeholder: 'Description (optionnelle)' });

  return Card({ padding: 20 }, [
    h('h3.card__title', { style: { marginBottom: 12 } }, ['Programmer un examen / TP']),
    h('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 'var(--s-3)' } }, [
      Field({ label: 'Titre', required: true, children: title }),
      Field({ label: 'Matière', required: true, children: subjectSel }),
      Field({ label: 'Type', children: kind }),
      Field({ label: 'Mode', children: mode }),
    ]),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s-3)', marginTop: 'var(--s-3)' } }, [
      Field({ label: 'Début', required: true, children: start }),
      Field({ label: 'Fin', required: true, children: end }),
      Field({ label: 'Durée (min)', required: true, children: dur }),
    ]),
    h('div', { style: { marginTop: 'var(--s-3)' } }, [Field({ label: 'Description', children: desc })]),
    h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 12 } }, [
      Button({ label: 'Programmer', variant: 'primary', icon: 'plus',
        onClick: async () => {
          if (!sb) { toast('API non configurée.', { tone: 'danger' }); return; }
          if (!title.value || !subjectSel.value || !start.value || !end.value || !dur.value) {
            toast('Tous les champs requis ne sont pas remplis.', { tone: 'warn' }); return;
          }
          const r = await sb.from('exams').insert({
            title: title.value, subject_id: subjectSel.value, kind: kind.value, mode: mode.value,
            start_at: new Date(start.value).toISOString(), end_at: new Date(end.value).toISOString(),
            duration_minutes: Number(dur.value), description: desc.value || null, created_by: uid,
          });
          if (r.error) toast(r.error.message, { tone: 'danger' });
          else { toast('Examen programmé.', { tone: 'success' }); setTimeout(() => window.location.reload(), 600); }
        },
      }),
    ]),
  ]);
}
