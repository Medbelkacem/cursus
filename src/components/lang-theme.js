// Sélecteur de langue + bascule de thème — utilisés dans la topbar / le footer / la page d'auth.

import { h } from '../lib/dom.js';
import { Icon } from './icon.js';
import { getLang, setLang, SUPPORTED_LANGS, onLangChange } from '../lib/i18n.js';
import { getTheme, toggleTheme, onThemeChange } from '../lib/theme.js';

const LANG_LABEL = { fr: 'FR · Français', en: 'EN · English', ar: 'AR · العربية' };

export function LangSwitcher(opts = {}) {
  const { variant = 'compact' } = opts;

  const wrap = h('div.lang-switcher' + (variant === 'compact' ? '.lang-switcher--compact' : ''), {});
  const btn = h('button.lang-switcher__btn', {
    type: 'button',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
  }, [
    Icon('globe', { size: 16 }),
    h('span', {}, [getLang().toUpperCase()]),
    Icon('chevron-down', { size: 14 }),
  ]);
  const menu = h('div.lang-switcher__menu', { role: 'listbox' },
    SUPPORTED_LANGS.map((l) =>
      h('button.lang-switcher__opt' + (l === getLang() ? '.is-active' : ''), {
        type: 'button',
        role: 'option',
        'aria-selected': String(l === getLang()),
        onClick: async () => {
          await setLang(l);
          close();
          window.dispatchEvent(new CustomEvent('cursus:rerender'));
        },
      }, [LANG_LABEL[l]])
    )
  );

  function open()  { wrap.classList.add('is-open');  btn.setAttribute('aria-expanded', 'true');  }
  function close() { wrap.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
  function toggle() { wrap.classList.toggle('is-open'); }

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });

  onLangChange(() => {
    btn.querySelector('span').textContent = getLang().toUpperCase();
  });

  wrap.append(btn, menu);
  return wrap;
}

export function ThemeToggle() {
  function makeIcon() {
    return getTheme() === 'light' ? Icon('moon', { size: 16 }) : Icon('sun', { size: 16 });
  }
  const btn = h('button.btn btn--ghost theme-toggle', {
    type: 'button',
    'aria-label': 'Basculer le thème',
    onClick: () => toggleTheme(),
  }, [makeIcon()]);

  onThemeChange(() => {
    btn.replaceChildren(makeIcon());
  });

  return btn;
}
