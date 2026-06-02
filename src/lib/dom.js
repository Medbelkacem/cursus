// ─────────────────────────────────────────────────────────────────────────────
//  Mini-helpers DOM — évitent l'usage massif de innerHTML, gardent les listeners
//  attachés aux éléments et facilitent la composition.
//
//   h('div.card', { onClick: fn }, [
//     h('h2', {}, ['Titre']),
//     h('p', {}, ['Contenu']),
//   ])
//
//  Le sélecteur 'div.card.elevated#id' supporte tag + classes + id à la fois.
// ─────────────────────────────────────────────────────────────────────────────

export function h(selector, attrs, children) {
  // Parse "div.card.elevated#id"
  const tagMatch = selector.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
  const tag = tagMatch ? tagMatch[0] : 'div';
  const rest = selector.slice(tag.length);
  const classes = [];
  let id;
  rest.split(/(?=[.#])/).forEach((p) => {
    if (!p) return;
    if (p.startsWith('.')) classes.push(p.slice(1));
    else if (p.startsWith('#')) id = p.slice(1);
  });

  const el = document.createElement(tag);
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');

  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') {
        el.className = (el.className ? el.className + ' ' : '') + v;
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v);
      } else if (k === 'dataset' && typeof v === 'object') {
        Object.assign(el.dataset, v);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'html') {
        el.innerHTML = v;
      } else if (typeof v === 'boolean') {
        if (v) el.setAttribute(k, '');
      } else {
        el.setAttribute(k, v);
      }
    }
  }

  if (children != null) appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

// raccourci pour les fragments
export function frag(children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

// petite utilité — escape HTML pour les usages innerHTML résiduels
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
