import { t } from '../lib/i18n.js';

export async function notFoundPage() {
  const el = document.createElement('main');
  el.id = 'main-content';
  el.setAttribute('role', 'main');
  el.setAttribute('tabindex', '-1');
  el.className = 'app-fatal';
  el.innerHTML = `
    <p class="kicker">404</p>
    <h1>${t('not_found.title')}</h1>
    <p>${t('not_found.lede')}</p>
    <a href="/" data-link class="btn btn--primary">${t('not_found.cta')}</a>
  `;
  return el;
}
