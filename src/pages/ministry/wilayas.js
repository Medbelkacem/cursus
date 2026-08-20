// §4 — Gestion des wilayas : création, modification, activation, compte de
// direction, statistiques et établissements rattachés.

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
import { StatusPill, SectionHead, Notice, fmtNum } from '../../lib/ui.js';
import { ENTITY_STATUS } from '../../lib/nomenclature.js';
import { navigate } from '../../lib/router.js';
import {
  listWilayas, createWilayaWithAdmin, updateWilaya, deleteWilaya,
  listEstablishments, listProfiles, createAccount,
} from '../../lib/db.js';

export async function ministryWilayasPage() {
  return protectedPage({
    role: 'ministry',
    title: 'Wilayas',
    breadcrumb: 'Ministère · Wilayas',
    active: t('nav.wilayas'),
    build: async () => {
      const [wilayas, estabs, directors] = await Promise.all([
        listWilayas(),
        listEstablishments(),
        listProfiles({ role: 'direction' }),
      ]);

      const estabCount = new Map();
      for (const e of estabs) {
        estabCount.set(e.wilaya_id, (estabCount.get(e.wilaya_id) || 0) + 1);
      }
      const dirByWilaya = new Map();
      for (const d of directors) {
        if (d.wilaya_id) dirByWilaya.set(d.wilaya_id, d);
      }

      const reload = () => window.location.reload();

      // ── Formulaire de création ─────────────────────────────────────────
      function openCreate() {
        const code   = Input({ placeholder: '05', maxlength: '4' });
        const name   = Input({ placeholder: 'Batna' });
        const nameAr = Input({ placeholder: 'باتنة', dir: 'rtl' });
        const dirName = Input({ placeholder: 'Direction de la Formation Professionnelle de Batna' });
        const address = Textarea({ rows: 2, placeholder: 'Adresse de la direction' });
        const email  = Input({ type: 'email', placeholder: 'dfp05@formation.dz' });
        const phone  = Input({ type: 'tel', placeholder: '+213 33 …' });

        const aFirst = Input({ placeholder: 'Prénom' });
        const aLast  = Input({ placeholder: 'Nom' });
        const aEmail = Input({ type: 'email', placeholder: 'direction.batna@formation.dz' });
        const aPwd   = Input({ type: 'password', placeholder: '8 caractères minimum' });

        const save = Button({ label: 'Créer la wilaya', icon: 'plus', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });

        const m = Modal({
          title: 'Nouvelle wilaya',
          subtitle: 'Le compte de direction est facultatif — il peut être créé plus tard.',
          size: 'lg',
          children: [
            h('div.form-grid', {}, [
              Field({ label: 'Code / numéro', required: true, children: code, hint: 'Ex. 05, 16, 42' }),
              Field({ label: 'Nom de la wilaya', required: true, children: name }),
              Field({ label: 'Nom en arabe', children: nameAr }),
            ]),
            Field({ label: 'Intitulé de la direction', children: dirName }),
            Field({ label: 'Adresse', children: address }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Email de contact', children: email }),
              Field({ label: 'Téléphone', children: phone }),
            ]),
            h('hr', { style: { border: 0, borderTop: '1px solid var(--c-line-soft)', margin: '4px 0' } }),
            h('h3.card__title', {}, ['Compte administrateur de la direction']),
            h('p.small.mute', {}, [
              'Ce compte donne accès au tableau de bord de la wilaya, limité à son propre périmètre.',
            ]),
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
          if (!code.value.trim() || !name.value.trim()) {
            toast('Le code et le nom sont requis.', { tone: 'warn' });
            return;
          }
          const wantsAdmin = !!aEmail.value.trim();
          if (wantsAdmin && aPwd.value.length < 8) {
            toast('Mot de passe : 8 caractères minimum.', { tone: 'warn' });
            return;
          }
          save.disabled = true;
          try {
            await createWilayaWithAdmin({
              p_code: code.value.trim(),
              p_name: name.value.trim(),
              p_directorate_name: dirName.value.trim() || null,
              p_address: address.value.trim() || null,
              p_contact_email: email.value.trim() || null,
              p_contact_phone: phone.value.trim() || null,
              p_admin_email: wantsAdmin ? aEmail.value.trim() : null,
              p_admin_password: wantsAdmin ? aPwd.value : null,
              p_admin_first_name: aFirst.value.trim(),
              p_admin_last_name: aLast.value.trim(),
            });
            // Le nom en arabe n'est pas géré par la RPC : mise à jour ciblée.
            if (nameAr.value.trim()) {
              const fresh = await listWilayas();
              const created = fresh.find((w) => w.code === code.value.trim());
              if (created) await updateWilaya(created.id, { name_ar: nameAr.value.trim() });
            }
            toast('Wilaya créée.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Création impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      // ── Formulaire d'édition ───────────────────────────────────────────
      function openEdit(w) {
        const code   = Input({ value: w.code || '' });
        const name   = Input({ value: w.name || '' });
        const nameAr = Input({ value: w.name_ar || '', dir: 'rtl' });
        const dirName = Input({ value: w.directorate_name || '' });
        const address = Textarea({ rows: 2, value: w.address || '' });
        const email  = Input({ type: 'email', value: w.contact_email || '' });
        const phone  = Input({ type: 'tel', value: w.contact_phone || '' });
        const status = Select({
          value: w.status,
          options: Object.entries(ENTITY_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
        });

        const director = dirByWilaya.get(w.id);
        const nEstab = estabCount.get(w.id) || 0;

        const save = Button({ label: 'Enregistrer', icon: 'save', variant: 'primary' });
        const cancel = Button({ label: 'Fermer', variant: 'secondary' });
        const del = Button({ label: 'Supprimer', icon: 'trash', variant: 'danger' });

        const m = Modal({
          title: `Wilaya ${w.code} — ${w.name}`,
          size: 'lg',
          children: [
            h('div.kpi-grid', {}, [
              Card({ padding: 14 }, [
                h('div.kpi__label', {}, ['Établissements']),
                h('div.kpi__value', {}, [h('span', {}, [fmtNum(nEstab)])]),
              ]),
              Card({ padding: 14 }, [
                h('div.kpi__label', {}, ['Compte de direction']),
                h('div', { style: { marginTop: 6 } }, [
                  director
                    ? h('div', {}, [
                        h('div', { style: { fontWeight: 600, fontSize: 13 } }, [
                          `${director.first_name} ${director.last_name}`.trim() || director.email,
                        ]),
                        h('div.mono.small.mute', {}, [director.email]),
                      ])
                    : h('span.small.mute', {}, ['Aucun compte associé']),
                ]),
              ]),
            ]),

            !director && Notice({ tone: 'warn', title: 'Aucun administrateur de direction' }, [
              "Cette wilaya n'a pas encore de compte de direction. Créez-le depuis « Comptes » ou "
              + 'en recréant la wilaya avec un administrateur.',
            ]),

            h('div.form-grid', {}, [
              Field({ label: 'Code', required: true, children: code }),
              Field({ label: 'Nom', required: true, children: name }),
              Field({ label: 'Nom en arabe', children: nameAr }),
              Field({ label: 'Statut', children: status }),
            ]),
            Field({ label: 'Intitulé de la direction', children: dirName }),
            Field({ label: 'Adresse', children: address }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Email de contact', children: email }),
              Field({ label: 'Téléphone', children: phone }),
            ]),

            h('div', { style: { marginTop: 8 } }, [
              Button({
                label: `Voir les ${nEstab} établissement${nEstab > 1 ? 's' : ''}`,
                icon: 'building', variant: 'ghost', size: 'sm',
                onClick: () => { m.close(); navigate(`/ministere/etablissements?wilaya=${w.id}`); },
              }),
            ]),
          ].filter(Boolean),
          actions: [del, cancel, save],
        });

        cancel.addEventListener('click', () => m.close());

        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            await updateWilaya(w.id, {
              code: code.value.trim(),
              name: name.value.trim(),
              name_ar: nameAr.value.trim() || null,
              directorate_name: dirName.value.trim() || null,
              address: address.value.trim() || null,
              contact_email: email.value.trim() || null,
              contact_phone: phone.value.trim() || null,
              status: status.value,
            });
            toast('Wilaya mise à jour.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Mise à jour impossible.', { tone: 'danger' });
          }
        });

        del.addEventListener('click', async () => {
          if (nEstab > 0) {
            toast(`Impossible : ${nEstab} établissement(s) y sont rattachés.`, { tone: 'warn' });
            return;
          }
          const ok = await confirmDialog({
            title: 'Supprimer la wilaya',
            message: `La wilaya ${w.code} — ${w.name} sera définitivement supprimée.`,
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          try {
            await deleteWilaya(w.id);
            toast('Wilaya supprimée.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            toast(err.message || 'Suppression impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      // ── Tableau ─────────────────────────────────────────────────────────
      const table = DataTable({
        rows: wilayas,
        exportName: 'wilayas',
        searchPlaceholder: 'Rechercher une wilaya, un code…',
        empty: "Aucune wilaya enregistrée. Commencez par en créer une — la plateforme démarre vide.",
        emptyIcon: 'map-pin',
        filters: [{
          key: 'status', label: 'Statut',
          options: [{ value: '', label: 'Tous' },
            ...Object.entries(ENTITY_STATUS).map(([v, m]) => ({ value: v, label: m.label }))],
        }],
        columns: [
          { key: 'code', label: 'Code', value: (r) => r.code, cellClass: 'mono',
            render: (r) => h('span.mono', { style: { fontWeight: 600 } }, [r.code]) },
          { key: 'name', label: 'Wilaya', value: (r) => r.name,
            render: (r) => h('div', {}, [
              h('div', { style: { fontWeight: 500 } }, [r.name]),
              r.name_ar && h('div.small.mute', { dir: 'rtl' }, [r.name_ar]),
            ].filter(Boolean)) },
          { key: 'directorate_name', label: 'Direction', value: (r) => r.directorate_name || '—' },
          { key: 'admin', label: 'Administrateur', sortable: false,
            value: (r) => dirByWilaya.get(r.id)?.email || '—',
            render: (r) => {
              const d = dirByWilaya.get(r.id);
              return d
                ? h('span.mono.small', {}, [d.email])
                : Badge({ tone: 'warn', size: 'sm' }, ['à créer']);
            } },
          { key: 'estabs', label: 'Établissements', align: 'right',
            value: (r) => estabCount.get(r.id) || 0,
            sortValue: (r) => estabCount.get(r.id) || 0,
            render: (r) => h('span.mono', {}, [String(estabCount.get(r.id) || 0)]) },
          { key: 'contact_email', label: 'Contact', value: (r) => r.contact_email || '—',
            render: (r) => h('span.mono.small', {}, [r.contact_email || '—']) },
          { key: 'status', label: 'Statut', value: (r) => ENTITY_STATUS[r.status]?.label,
            render: (r) => StatusPill(ENTITY_STATUS, r.status) },
        ],
        onRow: openEdit,
      });

      return [
        SectionHead(
          'Wilayas et directions',
          `${wilayas.length} wilaya${wilayas.length > 1 ? 's' : ''} · `
          + `${estabs.length} établissement${estabs.length > 1 ? 's' : ''} rattaché${estabs.length > 1 ? 's' : ''}`,
          Button({ label: 'Nouvelle wilaya', icon: 'plus', variant: 'primary', onClick: openCreate })
        ),
        wilayas.length === 0
          ? Notice({ tone: 'info', title: 'Base vierge' }, [
              'Aucune donnée n\'est pré-remplie. Créez les wilayas, puis les établissements, '
              + 'puis les programmes de formation.',
            ])
          : null,
        table,
      ].filter(Boolean);
    },
  });
}
