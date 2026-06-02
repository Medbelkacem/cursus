import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { KPI, Grid, EmptyBlock, ErrorBlock } from '../../lib/page-helpers.js';

export async function directionStatsPage() {
  const guard = requireAuth({ role: 'direction' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let stats = null, byEstab = [], err = null;
  if (sb) {
    try {
      const estab = await sb.from('establishments').select('id, name').eq('direction_id', profile?.direction_id);
      const ids = (estab.data || []).map((e) => e.id);
      if (ids.length === 0) {
        stats = { students: 0, teachers: 0, subjects: 0, exams: 0 };
      } else {
        const [stu, tea, sub, exm] = await Promise.all([
          sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'active').in('establishment_id', ids),
          sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('status', 'active').in('establishment_id', ids),
          sb.from('subjects').select('id, specialty_id, specialties!inner(establishment_id)', { count: 'exact', head: true }).in('specialties.establishment_id', ids),
          sb.from('exams').select('id, subject_id, subjects!inner(specialty_id, specialties!inner(establishment_id))', { count: 'exact', head: true }).in('subjects.specialties.establishment_id', ids),
        ]);
        stats = { students: stu.count || 0, teachers: tea.count || 0, subjects: sub.count || 0, exams: exm.count || 0 };
        byEstab = await Promise.all((estab.data || []).map(async (e) => {
          const [s, te] = await Promise.all([
            sb.from('profiles').select('id', { count: 'exact', head: true }).eq('establishment_id', e.id).eq('role', 'student').eq('status', 'active'),
            sb.from('profiles').select('id', { count: 'exact', head: true }).eq('establishment_id', e.id).eq('role', 'teacher').eq('status', 'active'),
          ]);
          return { name: e.name, students: s.count || 0, teachers: te.count || 0 };
        }));
      }
    } catch (e) { err = e; }
  }

  const children = [
    err && ErrorBlock(err),
    stats && Grid(4, 'var(--s-3)', [
      KPI('Étudiants', stats.students.toLocaleString('fr-FR')),
      KPI('Professeurs', stats.teachers.toLocaleString('fr-FR')),
      KPI('Matières', String(stats.subjects)),
      KPI('Examens', String(stats.exams)),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Effectifs par établissement']),
        ]),
        byEstab.length === 0
          ? EmptyBlock('Aucune donnée à afficher.', 'chart')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Établissement']), h('th', {}, ['Étudiants']), h('th', {}, ['Professeurs']),
              ])]),
              h('tbody', {}, byEstab.map((r) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [r.name]),
                h('td', { class: 'mono' }, [String(r.students)]),
                h('td', { class: 'mono' }, [String(r.teachers)]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('direction'),
    active: t('nav.statistics'),
    role: roleLabel('direction'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Statistiques',
    breadcrumb: 'Direction · Statistiques',
    children,
  });
}
