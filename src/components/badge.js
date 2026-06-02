// Badge — étiquette compacte. tone : default | accent | success | warn | danger | outline | neutral.
import { h } from '../lib/dom.js';

export function Badge(opts = {}, children) {
  const { tone = 'default', dot = false, size = 'md' } = opts;
  const cls = `badge badge--${tone} badge--${size}${dot ? ' badge--dot' : ''}`;
  const content = [];
  if (dot) content.push(h('span.badge__dot', {}));
  content.push(...(Array.isArray(children) ? children : [children]));
  return h('span', { class: cls }, content);
}
