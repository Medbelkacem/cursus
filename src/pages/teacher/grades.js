// Saisie de notes : matière + type + libellé → liste d'étudiants.

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
import { EmptyBlock, ErrorBlock } from '../../lib/page-helpers.js';

export async function teacherGradesPage() {
  const guard = requireAuth({ role: 'teacher' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getSupabase();
  let subjects = [], err = null;
  if (sb) {
    try {
      const r = await sb.from('subjects')
        .select('id, name, specialty_id, specialties(name)')
        .eq('teacher_id', user.id).order('name');
      subjects = r.data || [];
    } catch (e) { err = e; }
  }

  const subjectSel = Select({ name: 'subject', options: [{ value: '', label: '— Choisir une matière —' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))] });
  const typeSel = Select({ name: 'type', options: [
    { value: 'cours', label: 'Cours' }, { value: 'controle', label: 'Contrôle' },
    { value: 'tp', label: 'TP' }, { value: 'examen', label: 'Examen' },
  ]});
  const labelInput = Input({ placeholder: 'ex: Contrôle continu n°2' });
  const dateInput = Input({ type: 'date', value: new Date().toISOString().slice(0, 10) });
  const listMount = h('div');

  async function loadStudents() {
    listMount.replaceChildren();
    if (!sb || !subjectSel.value) return;
    const sub = subjects.find((s) => s.id === subjectSel.value);
    if (!sub) return;
    const r = await sb.from('students')
      .select('profile_id, student_number, profiles!students_profile_id_fkey(first_name, last_name, email)')
      .eq('specialty_id', sub.specialty_id);
    const list = r.data || [];
    if (list.length === 0) {
      listMount.appendChild(EmptyBlock('Aucun étudiant dans cette spécialité.', 'users'));
      return;
    }
    const map = new Map();
    listMount.appendChild(Card({ padding: 0 }, [
      h('table.table', {}, [
        h('thead', {}, [h('tr', {}, [h('th', {}, ['Étudiant']), h('th', {}, ['N°']), h('th', {}, ['Note / 20'])])]),
        h('tbody', {}, list.map((s) => {
          const inp = h('input.input', { type: 'number', min: '0', max: '20', step: '0.25', style: { maxWidth: 110 },
            onInput: (e) => map.set(s.profile_id, e.target.value),
          });
          return h('tr', {}, [
            h('td', {}, [`${s.profiles?.first_name || ''} ${s.profiles?.last_name || ''}`.trim() || s.profiles?.email || '—']),
            h('td', { class: 'mono small mute' }, [s.student_number || '—']),
            h('td', {}, [inp]),
          ]);
        })),
      ]),
      h('div', { style: { padding: 16, borderTop: '1px solid var(--c-line-soft)', display: 'flex', justifyContent: 'flex-end' } }, [
        Button({ label: 'Enregistrer les notes', variant: 'primary', icon: 'check-circle',
          onClick: async () => {
            const rows = Array.from(map.entries())
              .map(([sid, v]) => ({ student_id: sid, subject_id: sub.id, type: typeSel.value, value: Number(v), label: labelInput.value || null, graded_at: dateInput.value, created_by: user.id }))
              .filter((r) => !Number.isNaN(r.value) && r.value >= 0 && r.value <= 20);
            if (rows.length === 0) { toast('Saisissez au moins une note valide.', { tone: 'warn' }); return; }
            const r = await sb.from('grades').insert(rows);
            if (r.error) toast(r.error.message, { tone: 'danger' });
            else toast(`${rows.length} note(s) enregistrée(s).`, { tone: 'success' });
          },
        }),
      ]),
    ]));
  }
  subjectSel.addEventListener('change', loadStudents);

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 20 }, [
      h('h3.card__title', { style: { marginBottom: 12 } }, ['Saisir des notes']),
      h('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr', gap: 'var(--s-3)' } }, [
        Field({ label: 'Matière', children: subjectSel }),
        Field({ label: 'Type', children: typeSel }),
        Field({ label: 'Libellé', children: labelInput }),
        Field({ label: 'Date', children: dateInput }),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [listMount]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('teacher'),
    active: t('nav.grades'),
    role: roleLabel('teacher'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Notes',
    breadcrumb: 'Professeur · Notes',
    children,
  });
}
