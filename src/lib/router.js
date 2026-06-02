// ─────────────────────────────────────────────────────────────────────────────
//  Router — minimal, sans dépendance, basé sur history.pushState.
//
//  Une route est une fonction async `(ctx) => HTMLElement | string`.  Le routeur
//  remplace le contenu de #app à chaque navigation.  Les liens internes utilisent
//  `data-link` (intercepté ici) pour éviter le rechargement complet.
//
//  Les routes peuvent être déclarées avec :
//    - une RegExp dans `path` (matching pur)
//    - un pattern string avec ":param" (matching + extraction de params)
// ─────────────────────────────────────────────────────────────────────────────

import { homePage } from '../pages/home.js';
import { notFoundPage } from '../pages/not-found.js';
import { designPage } from '../pages/design.js';
import { loginPage } from '../pages/login.js';
import { signupPage } from '../pages/signup.js';
import { pendingPage, rejectedPage } from '../pages/pending.js';
import { profilePage } from '../pages/profile.js';

import { studentDashboard } from '../pages/student/dashboard.js';
import { studentCoursesPage } from '../pages/student/courses.js';
import { studentAttendancePage } from '../pages/student/attendance.js';
import { studentGradesPage } from '../pages/student/grades.js';
import { studentExamsPage } from '../pages/student/exams.js';
import { studentDocumentsPage } from '../pages/student/documents.js';

import { teacherDashboard } from '../pages/teacher/dashboard.js';
import { teacherSubjectsPage } from '../pages/teacher/subjects.js';
import { teacherAttendancePage } from '../pages/teacher/attendance.js';
import { teacherGradesPage } from '../pages/teacher/grades.js';
import { teacherExamsPage } from '../pages/teacher/exams.js';
import { teacherCoursesPage } from '../pages/teacher/courses.js';

import { adminDashboard } from '../pages/admin/dashboard.js';
import { adminUsersPage } from '../pages/admin/users.js';
import { adminSpecialtiesPage } from '../pages/admin/specialties.js';
import { adminSubjectsPage } from '../pages/admin/subjects.js';
import { adminRequestsPage } from '../pages/admin/requests.js';

import { directionDashboard } from '../pages/direction/dashboard.js';
import { directionEstablishmentsPage } from '../pages/direction/establishments.js';
import { directionStatsPage } from '../pages/direction/stats.js';

import { ministryDashboard } from '../pages/ministry/dashboard.js';
import { ministryDirectionsPage } from '../pages/ministry/directions.js';
import { ministryEstablishmentsPage } from '../pages/ministry/establishments.js';
import { ministryStatsPage } from '../pages/ministry/stats.js';

// Convertit un pattern type "/etudiant/examens/:id" en {regex, keys}
function compile(pattern) {
  if (pattern instanceof RegExp) return { regex: pattern, keys: [] };
  const keys = [];
  const re = pattern.replace(/:[a-zA-Z_]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  });
  return { regex: new RegExp('^' + re + '$'), keys };
}

const _routes = [
  // ── Public ─────────────────────────────────────────────────────────────
  ['/',                                  homePage],
  ['/design',                            designPage],
  ['/login',                             loginPage],
  ['/signup',                            signupPage],
  ['/en-attente',                        pendingPage],
  ['/refuse',                            rejectedPage],
  ['/profil',                            profilePage],

  // ── Étudiant ───────────────────────────────────────────────────────────
  ['/etudiant',                          studentDashboard],
  ['/etudiant/cours',                    studentCoursesPage],
  ['/etudiant/presence',                 studentAttendancePage],
  ['/etudiant/notes',                    studentGradesPage],
  ['/etudiant/examens',                  studentExamsPage],
  ['/etudiant/examens/:id',              studentExamsPage],
  ['/etudiant/documents',                studentDocumentsPage],

  // ── Professeur ─────────────────────────────────────────────────────────
  ['/professeur',                        teacherDashboard],
  ['/professeur/matieres',               teacherSubjectsPage],
  ['/professeur/presence',               teacherAttendancePage],
  ['/professeur/notes',                  teacherGradesPage],
  ['/professeur/examens',                teacherExamsPage],
  ['/professeur/supports',               teacherCoursesPage],

  // ── Administration ─────────────────────────────────────────────────────
  ['/administration',                    adminDashboard],
  ['/administration/utilisateurs',       adminUsersPage],
  ['/administration/specialites',        adminSpecialtiesPage],
  ['/administration/matieres',           adminSubjectsPage],
  ['/administration/demandes',           adminRequestsPage],

  // ── Direction ──────────────────────────────────────────────────────────
  ['/direction',                         directionDashboard],
  ['/direction/etablissements',          directionEstablishmentsPage],
  ['/direction/statistiques',            directionStatsPage],

  // ── Ministère ──────────────────────────────────────────────────────────
  ['/ministere',                         ministryDashboard],
  ['/ministere/directions',              ministryDirectionsPage],
  ['/ministere/etablissements',          ministryEstablishmentsPage],
  ['/ministere/statistiques',            ministryStatsPage],
].map(([p, page]) => ({ ...compile(p), page }));

let _root = null;

export async function initRouter(rootEl) {
  _root = rootEl;

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
    e.preventDefault();
    navigate(href);
  });

  window.addEventListener('popstate', () => render(window.location.pathname));

  await render(window.location.pathname);
}

export function navigate(path) {
  if (path === window.location.pathname + window.location.search) return;
  window.history.pushState({}, '', path);
  render(path);
}

async function render(path) {
  let match = null;
  let params = {};
  for (const r of _routes) {
    const m = path.match(r.regex);
    if (m) {
      match = r;
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      break;
    }
  }
  const page = match ? match.page : notFoundPage;
  const ctx = { path, params };

  _root.classList.add('is-leaving');
  await new Promise((r) => requestAnimationFrame(r));

  let content;
  try {
    content = await page(ctx);
  } catch (err) {
    console.error('[router] page render error', err);
    content = `<div class="app-fatal"><h1>Erreur de page</h1><pre>${String(err.message || err)}</pre></div>`;
  }

  if (content instanceof HTMLElement) {
    _root.replaceChildren(content);
  } else if (content != null) {
    _root.innerHTML = String(content);
  }
  _root.classList.remove('is-leaving');
  window.scrollTo(0, 0);
}
