import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select } from '../../components/input.js';
import { Badge } from '../../components/badge.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { toast } from '../../components/toast.js';
import { EmptyBlock, ErrorBlock } from '../../lib/page-helpers.js';

const ESTAB_TYPES = [
  'cfpa', 'insfp', 'ifpm', 'iap', 'infs',
  'paramedical', 'private', 'sectoral', 'excellence',
  'distance', 'apprenticeship', 'higher_pro_school', 'other',
];

export async function ministryEstablishmentsPage() {
  const guard = requireAuth({ role: 'ministry' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let all = [], directions = [], err = null;
  if (sb) {
    const [estabs, dirs] = await Promise.all([
      sb.from('establishments')
        .select('id, name, type, wilaya, contact_email, direction_id, directions(name)')
        .order('name'),
      sb.from('directions').select('id, name, wilaya').order('name'),
    ]);
    if (estabs.error) err = estabs.error;
    else all = estabs.data || [];
    if (!dirs.error) directions = dirs.data || [];
  }

  // ── Create form ───────────────────────────────────────────────────────────
  const nameInput  = Input({ placeholder: 'INSFP de Tipaza' });
  const typeAdd    = Select({ value: 'insfp', options: ESTAB_TYPES.map((v) => ({ value: v, label: v.toUpperCase() })) });
  const wilayaAdd  = Input({ placeholder: '42 — Tipaza' });
  const addressAdd = Input({ placeholder: 'Route nationale n°11, Tipaza' });
  const emailAdd   = Input({ type: 'email', placeholder: 'contact@insfp-tipaza.dz' });
  const phoneAdd   = Input({ type: 'tel', placeholder: '+213 …' });
  const dirAdd     = Select({
    value: '',
    options: [
      { value: '', label: '— sans direction de rattachement —' },
      ...directions.map((d) => ({ value: d.id, label: `${d.name}${d.wilaya ? ' · ' + d.wilaya : ''}` })),
    ],
  });
  const addBtn = Button({ label: 'Créer l’institut', icon: 'plus', variant: 'primary',
    onClick: async () => {
      if (!sb) return;
      if (!nameInput.value.trim()) { toast('Le nom est requis.', { tone: 'warn' }); return; }
      addBtn.disabled = true;
      const r = await sb.from('establishments').insert({
        name: nameInput.value.trim(),
        type: typeAdd.value,
        wilaya: wilayaAdd.value.trim() || null,
        address: addressAdd.value.trim() || null,
        contact_email: emailAdd.value.trim() || null,
        contact_phone: phoneAdd.value.trim() || null,
        direction_id: dirAdd.value || null,
      });
      addBtn.disabled = false;
      if (r.error) {
        toast(r.error.message, { tone: 'danger' });
      } else {
        toast('Institut créé.', { tone: 'success' });
        setTimeout(() => window.location.reload(), 500);
      }
    },
  });

  // ── "Create institute admin account" form ───────────────────────────────
  const acctEstabSel = Select({
    value: '',
    options: [
      { value: '', label: '— choisir un institut —' },
      ...all.map((e) => ({ value: e.id, label: `${e.name}${e.wilaya ? ' · ' + e.wilaya : ''}` })),
    ],
  });
  const acctFirst = Input({ placeholder: 'Ahmed' });
  const acctLast  = Input({ placeholder: 'Khelifi' });
  const acctEmail = Input({ type: 'email', placeholder: 'admin@insfp-tipaza.dz' });
  const acctPhone = Input({ type: 'tel', placeholder: '+213 …' });
  const acctPwd   = Input({ type: 'password', placeholder: '8 caractères min.' });
  const createAcctBtn = Button({
    label: 'Créer le compte', icon: 'user-plus', variant: 'primary',
    onClick: async () => {
      if (!sb) return;
      if (!acctEstabSel.value) { toast('Choisissez un institut.', { tone: 'warn' }); return; }
      if (!acctEmail.value.trim()) { toast('Email requis.', { tone: 'warn' }); return; }
      if ((acctPwd.value || '').length < 8) { toast('Mot de passe : 8 caractères min.', { tone: 'warn' }); return; }
      createAcctBtn.disabled = true;
      const { data, error } = await sb.rpc('admin_create_user', {
        p_email:            acctEmail.value.trim(),
        p_password:         acctPwd.value,
        p_role:             'admin',
        p_first_name:       acctFirst.value.trim(),
        p_last_name:        acctLast.value.trim(),
        p_phone:            acctPhone.value.trim() || null,
        p_establishment_id: acctEstabSel.value,
      });
      createAcctBtn.disabled = false;
      if (error) {
        toast(error.message, { tone: 'danger' });
      } else {
        toast(`Compte créé — ${acctEmail.value.trim()}`, { tone: 'success' });
        acctFirst.value = ''; acctLast.value = '';
        acctEmail.value = ''; acctPhone.value = '';
        acctPwd.value = '';
        acctEstabSel.value = '';
      }
    },
  });

  // ── Filter UI ─────────────────────────────────────────────────────────────
  const searchInput = Input({ placeholder: 'Rechercher par nom, wilaya…' });
  const typeSel = Select({ value: '', options: [
    { value: '', label: 'Tous les types' },
    ...ESTAB_TYPES.map((v) => ({ value: v, label: v.toUpperCase() })),
  ]});
  const tableMount = h('div');

  function render() {
    const q = searchInput.value.toLowerCase().trim();
    const list = all.filter((e) =>
      (!q || (e.name || '').toLowerCase().includes(q) || (e.wilaya || '').toLowerCase().includes(q))
      && (!typeSel.value || e.type === typeSel.value)
    );
    tableMount.replaceChildren();
    tableMount.appendChild(Card({ padding: 0 }, [
      h('div', { style: { padding: '12px 20px', borderBottom: '1px solid var(--c-line-soft)', fontSize: 13 } }, [
        h('span', { class: 'mono mute' }, [`${list.length} résultat${list.length > 1 ? 's' : ''}`]),
      ]),
      list.length === 0
        ? EmptyBlock('Aucun résultat.', 'building')
        : h('table.table', {}, [
            h('thead', {}, [h('tr', {}, [
              h('th', {}, ['Nom']), h('th', {}, ['Type']), h('th', {}, ['Wilaya']),
              h('th', {}, ['Direction']), h('th', {}, ['Contact']),
            ])]),
            h('tbody', {}, list.map((e) => h('tr', {}, [
              h('td', { style: { fontWeight: 500 } }, [e.name]),
              h('td', {}, [Badge({ tone: 'outline' }, [(e.type || '').toUpperCase()])]),
              h('td', { class: 'mono small mute' }, [e.wilaya || '—']),
              h('td', {}, [e.directions?.name || h('span.mute', {}, ['—'])]),
              h('td', { class: 'mono small' }, [e.contact_email || '—']),
            ]))),
          ]),
    ]));
  }
  searchInput.addEventListener('input', render);
  typeSel.addEventListener('change', render);
  render();

  const children = [
    err && ErrorBlock(err),

    // Create form
    Card({ padding: 20 }, [
      h('h3.card__title', { style: { marginBottom: 12 } }, ['Nouvel institut / établissement']),
      h('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 2fr',
          gap: 'var(--s-3)',
        },
      }, [
        Field({ label: 'Nom', required: true, children: nameInput }),
        Field({ label: 'Type', children: typeAdd }),
        Field({ label: 'Wilaya', children: wilayaAdd }),
        Field({ label: 'Direction de rattachement', children: dirAdd }),
      ]),
      h('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1fr auto',
          gap: 'var(--s-3)',
          alignItems: 'end',
          marginTop: 'var(--s-3)',
        },
      }, [
        Field({ label: 'Adresse', children: addressAdd }),
        Field({ label: 'Email', children: emailAdd }),
        Field({ label: 'Téléphone', children: phoneAdd }),
        addBtn,
      ]),
    ]),

    // Create institute administrator account
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 20 }, [
        h('h3.card__title', { style: { marginBottom: 4 } }, ["Créer un compte administrateur d'institut"]),
        h('p', { class: 'small mute', style: { marginBottom: 12 } }, [
          'Le compte est activé immédiatement. La personne pourra se connecter avec l’email + mot de passe ci-dessous et gérer son institut.',
        ]),
        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            gap: 'var(--s-3)',
            marginBottom: 'var(--s-3)',
          },
        }, [
          Field({ label: 'Institut', required: true, children: acctEstabSel }),
          Field({ label: 'Prénom', children: acctFirst }),
          Field({ label: 'Nom', children: acctLast }),
        ]),
        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1.5fr auto',
            gap: 'var(--s-3)',
            alignItems: 'end',
          },
        }, [
          Field({ label: 'Email', required: true, children: acctEmail }),
          Field({ label: 'Téléphone', children: acctPhone }),
          Field({ label: 'Mot de passe', required: true, children: acctPwd }),
          createAcctBtn,
        ]),
      ]),
    ]),

    // Filters
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 16 }, [
        h('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--s-3)' } }, [
          Field({ label: 'Recherche', children: searchInput }),
          Field({ label: 'Type', children: typeSel }),
        ]),
      ]),
    ]),

    // Table
    h('div', { style: { marginTop: 'var(--s-4)' } }, [tableMount]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('ministry'),
    active: t('nav.establishments'),
    role: roleLabel('ministry'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Établissements',
    breadcrumb: 'Ministère · Établissements',
    children,
  });
}
