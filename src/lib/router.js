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

// ── Écrans partagés par plusieurs rôles ──────────────────────────────────────
import { notificationsPage } from '../pages/shared/notifications.js';
import { accountsPage } from '../pages/shared/accounts.js';
import { studentsMonitoringPage } from '../pages/shared/students.js';
import { academicRulesPage } from '../pages/shared/rules.js';
import { reportsPage } from '../pages/shared/reports.js';
import { programsCatalogPage } from '../pages/shared/programs-view.js';
import { apprenticeshipPage, internshipPage } from '../pages/shared/contracts.js';
import {
  ministryDashboardPage, wilayaDashboardPage, establishmentDashboardPage,
} from '../pages/shared/dashboard.js';

// ── Étudiant ────────────────────────────────────────────────────────────────
import { studentDashboard } from '../pages/student/dashboard.js';
import { studentParcoursPage } from '../pages/student/parcours.js';
import { studentProgrammePage } from '../pages/student/programme.js';
import { studentCoursesPage } from '../pages/student/courses.js';
import { studentAttendancePage } from '../pages/student/attendance.js';
import { studentGradesPage } from '../pages/student/grades.js';
import { studentExamsPage } from '../pages/student/exams.js';
import { studentDocumentsPage } from '../pages/student/documents.js';
import { studentApprenticeshipPage, studentInternshipPage } from '../pages/student/contract.js';

// ── Professeur ──────────────────────────────────────────────────────────────
import { teacherDashboard } from '../pages/teacher/dashboard.js';
import { teacherSubjectsPage } from '../pages/teacher/subjects.js';
import { teacherAttendancePage } from '../pages/teacher/attendance.js';
import { teacherGradesPage } from '../pages/teacher/grades.js';
import { teacherExamsPage } from '../pages/teacher/exams.js';
import { teacherCoursesPage } from '../pages/teacher/courses.js';

// ── Établissement ───────────────────────────────────────────────────────────
import { adminSubjectsPage } from '../pages/admin/subjects.js';
import { adminRequestsPage } from '../pages/admin/requests.js';
import { adminClassesPage } from '../pages/admin/classes.js';

// ── Direction de wilaya ─────────────────────────────────────────────────────
import { directionEstablishmentsPage } from '../pages/direction/establishments.js';

// ── Ministère ───────────────────────────────────────────────────────────────
import { ministryWilayasPage } from '../pages/ministry/wilayas.js';
import { ministryEstablishmentsPage } from '../pages/ministry/establishments.js';
import { ministryProgramsPage } from '../pages/ministry/programs.js';
import { ministryProgramDetailPage } from '../pages/ministry/program-detail.js';
import { ministryModesPage } from '../pages/ministry/modes.js';

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

  // ── Commun à tous les rôles authentifiés ───────────────────────────────
  ['/profil',                            profilePage],
  ['/notifications',                     notificationsPage],

  // ── Étudiant (§15) ─────────────────────────────────────────────────────
  ['/etudiant',                          studentDashboard],
  ['/etudiant/parcours',                 studentParcoursPage],
  ['/etudiant/programme',                studentProgrammePage],
  ['/etudiant/cours',                    studentCoursesPage],
  ['/etudiant/presence',                 studentAttendancePage],
  ['/etudiant/notes',                    studentGradesPage],
  ['/etudiant/examens',                  studentExamsPage],
  ['/etudiant/examens/:id',              studentExamsPage],
  ['/etudiant/documents',                studentDocumentsPage],
  ['/etudiant/apprentissage',            studentApprenticeshipPage],
  ['/etudiant/stage',                    studentInternshipPage],

  // ── Professeur (§16) ───────────────────────────────────────────────────
  ['/professeur',                        teacherDashboard],
  ['/professeur/matieres',               teacherSubjectsPage],
  ['/professeur/presence',               teacherAttendancePage],
  ['/professeur/notes',                  teacherGradesPage],
  ['/professeur/examens',                teacherExamsPage],
  ['/professeur/supports',               teacherCoursesPage],
  ['/professeur/programmes',             programsCatalogPage],

  // ── Établissement (§19) ────────────────────────────────────────────────
  ['/administration',                    establishmentDashboardPage],
  ['/administration/etudiants',          studentsMonitoringPage],
  ['/administration/classes',            adminClassesPage],
  ['/administration/matieres',           adminSubjectsPage],
  ['/administration/programmes',         programsCatalogPage],
  ['/administration/apprentissage',      apprenticeshipPage],
  ['/administration/stages',             internshipPage],
  ['/administration/reglement',          academicRulesPage],
  ['/administration/comptes',            accountsPage],
  ['/administration/utilisateurs',       accountsPage],
  ['/administration/demandes',           adminRequestsPage],
  ['/administration/rapports',           reportsPage],

  // ── Direction de wilaya (§18) ──────────────────────────────────────────
  ['/direction',                         wilayaDashboardPage],
  ['/direction/etablissements',          directionEstablishmentsPage],
  ['/direction/etudiants',               studentsMonitoringPage],
  ['/direction/programmes',              programsCatalogPage],
  ['/direction/apprentissage',           apprenticeshipPage],
  ['/direction/stages',                  internshipPage],
  ['/direction/reglement',               academicRulesPage],
  ['/direction/comptes',                 accountsPage],
  ['/direction/rapports',                reportsPage],
  ['/direction/statistiques',            wilayaDashboardPage],

  // ── Ministère (§17) ────────────────────────────────────────────────────
  ['/ministere',                         ministryDashboardPage],
  ['/ministere/wilayas',                 ministryWilayasPage],
  ['/ministere/etablissements',          ministryEstablishmentsPage],
  ['/ministere/programmes',              ministryProgramsPage],
  ['/ministere/programmes/:id',          ministryProgramDetailPage],
  ['/ministere/modes',                   ministryModesPage],
  ['/ministere/etudiants',               studentsMonitoringPage],
  ['/ministere/apprentissage',           apprenticeshipPage],
  ['/ministere/stages',                  internshipPage],
  ['/ministere/reglement',               academicRulesPage],
  ['/ministere/comptes',                 accountsPage],
  ['/ministere/rapports',                reportsPage],
  ['/ministere/statistiques',            ministryDashboardPage],
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

  window.addEventListener('popstate', () =>
    render(window.location.pathname + window.location.search));

  await render(window.location.pathname + window.location.search);
}

export function navigate(path) {
  if (path === window.location.pathname + window.location.search) return;
  window.history.pushState({}, '', path);
  render(path);
}

async function render(fullPath) {
  // Le pattern ne s'applique qu'au chemin ; la query string est exposée à part.
  const qIndex = fullPath.indexOf('?');
  const path  = qIndex === -1 ? fullPath : fullPath.slice(0, qIndex);
  const query = new URLSearchParams(qIndex === -1 ? '' : fullPath.slice(qIndex));

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
  const ctx = { path, params, query, fullPath };

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
