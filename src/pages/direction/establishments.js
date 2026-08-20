// §3, §18 — Établissements de la wilaya : consultation et mise à jour des
// informations, dans la limite du périmètre autorisé (RLS).

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select, Textarea } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { DataTable } from '../../components/table.js';
import { Modal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice, KPIGrid, fmtNum, fullName } from '../../lib/ui.js';
import {
  ENTITY_STATUS, ESTABLISHMENT_TYPES, typeAbbr, typeOptions,
} from '../../lib/nomenclature.js';
import {
  listEstablishments, updateEstablishment, listProfiles, searchStudents,
} from '../../lib/db.js';

export async function directionEstablishmentsPage() {
  return protectedPage({
    role: 'direction',
    title: 'Établissements de la wilaya',
    breadcrumb: 'Direction de wilaya · Établissements',
    active: t('nav.establishments'),
    build: async ({ profile }) => {
      // Les policies limitent déjà la lecture à la wilaya de l'utilisateur.
      const [estabs, admins, students] = await Promise.all([
        listEstablishments(),
        listProfiles({ role: 'admin' }).catch(() => []),
        searchStudents({ p_limit: 1000 }).catch(() => []),
      ]);

      const adminsByEstab = new Map();
      for (const a of admins) {
        if (!a.establishment_id) continue;
        adminsByEstab.set(a.establishment_id, [...(adminsByEstab.get(a.establishment_id) || []), a]);
      }
      const studentsByEstab = new Map();
      for (const s of students) {
        studentsByEstab.set(s.establishment_id,
          (studentsByEstab.get(s.establishment_id) || 0) + 1);
      }

      const reload = () => window.location.reload();

      function openEdit(e) {
        const address = Textarea({ rows: 2, value: e.address || '' });
        const director = Input({ value: e.director_name || '' });
        const email = Input({ type: 'email', value: e.contact_email || '' });
        const phone = Input({ type: 'tel', value: e.contact_phone || '' });
        const status = Select({
          value: e.status,
          options: Object.entries(ENTITY_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
        });

        const staff = adminsByEstab.get(e.id) || [];
        const nStudents = studentsByEstab.get(e.id) || 0;

        const save = Button({ label: 'Enregistrer', icon: 'save', variant: 'primary' });
        const close = Button({ label: 'Fermer', variant: 'secondary' });

        const m = Modal({
          title: e.name,
          subtitle: `${typeAbbr(e.type)}${e.code ? ` · ${e.code}` : ''}`,
          size: 'md',
          children: [
            KPIGrid([
              { label: 'Étudiants', value: fmtNum(nStudents) },
              { label: 'Comptes administrateurs', value: fmtNum(staff.length) },
            ]),
            staff.length > 0 && h('div', {}, [
              h('div.kpi__label', { style: { marginBottom: 4 } }, ['Administrateurs']),
              h('ul', { style: { margin: 0, paddingInlineStart: '18px' } },
                staff.map((s) => h('li', { style: { fontSize: 13 } }, [
                  `${fullName(s)} — `,
                  h('span.mono.small.mute', {}, [s.email]),
                ]))),
            ]),
            Notice({ tone: 'info' }, [
              'Le type d’établissement, le code et le rattachement territorial relèvent du ministère.',
            ]),
            Field({ label: 'Directeur', children: director }),
            Field({ label: 'Adresse', children: address }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Email', children: email }),
              Field({ label: 'Téléphone', children: phone }),
            ]),
            Field({ label: 'Statut', children: status }),
          ].filter(Boolean),
          actions: [close, save],
        });

        close.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            await updateEstablishment(e.id, {
              director_name: director.value.trim() || null,
              address: address.value.trim() || null,
              contact_email: email.value.trim() || null,
              contact_phone: phone.value.trim() || null,
              status: status.value,
            });
            toast('Établissement mis à jour.', { tone: 'success' });
            m.close(); reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Mise à jour impossible.', { tone: 'danger' });
          }
        });
        m.open();
      }

      const byType = ESTABLISHMENT_TYPES
        .map((t) => ({ ...t, n: estabs.filter((e) => e.type === t.value).length }))
        .filter((t) => t.n > 0);

      const table = DataTable({
        rows: estabs,
        exportName: 'etablissements-wilaya',
        searchPlaceholder: 'Nom, code, directeur…',
        empty: 'Aucun établissement dans votre wilaya.',
        emptyIcon: 'building',
        search: (r, q) => [r.name, r.code, r.director_name, r.contact_email, typeAbbr(r.type)]
          .some((v) => String(v ?? '').toLowerCase().includes(q)),
        filters: [
          { key: 'type', label: 'Type', value: (r) => r.type, options: typeOptions('Tous les types') },
          { key: 'status', label: 'Statut', value: (r) => r.status,
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(ENTITY_STATUS).map(([v, m]) => ({ value: v, label: m.label }))] },
        ],
        columns: [
          { key: 'name', label: 'Établissement', value: (r) => r.name,
            render: (r) => h('div', {}, [
              h('div', { style: { fontWeight: 500 } }, [r.name]),
              r.code && h('div.mono.small.mute', {}, [r.code]),
            ].filter(Boolean)) },
          { key: 'type', label: 'Type', value: (r) => typeAbbr(r.type),
            render: (r) => Badge({ tone: 'outline', size: 'sm' }, [typeAbbr(r.type)]) },
          { key: 'director_name', label: 'Directeur', value: (r) => r.director_name || '—' },
          { key: 'students', label: 'Étudiants', align: 'right', sortable: false,
            value: (r) => studentsByEstab.get(r.id) || 0,
            render: (r) => h('span.mono', {}, [String(studentsByEstab.get(r.id) || 0)]) },
          { key: 'admins', label: 'Comptes', align: 'right', sortable: false,
            value: (r) => (adminsByEstab.get(r.id) || []).length,
            render: (r) => {
              const n = (adminsByEstab.get(r.id) || []).length;
              return n ? h('span.mono', {}, [String(n)])
                : Badge({ tone: 'warn', size: 'sm' }, ['aucun']);
            } },
          { key: 'contact_email', label: 'Contact', value: (r) => r.contact_email || '—',
            render: (r) => h('span.mono.small', {}, [r.contact_email || '—']) },
          { key: 'status', label: 'Statut', value: (r) => ENTITY_STATUS[r.status]?.label,
            render: (r) => StatusPill(ENTITY_STATUS, r.status) },
        ],
        onRow: openEdit,
      });

      return [
        SectionHead(
          'Établissements de la wilaya',
          `${estabs.length} établissement${estabs.length > 1 ? 's' : ''} · `
          + `${students.length} étudiant${students.length > 1 ? 's' : ''}`
        ),

        byType.length > 0 && Card({ padding: 16 }, [
          h('div.kpi__label', { style: { marginBottom: 10 } }, ['Répartition par type']),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
            byType.map((t) => h('span', {
              style: { display: 'inline-flex', alignItems: 'center', gap: '6px',
                       border: '1px solid var(--c-line)', borderRadius: '999px',
                       padding: '4px 10px', fontSize: '12px' },
              title: t.label,
            }, [h('strong', {}, [t.abbr]), h('span.mono.mute', {}, [String(t.n)])]))),
        ]),

        table,
      ].filter(Boolean);
    },
  });
}
