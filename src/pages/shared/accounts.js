// §6 / §23 — Comptes et permissions.
//
// Une seule page, adaptée au rôle de l'appelant :
//   ministère  → tous les comptes, tous rôles
//   direction  → comptes des établissements de sa wilaya
//   admin      → comptes internes à son établissement
// L'autorisation réelle est appliquée en base (create_account, RLS).

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { protectedPage } from '../../lib/page.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select, Checkbox } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { DataTable } from '../../components/table.js';
import { Modal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { StatusPill, SectionHead, Notice, fullName } from '../../lib/ui.js';
import { USER_STATUS, ROLES, PERMISSIONS, typeAbbr, semOptions } from '../../lib/nomenclature.js';
import {
  listProfiles, listWilayas, listEstablishments, listSpecialties, listGroups,
  listPrograms, listTrainingModes, createAccount, setAccountStatus, deleteAccount,
  setPermissions, listUserPermissions,
} from '../../lib/db.js';

// Rôles que chaque rôle appelant peut créer (miroir de create_account en base)
const CREATABLE = {
  ministry:  ['direction', 'admin', 'teacher', 'student', 'ministry'],
  direction: ['admin', 'teacher', 'student'],
  admin:     ['admin', 'teacher', 'student'],
};

export async function accountsPage() {
  return protectedPage({
    role: ['ministry', 'direction', 'admin'],
    title: 'Comptes et permissions',
    breadcrumb: 'Administration · Comptes',
    active: t('nav.accounts'),
    build: async ({ profile }) => {
      const role = profile.role;
      const canCreate = CREATABLE[role] || [];

      const scope = role === 'admin' ? { establishment_id: profile.establishment_id } : {};

      const [profiles, wilayas, estabs, programs, modes] = await Promise.all([
        listProfiles(scope),
        listWilayas().catch(() => []),
        listEstablishments(),
        listPrograms().catch(() => []),
        listTrainingModes().catch(() => []),
      ]);

      const estabById = new Map(estabs.map((e) => [e.id, e]));
      const reload = () => window.location.reload();

      const estabOptions = (empty = '— choisir un établissement —') => [
        { value: '', label: empty },
        ...estabs.map((e) => ({
          value: e.id,
          label: `${typeAbbr(e.type)} · ${e.name}${e.wilayas ? ` (${e.wilayas.code})` : ''}`,
        })),
      ];

      // ── Création de compte ─────────────────────────────────────────────
      function openCreate() {
        const roleSel = Select({
          value: canCreate.includes('admin') ? 'admin' : canCreate[0],
          options: canCreate.map((r) => ({ value: r, label: ROLES[r]?.label || r })),
        });
        const first = Input({ placeholder: 'Prénom' });
        const last  = Input({ placeholder: 'Nom' });
        const email = Input({ type: 'email', placeholder: 'utilisateur@formation.dz' });
        const phone = Input({ type: 'tel', placeholder: '+213 …' });
        const pwd   = Input({ type: 'password', placeholder: '8 caractères minimum' });

        const wilayaSel = Select({
          value: profile.wilaya_id || '',
          options: [{ value: '', label: '— choisir une wilaya —' },
            ...wilayas.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))],
        });
        const estabSel = Select({
          value: role === 'admin' ? profile.establishment_id : '',
          options: estabOptions(),
          disabled: role === 'admin',
        });

        // Champs spécifiques « étudiant »
        const numberIn = Input({ placeholder: '2026-0001' });
        const specSel  = Select({ value: '', options: [{ value: '', label: '— spécialité —' }] });
        const groupSel = Select({ value: '', options: [{ value: '', label: '— classe —' }] });
        const progSel  = Select({
          value: '',
          options: [{ value: '', label: '— programme —' },
            ...programs.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))],
        });
        const modeSel  = Select({
          value: '',
          options: [{ value: '', label: '— mode de formation —' },
            ...modes.map((mm) => ({ value: mm.id, label: mm.name }))],
        });

        const permBoxes = PERMISSIONS.map((p) => ({ p, box: Checkbox({ label: p.label }) }));

        const wilayaField  = Field({ label: 'Wilaya', children: wilayaSel });
        const estabField   = Field({ label: 'Établissement', required: true, children: estabSel });
        const studentBlock = h('div', {}, [
          h('div.form-grid', {}, [
            Field({ label: 'Numéro étudiant', children: numberIn }),
            Field({ label: 'Programme national', children: progSel }),
            Field({ label: 'Mode de formation', children: modeSel }),
          ]),
          h('div.form-grid--2.form-grid', { style: { marginTop: 'var(--s-3)' } }, [
            Field({ label: 'Spécialité', children: specSel }),
            Field({ label: 'Classe', children: groupSel }),
          ]),
        ]);
        const permBlock = h('div', {}, [
          h('div.kpi__label', { style: { marginBottom: 6 } }, ['Permissions complémentaires']),
          h('div', { style: { display: 'grid', gap: '6px' } }, permBoxes.map((x) => x.box)),
        ]);

        // Charge spécialités / classes quand l'établissement change
        async function loadEstabLists() {
          const id = estabSel.value;
          specSel.replaceChildren(h('option', { value: '' }, ['— spécialité —']));
          groupSel.replaceChildren(h('option', { value: '' }, ['— classe —']));
          if (!id) return;
          try {
            const [specs, groups] = await Promise.all([listSpecialties(id), listGroups(id)]);
            specs.forEach((s) => specSel.appendChild(h('option', { value: s.id }, [s.name])));
            groups.forEach((g) => groupSel.appendChild(
              h('option', { value: g.id }, [`${g.name}${g.semester ? ` · ${g.semester.toUpperCase()}` : ''}`])
            ));
          } catch (_) { /* périmètre insuffisant : listes vides */ }
        }
        estabSel.addEventListener('change', loadEstabLists);
        if (estabSel.value) loadEstabLists();

        function syncVisibility() {
          const r = roleSel.value;
          const needsEstab = ['admin', 'teacher', 'student'].includes(r);
          estabField.hidden  = !needsEstab;
          wilayaField.hidden = r !== 'direction';
          studentBlock.hidden = r !== 'student';
          permBlock.hidden = r === 'student';
        }
        roleSel.addEventListener('change', syncVisibility);

        const save   = Button({ label: 'Créer le compte', icon: 'user-plus', variant: 'primary' });
        const cancel = Button({ label: 'Annuler', variant: 'secondary' });

        const m = Modal({
          title: 'Nouveau compte',
          subtitle: 'Le compte est actif immédiatement ; la personne se connecte avec cet email.',
          size: 'lg',
          children: [
            Field({ label: 'Rôle', required: true, children: roleSel }),
            h('div.form-grid--2.form-grid', {}, [
              Field({ label: 'Prénom', children: first }),
              Field({ label: 'Nom', children: last }),
            ]),
            h('div.form-grid', {}, [
              Field({ label: 'Email', required: true, children: email }),
              Field({ label: 'Téléphone', children: phone }),
              Field({ label: 'Mot de passe', required: true, children: pwd, hint: '8 caractères min.' }),
            ]),
            wilayaField,
            estabField,
            studentBlock,
            permBlock,
          ],
          actions: [cancel, save],
        });

        syncVisibility();
        cancel.addEventListener('click', () => m.close());

        save.addEventListener('click', async () => {
          const r = roleSel.value;
          if (!email.value.trim()) { toast('Email requis.', { tone: 'warn' }); return; }
          if (pwd.value.length < 8) { toast('Mot de passe : 8 caractères minimum.', { tone: 'warn' }); return; }
          if (['admin', 'teacher', 'student'].includes(r) && !estabSel.value) {
            toast('Établissement requis pour ce rôle.', { tone: 'warn' }); return;
          }
          if (r === 'direction' && !wilayaSel.value) {
            toast('Wilaya requise pour un compte de direction.', { tone: 'warn' }); return;
          }
          save.disabled = true;
          try {
            const perms = permBoxes
              .filter((x) => x.box.querySelector('input').checked)
              .map((x) => x.p.value);

            await createAccount({
              p_email: email.value.trim(),
              p_password: pwd.value,
              p_role: r,
              p_first_name: first.value.trim(),
              p_last_name: last.value.trim(),
              p_phone: phone.value.trim() || null,
              p_establishment_id: ['admin', 'teacher', 'student'].includes(r) ? estabSel.value : null,
              p_wilaya_id: r === 'direction' ? wilayaSel.value : null,
              p_student_number: r === 'student' ? (numberIn.value.trim() || null) : null,
              p_specialty_id: r === 'student' ? (specSel.value || null) : null,
              p_group_id: r === 'student' ? (groupSel.value || null) : null,
              p_program_id: r === 'student' ? (progSel.value || null) : null,
              p_training_mode_id: r === 'student' ? (modeSel.value || null) : null,
              p_permissions: perms.length ? perms : null,
            });
            toast('Compte créé.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Création impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      // ── Fiche d'un compte ──────────────────────────────────────────────
      async function openDetail(p) {
        let currentPerms = [];
        try { currentPerms = await listUserPermissions(p.id); } catch (_) { /* ignore */ }

        const statusSel = Select({
          value: p.status,
          options: Object.entries(USER_STATUS).map(([v, mm]) => ({ value: v, label: mm.label })),
        });
        const permBoxes = PERMISSIONS.map((perm) => ({
          perm,
          box: Checkbox({ label: perm.label, checked: currentPerms.includes(perm.value) }),
        }));

        const isSelf = p.id === profile.id;
        const save   = Button({ label: 'Enregistrer', icon: 'save', variant: 'primary', disabled: isSelf });
        const cancel = Button({ label: 'Fermer', variant: 'secondary' });
        const del    = Button({
          label: 'Supprimer', icon: 'trash', variant: 'danger',
          disabled: role !== 'ministry' || isSelf,
        });

        const m = Modal({
          title: fullName(p),
          subtitle: `${ROLES[p.role]?.label || p.role} · ${p.email}`,
          size: 'md',
          children: [
            isSelf && Notice({ tone: 'info' }, ['Vous ne pouvez pas modifier votre propre compte ici.']),
            h('dl', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: '13px', margin: 0 } }, [
              h('dt.mute', {}, ['Établissement']),
              h('dd', { style: { margin: 0 } }, [estabById.get(p.establishment_id)?.name || '—']),
              h('dt.mute', {}, ['Wilaya']),
              h('dd', { style: { margin: 0 } }, [
                p.wilayas ? `${p.wilayas.code} — ${p.wilayas.name}` : '—',
              ]),
              h('dt.mute', {}, ['Téléphone']),
              h('dd', { style: { margin: 0 } }, [p.phone || '—']),
              h('dt.mute', {}, ['Créé le']),
              h('dd', { style: { margin: 0 } }, [
                p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—',
              ]),
            ]),
            Field({ label: 'Statut du compte', children: statusSel }),
            p.role !== 'student' && h('div', {}, [
              h('div.kpi__label', { style: { marginBottom: 6 } }, ['Permissions complémentaires']),
              h('div', { style: { display: 'grid', gap: '6px' } }, permBoxes.map((x) => x.box)),
            ]),
          ].filter(Boolean),
          actions: [del, cancel, save],
        });

        cancel.addEventListener('click', () => m.close());

        save.addEventListener('click', async () => {
          save.disabled = true;
          try {
            if (statusSel.value !== p.status) {
              await setAccountStatus(p.id, statusSel.value);
            }
            if (p.role !== 'student') {
              const next = permBoxes
                .filter((x) => x.box.querySelector('input').checked)
                .map((x) => x.perm.value);
              const changed = next.length !== currentPerms.length
                || next.some((v) => !currentPerms.includes(v));
              if (changed) await setPermissions(p.id, next);
            }
            toast('Compte mis à jour.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            save.disabled = false;
            toast(err.message || 'Mise à jour impossible.', { tone: 'danger' });
          }
        });

        del.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'Supprimer le compte',
            message: `Le compte de ${fullName(p)} (${p.email}) sera définitivement supprimé, `
              + 'ainsi que son dossier académique.',
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          try {
            await deleteAccount(p.id);
            toast('Compte supprimé.', { tone: 'success' });
            m.close();
            reload();
          } catch (err) {
            toast(err.message || 'Suppression impossible.', { tone: 'danger' });
          }
        });

        m.open();
      }

      const pending = profiles.filter((p) => p.status === 'pending');

      const table = DataTable({
        rows: profiles,
        exportName: 'comptes',
        searchPlaceholder: 'Nom, email, établissement…',
        empty: 'Aucun compte dans votre périmètre.',
        emptyIcon: 'users',
        search: (r, q) => [fullName(r), r.email, estabById.get(r.establishment_id)?.name]
          .some((v) => String(v ?? '').toLowerCase().includes(q)),
        filters: [
          { key: 'role', label: 'Rôle', value: (r) => r.role,
            options: [{ value: '', label: 'Tous les rôles' },
              ...Object.entries(ROLES).map(([v, mm]) => ({ value: v, label: mm.label }))] },
          { key: 'status', label: 'Statut', value: (r) => r.status,
            options: [{ value: '', label: 'Tous' },
              ...Object.entries(USER_STATUS).map(([v, mm]) => ({ value: v, label: mm.label }))] },
          ...(role !== 'admin' ? [{
            key: 'establishment_id', label: 'Établissement', value: (r) => r.establishment_id || '',
            options: estabOptions('Tous les établissements'),
          }] : []),
        ],
        columns: [
          { key: 'name', label: 'Nom', value: fullName,
            render: (r) => h('div', {}, [
              h('div', { style: { fontWeight: 500 } }, [fullName(r)]),
              h('div.mono.small.mute', {}, [r.email || '—']),
            ]) },
          { key: 'role', label: 'Rôle', value: (r) => ROLES[r.role]?.label || r.role,
            render: (r) => Badge({ tone: 'outline', size: 'sm' }, [ROLES[r.role]?.label || r.role]) },
          { key: 'establishment', label: 'Rattachement',
            value: (r) => estabById.get(r.establishment_id)?.name
              || (r.wilayas ? `Wilaya ${r.wilayas.code}` : '—') },
          { key: 'created_at', label: 'Créé le',
            value: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '—',
            sortValue: (r) => r.created_at || '' },
          { key: 'status', label: 'Statut', value: (r) => USER_STATUS[r.status]?.label,
            render: (r) => StatusPill(USER_STATUS, r.status) },
        ],
        onRow: openDetail,
      });

      return [
        SectionHead(
          'Comptes et permissions',
          `${profiles.length} compte${profiles.length > 1 ? 's' : ''} dans votre périmètre`,
          canCreate.length
            ? Button({ label: 'Nouveau compte', icon: 'user-plus', variant: 'primary', onClick: openCreate })
            : null
        ),

        pending.length > 0 && Notice({ tone: 'warn', title: `${pending.length} compte(s) en attente` }, [
          'Des inscriptions attendent une validation. Ouvrez la fiche du compte pour l’activer ou la refuser.',
        ]),

        Notice({ tone: 'info', title: 'Contrôle d’accès' }, [
          'Chaque rôle ne voit que son périmètre : la restriction est appliquée par la base de '
          + 'données (RLS et fonctions), pas seulement par cette interface.',
        ]),

        table,
      ].filter(Boolean);
    },
  });
}
