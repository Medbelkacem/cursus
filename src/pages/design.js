// Page interne /design — galerie de tous les composants du design system.
// Utile pour la revue visuelle et le QA lors des étapes suivantes.

import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { Wordmark } from '../components/wordmark.js';
import { Button } from '../components/button.js';
import { Card, CardHeader } from '../components/card.js';
import { Badge } from '../components/badge.js';
import { Field, Input, Textarea, Select, Checkbox } from '../components/input.js';
import { Icon } from '../components/icon.js';
import { Zellige } from '../components/zellige.js';
import { LangSwitcher, ThemeToggle } from '../components/lang-theme.js';
import { toast } from '../components/toast.js';

export async function designPage() {
  const wrap = h('div.design-page', {}, [
    h('header.lp__head', {}, [
      Wordmark({ size: 'sm', linked: true }),
      h('nav.lp__nav', {}, [
        h('a', { href: '/', 'data-link': '' }, [t('common.back')]),
        LangSwitcher(),
        ThemeToggle(),
      ]),
    ]),

    h('div.section', {}, [
      h('div.section__inner', {}, [
        h('p.kicker', {}, ['Cursus']),
        h('h1.section__title', { style: { fontSize: '44px' } }, [t('design.title')]),
        h('p.mute', {}, [t('design.lede')]),

        // ── Boutons ──────────────────────────────────────────────────
        block(t('design.section_buttons'), [
          h('div.dp-row', {}, [
            Button({ label: 'Primary',   variant: 'primary' }),
            Button({ label: 'Secondary', variant: 'secondary' }),
            Button({ label: 'Ghost',     variant: 'ghost' }),
            Button({ label: 'Danger',    variant: 'danger' }),
            Button({ label: 'Inverse',   variant: 'inverse' }),
          ]),
          h('div.dp-row', {}, [
            Button({ label: 'Small',  size: 'sm',  variant: 'primary' }),
            Button({ label: 'Medium', size: 'md',  variant: 'primary' }),
            Button({ label: 'Large',  size: 'lg',  variant: 'primary' }),
            Button({ label: 'With icon', icon: 'download', variant: 'secondary' }),
            Button({ label: 'After icon', iconAfter: 'arrow-right', variant: 'primary' }),
          ]),
        ]),

        // ── Badges ───────────────────────────────────────────────────
        block(t('design.section_badges'), [
          h('div.dp-row', {}, [
            Badge({ tone: 'default' }, 'Default'),
            Badge({ tone: 'accent', dot: true }, 'En cours'),
            Badge({ tone: 'success' }, 'Présent'),
            Badge({ tone: 'warn' }, 'En retard'),
            Badge({ tone: 'danger' }, 'Absent'),
            Badge({ tone: 'outline' }, 'À venir'),
            Badge({ tone: 'neutral' }, 'Brouillon'),
          ]),
        ]),

        // ── Champs ───────────────────────────────────────────────────
        block(t('design.section_inputs'), [
          h('div.dp-grid', {}, [
            Field({ label: 'Email', children: Input({ type: 'email', placeholder: 'nom@etablissement.dz' }) }),
            Field({ label: 'Mot de passe', required: true, children: Input({ type: 'password', placeholder: '••••••••' }) }),
            Field({ label: 'Rôle', children: Select({ options: [
              { value: 'student', label: 'Étudiant' },
              { value: 'teacher', label: 'Professeur' },
              { value: 'admin',   label: 'Administration' },
            ] }) }),
            Field({ label: 'Note', hint: 'Optionnel — visible par le formateur.', children: Textarea({ placeholder: 'Quelques mots…' }) }),
            Field({ label: 'Erreur visible', error: 'Veuillez renseigner ce champ.', children: Input({ placeholder: '—' }) }),
            Field({ label: 'Préférences', children: Checkbox({ label: 'M\'envoyer un récapitulatif hebdomadaire' }) }),
          ]),
        ]),

        // ── Cartes ───────────────────────────────────────────────────
        block(t('design.section_cards'), [
          h('div.dp-cards', {}, [
            Card({ padding: 20 }, [
              CardHeader({ title: 'Carte simple', subtitle: 'Bordure + fond surface', actions: Button({ label: '⋯', variant: 'ghost', size: 'sm' }) }),
              h('p.mute small', { class: 'mute small' }, ['Bloc de base pour la majorité des contenus. Adapte son ombre au hover si interactive.']),
            ]),
            Card({ padding: 20, elevated: true }, [
              CardHeader({ title: 'Carte élevée', subtitle: 'Ombre douce, sans bordure' }),
              h('p.mute small', { class: 'mute small' }, ['Pour les éléments principaux d\'un écran — typiquement les héros et les modals.']),
            ]),
            Card({ padding: 20, accent: true }, [
              CardHeader({ title: 'Carte accent', subtitle: 'Tonalité Bleu Gauloise' }),
              h('p.mute small', { class: 'mute small' }, ['Pour signaler l\'élément actif ou recommandé.']),
            ]),
            Card({ padding: 24, dark: true, style: { position: 'relative', overflow: 'hidden' } }, [
              h('div', { style: { position: 'relative', zIndex: 2 } }, [
                h('p.kicker', { style: { color: 'rgba(255,255,255,.5)' } }, ['CARTE SOMBRE']),
                h('h3', { style: { color: 'var(--c-paper)', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 500, margin: '8px 0' } }, ['Avec zellige']),
                h('p', { style: { color: 'rgba(255,255,255,.7)', fontSize: '13px', margin: 0 } }, ['Utilisée pour les CTAs et les prochains examens.']),
              ]),
              (() => { const z = Zellige({ size: 220, opacity: 0.18, color: 'var(--c-paper)' }); z.style.top = '-50px'; z.style.insetInlineEnd = '-50px'; return z; })(),
            ]),
          ]),
        ]),

        // ── KPI ──────────────────────────────────────────────────────
        block(t('design.section_kpis'), [
          h('div.dp-cards', {}, [
            kpi('Moyenne générale', '14.62', '/20', '↑ +0.4 vs S1', 'up'),
            kpi('Taux de présence', '92', '%', '3 absences · 2 retards'),
            kpi('Cours cette semaine', '18', 'h', 'Prochain : 10:30'),
            kpi('Examens à venir', '2', '', 'Algo · 24 mai'),
          ]),
        ]),

        // ── Couleurs ─────────────────────────────────────────────────
        block(t('design.section_colors'), [
          h('div.dp-swatches', {}, [
            swatch('Gauloise',     '#1f5fbc', 'primary'),
            swatch('Gauloise-d',   '#174a93', 'primary hover'),
            swatch('Paper',        'var(--c-paper)', 'background'),
            swatch('Surface',      'var(--c-surface)', 'cards'),
            swatch('Ink',          'var(--c-ink)', 'text'),
            swatch('Mute',         'var(--c-mute)', 'text-mute'),
            swatch('Success',      'var(--c-success)', '✓'),
            swatch('Warn',         'var(--c-warn)', '!'),
            swatch('Danger',       'var(--c-danger)', '✕'),
          ]),
        ]),

        // ── Typographie ──────────────────────────────────────────────
        block(t('design.section_typo'), [
          h('div.dp-typo', {}, [
            h('div', {}, [
              h('p.kicker', {}, ['Fraunces · display']),
              h('h1', { style: { fontSize: '64px', fontWeight: 400 } }, ['L\'institution, simplifiée.']),
            ]),
            h('div', {}, [
              h('p.kicker', {}, ['DM Sans · body']),
              h('p', {}, ['Plateforme conçue pour les instituts et centres de formation en Algérie.']),
            ]),
            h('div', {}, [
              h('p.kicker', {}, ['DM Mono · labels & data']),
              h('p.mono', {}, ['CFPA-16-CONST · 2025-2026 · S2 · coef. 3']),
            ]),
            h('div', {}, [
              h('p.kicker', {}, ['Noto Naskh Arabic']),
              h('p', { style: { fontFamily: 'var(--font-arabic)', fontSize: '24px', direction: 'rtl' } }, ['المنصة الوطنية لمتابعة التكوين.']),
            ]),
          ]),
        ]),

        block('Toasts', [
          h('div.dp-row', {}, [
            Button({ label: 'Info',    variant: 'secondary', onClick: () => toast('Information générale.', { tone: 'info', title: 'Info' }) }),
            Button({ label: 'Succès',  variant: 'secondary', onClick: () => toast('Note enregistrée.',     { tone: 'success', title: 'Succès' }) }),
            Button({ label: 'Avertissement', variant: 'secondary', onClick: () => toast('Pensez à vérifier.', { tone: 'warn', title: 'Attention' }) }),
            Button({ label: 'Erreur',  variant: 'secondary', onClick: () => toast('Action impossible.',    { tone: 'danger', title: 'Erreur' }) }),
          ]),
        ]),
      ]),
    ]),
  ]);

  return wrap;
}

function block(title, children) {
  return h('section.dp-block', {}, [
    h('h2.dp-block__title', {}, [title]),
    ...(Array.isArray(children) ? children : [children]),
  ]);
}

function kpi(label, value, suffix, trend, dir) {
  const trendCls = dir === 'up' ? 'kpi__trend kpi__trend--up' : dir === 'down' ? 'kpi__trend kpi__trend--down' : 'kpi__trend';
  return Card({ padding: 0 }, [
    h('div.kpi', {}, [
      h('div.kpi__label', {}, [label]),
      h('div.kpi__value', {}, [
        h('span', {}, [value]),
        suffix && h('span.kpi__value-sub', {}, [suffix]),
      ].filter(Boolean)),
      h('div', { class: trendCls }, [trend]),
    ]),
  ]);
}

function swatch(name, color, role) {
  return h('div.dp-swatch', {}, [
    h('div.dp-swatch__chip', { style: { background: color } }),
    h('div.dp-swatch__name', {}, [name]),
    h('div.dp-swatch__role mono', { class: 'dp-swatch__role mono' }, [role]),
  ]);
}
