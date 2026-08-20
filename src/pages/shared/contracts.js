// §9, §13, §14 — Suivi et validation des contrats d'apprentissage et des
// conventions de stage pratique S5.
//
// Une seule page paramétrée par `kind` ('apprenticeship' | 'internship'),
// utilisable par le ministère, une direction de wilaya ou un établissement.
// Le périmètre visible est imposé par les policies RLS.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Select, Textarea } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { DataTable } from '../../components/table.js';
import { Modal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice, KPIGrid, fullName, fmtBytes } from '../../lib/ui.js';
import { CONTRACT_STATUS, COMPLETION_STATUS, semLabel } from '../../lib/nomenclature.js';
import { fmtDate, fmtDateTime } from '../../lib/page-helpers.js';
import {
  listContracts, updateContract, listContractReviews, listContractAttachments,
  signedURL, searchStudents,
} from '../../lib/db.js';

const KIND_META = {
  apprenticeship: {
    title: "Contrats d'apprentissage",
    breadcrumb: 'Contrats d’apprentissage',
    navKey: 'nav.apprenticeship',
    label: "contrat d'apprentissage",
    export: 'contrats-apprentissage',
    empty: "Aucun contrat d'apprentissage déposé.",
  },
  internship: {
    title: 'Stages pratiques S5',
    breadcrumb: 'Stages S5',
    navKey: 'nav.internships',
    label: 'convention de stage',
    export: 'stages-s5',
    empty: 'Aucune convention de stage déposée.',
  },
};

export function contractsPage(kind) {
  const K = KIND_META[kind];

  return async function page() {
    return protectedPage({
      role: ['ministry', 'direction', 'admin'],
      title: K.title,
      breadcrumb: `Administration · ${K.breadcrumb}`,
      active: t(K.navKey),
      build: async ({ profile }) => {
        const [contracts, students] = await Promise.all([
          listContracts({ kind }),
          searchStudents(kind === 'internship' ? { p_semester: 's5' } : {}).catch(() => []),
        ]);

        const withContract = new Set(contracts.map((c) => c.student_id));
        const missing = students.filter((s) => !withContract.has(s.profile_id));
        const reload = () => window.location.reload();

        const count = (st) => contracts.filter((c) => c.status === st).length;

        // ── Fiche de contrat : dossier + décision (§9) ────────────────────
        async function openContract(c) {
          const [reviews, attachments] = await Promise.all([
            listContractReviews(c.id).catch(() => []),
            listContractAttachments(c.id).catch(() => []),
          ]);

          const statusSel = Select({
            value: c.status,
            options: Object.entries(CONTRACT_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
          });
          const completionSel = Select({
            value: c.completion,
            options: Object.entries(COMPLETION_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
          });
          const comment = Textarea({
            rows: 3, value: c.review_comment || '',
            placeholder: 'Commentaire transmis à l’étudiant (motif de refus, modification demandée…)',
          });

          const save = Button({ label: 'Enregistrer la décision', icon: 'save', variant: 'primary' });
          const close = Button({ label: 'Fermer', variant: 'secondary' });

          const openFile = async (bucket, path, name) => {
            try {
              const url = await signedURL(bucket, path, 300);
              window.open(url, '_blank', 'noopener');
            } catch (err) {
              toast(err.message || `Impossible d'ouvrir ${name}.`, { tone: 'danger' });
            }
          };

          const m = Modal({
            title: `${K.label.charAt(0).toUpperCase()}${K.label.slice(1)} — ${fullName(c.profiles)}`,
            subtitle: `${c.company_name} · déposé le ${fmtDate(c.submitted_at)}`,
            size: 'lg',
            children: [
              h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
                StatusPill(CONTRACT_STATUS, c.status),
                StatusPill(COMPLETION_STATUS, c.completion),
                c.semester && Badge({ tone: 'outline', size: 'sm' }, [semLabel(c.semester)]),
              ].filter(Boolean)),

              h('dl', {
                style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                         gap: '10px 18px', margin: '4px 0 0' },
              }, [
                ['Étudiant', fullName(c.profiles)],
                ['Email', c.profiles?.email],
                ['Établissement', c.establishments?.name],
                ['Wilaya', c.establishments?.wilayas
                  ? `${c.establishments.wilayas.code} — ${c.establishments.wilayas.name}` : null],
                ['Organisme d’accueil', c.company_name],
                ['Adresse', c.company_address],
                ['Lieu', c.location],
                ['Début', c.start_date ? fmtDate(c.start_date) : null],
                ['Fin', c.end_date ? fmtDate(c.end_date) : null],
                ['Durée', c.duration_days != null ? `${c.duration_days} jours` : null],
                ['Encadrant', c.supervisor_name],
                ['Fonction', c.supervisor_role],
                ['Contact encadrant', [c.supervisor_email, c.supervisor_phone].filter(Boolean).join(' · ')],
              ].filter(([, v]) => v).map(([k, v]) => h('div', {}, [
                h('dt.kpi__label', {}, [k]),
                h('dd', { style: { margin: '2px 0 0', fontSize: '13px', fontWeight: 500 } }, [v]),
              ]))),

              c.notes && h('div', {}, [
                h('div.kpi__label', {}, ['Note de l’étudiant']),
                h('p', { style: { fontSize: '13px', lineHeight: 1.55, margin: '2px 0 0' } }, [c.notes]),
              ]),

              h('div', {}, [
                h('div.kpi__label', { style: { marginBottom: 6 } }, ['Pièces du dossier']),
                h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
                  c.contract_file_path
                    ? Button({
                        label: c.contract_file_name || 'Contrat signé',
                        icon: 'file-text', variant: 'secondary', size: 'sm',
                        onClick: () => openFile('contracts', c.contract_file_path, 'le contrat'),
                      })
                    : h('span.small.mute', {}, ['Aucun contrat téléversé']),
                  ...attachments.map((a) => Button({
                    label: `${a.title || a.file_name} (${fmtBytes(a.file_size)})`,
                    icon: 'file', variant: 'ghost', size: 'sm',
                    onClick: () => openFile('contracts', a.file_path, a.file_name),
                  })),
                ]),
              ]),

              h('hr', { style: { border: 0, borderTop: '1px solid var(--c-line-soft)' } }),

              h('div.form-grid--2.form-grid', {}, [
                Field({ label: 'Statut de validation', children: statusSel }),
                Field({ label: 'Avancement', children: completionSel }),
              ]),
              Field({ label: 'Commentaire', children: comment,
                      hint: 'Visible par l’étudiant dans sa notification.' }),

              reviews.length > 0 && h('div', {}, [
                h('div.kpi__label', { style: { marginBottom: 8 } }, ['Historique de validation']),
                h('ul.timeline', {}, reviews.map((r) => h('li', {}, [
                  h('div', { style: { fontSize: '13px', fontWeight: 500 } }, [
                    `${r.from_status ? `${CONTRACT_STATUS[r.from_status]?.label} → ` : ''}`
                    + `${CONTRACT_STATUS[r.to_status]?.label || r.to_status}`,
                  ]),
                  r.comment && h('div.small', { style: { color: 'var(--c-ink-2)' } }, [r.comment]),
                  h('div.timeline__when', {}, [
                    fmtDateTime(r.created_at),
                    r.profiles ? ` · ${fullName(r.profiles)}` : '',
                  ].join('')),
                ]))),
              ]),
            ].filter(Boolean),
            actions: [close, save],
          });

          close.addEventListener('click', () => m.close());
          save.addEventListener('click', async () => {
            save.disabled = true;
            try {
              await updateContract(c.id, {
                status: statusSel.value,
                completion: completionSel.value,
                review_comment: comment.value.trim() || null,
              });
              toast('Décision enregistrée — l’étudiant est notifié.', { tone: 'success' });
              m.close();
              reload();
            } catch (err) {
              save.disabled = false;
              toast(err.message || 'Enregistrement impossible.', { tone: 'danger' });
            }
          });

          m.open();
        }

        // ── Liste des étudiants sans dossier (§14) ───────────────────────
        function openMissing() {
          const m = Modal({
            title: kind === 'internship'
              ? 'Étudiants en S5 sans convention de stage'
              : 'Étudiants sans contrat d’apprentissage',
            subtitle: `${missing.length} étudiant(s) concerné(s)`,
            size: 'lg',
            children: [
              missing.length === 0
                ? h('p.small.mute', {}, ['Tous les étudiants concernés ont déposé leur dossier.'])
                : h('table.table.table--dense', {}, [
                    h('thead', {}, [h('tr', {}, [
                      h('th', {}, ['Étudiant']), h('th', {}, ['N°']),
                      h('th', {}, ['Établissement']), h('th', {}, ['Wilaya']),
                      h('th', {}, ['Semestre']),
                    ])]),
                    h('tbody', {}, missing.map((s) => h('tr', {}, [
                      h('td', {}, [`${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email]),
                      h('td.mono.small', {}, [s.student_number || '—']),
                      h('td', {}, [s.establishment || '—']),
                      h('td', {}, [s.wilaya || '—']),
                      h('td.mono', {}, [semLabel(s.semester)]),
                    ]))),
                  ]),
            ],
            actions: [Button({ label: 'Fermer', variant: 'secondary', onClick: () => m.close() })],
          });
          m.open();
        }

        const table = DataTable({
          rows: contracts,
          exportName: K.export,
          searchPlaceholder: 'Étudiant, entreprise, lieu, encadrant…',
          empty: K.empty,
          emptyIcon: 'briefcase',
          search: (r, q) => [
            fullName(r.profiles), r.company_name, r.location, r.supervisor_name,
            r.establishments?.name,
          ].some((v) => String(v ?? '').toLowerCase().includes(q)),
          filters: [
            { key: 'status', label: 'Statut', value: (r) => r.status,
              options: [{ value: '', label: 'Tous' },
                ...Object.entries(CONTRACT_STATUS).map(([v, m]) => ({ value: v, label: m.label }))] },
            { key: 'completion', label: 'Avancement', value: (r) => r.completion,
              options: [{ value: '', label: 'Tous' },
                ...Object.entries(COMPLETION_STATUS).map(([v, m]) => ({ value: v, label: m.label }))] },
          ],
          columns: [
            { key: 'student', label: 'Étudiant', value: (r) => fullName(r.profiles),
              render: (r) => h('div', {}, [
                h('div', { style: { fontWeight: 500 } }, [fullName(r.profiles)]),
                h('div.mono.small.mute', {}, [r.profiles?.email || '—']),
              ]) },
            { key: 'establishment', label: 'Établissement', value: (r) => r.establishments?.name || '—' },
            { key: 'wilaya', label: 'Wilaya',
              value: (r) => r.establishments?.wilayas
                ? `${r.establishments.wilayas.code} — ${r.establishments.wilayas.name}` : '—' },
            { key: 'company_name', label: 'Organisme', value: (r) => r.company_name },
            { key: 'location', label: 'Lieu', value: (r) => r.location || '—' },
            { key: 'start_date', label: 'Période',
              value: (r) => [r.start_date, r.end_date].filter(Boolean).map(fmtDate).join(' → ') || '—',
              sortValue: (r) => r.start_date || '' },
            { key: 'duration_days', label: 'Durée', align: 'right',
              value: (r) => r.duration_days != null ? `${r.duration_days} j` : '—',
              sortValue: (r) => r.duration_days ?? 0 },
            { key: 'supervisor_name', label: 'Encadrant', value: (r) => r.supervisor_name || '—' },
            { key: 'status', label: 'Statut', value: (r) => CONTRACT_STATUS[r.status]?.label,
              render: (r) => StatusPill(CONTRACT_STATUS, r.status) },
            { key: 'completion', label: 'Avancement', value: (r) => COMPLETION_STATUS[r.completion]?.label,
              render: (r) => StatusPill(COMPLETION_STATUS, r.completion) },
          ],
          onRow: openContract,
        });

        const pending = count('pending') + count('under_review');

        return [
          SectionHead(
            K.title,
            `${contracts.length} dossier${contracts.length > 1 ? 's' : ''} dans votre périmètre`,
            missing.length > 0
              ? Button({
                  label: `${missing.length} sans dossier`, icon: 'alert',
                  variant: 'secondary', onClick: openMissing,
                })
              : null
          ),

          KPIGrid([
            { label: 'Dossiers déposés', value: contracts.length },
            { label: 'En attente / examen', value: pending,
              tone: pending > 0 ? 'warn' : null,
              sub: pending > 0 ? 'à traiter' : 'rien à traiter' },
            { label: 'Approuvés', value: count('approved') },
            { label: 'Refusés', value: count('rejected') },
            { label: 'Modification requise', value: count('modification_required') },
            kind === 'internship'
              ? { label: 'Stages terminés',
                  value: contracts.filter((c) => c.completion === 'completed').length }
              : { label: 'Organismes',
                  value: new Set(contracts.map((c) => c.company_name)).size },
          ]),

          pending > 0 && Notice({ tone: 'warn', title: `${pending} dossier(s) à examiner` }, [
            'Ouvrez une ligne pour consulter les pièces, approuver, refuser ou demander une modification. '
            + 'L’étudiant reçoit automatiquement une notification.',
          ]),

          table,
        ].filter(Boolean);
      },
    });
  };
}

export const apprenticeshipPage = contractsPage('apprenticeship');
export const internshipPage = contractsPage('internship');
