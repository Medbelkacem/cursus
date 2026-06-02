// Tableau de bord Direction — supervise les établissements de sa zone.

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

const TYPE_LABELS = {
  cfpa: 'CFPA', insfp: 'INSFP', ifpm: 'IFPM', iap: 'IAP', infs: 'INFS',
  paramedical: 'Paramédical', private: 'Privé', private_school: 'École privée',
  sectoral: 'Sectoriel', excellence: 'Excellence', distance: 'À distance',
  apprenticeship: 'Apprentissage', specialized_public: 'Spécialisé public',
  higher_pro_school: 'École supérieure', perfecting: 'Perfectionnement', other: 'Autre',
};

export async function directionDashboard() {
  const guard = requireAuth({ role: 'direction' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let data = { establishments: [], totalStudents: 0, totalTeachers: 0, pendingAccounts: 0 };
  let err = null;
  if (sb) {
    try {
      const dirId = profile?.direction_id;
      const estab = await sb.from('establishments')
        .select('id, name, type, wilaya, contact_email')
        .eq('direction_id', dirId).order('name');
      const ids = (estab.data || []).map((e) => e.id);
      const [stu, tea, pAcc] = ids.length
        ? await Promise.all([
            sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'active').in('establishment_id', ids),
            sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('status', 'active').in('establishment_id', ids),
            sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('establishment_id', ids),
          ])
        : [{ count: 0 }, { count: 0 }, { count: 0 }];
      data = {
        establishments: estab.data || [],
        totalStudents: stu.count || 0,
        totalTeachers: tea.count || 0,
        pendingAccounts: pAcc.count || 0,
      };
    } catch (e) { err = e; }
  }

  const greeting = profile?.first_name ? `Bonjour, ${profile.first_name}` : 'Bienvenue';

  const hero = Card({ padding: 0, dark: true, style: { overflow: 'hidden', position: 'relative' } }, [
    (() => { const z = Zellige({ size: 360, opacity: 0.18, color: 'var(--c-paper)' }); z.style.top = '-60px'; z.style.insetInlineEnd = '-60px'; return z; })(),
    h('div', { style: { padding: 'var(--s-6)', position: 'relative', zIndex: 2 } }, [
      h('p.kicker', { style: { color: 'rgba(255,255,255,0.5)' } }, ['Votre périmètre']),
      h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--c-paper)', margin: 'var(--s-2) 0' } },
        [`${data.establishments.length} établissement${data.establishments.length > 1 ? 's' : ''}`]),
      h('p', { style: { color: 'rgba(255,255,255,0.7)', margin: 0 } },
        [`${data.totalStudents} étudiants · ${data.totalTeachers} professeurs`]),
      h('div', { style: { marginTop: 'var(--s-5)' } }, [
        Button({ label: 'Voir les établissements', variant: 'inverse', href: '/direction/etablissements', 'data-link': true }),
      ]),
    ]),
  ]);

  const children = [
    err && ErrorBlock(err),
    Grid(4, 'var(--s-3)', [
      KPI('Établissements', String(data.establishments.length)),
      KPI('Étudiants', String(data.totalStudents)),
      KPI('Professeurs', String(data.totalTeachers)),
      KPI('Comptes en attente', String(data.pendingAccounts), '', data.pendingAccounts ? 'à valider' : null),
    ]),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--s-4)', marginTop: 'var(--s-4)' } }, [
      hero,
      Card({ padding: 20 }, [
        CardSectionHead('Statistiques', '/direction/statistiques'),
        h('p.mute', {}, ['Effectifs, taux de présence et moyenne globale sont consultables dans la section statistiques.']),
      ]),
    ]),
    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
          h('h3.card__title', {}, ['Établissements rattachés']),
        ]),
        data.establishments.length === 0
          ? EmptyBlock('Aucun établissement n\'est rattaché à votre direction.', 'building')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Nom']),
                h('th', {}, ['Type']),
                h('th', {}, ['Wilaya']),
                h('th', {}, ['Contact']),
              ])]),
              h('tbody', {}, data.establishments.map((e) => h('tr', {}, [
                h('td', { style: { fontWeight: 500 } }, [e.name]),
                h('td', { class: 'mono small mute' }, [TYPE_LABELS[e.type] || e.type]),
                h('td', { class: 'mono small mute' }, [e.wilaya || '—']),
                h('td', { class: 'mono small mute' }, [e.contact_email || '—']),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('direction'),
    active: t('nav.dashboard'),
    role: roleLabel('direction'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: greeting,
    breadcrumb: 'Direction · ' + (profile?.email || ''),
    children,
  });
}
