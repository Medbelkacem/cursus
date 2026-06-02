// Tableau de bord administration — utilisateurs en attente, demandes de documents,
// effectifs et nombre de matières.

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
import { KPI, Grid, EmptyBlock, CardSectionHead, StatusBadge, fmtDate, ErrorBlock } from '../../lib/page-helpers.js';

export async function adminDashboard() {
  const guard = requireAuth({ role: 'admin' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile } = guard.state;

  const sb = getSupabase();
  let data = { pendingUsers: [], pendingDocs: [], studentCount: 0, teacherCount: 0, subjectCount: 0, specialtyCount: 0 };
  let err = null;
  if (sb) {
    try {
      const [pUsers, pDocs, stu, tea, sub, spe] = await Promise.all([
        sb.from('profiles').select('id, first_name, last_name, email, role, created_at')
          .eq('status', 'pending').order('created_at', { ascending: false }).limit(6),
        sb.from('document_requests').select('id, document_type, status, requested_at, student_id, profiles!document_requests_student_id_fkey(first_name, last_name, email)')
          .eq('status', 'pending').order('requested_at', { ascending: false }).limit(6),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'active'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('status', 'active'),
        sb.from('subjects').select('id', { count: 'exact', head: true }),
        sb.from('specialties').select('id', { count: 'exact', head: true }),
      ]);
      data = {
        pendingUsers: pUsers.data || [],
        pendingDocs: pDocs.data || [],
        studentCount: stu.count || 0,
        teacherCount: tea.count || 0,
        subjectCount: sub.count || 0,
        specialtyCount: spe.count || 0,
      };
    } catch (e) { err = e; }
  }

  const greeting = profile?.first_name ? `Bonjour, ${profile.first_name}` : 'Bienvenue';

  const hero = (data.pendingUsers.length > 0 || data.pendingDocs.length > 0)
    ? attentionHero(data.pendingUsers.length, data.pendingDocs.length)
    : Card({ padding: 24 }, [
        h('p.kicker', {}, ['Tout est à jour']),
        h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, margin: '8px 0' } }, ['Aucune action en attente.']),
        h('p.mute', {}, ['Quand de nouveaux comptes ou des demandes arriveront, vous les verrez ici.']),
      ]);

  const children = [
    err && ErrorBlock(err),
    Grid(4, 'var(--s-3)', [
      KPI('Étudiants actifs', String(data.studentCount)),
      KPI('Professeurs', String(data.teacherCount)),
      KPI('Spécialités', String(data.specialtyCount)),
      KPI('Matières', String(data.subjectCount)),
    ]),

    h('div', { style: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--s-4)', marginTop: 'var(--s-4)' } }, [
      hero,
      Card({ padding: 20 }, [
        CardSectionHead('Comptes en attente', '/administration/utilisateurs'),
        data.pendingUsers.length === 0
          ? EmptyBlock('Aucun compte en attente.', 'users')
          : h('div', {}, data.pendingUsers.map((u, i) => h('div', {
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--c-line-soft)' : 'none' },
            }, [
              h('div', {}, [
                h('div', { style: { fontSize: 13, fontWeight: 500 } }, [
                  `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
                ]),
                h('div', { class: 'mono small mute' }, [`${roleLabel(u.role)} · ${fmtDate(u.created_at)}`]),
              ]),
              StatusBadge('pending'),
            ]))),
      ]),
    ]),

    h('div', { style: { marginTop: 'var(--s-4)' } }, [
      Card({ padding: 0 }, [
        h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
          h('h3.card__title', {}, ['Demandes de documents']),
          Button({ label: 'Voir toutes', size: 'sm', variant: 'ghost', href: '/administration/demandes', 'data-link': true }),
        ]),
        data.pendingDocs.length === 0
          ? EmptyBlock('Aucune demande en attente.', 'file')
          : h('table.table', {}, [
              h('thead', {}, [h('tr', {}, [
                h('th', {}, ['Étudiant']),
                h('th', {}, ['Document']),
                h('th', {}, ['Date']),
                h('th', {}, ['Statut']),
              ])]),
              h('tbody', {}, data.pendingDocs.map((d) => h('tr', {}, [
                h('td', {}, [
                  `${d.profiles?.first_name || ''} ${d.profiles?.last_name || ''}`.trim() || d.profiles?.email || '—',
                ]),
                h('td', {}, [docTypeLabel(d.document_type)]),
                h('td', { class: 'mono small mute' }, [fmtDate(d.requested_at)]),
                h('td', {}, [StatusBadge(d.status)]),
              ]))),
            ]),
      ]),
    ]),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('admin'),
    active: t('nav.dashboard'),
    role: roleLabel('admin'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: greeting,
    breadcrumb: 'Administration · ' + (profile?.email || ''),
    children,
  });
}

function attentionHero(nUsers, nDocs) {
  const total = nUsers + nDocs;
  return Card({ padding: 0, dark: true, style: { overflow: 'hidden', position: 'relative' } }, [
    (() => { const z = Zellige({ size: 360, opacity: 0.18, color: 'var(--c-paper)' }); z.style.top = '-60px'; z.style.insetInlineEnd = '-60px'; return z; })(),
    h('div', { style: { padding: 'var(--s-6)', position: 'relative', zIndex: 2 } }, [
      h('p.kicker', { style: { color: 'rgba(255,255,255,0.5)' } }, ['Actions en attente']),
      h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--c-paper)', margin: 'var(--s-2) 0' } },
        [`${total} action${total > 1 ? 's' : ''} à traiter`]),
      h('p', { style: { color: 'rgba(255,255,255,0.7)', margin: 0 } }, [
        `${nUsers} compte${nUsers > 1 ? 's' : ''} à valider · ${nDocs} demande${nDocs > 1 ? 's' : ''} de documents`,
      ]),
      h('div', { style: { display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-5)' } }, [
        Button({ label: 'Valider comptes', variant: 'inverse', href: '/administration/utilisateurs', 'data-link': true }),
        Button({ label: 'Traiter demandes', variant: 'ghost', href: '/administration/demandes', 'data-link': true }),
      ]),
    ]),
  ]);
}

function docTypeLabel(type) {
  return {
    attestation_scolarite: 'Attestation de scolarité',
    releve_notes: 'Relevé de notes',
    attestation_inscription: 'Attestation d\'inscription',
    attestation_reussite: 'Attestation de réussite',
    autre: 'Autre',
  }[type] || type;
}
