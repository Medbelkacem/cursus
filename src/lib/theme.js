// ─────────────────────────────────────────────────────────────────────────────
//  Thème — light / dark, persistant.
//
//  Le bloc inline dans index.html applique déjà `data-theme` avant que ce
//  module soit chargé, ce qui évite le flash. Ce module se charge :
//    - de lire l'état initial,
//    - d'exposer setTheme/toggleTheme,
//    - de notifier les abonnés (utile pour les graphiques qui doivent se redessiner).
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cursus.theme';
const VALID = new Set(['light', 'dark']);

let _state = {
  theme: 'light',
  listeners: new Set(),
};

export function initTheme() {
  let theme;
  try { theme = localStorage.getItem(STORAGE_KEY); } catch (_) {}
  if (!VALID.has(theme)) {
    theme = import.meta.env.VITE_DEFAULT_THEME || 'light';
    if (!VALID.has(theme)) theme = 'light';
  }
  applyTheme(theme);
}

function applyTheme(theme) {
  _state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  _state.listeners.forEach((fn) => fn(theme));
}

export function setTheme(theme) {
  if (!VALID.has(theme)) return;
  applyTheme(theme);
}

export function toggleTheme() {
  applyTheme(_state.theme === 'light' ? 'dark' : 'light');
}

export function getTheme() {
  return _state.theme;
}

export function onThemeChange(fn) {
  _state.listeners.add(fn);
  return () => _state.listeners.delete(fn);
}
