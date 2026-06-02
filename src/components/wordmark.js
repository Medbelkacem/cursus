// ─────────────────────────────────────────────────────────────────────────────
//  Cursus — wordmark (mot-symbole)
//  Sérif italique + un point bleu Gauloise. Décliné en 4 tailles + variantes.
// ─────────────────────────────────────────────────────────────────────────────

import { h } from '../lib/dom.js';

export function Wordmark(opts = {}) {
  const { size = 'md', variant = 'default', linked = false } = opts;
  const el = h(linked ? 'a' : 'span', {
    class: `wm wm--${size} wm--${variant}`,
    href: linked ? '/' : undefined,
    'data-link': linked ? '' : undefined,
    'aria-label': 'Cursus',
  }, [
    h('span.wm__word', {}, ['Cursus']),
    h('span.wm__dot', { 'aria-hidden': 'true' }),
  ]);
  return el;
}

export function wordmarkHTML(opts = {}) {
  const { size = 'md', variant = 'default', linked = false } = opts;
  const tag = linked ? 'a' : 'span';
  const linkAttrs = linked ? ' href="/" data-link' : '';
  return `<${tag} class="wm wm--${size} wm--${variant}"${linkAttrs} aria-label="Cursus"><span class="wm__word">Cursus</span><span class="wm__dot" aria-hidden="true"></span></${tag}>`;
}
