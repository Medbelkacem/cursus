// ─────────────────────────────────────────────────────────────────────────────
//  Nomenclature officielle de la formation professionnelle.
//
//  Ce fichier ne contient QUE des libellés de référence (types d'établissement,
//  modes de formation, semestres, statuts).  Il ne crée aucune donnée : les
//  wilayas, établissements, programmes et comptes sont saisis par le ministère
//  depuis l'interface (§1, §24).
// ─────────────────────────────────────────────────────────────────────────────

// §5 — Les 10 types d'établissement de formation
export const ESTABLISHMENT_TYPES = [
  { value: 'insfp',    abbr: 'INSFP',   label: 'Institut National Spécialisé de Formation Professionnelle' },
  { value: 'iep',      abbr: 'IEP',     label: "Institut d'Enseignement Professionnel" },
  { value: 'cfpa',     abbr: 'CFPA',    label: "Centre de Formation Professionnelle et d'Apprentissage" },
  { value: 'cfphp',    abbr: 'CFPHP',   label: "Centre de Formation Professionnelle et d'Apprentissage pour Personnes Handicapées Physiques" },
  { value: 'excellence', abbr: "Centre d'Excellence", label: "Centre d'Excellence" },
  { value: 'infep',    abbr: 'INFEP',   label: "Institut National de la Formation et de l'Enseignement Professionnels" },
  { value: 'ifep',     abbr: 'IFEP',    label: "Institut de Formation et d'Enseignement Professionnel" },
  { value: 'cnepd',    abbr: 'CNEPD',   label: "Centre National d'Enseignement Professionnel à Distance" },
  { value: 'indefoc',  abbr: 'INDEFOC', label: 'Institut National de Développement et de Promotion de la Formation Continue' },
  { value: 'epfp',     abbr: 'EPFP',    label: 'Établissement Privé de Formation Professionnelle' },
];

const TYPE_BY_VALUE = new Map(ESTABLISHMENT_TYPES.map((t) => [t.value, t]));

export function typeAbbr(value) {
  return TYPE_BY_VALUE.get(value)?.abbr || (value || '—').toUpperCase();
}

export function typeLabel(value) {
  return TYPE_BY_VALUE.get(value)?.label || value || '—';
}

export function typeOptions(withEmpty = null) {
  const opts = ESTABLISHMENT_TYPES.map((t) => ({ value: t.value, label: `${t.abbr} — ${t.label}` }));
  return withEmpty ? [{ value: '', label: withEmpty }, ...opts] : opts;
}

// §8 — Les 5 modes de formation officiels.
// Utilisés uniquement comme *modèle d'import* proposé au ministère : rien
// n'est inséré automatiquement, l'administrateur déclenche l'import.
export const TRAINING_MODE_PRESETS = [
  {
    code: 'residential',
    name: 'Formation résidentielle',
    name_ar: 'التكوين الإقامي',
    description:
      "Cours théoriques et travaux pratiques à plein temps au sein de l'établissement de "
      + "formation (CFPA, INSFP), complétés par des stages pratiques en entreprise.",
    target_audience: 'Jeunes âgés de 15 à 26 ans',
    min_age: 15, max_age: 26, max_age_female: null,
    requires_contract: false, position: 1,
  },
  {
    code: 'apprenticeship',
    name: 'Formation par apprentissage',
    name_ar: 'التكوين عن طريق التمهين',
    description:
      "Alternance entre le centre de formation pour l'enseignement théorique et une "
      + "entreprise ou une administration pour la formation pratique.",
    target_audience: 'Hommes de 15 à 25 ans · Femmes de 15 à 30 ans',
    min_age: 15, max_age: 25, max_age_female: 30,
    requires_contract: true, position: 2,
  },
  {
    code: 'distance',
    name: 'Formation à distance',
    name_ar: 'التكوين عن بعد',
    description:
      "Cours par correspondance avec des regroupements périodiques dans les "
      + "établissements de formation de la région.",
    target_audience: 'Travailleurs · Population des zones rurales · Population des zones enclavées',
    min_age: null, max_age: null, max_age_female: null,
    requires_contract: false, position: 3,
  },
  {
    code: 'evening',
    name: 'Cours du soir',
    name_ar: 'الدروس المسائية',
    description: "Formation en présentiel organisée en dehors des heures de travail habituelles.",
    target_audience: "Travailleurs · Demandeurs d'un premier emploi · Personnes souhaitant "
      + 'perfectionner leurs compétences professionnelles',
    min_age: null, max_age: null, max_age_female: null,
    requires_contract: false, position: 4,
  },
  {
    code: 'mobile',
    name: 'Formation par unités mobiles',
    name_ar: 'التكوين بالوحدات المتنقلة',
    description:
      "Ateliers mobiles spécialement équipés pour des cycles de formation courts ou du "
      + 'perfectionnement professionnel.',
    target_audience: 'Jeunes des zones rurales · Personnes soutenant l\'activité économique en zone rurale',
    min_age: null, max_age: null, max_age_female: null,
    requires_contract: false, position: 5,
  },
];

// §10 — Semestres
export const SEMESTERS = ['s1', 's2', 's3', 's4', 's5'];
export const semLabel = (s) => (s ? String(s).toUpperCase() : '—');
export const semOptions = (empty = 'Tous les semestres') =>
  [{ value: '', label: empty }, ...SEMESTERS.map((s) => ({ value: s, label: s.toUpperCase() }))];

// §11 — Statuts académiques
export const SEMESTER_STATUS = {
  in_progress:   { label: 'En cours',            tone: 'default' },
  validated:     { label: 'Validé',              tone: 'success' },
  pending_resit: { label: 'Rattrapage à passer', tone: 'warn' },
  resit_failed:  { label: 'Rattrapage non validé', tone: 'danger' },
  repeating:     { label: 'Redoublement',        tone: 'warn' },
  dismissed:     { label: 'Exclusion',           tone: 'danger' },
};

export const ENROLLMENT_STATUS = {
  enrolled:  { label: 'Inscrit',    tone: 'success' },
  graduated: { label: 'Diplômé',    tone: 'accent' },
  repeating: { label: 'Redoublant', tone: 'warn' },
  suspended: { label: 'Suspendu',   tone: 'warn' },
  dismissed: { label: 'Exclu',      tone: 'danger' },
  withdrawn: { label: 'Abandon',    tone: 'neutral' },
};

// §9 — Statuts de contrat / convention
export const CONTRACT_STATUS = {
  pending:               { label: 'En attente',           tone: 'warn' },
  under_review:          { label: "En cours d'examen",    tone: 'accent' },
  approved:              { label: 'Approuvé',             tone: 'success' },
  rejected:              { label: 'Refusé',               tone: 'danger' },
  modification_required: { label: 'Modification requise', tone: 'warn' },
};

export const COMPLETION_STATUS = {
  not_started: { label: 'Non démarré', tone: 'neutral' },
  in_progress: { label: 'En cours',    tone: 'accent' },
  completed:   { label: 'Terminé',     tone: 'success' },
  cancelled:   { label: 'Annulé',      tone: 'danger' },
};

// §11 — Décisions applicables après échec au rattrapage (configurables)
export const FAILURE_DECISIONS = {
  repeat_semester:    { label: 'Redoublement du semestre' },
  stay_same_semester: { label: 'Maintien dans le même semestre' },
  dismiss:            { label: 'Exclusion pédagogique' },
  manual_review:      { label: 'Décision au cas par cas (jury)' },
};

export const PUBLICATION_STATUS = {
  draft:     { label: 'Brouillon', tone: 'neutral' },
  published: { label: 'Publié',    tone: 'success' },
  archived:  { label: 'Archivé',   tone: 'default' },
};

export const ENTITY_STATUS = {
  active:   { label: 'Actif',   tone: 'success' },
  inactive: { label: 'Inactif', tone: 'neutral' },
};

export const USER_STATUS = {
  pending:  { label: 'En attente', tone: 'warn' },
  active:   { label: 'Actif',      tone: 'success' },
  rejected: { label: 'Désactivé',  tone: 'danger' },
};

export const ROLES = {
  ministry:  { label: 'Ministère',      path: '/ministere' },
  direction: { label: 'Direction de wilaya', path: '/direction' },
  admin:     { label: 'Établissement',  path: '/administration' },
  teacher:   { label: 'Professeur',     path: '/professeur' },
  student:   { label: 'Étudiant',       path: '/etudiant' },
};

// §6 — Permissions fines attribuables en plus du rôle
export const PERMISSIONS = [
  { value: 'contracts.review',  label: 'Examiner les contrats et conventions' },
  { value: 'students.manage',   label: 'Gérer les dossiers étudiants' },
  { value: 'grades.manage',     label: 'Saisir et modifier les notes' },
  { value: 'programs.manage',   label: 'Gérer les programmes de formation' },
  { value: 'users.manage',      label: 'Gérer les comptes utilisateurs' },
  { value: 'reports.export',    label: 'Générer et exporter les rapports' },
  { value: 'announcements.send',label: 'Diffuser des annonces' },
];

// Utilitaire générique : { label, tone } depuis une des tables ci-dessus
export function meta(dict, value, fallback = '—') {
  return dict[value] || { label: value || fallback, tone: 'default' };
}
