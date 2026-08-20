// §10, §11, §21 — Suivi des étudiants et de leur progression académique.
// Ministère (national), direction (sa wilaya), établissement (le sien).

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Select, Textarea } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { DataTable } from '../../components/table.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import {
  StatusPill, SectionHead, Notice, KPIGrid, SemesterStepper, fmtNum, fmtPct,
} from '../../lib/ui.js';
import {
  SEMESTER_STATUS, ENROLLMENT_STATUS, CONTRACT_STATUS, FAILURE_DECISIONS,
  semOptions, semLabel, typeOptions,
} from '../../lib/nomenclature.js';
import { fmtDate } from '../../lib/page-helpers.js';
import {
  searchStudents, listWilayas, listEstablishments, listPrograms, listTrainingModes,
  studentOverview, listStudentSemesters, applySemesterDecision, recalcSemester,
  listStudentGrades, effectiveRule,
} from '../../lib/db.js';

export async function studentsMonitoringPage() {
  return protectedPage({
    role: ['ministry', 'direction', 'admin'],
    title: 'Étudiants',
    breadcrumb: 'Administration · Étudiants',
    active: t('nav.students'),
    build: async ({ profile }) => {
      const role = profile.role;

      const [students, wilayas, estabs, programs, modes] = await Promise.all([
        searchStudents({ p_limit: 1000 }),
        listWilayas().catch(() => []),
        listEstablishments().catch(() => []),
        listPrograms().catch(() => []),
        listTrainingModes().catch(() => []),
      ]);

      const reload = () => window.location.reload();

      // ── Fiche étudiant : parcours, décisions, dossiers ────────────────
      async function openStudent(s) {
        const [semesters, grades, rule] = await Promise.all([
          listStudentSemesters(s.profile_id).catch(() => []),
          listStudentGrades(s.profile_id).catch(() => []),
          effectiveRule(s.establishment_id).catch(() => null),
        ]);

        const decisionBlocks = semesters
          .filter((sem) => sem.status === 'resit_failed')
          .map((sem) => {
            const sel = Select({
              value: sem.decision || rule?.on_resit_failure || 'manual_review',
              options: Object.entries(FAILURE_DECISIONS).map(([v, m]) => ({ value: v, label: m.label })),
            });
            const note = Textarea({ rows: 2, value: sem.decision_note || '',
                                    placeholder: 'Motivation de la décision (jury, règlement…)' });
            const apply = Button({ label: 'Appliquer', icon: 'check', variant: 'primary', size: 'sm' });

            apply.addEventListener('click', async () => {
              const ok = await confirmDialog({
                title: 'Prononcer la décision',
                message: `${FAILURE_DECISIONS[sel.value].label} pour le semestre ${semLabel(sem.semester)}. `
                  + "L'étudiant sera notifié.",
                confirmLabel: 'Confirmer',
                danger: sel.value === 'dismiss',
              });
              if (!ok) return;
              apply.disabled = true;
              try {
                await applySemesterDecision(sem.id, sel.value, note.value.trim() || null);
                toast('Décision enregistrée.', { tone: 'success' });
                reload();
              } catch (err) {
                apply.disabled = false;
                toast(err.message || 'Décision impossible.', { tone: 'danger' });
              }
            });

            return Card({ padding: 14 }, [
              Notice({ tone: 'danger', title: `Rattrapage non validé — ${semLabel(sem.semester)}` }, [
                `Moyenne de rattrapage : ${sem.resit_average ?? '—'}/20. `
                + 'Une décision pédagogique doit être prononcée.',
              ]),
              h('div.form-grid--2.form-grid', { style: { marginTop: 'var(--s-3)' } }, [
                Field({ label: 'Décision', children: sel }),
                Field({ label: 'Note', children: note }),
              ]),
              h('div', { style: { marginTop: 'var(--s-2, 8px)' } }, [apply]),
            ]);
          });

        const gradesBySem = new Map();
        for (const g of grades) {
          const code = g.semester || g.subjects?.semester;
          if (!code) continue;
          if (!gradesBySem.has(code)) gradesBySem.set(code, []);
          gradesBySem.get(code).push(g);
        }

        const recalcBtn = Button({
          label: 'Recalculer les moyennes', icon: 'refresh', variant: 'ghost', size: 'sm',
          onClick: async () => {
            recalcBtn.disabled = true;
            try {
              for (const sem of semesters) await recalcSemester(s.profile_id, sem.semester);
              toast('Moyennes recalculées.', { tone: 'success' });
              reload();
            } catch (err) {
              recalcBtn.disabled = false;
              toast(err.message || 'Recalcul impossible.', { tone: 'danger' });
            }
          },
        });

        const m = Modal({
          title: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email,
          subtitle: `${s.student_number || '—'} · ${s.establishment || '—'} · ${s.wilaya || '—'}`,
          size: 'xl',
          children: [
            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
              StatusPill(ENROLLMENT_STATUS, s.enrollment),
              Badge({ tone: 'outline', size: 'sm' }, [`Semestre ${semLabel(s.semester)}`]),
              s.training_mode && Badge({ tone: 'outline', size: 'sm' }, [s.training_mode]),
              s.contract_status && Badge({ tone: 'accent', size: 'sm' },
                [`Apprentissage : ${CONTRACT_STATUS[s.contract_status]?.label}`]),
              s.internship_status && Badge({ tone: 'accent', size: 'sm' },
                [`Stage S5 : ${CONTRACT_STATUS[s.internship_status]?.label}`]),
            ].filter(Boolean)),

            h('dl', {
              style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                       gap: '10px 18px', margin: 0 },
            }, [
              ['Programme', s.program], ['Spécialité', s.specialty],
              ['Établissement', s.establishment], ['Wilaya', s.wilaya],
              ['Email', s.email],
              ['Règlement appliqué', rule ? `${rule.label} (seuil ${rule.pass_mark}/20)` : null],
            ].filter(([, v]) => v).map(([k, v]) => h('div', {}, [
              h('dt.kpi__label', {}, [k]),
              h('dd', { style: { margin: '2px 0 0', fontSize: '13px', fontWeight: 500 } }, [v]),
            ]))),

            h('div', {}, [
              h('div.section-head', {}, [
                h('div', {}, [h('h2', {}, ['Parcours S1 → S5'])]),
                h('div.row-actions', {}, [recalcBtn]),
              ]),
              SemesterStepper(semesters, s.semester),
            ]),

            ...decisionBlocks,

            semesters.length > 0 && h('div', {}, [
              h('div.kpi__label', { style: { marginBottom: 8 } }, ['Relevés semestriels']),
              h('table.table.table--dense', {}, [
                h('thead', {}, [h('tr', {}, [
                  h('th', {}, ['Semestre']), h('th', {}, ['Année']),
                  h('th', { style: { textAlign: 'right' } }, ['Moyenne']),
                  h('th', { style: { textAlign: 'right' } }, ['Rattrapage']),
                  h('th', { style: { textAlign: 'right' } }, ['Retenue']),
                  h('th', { style: { textAlign: 'right' } }, ['Crédits']),
                  h('th', { style: { textAlign: 'right' } }, ['Présence']),
                  h('th', {}, ['Statut']), h('th', {}, ['Décision']),
                ])]),
                h('tbody', {}, semesters.map((sem) => h('tr', {}, [
                  h('td.mono', {}, [semLabel(sem.semester)]),
                  h('td.mono.small', {}, [sem.academic_year || '—']),
                  h('td.mono', { style: { textAlign: 'right' } },
                    [sem.average != null ? Number(sem.average).toFixed(2) : '—']),
                  h('td.mono', { style: { textAlign: 'right' } },
                    [sem.resit_average != null ? Number(sem.resit_average).toFixed(2) : '—']),
                  h('td.mono', { style: { textAlign: 'right', fontWeight: 600 } },
                    [sem.final_average != null ? Number(sem.final_average).toFixed(2) : '—']),
                  h('td.mono', { style: { textAlign: 'right' } }, [sem.credits_earned ?? '—']),
                  h('td.mono', { style: { textAlign: 'right' } }, [fmtPct(sem.attendance_rate)]),
                  h('td', {}, [StatusPill(SEMESTER_STATUS, sem.status)]),
                  h('td.small', {}, [
                    sem.decision ? FAILURE_DECISIONS[sem.decision]?.label || sem.decision : '—',
                  ]),
                ]))),
              ]),
            ]),

            grades.length > 0 && h('div', {}, [
              h('div.kpi__label', { style: { marginBottom: 8 } }, [`Notes (${grades.length})`]),
              h('div', { style: { maxHeight: '260px', overflowY: 'auto' } }, [
                h('table.table.table--dense', {}, [
                  h('thead', {}, [h('tr', {}, [
                    h('th', {}, ['Semestre']), h('th', {}, ['Matière']), h('th', {}, ['Type']),
                    h('th', { style: { textAlign: 'right' } }, ['Note']),
                    h('th', {}, ['Session']), h('th', {}, ['Date']),
                  ])]),
                  h('tbody', {}, grades.map((g) => h('tr', {}, [
                    h('td.mono', {}, [semLabel(g.semester || g.subjects?.semester)]),
                    h('td', {}, [g.subjects?.name || '—']),
                    h('td.small', {}, [g.type]),
                    h('td.mono', { style: { textAlign: 'right', fontWeight: 600 } },
                      [Number(g.value).toFixed(2)]),
                    h('td', {}, [g.is_resit
                      ? Badge({ tone: 'warn', size: 'sm' }, ['rattrapage'])
                      : h('span.small.mute', {}, ['normale'])]),
                    h('td.mono.small', {}, [fmtDate(g.graded_at)]),
                  ]))),
                ]),
              ]),
            ]),
          ].filter(Boolean),
          actions: [Button({ label: 'Fermer', variant: 'secondary', onClick: () => m.close() })],
        });

        m.open();
      }

      // ── Statistiques d'en-tête ────────────────────────────────────────
      const nResit = students.filter((s) => s.semester_status === 'pending_resit').length;
      const nValidated = students.filter((s) => s.semester_status === 'validated').length;
      const nS5 = students.filter((s) => s.semester === 's5').length;
      const avg = (() => {
        const vals = students.map((s) => Number(s.average)).filter((v) => !Number.isNaN(v) && v > 0);
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—';
      })();

      const table = DataTable({
        rows: students,
        exportName: 'etudiants',
        searchPlaceholder: 'Nom, numéro, email, établissement…',
        empty: 'Aucun étudiant dans votre périmètre.',
        emptyIcon: 'users',
        pageSize: 50,
        search: (r, q) => [r.first_name, r.last_name, r.email, r.student_number,
                           r.establishment, r.specialty, r.program]
          .some((v) => String(v ?? '').toLowerCase().includes(q)),
        filters: [
          ...(role !== 'admin' ? [{
            key: 'wilaya', label: 'Wilaya', value: (r) => r.wilaya || '',
            options: [{ value: '', label: 'Toutes' },
              ...wilayas.map((w) => ({ value: w.name, label: `${w.code} — ${w.name}` }))],
          }] : []),
          ...(role !== 'admin' ? [{
            key: 'establishment', label: 'Établissement', value: (r) => r.establishment || '',
            options: [{ value: '', label: 'Tous' },
              ...estabs.map((e) => ({ value: e.name, label: e.name }))],
          }] : []),
          { key: 'program', label: 'Programme', value: (r) => r.program || '',
            options: [{ value: '', label: 'Tous' },
              ...programs.map((p) => ({ value: p.name, label: p.name }))] },
          { key: 'training_mode', label: 'Mode', value: (r) => r.training_mode || '',
            options: [{ value: '', label: 'Tous' },
              ...modes.map((mm) => ({ value: mm.name, label: mm.name }))] },
          { key: 'semester', label: 'Semestre', value: (r) => r.semester || '', options: semOptions() },
          { key: 'enrollment', label: 'Inscription', value: (r) => r.enrollment || '',
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(ENROLLMENT_STATUS).map(([v, mm]) => ({ value: v, label: mm.label }))] },
          { key: 'semester_status', label: 'Statut académique', value: (r) => r.semester_status || '',
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(SEMESTER_STATUS).map(([v, mm]) => ({ value: v, label: mm.label }))] },
          { key: 'contract_status', label: 'Contrat', value: (r) => r.contract_status || '',
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(CONTRACT_STATUS).map(([v, mm]) => ({ value: v, label: mm.label }))] },
          { key: 'internship_status', label: 'Stage S5', value: (r) => r.internship_status || '',
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(CONTRACT_STATUS).map(([v, mm]) => ({ value: v, label: mm.label }))] },
        ],
        columns: [
          { key: 'name', label: 'Étudiant',
            value: (r) => `${r.last_name || ''} ${r.first_name || ''}`.trim(),
            render: (r) => h('div', {}, [
              h('div', { style: { fontWeight: 500 } },
                [`${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email]),
              h('div.mono.small.mute', {}, [r.student_number || '—']),
            ]) },
          { key: 'establishment', label: 'Établissement', value: (r) => r.establishment || '—' },
          { key: 'wilaya', label: 'Wilaya', value: (r) => r.wilaya || '—' },
          { key: 'program', label: 'Programme', value: (r) => r.program || '—' },
          { key: 'specialty', label: 'Spécialité', value: (r) => r.specialty || '—' },
          { key: 'training_mode', label: 'Mode', value: (r) => r.training_mode || '—' },
          { key: 'semester', label: 'Sem.', value: (r) => semLabel(r.semester),
            render: (r) => h('span.mono', {}, [semLabel(r.semester)]) },
          { key: 'average', label: 'Moyenne', align: 'right',
            value: (r) => r.average != null ? Number(r.average).toFixed(2) : '—',
            sortValue: (r) => Number(r.average) || 0 },
          { key: 'semester_status', label: 'Académique',
            value: (r) => SEMESTER_STATUS[r.semester_status]?.label || '—',
            render: (r) => r.semester_status
              ? StatusPill(SEMESTER_STATUS, r.semester_status) : h('span.mute', {}, ['—']) },
          { key: 'enrollment', label: 'Inscription',
            value: (r) => ENROLLMENT_STATUS[r.enrollment]?.label,
            render: (r) => StatusPill(ENROLLMENT_STATUS, r.enrollment) },
        ],
        onRow: openStudent,
      });

      return [
        SectionHead('Suivi des étudiants',
          `${students.length} étudiant${students.length > 1 ? 's' : ''} dans votre périmètre`),

        KPIGrid([
          { label: 'Étudiants', value: fmtNum(students.length) },
          { label: 'Semestre validé', value: fmtNum(nValidated) },
          { label: 'En rattrapage', value: fmtNum(nResit), tone: nResit > 0 ? 'warn' : null },
          { label: 'En S5', value: fmtNum(nS5), sub: 'stage pratique requis' },
          { label: 'Moyenne générale', value: avg, suffix: '/20' },
        ]),

        nResit > 0 && Notice({ tone: 'warn', title: `${nResit} étudiant(s) en rattrapage` }, [
          'Le passage en rattrapage est automatique dès que la moyenne semestrielle est '
          + 'inférieure au seuil défini dans le règlement pédagogique.',
        ]),

        table,
      ].filter(Boolean);
    },
  });
}
