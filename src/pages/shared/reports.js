// §22 — Génération de rapports (PDF via impression, Excel/CSV).
// Le contenu est produit à partir des données réelles du périmètre autorisé.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Select, Input } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { toast } from '../../components/toast.js';
import { SectionHead, Notice, fmtNum, fmtPct, fullName } from '../../lib/ui.js';
import {
  SEMESTER_STATUS, ENROLLMENT_STATUS, CONTRACT_STATUS, semOptions, semLabel,
  typeAbbr, typeOptions, ESTABLISHMENT_TYPES,
} from '../../lib/nomenclature.js';
import { fmtDate } from '../../lib/page-helpers.js';
import { downloadCSV, printReport, slugStamp } from '../../lib/export.js';
import {
  statsNational, statsWilaya, statsEstablishment, searchStudents, listContracts,
  listEstablishments, listWilayas, listPrograms,
} from '../../lib/db.js';

const SCOPE_TITLE = {
  ministry: 'National',
  direction: 'Wilaya',
  admin: 'Établissement',
};

export async function reportsPage() {
  return protectedPage({
    role: ['ministry', 'direction', 'admin'],
    title: 'Rapports',
    breadcrumb: 'Administration · Rapports',
    active: t('nav.reports'),
    build: async ({ profile }) => {
      const role = profile.role;

      const fetchStats = role === 'ministry' ? statsNational
        : role === 'direction' ? () => statsWilaya()
        : () => statsEstablishment();

      const [stats, wilayas, estabs, programs] = await Promise.all([
        fetchStats().catch(() => null),
        listWilayas().catch(() => []),
        listEstablishments().catch(() => []),
        listPrograms().catch(() => []),
      ]);

      // ── Filtres du rapport ─────────────────────────────────────────────
      const typeSel = Select({ value: '', options: typeOptions('Tous les types') });
      const wilayaSel = Select({
        value: '',
        options: [{ value: '', label: 'Toutes les wilayas' },
          ...wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))],
      });
      const estabSel = Select({
        value: role === 'admin' ? (profile.establishment_id || '') : '',
        options: [{ value: '', label: 'Tous les établissements' },
          ...estabs.map((e) => ({ value: e.id, label: e.name }))],
        disabled: role === 'admin',
      });
      const programSel = Select({
        value: '',
        options: [{ value: '', label: 'Tous les programmes' },
          ...programs.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))],
      });
      const semesterSel = Select({ value: '', options: semOptions() });
      const noteIn = Input({ placeholder: 'Mention portée en en-tête du rapport (facultatif)' });

      function activeFilters() {
        return {
          p_wilaya: wilayaSel.value || null,
          p_estab: estabSel.value || null,
          p_type: typeSel.value || null,
          p_program: programSel.value || null,
          p_semester: semesterSel.value || null,
          p_limit: 1000,
        };
      }

      function filterMeta() {
        const meta = [{ label: 'Périmètre', value: SCOPE_TITLE[role] }];
        if (wilayaSel.value) {
          meta.push({ label: 'Wilaya',
            value: wilayas.find((w) => w.id === wilayaSel.value)?.name || '—' });
        }
        if (estabSel.value) {
          meta.push({ label: 'Établissement',
            value: estabs.find((e) => e.id === estabSel.value)?.name || '—' });
        }
        if (typeSel.value) meta.push({ label: "Type d'établissement", value: typeAbbr(typeSel.value) });
        if (programSel.value) {
          meta.push({ label: 'Programme',
            value: programs.find((p) => p.id === programSel.value)?.name || '—' });
        }
        if (semesterSel.value) meta.push({ label: 'Semestre', value: semLabel(semesterSel.value) });
        if (noteIn.value.trim()) meta.push({ label: 'Mention', value: noteIn.value.trim() });
        meta.push({ label: 'Édité par', value: fullName(profile) });
        return meta;
      }

      // ── Définition des rapports (§22) ──────────────────────────────────
      const REPORTS = [
        {
          key: 'students',
          title: 'Statistiques des étudiants',
          desc: 'Effectifs, répartition par semestre, spécialité, mode de formation et statut.',
          icon: 'users',
          build: async () => {
            const rows = await searchStudents(activeFilters());
            const columns = [
              { label: 'N° étudiant', value: (r) => r.student_number },
              { label: 'Nom', value: (r) => r.last_name },
              { label: 'Prénom', value: (r) => r.first_name },
              { label: 'Email', value: (r) => r.email },
              { label: 'Établissement', value: (r) => r.establishment },
              { label: 'Wilaya', value: (r) => r.wilaya },
              { label: 'Programme', value: (r) => r.program },
              { label: 'Spécialité', value: (r) => r.specialty },
              { label: 'Mode', value: (r) => r.training_mode },
              { label: 'Semestre', value: (r) => semLabel(r.semester) },
              { label: 'Moyenne', value: (r) => r.average != null ? Number(r.average).toFixed(2) : '' },
              { label: 'Statut académique',
                value: (r) => SEMESTER_STATUS[r.semester_status]?.label || '' },
              { label: 'Inscription', value: (r) => ENROLLMENT_STATUS[r.enrollment]?.label || '' },
            ];
            const kpis = [
              { label: 'Étudiants', value: fmtNum(rows.length) },
              { label: 'Validés',
                value: fmtNum(rows.filter((r) => r.semester_status === 'validated').length) },
              { label: 'En rattrapage',
                value: fmtNum(rows.filter((r) => r.semester_status === 'pending_resit').length) },
              { label: 'En S5', value: fmtNum(rows.filter((r) => r.semester === 's5').length) },
            ];
            return { rows, columns, kpis, sectionTitle: 'Liste nominative' };
          },
        },
        {
          key: 'academic',
          title: 'Performance académique',
          desc: 'Moyennes, taux de réussite et rattrapages par semestre.',
          icon: 'chart',
          build: async () => {
            const rows = (await searchStudents(activeFilters()))
              .filter((r) => r.average != null);
            const columns = [
              { label: 'N° étudiant', value: (r) => r.student_number },
              { label: 'Nom', value: (r) => `${r.last_name} ${r.first_name}` },
              { label: 'Établissement', value: (r) => r.establishment },
              { label: 'Semestre', value: (r) => semLabel(r.semester) },
              { label: 'Moyenne retenue', value: (r) => Number(r.average).toFixed(2) },
              { label: 'Statut', value: (r) => SEMESTER_STATUS[r.semester_status]?.label || '' },
            ];
            const avg = rows.length
              ? (rows.reduce((a, r) => a + Number(r.average), 0) / rows.length).toFixed(2) : '—';
            const validated = rows.filter((r) => r.semester_status === 'validated').length;
            const kpis = [
              { label: 'Relevés', value: fmtNum(rows.length) },
              { label: 'Moyenne', value: `${avg}/20` },
              { label: 'Validés', value: fmtNum(validated) },
              { label: 'Taux de réussite',
                value: rows.length ? fmtPct((validated / rows.length) * 100, 1) : '—' },
            ];
            return { rows, columns, kpis, sectionTitle: 'Résultats par étudiant' };
          },
        },
        {
          key: 'resit',
          title: 'Rattrapages',
          desc: 'Étudiants concernés par un rattrapage ou une décision pédagogique.',
          icon: 'alert',
          build: async () => {
            const rows = (await searchStudents(activeFilters()))
              .filter((r) => ['pending_resit', 'resit_failed', 'repeating'].includes(r.semester_status));
            const columns = [
              { label: 'N° étudiant', value: (r) => r.student_number },
              { label: 'Nom', value: (r) => `${r.last_name} ${r.first_name}` },
              { label: 'Établissement', value: (r) => r.establishment },
              { label: 'Wilaya', value: (r) => r.wilaya },
              { label: 'Semestre', value: (r) => semLabel(r.semester) },
              { label: 'Moyenne', value: (r) => r.average != null ? Number(r.average).toFixed(2) : '' },
              { label: 'Situation', value: (r) => SEMESTER_STATUS[r.semester_status]?.label || '' },
            ];
            const kpis = [
              { label: 'Concernés', value: fmtNum(rows.length) },
              { label: 'À passer',
                value: fmtNum(rows.filter((r) => r.semester_status === 'pending_resit').length) },
              { label: 'Non validés',
                value: fmtNum(rows.filter((r) => r.semester_status === 'resit_failed').length) },
              { label: 'Redoublants',
                value: fmtNum(rows.filter((r) => r.semester_status === 'repeating').length) },
            ];
            return { rows, columns, kpis, sectionTitle: 'Étudiants en situation de rattrapage' };
          },
        },
        {
          key: 'apprenticeship',
          title: 'Contrats d’apprentissage',
          desc: 'Dépôts, validations et organismes d’accueil.',
          icon: 'briefcase',
          build: async () => {
            const rows = await listContracts({ kind: 'apprenticeship' });
            const columns = [
              { label: 'Étudiant', value: (r) => fullName(r.profiles) },
              { label: 'Établissement', value: (r) => r.establishments?.name },
              { label: 'Organisme', value: (r) => r.company_name },
              { label: 'Lieu', value: (r) => r.location },
              { label: 'Début', value: (r) => r.start_date ? fmtDate(r.start_date) : '' },
              { label: 'Fin', value: (r) => r.end_date ? fmtDate(r.end_date) : '' },
              { label: 'Durée (jours)', value: (r) => r.duration_days ?? '' },
              { label: 'Encadrant', value: (r) => r.supervisor_name },
              { label: 'Statut', value: (r) => CONTRACT_STATUS[r.status]?.label || '' },
            ];
            const c = (s) => rows.filter((r) => r.status === s).length;
            const kpis = [
              { label: 'Contrats', value: fmtNum(rows.length) },
              { label: 'Approuvés', value: fmtNum(c('approved')) },
              { label: 'En attente', value: fmtNum(c('pending') + c('under_review')) },
              { label: 'Refusés', value: fmtNum(c('rejected')) },
            ];
            return { rows, columns, kpis, sectionTitle: 'Dossiers d’apprentissage' };
          },
        },
        {
          key: 'internship',
          title: 'Stages pratiques S5',
          desc: 'Conventions déposées, validations et achèvement des stages.',
          icon: 'award',
          build: async () => {
            const rows = await listContracts({ kind: 'internship' });
            const columns = [
              { label: 'Étudiant', value: (r) => fullName(r.profiles) },
              { label: 'Établissement', value: (r) => r.establishments?.name },
              { label: 'Organisme', value: (r) => r.company_name },
              { label: 'Lieu', value: (r) => r.location },
              { label: 'Début', value: (r) => r.start_date ? fmtDate(r.start_date) : '' },
              { label: 'Fin', value: (r) => r.end_date ? fmtDate(r.end_date) : '' },
              { label: 'Durée (jours)', value: (r) => r.duration_days ?? '' },
              { label: 'Encadrant', value: (r) => r.supervisor_name },
              { label: 'Statut', value: (r) => CONTRACT_STATUS[r.status]?.label || '' },
              { label: 'Achèvement', value: (r) => r.completion },
            ];
            const c = (s) => rows.filter((r) => r.status === s).length;
            const kpis = [
              { label: 'Conventions', value: fmtNum(rows.length) },
              { label: 'Approuvées', value: fmtNum(c('approved')) },
              { label: 'En attente', value: fmtNum(c('pending') + c('under_review')) },
              { label: 'Terminés',
                value: fmtNum(rows.filter((r) => r.completion === 'completed').length) },
            ];
            return { rows, columns, kpis, sectionTitle: 'Conventions de stage' };
          },
        },
        {
          key: 'establishments',
          title: 'Établissements',
          desc: 'Annuaire, types et rattachement territorial.',
          icon: 'building',
          hidden: role === 'admin',
          build: async () => {
            let rows = estabs;
            if (wilayaSel.value) rows = rows.filter((e) => e.wilaya_id === wilayaSel.value);
            if (typeSel.value) rows = rows.filter((e) => e.type === typeSel.value);
            const columns = [
              { label: 'Code', value: (r) => r.code },
              { label: 'Établissement', value: (r) => r.name },
              { label: 'Type', value: (r) => typeAbbr(r.type) },
              { label: 'Wilaya', value: (r) => r.wilayas ? `${r.wilayas.code} — ${r.wilayas.name}` : '' },
              { label: 'Directeur', value: (r) => r.director_name },
              { label: 'Email', value: (r) => r.contact_email },
              { label: 'Téléphone', value: (r) => r.contact_phone },
              { label: 'Statut', value: (r) => r.status },
            ];
            const kpis = [
              { label: 'Établissements', value: fmtNum(rows.length) },
              { label: 'Actifs', value: fmtNum(rows.filter((r) => r.status === 'active').length) },
              { label: 'Types représentés',
                value: fmtNum(new Set(rows.map((r) => r.type)).size) },
              { label: 'Wilayas couvertes',
                value: fmtNum(new Set(rows.map((r) => r.wilaya_id).filter(Boolean)).size) },
            ];
            return { rows, columns, kpis, sectionTitle: 'Annuaire des établissements' };
          },
        },
      ].filter((r) => !r.hidden);

      // ── Génération ─────────────────────────────────────────────────────
      async function generate(report, format) {
        const btnLabel = format === 'pdf' ? 'PDF' : 'CSV';
        try {
          const { rows, columns, kpis, sectionTitle } = await report.build();
          if (rows.length === 0) {
            toast('Aucune donnée pour ces critères — rapport non généré.', { tone: 'warn' });
            return;
          }
          if (format === 'csv') {
            downloadCSV(slugStamp(`rapport-${report.key}`), columns, rows);
            toast(`Rapport ${btnLabel} téléchargé (${rows.length} lignes).`, { tone: 'success' });
          } else {
            printReport({
              title: report.title,
              subtitle: report.desc,
              meta: filterMeta(),
              kpis,
              sections: [{ title: sectionTitle, columns, rows }],
            });
          }
        } catch (err) {
          toast(err.message || 'Génération impossible.', { tone: 'danger' });
        }
      }

      // Rapport de synthèse : reprend les indicateurs du tableau de bord
      async function generateSummary() {
        if (!stats) { toast('Statistiques indisponibles.', { tone: 'warn' }); return; }
        const est = stats.establishments || {}, stu = stats.students || {};
        const aca = stats.academic || {}, tra = stats.training || {};
        const app = stats.apprenticeship || {}, int = stats.internships || {};

        const kv = (o) => Object.entries(o).map(([k, v]) => ({ k, v }));
        const kvCols = [
          { label: 'Indicateur', value: (r) => r.k },
          { label: 'Valeur', value: (r) => r.v },
        ];

        printReport({
          title: `Rapport de synthèse — ${SCOPE_TITLE[role]}`,
          subtitle: stats.wilaya ? `Wilaya ${stats.wilaya.code} — ${stats.wilaya.name}`
            : stats.establishment ? stats.establishment.name
            : 'Ensemble du territoire',
          meta: filterMeta(),
          kpis: [
            { label: 'Établissements', value: fmtNum(est.total) },
            { label: 'Étudiants', value: fmtNum(stu.total) },
            { label: 'Taux de réussite', value: fmtPct(aca.success_rate) },
            { label: 'Moyenne', value: aca.average != null ? `${Number(aca.average).toFixed(2)}/20` : '—' },
            { label: 'Contrats approuvés', value: fmtNum(app.approved) },
            { label: 'Stages S5 déposés', value: fmtNum(int.submitted) },
          ],
          sections: [
            {
              title: 'Établissements par type',
              columns: [
                { label: 'Type', value: (r) => r.label },
                { label: 'Libellé', value: (r) => r.full },
                { label: 'Nombre', value: (r) => r.count },
              ],
              rows: ESTABLISHMENT_TYPES
                .map((t) => ({ label: t.abbr, full: t.label, count: Number(est.by_type?.[t.value] || 0) }))
                .filter((t) => t.count > 0),
            },
            {
              title: 'Étudiants par semestre',
              columns: [
                { label: 'Semestre', value: (r) => r.k },
                { label: 'Effectif', value: (r) => r.v },
              ],
              rows: kv(stu.by_semester || {}).map((r) => ({ k: semLabel(r.k), v: r.v })),
            },
            {
              title: 'Étudiants par mode de formation',
              columns: [
                { label: 'Mode', value: (r) => r.mode },
                { label: 'Effectif', value: (r) => r.count },
              ],
              rows: stu.by_mode || [],
            },
            {
              title: 'Offre de formation',
              columns: kvCols,
              rows: [
                { k: 'Programmes nationaux', v: fmtNum(tra.programs) },
                { k: 'Programmes publiés', v: fmtNum(tra.published) },
                { k: 'Filières', v: fmtNum(tra.fields) },
                { k: 'Spécialités ouvertes', v: fmtNum(tra.specialties) },
                { k: 'Classes', v: fmtNum(tra.groups) },
                { k: 'Professeurs', v: fmtNum(tra.teachers) },
                { k: 'Places offertes', v: fmtNum(tra.seats) },
              ],
            },
            {
              title: 'Apprentissage et stages',
              columns: kvCols,
              rows: [
                { k: "Étudiants en apprentissage", v: fmtNum(app.students) },
                { k: 'Contrats déposés', v: fmtNum(app.submitted) },
                { k: 'Contrats approuvés', v: fmtNum(app.approved) },
                { k: 'Contrats refusés', v: fmtNum(app.rejected) },
                { k: 'Étudiants en S5', v: fmtNum(int.s5_students) },
                { k: 'Conventions de stage déposées', v: fmtNum(int.submitted) },
                { k: 'Étudiants S5 sans convention', v: fmtNum(int.missing) },
                { k: 'Stages terminés', v: fmtNum(int.completed) },
              ],
            },
          ].filter((s) => s.rows && s.rows.length > 0),
        });
      }

      const cards = REPORTS.map((r) => Card({ padding: 18 }, [
        h('h3.card__title', {}, [r.title]),
        h('p.small.mute', { style: { margin: '4px 0 14px', lineHeight: 1.55 } }, [r.desc]),
        h('div.row-actions', { style: { justifyContent: 'flex-start' } }, [
          Button({ label: 'PDF', icon: 'file-text', variant: 'secondary', size: 'sm',
                   onClick: () => generate(r, 'pdf') }),
          Button({ label: 'Excel / CSV', icon: 'download', variant: 'ghost', size: 'sm',
                   onClick: () => generate(r, 'csv') }),
        ]),
      ]));

      return [
        SectionHead(
          'Rapports',
          'Exports PDF et Excel/CSV construits à partir des données réelles de votre périmètre',
          Button({ label: 'Rapport de synthèse (PDF)', icon: 'file-text', variant: 'primary',
                   onClick: generateSummary })
        ),

        Card({ padding: 18 }, [
          h('h3.card__title', { style: { marginBottom: 12 } }, ['Critères appliqués aux rapports']),
          h('div.form-grid', {}, [
            role !== 'admin' && Field({ label: 'Wilaya', children: wilayaSel }),
            role !== 'admin' && Field({ label: 'Établissement', children: estabSel }),
            role !== 'admin' && Field({ label: "Type d'établissement", children: typeSel }),
            Field({ label: 'Programme', children: programSel }),
            Field({ label: 'Semestre', children: semesterSel }),
          ].filter(Boolean)),
          h('div', { style: { marginTop: 'var(--s-3)' } }, [
            Field({ label: 'Mention en en-tête', children: noteIn }),
          ]),
        ]),

        Notice({ tone: 'info', icon: 'file-text' }, [
          'Le PDF s’ouvre via la fenêtre d’impression du navigateur : choisissez « Enregistrer au '
          + 'format PDF ». Le CSV utilise le point-virgule et l’encodage UTF-8, directement '
          + 'exploitable par Excel.',
        ]),

        h('div', {
          style: { display: 'grid', gap: 'var(--s-3)',
                   gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' },
        }, cards),
      ];
    },
  });
}
