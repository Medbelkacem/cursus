// §7 — Classes, sections, sessions et spécialités de l'établissement.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { DataTable } from '../../components/table.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice, fmtNum } from '../../lib/ui.js';
import { ENTITY_STATUS, semOptions, semLabel } from '../../lib/nomenclature.js';
import { EmptyBlock, fmtDate } from '../../lib/page-helpers.js';
import {
  listSpecialties, createSpecialty, updateSpecialty, deleteSpecialty,
  listGroups, createGroup, updateGroup, deleteGroup,
  createSection, deleteSection,
  listSessions, createSession, updateSession, deleteSession,
  listPrograms, listTrainingModes, searchStudents,
} from '../../lib/db.js';

export async function adminClassesPage() {
  return protectedPage({
    role: 'admin',
    title: 'Classes et spécialités',
    breadcrumb: 'Établissement · Classes',
    active: t('nav.classes'),
    build: async ({ profile }) => {
      const estabId = profile.establishment_id;
      if (!estabId) {
        return [Notice({ tone: 'warn', title: 'Compte non rattaché' }, [
          'Votre compte n’est associé à aucun établissement.',
        ])];
      }

      const [specialties, groups, sessions, programs, modes, students] = await Promise.all([
        listSpecialties(estabId),
        listGroups(estabId),
        listSessions(estabId),
        listPrograms({ status: 'published' }).catch(() => []),
        listTrainingModes().catch(() => []),
        searchStudents({ p_estab: estabId, p_limit: 1000 }).catch(() => []),
      ]);

      const reload = () => window.location.reload();

      const countByGroup = new Map();
      const countBySpecialty = new Map();
      for (const s of students) {
        countBySpecialty.set(s.specialty, (countBySpecialty.get(s.specialty) || 0) + 1);
      }

      const modeOptions = (empty = '— mode de formation —') => [
        { value: '', label: empty },
        ...modes.map((m) => ({ value: m.id, label: m.name })),
      ];

      // ── Spécialité ──────────────────────────────────────────────────────
      function openSpecialty(sp = null) {
        const name = Input({ value: sp?.name || '', placeholder: 'Développement Informatique' });
        const code = Input({ value: sp?.code || '', placeholder: 'DEV' });
        const program = Select({
          value: sp?.program_id || '',
          options: [{ value: '', label: '— programme national —' },
            ...programs.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))],
        });
        const mode = Select({ value: sp?.training_mode_id || '', options: modeOptions() });
        const seats = Input({ type: 'number', min: '0', value: sp?.seats ?? '' });
        const status = Select({
          value: sp?.status || 'active',
          options: Object.entries(ENTITY_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
        });

        const save = Button({ label: sp ? 'Enregistrer' : 'Créer', icon: sp ? 'save' : 'plus',
                              variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });
        const del = sp ? Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' }) : null;

        const m = Modal({
          title: sp ? `Spécialité — ${sp.name}` : 'Nouvelle spécialité',
          subtitle: 'Offre locale rattachée à un programme de formation national.',
          size: 'md',
          children: [
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Nom', required: true, children: name }),
              Field({ label: 'Code', children: code }),
            ]),
            Field({ label: 'Programme national', children: program }),
            h('div.form-grid', {}, [
              Field({ label: 'Mode de formation', children: mode }),
              Field({ label: 'Places', children: seats }),
              Field({ label: 'Statut', children: status }),
            ]),
          ],
          actions: [del, cancel, save].filter(Boolean),
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          if (!name.value.trim()) { toast('Le nom est requis.', { tone: 'warn' }); return; }
          const payload = {
            name: name.value.trim(),
            code: code.value.trim() || null,
            program_id: program.value || null,
            training_mode_id: mode.value || null,
            seats: seats.value === '' ? null : Number(seats.value),
            status: status.value,
            establishment_id: estabId,
          };
          save.disabled = true;
          try {
            if (sp) await updateSpecialty(sp.id, payload);
            else await createSpecialty(payload);
            toast('Spécialité enregistrée.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Enregistrement impossible.', { tone: 'danger' });
          }
        });
        del?.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'Supprimer la spécialité',
            message: `« ${sp.name} », ses classes et ses matières seront supprimées.`,
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          await deleteSpecialty(sp.id);
          toast('Spécialité supprimée.', { tone: 'success' });
          m.close(); reload();
        });
        m.open();
      }

      // ── Classe ──────────────────────────────────────────────────────────
      function openGroup(g = null) {
        const name = Input({ value: g?.name || '', placeholder: 'TS-DEV-1A' });
        const specialty = Select({
          value: g?.specialty_id || '',
          options: [{ value: '', label: '— spécialité —' },
            ...specialties.map((s) => ({ value: s.id, label: s.name }))],
        });
        const semester = Select({ value: g?.semester || '', options: semOptions('— semestre —') });
        const mode = Select({ value: g?.training_mode_id || '', options: modeOptions() });
        const session = Select({
          value: g?.session_id || '',
          options: [{ value: '', label: '— session —' },
            ...sessions.map((s) => ({ value: s.id, label: s.name }))],
        });
        const level = Input({ value: g?.level || '', placeholder: 'TS1' });
        const year = Input({ value: g?.academic_year || '', placeholder: '2026/2027' });
        const capacity = Input({ type: 'number', min: '0', value: g?.capacity ?? '' });
        const status = Select({
          value: g?.status || 'active',
          options: Object.entries(ENTITY_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
        });

        // Sections de la classe
        const sectionsMount = h('div');
        const sectionName = Input({ placeholder: 'Section A' });
        const sectionCap = Input({ type: 'number', min: '0', placeholder: 'Capacité' });
        const addSection = Button({ label: 'Ajouter', icon: 'plus', variant: 'secondary', size: 'sm' });

        function renderSections(list) {
          sectionsMount.replaceChildren(
            list.length === 0
              ? h('p.small.mute', {}, ['Aucune section.'])
              : h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                  list.map((sec) => h('span', {
                    style: { display: 'inline-flex', alignItems: 'center', gap: '6px',
                             border: '1px solid var(--c-line)', borderRadius: '999px',
                             padding: '3px 6px 3px 10px', fontSize: '12px' },
                  }, [
                    `${sec.name}${sec.capacity ? ` (${sec.capacity})` : ''}`,
                    Button({
                      label: '', icon: 'close', variant: 'ghost', size: 'sm',
                      'aria-label': `Supprimer ${sec.name}`,
                      onClick: async () => {
                        await deleteSection(sec.id);
                        renderSections(list.filter((x) => x.id !== sec.id));
                        toast('Section supprimée.', { tone: 'success' });
                      },
                    }),
                  ])))
          );
        }
        if (g) renderSections(g.sections || []);

        addSection.addEventListener('click', async () => {
          if (!g) { toast('Enregistrez d’abord la classe.', { tone: 'warn' }); return; }
          if (!sectionName.value.trim()) { toast('Nom de section requis.', { tone: 'warn' }); return; }
          try {
            const created = await createSection({
              group_id: g.id,
              name: sectionName.value.trim(),
              capacity: sectionCap.value === '' ? null : Number(sectionCap.value),
            });
            g.sections = [...(g.sections || []), created];
            renderSections(g.sections);
            sectionName.value = ''; sectionCap.value = '';
            toast('Section ajoutée.', { tone: 'success' });
          } catch (err) {
            toast(err.message || 'Ajout impossible.', { tone: 'danger' });
          }
        });

        const save = Button({ label: g ? 'Enregistrer' : 'Créer', icon: g ? 'save' : 'plus',
                              variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });
        const del = g ? Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' }) : null;

        const m = Modal({
          title: g ? `Classe — ${g.name}` : 'Nouvelle classe',
          size: 'lg',
          children: [
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Nom de la classe', required: true, children: name }),
              Field({ label: 'Spécialité', required: true, children: specialty }),
            ]),
            h('div.form-grid', {}, [
              Field({ label: 'Semestre', children: semester }),
              Field({ label: 'Mode de formation', children: mode }),
              Field({ label: 'Session', children: session }),
            ]),
            h('div.form-grid', {}, [
              Field({ label: 'Niveau', children: level }),
              Field({ label: 'Année scolaire', children: year }),
              Field({ label: 'Capacité', children: capacity }),
              Field({ label: 'Statut', children: status }),
            ]),
            h('hr', { style: { border: 0, borderTop: '1px solid var(--c-line-soft)' } }),
            h('div', {}, [
              h('div.kpi__label', { style: { marginBottom: 6 } }, ['Sections']),
              sectionsMount,
              h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-end',
                                  marginTop: '10px', flexWrap: 'wrap' } }, [
                Field({ label: 'Nom', children: sectionName }),
                Field({ label: 'Capacité', children: sectionCap }),
                addSection,
              ]),
              !g && h('p.small.mute', { style: { marginTop: 6 } }, [
                'Les sections pourront être ajoutées après la création de la classe.',
              ]),
            ].filter(Boolean)),
          ],
          actions: [del, cancel, save].filter(Boolean),
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          if (!name.value.trim()) { toast('Le nom est requis.', { tone: 'warn' }); return; }
          if (!specialty.value) { toast('La spécialité est requise.', { tone: 'warn' }); return; }
          const payload = {
            name: name.value.trim(),
            specialty_id: specialty.value,
            semester: semester.value || null,
            training_mode_id: mode.value || null,
            session_id: session.value || null,
            level: level.value.trim() || null,
            academic_year: year.value.trim() || null,
            capacity: capacity.value === '' ? null : Number(capacity.value),
            status: status.value,
          };
          save.disabled = true;
          try {
            if (g) await updateGroup(g.id, payload);
            else await createGroup(payload);
            toast('Classe enregistrée.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Enregistrement impossible.', { tone: 'danger' });
          }
        });
        del?.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'Supprimer la classe',
            message: `« ${g.name} » et ses sections seront supprimées.`,
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          await deleteGroup(g.id);
          toast('Classe supprimée.', { tone: 'success' });
          m.close(); reload();
        });
        m.open();
      }

      // ── Session de formation ───────────────────────────────────────────
      function openSession(se = null) {
        const name = Input({ value: se?.name || '', placeholder: 'Rentrée Février 2027' });
        const year = Input({ value: se?.academic_year || '', placeholder: '2026/2027' });
        const start = Input({ type: 'date', value: se?.start_date || '' });
        const end = Input({ type: 'date', value: se?.end_date || '' });
        const status = Select({
          value: se?.status || 'active',
          options: Object.entries(ENTITY_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
        });

        const save = Button({ label: se ? 'Enregistrer' : 'Créer', icon: se ? 'save' : 'plus',
                              variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });
        const del = se ? Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' }) : null;

        const m = Modal({
          title: se ? `Session — ${se.name}` : 'Nouvelle session de formation',
          size: 'md',
          children: [
            Field({ label: 'Nom', required: true, children: name }),
            h('div.form-grid', {}, [
              Field({ label: 'Année scolaire', children: year }),
              Field({ label: 'Début', children: start }),
              Field({ label: 'Fin', children: end }),
            ]),
            Field({ label: 'Statut', children: status }),
          ],
          actions: [del, cancel, save].filter(Boolean),
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          if (!name.value.trim()) { toast('Le nom est requis.', { tone: 'warn' }); return; }
          const payload = {
            name: name.value.trim(),
            academic_year: year.value.trim() || null,
            start_date: start.value || null,
            end_date: end.value || null,
            status: status.value,
            establishment_id: estabId,
          };
          save.disabled = true;
          try {
            if (se) await updateSession(se.id, payload);
            else await createSession(payload);
            toast('Session enregistrée.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Enregistrement impossible.', { tone: 'danger' });
          }
        });
        del?.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'Supprimer la session', message: `« ${se.name} » sera supprimée.`,
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          await deleteSession(se.id);
          toast('Session supprimée.', { tone: 'success' });
          m.close(); reload();
        });
        m.open();
      }

      // ── Tables ──────────────────────────────────────────────────────────
      const specialtyTable = DataTable({
        rows: specialties,
        exportName: 'specialites',
        searchPlaceholder: 'Spécialité, code, programme…',
        empty: 'Aucune spécialité ouverte dans cet établissement.',
        emptyIcon: 'graduation',
        search: (r, q) => [r.name, r.code, r.programs?.name]
          .some((v) => String(v ?? '').toLowerCase().includes(q)),
        columns: [
          { key: 'name', label: 'Spécialité', value: (r) => r.name },
          { key: 'code', label: 'Code', value: (r) => r.code || '—' },
          { key: 'program', label: 'Programme national', value: (r) => r.programs?.name || '—' },
          { key: 'mode', label: 'Mode', value: (r) => r.training_modes?.name || '—' },
          { key: 'seats', label: 'Places', align: 'right', value: (r) => fmtNum(r.seats),
            sortValue: (r) => r.seats || 0 },
          { key: 'students', label: 'Inscrits', align: 'right', sortable: false,
            value: (r) => countBySpecialty.get(r.name) || 0,
            render: (r) => h('span.mono', {}, [String(countBySpecialty.get(r.name) || 0)]) },
          { key: 'status', label: 'Statut', value: (r) => ENTITY_STATUS[r.status]?.label,
            render: (r) => StatusPill(ENTITY_STATUS, r.status) },
        ],
        onRow: openSpecialty,
      });

      const groupTable = DataTable({
        rows: groups,
        exportName: 'classes',
        searchPlaceholder: 'Classe, spécialité, niveau…',
        empty: 'Aucune classe créée.',
        emptyIcon: 'users',
        search: (r, q) => [r.name, r.specialties?.name, r.level, r.academic_year]
          .some((v) => String(v ?? '').toLowerCase().includes(q)),
        filters: [
          { key: 'semester', label: 'Semestre', value: (r) => r.semester || '', options: semOptions() },
          { key: 'specialty_id', label: 'Spécialité', value: (r) => r.specialty_id || '',
            options: [{ value: '', label: 'Toutes' },
              ...specialties.map((s) => ({ value: s.id, label: s.name }))] },
        ],
        columns: [
          { key: 'name', label: 'Classe', value: (r) => r.name },
          { key: 'specialty', label: 'Spécialité', value: (r) => r.specialties?.name || '—' },
          { key: 'semester', label: 'Semestre', value: (r) => r.semester ? semLabel(r.semester) : '—',
            render: (r) => r.semester
              ? h('span.mono', {}, [semLabel(r.semester)]) : h('span.mute', {}, ['—']) },
          { key: 'level', label: 'Niveau', value: (r) => r.level || '—' },
          { key: 'academic_year', label: 'Année', value: (r) => r.academic_year || '—' },
          { key: 'session', label: 'Session', value: (r) => r.training_sessions?.name || '—' },
          { key: 'sections', label: 'Sections', align: 'right', sortable: false,
            value: (r) => (r.sections || []).length,
            render: (r) => h('span.mono', {}, [String((r.sections || []).length)]) },
          { key: 'capacity', label: 'Capacité', align: 'right', value: (r) => fmtNum(r.capacity),
            sortValue: (r) => r.capacity || 0 },
          { key: 'status', label: 'Statut', value: (r) => ENTITY_STATUS[r.status]?.label,
            render: (r) => StatusPill(ENTITY_STATUS, r.status) },
        ],
        onRow: openGroup,
      });

      const sessionTable = sessions.length === 0
        ? Card({ padding: 0 }, [EmptyBlock('Aucune session de formation.', 'calendar')])
        : DataTable({
            rows: sessions,
            exportName: 'sessions',
            searchPlaceholder: 'Session, année…',
            empty: 'Aucune session.',
            columns: [
              { key: 'name', label: 'Session', value: (r) => r.name },
              { key: 'academic_year', label: 'Année', value: (r) => r.academic_year || '—' },
              { key: 'start_date', label: 'Début', value: (r) => r.start_date ? fmtDate(r.start_date) : '—',
                sortValue: (r) => r.start_date || '' },
              { key: 'end_date', label: 'Fin', value: (r) => r.end_date ? fmtDate(r.end_date) : '—' },
              { key: 'groups', label: 'Classes', align: 'right', sortable: false,
                value: (r) => groups.filter((g) => g.session_id === r.id).length,
                render: (r) => h('span.mono', {},
                  [String(groups.filter((g) => g.session_id === r.id).length)]) },
              { key: 'status', label: 'Statut', value: (r) => ENTITY_STATUS[r.status]?.label,
                render: (r) => StatusPill(ENTITY_STATUS, r.status) },
            ],
            onRow: openSession,
          });

      return [
        SectionHead(
          'Spécialités',
          `${specialties.length} spécialité${specialties.length > 1 ? 's' : ''} ouverte${specialties.length > 1 ? 's' : ''}`,
          Button({ label: 'Nouvelle spécialité', icon: 'plus', variant: 'primary',
                   onClick: () => openSpecialty() })
        ),
        programs.length === 0 && Notice({ tone: 'info', title: 'Aucun programme publié' }, [
          'Le ministère n’a pas encore publié de programme national. Vous pouvez créer une '
          + 'spécialité locale et la rattacher plus tard.',
        ]),
        specialtyTable,

        SectionHead(
          'Classes et sections',
          `${groups.length} classe${groups.length > 1 ? 's' : ''}`,
          Button({ label: 'Nouvelle classe', icon: 'plus', variant: 'primary',
                   onClick: () => openGroup() })
        ),
        groupTable,

        SectionHead(
          'Sessions de formation',
          `${sessions.length} session${sessions.length > 1 ? 's' : ''}`,
          Button({ label: 'Nouvelle session', icon: 'plus', variant: 'primary',
                   onClick: () => openSession() })
        ),
        sessionTable,
      ].filter(Boolean);
    },
  });
}
