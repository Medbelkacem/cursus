import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { KPI, Grid, EmptyBlock, ErrorBlock } from '../../lib/page-helpers.js';

export async function ministryStatsPage() {
  const guard = requireAuth({ role: 'ministry' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let nat = null, byWilaya = [], err = null;
  if (sb) {
    try {
      const [stu, tea, sub, exm, ests] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'active'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('status', 'active'),
        sb.from('subjects').select('id', { count: 'exact', head: true }),
        sb.from('exams').select('id', { count: 'exact', head: true }),
        sb.from('establishments').select('wilaya'),
      ]);
      nat = { students: stu.count || 0, teachers: tea.count || 0, subjects: sub.count || 0, exams: exm.count || 0 };
      const map = {};
      (ests.data || []).forEach((e) => { const w = e.wilaya || '—'; map[w] = (map[w] || 0) + 1; });
      byWilaya = Object.entries(map).map(([w, c]) => ({ wilaya: w, count: c })).sort((a, b) => b.count - a.count);
    } catch (e) { err = e; }
  }

  const children = [
    err && ErrorBlock(err),
    nat && Grid(4, 'var(--s-3)', [
      KPI('Étudiants', nat.students.toLocaleString('fr-FR')),
      KPI('Professeurs', nat.teachers.toLocaleString('fr-FR')),
      KPI('Matières', nat.subjects.toLocaleString('fr-FR')),
      KPI('Examens', nat.exams.toLocaleString('fr-FR')),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Établissements par wilaya']),
        ]),
        byWilaya.length === 0
          ? EmptyBlock('Aucun établissement enregistré.', 'building')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [h('th', {}, ['Wilaya']), h('th', {}, ['Nombre'])])]),
              h('tbody', {}, byWilaya.map((r) => h('tr', {}, [
                h('td', {}, [r.wilaya]),
                h('td', { class: 'mono' }, [String(r.count)]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('ministry'),
    active: t('nav.statistics'),
    role: roleLabel('ministry'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Statistiques nationales',
    breadcrumb: 'Ministère · Statistiques',
    children,
  });
}
