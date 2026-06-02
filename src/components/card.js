// Carte — bloc de base. padding, elevated (ombre + sans bordure), dark, accent.

import { h } from '../lib/dom.js';

export function Card(opts = {}, children) {
  const {
    padding = 20,
    elevated = false,
    dark = false,
    accent = false,
    bordered = true,
    as = 'div',
    style: extra,
    onClick,
    href,
    'data-link': dataLink,
  } = opts;

  const cls = [
    'card',
    elevated && 'card--elevated',
    dark && 'card--dark',
    accent && 'card--accent',
    !bordered && 'card--no-border',
    (onClick || href) && 'card--interactive',
  ].filter(Boolean).join(' ');

  const style = { padding: typeof padding === 'number' ? `${padding}px` : padding, ...extra };

  if (href) {
    return h('a', { class: cls, href, 'data-link': dataLink === false ? null : '', style }, children);
  }
  return h(as, { class: cls, style, onClick }, children);
}

// En-tête de carte (titre + actions)
export function CardHeader(opts = {}) {
  const { title, subtitle, actions } = opts;
  return h('header.card__head', {}, [
    h('div', {}, [
      title    && h('h3.card__title', {}, [title]),
      subtitle && h('p.card__sub mono', { class: 'card__sub mono' }, [subtitle]),
    ].filter(Boolean)),
    actions && h('div.card__actions', {}, Array.isArray(actions) ? actions : [actions]),
  ].filter(Boolean));
}
