// Input / Select / Textarea — toujours encapsulés dans un Field (label + erreur).

import { h } from '../lib/dom.js';

let _id = 0;
const nextId = () => `f${++_id}`;

export function Field(opts = {}) {
  const {
    label,
    hint,
    error,
    required = false,
    children,
  } = opts;

  // Si l'enfant est un <input>, on lie son id au <label>
  const id = children?.id || nextId();
  if (children && !children.id) children.id = id;

  return h('div.field' + (error ? '.field--error' : ''), {}, [
    label && h('label.field__label', { for: id }, [
      label,
      required && h('span', { class: 'field__req', 'aria-hidden': 'true' }, ['*']),
    ].filter(Boolean)),
    h('div.field__control', {}, [children]),
    hint  && !error && h('p.field__hint mono', { class: 'field__hint mono' }, [hint]),
    error && h('p.field__error mono', { class: 'field__error mono', role: 'alert' }, [error]),
  ].filter(Boolean));
}

export function Input(opts = {}) {
  const { type = 'text', value, placeholder, name, autocomplete, onInput, onChange, required, disabled, ...rest } = opts;
  return h('input.input', {
    type, value, placeholder, name, autocomplete, required, disabled,
    onInput, onChange, ...rest,
  });
}

export function Textarea(opts = {}) {
  const { value = '', placeholder, name, rows = 4, onInput, required, disabled } = opts;
  const el = h('textarea.input.input--textarea', {
    placeholder, name, rows, onInput, required, disabled,
  });
  el.value = value;
  return el;
}

export function Select(opts = {}) {
  const { value, name, options = [], onChange, required, disabled } = opts;
  const el = h('select.input.input--select', { name, onChange, required, disabled });
  for (const o of options) {
    const opt = h('option', { value: o.value, selected: String(o.value) === String(value) }, [o.label ?? o.value]);
    el.appendChild(opt);
  }
  return el;
}

export function Checkbox(opts = {}) {
  const { label, checked = false, name, onChange, disabled } = opts;
  const id = nextId();
  return h('label.check', { for: id }, [
    h('input', { type: 'checkbox', id, name, checked, onChange, disabled }),
    h('span.check__box', {}),
    h('span.check__label', {}, [label]),
  ]);
}
