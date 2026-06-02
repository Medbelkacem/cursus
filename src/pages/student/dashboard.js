// Tableau de bord étudiant.
// Rapproche : taux de présence, dernières notes, prochain examen, demandes en attente.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth, getState } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card, CardHeader } from '../../components/card.js';
import { Badge } from '../../components/badge.js';
import { Button } from '../../components/button.js';
import { Icon } from '../../components/icon.js';
import { Zellige } from '../../components/zellige.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';

export async function studentDashboard() {
  const guard = requireAuth({ role: 'student' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  // ── Charger les données du dashboard ─────────────────────────────────
  const sb = getSupabase();
  const dataPromise = sb ? (async () => {
    const [recent, atts, exams, docs] = await Promise.all([
      sb.from('grades').select('id, value, type, label, graded_at, subject_id, subjects(name, coefficient)')
        .eq('student_id', user.id).order('graded_at', { ascending: false }).limit(5),
      sb.rpc('student_attendance_rate', { target: user.id }),
      sb.from('exams').select('id, title, kind, start_at, end_at, subject_id, subjects(name)')
        .gt('start_at', new Date().toISOString()).order('start_at').limit(3),
      sb.from('document_requests').select('id, document_type, status, requested_at')
        .eq('student_id', user.id).order('requested_at', { ascending: false }).limit(3),
    ]);
    let overall = null;
    const overallRes = await sb.rpc('student_overall_average', { target: user.id });
    if (!overallRes.error) overall = overallRes.data;
    return {
      recentGrades: recent.data || [],
      attendanceRate: atts.error ? null : atts.data,
      nextExams: exams.data || [],
      docs: docs.data || [],
      overall,
    };
  })() : Promise.resolve({ recentGrades: [], attendanceRate: null, nextExams: [], docs: [], overall: null });

  const data = await dataPromise;

  // ── Composer le rendu ────────────────────────────────────────────────
  const greeting = profile?.first_name
    ? `Bonjour, ${profile.first_name}`
    : 'Bienvenue';

  const nextExam = data.nextExams[0];
  const heroCard = nextExam ? nextExamCard(nextExam) : welcomeCard();

  const content = [
    // KPIs
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-3)' } }, [
      kpiCard(t('home.feat_grades_t'), data.overall != null ? data.overall.toString() : '—', '/20', data.overall != null && data.overall >= 10 ? 'kpi__trend--up' : null),
      kpiCard(t('home.feat_attendance_t'), data.attendanceRate != null ? data.attendanceRate.toString() : '—', '%', null),
      kpiCard(t('nav.exams'), String(data.nextExams.length), '', null),
      kpiCard(t('nav.documents'), String(data.docs.filter((d) => d.status === 'pending').length), '', null, 'en attente'),
    ]),

    // Grid : hero + dernières notes
    h('div', { style: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--s-4)', marginTop: 'var(--s-4)' } }, [
      heroCard,

      Card({ padding: 20 }, [
        h('div.card__head', {}, [
          h('div', {}, [h('h3.card__title', {}, [t('home.feat_grades_t')])]),
          h('a', { href: '/etudiant/notes', 'data-link': '', class: 'mono small', style: { color: 'var(--c-gauloise-d)' } }, ['Voir tout →']),
        ]),
        data.recentGrades.length === 0
          ? emptyBlock('Aucune note pour l\'instant.')
          : h('div', {},
              data.recentGrades.map((g, i) => h('div', {
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--c-line-soft)' : 'none' },
              }, [
                h('div', {}, [
                  h('div', { style: { fontSize: 13, fontWeight: 500 } }, [`${g.subjects?.name || '—'} · ${gradeTypeLabel(g.type)}`]),
                  h('div', { class: 'mono small mute' }, [`${g.label || ''}${g.graded_at ? ' · ' + new Date(g.graded_at).toLocaleDateString('fr-FR') : ''}`]),
                ]),
                gradeChip(g.value),
              ]))
            ),
      ]),
    ]),

    // Demandes de documents récentes
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
          h('h3.card__title', {}, [t('nav.documents')]),
          Button({ label: 'Nouvelle demande', icon: 'plus', size: 'sm', variant: 'primary', href: '/etudiant/documents', 'data-link': true }),
        ]),
        data.docs.length === 0
          ? emptyBlock('Aucune demande envoyée.')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Document']),
                h('th', {}, ['Date de demande']),
                h('th', {}, ['Statut']),
              ])]),
              h('tbody', {}, data.docs.map((d) => h('tr', {}, [
                h('td', {}, [docTypeLabel(d.document_type)]),
                h('td', { class: 'mono small mute' }, [new Date(d.requested_at).toLocaleDateString('fr-FR')]),
                h('td', {}, [docStatusBadge(d.status)]),
              ]))),
            ]),
      ]),
    ]),
  ];

  return AppShell({
    nav: navFor('student'),
    active: t('nav.dashboard'),
    role: roleLabel('student'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: greeting,
    breadcrumb: 'Étudiant · ' + (profile?.email || ''),
    children: content,
  });
}

// ── helpers locaux ─────────────────────────────────────────────────────────

function kpiCard(label, value, suffix, trendCls, trendMsg) {
  return Card({ padding: 0 }, [
    h('div.kpi', {}, [
      h('div.kpi__label', {}, [label]),
      h('div.kpi__value', {}, [
        h('span', {}, [value]),
        suffix && h('span.kpi__value-sub', {}, [suffix]),
      ].filter(Boolean)),
      trendMsg && h('div', { class: trendCls ? `kpi__trend ${trendCls}` : 'kpi__trend' }, [trendMsg]),
    ]),
  ]);
}

function nextExamCard(ex) {
  const start = new Date(ex.start_at);
  const days = Math.max(0, Math.ceil((start - new Date()) / 86400000));
  return Card({ padding: 0, dark: true, style: { overflow: 'hidden', position: 'relative' } }, [
    (() => { const z = Zellige({ size: 360, opacity: 0.18, color: 'var(--c-paper)' }); z.style.top = '-60px'; z.style.insetInlineEnd = '-60px'; return z; })(),
    h('div', { style: { padding: 'var(--s-6)', position: 'relative', zIndex: 2 } }, [
      h('p.kicker', { style: { color: 'rgba(255,255,255,0.5)' } }, ['Prochain examen']),
      h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--c-paper)', margin: 'var(--s-2) 0 var(--s-2)' } }, [
        ex.title,
      ]),
      h('p', { style: { color: 'rgba(255,255,255,0.7)', margin: 0 } }, [
        `${ex.subjects?.name || ''} · ${start.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}`,
      ]),
      h('div', { style: { display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-5)' } }, [
        Button({ label: 'Voir le détail', variant: 'inverse', href: `/etudiant/examens/${ex.id}`, 'data-link': true }),
        Badge({ tone: 'accent' }, [`Dans ${days} jour${days > 1 ? 's' : ''}`]),
      ]),
    ]),
  ]);
}

function welcomeCard() {
  return Card({ padding: 24 }, [
    h('p.kicker', {}, ['Bienvenue']),
    h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, margin: '8px 0' } }, ['Votre espace est prêt.']),
    h('p.mute', {}, ['Vos cours, notes et examens apparaîtront ici dès que votre établissement aura saisi vos premières informations.']),
  ]);
}

function emptyBlock(msg) {
  return h('div.empty', {}, [
    h('div.empty__ico', {}, [Icon('book', { size: 22 })]),
    h('p.empty__msg', {}, [msg]),
  ]);
}

function gradeChip(value) {
  const v = parseFloat(value);
  const tone = v >= 14 ? 'success' : v >= 10 ? 'accent' : 'danger';
  return Badge({ tone, size: 'md' }, [v.toFixed(2)]);
}

function gradeTypeLabel(type) {
  return { cours: 'Cours', controle: 'Contrôle', tp: 'TP', examen: 'Examen' }[type] || type;
}

function docTypeLabel(t) {
  return {
    attestation_scolarite: 'Attestation de scolarité',
    releve_notes: 'Relevé de notes',
    attestation_inscription: 'Attestation d\'inscription',
    attestation_reussite: 'Attestation de réussite',
    autre: 'Autre',
  }[t] || t;
}

function docStatusBadge(status) {
  return {
    pending:  Badge({ tone: 'warn',    dot: true }, ['En attente']),
    sent:     Badge({ tone: 'success', dot: true }, ['Envoyé']),
    rejected: Badge({ tone: 'danger',  dot: true }, ['Refusé']),
  }[status] || Badge({ tone: 'default' }, [status]);
}
