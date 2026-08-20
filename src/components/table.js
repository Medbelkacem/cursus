// ─────────────────────────────────────────────────────────────────────────────
//  DataTable — tableau de données avec recherche, filtres, tri, pagination et
//  export CSV.  Utilisé par toutes les listes (§21 recherche/filtrage, §22 export).
//
//    DataTable({
//      columns: [{ key, label, value: r => …, render?: r => Node, sortable?, align? }],
//      rows,
//      searchKeys: ['name', 'code'],           // ou search: (row, q) => bool
//      filters: [{ key, label, options, value }],
//      exportName: 'etablissements',
//      onRow: (row) => …,
//      empty: 'Aucun établissement enregistré.',
//    })
// ─────────────────────────────────────────────────────────────────────────────

import { h } from '../lib/dom.js';
import { Card } from './card.js';
import { Icon } from './icon.js';
import { Button } from './button.js';
import { Input, Select } from './input.js';
import { EmptyBlock } from '../lib/page-helpers.js';
import { downloadCSV, slugStamp } from '../lib/export.js';

const PAGE_SIZES = [25, 50, 100, 250];

export function DataTable(opts = {}) {
  const {
    columns = [],
    rows = [],
    searchKeys = null,
    search = null,
    searchPlaceholder = 'Rechercher…',
    filters = [],
    exportName = null,
    exportColumns = null,
    onRow = null,
    empty = 'Aucune donnée.',
    emptyIcon = 'inbox',
    pageSize = 25,
    dense = false,
    actions = null,
    footNote = null,
  } = opts;

  const state = {
    q: '',
    sort: null,
    dir: 1,
    page: 0,
    size: pageSize,
    filters: Object.fromEntries(filters.map((f) => [f.key, f.value ?? ''])),
  };

  const searchInput = Input({ type: 'search', placeholder: searchPlaceholder });
  searchInput.addEventListener('input', () => { state.q = searchInput.value; state.page = 0; render(); });

  const filterControls = filters.map((f) => {
    const sel = Select({ value: state.filters[f.key], options: f.options });
    sel.addEventListener('change', () => {
      state.filters[f.key] = sel.value;
      state.page = 0;
      if (f.onChange) f.onChange(sel.value);
      render();
    });
    return h('label.dt__filter', {}, [
      h('span.dt__filter-label', {}, [f.label]),
      sel,
    ]);
  });

  const countEl = h('span.dt__count mono', { class: 'dt__count mono' }, ['0']);
  const bodyMount = h('div.dt__body', {});
  const pagerMount = h('div.dt__pager', {});

  const exportBtn = exportName
    ? Button({
        label: 'CSV', icon: 'download', variant: 'ghost', size: 'sm',
        onClick: () => {
          const cols = (exportColumns || columns)
            .filter((c) => c.value)
            .map((c) => ({ label: c.label, value: c.value }));
          downloadCSV(slugStamp(exportName), cols, filtered());
        },
      })
    : null;

  function matches(row) {
    // Filtres
    for (const f of filters) {
      const v = state.filters[f.key];
      if (!v) continue;
      const ok = f.match ? f.match(row, v) : String(f.value ? f.value(row) : row[f.key] ?? '') === v;
      if (!ok) return false;
    }
    // Recherche
    const q = state.q.trim().toLowerCase();
    if (!q) return true;
    if (search) return search(row, q);
    const keys = searchKeys || columns.filter((c) => c.value).map((c) => c.key);
    return keys.some((k) => {
      const col = columns.find((c) => c.key === k);
      const v = col?.value ? col.value(row) : row[k];
      return String(v ?? '').toLowerCase().includes(q);
    });
  }

  function filtered() {
    let list = rows.filter(matches);
    if (state.sort) {
      const col = columns.find((c) => c.key === state.sort);
      if (col) {
        const get = col.sortValue || col.value || ((r) => r[col.key]);
        list = [...list].sort((a, b) => {
          const x = get(a), y = get(b);
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          if (typeof x === 'number' && typeof y === 'number') return (x - y) * state.dir;
          return String(x).localeCompare(String(y), 'fr', { numeric: true }) * state.dir;
        });
      }
    }
    return list;
  }

  function render() {
    const list = filtered();
    countEl.textContent = `${list.length} résultat${list.length > 1 ? 's' : ''}`;

    const pages = Math.max(1, Math.ceil(list.length / state.size));
    if (state.page >= pages) state.page = pages - 1;
    const slice = list.slice(state.page * state.size, (state.page + 1) * state.size);

    bodyMount.replaceChildren();
    if (list.length === 0) {
      bodyMount.appendChild(EmptyBlock(
        rows.length === 0 ? empty : 'Aucun résultat pour ces critères.',
        rows.length === 0 ? emptyIcon : 'search'
      ));
    } else {
      bodyMount.appendChild(h(`table.table${dense ? '.table--dense' : ''}`, {}, [
        h('thead', {}, [h('tr', {}, columns.map((c) => {
          const isSorted = state.sort === c.key;
          if (c.sortable === false) {
            return h('th', { style: c.align ? { textAlign: c.align } : null }, [c.label]);
          }
          return h('th.th--sortable', {
            style: c.align ? { textAlign: c.align } : null,
            'aria-sort': isSorted ? (state.dir === 1 ? 'ascending' : 'descending') : 'none',
            tabindex: '0',
            role: 'button',
            onClick: () => {
              if (state.sort === c.key) state.dir = -state.dir;
              else { state.sort = c.key; state.dir = 1; }
              render();
            },
            onKeydown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
            },
          }, [
            c.label,
            isSorted && h('span.th__caret', {}, [state.dir === 1 ? '↑' : '↓']),
          ].filter(Boolean));
        }))]),
        h('tbody', {}, slice.map((r) => h('tr', {
          class: onRow ? 'tr--clickable' : null,
          tabindex: onRow ? '0' : null,
          onClick: onRow ? () => onRow(r) : null,
          onKeydown: onRow ? (e) => {
            if (e.key === 'Enter') { e.preventDefault(); onRow(r); }
          } : null,
        }, columns.map((c) => h('td', {
          style: c.align ? { textAlign: c.align } : null,
          class: c.cellClass || null,
        }, [c.render ? c.render(r) : String(c.value ? (c.value(r) ?? '—') : (r[c.key] ?? '—'))]))))),
      ]));
    }

    // Pagination
    pagerMount.replaceChildren();
    if (list.length > PAGE_SIZES[0]) {
      const sizeSel = Select({
        value: String(state.size),
        options: PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} / page` })),
      });
      sizeSel.addEventListener('change', () => {
        state.size = Number(sizeSel.value); state.page = 0; render();
      });
      pagerMount.appendChild(h('div.dt__pager-inner', {}, [
        sizeSel,
        h('span.mono.small.mute', {}, [
          `${state.page * state.size + 1}–${Math.min((state.page + 1) * state.size, list.length)} sur ${list.length}`,
        ]),
        h('div.dt__pager-btns', {}, [
          Button({
            label: '‹', variant: 'ghost', size: 'sm', disabled: state.page === 0,
            'aria-label': 'Page précédente',
            onClick: () => { state.page = Math.max(0, state.page - 1); render(); },
          }),
          h('span.mono.small', {}, [`${state.page + 1} / ${pages}`]),
          Button({
            label: '›', variant: 'ghost', size: 'sm', disabled: state.page >= pages - 1,
            'aria-label': 'Page suivante',
            onClick: () => { state.page = Math.min(pages - 1, state.page + 1); render(); },
          }),
        ]),
      ]));
    }
  }

  const toolbar = h('div.dt__toolbar', {}, [
    h('div.dt__search', {}, [Icon('search', { size: 15 }), searchInput]),
    ...filterControls,
    h('div.dt__spacer', {}),
    countEl,
    exportBtn,
    ...(actions ? (Array.isArray(actions) ? actions : [actions]) : []),
  ].filter(Boolean));

  render();

  const card = Card({ padding: 0 }, [
    toolbar,
    bodyMount,
    pagerMount,
    footNote && h('p.dt__note mono', { class: 'dt__note mono' }, [footNote]),
  ].filter(Boolean));

  card.refresh = render;
  card.getFiltered = filtered;
  return card;
}
