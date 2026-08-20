// ─────────────────────────────────────────────────────────────────────────────
//  Briques d'interface partagées par les pages métier.
// ─────────────────────────────────────────────────────────────────────────────

import { h } from './dom.js';
import { Card } from '../components/card.js';
import { Icon } from '../components/icon.js';
import { Badge } from '../components/badge.js';
import { Button } from '../components/button.js';
import { meta, SEMESTERS, semLabel, SEMESTER_STATUS } from './nomenclature.js';

// Pastille de statut à partir d'une table de nomenclature
export function StatusPill(dict, value) {
  const m = meta(dict, value);
  return Badge({ tone: m.tone, dot: true, size: 'sm' }, [m.label]);
}

// Bandeau contextuel
export function Notice(opts = {}, children) {
  const { tone = 'info', icon = 'alert', title } = opts;
  return h(`div.notice.notice--${tone}`, { role: tone === 'danger' ? 'alert' : 'status' }, [
    Icon(icon, { size: 17 }),
    h('div', {}, [
      title && h('strong.notice__title', {}, [title]),
      ...(Array.isArray(children) ? children : [children]),
    ].filter(Boolean)),
  ]);
}

// Grille d'indicateurs
export function KPIGrid(items) {
  return h('div.kpi-grid', {}, items.filter(Boolean).map((it) =>
    Card({ padding: 0 }, [
      h('div.kpi', {}, [
        h('div.kpi__label', {}, [it.label]),
        h('div.kpi__value', {}, [
          h('span', {}, [it.value ?? '0']),
          it.suffix && h('span.kpi__value-sub', {}, [it.suffix]),
        ].filter(Boolean)),
        it.sub && h('div', {
          class: it.tone ? `kpi__trend kpi__trend--${it.tone}` : 'kpi__trend',
        }, [it.sub]),
      ]),
    ])
  ));
}

// Barre de progression simple
export function Bar(pct, tone = null) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return h('div.bar', { role: 'img', 'aria-label': `${v.toFixed(0)} %` }, [
    h('div', { class: `bar__fill${tone ? ` bar__fill--${tone}` : ''}`, style: { width: `${v}%` } }),
  ]);
}

// Répartition en liste (libellé + barre + valeur) — utilisée par les tableaux de bord
export function Distribution(items, opts = {}) {
  const { empty = 'Aucune donnée.', max = null, tone = null } = opts;
  if (!items || items.length === 0) {
    return h('p.small.mute', { style: { padding: '8px 0' } }, [empty]);
  }
  const top = max || Math.max(...items.map((i) => Number(i.count) || 0), 1);
  return h('div', { style: { display: 'grid', gap: '10px' } }, items.map((i) =>
    h('div', {}, [
      h('div', {
        style: { display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' },
      }, [
        h('span', { style: { fontSize: '13px' } }, [i.label]),
        h('span', { class: 'mono small', style: { fontWeight: 600 } }, [String(i.count ?? 0)]),
      ]),
      Bar(((Number(i.count) || 0) / top) * 100, tone),
    ])
  ));
}

// §10/§11 — Frise S1 → S5
export function SemesterStepper(semesters = [], current = null) {
  const byCode = new Map(semesters.map((s) => [s.semester, s]));
  return h('div.stepper', {}, SEMESTERS.map((code) => {
    const row = byCode.get(code);
    const status = row?.status || null;
    const avg = row?.final_average ?? row?.average ?? null;
    const cls = [
      'step',
      status && `step--${status}`,
      code === current && 'step--current',
    ].filter(Boolean).join('.');
    return h(`div.${cls}`, {}, [
      h('div.step__code', {}, [semLabel(code)]),
      h('div.step__avg', {}, [avg != null ? Number(avg).toFixed(2) : '—']),
      h('div.small.mute', {}, [status ? meta(SEMESTER_STATUS, status).label : 'Non démarré']),
    ]);
  }));
}

// En-tête de section avec actions
export function SectionHead(title, subtitle = null, actions = null) {
  return h('div.section-head', {}, [
    h('div', {}, [
      h('h2', {}, [title]),
      subtitle && h('p', {}, [subtitle]),
    ].filter(Boolean)),
    actions && h('div.row-actions', {}, Array.isArray(actions) ? actions : [actions]),
  ].filter(Boolean));
}

// Champ fichier stylé — renvoie l'input et un libellé qui affiche le nom choisi
export function FileField(opts = {}) {
  const { accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx', label = 'Choisir un fichier' } = opts;
  const input = h('input', {
    type: 'file', accept,
    style: { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' },
  });
  const nameEl = h('span.mono.small.mute', {}, ['Aucun fichier sélectionné']);
  const btn = Button({
    label, icon: 'upload', variant: 'secondary', size: 'sm',
    onClick: () => input.click(),
  });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    nameEl.textContent = f ? `${f.name} — ${fmtBytes(f.size)}` : 'Aucun fichier sélectionné';
  });
  const wrap = h('div', {
    style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  }, [input, btn, nameEl]);
  wrap.input = input;
  wrap.file = () => input.files?.[0] || null;
  wrap.reset = () => { input.value = ''; nameEl.textContent = 'Aucun fichier sélectionné'; };
  return wrap;
}

export function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} o`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1048576).toFixed(1)} Mo`;
}

export function fmtNum(n, digits = 0) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  return Number.isNaN(v) ? '—' : v.toLocaleString('fr-FR', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
}

export function fmtPct(n, digits = 1) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  return Number.isNaN(v) ? '—' : `${v.toFixed(digits)} %`;
}

export function fullName(p) {
  if (!p) return '—';
  const n = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return n || p.email || '—';
}

// Convertit une répartition {clé: n} en tableau [{label, count}] trié
export function toDist(obj, labeller = (k) => k) {
  if (!obj) return [];
  return Object.entries(obj)
    .map(([k, v]) => ({ label: labeller(k), count: Number(v) || 0, key: k }))
    .sort((a, b) => b.count - a.count);
}

// Empilement vertical standard des blocs d'une page
export function Stack(children) {
  return h('div.stack', {}, children.filter(Boolean));
}
