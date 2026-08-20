// Notes de l'étudiant — groupées par matière avec moyenne pondérée par matière + globale.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Badge } from '../../components/badge.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getApi } from '../../lib/api.js';
import { KPI, Grid, EmptyBlock, ErrorBlock, fmtDate } from '../../lib/page-helpers.js';

export async function studentGradesPage() {
  const guard = requireAuth({ role: 'student' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getApi();
  let grades = [], overall = null, err = null;
  if (sb) {
    try {
      const [g, ov] = await Promise.all([
        sb.from('grades').select('id, value, type, label, graded_at, subject_id, subjects(name, coefficient)').eq('student_id', user.id).order('graded_at', { ascending: false }),
        sb.rpc('student_overall_average', { target: user.id }),
      ]);
      grades = g.data || [];
      overall = ov.data;
    } catch (e) { err = e; }
  }

  // Group by subject
  const groups = new Map();
  grades.forEach((g) => {
    const key = g.subjects?.name || '—';
    if (!groups.has(key)) groups.set(key, { name: key, coef: g.subjects?.coefficient || 1, items: [] });
    groups.get(key).items.push(g);
  });
  const sections = Array.from(groups.values()).map((grp) => {
    const avg = grp.items.length ? (grp.items.reduce((s, x) => s + Number(x.value), 0) / grp.items.length) : null;
    return Card({ padding: 0 }, [
      h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        h('div', {}, [
          h('h3.card__title', {}, [grp.name]),
          h('span.mono small mute', { class: 'mono small mute' }, [`coef. ${grp.coef}`]),
        ]),
        avg != null && Badge({ tone: avg >= 10 ? 'success' : 'danger', size: 'md' },
          [`Moy. ${avg.toFixed(2)} / 20`]),
      ]),
      h('table.table', {}, [
        h('thead', {}, [h('tr', {}, [
          h('th', {}, ['Libellé']), h('th', {}, ['Type']),
          h('th', {}, ['Note']), h('th', {}, ['Date']),
        ])]),
        h('tbody', {}, grp.items.map((g) => h('tr', {}, [
          h('td', {}, [g.label || '—']),
          h('td', { class: 'mono small mute' }, [g.type]),
          h('td', { class: 'mono' }, [Number(g.value).toFixed(2)]),
          h('td', { class: 'mono small mute' }, [fmtDate(g.graded_at)]),
        ]))),
      ]),
    ]);
  });

  const children = [
    err && ErrorBlock(err),
    Grid(3, 'var(--s-3)', [
      KPI('Moyenne générale', overall != null ? Number(overall).toFixed(2) : '—', '/20'),
      KPI('Matières', String(groups.size)),
      KPI('Notes', String(grades.length)),
    ]),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)', marginTop: 'var(--s-4)' } },
      sections.length === 0 ? [EmptyBlock('Aucune note pour l\'instant.', 'chart')] : sections,
    ),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('student'),
    active: t('nav.grades'),
    role: roleLabel('student'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Notes',
    breadcrumb: 'Étudiant · Notes',
    children,
  });
}
