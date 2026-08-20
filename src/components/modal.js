// ─────────────────────────────────────────────────────────────────────────────
//  Modal — boîte de dialogue accessible (focus trap, Échap, clic hors zone).
//
//    const m = Modal({ title: 'Nouvelle wilaya', children: [...], actions: [...] });
//    m.open();  /  m.close();
// ─────────────────────────────────────────────────────────────────────────────

import { h } from '../lib/dom.js';
import { Icon } from './icon.js';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal(opts = {}) {
  const { title, subtitle, children, actions, size = 'md', onClose } = opts;

  let lastFocus = null;

  const body = h('div.modal__body', {}, Array.isArray(children) ? children : [children]);

  const closeBtn = h('button.modal__close', {
    type: 'button', 'aria-label': 'Fermer',
    onClick: () => api.close(),
  }, [Icon('close', { size: 16 })]);

  const dialog = h(`div.modal.modal--${size}`, {
    role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialogue',
  }, [
    h('header.modal__head', {}, [
      h('div', {}, [
        title && h('h2.modal__title', {}, [title]),
        subtitle && h('p.modal__sub mono', { class: 'modal__sub mono' }, [subtitle]),
      ].filter(Boolean)),
      closeBtn,
    ]),
    body,
    actions && h('footer.modal__foot', {}, Array.isArray(actions) ? actions : [actions]),
  ].filter(Boolean));

  const overlay = h('div.modal-overlay', {
    onClick: (e) => { if (e.target === overlay) api.close(); },
  }, [dialog]);

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const api = {
    el: overlay,
    body,
    open() {
      lastFocus = document.activeElement;
      document.body.appendChild(overlay);
      document.body.classList.add('modal-open');
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(() => {
        const first = dialog.querySelector(FOCUSABLE);
        (first || dialog).focus();
      });
      return api;
    },
    close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      document.body.classList.remove('modal-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      if (onClose) onClose();
    },
    setBody(nodes) {
      body.replaceChildren(...(Array.isArray(nodes) ? nodes : [nodes]));
    },
  };

  return api;
}

// Confirmation courte — renvoie une promesse résolue à true/false.
export function confirmDialog(opts = {}) {
  const {
    title = 'Confirmer',
    message = 'Cette action est irréversible.',
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    danger = false,
  } = opts;

  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (settled) return; settled = true; resolve(v); };

    const cancel = h('button.btn.btn--secondary.btn--md', { type: 'button' }, [
      h('span', {}, [cancelLabel]),
    ]);
    const ok = h(`button.btn.btn--${danger ? 'danger' : 'primary'}.btn--md`, { type: 'button' }, [
      h('span', {}, [confirmLabel]),
    ]);

    const m = Modal({
      title,
      size: 'sm',
      children: [h('p', { style: { fontSize: 'var(--t-body-sm)', lineHeight: 1.6 } }, [message])],
      actions: [cancel, ok],
      onClose: () => done(false),
    });

    cancel.addEventListener('click', () => { done(false); m.close(); });
    ok.addEventListener('click',     () => { done(true);  m.close(); });
    m.open();
  });
}
