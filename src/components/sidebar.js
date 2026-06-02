// Barre latérale — navigation principale des dashboards.
// Reçoit : { items: [{ label, icon, path, badge? }], active, role }.

import { h } from '../lib/dom.js';
import { Icon } from './icon.js';
import { Wordmark } from './wordmark.js';
import { navigate } from '../lib/router.js';

export function Sidebar(opts = {}) {
  const { items = [], active, role, footer } = opts;

  return h('aside.sidebar', { id: 'app-sidebar', 'aria-label': 'Navigation principale' }, [
    h('div.sidebar__head', {}, [
      Wordmark({ size: 'sm', linked: true }),
      role && h('span.sidebar__role mono', { class: 'sidebar__role mono' }, [role]),
    ]),
    h('nav.sidebar__nav', { 'aria-label': 'Sections' },
      items.map((it) => h(
        'a.sidebar__link' + (it.label === active ? '.is-active' : ''),
        {
          href: it.path,
          'data-link': '',
          'aria-current': it.label === active ? 'page' : null,
          onClick: it.onClick,
        },
        [
          Icon(it.icon || 'dashboard', { size: 16 }),
          h('span.sidebar__label', {}, [it.label]),
          it.badge != null && h('span.sidebar__badge', {}, [String(it.badge)]),
        ].filter(Boolean)
      ))
    ),
    footer && h('div.sidebar__foot', {}, [footer]),
  ].filter(Boolean));
}
