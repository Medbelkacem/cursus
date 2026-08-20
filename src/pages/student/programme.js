// §12 — Programme de formation de l'étudiant : structure semestrielle,
// modules et documents pédagogiques publiés.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Badge } from '../../components/badge.js';
import { toast } from '../../components/toast.js';
import { SectionHead, Notice, fmtBytes } from '../../lib/ui.js';
import { semLabel, SEMESTERS } from '../../lib/nomenclature.js';
import { EmptyBlock, fmtDate } from '../../lib/page-helpers.js';
import {
  studentOverview, getProgram, listProgramSemesters, listProgramDocuments, signedURL,
} from '../../lib/db.js';

const CAT_LABEL = {
  programme: 'Programme officiel', cours: 'Support de cours', guide: 'Guide pratique',
  tp: 'Travaux pratiques', examen: "Informations d'examen", administratif: 'Document administratif',
};

export async function studentProgrammePage() {
  return protectedPage({
    role: 'student',
    title: 'Programme de formation',
    breadcrumb: 'Étudiant · Programme',
    active: t('nav.program'),
    build: async () => {
      const overview = await studentOverview().catch(() => null);
      const s = overview?.student || null;

      if (!s?.program_id) {
        return [
          SectionHead('Programme de formation'),
          Notice({ tone: 'info', title: 'Aucun programme rattaché' }, [
            'Votre dossier n’est pas encore rattaché à un programme national. '
            + 'L’administration de votre établissement peut le renseigner.',
          ]),
        ];
      }

      const [program, semesters, docs] = await Promise.all([
        getProgram(s.program_id),
        listProgramSemesters(s.program_id).catch(() => []),
        listProgramDocuments(s.program_id).catch(() => []),
      ]);

      const published = docs.filter((d) => d.published);
      const semByCode = new Map(semesters.map((x) => [x.semester, x]));
      const activeSemesters = SEMESTERS.slice(0, program?.semesters_count || 5);
      const current = s.current_semester;

      async function open(doc) {
        try {
          const url = await signedURL('curricula', doc.file_path, 300);
          window.open(url, '_blank', 'noopener');
        } catch (err) {
          toast(err.message || 'Document indisponible.', { tone: 'danger' });
        }
      }

      const infoRows = [
        ['Filière', program?.fields?.name],
        ['Mode de formation', program?.training_modes?.name || s.training_mode],
        ['Durée', program?.duration_months ? `${program.duration_months} mois` : null],
        ['Qualification', program?.qualification_level],
        ['Niveau requis', program?.required_level],
        ['Public visé', program?.target_audience],
      ].filter(([, v]) => v);

      const semesterCards = activeSemesters.map((code) => {
        const row = semByCode.get(code);
        const mods = row?.program_modules || [];
        const semDocs = published.filter((d) => d.semester === code);
        const isCurrent = code === current;

        return Card({ padding: 0, accent: isCurrent }, [
          h('div', {
            style: { padding: '14px 18px', borderBottom: '1px solid var(--c-line-soft)',
                     display: 'flex', justifyContent: 'space-between', gap: '12px',
                     alignItems: 'center', flexWrap: 'wrap' },
          }, [
            h('div', {}, [
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                h('strong', {}, [`Semestre ${semLabel(code)}`]),
                isCurrent && Badge({ tone: 'accent', size: 'sm' }, ['semestre en cours']),
                code === 's5' && program?.internship_required
                  && Badge({ tone: 'outline', size: 'sm' }, ['stage obligatoire']),
              ].filter(Boolean)),
              h('div.small.mute', {}, [row?.title || 'Semestre non décrit']),
            ]),
            h('span.mono.small.mute', {}, [
              `${mods.length} module${mods.length > 1 ? 's' : ''}`,
            ]),
          ]),

          row?.description && h('p', {
            style: { padding: '12px 18px 0', fontSize: '13px', lineHeight: 1.6,
                     color: 'var(--c-ink-2)', margin: 0 },
          }, [row.description]),

          row?.objectives && h('div', { style: { padding: '10px 18px 0' } }, [
            h('div.kpi__label', {}, ['Objectifs']),
            h('p', { style: { fontSize: '13px', lineHeight: 1.6, margin: '2px 0 0' } }, [row.objectives]),
          ]),

          mods.length === 0
            ? h('p.small.mute', { style: { padding: '14px 18px' } }, ['Modules non encore publiés.'])
            : h('table.table.table--dense', { style: { marginTop: '10px' } }, [
                h('thead', {}, [h('tr', {}, [
                  h('th', {}, ['Module']),
                  h('th', { style: { textAlign: 'right' } }, ['Coef.']),
                  h('th', { style: { textAlign: 'right' } }, ['Crédits']),
                  h('th', { style: { textAlign: 'right' } }, ['Heures']),
                ])]),
                h('tbody', {}, mods
                  .slice()
                  .sort((a, b) => (a.position - b.position) || a.name.localeCompare(b.name, 'fr'))
                  .map((mm) => h('tr', {}, [
                    h('td', {}, [
                      h('div', {}, [mm.name]),
                      mm.description && h('div.small.mute', {}, [mm.description]),
                      mm.is_practical && h('span.small.mute', {}, ['travaux pratiques']),
                    ].filter(Boolean)),
                    h('td.mono', { style: { textAlign: 'right' } }, [String(mm.coefficient)]),
                    h('td.mono', { style: { textAlign: 'right' } }, [mm.credits ?? '—']),
                    h('td.mono', { style: { textAlign: 'right' } }, [mm.hours ?? '—']),
                  ]))),
              ]),

          semDocs.length > 0 && h('div', {
            style: { padding: '12px 18px', borderTop: '1px solid var(--c-line-soft)' },
          }, [
            h('div.kpi__label', { style: { marginBottom: 6 } }, ['Documents du semestre']),
            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              semDocs.map((d) => Button({
                label: d.title, icon: 'file-text', variant: 'ghost', size: 'sm',
                onClick: () => open(d),
              }))),
          ]),
        ].filter(Boolean));
      });

      const generalDocs = published.filter((d) => !d.semester);

      return [
        SectionHead(
          program?.name || 'Programme',
          `${program?.code || ''} · ${published.length} document${published.length > 1 ? 's' : ''} disponible${published.length > 1 ? 's' : ''}`
        ),

        Card({ padding: 18 }, [
          program?.description && h('p', {
            style: { fontSize: '13px', lineHeight: 1.6, color: 'var(--c-ink-2)', marginBottom: '12px' },
          }, [program.description]),
          h('dl', {
            style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                     gap: '12px 18px', margin: 0 },
          }, infoRows.map(([k, v]) => h('div', {}, [
            h('dt.kpi__label', {}, [k]),
            h('dd', { style: { margin: '2px 0 0', fontSize: '13px', fontWeight: 500 } }, [v]),
          ]))),
        ].filter(Boolean)),

        generalDocs.length > 0 && h('div', {}, [
          SectionHead('Documents généraux', 'Programmes officiels et guides applicables à toute la formation'),
          Card({ padding: 0 }, [
            h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Document']), h('th', {}, ['Catégorie']),
                h('th', {}, ['Taille']), h('th', {}, ['Publié le']), h('th', {}, ['']),
              ])]),
              h('tbody', {}, generalDocs.map((d) => h('tr', {}, [
                h('td', {}, [
                  h('div', { style: { fontWeight: 500 } }, [d.title]),
                  d.description && h('div.small.mute', {}, [d.description]),
                ].filter(Boolean)),
                h('td.small', {}, [CAT_LABEL[d.category] || d.category]),
                h('td.mono.small', {}, [fmtBytes(d.file_size)]),
                h('td.mono.small', {}, [fmtDate(d.created_at)]),
                h('td', { style: { textAlign: 'end' } }, [
                  Button({ label: 'Ouvrir', icon: 'external', variant: 'ghost', size: 'sm',
                           onClick: () => open(d) }),
                ]),
              ]))),
            ]),
          ]),
        ]),

        SectionHead('Structure de la formation', 'Modules, coefficients et crédits par semestre'),
        semesters.length === 0
          ? EmptyBlock('La structure du programme n’est pas encore publiée.', 'book')
          : h('div', { style: { display: 'grid', gap: 'var(--s-3)' } }, semesterCards),
      ].filter(Boolean);
    },
  });
}
