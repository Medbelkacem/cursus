// Mise en page partagée des écrans d'authentification.
// Colonne de gauche illustrée (carte sombre + zellige), colonne de droite formulaire.

import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { Wordmark } from '../components/wordmark.js';
import { LangSwitcher, ThemeToggle } from '../components/lang-theme.js';
import { Zellige } from '../components/zellige.js';

export function authShell({ form, side }) {
  return h('div.auth', {}, [
    // ── Colonne sombre (cachée en mobile via CSS) ──────────────────────
    h('aside.auth__side', {}, [
      (() => { const z = Zellige({ size: 540, opacity: 0.15, color: 'var(--c-paper)' }); z.style.top = '-160px'; z.style.insetInlineEnd = '-160px'; return z; })(),
      h('div.auth__side-inner', {}, [
        Wordmark({ size: 'sm', variant: 'inverse', linked: true }),
        h('h2', {}, [side?.title || t('auth.side_title')]),
        h('p', {}, [side?.lede || t('auth.side_lede')]),
      ]),
      h('div.auth__side-foot', {}, ['Cursus · 2026 · Algérie']),
    ]),

    // ── Colonne claire (formulaire) ────────────────────────────────────
    h('main.auth__main', { id: 'main-content', role: 'main', tabindex: '-1' }, [
      h('header.auth__head', {}, [
        Wordmark({ size: 'sm', linked: true }),
        h('div.auth__head-actions', {}, [LangSwitcher(), ThemeToggle()]),
      ]),
      form,
    ]),
  ]);
}
