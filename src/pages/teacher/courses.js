// Supports de cours : upload + liste par matière (bucket course-materials).

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Select, Input } from '../../components/input.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { toast } from '../../components/toast.js';
import { EmptyBlock, ErrorBlock, fmtDate } from '../../lib/page-helpers.js';

export async function teacherCoursesPage() {
  const guard = requireAuth({ role: 'teacher' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getSupabase();
  let subjects = [], items = [], err = null;
  if (sb) {
    try {
      const [s, c] = await Promise.all([
        sb.from('subjects').select('id, name').eq('teacher_id', user.id),
        sb.from('courses').select('id, title, description, file_path, file_name, file_size, created_at, subject_id, subjects(name, teacher_id)')
          .order('created_at', { ascending: false }).limit(50),
      ]);
      subjects = s.data || [];
      items = (c.data || []).filter((x) => x.subjects?.teacher_id === user.id);
    } catch (e) { err = e; }
  }

  const subjectSel = Select({ options: [{ value: '', label: '— matière —' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))] });
  const titleInput = Input({ placeholder: 'Chapitre 4 — Intégrales' });
  const fileInput = h('input.input', { type: 'file', accept: '.pdf,.doc,.docx,.ppt,.pptx,.zip,.png,.jpg' });

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 20 }, [
      h('h3.card__title', { style: { marginBottom: 12 } }, ['Déposer un support']),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: 'var(--s-3)' } }, [
        Field({ label: 'Matière', required: true, children: subjectSel }),
        Field({ label: 'Titre', required: true, children: titleInput }),
        Field({ label: 'Fichier', required: true, children: fileInput }),
      ]),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 12 } }, [
        Button({ label: 'Téléverser', variant: 'primary', icon: 'upload',
          onClick: async () => {
            if (!sb) { toast('Supabase non configuré.', { tone: 'danger' }); return; }
            if (!subjectSel.value || !titleInput.value || !fileInput.files?.[0]) {
              toast('Sélectionnez une matière, un titre et un fichier.', { tone: 'warn' }); return;
            }
            const file = fileInput.files[0];
            const estab = profile?.establishment_id;
            if (!estab) { toast('Profil sans établissement.', { tone: 'danger' }); return; }
            const path = `${estab}/${subjectSel.value}/${Date.now()}-${file.name}`;
            const up = await sb.storage.from('course-materials').upload(path, file, { upsert: false });
            if (up.error) { toast(up.error.message, { tone: 'danger' }); return; }
            const ins = await sb.from('courses').insert({
              subject_id: subjectSel.value, title: titleInput.value,
              file_path: path, file_name: file.name, file_size: file.size, created_by: user.id,
            });
            if (ins.error) { toast(ins.error.message, { tone: 'danger' }); return; }
            toast('Support déposé.', { tone: 'success' });
            setTimeout(() => window.location.reload(), 600);
          },
        }),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Supports déposés']),
        ]),
        items.length === 0
          ? EmptyBlock('Aucun support déposé.', 'upload')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Titre']), h('th', {}, ['Matière']), h('th', {}, ['Fichier']), h('th', {}, ['Date']),
              ])]),
              h('tbody', {}, items.map((it) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [it.title]),
                h('td', {}, [it.subjects?.name || '—']),
                h('td', { class: 'mono small mute' }, [
                  it.file_name || '—',
                  it.file_size ? ` · ${(it.file_size / 1024 / 1024).toFixed(1)} Mo` : '',
                ]),
                h('td', { class: 'mono small mute' }, [fmtDate(it.created_at)]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('teacher'),
    active: t('nav.courses'),
    role: roleLabel('teacher'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Supports de cours',
    breadcrumb: 'Professeur · Supports',
    children,
  });
}
