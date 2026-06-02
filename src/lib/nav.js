// Configuration de la navigation latérale selon le rôle.
import { t } from './i18n.js';

export function navFor(role) {
  switch (role) {
    case 'student':
      return [
        { label: t('nav.dashboard'),  icon: 'dashboard',    path: '/etudiant' },
        { label: t('nav.courses'),    icon: 'book',         path: '/etudiant/cours' },
        { label: t('nav.attendance'), icon: 'check-circle', path: '/etudiant/presence' },
        { label: t('nav.grades'),     icon: 'chart',        path: '/etudiant/notes' },
        { label: t('nav.exams'),      icon: 'file-text',    path: '/etudiant/examens' },
        { label: t('nav.documents'),  icon: 'file',         path: '/etudiant/documents' },
        { label: t('common.profile'), icon: 'settings',     path: '/profil' },
      ];
    case 'teacher':
      return [
        { label: t('nav.dashboard'),  icon: 'dashboard',    path: '/professeur' },
        { label: t('nav.subjects'),   icon: 'book',         path: '/professeur/matieres' },
        { label: t('nav.attendance'), icon: 'check-circle', path: '/professeur/presence' },
        { label: t('nav.grades'),     icon: 'chart',        path: '/professeur/notes' },
        { label: t('nav.exams'),      icon: 'file-text',    path: '/professeur/examens' },
        { label: t('nav.courses'),    icon: 'upload',       path: '/professeur/supports' },
        { label: t('common.profile'), icon: 'settings',     path: '/profil' },
      ];
    case 'admin':
      return [
        { label: t('nav.dashboard'),     icon: 'dashboard', path: '/administration' },
        { label: t('nav.users'),         icon: 'users',     path: '/administration/utilisateurs' },
        { label: t('nav.specialties'),   icon: 'graduation', path: '/administration/specialites' },
        { label: t('nav.subjects'),      icon: 'book',     path: '/administration/matieres' },
        { label: t('nav.requests'),      icon: 'mail',     path: '/administration/demandes' },
        { label: t('common.profile'),    icon: 'settings', path: '/profil' },
      ];
    case 'direction':
      return [
        { label: t('nav.dashboard'),      icon: 'dashboard',   path: '/direction' },
        { label: t('nav.establishments'), icon: 'building',    path: '/direction/etablissements' },
        { label: t('nav.statistics'),     icon: 'chart',       path: '/direction/statistiques' },
        { label: t('common.profile'),     icon: 'settings',    path: '/profil' },
      ];
    case 'ministry':
      return [
        { label: t('nav.dashboard'),      icon: 'dashboard',   path: '/ministere' },
        { label: t('nav.directions'),     icon: 'building',    path: '/ministere/directions' },
        { label: t('nav.establishments'), icon: 'building',    path: '/ministere/etablissements' },
        { label: t('nav.statistics'),     icon: 'chart',       path: '/ministere/statistiques' },
        { label: t('common.profile'),     icon: 'settings',    path: '/profil' },
      ];
    default:
      return [];
  }
}

export function roleLabel(role) {
  return t(`roles.${role}`);
}

export function initialsOf(profile) {
  if (!profile) return '?';
  const a = (profile.first_name || '').trim()[0] || '';
  const b = (profile.last_name  || '').trim()[0] || '';
  return (a + b).toUpperCase() || (profile.email || '?')[0].toUpperCase();
}
