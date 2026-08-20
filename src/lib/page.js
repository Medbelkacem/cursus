// ─────────────────────────────────────────────────────────────────────────────
//  Fabrique de pages authentifiées — garde d'accès + AppShell + cloche de
//  notifications.  Évite de répéter le même préambule dans chaque écran.
// ─────────────────────────────────────────────────────────────────────────────

import { h } from './dom.js';
import { requireAuth } from './auth.js';
import { navigate } from './router.js';
import { AppShell } from '../components/layout.js';
import { Icon } from '../components/icon.js';
import { navFor, roleLabel, initialsOf } from './nav.js';
import { ErrorBlock } from './page-helpers.js';
import { countUnread } from './db.js';

// Cloche : compte les notifications non lues et mène à la page dédiée.
function Bell() {
  const dot = h('span.bell__dot', { hidden: true }, ['0']);
  const btn = h('a.bell', {
    href: '/notifications', 'data-link': '', 'aria-label': 'Notifications',
  }, [Icon('bell', { size: 17 }), dot]);

  countUnread()
    .then((n) => {
      if (!n) return;
      dot.hidden = false;
      dot.textContent = n > 99 ? '99+' : String(n);
      btn.setAttribute('aria-label', `Notifications — ${n} non lue${n > 1 ? 's' : ''}`);
    })
    .catch(() => { /* silencieux : la cloche reste neutre */ });

  return btn;
}

/**
 * @param {object} opts
 *  - role        rôle requis (string | string[]) ; omis = tout compte actif
 *  - title       titre de la page
 *  - breadcrumb  fil d'ariane
 *  - active      libellé de l'entrée de navigation active
 *  - build       async ({ profile, state }) => Node[] — le contenu
 *  - actions     nœuds additionnels dans la topbar
 */
export async function protectedPage(opts = {}) {
  const { role, title, breadcrumb, active, build, actions } = opts;

  const guard = requireAuth(role ? { role } : {});
  if (!guard.ok) { navigate(guard.redirect); return h('div'); }

  const { profile } = guard.state;

  let children;
  try {
    children = await build({ profile, state: guard.state });
  } catch (err) {
    console.error('[page]', err);
    children = [ErrorBlock(err)];
  }

  return AppShell({
    nav: navFor(profile?.role),
    active,
    role: roleLabel(profile?.role),
    user: {
      name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.email,
      initials: initialsOf(profile),
    },
    title,
    breadcrumb,
    actions: [Bell(), ...(actions ? (Array.isArray(actions) ? actions : [actions]) : [])],
    children: Array.isArray(children) ? children : [children],
  });
}

// Bloc de chargement générique — remplacé une fois les données arrivées.
export function Loading(label = 'Chargement…') {
  return h('div.empty', {}, [
    h('div.empty__ico', {}, [Icon('refresh', { size: 20 })]),
    h('p.empty__msg', {}, [label]),
  ]);
}
