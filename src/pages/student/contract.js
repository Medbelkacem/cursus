// §9 et §13 — Dépôt et suivi, par l'étudiant, de son contrat d'apprentissage
// ou de sa convention de stage pratique S5.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Textarea } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import {
  StatusPill, SectionHead, Notice, FileField, fmtBytes,
} from '../../lib/ui.js';
import { CONTRACT_STATUS, COMPLETION_STATUS, semLabel } from '../../lib/nomenclature.js';
import { EmptyBlock, fmtDate, fmtDateTime } from '../../lib/page-helpers.js';
import {
  studentOverview, listContracts, createContract, updateContract,
  listContractReviews, listContractAttachments, addContractAttachment,
  uploadFile, signedURL,
} from '../../lib/db.js';

const KIND = {
  apprenticeship: {
    title: "Contrat d'apprentissage",
    navKey: 'nav.apprenticeship',
    breadcrumb: 'Étudiant · Apprentissage',
    docLabel: "Contrat d'apprentissage signé",
    orgLabel: "Entreprise ou organisme d'accueil",
    intro: "La formation par apprentissage impose le dépôt d'un contrat signé avec l'entreprise "
      + "ou l'administration qui vous accueille.",
  },
  internship: {
    title: 'Stage pratique S5',
    navKey: 'nav.internship_s5',
    breadcrumb: 'Étudiant · Stage S5',
    docLabel: 'Convention de stage signée',
    orgLabel: "Entreprise ou organisme d'accueil",
    intro: 'Le semestre S5 comporte un stage pratique obligatoire. Déposez votre convention de '
      + 'stage : elle sera automatiquement rattachée à votre relevé S5.',
  },
};

export function studentContractPage(kind) {
  const K = KIND[kind];

  return async function page() {
    return protectedPage({
      role: 'student',
      title: K.title,
      breadcrumb: K.breadcrumb,
      active: t(K.navKey),
      build: async ({ profile }) => {
        const [overview, contracts] = await Promise.all([
          studentOverview().catch(() => null),
          listContracts({ kind, student_id: profile.id }).catch(() => []),
        ]);

        const student = overview?.student || null;
        const current = contracts[0] || null;
        const reload = () => window.location.reload();

        const requiresApprenticeship = !!student?.requires_contract;
        const isS5 = student?.current_semester === 's5';

        // Modifiable tant que le dossier n'est pas approuvé
        const editable = !current
          || ['pending', 'rejected', 'modification_required'].includes(current.status);

        // ── Formulaire de dépôt / modification ───────────────────────────
        function openForm() {
          const company = Input({ value: current?.company_name || '',
                                  placeholder: 'Nom de l’entreprise' });
          const address = Textarea({ rows: 2, value: current?.company_address || '' });
          const location = Input({ value: current?.location || '', placeholder: 'Ville / wilaya' });
          const start = Input({ type: 'date', value: current?.start_date || '' });
          const end = Input({ type: 'date', value: current?.end_date || '' });
          const supName = Input({ value: current?.supervisor_name || '' });
          const supRole = Input({ value: current?.supervisor_role || '',
                                  placeholder: 'Fonction dans l’organisme' });
          const supEmail = Input({ type: 'email', value: current?.supervisor_email || '' });
          const supPhone = Input({ type: 'tel', value: current?.supervisor_phone || '' });
          const notes = Textarea({ rows: 2, value: current?.notes || '',
                                   placeholder: 'Précisions utiles à l’administration' });
          const picker = FileField({ label: K.docLabel });
          const extra = FileField({ label: 'Pièce justificative complémentaire' });

          const save = Button({
            label: current ? 'Renvoyer le dossier' : 'Déposer le dossier',
            icon: 'upload', variant: 'primary',
          });
          const cancel = Button({ label: 'Annuler', variant: 'secondary' });

          const m = Modal({
            title: current ? 'Modifier le dossier' : K.title,
            subtitle: K.intro,
            size: 'lg',
            children: [
              Field({ label: K.orgLabel, required: true, children: company }),
              Field({ label: 'Adresse de l’organisme', children: address }),
              h('div.form-grid', {}, [
                Field({ label: 'Lieu du stage / de la formation pratique', required: true, children: location }),
                Field({ label: 'Date de début', required: true, children: start }),
                Field({ label: 'Date de fin', required: true, children: end }),
              ]),
              h('div.form-grid--2.form-grid', {}, [
                Field({ label: 'Encadrant / tuteur', required: true, children: supName }),
                Field({ label: 'Fonction', children: supRole }),
              ]),
              h('div.form-grid--2.form-grid', {}, [
                Field({ label: 'Email de l’encadrant', children: supEmail }),
                Field({ label: 'Téléphone de l’encadrant', children: supPhone }),
              ]),
              Field({ label: 'Remarques', children: notes }),
              Field({
                label: K.docLabel, required: !current?.contract_file_path, children: picker,
                hint: current?.contract_file_name
                  ? `Déjà déposé : ${current.contract_file_name} — laisser vide pour le conserver.`
                  : 'PDF, image ou document Word — 20 Mo maximum.',
              }),
              Field({ label: 'Pièce complémentaire (facultatif)', children: extra }),
            ],
            actions: [cancel, save],
          });

          cancel.addEventListener('click', () => m.close());

          save.addEventListener('click', async () => {
            const file = picker.file();
            if (!company.value.trim()) { toast('Nom de l’organisme requis.', { tone: 'warn' }); return; }
            if (!location.value.trim()) { toast('Lieu requis.', { tone: 'warn' }); return; }
            if (!start.value || !end.value) { toast('Dates de début et de fin requises.', { tone: 'warn' }); return; }
            if (end.value < start.value) { toast('La date de fin précède la date de début.', { tone: 'warn' }); return; }
            if (!supName.value.trim()) { toast('Encadrant requis.', { tone: 'warn' }); return; }
            if (!current?.contract_file_path && !file) {
              toast(`${K.docLabel} requis.`, { tone: 'warn' }); return;
            }

            save.disabled = true;
            try {
              const payload = {
                kind,
                student_id: profile.id,
                semester: kind === 'internship' ? 's5' : null,
                company_name: company.value.trim(),
                company_address: address.value.trim() || null,
                location: location.value.trim(),
                start_date: start.value,
                end_date: end.value,
                supervisor_name: supName.value.trim(),
                supervisor_role: supRole.value.trim() || null,
                supervisor_email: supEmail.value.trim() || null,
                supervisor_phone: supPhone.value.trim() || null,
                notes: notes.value.trim() || null,
              };

              let saved;
              if (current) {
                // Un renvoi après refus/modification repasse le dossier en attente
                saved = await updateContract(current.id, { ...payload, status: 'pending' });
              } else {
                saved = await createContract(payload);
              }

              if (file) {
                const safe = file.name.replace(/[^\w.\-]+/g, '_');
                const path = `${profile.id}/${saved.id}/contrat-${Date.now()}-${safe}`;
                await uploadFile('contracts', path, file);
                await updateContract(saved.id, {
                  contract_file_path: path,
                  contract_file_name: file.name,
                  contract_file_size: file.size,
                });
              }

              const extraFile = extra.file();
              if (extraFile) {
                const safe = extraFile.name.replace(/[^\w.\-]+/g, '_');
                const path = `${profile.id}/${saved.id}/piece-${Date.now()}-${safe}`;
                await uploadFile('contracts', path, extraFile);
                await addContractAttachment({
                  contract_id: saved.id,
                  title: extraFile.name,
                  file_path: path,
                  file_name: extraFile.name,
                  file_size: extraFile.size,
                  uploaded_by: profile.id,
                });
              }

              toast('Dossier transmis à l’administration.', { tone: 'success' });
              m.close();
              reload();
            } catch (err) {
              save.disabled = false;
              toast(err.message || 'Dépôt impossible.', { tone: 'danger' });
            }
          });

          m.open();
        }

        async function openFile(path, name) {
          try {
            const url = await signedURL('contracts', path, 300);
            window.open(url, '_blank', 'noopener');
          } catch (err) {
            toast(err.message || `Impossible d'ouvrir ${name}.`, { tone: 'danger' });
          }
        }

        // ── Dossier existant ─────────────────────────────────────────────
        let detail = null;
        if (current) {
          const [reviews, attachments] = await Promise.all([
            listContractReviews(current.id).catch(() => []),
            listContractAttachments(current.id).catch(() => []),
          ]);

          detail = Card({ padding: 20 }, [
            h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px',
                                flexWrap: 'wrap', marginBottom: '14px' } }, [
              h('div', {}, [
                h('h3.card__title', {}, [current.company_name]),
                h('div.small.mute', {}, [`Déposé le ${fmtDate(current.submitted_at)}`]),
              ]),
              h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, [
                StatusPill(CONTRACT_STATUS, current.status),
                StatusPill(COMPLETION_STATUS, current.completion),
              ]),
            ]),

            h('dl', {
              style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                       gap: '12px 18px', margin: '0 0 16px' },
            }, [
              ['Lieu', current.location],
              ['Adresse', current.company_address],
              ['Début', current.start_date ? fmtDate(current.start_date) : null],
              ['Fin', current.end_date ? fmtDate(current.end_date) : null],
              ['Durée', current.duration_days != null ? `${current.duration_days} jours` : null],
              ['Encadrant', current.supervisor_name],
              ['Fonction', current.supervisor_role],
              ['Contact', [current.supervisor_email, current.supervisor_phone].filter(Boolean).join(' · ')],
              ['Semestre', current.semester ? semLabel(current.semester) : null],
            ].filter(([, v]) => v).map(([k, v]) => h('div', {}, [
              h('dt.kpi__label', {}, [k]),
              h('dd', { style: { margin: '2px 0 0', fontSize: '13px', fontWeight: 500 } }, [v]),
            ]))),

            h('div', { style: { marginBottom: '16px' } }, [
              h('div.kpi__label', { style: { marginBottom: 6 } }, ['Pièces déposées']),
              h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
                current.contract_file_path
                  ? Button({
                      label: current.contract_file_name || 'Document',
                      icon: 'file-text', variant: 'secondary', size: 'sm',
                      onClick: () => openFile(current.contract_file_path, 'le contrat'),
                    })
                  : h('span.small.mute', {}, ['Aucun document']),
                ...attachments.map((a) => Button({
                  label: `${a.title || a.file_name} (${fmtBytes(a.file_size)})`,
                  icon: 'file', variant: 'ghost', size: 'sm',
                  onClick: () => openFile(a.file_path, a.file_name),
                })),
              ]),
            ]),

            current.review_comment && Notice({
              tone: current.status === 'approved' ? 'success'
                : current.status === 'rejected' ? 'danger' : 'warn',
              title: 'Retour de l’administration',
            }, [current.review_comment]),

            reviews.length > 0 && h('div', { style: { marginTop: '16px' } }, [
              h('div.kpi__label', { style: { marginBottom: 8 } }, ['Suivi de validation']),
              h('ul.timeline', {}, reviews.map((r) => h('li', {}, [
                h('div', { style: { fontSize: '13px', fontWeight: 500 } }, [
                  CONTRACT_STATUS[r.to_status]?.label || r.to_status,
                ]),
                r.comment && h('div.small', { style: { color: 'var(--c-ink-2)' } }, [r.comment]),
                h('div.timeline__when', {}, [fmtDateTime(r.created_at)]),
              ]))),
            ]),

            editable && h('div', { style: { marginTop: '18px' } }, [
              Button({
                label: current.status === 'modification_required' || current.status === 'rejected'
                  ? 'Corriger et renvoyer' : 'Modifier le dossier',
                icon: 'edit', variant: 'primary', onClick: openForm,
              }),
            ]),
          ].filter(Boolean));
        }

        // ── Bandeaux d'exigence ──────────────────────────────────────────
        const requirement = (() => {
          if (kind === 'apprenticeship') {
            if (!requiresApprenticeship) {
              return Notice({ tone: 'info', title: 'Non requis pour votre formation' }, [
                'Votre mode de formation n’impose pas de contrat d’apprentissage. '
                + 'Vous pouvez néanmoins déposer un contrat si votre situation l’exige.',
              ]);
            }
            return current ? null : Notice({ tone: 'warn', title: 'Contrat d’apprentissage requis' }, [
              'Vous êtes inscrit en formation par apprentissage : le dépôt du contrat signé avec '
              + 'votre organisme d’accueil est obligatoire.',
            ]);
          }
          if (!isS5) {
            return Notice({ tone: 'info', title: 'Stage requis au semestre S5' }, [
              `Vous êtes actuellement en ${semLabel(student?.current_semester)}. `
              + 'Le stage pratique devient obligatoire à votre arrivée en S5 — vous pouvez déjà '
              + 'préparer votre dossier.',
            ]);
          }
          return current ? null : Notice({ tone: 'warn', title: 'Convention de stage requise' }, [
            'Vous êtes en S5 : le stage pratique est obligatoire. Déposez votre convention pour '
            + 'qu’elle soit rattachée à votre relevé S5.',
          ]);
        })();

        return [
          SectionHead(
            K.title,
            current ? `Dossier ${CONTRACT_STATUS[current.status]?.label.toLowerCase()}`
              : 'Aucun dossier déposé',
            !current ? Button({ label: 'Déposer mon dossier', icon: 'upload',
                                variant: 'primary', onClick: openForm }) : null
          ),

          requirement,

          detail || EmptyBlock(
            'Vous n’avez pas encore déposé de dossier. Utilisez le bouton ci-dessus.',
            'briefcase'
          ),

          contracts.length > 1 && h('div', {}, [
            SectionHead('Dossiers précédents'),
            Card({ padding: 0 }, [
              h('table.table.table--dense', {}, [
                h('thead', {}, [h('tr', {}, [
                  h('th', {}, ['Organisme']), h('th', {}, ['Période']),
                  h('th', {}, ['Déposé le']), h('th', {}, ['Statut']),
                ])]),
                h('tbody', {}, contracts.slice(1).map((c) => h('tr', {}, [
                  h('td', {}, [c.company_name]),
                  h('td.small', {}, [
                    [c.start_date, c.end_date].filter(Boolean).map(fmtDate).join(' → ') || '—',
                  ]),
                  h('td.mono.small', {}, [fmtDate(c.submitted_at)]),
                  h('td', {}, [StatusPill(CONTRACT_STATUS, c.status)]),
                ]))),
              ]),
            ]),
          ]),
        ].filter(Boolean);
      },
    });
  };
}

export const studentApprenticeshipPage = studentContractPage('apprenticeship');
export const studentInternshipPage = studentContractPage('internship');
