import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { EmptyBlock, ErrorBlock, fmtDate } from '../../lib/page-helpers.js';

export async function directionEstablishmentsPage() {
  const guard = requireAuth({ role: 'direction' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let rows = [], err = null;
  if (sb) {
    const r = await sb.from('establishments')
      .select('id, name, type, wilaya, address, contact_email, contact_phone, created_at')
      .eq('direction_id', profile?.direction_id).order('name');
    if (r.error) err = r.error; else rows = r.data || [];
  }

  const children = [
    err && ErrorBlock(err),
    Card({ padding: 0 }, [
      h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
        h('h3.card__title', {}, [`${rows.length} établissement${rows.length > 1 ? 's' : ''}`]),
      ]),
      rows.length === 0
        ? EmptyBlock('Aucun établissement rattaché.', 'building')
        : h('table.table', {}, [
            h('thead', {}, [h('tr', {}, [
              h('th', {}, ['Nom']), h('th', {}, ['Type']), h('th', {}, ['Wilaya']),
              h('th', {}, ['Contact']), h('th', {}, ['Inscrit le']),
            ])]),
            h('tbody', {}, rows.map((e) => h('tr', {}, [
              h('td', { style: { fontWeight: 500 } }, [e.name]),
              h('td', { class: 'mono small mute' }, [e.type]),
              h('td', { class: 'mono small mute' }, [e.wilaya || '—']),
              h('td', { class: 'mono small' }, [
                e.contact_email || '—',
                e.contact_phone ? ` · ${e.contact_phone}` : '',
              ]),
              h('td', { class: 'mono small mute' }, [fmtDate(e.created_at)]),
            ]))),
          ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('direction'),
    active: t('nav.establishments'),
    role: roleLabel('direction'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Établissements',
    breadcrumb: 'Direction · Établissements',
    children,
  });
}
