// §12 — Catalogue des programmes nationaux, en consultation (direction de
// wilaya et établissements). L'écriture reste réservée au ministère.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Badge } from '../../components/badge.js';
import { DataTable } from '../../components/table.js';
import { Modal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice, fmtBytes, fmtNum } from '../../lib/ui.js';
import { PUBLICATION_STATUS, typeAbbr, semLabel } from '../../lib/nomenclature.js';
import { EmptyBlock, fmtDate } from '../../lib/page-helpers.js';
import {
  listPrograms, listFields, listProgramSemesters, listProgramDocuments, signedURL,
} from '../../lib/db.js';

export async function programsCatalogPage() {
  return protectedPage({
    role: ['direction', 'admin', 'teacher'],
    title: 'Programmes de formation',
    breadcrumb: 'Programmes',
    active: t('nav.programs'),
    build: async () => {
      const [programs, fields] = await Promise.all([
        listPrograms(), listFields().catch(() => []),
      ]);

      async function openProgram(p) {
        const [semesters, docs] = await Promise.all([
          listProgramSemesters(p.id).catch(() => []),
          listProgramDocuments(p.id).catch(() => []),
        ]);
        const published = docs.filter((d) => d.published);

        const openDoc = async (d) => {
          try {
            const url = await signedURL('curricula', d.file_path, 300);
            window.open(url, '_blank', 'noopener');
          } catch (err) {
            toast(err.message || 'Document indisponible.', { tone: 'danger' });
          }
        };

        const m = Modal({
          title: p.name,
          subtitle: `${p.code}${p.qualification_level ? ` · ${p.qualification_level}` : ''}`,
          size: 'xl',
          children: [
            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
              StatusPill(PUBLICATION_STATUS, p.status),
              p.internship_required && Badge({ tone: 'accent', size: 'sm' }, ['stage S5 obligatoire']),
              p.apprenticeship_allowed && Badge({ tone: 'outline', size: 'sm' }, ['apprentissage possible']),
            ].filter(Boolean)),

            p.description && h('p', { style: { fontSize: '13px', lineHeight: 1.6 } }, [p.description]),

            h('dl', {
              style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                       gap: '10px 18px', margin: 0 },
            }, [
              ['Filière', p.fields?.name],
              ['Mode', p.training_modes?.name],
              ["Type d'établissement", p.establishment_type ? typeAbbr(p.establishment_type) : 'Tous'],
              ['Durée', p.duration_months ? `${p.duration_months} mois` : null],
              ['Semestres', String(p.semesters_count)],
              ['Niveau requis', p.required_level],
              ['Places', p.seats != null ? fmtNum(p.seats) : null],
              ['Public visé', p.target_audience],
            ].filter(([, v]) => v).map(([k, v]) => h('div', {}, [
              h('dt.kpi__label', {}, [k]),
              h('dd', { style: { margin: '2px 0 0', fontSize: '13px', fontWeight: 500 } }, [v]),
            ]))),

            h('div', {}, [
              h('div.kpi__label', { style: { marginBottom: 8 } }, ['Structure semestrielle']),
              semesters.length === 0
                ? h('p.small.mute', {}, ['Structure non publiée.'])
                : h('div', { style: { display: 'grid', gap: '10px' } }, semesters.map((sem) => {
                    const mods = sem.program_modules || [];
                    return h('div', {
                      style: { border: '1px solid var(--c-line-soft)', borderRadius: 'var(--r-md, 8px)',
                               padding: '10px 12px' },
                    }, [
                      h('div', { style: { display: 'flex', justifyContent: 'space-between',
                                          gap: '10px', marginBottom: mods.length ? '8px' : 0 } }, [
                        h('strong', { style: { fontSize: '13px' } }, [
                          `${semLabel(sem.semester)}${sem.title ? ` — ${sem.title}` : ''}`,
                        ]),
                        h('span.mono.small.mute', {}, [`${mods.length} module(s)`]),
                      ]),
                      mods.length > 0 && h('table.table.table--dense', {}, [
                        h('thead', {}, [h('tr', {}, [
                          h('th', {}, ['Module']),
                          h('th', { style: { textAlign: 'right' } }, ['Coef.']),
                          h('th', { style: { textAlign: 'right' } }, ['Crédits']),
                          h('th', { style: { textAlign: 'right' } }, ['Heures']),
                        ])]),
                        h('tbody', {}, mods.map((mm) => h('tr', {}, [
                          h('td', {}, [mm.name]),
                          h('td.mono', { style: { textAlign: 'right' } }, [String(mm.coefficient)]),
                          h('td.mono', { style: { textAlign: 'right' } }, [mm.credits ?? '—']),
                          h('td.mono', { style: { textAlign: 'right' } }, [mm.hours ?? '—']),
                        ]))),
                      ]),
                    ].filter(Boolean));
                  })),
            ]),

            h('div', {}, [
              h('div.kpi__label', { style: { marginBottom: 8 } }, ['Documents publiés']),
              published.length === 0
                ? h('p.small.mute', {}, ['Aucun document publié.'])
                : h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
                    published.map((d) => Button({
                      label: `${d.title} (${fmtBytes(d.file_size)})`,
                      icon: 'file-text', variant: 'ghost', size: 'sm',
                      onClick: () => openDoc(d),
                    }))),
            ]),
          ].filter(Boolean),
          actions: [Button({ label: 'Fermer', variant: 'secondary', onClick: () => m.close() })],
        });
        m.open();
      }

      const table = DataTable({
        rows: programs,
        exportName: 'programmes',
        searchPlaceholder: 'Code, intitulé, filière…',
        empty: 'Aucun programme national publié.',
        emptyIcon: 'book',
        search: (r, q) => [r.code, r.name, r.fields?.name, r.qualification_level]
          .some((v) => String(v ?? '').toLowerCase().includes(q)),
        filters: [
          { key: 'field_id', label: 'Filière', value: (r) => r.field_id || '',
            options: [{ value: '', label: 'Toutes' },
              ...fields.map((f) => ({ value: f.id, label: f.name }))] },
          { key: 'status', label: 'Publication', value: (r) => r.status,
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(PUBLICATION_STATUS).map(([v, m]) => ({ value: v, label: m.label }))] },
        ],
        columns: [
          { key: 'code', label: 'Code', value: (r) => r.code,
            render: (r) => h('span.mono', { style: { fontWeight: 600 } }, [r.code]) },
          { key: 'name', label: 'Intitulé', value: (r) => r.name },
          { key: 'field', label: 'Filière', value: (r) => r.fields?.name || '—' },
          { key: 'mode', label: 'Mode', value: (r) => r.training_modes?.name || '—' },
          { key: 'duration_months', label: 'Durée', align: 'right',
            value: (r) => r.duration_months ? `${r.duration_months} mois` : '—',
            sortValue: (r) => r.duration_months || 0 },
          { key: 'qualification_level', label: 'Qualification',
            value: (r) => r.qualification_level || '—' },
          { key: 'status', label: 'Statut', value: (r) => PUBLICATION_STATUS[r.status]?.label,
            render: (r) => StatusPill(PUBLICATION_STATUS, r.status) },
        ],
        onRow: openProgram,
      });

      return [
        SectionHead(
          'Catalogue des programmes',
          `${programs.length} programme${programs.length > 1 ? 's' : ''} · `
          + `${programs.filter((p) => p.status === 'published').length} publié(s)`
        ),
        Notice({ tone: 'info' }, [
          'Les programmes nationaux sont définis et publiés par le ministère. '
          + 'Ouvrez une ligne pour consulter la structure semestrielle et les documents.',
        ]),
        table,
      ];
    },
  });
}
