// Liste des examens et TP de l'étudiant — passés et à venir.
// Si ctx.params.id : affiche un détail simple.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Badge } from '../../components/badge.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { EmptyBlock, ErrorBlock, fmtDateTime, daysUntil } from '../../lib/page-helpers.js';

export async function studentExamsPage(ctx) {
  const guard = requireAuth({ role: 'student' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getSupabase();
  let upcoming = [], past = [], err = null, detail = null;
  if (sb) {
    try {
      const meRes = await sb.from('students').select('specialty_id').eq('profile_id', user.id).maybeSingle();
      const specId = meRes.data?.specialty_id;
      if (specId) {
        const now = new Date().toISOString();
        const [up, pa] = await Promise.all([
          sb.from('exams').select('id, title, kind, mode, start_at, end_at, duration_minutes, total_points, subject_id, subjects!inner(name, specialty_id)')
            .eq('subjects.specialty_id', specId).gte('start_at', now).order('start_at').limit(30),
          sb.from('exams').select('id, title, kind, mode, start_at, end_at, subject_id, subjects!inner(name, specialty_id)')
            .eq('subjects.specialty_id', specId).lt('start_at', now).order('start_at', { ascending: false }).limit(30),
        ]);
        upcoming = up.data || [];
        past = pa.data || [];
        if (ctx?.params?.id) {
          const d = await sb.from('exams').select('id, title, description, kind, mode, start_at, end_at, duration_minutes, total_points, subjects(name)').eq('id', ctx.params.id).maybeSingle();
          detail = d.data;
        }
      }
    } catch (e) { err = e; }
  }

  const children = detail ? [detailView(detail)] : [
    err && ErrorBlock(err),
    Card({ padding: 0 }, [
      h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
        h('h3.card__title', {}, ['À venir']),
      ]),
      upcoming.length === 0
        ? EmptyBlock('Aucun examen programmé.', 'file-text')
        : h('table.table', {}, [
            h('thead', {}, [h('tr', {}, [
              h('th', {}, ['Titre']), h('th', {}, ['Matière']), h('th', {}, ['Type']),
              h('th', {}, ['Début']), h('th', {}, ['Durée']), h('th', {}, ['Dans']),
            ])]),
            h('tbody', {}, upcoming.map((ex) => h('tr', {}, [
              h('td', { style: { fontWeight: 500 } }, [
                h('a', { href: `/etudiant/examens/${ex.id}`, 'data-link': '', class: 'mono' }, [ex.title]),
              ]),
              h('td', {}, [ex.subjects?.name || '—']),
              h('td', {}, [Badge({ tone: ex.kind === 'tp' ? 'accent' : 'default' }, [ex.kind === 'tp' ? 'TP' : 'Examen'])]),
              h('td', { class: 'mono small mute' }, [fmtDateTime(ex.start_at)]),
              h('td', { class: 'mono small mute' }, [`${ex.duration_minutes} min`]),
              h('td', { class: 'mono small' }, [`${daysUntil(ex.start_at)} j`]),
            ]))),
          ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Passés']),
        ]),
        past.length === 0
          ? EmptyBlock('Aucun examen passé.', 'file-text')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Titre']), h('th', {}, ['Matière']), h('th', {}, ['Type']), h('th', {}, ['Date']),
              ])]),
              h('tbody', {}, past.map((ex) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [ex.title]),
                h('td', {}, [ex.subjects?.name || '—']),
                h('td', {}, [Badge({ tone: ex.kind === 'tp' ? 'accent' : 'default' }, [ex.kind === 'tp' ? 'TP' : 'Examen'])]),
                h('td', { class: 'mono small mute' }, [fmtDateTime(ex.start_at)]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('student'),
    active: t('nav.exams'),
    role: roleLabel('student'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Examens & TP',
    breadcrumb: 'Étudiant · Examens',
    children,
  });
}

function detailView(ex) {
  return Card({ padding: 24 }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, [
      h('div', {}, [
        h('p.kicker', {}, [ex.subjects?.name || '']),
        h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 30, margin: '6px 0 4px' } }, [ex.title]),
        h('p.mono small mute', { class: 'mono small mute' }, [`${fmtDateTime(ex.start_at)} → ${fmtDateTime(ex.end_at)} · ${ex.duration_minutes} min · ${ex.total_points} pts`]),
      ]),
      Button({ label: 'Retour', variant: 'ghost', href: '/etudiant/examens', 'data-link': true }),
    ]),
    ex.description && h('p', { style: { marginTop: 16 } }, [ex.description]),
    h('p.mute', { style: { marginTop: 16, fontSize: 13 } },
      ['La prise d\'examen interactive (QCM, dépôt de fichier) sera ajoutée dans une prochaine étape.']),
  ]);
}
