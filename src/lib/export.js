// ─────────────────────────────────────────────────────────────────────────────
//  Export de rapports (§22) — CSV/Excel et PDF.
//
//  Le CSV est produit avec un BOM UTF-8 et le séparateur « ; » : Excel en
//  configuration française l'ouvre alors directement en colonnes.
//  Le PDF passe par la fenêtre d'impression du navigateur (aucune dépendance).
// ─────────────────────────────────────────────────────────────────────────────

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(columns, rows) {
  const head = columns.map((c) => csvCell(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(';'));
  return '﻿' + [head, ...body].join('\r\n');
}

export function downloadCSV(filename, columns, rows) {
  const blob = new Blob([toCSV(columns, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugStamp(base) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${base}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Rapport PDF : ouvre une fenêtre d'impression mise en page (« Enregistrer en PDF »).
export function printReport(opts = {}) {
  const {
    title = 'Rapport',
    subtitle = '',
    meta = [],          // [{ label, value }]
    kpis = [],          // [{ label, value }]
    sections = [],      // [{ title, columns:[{label,value}], rows:[...] , note }]
    footer = 'Cursus — Plateforme nationale de gestion de la formation professionnelle',
  } = opts;

  const win = window.open('', '_blank', 'width=1024,height=768');
  if (!win) {
    throw new Error("La fenêtre d'impression a été bloquée par le navigateur.");
  }

  const metaHTML = meta.length
    ? `<dl class="meta">${meta.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>`
    : '';

  const kpiHTML = kpis.length
    ? `<div class="kpis">${kpis.map((k) =>
        `<div class="kpi"><span class="kpi-l">${esc(k.label)}</span><span class="kpi-v">${esc(k.value)}</span></div>`
      ).join('')}</div>`
    : '';

  const sectionsHTML = sections.map((s) => {
    if (!s.rows || s.rows.length === 0) {
      return `<section><h2>${esc(s.title)}</h2><p class="empty">Aucune donnée pour ce périmètre.</p></section>`;
    }
    const head = s.columns.map((c) => `<th>${esc(c.label)}</th>`).join('');
    const body = s.rows.map((r) =>
      `<tr>${s.columns.map((c) => `<td>${esc(c.value(r))}</td>`).join('')}</tr>`
    ).join('');
    return `<section>
      <h2>${esc(s.title)} <span class="count">${s.rows.length}</span></h2>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
    </section>`;
  }).join('');

  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font: 11px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1a1916; margin: 0; }
  header.doc { border-bottom: 2px solid #1f5fbc; padding-bottom: 10px; margin-bottom: 16px; }
  .brand { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #1f5fbc;
           font-weight: 700; }
  h1 { font-size: 19px; margin: 6px 0 2px; }
  .sub { color: #6c675e; font-size: 11px; margin: 0; }
  dl.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 6px 18px; margin: 12px 0 0; }
  dl.meta dt { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #8a857c; }
  dl.meta dd { margin: 1px 0 0; font-weight: 600; font-size: 11px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 8px; margin: 16px 0; }
  .kpi { border: 1px solid #d9d4c8; border-radius: 5px; padding: 8px 10px; }
  .kpi-l { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .07em;
           color: #8a857c; }
  .kpi-v { display: block; font-size: 17px; font-weight: 700; margin-top: 2px; }
  section { margin-top: 18px; break-inside: auto; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #174a93;
       border-bottom: 1px solid #d9d4c8; padding-bottom: 4px; margin: 0 0 8px; }
  h2 .count { float: right; color: #8a857c; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .06em;
       color: #6c675e; border-bottom: 1px solid #c9c4b8; padding: 5px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #ece8df; vertical-align: top; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  .empty, .note { color: #8a857c; font-style: italic; font-size: 10px; }
  footer.doc { margin-top: 22px; border-top: 1px solid #d9d4c8; padding-top: 6px;
               font-size: 9px; color: #8a857c; display: flex; justify-content: space-between; }
</style></head><body>
<header class="doc">
  <div class="brand">Cursus · République Algérienne Démocratique et Populaire</div>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
  ${metaHTML}
</header>
${kpiHTML}
${sectionsHTML}
<footer class="doc"><span>${esc(footer)}</span><span>Édité le ${new Date().toLocaleString('fr-FR')}</span></footer>
</body></html>`);

  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
