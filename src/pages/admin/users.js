// Validation des comptes : liste filtrable par statut, boutons Valider / Refuser.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Select } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { toast } from '../../components/toast.js';
import { EmptyBlock, ErrorBlock, fmtDate, StatusBadge } from '../../lib/page-helpers.js';

export async function adminUsersPage() {
  const guard = requireAuth({ role: 'admin' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  const filterSel = Select({ value: 'pending', options: [
    { value: 'pending', label: 'En attente' },
    { value: 'active',  label: 'Actifs' },
    { value: 'rejected', label: 'Refusés' },
    { value: '', label: 'Tous' },
  ]});
  const roleSel = Select({ value: '', options: [
    { value: '', label: 'Tous les rôles' },
    { value: 'student', label: 'Étudiants' },
    { value: 'teacher', label: 'Professeurs' },
  ]});
  const tableMount = h('div');

  async function reload() {
    tableMount.replaceChildren();
    if (!sb) return;
    let q = sb.from('profiles')
      .select('id, first_name, last_name, email, phone, role, status, created_at')
      .eq('establishment_id', profile?.establishment_id)
      .order('created_at', { ascending: false });
    if (filterSel.value) q = q.eq('status', filterSel.value);
    if (roleSel.value)   q = q.eq('role',   roleSel.value);
    const r = await q;
    if (r.error) { tableMount.appendChild(ErrorBlock(r.error)); return; }
    const list = r.data || [];
    tableMount.appendChild(Card({ padding: 0 }, [
      list.length === 0
        ? EmptyBlock('Aucun utilisateur ne correspond aux filtres.', 'users')
        : h('table.table', {}, [
            h('thead', {}, [h('tr', {}, [
              h('th', {}, ['Nom']), h('th', {}, ['E-mail']), h('th', {}, ['Rôle']),
              h('th', {}, ['Inscription']), h('th', {}, ['Statut']), h('th', {}, ['Actions']),
            ])]),
            h('tbody', {}, list.map((u) => {
              const row = h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [
                  `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—',
                ]),
                h('td', { class: 'mono small' }, [u.email || '—']),
                h('td', {}, [Badge({ tone: 'outline' }, [roleLabel(u.role)])]),
                h('td', { class: 'mono small mute' }, [fmtDate(u.created_at)]),
                h('td', {}, [StatusBadge(u.status)]),
                h('td', {}, [
                  h('div', { style: { display: 'flex', gap: 6 } }, [
                    u.status !== 'active' && Button({ label: 'Valider', size: 'sm', variant: 'primary',
                      onClick: () => updateStatus(u.id, 'active'),
                    }),
                    u.status !== 'rejected' && Button({ label: 'Refuser', size: 'sm', variant: 'ghost',
                      onClick: () => updateStatus(u.id, 'rejected'),
                    }),
                  ].filter(Boolean)),
                ]),
              ]);
              return row;
            })),
          ]),
    ]));
  }

  async function updateStatus(id, status) {
    const r = await sb.from('profiles').update({ status }).eq('id', id);
    if (r.error) toast(r.error.message, { tone: 'danger' });
    else { toast('Statut mis à jour.', { tone: 'success' }); reload(); }
  }

  filterSel.addEventListener('change', reload);
  roleSel.addEventListener('change', reload);
  await reload();

  const children = [
    Card({ padding: 16 }, [
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' } }, [
        Field({ label: 'Statut', children: filterSel }),
        Field({ label: 'Rôle',   children: roleSel }),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [tableMount]),
  ];

  return AppShell({
    nav: navFor('admin'),
    active: t('nav.users'),
    role: roleLabel('admin'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Utilisateurs',
    breadcrumb: 'Administration · Utilisateurs',
    children,
  });
}
