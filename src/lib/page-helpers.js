// Petits helpers partagés par les pages des dashboards (KPI, blocs vides, etc.).

import { h } from './dom.js';
import { Card } from '../components/card.js';
import { Icon } from '../components/icon.js';
import { Badge } from '../components/badge.js';

// Carte d'indicateur : label, valeur, suffixe (ex: "%"), petite ligne dessous.
export function KPI(label, value, suffix = '', sub = null, tone = null) {
  return Card({ padding: 0 }, [
    h('div.kpi', {}, [
      h('div.kpi__label', {}, [label]),
      h('div.kpi__value', {}, [
        h('span', {}, [value ?? '—']),
        suffix && h('span.kpi__value-sub', {}, [suffix]),
      ].filter(Boolean)),
      sub && h('div', { class: tone ? `kpi__trend kpi__trend--${tone}` : 'kpi__trend' }, [sub]),
    ].filter(Boolean)),
  ]);
}

// Grille de N colonnes (responsive via CSS grid + auto-fit).
export function Grid(cols, gap = 'var(--s-3)', children) {
  return h('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap,
    },
  }, children);
}

export function EmptyBlock(msg, icon = 'inbox') {
  return h('div.empty', {}, [
    h('div.empty__ico', {}, [Icon(icon, { size: 22 })]),
    h('p.empty__msg', {}, [msg]),
  ]);
}

// Bloc d'en-tête de carte avec titre + bouton « Voir tout »
export function CardSectionHead(title, link = null, linkLabel = 'Voir tout →') {
  return h('div.card__head', {}, [
    h('div', {}, [h('h3.card__title', {}, [title])]),
    link && h('a', {
      href: link, 'data-link': '',
      class: 'mono small', style: { color: 'var(--c-gauloise-d)' },
    }, [linkLabel]),
  ].filter(Boolean));
}

// Affichage d'un statut générique pour les listes
export function StatusBadge(value, palette = {}) {
  const map = {
    pending:  { tone: 'warn',    label: 'En attente' },
    active:   { tone: 'success', label: 'Actif' },
    rejected: { tone: 'danger',  label: 'Refusé' },
    sent:     { tone: 'success', label: 'Envoyé' },
    present:  { tone: 'success', label: 'Présent' },
    late:     { tone: 'warn',    label: 'Retard' },
    absent:   { tone: 'danger',  label: 'Absent' },
    ...palette,
  };
  const m = map[value] || { tone: 'default', label: String(value) };
  return Badge({ tone: m.tone, dot: true }, [m.label]);
}

// Convertit une date ISO en libellé court FR (ex: « 23 mai 2026 »)
export function fmtDate(iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', opts);
}

export function fmtDateTime(iso) {
  return fmtDate(iso, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Compte les jours entre maintenant et une date future
export function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Math.max(0, Math.ceil((d - new Date()) / 86400000));
}

// Wrapper d'erreur uniforme — utilisé quand une requête Supabase échoue.
export function ErrorBlock(err) {
  return h('div', {
    style: {
      padding: 'var(--s-4)',
      border: '1px solid var(--c-rose-300, #f5b1b1)',
      borderRadius: 'var(--r-md)',
      background: 'var(--c-rose-50, #fff5f5)',
      color: 'var(--c-rose-700, #c0392b)',
      fontSize: 'var(--t-body-sm)',
    },
  }, [
    h('strong', {}, ['Erreur : ']),
    String(err?.message || err || 'requête échouée'),
  ]);
}
