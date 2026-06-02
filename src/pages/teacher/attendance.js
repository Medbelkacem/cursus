// Saisie de présence : sélectionner une matière + un groupe → liste d'étudiants
// avec 3 boutons (Présent / Retard / Absent) pour la séance du jour.

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

export async function teacherAttendancePage() {
  const guard = requireAuth({ role: 'teacher' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getSupabase();
  let mySubjects = [], err = null;
  if (sb) {
    try {
      const r = await sb.from('subjects')
        .select('id, name, specialty_id, specialties(name)')
        .eq('teacher_id', user.id).order('name');
      mySubjects = r.data || [];
    } catch (e) { err = e; }
  }

  const subjectSel = Select({
    name: 'subject',
    options: [{ value: '', label: '— Choisir une matière —' }, ...mySubjects.map((s) => ({ value: s.id, label: `${s.name} · ${s.specialties?.name || ''}` }))],
  });
  const dateInput = Input({ type: 'date', value: new Date().toISOString().slice(0, 10) });
  const sessionInput = Input({ type: 'text', placeholder: 'ex: Cours 4 — 09:45' });
  const listMount = h('div');

  async function loadStudents() {
    listMount.replaceChildren();
    if (!sb || !subjectSel.value) return;
    const sub = mySubjects.find((s) => s.id === subjectSel.value);
    if (!sub) return;
    // Étudiants de la même spécialité que la matière
    const r = await sb.from('students')
      .select('profile_id, student_number, profiles!students_profile_id_fkey(first_name, last_name, email)')
      .eq('specialty_id', sub.specialty_id);
    const students = r.data || [];
    if (students.length === 0) {
      listMount.appendChild(EmptyBlock('Aucun étudiant dans cette spécialité.', 'users'));
      return;
    }
    listMount.appendChild(renderList(students, sub.id));
  }

  function renderList(students, subjectId) {
    const stateMap = new Map();   // studentId → status
    return Card({ padding: 0 }, [
      h('table.table', {}, [
        h('thead', {}, [h('tr', {}, [
          h('th', {}, ['Étudiant']),
          h('th', {}, ['N°']),
          h('th', {}, ['Présence']),
        ])]),
        h('tbody', {}, students.map((s) => {
          const row = h('tr', {}, [
            h('td', {}, [`${s.profiles?.first_name || ''} ${s.profiles?.last_name || ''}`.trim() || s.profiles?.email || '—']),
            h('td', { class: 'mono small mute' }, [s.student_number || '—']),
            h('td', {}, [
              h('div', { style: { display: 'flex', gap: 6 } }, [
                btn(s.profile_id, 'present', 'P', 'success'),
                btn(s.profile_id, 'late',    'R', 'warn'),
                btn(s.profile_id, 'absent',  'A', 'danger'),
              ]),
            ]),
          ]);
          return row;
        })),
      ]),
      h('div', { style: { padding: 16, borderTop: '1px solid var(--c-line-soft)', display: 'flex', justifyContent: 'flex-end' } }, [
        Button({
          label: 'Enregistrer la séance', variant: 'primary', icon: 'check-circle',
          onClick: async () => {
            if (stateMap.size === 0) { toast('Marquez au moins un étudiant.', { tone: 'warn' }); return; }
            const rows = Array.from(stateMap, ([sid, status]) => ({
              student_id: sid,
              subject_id: subjectId,
              session_date: dateInput.value,
              session_label: sessionInput.value || null,
              status,
              created_by: user.id,
            }));
            const r = await sb.from('attendance').upsert(rows, { onConflict: 'student_id,subject_id,session_date,session_label' });
            if (r.error) toast(r.error.message, { tone: 'danger' });
            else { toast('Séance enregistrée.', { tone: 'success' }); }
          },
        }),
      ]),
    ]);

    function btn(sid, status, label, tone) {
      const b = h('button.btn.btn--sm', {
        type: 'button',
        class: `btn btn--sm btn--ghost att-pick att-pick--${tone}`,
        onClick: () => {
          stateMap.set(sid, status);
          const all = b.parentElement.querySelectorAll('.att-pick');
          all.forEach((x) => x.classList.remove('is-on'));
          b.classList.add('is-on');
        },
      }, [label]);
      return b;
    }
  }

  subjectSel.addEventListener('change', loadStudents);

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 20 }, [
      h('h3.card__title', { style: { marginBottom: 12 } }, ['Saisir une présence']),
      h('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--s-3)' } }, [
        Field({ label: 'Matière', children: subjectSel }),
        Field({ label: 'Date de la séance', children: dateInput }),
        Field({ label: 'Libellé', children: sessionInput }),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [listMount]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('teacher'),
    active: t('nav.attendance'),
    role: roleLabel('teacher'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Présence',
    breadcrumb: 'Professeur · Présence',
    children,
  });
}
