// §7 / §12 — Programmes de formation nationaux (nomenclature) et filières.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select, Textarea, Checkbox } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { DataTable } from '../../components/table.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice, fmtNum } from '../../lib/ui.js';
import { PUBLICATION_STATUS, typeOptions, typeAbbr, SEMESTERS } from '../../lib/nomenclature.js';
import { navigate } from '../../lib/router.js';
import {
  listPrograms, createProgram, listFields, createField, updateField, deleteField,
  listTrainingModes, upsertProgramSemester,
} from '../../lib/db.js';

export async function ministryProgramsPage() {
  return protectedPage({
    role: 'ministry',
    title: 'Programmes de formation',
    breadcrumb: 'Ministère · Programmes',
    active: t('nav.programs'),
    build: async () => {
      const [programs, fields, modes] = await Promise.all([
        listPrograms(), listFields(), listTrainingModes(),
      ]);
      const reload = () => window.location.reload();

      // ── Gestion des filières (§7 « Fields ») ───────────────────────────
      function openFields() {
        let dirty = false;          // ne recharge la page que si la liste a changé
        const listMount = h('div');
        const nameIn = Input({ placeholder: 'Informatique' });
        const codeIn = Input({ placeholder: 'INFO' });
        const descIn = Input({ placeholder: 'Description courte' });
        const addBtn = Button({ label: 'Ajouter', icon: 'plus', variant: 'primary', size: 'sm' });

        function renderList(items) {
          listMount.replaceChildren(
            items.length === 0
              ? h('p.small.mute', {}, ['Aucune filière enregistrée.'])
              : h('table.table.table--dense', {}, [
                  h('thead', {}, [h('tr', {}, [
                    h('th', {}, ['Code']), h('th', {}, ['Filière']),
                    h('th', {}, ['Programmes']), h('th', {}, ['']),
                  ])]),
                  h('tbody', {}, items.map((f) => {
                    const used = programs.filter((p) => p.field_id === f.id).length;
                    return h('tr', {}, [
                      h('td.mono', {}, [f.code || '—']),
                      h('td', {}, [f.name]),
                      h('td.mono', {}, [String(used)]),
                      h('td', { style: { textAlign: 'right' } }, [
                        Button({
                          label: '', icon: 'trash', variant: 'ghost', size: 'sm',
                          'aria-label': `Supprimer ${f.name}`,
                          onClick: async () => {
                            if (used > 0) {
                              toast(`${used} programme(s) utilisent cette filière.`, { tone: 'warn' });
                              return;
                            }
                            await deleteField(f.id);
                            dirty = true;
                            renderList(await listFields());
                            toast('Filière supprimée.', { tone: 'success' });
                          },
                        }),
                      ]),
                    ]);
                  })),
                ])
          );
        }
        renderList(fields);

        addBtn.addEventListener('click', async () => {
          if (!nameIn.value.trim()) { toast('Le nom est requis.', { tone: 'warn' }); return; }
          try {
            await createField({
              name: nameIn.value.trim(),
              code: codeIn.value.trim() || null,
              description: descIn.value.trim() || null,
            });
            dirty = true;
            nameIn.value = ''; codeIn.value = ''; descIn.value = '';
            renderList(await listFields());
            toast('Filière ajoutée.', { tone: 'success' });
          } catch (err) {
            toast(err.message || 'Ajout impossible.', { tone: 'danger' });
          }
        });

        const close = Button({ label: 'Fermer', variant: 'secondary' });
        const m = Modal({
          title: 'Filières / domaines',
          subtitle: 'Regroupement des programmes par domaine professionnel.',
          size: 'md',
          children: [
            h('div.form-grid', {}, [
              Field({ label: 'Code', children: codeIn }),
              Field({ label: 'Nom', required: true, children: nameIn }),
            ]),
            Field({ label: 'Description', children: descIn }),
            h('div', {}, [addBtn]),
            h('hr', { style: { border: 0, borderTop: '1px solid var(--c-line-soft)' } }),
            listMount,
          ],
          actions: [close],
          onClose: () => { if (dirty) window.location.reload(); },
        });
        close.addEventListener('click', () => m.close());
        m.open();
      }

      // ── Création d'un programme ────────────────────────────────────────
      function openCreate() {
        const code = Input({ placeholder: 'TS-INFO-DEV' });
        const name = Input({ placeholder: 'Technicien Supérieur en Développement Informatique' });
        const nameAr = Input({ dir: 'rtl' });
        const desc = Textarea({ rows: 3 });
        const field = Select({
          value: '',
          options: [{ value: '', label: '— filière —' },
            ...fields.map((f) => ({ value: f.id, label: f.name }))],
        });
        const mode = Select({
          value: '',
          options: [{ value: '', label: '— mode de formation —' },
            ...modes.map((mm) => ({ value: mm.id, label: mm.name }))],
        });
        const estabType = Select({ value: '', options: typeOptions("— tous types d'établissement —") });
        const duration = Input({ type: 'number', min: '1', placeholder: '30' });
        const semCount = Select({
          value: '5',
          options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} semestre${n > 1 ? 's' : ''}` })),
        });
        const audience = Textarea({ rows: 2, placeholder: 'Jeunes de 15 à 26 ans' });
        const seats = Input({ type: 'number', min: '0', placeholder: '60' });
        const level = Input({ placeholder: '3AS' });
        const qualif = Input({ placeholder: 'Technicien Supérieur' });
        const internship = Checkbox({ label: 'Stage pratique obligatoire en S5', checked: true });
        const practical = Checkbox({ label: 'Travaux pratiques obligatoires' });
        const apprentice = Checkbox({ label: 'Ouvert à la formation par apprentissage' });

        const save = Button({ label: 'Créer le programme', icon: 'plus', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });

        const m = Modal({
          title: 'Nouveau programme de formation',
          subtitle: 'La structure semestrielle et les modules se définissent ensuite sur la fiche du programme.',
          size: 'lg',
          children: [
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Code', required: true, children: code }),
              Field({ label: 'Filière', children: field }),
            ]),
            Field({ label: 'Intitulé', required: true, children: name }),
            Field({ label: 'Intitulé en arabe', children: nameAr }),
            Field({ label: 'Description', children: desc }),
            h('div.form-grid', {}, [
              Field({ label: 'Durée (mois)', children: duration }),
              Field({ label: 'Nombre de semestres', children: semCount }),
              Field({ label: 'Places offertes', children: seats }),
            ]),
            h('div.form-grid', {}, [
              Field({ label: "Type d'établissement", children: estabType }),
              Field({ label: 'Mode de formation', children: mode }),
            ]),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Niveau requis', children: level }),
              Field({ label: 'Qualification délivrée', children: qualif }),
            ]),
            Field({ label: 'Public visé', children: audience }),
            h('div', { style: { display: 'grid', gap: '6px' } }, [internship, practical, apprentice]),
          ],
          actions: [cancel, save],
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          if (!code.value.trim() || !name.value.trim()) {
            toast('Code et intitulé sont requis.', { tone: 'warn' }); return;
          }
          save.disabled = true;
          try {
            const created = await createProgram({
              code: code.value.trim(),
              name: name.value.trim(),
              name_ar: nameAr.value.trim() || null,
              description: desc.value.trim() || null,
              field_id: field.value || null,
              training_mode_id: mode.value || null,
              establishment_type: estabType.value || null,
              duration_months: duration.value ? Number(duration.value) : null,
              semesters_count: Number(semCount.value),
              target_audience: audience.value.trim() || null,
              seats: seats.value ? Number(seats.value) : null,
              required_level: level.value.trim() || null,
              qualification_level: qualif.value.trim() || null,
              internship_required: internship.querySelector('input').checked,
              practical_required: practical.querySelector('input').checked,
              apprenticeship_allowed: apprentice.querySelector('input').checked,
            });
            // Ouvre d'emblée la structure semestrielle
            const n = Number(semCount.value);
            for (const s of SEMESTERS.slice(0, n)) {
              await upsertProgramSemester({
                program_id: created.id, semester: s, title: `Semestre ${s.toUpperCase()}`,
              });
            }
            toast('Programme créé.', { tone: 'success' });
            m.close();
            navigate(`/ministere/programmes/${created.id}`);
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Création impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      const table = DataTable({
        rows: programs,
        exportName: 'programmes',
        searchPlaceholder: 'Code, intitulé, filière…',
        empty: 'Aucun programme de formation enregistré.',
        emptyIcon: 'graduation',
        search: (r, q) => [r.code, r.name, r.fields?.name, r.qualification_level]
          .some((v) => String(v ?? '').toLowerCase().includes(q)),
        filters: [
          { key: 'status', label: 'Publication', value: (r) => r.status,
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(PUBLICATION_STATUS).map(([v, mm]) => ({ value: v, label: mm.label }))] },
          { key: 'field_id', label: 'Filière', value: (r) => r.field_id || '',
            options: [{ value: '', label: 'Toutes les filières' },
              ...fields.map((f) => ({ value: f.id, label: f.name }))] },
          { key: 'establishment_type', label: "Type d'établissement", value: (r) => r.establishment_type || '',
            options: typeOptions('Tous les types') },
        ],
        columns: [
          { key: 'code', label: 'Code', value: (r) => r.code,
            render: (r) => h('span.mono', { style: { fontWeight: 600 } }, [r.code]) },
          { key: 'name', label: 'Intitulé', value: (r) => r.name,
            render: (r) => h('div', {}, [
              h('div', { style: { fontWeight: 500 } }, [r.name]),
              r.qualification_level && h('div.small.mute', {}, [r.qualification_level]),
            ].filter(Boolean)) },
          { key: 'field', label: 'Filière', value: (r) => r.fields?.name || '—' },
          { key: 'mode', label: 'Mode', value: (r) => r.training_modes?.name || '—' },
          { key: 'establishment_type', label: 'Établissement',
            value: (r) => r.establishment_type ? typeAbbr(r.establishment_type) : '—',
            render: (r) => r.establishment_type
              ? Badge({ tone: 'outline', size: 'sm' }, [typeAbbr(r.establishment_type)])
              : h('span.mute', {}, ['tous']) },
          { key: 'duration_months', label: 'Durée', align: 'right',
            value: (r) => r.duration_months ? `${r.duration_months} mois` : '—',
            sortValue: (r) => r.duration_months || 0 },
          { key: 'semesters_count', label: 'Sem.', align: 'right', value: (r) => r.semesters_count },
          { key: 'seats', label: 'Places', align: 'right', value: (r) => fmtNum(r.seats),
            sortValue: (r) => r.seats || 0 },
          { key: 'status', label: 'Statut', value: (r) => PUBLICATION_STATUS[r.status]?.label,
            render: (r) => StatusPill(PUBLICATION_STATUS, r.status) },
        ],
        onRow: (r) => navigate(`/ministere/programmes/${r.id}`),
      });

      return [
        SectionHead(
          'Programmes de formation',
          `${programs.length} programme${programs.length > 1 ? 's' : ''} · `
          + `${programs.filter((p) => p.status === 'published').length} publié(s) · `
          + `${fields.length} filière${fields.length > 1 ? 's' : ''}`,
          [
            Button({ label: 'Filières', icon: 'layers', variant: 'secondary', onClick: openFields }),
            Button({ label: 'Nouveau programme', icon: 'plus', variant: 'primary', onClick: openCreate }),
          ]
        ),

        modes.length === 0
          ? Notice({ tone: 'warn', title: 'Aucun mode de formation' }, [
              'Définissez d’abord les modes de formation : ils conditionnent le contrat '
              + "d'apprentissage et le public visé.",
            ])
          : null,

        table,
      ].filter(Boolean);
    },
  });
}
