// Supports de cours visibles par l'étudiant — groupés par matière. Téléchargement via lien signé.

import { h } from '../../lib/dom.js';
import { t } from '../../lib/i18n.js';
import { requireAuth } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { AppShell } from '../../components/layout.js';
import { Card } from '../../components/card.js';
import { Button } from '../../components/button.js';
import { navFor, roleLabel, initialsOf } from '../../lib/nav.js';
import { getApi } from '../../lib/api.js';
import { toast } from '../../components/toast.js';
import { EmptyBlock, ErrorBlock, fmtDate } from '../../lib/page-helpers.js';

export async function studentCoursesPage() {
  const guard = requireAuth({ role: 'student' });
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }
  const { profile, user } = guard.state;

  const sb = getApi();
  let items = [], err = null;
  if (sb) {
    try {
      // Récupère la spécialité de l'étudiant pour filtrer.
      const meRes = await sb.from('students').select('specialty_id').eq('profile_id', user.id).maybeSingle();
      const specId = meRes.data?.specialty_id;
      if (!specId) items = [];
      else {
        const r = await sb.from('courses')
          .select('id, title, description, file_path, file_name, file_size, created_at, subject_id, subjects!inner(name, specialty_id)')
          .eq('subjects.specialty_id', specId).order('created_at', { ascending: false });
        items = r.data || [];
      }
    } catch (e) { err = e; }
  }

  // Regroupement par matière.
  const groups = new Map();
  items.forEach((it) => {
    const key = it.subjects?.name || '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });

  async function downloadOne(path, name) {
    if (!sb) return;
    const r = await sb.storage.from('course-materials').createSignedUrl(path, 60);
    if (r.error) { toast(r.error.message, { tone: 'danger' }); return; }
    const a = document.createElement('a');
    a.href = r.data.signedUrl;
    a.download = name || '';
    document.body.appendChild(a); a.click(); a.remove();
  }

  const sections = Array.from(groups.entries()).map(([subject, list]) =>
    Card({ padding: 0 }, [
      h('div', { style: { padding: '16px 20px', borderBottom: '1px solid var(--c-line-soft)' } }, [
        h('h3.card__title', {}, [subject]),
        h('span.mono small mute', { class: 'mono small mute' }, [`${list.length} support${list.length > 1 ? 's' : ''}`]),
      ]),
      h('table.table', {}, [
        h('thead', {}, [h('tr', {}, [
          h('th', {}, ['Titre']), h('th', {}, ['Fichier']), h('th', {}, ['Déposé le']), h('th', {}, ['']),
        ])]),
        h('tbody', {}, list.map((it) => h('tr', {}, [
          h('td', { style: { fontWeight: 500 } }, [it.title]),
          h('td', { class: 'mono small mute' }, [
            it.file_name || '—',
            it.file_size ? ` · ${(it.file_size / 1024 / 1024).toFixed(1)} Mo` : '',
          ]),
          h('td', { class: 'mono small mute' }, [fmtDate(it.created_at)]),
          h('td', {}, [
            it.file_path && Button({ label: 'Télécharger', size: 'sm', variant: 'ghost', icon: 'download',
              onClick: () => downloadOne(it.file_path, it.file_name),
            }),
          ]),
        ]))),
      ]),
    ])
  );

  const children = [
    err && ErrorBlock(err),
    sections.length === 0
      ? EmptyBlock('Aucun support de cours n\'est disponible pour le moment.', 'book')
      : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } }, sections),
  ].filter(Boolean);

  return AppShell({
    nav: navFor('student'),
    active: t('nav.courses'),
    role: roleLabel('student'),
    user: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), initials: initialsOf(profile) },
    title: 'Cours',
    breadcrumb: 'Étudiant · Cours',
    children,
  });
}
