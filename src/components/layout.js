// App-shell pour les écrans authentifiés : Sidebar + Topbar + main.

import { h } from '../lib/dom.js';
import { Sidebar } from './sidebar.js';
import { Topbar } from './topbar.js';

export function AppShell(opts = {}) {
  const { nav, active, role, user, title, breadcrumb, actions, search, children } = opts;

  return h('div.shell', {}, [
    Sidebar({ items: nav, active, role }),
    h('main.shell__main', { id: 'main-content', role: 'main', tabindex: '-1' }, [
      Topbar({ title, breadcrumb, actions, search, user }),
      h('div.shell__content', {}, Array.isArray(children) ? children : [children]),
    ]),
  ]);
}
