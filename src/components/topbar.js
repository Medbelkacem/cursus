// Barre supérieure — titre de page + breadcrumb + actions (langue, thème, profil).

import { h } from '../lib/dom.js';
import { Icon } from './icon.js';
import { LangSwitcher, ThemeToggle } from './lang-theme.js';

const SIDEBAR_SEL = '.sidebar';

function ensureBackdrop() {
  let bd = document.querySelector('.sidebar-backdrop');
  if (bd) return bd;
  bd = document.createElement('div');
  bd.className = 'sidebar-backdrop';
  bd.setAttribute('aria-hidden', 'true');
  bd.addEventListener('click', () => closeSidebar());
  document.body.appendChild(bd);
  return bd;
}

function syncMenuState() {
  const open = document.body.classList.contains('sidebar-open');
  const btn = document.querySelector('.topbar__menu');
  const aside = document.querySelector(SIDEBAR_SEL);
  if (btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  }
  // Sur desktop le sidebar est toujours visible — on n'applique aria-hidden
  // qu'en mobile (≤980px) pour ne pas masquer la nav aux lecteurs d'écran.
  if (aside) {
    const isMobile = window.matchMedia('(max-width: 980px)').matches;
    if (isMobile) aside.setAttribute('aria-hidden', open ? 'false' : 'true');
    else aside.removeAttribute('aria-hidden');
  }
}

function openSidebar() {
  document.body.classList.add('sidebar-open');
  syncMenuState();
  // Donne le focus au premier lien navigable pour les utilisateurs clavier
  const first = document.querySelector('.sidebar__nav a');
  if (first) first.focus();
}

function closeSidebar() {
  if (!document.body.classList.contains('sidebar-open')) return;
  document.body.classList.remove('sidebar-open');
  syncMenuState();
  const btn = document.querySelector('.topbar__menu');
  if (btn) btn.focus();
}

function toggleSidebar() {
  if (document.body.classList.contains('sidebar-open')) closeSidebar();
  else openSidebar();
}

// Initialisation unique des listeners globaux
if (typeof document !== 'undefined' && !document.body.dataset.sidebarInit) {
  document.body.dataset.sidebarInit = '1';

  // Fermer après navigation
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (a && document.body.classList.contains('sidebar-open')) closeSidebar();
  });

  // Echap ferme le menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
      e.preventDefault();
      closeSidebar();
    }
  });

  // Resync sur resize (passage mobile ↔ desktop)
  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 980px)').matches) {
      document.body.classList.remove('sidebar-open');
    }
    syncMenuState();
  });
}

export function Topbar(opts = {}) {
  const { title, breadcrumb, actions, search = false, user } = opts;
  ensureBackdrop();

  const node = h('header.topbar', { role: 'banner' }, [
    h('button.topbar__menu', {
      type: 'button',
      'aria-label': 'Ouvrir le menu',
      'aria-expanded': 'false',
      'aria-controls': 'app-sidebar',
      onClick: toggleSidebar,
    }, [Icon('menu', { size: 18 })]),

    h('div.topbar__title', {}, [
      breadcrumb && h('div.topbar__crumb mono', { class: 'topbar__crumb mono' }, [breadcrumb]),
      title && h('h1.topbar__h1', {}, [title]),
    ].filter(Boolean)),

    h('div.topbar__actions', {}, [
      search && h('div.topbar__search', { role: 'search' }, [
        Icon('search', { size: 16 }),
        h('input', { type: 'search', placeholder: 'Rechercher…', 'aria-label': 'Rechercher' }),
      ]),
      ...(actions ? (Array.isArray(actions) ? actions : [actions]) : []),
      LangSwitcher({ variant: 'compact' }),
      ThemeToggle(),
      user && h('a.topbar__user', {
        href: '/profil', 'data-link': '',
        'aria-label': `Profil de ${user.name || 'l’utilisateur'}`,
      }, [
        h('span.avatar', { 'aria-hidden': 'true' }, [user.initials || '?']),
        h('span.topbar__user-name', {}, [user.name || '']),
      ]),
    ].filter(Boolean)),
  ]);

  // Synchroniser l'état ARIA après l'insertion dans le DOM
  queueMicrotask(syncMenuState);
  return node;
}
