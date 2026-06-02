// ─────────────────────────────────────────────────────────────────────────────
//  i18n — vanilla, sans dépendance.
//
//  - Trois langues : fr, en, ar.
//  - La langue est lue/écrite dans localStorage (clé `cursus.lang`).
//  - L'arabe bascule automatiquement `<html dir="rtl">`.
//  - Les bundles sont importés dynamiquement (un seul JSON dans le bundle initial).
//  - Pattern d'usage :  t('common.save')  ou  t('hello', { name: 'Rania' })
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED = ['fr', 'en', 'ar'];
const RTL = new Set(['ar']);
const STORAGE_KEY = 'cursus.lang';

let _state = {
  lang: 'fr',
  dict: {},
  listeners: new Set(),
};

function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch (_) { /* ignore */ }

  const fallback = import.meta.env.VITE_DEFAULT_LANG || 'fr';
  if (SUPPORTED.includes(fallback)) return fallback;

  const nav = (navigator.language || 'fr').slice(0, 2);
  return SUPPORTED.includes(nav) ? nav : 'fr';
}

async function loadBundle(lang) {
  // Vite résout statiquement chaque branche, donc les 3 JSON sont code-split.
  switch (lang) {
    case 'fr': return (await import('../locales/fr.json')).default;
    case 'en': return (await import('../locales/en.json')).default;
    case 'ar': return (await import('../locales/ar.json')).default;
    default:   return (await import('../locales/fr.json')).default;
  }
}

export async function initI18n() {
  const lang = detectLang();
  await setLang(lang, { silent: true });
}

export async function setLang(lang, opts = {}) {
  if (!SUPPORTED.includes(lang)) return;
  _state.lang = lang;
  _state.dict = await loadBundle(lang);

  try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}

  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', RTL.has(lang) ? 'rtl' : 'ltr');

  if (!opts.silent) _state.listeners.forEach((fn) => fn(lang));
}

export function getLang() {
  return _state.lang;
}

export function isRTL() {
  return RTL.has(_state.lang);
}

export function onLangChange(fn) {
  _state.listeners.add(fn);
  return () => _state.listeners.delete(fn);
}

// Accès par chemin pointé :  t('auth.login.title')
function lookup(dict, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), dict);
}

export function t(key, vars) {
  let val = lookup(_state.dict, key);
  if (val == null) return key; // fallback explicite : on voit la clé manquante
  if (vars && typeof val === 'string') {
    val = val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
  }
  return val;
}

export const SUPPORTED_LANGS = SUPPORTED;
