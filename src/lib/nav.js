// Configuration de la navigation latérale selon le rôle (§25 — la hiérarchie
// Ministère → Wilaya → Établissement → Professeur → Étudiant se reflète ici).
//
// Les libellés passent par i18n : la barre latérale reste traduite en fr / en / ar.

import { t } from './i18n.js';

export function navFor(role) {
  switch (role) {
    // ── Ministère : niveau national ─────────────────────────────────────
    case 'ministry':
      return [
        { label: t('nav.dashboard'),  icon: 'dashboard',  path: '/ministere' },
        { label: t('nav.wilayas'),          icon: 'map-pin',    path: '/ministere/wilayas' },
        { label: t('nav.establishments'),   icon: 'building',   path: '/ministere/etablissements' },
        { label: t('nav.programs'),       icon: 'book',       path: '/ministere/programmes' },
        { label: t('nav.modes'), icon: 'layers',   path: '/ministere/modes' },
        { label: t('nav.students'),        icon: 'users',      path: '/ministere/etudiants' },
        { label: t('nav.apprenticeship'),    icon: 'briefcase',  path: '/ministere/apprentissage' },
        { label: t('nav.internships'),           icon: 'award',      path: '/ministere/stages' },
        { label: t('nav.rules'),        icon: 'shield',     path: '/ministere/reglement' },
        { label: t('nav.accounts'),          icon: 'user-plus',  path: '/ministere/comptes' },
        { label: t('nav.reports'),         icon: 'file-text',  path: '/ministere/rapports' },
        { label: t('nav.notifications'),    icon: 'bell',       path: '/notifications' },
        { label: t('common.my_profile'),       icon: 'settings',   path: '/profil' },
      ];

    // ── Direction de wilaya : périmètre wilaya ──────────────────────────
    case 'direction':
      return [
        { label: t('nav.dashboard'),  icon: 'dashboard',  path: '/direction' },
        { label: t('nav.establishments'),   icon: 'building',   path: '/direction/etablissements' },
        { label: t('nav.students'),        icon: 'users',      path: '/direction/etudiants' },
        { label: t('nav.programs'),       icon: 'book',       path: '/direction/programmes' },
        { label: t('nav.apprenticeship'),    icon: 'briefcase',  path: '/direction/apprentissage' },
        { label: t('nav.internships'),           icon: 'award',      path: '/direction/stages' },
        { label: t('nav.rules'),        icon: 'shield',     path: '/direction/reglement' },
        { label: t('nav.accounts'),          icon: 'user-plus',  path: '/direction/comptes' },
        { label: t('nav.reports'),         icon: 'file-text',  path: '/direction/rapports' },
        { label: t('nav.notifications'),    icon: 'bell',       path: '/notifications' },
        { label: t('common.my_profile'),       icon: 'settings',   path: '/profil' },
      ];

    // ── Établissement ───────────────────────────────────────────────────
    case 'admin':
      return [
        { label: t('nav.dashboard'),  icon: 'dashboard',  path: '/administration' },
        { label: t('nav.students'),        icon: 'users',      path: '/administration/etudiants' },
        { label: t('nav.classes'),          icon: 'layers',     path: '/administration/classes' },
        { label: t('nav.subjects'),         icon: 'book',       path: '/administration/matieres' },
        { label: t('nav.programs'),       icon: 'graduation', path: '/administration/programmes' },
        { label: t('nav.apprenticeship'),    icon: 'briefcase',  path: '/administration/apprentissage' },
        { label: t('nav.internships'),           icon: 'award',      path: '/administration/stages' },
        { label: t('nav.rules'),        icon: 'shield',     path: '/administration/reglement' },
        { label: t('nav.accounts'),          icon: 'user-plus',  path: '/administration/comptes' },
        { label: t('nav.requests'),         icon: 'mail',       path: '/administration/demandes' },
        { label: t('nav.reports'),         icon: 'file-text',  path: '/administration/rapports' },
        { label: t('nav.notifications'),    icon: 'bell',       path: '/notifications' },
        { label: t('common.my_profile'),       icon: 'settings',   path: '/profil' },
      ];

    // ── Professeur / formateur ──────────────────────────────────────────
    case 'teacher':
      return [
        { label: t('nav.dashboard'),  icon: 'dashboard',    path: '/professeur' },
        { label: t('nav.my_subjects'),     icon: 'book',         path: '/professeur/matieres' },
        { label: t('nav.attendance'),         icon: 'check-circle', path: '/professeur/presence' },
        { label: t('nav.grades'),            icon: 'chart',        path: '/professeur/notes' },
        { label: t('nav.exams'),          icon: 'file-text',    path: '/professeur/examens' },
        { label: t('nav.materials'),         icon: 'upload',       path: '/professeur/supports' },
        { label: t('nav.programs'),       icon: 'graduation',   path: '/professeur/programmes' },
        { label: t('nav.notifications'),    icon: 'bell',         path: '/notifications' },
        { label: t('common.my_profile'),       icon: 'settings',     path: '/profil' },
      ];

    // ── Étudiant ────────────────────────────────────────────────────────
    case 'student':
      return [
        { label: t('nav.dashboard'),  icon: 'dashboard',    path: '/etudiant' },
        { label: t('nav.path'),         icon: 'trending',     path: '/etudiant/parcours' },
        { label: t('nav.program'),        icon: 'book',         path: '/etudiant/programme' },
        { label: t('nav.courses'),            icon: 'folder',       path: '/etudiant/cours' },
        { label: t('nav.attendance'),         icon: 'check-circle', path: '/etudiant/presence' },
        { label: t('nav.grades'),            icon: 'chart',        path: '/etudiant/notes' },
        { label: t('nav.exams'),          icon: 'file-text',    path: '/etudiant/examens' },
        { label: t('nav.apprenticeship'),    icon: 'briefcase',    path: '/etudiant/apprentissage' },
        { label: t('nav.internship_s5'),         icon: 'award',        path: '/etudiant/stage' },
        { label: t('nav.documents'),        icon: 'file',         path: '/etudiant/documents' },
        { label: t('nav.notifications'),    icon: 'bell',         path: '/notifications' },
        { label: t('common.my_profile'),       icon: 'settings',     path: '/profil' },
      ];

    default:
      return [];
  }
}

export function roleLabel(role) {
  return role ? t(`roles.${role}`) : '';
}

export function initialsOf(profile) {
  if (!profile) return '?';
  const a = (profile.first_name || '').trim()[0] || '';
  const b = (profile.last_name  || '').trim()[0] || '';
  return (a + b).toUpperCase() || (profile.email || '?')[0].toUpperCase();
}
