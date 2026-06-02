import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input } from '../../components/input.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { toast } from '../../components/toast.js';
import { EmptyBlock, ErrorBlock } from '../../lib/page-helpers.js';

export async function ministryDirectionsPage() {
  const guard = requireAuth({ role: 'ministry' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let rows = [], err = null;
  if (sb) {
    const r = await sb.from('directions').select('id, name, wilaya, contact_email, contact_phone').order('name');
    if (r.error) err = r.error;
    else {
      const counts = await Promise.all((r.data || []).map(async (d) => {
        const c = await sb.from('establishments').select('id', { count: 'exact', head: true }).eq('direction_id', d.id);
        return { ...d, estabCount: c.count || 0 };
      }));
      rows = counts;
    }
  }

  const nameInput  = Input({ placeholder: 'Direction de la Formation Professionnelle de Batna' });
  const wilayaInput = Input({ placeholder: '05 — Batna' });
  const emailInput = Input({ type: 'email', placeholder: 'contact@dfp-batna.dz' });
  const phoneInput = Input({ type: 'tel', placeholder: '+213 …' });
  const addBtn = Button({ label: 'Créer la direction', icon: 'plus', variant: 'primary',
    onClick: async () => {
      if (!sb) return;
      if (!nameInput.value.trim()) { toast('Le nom est requis.', { tone: 'warn' }); return; }
      addBtn.disabled = true;
      const r = await sb.from('directions').insert({
        name: nameInput.value.trim(),
        wilaya: wilayaInput.value.trim() || null,
        contact_email: emailInput.value.trim() || null,
        contact_phone: phoneInput.value.trim() || null,
      });
      addBtn.disabled = false;
      if (r.error) {
        toast(r.error.message, { tone: 'danger' });
      } else {
        toast('Direction créée.', { tone: 'success' });
        setTimeout(() => window.location.reload(), 500);
      }
    },
  });

  // ── "Create direction admin account" form ────────────────────────────────
  const acctDirSel = () => {
    const sel = document.createElement('select');
    sel.className = 'input input--select';
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '— choisir une direction —';
    sel.appendChild(blank);
    for (const d of rows) {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = `${d.name}${d.wilaya ? ' · ' + d.wilaya : ''}`;
      sel.appendChild(o);
    }
    return sel;
  };
  const dirSel       = acctDirSel();
  const acctFirst    = Input({ placeholder: 'Ahmed' });
  const acctLast     = Input({ placeholder: 'Khelifi' });
  const acctEmail    = Input({ type: 'email', placeholder: 'responsable@dfp-batna.dz' });
  const acctPhone    = Input({ type: 'tel', placeholder: '+213 …' });
  const acctPwd      = Input({ type: 'password', placeholder: '8 caractères min.' });
  const createAcctBtn = Button({
    label: 'Créer le compte', icon: 'user-plus', variant: 'primary',
    onClick: async () => {
      if (!sb) return;
      if (!dirSel.value) { toast('Choisissez une direction.', { tone: 'warn' }); return; }
      if (!acctEmail.value.trim()) { toast('Email requis.', { tone: 'warn' }); return; }
      if ((acctPwd.value || '').length < 8) { toast('Mot de passe : 8 caractères min.', { tone: 'warn' }); return; }
      createAcctBtn.disabled = true;
      const { data, error } = await sb.rpc('admin_create_user', {
        p_email:        acctEmail.value.trim(),
        p_password:     acctPwd.value,
        p_role:         'direction',
        p_first_name:   acctFirst.value.trim(),
        p_last_name:    acctLast.value.trim(),
        p_phone:        acctPhone.value.trim() || null,
        p_direction_id: dirSel.value,
      });
      createAcctBtn.disabled = false;
      if (error) {
        toast(error.message, { tone: 'danger' });
      } else {
        toast(`Compte créé — ${acctEmail.value.trim()}`, { tone: 'success' });
        acctFirst.value = ''; acctLast.value = '';
        acctEmail.value = ''; acctPhone.value = '';
        acctPwd.value = '';
        dirSel.value = '';
      }
    },
  });

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 20 }, [
      h('h3.card__title', { style: { marginBottom: 12 } }, ['Nouvelle direction régionale']),
      h('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 2fr 1.5fr auto',
          gap: 'var(--s-3)',
          alignItems: 'end',
        },
      }, [
        Field({ label: 'Nom', required: true, children: nameInput }),
        Field({ label: 'Wilaya', children: wilayaInput }),
        Field({ label: 'Email de contact', children: emailInput }),
        Field({ label: 'Téléphone', children: phoneInput }),
        addBtn,
      ]),
    ]),

    // Create direction administrator account
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 20 }, [
        h('h3.card__title', { style: { marginBottom: 4 } }, ['Créer un compte responsable de direction']),
        h('p.small mute', { class: 'small mute', style: { marginBottom: 12 } }, [
          'Le compte est activé immédiatement. La personne pourra se connecter avec l’email + mot de passe ci-dessous.',
        ]),
        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            gap: 'var(--s-3)',
            marginBottom: 'var(--s-3)',
          },
        }, [
          Field({ label: 'Direction', required: true, children: dirSel }),
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

    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, [`${rows.length} direction${rows.length > 1 ? 's' : ''}`]),
        ]),
        rows.length === 0
          ? EmptyBlock('Aucune direction enregistrée.', 'building')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Nom']), h('th', {}, ['Wilaya']),
                h('th', {}, ['Établissements']), h('th', {}, ['Contact']),
              ])]),
              h('tbody', {}, rows.map((d) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [d.name]),
                h('td', { class: 'mono small mute' }, [d.wilaya || '—']),
                h('td', { class: 'mono' }, [String(d.estabCount)]),
                h('td', { class: 'mono small' }, [
                  d.contact_email || '—',
                  d.contact_phone ? ` · ${d.contact_phone}` : '',
                ]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('ministry'),
    active: t('nav.directions'),
    role: roleLabel('ministry'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Directions régionales',
    breadcrumb: 'Ministère · Directions',
    children,
  });
}
