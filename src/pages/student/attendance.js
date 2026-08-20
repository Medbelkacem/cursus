// Historique de présence de l'étudiant + taux global.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getApi } from '../../lib/api.js';
import { KPI, Grid, EmptyBlock, ErrorBlock, fmtDate, StatusBadge } from '../../lib/page-helpers.js';

export async function studentAttendancePage() {
  const guard = requireAuth({ role: 'student' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getApi();
  let rows = [], rate = null, present = 0, late = 0, absent = 0, err = null;
  if (sb) {
    try {
      const [rs, rt] = await Promise.all([
        sb.from('attendance').select('id, session_date, session_label, status, subject_id, subjects(name)').eq('student_id', user.id).order('session_date', { ascending: false }).limit(100),
        sb.rpc('student_attendance_rate', { target: user.id }),
      ]);
      rows = rs.data || [];
      rate = rt.data;
      rows.forEach((r) => { if (r.status === 'present') present++; else if (r.status === 'late') late++; else if (r.status === 'absent') absent++; });
    } catch (e) { err = e; }
  }

  const children = [
    err && ErrorBlock(err),
    Grid(4, 'var(--s-3)', [
      KPI('Taux de présence', rate != null ? String(rate) : '—', '%'),
      KPI('Présent', String(present)),
      KPI('Retard', String(late)),
      KPI('Absent', String(absent)),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Historique des séances']),
        ]),
        rows.length === 0
          ? EmptyBlock('Aucune présence enregistrée.', 'check-circle')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Date']), h('th', {}, ['Matière']),
                h('th', {}, ['Séance']), h('th', {}, ['Statut']),
              ])]),
              h('tbody', {}, rows.map((r) => h('tr', {}, [
                h('td', { class: 'mono small mute' }, [fmtDate(r.session_date)]),
                h('td', {}, [r.subjects?.name || '—']),
                h('td', { class: 'mono small' }, [r.session_label || '—']),
                h('td', {}, [StatusBadge(r.status)]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('student'),
    active: t('nav.attendance'),
    role: roleLabel('student'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Présence',
    breadcrumb: 'Étudiant · Présence',
    children,
  });
}
