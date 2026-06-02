// CRUD léger des spécialités d'un établissement.

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
import { EmptyBlock, ErrorBlock, fmtDate } from '../../lib/page-helpers.js';

export async function adminSpecialtiesPage() {
  const guard = requireAuth({ role: 'admin' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let specialties = [], err = null;
  if (sb && profile?.establishment_id) {
    const r = await sb.from('specialties').select('id, name, code, created_at')
      .eq('establishment_id', profile.establishment_id).order('name');
    if (r.error) err = r.error; else specialties = r.data || [];
  }

  const nameInput = Input({ placeholder: 'Informatique' });
  const codeInput = Input({ placeholder: 'INFO' });

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 20 }, [
      h('h3.card__title', { style: { marginBottom: 12 } }, ['Nouvelle spécialité']),
      h('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 'var(--s-3)', alignItems: 'end' } }, [
        Field({ label: 'Nom', required: true, children: nameInput }),
        Field({ label: 'Code', children: codeInput }),
        Button({ label: 'Ajouter', icon: 'plus', variant: 'primary',
          onClick: async () => {
            if (!sb || !profile?.establishment_id) return;
            if (!nameInput.value) { toast('Saisissez un nom.', { tone: 'warn' }); return; }
            const r = await sb.from('specialties').insert({
              name: nameInput.value, code: codeInput.value || null,
              establishment_id: profile.establishment_id,
            });
            if (r.error) toast(r.error.message, { tone: 'danger' });
            else { toast('Spécialité ajoutée.', { tone: 'success' }); setTimeout(() => window.location.reload(), 500); }
          },
        }),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Spécialités enregistrées']),
        ]),
        specialties.length === 0
          ? EmptyBlock('Aucune spécialité.', 'graduation')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Nom']), h('th', {}, ['Code']), h('th', {}, ['Créée le']), h('th', {}, ['']),
              ])]),
              h('tbody', {}, specialties.map((s) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [s.name]),
                h('td', { class: 'mono small mute' }, [s.code || '—']),
                h('td', { class: 'mono small mute' }, [fmtDate(s.created_at)]),
                h('td', {}, [
                  Button({ label: 'Supprimer', size: 'sm', variant: 'ghost',
                    onClick: async () => {
                      if (!confirm(`Supprimer la spécialité « ${s.name} » ?`)) return;
                      const r = await sb.from('specialties').delete().eq('id', s.id);
                      if (r.error) toast(r.error.message, { tone: 'danger' });
                      else { toast('Supprimée.', { tone: 'success' }); setTimeout(() => window.location.reload(), 400); }
                    },
                  }),
                ]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('admin'),
    active: t('nav.specialties'),
    role: roleLabel('admin'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Spécialités',
    breadcrumb: 'Administration · Spécialités',
    children,
  });
}
