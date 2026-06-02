// Tableau de bord professeur — matières enseignées, prochains examens à corriger,
// dernières présences saisies, dernières notes mises.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Zellige } from '../../components/zellige.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { KPI, Grid, EmptyBlock, CardSectionHead, fmtDateTime, ErrorBlock } from '../../lib/page-helpers.js';

export async function teacherDashboard() {
  const guard = requireAuth({ role: 'teacher' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getSupabase();
  let data = { subjects: [], upcomingExams: [], pendingSubmissions: 0, recentGrades: [] };
  let err = null;
  if (sb) {
    try {
      const [subs, exams, subs2, grades] = await Promise.all([
        sb.from('subjects').select('id, name, coefficient, specialty_id, specialties(name)').eq('teacher_id', user.id),
        sb.from('exams').select('id, title, kind, start_at, subject_id, subjects(name)').gte('start_at', new Date().toISOString()).order('start_at').limit(5),
        sb.from('exam_submissions').select('id, score', { count: 'exact', head: true }).is('score', null),
        sb.from('grades').select('id, value, type, label, graded_at, student_id, subject_id, subjects(name)').eq('created_by', user.id).order('graded_at', { ascending: false }).limit(5),
      ]);
      data = {
        subjects: subs.data || [],
        upcomingExams: exams.data || [],
        pendingSubmissions: subs2.count || 0,
        recentGrades: grades.data || [],
      };
    } catch (e) { err = e; }
  }

  const greeting = profile?.first_name ? `Bonjour, ${profile.first_name}` : 'Bienvenue';

  const hero = data.upcomingExams[0]
    ? nextExamHero(data.upcomingExams[0])
    : Card({ padding: 24 }, [
        h('p.kicker', {}, ['Aujourd\'hui']),
        h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, margin: '8px 0' } }, ['Aucun examen programmé.']),
        h('p.mute', {}, ['Vous pouvez en créer un depuis la section Examens.']),
        h('div', { style: { marginTop: 'var(--s-3)' } }, [
          Button({ label: 'Créer un examen', variant: 'primary', icon: 'plus', href: '/professeur/examens', 'data-link': true }),
        ]),
      ]);

  const children = [
    err && ErrorBlock(err),
    Grid(4, 'var(--s-3)', [
      KPI('Matières', String(data.subjects.length)),
      KPI('Examens à venir', String(data.upcomingExams.length)),
      KPI('Copies à corriger', String(data.pendingSubmissions)),
      KPI('Notes saisies', String(data.recentGrades.length), '', 'derniers 30 j'),
    ]),

    h('div', { style: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--s-4)', marginTop: 'var(--s-4)' } }, [
      hero,
      Card({ padding: 20 }, [
        CardSectionHead('Mes matières', '/professeur/matieres'),
        data.subjects.length === 0
          ? EmptyBlock('Aucune matière assignée. Contactez votre administration.', 'book')
          : h('div', {}, data.subjects.map((s, i) => h('div', {
              style: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: i ? '1px solid var(--c-line-soft)' : 'none' },
            }, [
              h('div', {}, [
                h('div', { style: { fontSize: 13, fontWeight: 500 } }, [s.name]),
                h('div', { class: 'mono small mute' }, [s.specialties?.name || '—']),
              ]),
              h('span.mono small', { class: 'mono small mute' }, [`coef. ${s.coefficient}`]),
            ]))),
      ]),
    ]),

    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Dernières notes saisies']),
        ]),
        data.recentGrades.length === 0
          ? EmptyBlock('Vous n\'avez encore saisi aucune note.', 'chart')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Matière']),
                h('th', {}, ['Type']),
                h('th', {}, ['Note']),
                h('th', {}, ['Date']),
              ])]),
              h('tbody', {}, data.recentGrades.map((g) => h('tr', {}, [
                h('td', {}, [g.subjects?.name || '—']),
                h('td', { class: 'mono small mute' }, [g.label || g.type]),
                h('td', { class: 'mono' }, [`${Number(g.value).toFixed(2)} / 20`]),
                h('td', { class: 'mono small mute' }, [g.graded_at ? new Date(g.graded_at).toLocaleDateString('fr-FR') : '—']),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('teacher'),
    active: t('nav.dashboard'),
    role: roleLabel('teacher'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: greeting,
    breadcrumb: 'Professeur · ' + (profile?.email || ''),
    children,
  });
}

function nextExamHero(ex) {
  return Card({ padding: 0, dark: true, style: { overflow: 'hidden', position: 'relative' } }, [
    (() => { const z = Zellige({ size: 360, opacity: 0.18, color: 'var(--c-paper)' }); z.style.top = '-60px'; z.style.insetInlineEnd = '-60px'; return z; })(),
    h('div', { style: { padding: 'var(--s-6)', position: 'relative', zIndex: 2 } }, [
      h('p.kicker', { style: { color: 'rgba(255,255,255,0.5)' } }, ['Prochain examen']),
      h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--c-paper)', margin: 'var(--s-2) 0' } }, [ex.title]),
      h('p', { style: { color: 'rgba(255,255,255,0.7)', margin: 0 } }, [
        `${ex.subjects?.name || ''} · ${fmtDateTime(ex.start_at)}`,
      ]),
      h('div', { style: { marginTop: 'var(--s-5)' } }, [
        Button({ label: 'Voir les copies', variant: 'inverse', href: '/professeur/examens', 'data-link': true }),
      ]),
    ]),
  ]);
}
