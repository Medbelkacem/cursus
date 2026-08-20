// CRUD des matières : nom + coefficient + spécialité + professeur (sélection).

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Field, Input, Select } from '../../components/input.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getApi } from '../../lib/api.js';
import { toast } from '../../components/toast.js';
import { EmptyBlock, ErrorBlock } from '../../lib/page-helpers.js';

export async function adminSubjectsPage() {
  const guard = requireAuth({ role: 'admin' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getApi();
  let subjects = [], specs = [], teachers = [], err = null;
  if (sb && profile?.establishment_id) {
    try {
      const [sub, sp, te] = await Promise.all([
        sb.from('subjects').select('id, name, coefficient, specialty_id, teacher_id, specialties(name), profiles!subjects_teacher_id_fkey(first_name, last_name)')
          .order('name'),
        sb.from('specialties').select('id, name').eq('establishment_id', profile.establishment_id).order('name'),
        sb.from('profiles').select('id, first_name, last_name, email')
          .eq('establishment_id', profile.establishment_id).eq('role', 'teacher').eq('status', 'active').order('last_name'),
      ]);
      subjects = sub.data || []; specs = sp.data || []; teachers = te.data || [];
    } catch (e) { err = e; }
  }

  const nameInput = Input({ placeholder: 'Algorithmique' });
  const coefInput = Input({ type: 'number', min: '0.5', step: '0.5', value: '1' });
  const specSel = Select({ options: [{ value: '', label: '— spécialité —' }, ...specs.map((s) => ({ value: s.id, label: s.name }))] });
  const teaSel = Select({ options: [{ value: '', label: '— non assigné —' }, ...teachers.map((p) => ({ value: p.id, label: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email }))] });

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 20 }, [
      h('h3.card__title', { style: { marginBottom: 12 } }, ['Nouvelle matière']),
      h('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 2fr auto', gap: 'var(--s-3)', alignItems: 'end' } }, [
        Field({ label: 'Nom', required: true, children: nameInput }),
        Field({ label: 'Coef.', children: coefInput }),
        Field({ label: 'Spécialité', required: true, children: specSel }),
        Field({ label: 'Professeur', children: teaSel }),
        Button({ label: 'Ajouter', icon: 'plus', variant: 'primary',
          onClick: async () => {
            if (!sb) return;
            if (!nameInput.value || !specSel.value) { toast('Champs requis manquants.', { tone: 'warn' }); return; }
            const r = await sb.from('subjects').insert({
              name: nameInput.value, coefficient: Number(coefInput.value),
              specialty_id: specSel.value, teacher_id: teaSel.value || null,
            });
            if (r.error) toast(r.error.message, { tone: 'danger' });
            else { toast('Matière ajoutée.', { tone: 'success' }); setTimeout(() => window.location.reload(), 500); }
          },
        }),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Matières enregistrées']),
        ]),
        subjects.length === 0
          ? EmptyBlock('Aucune matière.', 'book')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Matière']), h('th', {}, ['Spécialité']),
                h('th', {}, ['Coef.']), h('th', {}, ['Professeur']),
              ])]),
              h('tbody', {}, subjects.map((s) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [s.name]),
                h('td', {}, [s.specialties?.name || '—']),
                h('td', { class: 'mono' }, [String(s.coefficient)]),
                h('td', {}, [
                  s.profiles
                    ? `${s.profiles.first_name || ''} ${s.profiles.last_name || ''}`.trim()
                    : h('span.mute', {}, ['—']),
                ]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('admin'),
    active: t('nav.subjects'),
    role: roleLabel('admin'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Matières',
    breadcrumb: 'Administration · Matières',
    children,
  });
}
