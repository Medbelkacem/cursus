import '../src/styles/tokens.css';
import '../src/styles/base.css';
import '../src/styles/components.css';
import '../src/styles/rtl.css';
// Audit responsive : rend un échantillon représentatif de pages et mesure
// les débordements horizontaux, les cibles tactiles trop petites et les
// textes illisibles. Le viewport est imposé par le pilote (CDP).

import { initI18n } from '../src/lib/i18n.js';
import { initTheme } from '../src/lib/theme.js';
import { initSupabase } from '../src/lib/supabase.js';

const PAGES = [
  ['../src/pages/home.js', 'homePage', 'ministry'],
  ['../src/pages/login.js', 'loginPage', 'ministry'],
  ['../src/pages/shared/dashboard.js', 'ministryDashboardPage', 'ministry'],
  ['../src/pages/shared/dashboard.js', 'establishmentDashboardPage', 'admin'],
  ['../src/pages/ministry/wilayas.js', 'ministryWilayasPage', 'ministry'],
  ['../src/pages/ministry/establishments.js', 'ministryEstablishmentsPage', 'ministry'],
  ['../src/pages/ministry/program-detail.js', 'ministryProgramDetailPage', 'ministry'],
  ['../src/pages/shared/students.js', 'studentsMonitoringPage', 'ministry'],
  ['../src/pages/shared/contracts.js', 'apprenticeshipPage', 'ministry'],
  ['../src/pages/shared/reports.js', 'reportsPage', 'ministry'],
  ['../src/pages/shared/accounts.js', 'accountsPage', 'ministry'],
  ['../src/pages/admin/classes.js', 'adminClassesPage', 'admin'],
  ['../src/pages/student/dashboard.js', 'studentDashboard', 'student'],
  ['../src/pages/student/parcours.js', 'studentParcoursPage', 'student'],
  ['../src/pages/student/contract.js', 'studentApprenticeshipPage', 'student'],
];

const MODULES = import.meta.glob('../src/pages/**/*.js');

// Un élément qui déborde volontairement dans un conteneur à défilement
// horizontal (tableaux) n'est pas un défaut : on remonte la chaîne.
function inScrollableX(el) {
  let n = el;
  while (n && n !== document.body) {
    const s = getComputedStyle(n);
    if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
    n = n.parentElement;
  }
  return false;
}

function audit(vw) {
  const app = document.getElementById('app');
  const problems = [];

  // 1. Débordement horizontal du document
  const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (docOverflow > 1) {
    // trouve les coupables
    const guilty = [];
    for (const el of app.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > vw + 1 && !inScrollableX(el)) {
        guilty.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`
          + ` (droite ${Math.round(r.right)}px)`);
        if (guilty.length >= 4) break;
      }
    }
    problems.push({ type: 'débordement', px: docOverflow, elements: guilty });
  }

  // 2. Cibles tactiles trop petites (mobile / tablette)
  if (vw <= 1024) {
    const small = [];
    for (const el of app.querySelectorAll('button, a[href], select, input[type=checkbox]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 32) {
        small.push(`${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ')[0]}`
          + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
        if (small.length >= 4) break;
      }
    }
    if (small.length) problems.push({ type: 'cible tactile < 32px', elements: small });
  }

  // 3. Texte trop petit
  const tiny = new Set();
  for (const el of app.querySelectorAll('*')) {
    if (!el.firstChild || el.firstChild.nodeType !== 3) continue;
    if (!el.textContent.trim()) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 11) tiny.add(`${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ')[0]} ${fs}px`);
  }
  if (tiny.size) problems.push({ type: 'texte < 11px', elements: [...tiny].slice(0, 4) });

  return problems;
}

async function run() {
  await initI18n();
  initTheme();
  initSupabase();

  const vw = window.innerWidth;
  const app = document.getElementById('app');
  const results = [];

  for (const [path, name, role] of PAGES) {
    window.__ROLE__ = role;
    const id = `${path.split('/pages/')[1]}#${name}`;
    try {
      const mod = await MODULES[path]();
      const node = await mod[name]({ params: { id: '00000000-0000-4000-8000-000000000005' } });
      app.replaceChildren(node);
      await new Promise((r) => setTimeout(r, 60));
      const problems = audit(vw);
      results.push({ id, vw, ok: problems.length === 0, problems });
    } catch (e) {
      results.push({ id, vw, ok: false, problems: [{ type: 'exception', elements: [e.message] }] });
    }
  }

  // Sonde de diagnostic sur la première page à tableau
  const t = app.querySelector('table.table');
  window.__PROBE__ = t ? {
    mq980: window.matchMedia('(max-width: 980px)').matches,
    pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
    tableDisplay: getComputedStyle(t).display,
    tableOverflowX: getComputedStyle(t).overflowX,
    tableWidth: Math.round(t.getBoundingClientRect().width),
    parent: t.parentElement.className,
    parentOverflowX: getComputedStyle(t.parentElement).overflowX,
    innerWidth: window.innerWidth,
    sidebarLinkH: (() => { const a = app.querySelector('.sidebar__link');
      return a ? Math.round(a.getBoundingClientRect().height) : null; })(),
    sidebarLinkPad: (() => { const a = app.querySelector('.sidebar__link');
      return a ? getComputedStyle(a).paddingTop + '/' + getComputedStyle(a).display : null; })(),
  } : null;

  window.__RESPONSIVE__ = results;
}

run();
