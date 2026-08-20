// §12 — Fiche d'un programme : structure semestrielle, modules, documents
// pédagogiques et publication.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select, Textarea, Checkbox } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice, FileField, fmtBytes, fmtNum } from '../../lib/ui.js';
import { PUBLICATION_STATUS, SEMESTERS, semLabel, typeAbbr, typeOptions } from '../../lib/nomenclature.js';
import { EmptyBlock, fmtDate } from '../../lib/page-helpers.js';
import { navigate } from '../../lib/router.js';
import {
  getProgram, updateProgram, deleteProgram, listProgramSemesters, upsertProgramSemester,
  createProgramModule, updateProgramModule, deleteProgramModule,
  listProgramDocuments, createProgramDocument, updateProgramDocument, deleteProgramDocument,
  listFields, listTrainingModes, uploadFile, signedURL, removeFile,
} from '../../lib/db.js';

const DOC_CATEGORIES = [
  { value: 'programme',      label: 'Programme officiel' },
  { value: 'cours',          label: 'Support de cours' },
  { value: 'guide',          label: 'Guide pratique' },
  { value: 'tp',             label: 'Travaux pratiques' },
  { value: 'examen',         label: "Informations d'examen" },
  { value: 'administratif',  label: 'Document administratif' },
];

export async function ministryProgramDetailPage(ctx = {}) {
  const id = ctx.params?.id;

  return protectedPage({
    role: 'ministry',
    title: 'Programme',
    breadcrumb: 'Ministère · Programmes · Fiche',
    active: t('nav.programs'),
    build: async () => {
      const program = await getProgram(id);
      if (!program) {
        return [EmptyBlock('Programme introuvable.', 'alert')];
      }

      const [semesters, docs, fields, modes] = await Promise.all([
        listProgramSemesters(id),
        listProgramDocuments(id),
        listFields(),
        listTrainingModes(),
      ]);

      const reload = () => window.location.reload();
      const semByCode = new Map(semesters.map((s) => [s.semester, s]));
      const activeSemesters = SEMESTERS.slice(0, program.semesters_count || 5);
      const totalModules = semesters.reduce((n, s) => n + (s.program_modules?.length || 0), 0);

      // ── Édition des attributs du programme ─────────────────────────────
      function openEdit() {
        const code = Input({ value: program.code });
        const name = Input({ value: program.name });
        const desc = Textarea({ rows: 3, value: program.description || '' });
        const field = Select({
          value: program.field_id || '',
          options: [{ value: '', label: '— filière —' },
            ...fields.map((f) => ({ value: f.id, label: f.name }))],
        });
        const mode = Select({
          value: program.training_mode_id || '',
          options: [{ value: '', label: '— mode —' },
            ...modes.map((m) => ({ value: m.id, label: m.name }))],
        });
        const estabType = Select({
          value: program.establishment_type || '',
          options: typeOptions("— tous types —"),
        });
        const duration = Input({ type: 'number', min: '1', value: program.duration_months ?? '' });
        const seats = Input({ type: 'number', min: '0', value: program.seats ?? '' });
        const level = Input({ value: program.required_level || '' });
        const qualif = Input({ value: program.qualification_level || '' });
        const audience = Textarea({ rows: 2, value: program.target_audience || '' });
        const internship = Checkbox({ label: 'Stage pratique obligatoire en S5', checked: program.internship_required });
        const practical = Checkbox({ label: 'Travaux pratiques obligatoires', checked: program.practical_required });
        const apprentice = Checkbox({ label: 'Ouvert à l’apprentissage', checked: program.apprenticeship_allowed });

        const save = Button({ label: 'Enregistrer', icon: 'save', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });
        const del = Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' });

        const m = Modal({
          title: 'Modifier le programme', size: 'lg',
          children: [
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Code', required: true, children: code }),
              Field({ label: 'Filière', children: field }),
            ]),
            Field({ label: 'Intitulé', required: true, children: name }),
            Field({ label: 'Description', children: desc }),
            h('div.form-grid', {}, [
              Field({ label: 'Durée (mois)', children: duration }),
              Field({ label: 'Places', children: seats }),
              Field({ label: "Type d'établissement", children: estabType }),
            ]),
            h('div.form-grid', {}, [
              Field({ label: 'Mode de formation', children: mode }),
              Field({ label: 'Niveau requis', children: level }),
              Field({ label: 'Qualification', children: qualif }),
            ]),
            Field({ label: 'Public visé', children: audience }),
            h('div', { style: { display: 'grid', gap: '6px' } }, [internship, practical, apprentice]),
          ],
          actions: [del, cancel, save],
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            await updateProgram(id, {
              code: code.value.trim(), name: name.value.trim(),
              description: desc.value.trim() || null,
              field_id: field.value || null,
              training_mode_id: mode.value || null,
              establishment_type: estabType.value || null,
              duration_months: duration.value ? Number(duration.value) : null,
              seats: seats.value ? Number(seats.value) : null,
              required_level: level.value.trim() || null,
              qualification_level: qualif.value.trim() || null,
              target_audience: audience.value.trim() || null,
              internship_required: internship.querySelector('input').checked,
              practical_required: practical.querySelector('input').checked,
              apprenticeship_allowed: apprentice.querySelector('input').checked,
            });
            toast('Programme mis à jour.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Mise à jour impossible.', { tone: 'danger' });
          }
        });
        del.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'Supprimer le programme',
            message: 'Le programme, sa structure semestrielle, ses modules et ses documents seront supprimés.',
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          try {
            await deleteProgram(id);
            toast('Programme supprimé.', { tone: 'success' });
            navigate('/ministere/programmes');
          } catch (err) {
            toast(err.message || 'Suppression impossible.', { tone: 'danger' });
          }
        });
        m.open();
      }

      // ── Module ─────────────────────────────────────────────────────────
      function openModule(semesterRow, mod = null) {
        const code = Input({ value: mod?.code || '', placeholder: 'ALGO' });
        const name = Input({ value: mod?.name || '', placeholder: 'Algorithmique' });
        const desc = Textarea({ rows: 2, value: mod?.description || '' });
        const obj = Textarea({ rows: 2, value: mod?.objectives || '' });
        const coef = Input({ type: 'number', step: '0.5', min: '0.5', value: mod?.coefficient ?? 1 });
        const credits = Input({ type: 'number', min: '0', value: mod?.credits ?? '' });
        const hours = Input({ type: 'number', min: '0', value: mod?.hours ?? '' });
        const practical = Checkbox({ label: 'Module pratique (TP / atelier)', checked: mod?.is_practical ?? false });

        const save = Button({ label: mod ? 'Enregistrer' : 'Ajouter', icon: mod ? 'save' : 'plus', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });
        const del = mod ? Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' }) : null;

        const m = Modal({
          title: mod ? `Module — ${mod.name}` : `Nouveau module · ${semLabel(semesterRow.semester)}`,
          size: 'md',
          children: [
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Code', children: code }),
              Field({ label: 'Intitulé', required: true, children: name }),
            ]),
            Field({ label: 'Description', children: desc }),
            Field({ label: "Objectifs pédagogiques", children: obj }),
            h('div.form-grid', {}, [
              Field({ label: 'Coefficient', children: coef }),
              Field({ label: 'Crédits', children: credits }),
              Field({ label: 'Volume horaire', children: hours }),
            ]),
            practical,
          ],
          actions: [del, cancel, save].filter(Boolean),
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          if (!name.value.trim()) { toast('Intitulé requis.', { tone: 'warn' }); return; }
          const payload = {
            program_semester_id: semesterRow.id,
            code: code.value.trim() || null,
            name: name.value.trim(),
            description: desc.value.trim() || null,
            objectives: obj.value.trim() || null,
            coefficient: Number(coef.value) || 1,
            credits: credits.value === '' ? null : Number(credits.value),
            hours: hours.value === '' ? null : Number(hours.value),
            is_practical: practical.querySelector('input').checked,
          };
          save.disabled = true;
          try {
            if (mod) await updateProgramModule(mod.id, payload);
            else await createProgramModule(payload);
            toast(mod ? 'Module mis à jour.' : 'Module ajouté.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Enregistrement impossible.', { tone: 'danger' });
          }
        });
        del?.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'Supprimer le module', message: `« ${mod.name} » sera supprimé du référentiel.`,
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          await deleteProgramModule(mod.id);
          toast('Module supprimé.', { tone: 'success' });
          m.close(); reload();
        });
        m.open();
      }

      // ── Édition d'un semestre ──────────────────────────────────────────
      function openSemester(code) {
        const row = semByCode.get(code);
        const title = Input({ value: row?.title || `Semestre ${semLabel(code)}` });
        const desc = Textarea({ rows: 2, value: row?.description || '' });
        const obj = Textarea({ rows: 3, value: row?.objectives || '' });
        const save = Button({ label: 'Enregistrer', icon: 'save', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });

        const m = Modal({
          title: `Semestre ${semLabel(code)}`, size: 'md',
          children: [
            Field({ label: 'Titre', children: title }),
            Field({ label: 'Description', children: desc }),
            Field({ label: 'Objectifs', children: obj }),
            code === 's5' && program.internship_required
              ? Notice({ tone: 'info', icon: 'briefcase' }, [
                  'Le semestre S5 comporte un stage pratique obligatoire : chaque étudiant devra '
                  + 'déposer sa convention de stage sur la plateforme.',
                ])
              : null,
          ].filter(Boolean),
          actions: [cancel, save],
        });
        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            await upsertProgramSemester({
              program_id: id, semester: code,
              title: title.value.trim() || null,
              description: desc.value.trim() || null,
              objectives: obj.value.trim() || null,
            });
            toast('Semestre enregistré.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Enregistrement impossible.', { tone: 'danger' });
          }
        });
        m.open();
      }

      // ── Documents pédagogiques ─────────────────────────────────────────
      function openDocument() {
        const title = Input({ placeholder: 'Programme officiel — S1' });
        const desc = Input({ placeholder: 'Description courte' });
        const category = Select({ value: 'programme', options: DOC_CATEGORIES });
        const semester = Select({
          value: '',
          options: [{ value: '', label: '— tous les semestres —' },
            ...activeSemesters.map((s) => ({ value: s, label: semLabel(s) }))],
        });
        const published = Checkbox({ label: 'Publier immédiatement (visible par les étudiants)' });
        const picker = FileField({ label: 'Choisir un document' });

        const save = Button({ label: 'Téléverser', icon: 'upload', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });

        const m = Modal({
          title: 'Nouveau document pédagogique', size: 'md',
          children: [
            Field({ label: 'Titre', required: true, children: title }),
            Field({ label: 'Description', children: desc }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Catégorie', children: category }),
              Field({ label: 'Semestre', children: semester }),
            ]),
            Field({ label: 'Fichier', children: picker, hint: 'PDF, image ou document — 50 Mo max.' }),
            published,
          ],
          actions: [cancel, save],
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          const file = picker.file();
          if (!title.value.trim()) { toast('Titre requis.', { tone: 'warn' }); return; }
          if (!file) { toast('Sélectionnez un fichier.', { tone: 'warn' }); return; }
          save.disabled = true;
          try {
            const safe = file.name.replace(/[^\w.\-]+/g, '_');
            const path = `${id}/${Date.now()}-${safe}`;
            await uploadFile('curricula', path, file);
            await createProgramDocument({
              program_id: id,
              semester: semester.value || null,
              title: title.value.trim(),
              description: desc.value.trim() || null,
              category: category.value,
              file_path: path,
              file_name: file.name,
              file_size: file.size,
              published: published.querySelector('input').checked,
            });
            toast('Document ajouté.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Téléversement impossible.', { tone: 'danger' });
          }
        });
        m.open();
      }

      async function openDoc(doc) {
        try {
          const url = await signedURL('curricula', doc.file_path, 300);
          window.open(url, '_blank', 'noopener');
        } catch (err) {
          toast(err.message || 'Lien indisponible.', { tone: 'danger' });
        }
      }

      // ── Publication du programme ───────────────────────────────────────
      async function togglePublish() {
        const next = program.status === 'published' ? 'draft' : 'published';
        const ok = next === 'published'
          ? await confirmDialog({
              title: 'Publier le programme',
              message: 'Le programme deviendra visible par les établissements et les étudiants '
                + 'inscrits. Une notification leur sera envoyée.',
              confirmLabel: 'Publier',
            })
          : await confirmDialog({
              title: 'Dépublier le programme',
              message: 'Le programme repassera en brouillon : les étudiants inscrits perdront '
                + "l'accès à sa structure et à ses documents.",
              confirmLabel: 'Dépublier', danger: true,
            });
        if (!ok) return;
        try {
          await updateProgram(id, { status: next });
          toast(next === 'published' ? 'Programme publié.' : 'Programme repassé en brouillon.',
            { tone: 'success' });
          reload();
        } catch (err) {
          toast(err.message || 'Opération impossible.', { tone: 'danger' });
        }
      }

      // ── Rendu ──────────────────────────────────────────────────────────
      const infoRows = [
        ['Filière', program.fields?.name],
        ['Mode de formation', program.training_modes?.name],
        ["Type d'établissement", program.establishment_type ? typeAbbr(program.establishment_type) : 'Tous'],
        ['Durée', program.duration_months ? `${program.duration_months} mois` : null],
        ['Semestres', String(program.semesters_count)],
        ['Niveau requis', program.required_level],
        ['Qualification', program.qualification_level],
        ['Places offertes', program.seats != null ? fmtNum(program.seats) : null],
        ['Public visé', program.target_audience],
      ].filter(([, v]) => v);

      const semesterCards = activeSemesters.map((code) => {
        const row = semByCode.get(code);
        const mods = row?.program_modules || [];
        const coefSum = mods.reduce((n, mm) => n + Number(mm.coefficient || 0), 0);
        const creditSum = mods.reduce((n, mm) => n + Number(mm.credits || 0), 0);

        return Card({ padding: 0 }, [
          h('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                     gap: '12px', padding: '14px 18px', borderBottom: '1px solid var(--c-line-soft)' },
          }, [
            h('div', {}, [
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                h('strong', {}, [semLabel(code)]),
                code === 's5' && program.internship_required
                  ? Badge({ tone: 'accent', size: 'sm' }, ['stage obligatoire']) : null,
              ].filter(Boolean)),
              h('div.small.mute', {}, [
                row?.title || 'Semestre non décrit',
                mods.length ? ` · ${mods.length} module${mods.length > 1 ? 's' : ''}` : ' · aucun module',
                coefSum ? ` · coef. total ${coefSum}` : '',
                creditSum ? ` · ${creditSum} crédits` : '',
              ].join('')),
            ]),
            h('div.row-actions', {}, [
              Button({ label: 'Décrire', icon: 'edit', variant: 'ghost', size: 'sm',
                       onClick: () => openSemester(code) }),
              row && Button({ label: 'Module', icon: 'plus', variant: 'secondary', size: 'sm',
                              onClick: () => openModule(row) }),
            ].filter(Boolean)),
          ]),

          !row
            ? h('p.small.mute', { style: { padding: '14px 18px' } }, [
                'Semestre non initialisé — cliquez sur « Décrire » pour le créer.',
              ])
            : mods.length === 0
              ? h('p.small.mute', { style: { padding: '14px 18px' } }, ['Aucun module défini.'])
              : h('table.table.table--dense', {}, [
                  h('thead', {}, [h('tr', {}, [
                    h('th', {}, ['Code']), h('th', {}, ['Module']),
                    h('th', { style: { textAlign: 'right' } }, ['Coef.']),
                    h('th', { style: { textAlign: 'right' } }, ['Crédits']),
                    h('th', { style: { textAlign: 'right' } }, ['Heures']),
                    h('th', {}, ['']),
                  ])]),
                  h('tbody', {}, mods
                    .slice()
                    .sort((a, b) => (a.position - b.position) || a.name.localeCompare(b.name, 'fr'))
                    .map((mm) => h('tr', {}, [
                      h('td.mono', {}, [mm.code || '—']),
                      h('td', {}, [
                        h('div', {}, [mm.name]),
                        mm.is_practical && h('span.small.mute', {}, ['travaux pratiques']),
                      ].filter(Boolean)),
                      h('td.mono', { style: { textAlign: 'right' } }, [String(mm.coefficient)]),
                      h('td.mono', { style: { textAlign: 'right' } }, [mm.credits ?? '—']),
                      h('td.mono', { style: { textAlign: 'right' } }, [mm.hours ?? '—']),
                      h('td', { style: { textAlign: 'right' } }, [
                        Button({ label: '', icon: 'edit', variant: 'ghost', size: 'sm',
                                 'aria-label': `Modifier ${mm.name}`,
                                 onClick: () => openModule(row, mm) }),
                      ]),
                    ]))),
                ]),
        ]);
      });

      const docList = docs.length === 0
        ? EmptyBlock('Aucun document publié pour ce programme.', 'folder')
        : h('table.table', {}, [
            h('thead', {}, [h('tr', {}, [
              h('th', {}, ['Document']), h('th', {}, ['Catégorie']), h('th', {}, ['Semestre']),
              h('th', {}, ['Taille']), h('th', {}, ['Ajouté le']), h('th', {}, ['Visibilité']),
              h('th', {}, ['']),
            ])]),
            h('tbody', {}, docs.map((d) => h('tr', {}, [
              h('td', {}, [
                h('div', { style: { fontWeight: 500 } }, [d.title]),
                d.file_name && h('div.mono.small.mute', {}, [d.file_name]),
              ].filter(Boolean)),
              h('td', {}, [DOC_CATEGORIES.find((c) => c.value === d.category)?.label || d.category]),
              h('td.mono', {}, [d.semester ? semLabel(d.semester) : 'tous']),
              h('td.mono.small', {}, [fmtBytes(d.file_size)]),
              h('td.mono.small', {}, [fmtDate(d.created_at)]),
              h('td', {}, [
                d.published
                  ? Badge({ tone: 'success', size: 'sm', dot: true }, ['publié'])
                  : Badge({ tone: 'neutral', size: 'sm', dot: true }, ['brouillon']),
              ]),
              h('td', {}, [
                h('div.row-actions', {}, [
                  Button({ label: 'Ouvrir', icon: 'external', variant: 'ghost', size: 'sm',
                           onClick: () => openDoc(d) }),
                  Button({
                    label: d.published ? 'Dépublier' : 'Publier', variant: 'ghost', size: 'sm',
                    onClick: async () => {
                      await updateProgramDocument(d.id, { published: !d.published });
                      toast(d.published ? 'Document dépublié.' : 'Document publié.', { tone: 'success' });
                      reload();
                    },
                  }),
                  Button({
                    label: '', icon: 'trash', variant: 'ghost', size: 'sm',
                    'aria-label': `Supprimer ${d.title}`,
                    onClick: async () => {
                      const ok = await confirmDialog({
                        title: 'Supprimer le document', message: `« ${d.title} » sera supprimé.`,
                        confirmLabel: 'Supprimer', danger: true,
                      });
                      if (!ok) return;
                      try { if (d.file_path) await removeFile('curricula', d.file_path); } catch (_) {}
                      await deleteProgramDocument(d.id);
                      toast('Document supprimé.', { tone: 'success' });
                      reload();
                    },
                  }),
                ]),
              ]),
            ]))),
          ]);

      return [
        h('div', { style: { marginBottom: 'var(--s-3)' } }, [
          Button({ label: 'Retour aux programmes', icon: 'arrow-left', variant: 'ghost', size: 'sm',
                   href: '/ministere/programmes' }),
        ]),

        SectionHead(
          program.name,
          `${program.code} · ${totalModules} module${totalModules > 1 ? 's' : ''} · `
          + `${docs.length} document${docs.length > 1 ? 's' : ''}`,
          [
            Button({ label: 'Modifier', icon: 'edit', variant: 'secondary', onClick: openEdit }),
            Button({
              label: program.status === 'published' ? 'Dépublier' : 'Publier le programme',
              icon: program.status === 'published' ? 'eye-off' : 'send',
              variant: program.status === 'published' ? 'secondary' : 'primary',
              onClick: togglePublish,
            }),
          ]
        ),

        Card({ padding: 18 }, [
          h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } }, [
            StatusPill(PUBLICATION_STATUS, program.status),
            program.internship_required && Badge({ tone: 'accent', size: 'sm' }, ['stage S5 obligatoire']),
            program.apprenticeship_allowed && Badge({ tone: 'outline', size: 'sm' }, ['apprentissage possible']),
            program.practical_required && Badge({ tone: 'outline', size: 'sm' }, ['TP obligatoires']),
          ].filter(Boolean)),
          program.description && h('p', {
            style: { fontSize: '13px', lineHeight: 1.6, color: 'var(--c-ink-2)', marginBottom: '12px' },
          }, [program.description]),
          h('dl', {
            style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                     gap: '10px 20px', margin: 0 },
          }, infoRows.flatMap(([k, v]) => [
            h('div', {}, [
              h('dt.kpi__label', {}, [k]),
              h('dd', { style: { margin: '2px 0 0', fontSize: '13px', fontWeight: 500 } }, [v]),
            ]),
          ])),
        ]),

        SectionHead('Structure semestrielle', 'Modules, coefficients, crédits et volumes horaires'),
        h('div', { style: { display: 'grid', gap: 'var(--s-3)' } }, semesterCards),

        SectionHead(
          'Documents pédagogiques',
          'Programmes officiels, supports de cours, guides et documents administratifs',
          Button({ label: 'Ajouter un document', icon: 'upload', variant: 'primary', onClick: openDocument })
        ),
        Card({ padding: 0 }, [docList]),
      ];
    },
  });
}
