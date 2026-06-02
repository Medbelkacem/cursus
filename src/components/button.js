// Bouton réutilisable — variantes : primary | secondary | ghost | danger | inverse.
// Tailles : sm | md | lg. Peut recevoir une icône avant ou après.

import { h } from '../lib/dom.js';
import { Icon } from './icon.js';

export function Button(opts = {}) {
  const {
    label,
    variant = 'primary',
    size = 'md',
    icon,
    iconAfter,
    onClick,
    href,
    type = 'button',
    disabled = false,
    loading = false,
    fullWidth = false,
    'data-link': dataLink,
    'aria-label': ariaLabel,
  } = opts;

  const children = [];
  if (icon)        children.push(Icon(icon, { size: size === 'sm' ? 14 : 16 }));
  if (label)       children.push(h('span', {}, [label]));
  if (iconAfter)   children.push(Icon(iconAfter, { size: size === 'sm' ? 14 : 16 }));
  if (loading)     children.unshift(h('span.btn__spinner', {}));

  const cls = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && 'btn--full',
    loading && 'is-loading',
  ].filter(Boolean).join(' ');

  if (href) {
    return h('a', {
      class: cls,
      href,
      'data-link': dataLink === false ? null : '',
      'aria-label': ariaLabel,
    }, children);
  }

  return h('button', {
    class: cls,
    type,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    'aria-busy': loading ? 'true' : null,
  }, children);
}
