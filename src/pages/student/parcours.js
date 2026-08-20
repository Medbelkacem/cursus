// §10, §11 — Parcours académique de l'étudiant : relevés S1 → S5, notes,
// rattrapages et règlement appliqué.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Badge } from '../../components/badge.js';
import { Button } from '../../components/button.js';
import {
  SectionHead, Notice, SemesterStepper, StatusPill, Bar, fmtPct,
} from '../../lib/ui.js';
import {
  SEMESTER_STATUS, FAILURE_DECISIONS, SEMESTERS, semLabel,
} from '../../lib/nomenclature.js';
import { EmptyBlock, fmtDate } from '../../lib/page-helpers.js';
import { downloadCSV, printReport, slugStamp } from '../../lib/export.js';
import { toast } from '../../components/toast.js';
import { studentOverview, listStudentGrades } from '../../lib/db.js';

export async function studentParcoursPage() {
  return protectedPage({
    role: 'student',
    title: 'Mon parcours',
    breadcrumb: 'Étudiant · Parcours',
    active: t('nav.path'),
    build: async ({ profile }) => {
      const [overview, grades] = await Promise.all([
        studentOverview().catch(() => null),
        listStudentGrades(profile.id).catch(() => []),
      ]);

      const s = overview?.student || null;
      const semesters = overview?.semesters || [];
      const rule = overview?.rule || null;

      if (!s) {
        return [Notice({ tone: 'warn', title: 'Dossier incomplet' }, [
          'Votre compte n’est pas encore rattaché à une formation.',
        ])];
      }

      // Notes regroupées par semestre puis par matière
      const bySem = new Map();
      for (const g of grades) {
        const code = g.semester || g.subjects?.semester;
        if (!code) continue;
        if (!bySem.has(code)) bySem.set(code, []);
        bySem.get(code).push(g);
      }

      function subjectRows(list) {
        const bySubject = new Map();
        for (const g of list) {
          const id = g.subject_id;
          if (!bySubject.has(id)) {
            bySubject.set(id, {
              name: g.subjects?.name || '—',
              coefficient: Number(g.subjects?.coefficient || 1),
              credits: g.subjects?.credits,
              normal: [], resit: [],
            });
          }
          bySubject.get(id)[g.is_resit ? 'resit' : 'normal'].push(Number(g.value));
        }
        return [...bySubject.values()].map((r) => {
          const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
          return { ...r, normalAvg: avg(r.normal), resitAvg: avg(r.resit) };
        });
      }

      const passMark = rule ? Number(rule.pass_mark) : 10;

      // ── Export du relevé ───────────────────────────────────────────────
      function exportCSV() {
        const rows = semesters.map((x) => ({
          semester: semLabel(x.semester),
          year: x.academic_year || '',
          average: x.average != null ? Number(x.average).toFixed(2) : '',
          resit: x.resit_average != null ? Number(x.resit_average).toFixed(2) : '',
          final: x.final_average != null ? Number(x.final_average).toFixed(2) : '',
          credits: x.credits_earned ?? '',
          attendance: x.attendance_rate != null ? `${x.attendance_rate}` : '',
          status: SEMESTER_STATUS[x.status]?.label || x.status,
        }));
        if (!rows.length) { toast('Aucun relevé à exporter.', { tone: 'warn' }); return; }
        downloadCSV(slugStamp('mon-releve'), [
          { label: 'Semestre', value: (r) => r.semester },
          { label: 'Année', value: (r) => r.year },
          { label: 'Moyenne', value: (r) => r.average },
          { label: 'Rattrapage', value: (r) => r.resit },
          { label: 'Moyenne retenue', value: (r) => r.final },
          { label: 'Crédits', value: (r) => r.credits },
          { label: 'Assiduité (%)', value: (r) => r.attendance },
          { label: 'Statut', value: (r) => r.status },
        ], rows);
      }

      function exportPDF() {
        if (!semesters.length) { toast('Aucun relevé à imprimer.', { tone: 'warn' }); return; }
        printReport({
          title: 'Relevé de notes',
          subtitle: `${s.first_name || ''} ${s.last_name || ''} — ${s.student_number || ''}`.trim(),
          meta: [
            { label: 'Établissement', value: s.establishment || '—' },
            { label: 'Wilaya', value: s.wilaya || '—' },
            { label: 'Programme', value: s.program || '—' },
            { label: 'Spécialité', value: s.specialty || '—' },
            { label: 'Mode', value: s.training_mode || '—' },
            { label: 'Semestre en cours', value: semLabel(s.current_semester) },
          ],
          kpis: [
            { label: 'Semestres validés',
              value: `${semesters.filter((x) => x.status === 'validated').length} / 5` },
            { label: 'Crédits',
              value: String(semesters.reduce((n, x) => n + (x.credits_earned || 0), 0)) },
            { label: 'Seuil de validation', value: `${passMark.toFixed(2)}/20` },
          ],
          sections: [
            {
              title: 'Relevés semestriels',
              columns: [
                { label: 'Semestre', value: (r) => semLabel(r.semester) },
                { label: 'Moyenne', value: (r) => r.average != null ? Number(r.average).toFixed(2) : '—' },
                { label: 'Rattrapage', value: (r) => r.resit_average != null ? Number(r.resit_average).toFixed(2) : '—' },
                { label: 'Retenue', value: (r) => r.final_average != null ? Number(r.final_average).toFixed(2) : '—' },
                { label: 'Crédits', value: (r) => r.credits_earned ?? '—' },
                { label: 'Statut', value: (r) => SEMESTER_STATUS[r.status]?.label || r.status },
              ],
              rows: semesters,
            },
            ...SEMESTERS.filter((c) => bySem.has(c)).map((c) => ({
              title: `Détail des notes — ${semLabel(c)}`,
              columns: [
                { label: 'Matière', value: (r) => r.name },
                { label: 'Coef.', value: (r) => r.coefficient },
                { label: 'Moyenne', value: (r) => r.normalAvg != null ? r.normalAvg.toFixed(2) : '—' },
                { label: 'Rattrapage', value: (r) => r.resitAvg != null ? r.resitAvg.toFixed(2) : '—' },
                { label: 'Crédits', value: (r) => r.credits ?? '—' },
              ],
              rows: subjectRows(bySem.get(c)),
            })),
          ],
        });
      }

      // ── Cartes semestrielles ───────────────────────────────────────────
      const semCards = semesters.map((sem) => {
        const list = bySem.get(sem.semester) || [];
        const subjects = subjectRows(list);
        const shown = sem.final_average ?? sem.average;

        return Card({ padding: 0 }, [
          h('div', {
            style: { display: 'flex', justifyContent: 'space-between', gap: '12px',
                     alignItems: 'center', padding: '16px 20px',
                     borderBottom: '1px solid var(--c-line-soft)' },
          }, [
            h('div', {}, [
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
                h('strong', { style: { fontSize: '15px' } }, [`Semestre ${semLabel(sem.semester)}`]),
                StatusPill(SEMESTER_STATUS, sem.status),
                sem.semester === s.current_semester
                  && Badge({ tone: 'accent', size: 'sm' }, ['en cours']),
              ].filter(Boolean)),
              h('div.small.mute', { style: { marginTop: 2 } }, [
                [
                  sem.academic_year || null,
                  sem.credits_earned != null ? `${sem.credits_earned} crédits` : null,
                  sem.attendance_rate != null ? `assiduité ${fmtPct(sem.attendance_rate)}` : null,
                ].filter(Boolean).join(' · ') || 'Aucune note enregistrée',
              ]),
            ]),
            h('div', { style: { textAlign: 'end' } }, [
              h('div', { style: { fontSize: '22px', fontWeight: 700, lineHeight: 1 } }, [
                shown != null ? Number(shown).toFixed(2) : '—',
                h('span.mute', { style: { fontSize: '13px', fontWeight: 400 } }, ['/20']),
              ]),
              shown != null && h('div', { style: { width: '120px', marginTop: '6px' } }, [
                Bar((Number(shown) / 20) * 100,
                  Number(shown) >= passMark ? 'success' : 'danger'),
              ]),
            ].filter(Boolean)),
          ]),

          sem.status === 'pending_resit' && h('div', { style: { padding: '12px 20px' } }, [
            Notice({ tone: 'warn', title: 'Examen de rattrapage requis' }, [
              `Moyenne de ${Number(sem.average).toFixed(2)}/20, inférieure au seuil de `
              + `${passMark.toFixed(2)}/20 fixé par le règlement pédagogique.`,
            ]),
          ]),

          sem.status === 'resit_failed' && h('div', { style: { padding: '12px 20px' } }, [
            Notice({ tone: 'danger', title: 'Rattrapage non validé' }, [
              sem.decision
                ? `Décision appliquée : ${FAILURE_DECISIONS[sem.decision]?.label}.`
                  + (sem.decision_note ? ` ${sem.decision_note}` : '')
                : 'Votre situation est en cours d’examen par l’administration.',
            ]),
          ]),

          (sem.status === 'repeating' || sem.status === 'dismissed')
            && h('div', { style: { padding: '12px 20px' } }, [
              Notice({ tone: sem.status === 'dismissed' ? 'danger' : 'warn',
                       title: SEMESTER_STATUS[sem.status].label }, [
                sem.decision_note || FAILURE_DECISIONS[sem.decision]?.label || '—',
              ]),
            ]),

          subjects.length === 0
            ? h('p.small.mute', { style: { padding: '16px 20px' } }, [
                'Aucune note saisie pour ce semestre.',
              ])
            : h('table.table.table--dense', {}, [
                h('thead', {}, [h('tr', {}, [
                  h('th', {}, ['Matière']),
                  h('th', { style: { textAlign: 'right' } }, ['Coef.']),
                  h('th', { style: { textAlign: 'right' } }, ['Crédits']),
                  h('th', { style: { textAlign: 'right' } }, ['Moyenne']),
                  h('th', { style: { textAlign: 'right' } }, ['Rattrapage']),
                  h('th', {}, ['']),
                ])]),
                h('tbody', {}, subjects.map((r) => {
                  const best = r.resitAvg ?? r.normalAvg;
                  return h('tr', {}, [
                    h('td', {}, [r.name]),
                    h('td.mono', { style: { textAlign: 'right' } }, [String(r.coefficient)]),
                    h('td.mono', { style: { textAlign: 'right' } }, [r.credits ?? '—']),
                    h('td.mono', { style: { textAlign: 'right' } },
                      [r.normalAvg != null ? r.normalAvg.toFixed(2) : '—']),
                    h('td.mono', { style: { textAlign: 'right' } },
                      [r.resitAvg != null ? r.resitAvg.toFixed(2) : '—']),
                    h('td', { style: { width: '90px' } }, [
                      best != null
                        ? Bar((best / 20) * 100, best >= passMark ? 'success' : 'danger')
                        : h('span.mute', {}, ['—']),
                    ]),
                  ]);
                })),
              ]),
        ].filter(Boolean));
      });

      return [
        SectionHead(
          'Mon parcours académique',
          rule
            ? `Règlement appliqué : ${rule.label} — validation à ${passMark.toFixed(2)}/20, `
              + `rattrapage à ${Number(rule.resit_pass_mark).toFixed(2)}/20`
            : null,
          [
            Button({ label: 'Relevé PDF', icon: 'file-text', variant: 'secondary', size: 'sm',
                     onClick: exportPDF }),
            Button({ label: 'CSV', icon: 'download', variant: 'ghost', size: 'sm',
                     onClick: exportCSV }),
          ]
        ),

        SemesterStepper(semesters, s.current_semester),

        semesters.length === 0
          ? EmptyBlock('Aucun relevé semestriel pour le moment.', 'chart')
          : h('div', { style: { display: 'grid', gap: 'var(--s-4)' } }, semCards),
      ].filter(Boolean);
    },
  });
}
