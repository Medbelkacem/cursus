// Tableau de bord Ministère — vue nationale.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { Zellige } from '../../components/zellige.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getSupabase } from '../../lib/supabase.js';
import { KPI, Grid, EmptyBlock, CardSectionHead, ErrorBlock } from '../../lib/page-helpers.js';

export async function ministryDashboard() {
  const guard = requireAuth({ role: 'ministry' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let data = { directions: 0, establishments: 0, students: 0, teachers: 0, wilayas: 0, byType: [] };
  let err = null;
  if (sb) {
    try {
      const [dirs, ests, stu, tea, types] = await Promise.all([
        sb.from('directions').select('id', { count: 'exact', head: true }),
        sb.from('establishments').select('id, wilaya, type'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'active'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('status', 'active'),
        sb.from('establishments').select('type'),
      ]);
      const wilayaSet = new Set((ests.data || []).map((e) => e.wilaya).filter(Boolean));
      const typeCounts = {};
      (types.data || []).forEach((r) => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
      const byType = Object.entries(typeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
      data = {
        directions: dirs.count || 0,
        establishments: (ests.data || []).length,
        students: stu.count || 0,
        teachers: tea.count || 0,
        wilayas: wilayaSet.size,
        byType,
      };
    } catch (e) { err = e; }
  }

  const greeting = profile?.first_name ? `Bonjour, ${profile.first_name}` : 'Bienvenue';

  const hero = Card({ padding: 0, dark: true, style: { overflow: 'hidden', position: 'relative' } }, [
    (() => { const z = Zellige({ size: 360, opacity: 0.18, color: 'var(--c-paper)' }); z.style.top = '-60px'; z.style.insetInlineEnd = '-60px'; return z; })(),
    h('div', { style: { padding: 'var(--s-6)', position: 'relative', zIndex: 2 } }, [
      h('p.kicker', { style: { color: 'rgba(255,255,255,0.5)' } }, ['Couverture nationale']),
      h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--c-paper)', margin: 'var(--s-2) 0' } },
        [`${data.establishments} établissements · ${data.wilayas} wilayas`]),
      h('p', { style: { color: 'rgba(255,255,255,0.7)', margin: 0 } },
        [`${data.students.toLocaleString('fr-FR')} étudiants · ${data.teachers.toLocaleString('fr-FR')} professeurs`]),
      h('div', { style: { display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-5)' } }, [
        Button({ label: 'Directions', variant: 'inverse', href: '/ministere/directions', 'data-link': true }),
        Button({ label: 'Statistiques', variant: 'ghost', href: '/ministere/statistiques', 'data-link': true }),
      ]),
    ]),
  ]);

  const children = [
    err && ErrorBlock(err),
    Grid(4, 'var(--s-3)', [
      KPI('Directions', String(data.directions)),
      KPI('Établissements', String(data.establishments)),
      KPI('Étudiants', data.students.toLocaleString('fr-FR')),
      KPI('Professeurs', data.teachers.toLocaleString('fr-FR')),
    ]),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--s-4)', marginTop: 'var(--s-4)' } }, [
      hero,
      Card({ padding: 20 }, [
        CardSectionHead('Répartition par type', '/ministere/etablissements'),
        data.byType.length === 0
          ? EmptyBlock('Aucun établissement enregistré.', 'building')
          : h('div', {}, data.byType.slice(0, 8).map((row, i) => h('div', {
              style: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i ? '1px solid var(--c-line-soft)' : 'none' },
            }, [
              h('span', {}, [typeLabel(row.type)]),
              h('span.mono small', { class: 'mono small mute' }, [String(row.count)]),
            ]))),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('ministry'),
    active: t('nav.dashboard'),
    role: roleLabel('ministry'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: greeting,
    breadcrumb: 'Ministère · ' + (profile?.email || ''),
    children,
  });
}

function typeLabel(type) {
  return ({
    cfpa: 'CFPA', insfp: 'INSFP', ifpm: 'IFPM', iap: 'IAP', infs: 'INFS',
    paramedical: 'Paramédical', private: 'Privé', private_school: 'École privée',
    sectoral: 'Sectoriel', excellence: 'Excellence', distance: 'À distance',
    apprenticeship: 'Apprentissage', specialized_public: 'Spécialisé public',
    higher_pro_school: 'École supérieure', perfecting: 'Perfectionnement', other: 'Autre',
  })[type] || type;
}
