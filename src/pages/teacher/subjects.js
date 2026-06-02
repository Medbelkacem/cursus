import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { EmptyBlock, ErrorBlock, fmtDate } from '../../lib/page-helpers.js';

export async function teacherSubjectsPage() {
  const guard = requireAuth({ role: 'teacher' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getSupabase();
  let subjects = [], err = null;
  if (sb) {
    try {
      const r = await sb.from('subjects')
        .select('id, name, coefficient, created_at, specialty_id, specialties(name)')
        .eq('teacher_id', user.id).order('name');
      subjects = r.data || [];
    } catch (e) { err = e; }
  }

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 0 }, [
      h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
        h('h3.card__title', {}, ['Mes matières']),
        h('p.mute', { style: { margin: '4px 0 0', fontSize: 13 } },
          ['Les matières affectées par votre administration. Pour en ajouter, contactez votre admin.']),
      ]),
      subjects.length === 0
        ? EmptyBlock('Vous n\'avez aucune matière assignée pour le moment.', 'book')
        : h('table.table', {}, [
            h('thead', {}, [h('tr', {}, [
              h('th', {}, ['Matière']),
              h('th', {}, ['Spécialité']),
              h('th', {}, ['Coefficient']),
              h('th', {}, ['Créée le']),
            ])]),
            h('tbody', {}, subjects.map((s) => h('tr', {}, [
              h('td', { style: { fontWeight: 500 } }, [s.name]),
              h('td', { class: 'mono small mute' }, [s.specialties?.name || '—']),
              h('td', { class: 'mono' }, [String(s.coefficient)]),
              h('td', { class: 'mono small mute' }, [fmtDate(s.created_at)]),
            ]))),
          ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('teacher'),
    active: t('nav.subjects'),
    role: roleLabel('teacher'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Matières',
    breadcrumb: 'Professeur · Matières',
    children,
  });
}
