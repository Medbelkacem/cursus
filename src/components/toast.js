// Toast — petits messages éphémères. Affichés dans #toast-root.
import { h } from '../lib/dom.js';
import { Icon } from './icon.js';

const TONES = {
  success: { icon: 'check-circle', cls: 'toast--success' },
  warn:    { icon: 'alert',        cls: 'toast--warn' },
  danger:  { icon: 'alert',        cls: 'toast--danger' },
  info:    { icon: 'alert',        cls: 'toast--info' },
};

export function toast(message, opts = {}) {
  const { tone = 'info', duration = 3500, title } = opts;
  const cfg = TONES[tone] || TONES.info;

  const root = document.getElementById('toast-root');
  if (!root) return;

  // role=alert pour les erreurs (annonce immédiate, assertive),
  // role=status sinon (polite). #toast-root reste aria-live=polite globalement.
  const role = (tone === 'danger' || tone === 'warn') ? 'alert' : 'status';
  const el = h(`div.toast.${cfg.cls}`, {
    role,
    'aria-live': role === 'alert' ? 'assertive' : 'polite',
  }, [
    Icon(cfg.icon, { size: 18 }),
    h('div.toast__body', {}, [
      title && h('div.toast__title', {}, [title]),
      h('div.toast__msg', {}, [message]),
    ].filter(Boolean)),
    h('button.toast__close', {
      type: 'button', 'aria-label': 'Fermer',
      onClick: () => el.remove(),
    }, [Icon('close', { size: 14 })]),
  ]);
  root.appendChild(el);
  setTimeout(() => el.classList.add('is-leaving'), duration - 200);
  setTimeout(() => el.remove(), duration);
}
