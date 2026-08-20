import '../src/styles/tokens.css';
import '../src/styles/base.css';
import '../src/styles/components.css';
import '../src/styles/rtl.css';
// Rend chaque page de l'application avec des données simulées et remonte
// toute erreur d'exécution. Résultat exposé dans window.__RESULT__.

import { initI18n } from '../src/lib/i18n.js';
import { initTheme } from '../src/lib/theme.js';
import { initSupabase } from '../src/lib/supabase.js';

const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
const origWarn = console.warn;
console.warn = (...a) => { errors.push('WARN ' + a.map(String).join(' ')); origWarn(...a); };
window.addEventListener('error', (e) => errors.push('UNCAUGHT ' + e.message));
// Trace ce qui provoque un rechargement de page (interdit dans le harnais).
window.addEventListener('beforeunload', () => {
  try { sessionStorage.setItem('reloadedAt', String(window.__CURRENT__ || 'inconnu')); } catch (_) {}
});
try {
  const prev = sessionStorage.getItem('reloadedAt');
  if (prev) { window.__RELOAD_TRACE__ = prev; sessionStorage.removeItem('reloadedAt'); }
} catch (_) {}
window.addEventListener('unhandledrejection', (e) =>
  errors.push('REJECTION ' + (e.reason?.message || e.reason)));

const PAGES = [
  // [chemin du module, export, rôle, ctx]
  ['../src/pages/home.js', 'homePage', 'ministry'],
  ['../src/pages/login.js', 'loginPage', 'ministry'],
  ['../src/pages/signup.js', 'signupPage', 'ministry'],
  ['../src/pages/profile.js', 'profilePage', 'student'],
  ['../src/pages/shared/notifications.js', 'notificationsPage', 'student'],
  ['../src/pages/shared/notifications.js', 'notificationsPage', 'ministry'],

  ['../src/pages/shared/dashboard.js', 'ministryDashboardPage', 'ministry'],
  ['../src/pages/shared/dashboard.js', 'wilayaDashboardPage', 'direction'],
  ['../src/pages/shared/dashboard.js', 'establishmentDashboardPage', 'admin'],

  ['../src/pages/ministry/wilayas.js', 'ministryWilayasPage', 'ministry'],
  ['../src/pages/ministry/establishments.js', 'ministryEstablishmentsPage', 'ministry'],
  ['../src/pages/ministry/programs.js', 'ministryProgramsPage', 'ministry'],
  ['../src/pages/ministry/program-detail.js', 'ministryProgramDetailPage', 'ministry',
    { params: { id: '00000000-0000-4000-8000-000000000005' } }],
  ['../src/pages/ministry/modes.js', 'ministryModesPage', 'ministry'],

  ['../src/pages/shared/accounts.js', 'accountsPage', 'ministry'],
  ['../src/pages/shared/accounts.js', 'accountsPage', 'direction'],
  ['../src/pages/shared/accounts.js', 'accountsPage', 'admin'],
  ['../src/pages/shared/students.js', 'studentsMonitoringPage', 'ministry'],
  ['../src/pages/shared/students.js', 'studentsMonitoringPage', 'admin'],
  ['../src/pages/shared/rules.js', 'academicRulesPage', 'ministry'],
  ['../src/pages/shared/rules.js', 'academicRulesPage', 'admin'],
  ['../src/pages/shared/reports.js', 'reportsPage', 'ministry'],
  ['../src/pages/shared/reports.js', 'reportsPage', 'admin'],
  ['../src/pages/shared/contracts.js', 'apprenticeshipPage', 'ministry'],
  ['../src/pages/shared/contracts.js', 'internshipPage', 'direction'],
  ['../src/pages/shared/contracts.js', 'internshipPage', 'admin'],
  ['../src/pages/shared/programs-view.js', 'programsCatalogPage', 'admin'],
  ['../src/pages/shared/programs-view.js', 'programsCatalogPage', 'teacher'],

  ['../src/pages/direction/establishments.js', 'directionEstablishmentsPage', 'direction'],
  ['../src/pages/admin/classes.js', 'adminClassesPage', 'admin'],
  ['../src/pages/admin/subjects.js', 'adminSubjectsPage', 'admin'],
  ['../src/pages/admin/requests.js', 'adminRequestsPage', 'admin'],

  ['../src/pages/student/dashboard.js', 'studentDashboard', 'student'],
  ['../src/pages/student/parcours.js', 'studentParcoursPage', 'student'],
  ['../src/pages/student/programme.js', 'studentProgrammePage', 'student'],
  ['../src/pages/student/contract.js', 'studentApprenticeshipPage', 'student'],
  ['../src/pages/student/contract.js', 'studentInternshipPage', 'student'],
  ['../src/pages/student/courses.js', 'studentCoursesPage', 'student'],
  ['../src/pages/student/attendance.js', 'studentAttendancePage', 'student'],
  ['../src/pages/student/grades.js', 'studentGradesPage', 'student'],
  ['../src/pages/student/exams.js', 'studentExamsPage', 'student'],
  ['../src/pages/student/documents.js', 'studentDocumentsPage', 'student'],

  ['../src/pages/teacher/dashboard.js', 'teacherDashboard', 'teacher'],
  ['../src/pages/teacher/subjects.js', 'teacherSubjectsPage', 'teacher'],
  ['../src/pages/teacher/attendance.js', 'teacherAttendancePage', 'teacher'],
  ['../src/pages/teacher/grades.js', 'teacherGradesPage', 'teacher'],
  ['../src/pages/teacher/exams.js', 'teacherExamsPage', 'teacher'],
  ['../src/pages/teacher/courses.js', 'teacherCoursesPage', 'teacher'],
];

const MODULES = import.meta.glob('../src/pages/**/*.js');

async function run() {
  await initI18n();
  initTheme();
  initSupabase();

  const app = document.getElementById('app');
  const results = [];
  window.__PROGRESS__ = results;

  for (const [path, name, role, ctx] of PAGES) {
    window.__ROLE__ = role;
    const before = errors.length;
    const id = `${path.split('/pages/')[1]}#${name}(${role})`;
    window.__CURRENT__ = id;
    try {
      const loader = MODULES[path];
      if (!loader) { results.push({ id, ok: false, err: 'module introuvable' }); continue; }
      const mod = await loader();
      const fn = mod[name];
      if (typeof fn !== 'function') {
        results.push({ id, ok: false, err: `export ${name} absent` });
        continue;
      }
      const node = await fn(ctx || {});
      app.replaceChildren(node instanceof Node ? node : document.createTextNode(String(node)));

      const html = app.innerHTML;

      const fresh = errors.slice(before);
      const redirected = html.includes('__WRONG_ROLE__');
      const errBlock = html.includes('Erreur :');
      results.push({
        id,
        ok: fresh.length === 0 && !errBlock && !redirected && html.length > 200,
        len: html.length,
        errBlock,
        redirected,
        err: fresh.join(' | ') || (errBlock ? 'ErrorBlock rendu' : redirected ? 'redirigé' : null),
        snippet: errBlock ? html.slice(Math.max(0, html.indexOf('Erreur :') - 300),
                                       html.indexOf('Erreur :') + 400) : undefined,
      });
    } catch (e) {
      results.push({ id, ok: false, err: `THROW ${e.message}` });
    }
  }

  // ── Phase 2 : ouverture des modales et interaction avec les tableaux ──────
  // Pages dont le clic sur une ligne navigue (au lieu d'ouvrir une modale) :
  // le routeur n'est pas monté dans le harnais, on ne les clique donc pas.
  const NAVIGATES_ON_ROW = new Set(['../src/pages/ministry/programs.js']);

  const interactions = [];
  const INTERACTIVE = [
    ['../src/pages/ministry/wilayas.js', 'ministryWilayasPage', 'ministry'],
    ['../src/pages/ministry/establishments.js', 'ministryEstablishmentsPage', 'ministry'],
    ['../src/pages/ministry/programs.js', 'ministryProgramsPage', 'ministry'],
    ['../src/pages/ministry/modes.js', 'ministryModesPage', 'ministry'],
    ['../src/pages/ministry/program-detail.js', 'ministryProgramDetailPage', 'ministry'],
    ['../src/pages/shared/accounts.js', 'accountsPage', 'ministry'],
    ['../src/pages/shared/accounts.js', 'accountsPage', 'admin'],
    ['../src/pages/shared/rules.js', 'academicRulesPage', 'ministry'],
    ['../src/pages/shared/students.js', 'studentsMonitoringPage', 'ministry'],
    ['../src/pages/shared/contracts.js', 'apprenticeshipPage', 'ministry'],
    ['../src/pages/shared/programs-view.js', 'programsCatalogPage', 'admin'],
    ['../src/pages/shared/notifications.js', 'notificationsPage', 'ministry'],
    ['../src/pages/admin/classes.js', 'adminClassesPage', 'admin'],
    ['../src/pages/direction/establishments.js', 'directionEstablishmentsPage', 'direction'],
    ['../src/pages/student/contract.js', 'studentApprenticeshipPage', 'student'],
  ];

  const tick = () => new Promise((r) => setTimeout(r, 40));

  for (const [path, name, role] of INTERACTIVE) {
    window.__ROLE__ = role;
    const id = `${path.split('/pages/')[1]}#${name}(${role})`;
    window.__CURRENT__ = 'interact ' + id;
    const before = errors.length;
    try {
      const mod = await MODULES[path]();
      const node = await mod[name]({ params: { id: '00000000-0000-4000-8000-000000000005' } });
      app.replaceChildren(node);
      await tick();

      // a) filtres, tri et recherche du DataTable
      let tableOps = 0;
      for (const sel of app.querySelectorAll('.dt__filter select')) {
        if (sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          await tick();
          sel.selectedIndex = 0;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          tableOps++;
        }
      }
      const search = app.querySelector('.dt__search input');
      if (search) {
        search.value = 'zzz-aucun-resultat';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        tableOps++;
      }
      for (const th of [...app.querySelectorAll('.th--sortable')].slice(0, 3)) {
        th.click(); await tick(); th.click(); await tick(); tableOps++;
      }

      // b) ouverture d'une ligne (fiche détaillée)
      const row = NAVIGATES_ON_ROW.has(path) ? null : app.querySelector('tr.tr--clickable');
      let rowModal = false;
      if (row) {
        window.__CURRENT__ = `ligne de ${id}`;
        row.click();
        await new Promise((r) => setTimeout(r, 120));
        rowModal = !!document.querySelector('.modal');
        const fieldsInModal = document.querySelectorAll('.modal .field').length;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await tick();
        interactions.push({
          id: id + ' :: ligne', ok: rowModal && errors.length === before,
          modal: rowModal, fields: fieldsInModal,
          stillOpen: !!document.querySelector('.modal'),
          err: errors.slice(before).join(' | ') || null,
        });
      }

      // c) boutons d'action de l'en-tête (création)
      // Les actions qui écrivent puis rechargent la page sont exclues : le
      // harnais teste l'ouverture des formulaires, pas les mutations réelles.
      const SKIP = ['Tout marquer comme lu'];
      const actionBtns = [...app.querySelectorAll('.section-head button.btn')]
        .filter((b) => !SKIP.includes(b.textContent.trim()));
      for (const btn of actionBtns.slice(0, 3)) {
        const label = btn.textContent.trim();
        const b2 = errors.length;
        window.__CURRENT__ = `bouton « ${label} » sur ${id}`;
        btn.click();
        await new Promise((r) => setTimeout(r, 150));
        const modal = document.querySelector('.modal');
        const fields = document.querySelectorAll('.modal .field').length;
        // teste la bascule d'un select de la modale (visibilité conditionnelle)
        const modalSel = document.querySelector('.modal select');
        if (modalSel && modalSel.options.length > 1) {
          modalSel.selectedIndex = 1;
          modalSel.dispatchEvent(new Event('change', { bubbles: true }));
          await tick();
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await tick();
        interactions.push({
          id: `${id} :: « ${label} »`,
          ok: errors.length === b2 && !document.querySelector('.modal'),
          modal: !!modal, fields,
          err: errors.slice(b2).join(' | ') || null,
        });
      }

      interactions.push({ id: id + ' :: tableau', ok: errors.length === before,
                          ops: tableOps, err: errors.slice(before).join(' | ') || null });
    } catch (e) {
      interactions.push({ id, ok: false, err: `THROW ${e.message}` });
    }
    // nettoie les modales résiduelles et l'URL
    document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
    document.body.classList.remove('modal-open');
  }

  window.__RESULT__ = results;
  window.__INTERACTIONS__ = interactions;
  document.title = 'DONE ' + results.filter((r) => !r.ok).length;
}

run();
