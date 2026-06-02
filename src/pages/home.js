// Page d'accueil publique — présentation de Cursus avec le design system complet.

import { h } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { Wordmark } from '../components/wordmark.js';
import { Button } from '../components/button.js';
import { LangSwitcher, ThemeToggle } from '../components/lang-theme.js';
import { Icon } from '../components/icon.js';
import { Zellige } from '../components/zellige.js';

export async function homePage() {
  const wrap = h('div.lp', {}, [
    // ── Header sticky ──────────────────────────────────────────────────
    h('header.lp__head', {}, [
      Wordmark({ size: 'sm', linked: true }),
      h('nav.lp__nav', {}, [
        LangSwitcher(),
        ThemeToggle(),
        Button({ label: t('home.cta_login'),  variant: 'ghost',   href: '/login',  'data-link': true }),
        Button({ label: t('home.cta_signup'), variant: 'primary', size: 'sm',     href: '/signup', 'data-link': true }),
      ]),
    ]),

    // ── Hero (cible du skip-link et landmark principal de la page) ────
    h('section.lp__hero', { id: 'main-content', role: 'main', tabindex: '-1', 'aria-label': 'Contenu principal' }, [
      Zellige({ size: 480, opacity: 0.05, style: 'star8' }),
      Object.assign(document.querySelector('.zellige') || h('div'), {}), // no-op
      (() => {
        const z = Zellige({ size: 480, opacity: 0.05, style: 'star8' });
        z.style.top = '-120px';
        z.style.insetInlineEnd = '-120px';
        z.remove(); // we'll re-attach below
        return z;
      })(),
      h('div.lp__hero-grid', {}, [
        h('div', {}, [
          h('p.kicker', {}, [t('home.kicker')]),
          h('h1.hero__title', { html: t('home.title_html') }),
          h('p.hero__lede', {}, [t('home.lede')]),
          h('div.lp__hero-cta', {}, [
            Button({ label: t('home.cta_signup'), variant: 'primary', size: 'lg', iconAfter: 'arrow-right', href: '/signup', 'data-link': true }),
            Button({ label: t('home.cta_login'),  variant: 'secondary', size: 'lg', href: '/login', 'data-link': true }),
          ]),
        ]),
        h('div.lp__hero-side', {}, [
          h('p.kicker', {}, [t('home.side_kicker')]),
          h('div', {}, [
            row('home.side_stat1_v', 'home.side_stat1_l'),
            row('home.side_stat2_v', 'home.side_stat2_l'),
            row('home.side_stat3_v', 'home.side_stat3_l'),
            row('home.side_stat4_v', 'home.side_stat4_l'),
          ]),
        ]),
      ]),
    ]),

    // ── 5 rôles ────────────────────────────────────────────────────────
    h('section.section', {}, [
      h('div.section__inner', {}, [
        h('div.section__head', {}, [
          h('p.kicker', {}, [t('home.roles_kicker')]),
          h('h2.section__title', {}, [t('home.roles_title')]),
          h('p.mute', {}, [t('home.roles_lede')]),
        ]),
        h('div.lp__roles', { style: { padding: 0, margin: 0 } }, [
          role('01', 'home.role_student',  'home.role_student_d'),
          role('02', 'home.role_teacher',  'home.role_teacher_d'),
          role('03', 'home.role_admin',    'home.role_admin_d'),
          role('04', 'home.role_direction','home.role_direction_d'),
          role('05', 'home.role_ministry', 'home.role_ministry_d'),
        ]),
      ]),
    ]),

    // ── 6 fonctionnalités ──────────────────────────────────────────────
    h('section.lp__features', {}, [
      h('div.section__inner', {}, [
        h('div.section__head', {}, [
          h('p.kicker', {}, [t('home.feat_kicker')]),
          h('h2.section__title', {}, [t('home.feat_title')]),
        ]),
        h('div.lp__features-grid', {}, [
          feature('graduation', 'home.feat_courses'),
          feature('check-circle', 'home.feat_attendance'),
          feature('chart', 'home.feat_grades'),
          feature('file-text', 'home.feat_exams'),
          feature('mail', 'home.feat_docs'),
          feature('shield', 'home.feat_rls'),
        ]),
      ]),
    ]),

    // ── CTA band ───────────────────────────────────────────────────────
    h('section.lp__cta-band', {}, [
      (() => { const z = Zellige({ size: 600, opacity: 0.08, color: '#fff' }); z.style.top = '-200px'; z.style.insetInlineEnd = '-200px'; return z; })(),
      h('div.lp__cta-band-inner', {}, [
        h('h2', {}, [t('home.cta_band_title')]),
        h('p', {}, [t('home.cta_band_lede')]),
        h('div', { style: { display: 'flex', gap: 'var(--s-3)', justifyContent: 'center', flexWrap: 'wrap' } }, [
          Button({ label: t('home.cta_signup'), variant: 'inverse', size: 'lg', iconAfter: 'arrow-right', href: '/signup', 'data-link': true }),
          Button({ label: t('home.cta_contact'), variant: 'ghost', size: 'lg', href: 'mailto:contact@cursus.dz' }),
        ]),
      ]),
    ]),

    // ── Footer ─────────────────────────────────────────────────────────
    h('footer.lp__foot', {}, [
      h('div.lp__foot-inner', {}, [
        h('div', { style: { display: 'flex', gap: 'var(--s-4)', alignItems: 'center' } }, [
          Wordmark({ size: 'xs', variant: 'inverse', linked: true }),
          h('span.lp__foot-meta', {}, ['© 2026 · Cursus']),
        ]),
        h('nav.lp__foot-links', {}, [
          h('a', { href: '/login', 'data-link': '' }, [t('home.cta_login')]),
          h('a', { href: 'mailto:contact@cursus.dz' }, [t('home.cta_contact')]),
          h('a', { href: '/design', 'data-link': '' }, ['Design system']),
        ]),
      ]),
    ]),
  ]);

  // Réattacher le zellige du hero (positionné absolu dans .lp__hero)
  const z = Zellige({ size: 520, opacity: 0.06, style: 'star8' });
  z.style.top = '-120px';
  z.style.insetInlineEnd = '-120px';
  wrap.querySelector('.lp__hero').prepend(z);

  // Le second Zellige du CTA est déjà inséré in-place.

  // Re-render lorsque la langue change (le composant lang-switcher déclenche cursus:rerender)
  const onLang = () => {
    homePage().then((fresh) => wrap.replaceWith(fresh));
  };
  window.addEventListener('cursus:rerender', onLang, { once: true });

  return wrap;
}

function row(vKey, lKey) {
  return h('div.lp__hero-stat', {}, [
    h('span.mute', {}, [t(lKey)]),
    h('span.lp__hero-stat-v', {}, [t(vKey)]),
  ]);
}

function role(num, nameKey, descKey) {
  return h('article.lp__role', {}, [
    h('div.lp__role-num mono', { class: 'lp__role-num mono' }, [num]),
    h('h3.lp__role-name', {}, [t(nameKey)]),
    h('p.lp__role-desc', {}, [t(descKey)]),
  ]);
}

function feature(icon, key) {
  return h('article.lp__feat', {}, [
    h('div.lp__feat-ico', {}, [Icon(icon, { size: 20 })]),
    h('h3.lp__feat-name', {}, [t(`${key}_t`)]),
    h('p.lp__feat-desc', {}, [t(`${key}_d`)]),
  ]);
}
