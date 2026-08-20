// §5 — Gestion nationale des établissements de formation.
// Les 10 types officiels, rattachement à une wilaya, directeur, compte
// administrateur, statut, et création de comptes internes.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select, Textarea } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { DataTable } from '../../components/table.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice, fullName } from '../../lib/ui.js';
import { ENTITY_STATUS, ESTABLISHMENT_TYPES, typeAbbr, typeLabel, typeOptions } from '../../lib/nomenclature.js';
import {
  listWilayas, listEstablishments, createEstablishment, updateEstablishment,
  deleteEstablishment, listProfiles, createAccount,
} from '../../lib/db.js';

export async function ministryEstablishmentsPage(ctx = {}) {
  const preselectWilaya = ctx.query?.get('wilaya') || '';

  return protectedPage({
    role: 'ministry',
    title: 'Établissements',
    breadcrumb: 'Ministère · Établissements',
    active: t('nav.establishments'),
    build: async () => {
      const [wilayas, estabs, admins] = await Promise.all([
        listWilayas(),
        listEstablishments(),
        listProfiles({ role: 'admin' }),
      ]);

      const adminsByEstab = new Map();
      for (const a of admins) {
        if (!a.establishment_id) continue;
        const arr = adminsByEstab.get(a.establishment_id) || [];
        arr.push(a);
        adminsByEstab.set(a.establishment_id, arr);
      }

      const wilayaOptions = (empty = '— choisir une wilaya —') => [
        { value: '', label: empty },
        ...wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
      ];

      const reload = () => window.location.reload();

      // ── Création ────────────────────────────────────────────────────────
      function openCreate() {
        if (wilayas.length === 0) {
          toast('Créez d’abord au moins une wilaya.', { tone: 'warn' });
          return;
        }
        const name    = Input({ placeholder: 'INSFP de Batna' });
        const code    = Input({ placeholder: 'INSFP-05-01' });
        const type    = Select({ value: 'insfp', options: typeOptions() });
        const wilaya  = Select({ value: preselectWilaya, options: wilayaOptions() });
        const address = Textarea({ rows: 2, placeholder: 'Adresse complète' });
        const director = Input({ placeholder: 'Nom du directeur' });
        const email   = Input({ type: 'email', placeholder: 'contact@etablissement.dz' });
        const phone   = Input({ type: 'tel', placeholder: '+213 …' });

        const aFirst = Input({ placeholder: 'Prénom' });
        const aLast  = Input({ placeholder: 'Nom' });
        const aEmail = Input({ type: 'email', placeholder: 'admin@etablissement.dz' });
        const aPwd   = Input({ type: 'password', placeholder: '8 caractères minimum' });

        const save   = Button({ label: "Créer l'établissement", icon: 'plus', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });

        const m = Modal({
          title: 'Nouvel établissement de formation',
          subtitle: 'Le compte administrateur est facultatif et peut être ajouté plus tard.',
          size: 'lg',
          children: [
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Nom', required: true, children: name }),
              Field({ label: 'Code établissement', children: code }),
            ]),
            Field({ label: 'Type', required: true, children: type }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Wilaya', required: true, children: wilaya }),
              Field({ label: 'Directeur', children: director }),
            ]),
            Field({ label: 'Adresse', children: address }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Email', children: email }),
              Field({ label: 'Téléphone', children: phone }),
            ]),
            h('hr', { style: { border: 0, borderTop: '1px solid var(--c-line-soft)', margin: '4px 0' } }),
            h('h3.card__title', {}, ["Compte administrateur de l'établissement"]),
            h('div.form-grid', {}, [
              Field({ label: 'Prénom', children: aFirst }),
              Field({ label: 'Nom', children: aLast }),
            ]),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Email de connexion', children: aEmail }),
              Field({ label: 'Mot de passe', children: aPwd, hint: '8 caractères minimum' }),
            ]),
          ],
          actions: [cancel, save],
        });

        cancel.addEventListener('click', () => m.close());
        save.addEventListener('click', async () => {
          if (!name.value.trim())  { toast('Le nom est requis.', { tone: 'warn' }); return; }
          if (!wilaya.value)       { toast('La wilaya est requise.', { tone: 'warn' }); return; }
          const wantsAdmin = !!aEmail.value.trim();
          if (wantsAdmin && aPwd.value.length < 8) {
            toast('Mot de passe : 8 caractères minimum.', { tone: 'warn' }); return;
          }
          save.disabled = true;
          try {
            const created = await createEstablishment({
              name: name.value.trim(),
              code: code.value.trim() || null,
              type: type.value,
              wilaya_id: wilaya.value,
              address: address.value.trim() || null,
              director_name: director.value.trim() || null,
              contact_email: email.value.trim() || null,
              contact_phone: phone.value.trim() || null,
            });
            if (wantsAdmin && created) {
              await createAccount({
                p_email: aEmail.value.trim(),
                p_password: aPwd.value,
                p_role: 'admin',
                p_first_name: aFirst.value.trim(),
                p_last_name: aLast.value.trim(),
                p_establishment_id: created.id,
                p_wilaya_id: wilaya.value,
              });
            }
            toast('Établissement créé.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Création impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      // ── Édition ─────────────────────────────────────────────────────────
      function openEdit(e) {
        const name    = Input({ value: e.name || '' });
        const code    = Input({ value: e.code || '' });
        const type    = Select({ value: e.type, options: typeOptions() });
        const wilaya  = Select({ value: e.wilaya_id || '', options: wilayaOptions() });
        const address = Textarea({ rows: 2, value: e.address || '' });
        const director = Input({ value: e.director_name || '' });
        const email   = Input({ type: 'email', value: e.contact_email || '' });
        const phone   = Input({ type: 'tel', value: e.contact_phone || '' });
        const status  = Select({
          value: e.status,
          options: Object.entries(ENTITY_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
        });

        const staff = adminsByEstab.get(e.id) || [];

        const save   = Button({ label: 'Enregistrer', icon: 'save', variant: 'primary' });
        const cancel = Button({ label: 'Fermer', variant: 'secondary' });
        const del    = Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' });

        const m = Modal({
          title: e.name,
          subtitle: `${typeAbbr(e.type)} · ${e.wilayas ? `${e.wilayas.code} — ${e.wilayas.name}` : 'wilaya non définie'}`,
          size: 'lg',
          children: [
            h('div', {}, [
              h('div.kpi__label', {}, ['Comptes administrateurs']),
              staff.length
                ? h('ul', { style: { margin: '6px 0 0', paddingInlineStart: '18px' } },
                    staff.map((s) => h('li', { style: { fontSize: 13 } }, [
                      `${fullName(s)} — `,
                      h('span.mono.small.mute', {}, [s.email]),
                    ])))
                : h('p.small.mute', { style: { marginTop: 4 } }, [
                    'Aucun compte administrateur. Créez-le depuis « Comptes ».',
                  ]),
            ]),
            h('hr', { style: { border: 0, borderTop: '1px solid var(--c-line-soft)' } }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Nom', required: true, children: name }),
              Field({ label: 'Code', children: code }),
            ]),
            Field({ label: 'Type', children: type }),
            h('div.form-grid', {}, [
              Field({ label: 'Wilaya', children: wilaya }),
              Field({ label: 'Directeur', children: director }),
              Field({ label: 'Statut', children: status }),
            ]),
            Field({ label: 'Adresse', children: address }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Email', children: email }),
              Field({ label: 'Téléphone', children: phone }),
            ]),
          ],
          actions: [del, cancel, save],
        });

        cancel.addEventListener('click', () => m.close());

        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            await updateEstablishment(e.id, {
              name: name.value.trim(),
              code: code.value.trim() || null,
              type: type.value,
              wilaya_id: wilaya.value || null,
              address: address.value.trim() || null,
              director_name: director.value.trim() || null,
              contact_email: email.value.trim() || null,
              contact_phone: phone.value.trim() || null,
              status: status.value,
            });
            toast('Établissement mis à jour.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Mise à jour impossible.', { tone: 'danger' });
          }
        });

        del.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: "Supprimer l'établissement",
            message: `« ${e.name} » et toutes ses spécialités, classes et matières seront supprimées. `
              + 'Les comptes rattachés seront détachés.',
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          try {
            await deleteEstablishment(e.id);
            toast('Établissement supprimé.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            toast(err.message || 'Suppression impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      // ── Répartition par type ───────────────────────────────────────────
      const byType = ESTABLISHMENT_TYPES
        .map((t) => ({ ...t, n: estabs.filter((e) => e.type === t.value).length }))
        .filter((t) => t.n > 0);

      const table = DataTable({
        rows: estabs,
        exportName: 'etablissements',
        searchPlaceholder: 'Nom, code, wilaya, directeur…',
        empty: 'Aucun établissement enregistré.',
        emptyIcon: 'building',
        search: (r, q) =>
          [r.name, r.code, r.director_name, r.contact_email, r.wilayas?.name, r.wilayas?.code,
           typeAbbr(r.type)]
            .some((v) => String(v ?? '').toLowerCase().includes(q)),
        filters: [
          {
            key: 'wilaya_id', label: 'Wilaya', value: (r) => r.wilaya_id || '',
            options: wilayaOptions('Toutes les wilayas'),
          },
          {
            key: 'type', label: 'Type', value: (r) => r.type,
            options: typeOptions('Tous les types'),
          },
          {
            key: 'status', label: 'Statut', value: (r) => r.status,
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(ENTITY_STATUS).map(([v, mm]) => ({ value: v, label: mm.label }))],
          },
        ],
        columns: [
          { key: 'name', label: 'Établissement', value: (r) => r.name,
            render: (r) => h('div', {}, [
              h('div', { style: { fontWeight: 500 } }, [r.name]),
              r.code && h('div.mono.small.mute', {}, [r.code]),
            ].filter(Boolean)) },
          { key: 'type', label: 'Type', value: (r) => typeAbbr(r.type),
            render: (r) => Badge({ tone: 'outline', size: 'sm' }, [typeAbbr(r.type)]) },
          { key: 'wilaya', label: 'Wilaya', value: (r) => r.wilayas ? `${r.wilayas.code} — ${r.wilayas.name}` : '—',
            sortValue: (r) => r.wilayas?.code || '' },
          { key: 'director_name', label: 'Directeur', value: (r) => r.director_name || '—' },
          { key: 'admins', label: 'Comptes', align: 'right', sortable: false,
            value: (r) => (adminsByEstab.get(r.id) || []).length,
            render: (r) => {
              const n = (adminsByEstab.get(r.id) || []).length;
              return n
                ? h('span.mono', {}, [String(n)])
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
          'Établissements de formation',
          `${estabs.length} établissement${estabs.length > 1 ? 's' : ''} · `
          + `${wilayas.length} wilaya${wilayas.length > 1 ? 's' : ''}`,
          Button({ label: 'Nouvel établissement', icon: 'plus', variant: 'primary', onClick: openCreate })
        ),

        wilayas.length === 0
          ? Notice({ tone: 'warn', title: 'Aucune wilaya' }, [
              'Un établissement doit être rattaché à une wilaya. Créez-en une depuis la page Wilayas.',
            ])
          : null,

        byType.length > 0 && Card({ padding: 16 }, [
          h('div.kpi__label', { style: { marginBottom: 10 } }, ['Répartition par type']),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
            byType.map((t) => h('span', {
              style: {
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                border: '1px solid var(--c-line)', borderRadius: '999px',
                padding: '4px 10px', fontSize: '12px',
              },
              title: t.label,
            }, [
              h('strong', {}, [t.abbr]),
              h('span.mono.mute', {}, [String(t.n)]),
            ]))),
        ]),

        table,
      ].filter(Boolean);
    },
  });
}
