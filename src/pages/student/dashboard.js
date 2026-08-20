// §15 — Espace étudiant : informations personnelles, progression, dossiers.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Badge } from '../../components/badge.js';
import {
  KPIGrid, SectionHead, Notice, SemesterStepper, StatusPill, fmtPct, fullName,
} from '../../lib/ui.js';
import {
  SEMESTER_STATUS, ENROLLMENT_STATUS, CONTRACT_STATUS, semLabel, typeLabel,
} from '../../lib/nomenclature.js';
import { EmptyBlock, fmtDate, fmtDateTime } from '../../lib/page-helpers.js';
import { studentOverview, listNotifications } from '../../lib/db.js';

export async function studentDashboard() {
  return protectedPage({
    role: 'student',
    title: 'Mon espace',
    breadcrumb: 'Étudiant · Tableau de bord',
    active: t('nav.dashboard'),
    build: async ({ profile }) => {
      const [overview, notifs] = await Promise.all([
        studentOverview().catch(() => null),
        listNotifications(6).catch(() => []),
      ]);

      const s = overview?.student || null;
      const semesters = overview?.semesters || [];
      const contracts = overview?.contracts || [];
      const rule = overview?.rule || null;

      if (!s) {
        return [
          Notice({ tone: 'warn', title: 'Dossier étudiant incomplet' }, [
            'Votre compte n’est pas encore rattaché à un établissement et à une spécialité. '
            + 'Contactez l’administration de votre établissement.',
          ]),
        ];
      }

      const currentSem = semesters.find((x) => x.semester === s.current_semester) || null;
      const validated = semesters.filter((x) => x.status === 'validated').length;
      const apprenticeship = contracts.find((c) => c.kind === 'apprenticeship') || null;
      const internship = contracts.find((c) => c.kind === 'internship') || null;

      const needsApprenticeship = !!s.requires_contract && !apprenticeship;
      const needsInternship = s.current_semester === 's5' && !internship;

      const infoRows = [
        ['Établissement', s.establishment],
        ['Type', s.establishment_type ? typeLabel(s.establishment_type) : null],
        ['Wilaya', s.wilaya],
        ['Programme', s.program],
        ['Spécialité', s.specialty],
        ['Mode de formation', s.training_mode],
        ['Classe', s.group],
        ['N° étudiant', s.student_number],
        ['Inscrit depuis', s.enrollment_date ? fmtDate(s.enrollment_date) : null],
      ].filter(([, v]) => v);

      return [
        // ── Identité ──────────────────────────────────────────────────────
        Card({ padding: 20, accent: true }, [
          h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '16px',
                              flexWrap: 'wrap', alignItems: 'flex-start' } }, [
            h('div', {}, [
              h('div.kpi__label', {}, ['Étudiant']),
              h('div', { style: { fontSize: '19px', fontWeight: 700, marginTop: '2px' } }, [
                fullName({ first_name: s.first_name, last_name: s.last_name, email: s.email }),
              ]),
              h('div.small.mute', {}, [s.email || '']),
            ]),
            h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, [
              StatusPill(ENROLLMENT_STATUS, s.enrollment_status),
              Badge({ tone: 'outline', size: 'sm' }, [`Semestre ${semLabel(s.current_semester)}`]),
            ]),
          ]),
          h('dl', {
            style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                     gap: '12px 18px', margin: '16px 0 0' },
          }, infoRows.map(([k, v]) => h('div', {}, [
            h('dt.kpi__label', {}, [k]),
            h('dd', { style: { margin: '2px 0 0', fontSize: '13px', fontWeight: 500 } }, [v]),
          ]))),
        ]),

        // ── Alertes d'action ──────────────────────────────────────────────
        needsApprenticeship && Notice({ tone: 'warn', title: "Contrat d'apprentissage à déposer" }, [
          h('span', {}, ['Votre mode de formation impose le dépôt d’un contrat signé. ']),
          h('a', { href: '/etudiant/apprentissage', 'data-link': '',
                   style: { fontWeight: 600, color: 'inherit' } }, ['Déposer maintenant →']),
        ]),
        needsInternship && Notice({ tone: 'warn', title: 'Stage pratique S5 à déposer' }, [
          h('span', {}, ['Le semestre S5 comporte un stage pratique obligatoire. ']),
          h('a', { href: '/etudiant/stage', 'data-link': '',
                   style: { fontWeight: 600, color: 'inherit' } }, ['Déposer ma convention →']),
        ]),
        currentSem?.status === 'pending_resit' && Notice({
          tone: 'warn', title: `Rattrapage — semestre ${semLabel(currentSem.semester)}`,
        }, [
          `Votre moyenne est de ${Number(currentSem.average).toFixed(2)}/20, en dessous du seuil `
          + `de ${rule ? Number(rule.pass_mark).toFixed(2) : '10.00'}/20. Un examen de rattrapage est requis.`,
        ]),
        currentSem?.status === 'resit_failed' && Notice({
          tone: 'danger', title: 'Rattrapage non validé',
        }, [
          'Votre situation est en cours d’examen par l’administration de votre établissement.',
        ]),

        // ── Indicateurs ───────────────────────────────────────────────────
        KPIGrid([
          { label: 'Semestre en cours', value: semLabel(s.current_semester),
            sub: currentSem ? SEMESTER_STATUS[currentSem.status]?.label : 'non démarré' },
          { label: 'Moyenne du semestre',
            value: currentSem?.final_average != null
              ? Number(currentSem.final_average).toFixed(2)
              : currentSem?.average != null ? Number(currentSem.average).toFixed(2) : '—',
            suffix: '/20' },
          { label: 'Semestres validés', value: `${validated} / 5` },
          { label: 'Assiduité', value: fmtPct(currentSem?.attendance_rate) },
          { label: 'Crédits obtenus',
            value: semesters.reduce((n, x) => n + (x.credits_earned || 0), 0) },
        ]),

        // ── Parcours ──────────────────────────────────────────────────────
        h('div', {}, [
          SectionHead('Progression S1 → S5', 'Moyennes et validation de chaque semestre',
            Button({ label: 'Détail du parcours', icon: 'arrow-right', variant: 'ghost', size: 'sm',
                     href: '/etudiant/parcours' })),
          SemesterStepper(semesters, s.current_semester),
        ]),

        // ── Dossiers ──────────────────────────────────────────────────────
        h('div', {}, [
          SectionHead('Mes dossiers', 'Apprentissage et stage pratique'),
          h('div', { style: { display: 'grid', gap: 'var(--s-3)',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' } }, [
            Card({ padding: 18 }, [
              h('h3.card__title', {}, ["Contrat d'apprentissage"]),
              apprenticeship
                ? h('div', { style: { marginTop: 10 } }, [
                    h('div', { style: { fontSize: '13px', fontWeight: 500 } }, [apprenticeship.company_name]),
                    h('div.small.mute', { style: { marginBottom: 8 } }, [
                      [apprenticeship.start_date, apprenticeship.end_date]
                        .filter(Boolean).map(fmtDate).join(' → ') || '—',
                    ]),
                    StatusPill(CONTRACT_STATUS, apprenticeship.status),
                  ])
                : h('p.small.mute', { style: { margin: '8px 0 12px' } }, [
                    s.requires_contract ? 'Dossier obligatoire non déposé.' : 'Aucun dossier déposé.',
                  ]),
              h('div', { style: { marginTop: 12 } }, [
                Button({ label: apprenticeship ? 'Consulter' : 'Déposer', icon: 'briefcase',
                         variant: apprenticeship ? 'ghost' : 'secondary', size: 'sm',
                         href: '/etudiant/apprentissage' }),
              ]),
            ]),
            Card({ padding: 18 }, [
              h('h3.card__title', {}, ['Stage pratique S5']),
              internship
                ? h('div', { style: { marginTop: 10 } }, [
                    h('div', { style: { fontSize: '13px', fontWeight: 500 } }, [internship.company_name]),
                    h('div.small.mute', { style: { marginBottom: 8 } }, [
                      [internship.start_date, internship.end_date]
                        .filter(Boolean).map(fmtDate).join(' → ') || '—',
                    ]),
                    StatusPill(CONTRACT_STATUS, internship.status),
                  ])
                : h('p.small.mute', { style: { margin: '8px 0 12px' } }, [
                    s.current_semester === 's5'
                      ? 'Convention obligatoire non déposée.'
                      : 'Requis à partir du semestre S5.',
                  ]),
              h('div', { style: { marginTop: 12 } }, [
                Button({ label: internship ? 'Consulter' : 'Déposer', icon: 'award',
                         variant: internship ? 'ghost' : 'secondary', size: 'sm',
                         href: '/etudiant/stage' }),
              ]),
            ]),
          ]),
        ]),

        // ── Notifications récentes ───────────────────────────────────────
        h('div', {}, [
          SectionHead('Notifications récentes', null,
            Button({ label: 'Tout voir', icon: 'arrow-right', variant: 'ghost', size: 'sm',
                     href: '/notifications' })),
          Card({ padding: 0 }, [
            notifs.length === 0
              ? EmptyBlock('Aucune notification.', 'bell')
              : h('ul.notif-list', {}, notifs.map((n) => h('li', {
                  class: `notif-item${n.read_at ? '' : ' notif-item--unread'}`,
                }, [
                  h('div', { style: { flex: '1 1 auto', minWidth: 0 } }, [
                    h('div.notif-item__title', {}, [n.title]),
                    n.body && h('div.notif-item__body', {}, [n.body]),
                    h('div.notif-item__when', {}, [fmtDateTime(n.created_at)]),
                  ].filter(Boolean)),
                ]))),
          ]),
        ]),
      ].filter(Boolean);
    },
  });
}
