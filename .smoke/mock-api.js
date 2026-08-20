// Faux client d'API pour le test de rendu hors ligne.
// Chaque table renvoie un jeu de données minimal mais réaliste ;
// les RPC renvoient les formes exactes attendues par l'interface.

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const WILAYA = { id: uuid(1), code: '05', name: 'Batna', name_ar: 'باتنة',
  directorate_name: 'DFP Batna', address: 'Batna', contact_email: 'dfp05@x.dz',
  contact_phone: '+213', status: 'active', created_at: '2026-01-01T00:00:00Z' };
const ESTAB = { id: uuid(2), name: 'INSFP de Batna', code: 'INSFP-05-01', type: 'insfp',
  status: 'active', address: 'Batna', contact_email: 'e@x.dz', contact_phone: '+213',
  director_name: 'K. Haddad', wilaya_id: WILAYA.id, direction_id: null,
  created_at: '2026-01-01T00:00:00Z', wilayas: { id: WILAYA.id, name: 'Batna', code: '05' } };
const MODE = { id: uuid(3), code: 'residential', name: 'Formation résidentielle',
  name_ar: 'إقامي', description: 'Temps plein.', target_audience: '15–26 ans',
  min_age: 15, max_age: 26, max_age_female: null, requires_contract: false,
  status: 'active', position: 1 };
const FIELD = { id: uuid(4), code: 'INFO', name: 'Informatique', description: '', status: 'active' };
const PROGRAM = { id: uuid(5), code: 'TS-INFO', name: 'TS Développement', description: 'Desc.',
  duration_months: 30, semesters_count: 5, establishment_type: 'insfp', target_audience: '15–26',
  seats: 60, required_level: '3AS', qualification_level: 'TS', internship_required: true,
  practical_required: false, apprenticeship_allowed: true, status: 'published',
  published_at: '2026-02-01T00:00:00Z', field_id: FIELD.id, training_mode_id: MODE.id,
  created_at: '2026-01-01T00:00:00Z', fields: { id: FIELD.id, name: 'Informatique' },
  training_modes: { id: MODE.id, name: MODE.name, code: MODE.code, requires_contract: false } };
const PROGRAM_SEM = { id: uuid(6), program_id: PROGRAM.id, semester: 's1', title: 'Semestre S1',
  description: 'Bases.', objectives: 'Objectifs.',
  program_modules: [{ id: uuid(7), program_semester_id: uuid(6), code: 'ALGO', name: 'Algorithmique',
    description: '', objectives: '', coefficient: 3, credits: 6, hours: 90,
    is_practical: false, position: 1 }] };
const PROGRAM_DOC = { id: uuid(8), program_id: PROGRAM.id, semester: 's1', title: 'Programme officiel',
  description: '', category: 'programme', file_path: 'p/f.pdf', file_name: 'f.pdf',
  file_size: 120000, published: true, created_at: '2026-02-01T00:00:00Z' };
const SPECIALTY = { id: uuid(9), name: 'Développement', code: 'DEV', establishment_id: ESTAB.id,
  program_id: PROGRAM.id, training_mode_id: MODE.id, seats: 30, status: 'active',
  programs: { id: PROGRAM.id, name: PROGRAM.name, code: PROGRAM.code },
  training_modes: { id: MODE.id, name: MODE.name },
  establishments: { id: ESTAB.id, name: ESTAB.name } };
const SESSION = { id: uuid(10), name: 'Rentrée 2026', establishment_id: ESTAB.id,
  academic_year: '2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', status: 'active' };
const GROUP = { id: uuid(11), name: 'TS-DEV-1A', specialty_id: SPECIALTY.id, semester: 's1',
  level: 'TS1', academic_year: '2026/2027', capacity: 30, status: 'active',
  training_mode_id: MODE.id, session_id: SESSION.id,
  specialties: { id: SPECIALTY.id, name: 'Développement', establishment_id: ESTAB.id },
  training_modes: { id: MODE.id, name: MODE.name },
  training_sessions: { id: SESSION.id, name: SESSION.name },
  sections: [{ id: uuid(12), name: 'Section A', capacity: 15 }] };
const STUDENT_PROFILE = { id: uuid(20), role: 'student', first_name: 'Yacine', last_name: 'Meziane',
  email: 'y@x.dz', phone: '+213', status: 'active', establishment_id: ESTAB.id,
  wilaya_id: WILAYA.id, direction_id: null, created_at: '2026-01-01T00:00:00Z',
  establishments: { id: ESTAB.id, name: ESTAB.name, type: 'insfp' },
  wilayas: { id: WILAYA.id, name: 'Batna', code: '05' } };
const SEMESTERS = [
  { id: uuid(30), student_id: STUDENT_PROFILE.id, semester: 's1', academic_year: '2026/2027',
    average: 8.83, resit_average: 11.83, final_average: 11.83, credits_earned: 12,
    attendance_rate: 92.5, status: 'validated', decision: null, decision_note: null,
    validated_at: '2027-02-01T00:00:00Z' },
  { id: uuid(31), student_id: STUDENT_PROFILE.id, semester: 's2', academic_year: '2026/2027',
    average: 7.2, resit_average: 8.1, final_average: 8.1, credits_earned: 4,
    attendance_rate: 80, status: 'resit_failed', decision: null, decision_note: null,
    validated_at: null },
];
const CONTRACT = { id: uuid(40), kind: 'apprenticeship', student_id: STUDENT_PROFILE.id,
  establishment_id: ESTAB.id, semester: null, company_name: 'Sonelgaz',
  company_address: 'Batna', location: 'Batna', start_date: '2026-09-01', end_date: '2027-02-28',
  duration_days: 180, supervisor_name: 'M. Belaid', supervisor_role: 'Chef', supervisor_email: 's@x.dz',
  supervisor_phone: '+213', contract_file_path: 'c/f.pdf', contract_file_name: 'contrat.pdf',
  contract_file_size: 90000, notes: 'RAS', status: 'pending', completion: 'not_started',
  review_comment: null, reviewed_at: null, submitted_at: '2026-08-01T00:00:00Z',
  created_at: '2026-08-01T00:00:00Z',
  profiles: { id: STUDENT_PROFILE.id, first_name: 'Yacine', last_name: 'Meziane', email: 'y@x.dz' },
  establishments: { id: ESTAB.id, name: ESTAB.name, wilaya_id: WILAYA.id,
                    wilayas: { name: 'Batna', code: '05' } } };
const INTERNSHIP = { ...CONTRACT, id: uuid(41), kind: 'internship', semester: 's5',
  status: 'approved', completion: 'in_progress', company_name: 'Naftal' };
const NOTIF = { id: uuid(50), user_id: STUDENT_PROFILE.id, kind: 'semester_validated',
  title: 'Semestre S1 validé', body: 'Moyenne : 11.83/20.', link: '/etudiant/parcours',
  read_at: null, created_at: '2027-02-01T00:00:00Z' };
const RULE = { id: uuid(60), scope: 'national', wilaya_id: null, establishment_id: null,
  label: 'Règlement national 2026', pass_mark: 10, resit_pass_mark: 10, auto_progress: true,
  auto_resit: true, on_resit_failure: 'repeat_semester', max_repeats: 1,
  min_attendance_rate: null, active: true, wilayas: null, establishments: null };
const SUBJECT = { id: uuid(70), name: 'Algorithmique', coefficient: 3, credits: 6, semester: 's1',
  specialty_id: SPECIALTY.id, teacher_id: null, group_id: GROUP.id,
  specialties: { id: SPECIALTY.id, name: 'Développement', establishment_id: ESTAB.id },
  profiles: null, groups: { id: GROUP.id, name: GROUP.name } };
const GRADE = { id: uuid(80), student_id: STUDENT_PROFILE.id, subject_id: SUBJECT.id,
  type: 'examen', value: 12.5, label: 'Examen S1', graded_at: '2027-01-15', semester: 's1',
  is_resit: false, subjects: { id: SUBJECT.id, name: 'Algorithmique', coefficient: 3,
                               credits: 6, semester: 's1' } };

const TABLES = {
  wilayas: [WILAYA], establishments: [ESTAB], training_modes: [MODE], fields: [FIELD],
  programs: [PROGRAM], program_semesters: [PROGRAM_SEM], program_modules: PROGRAM_SEM.program_modules,
  program_documents: [PROGRAM_DOC], specialties: [SPECIALTY], groups: [GROUP],
  training_sessions: [SESSION], sections: GROUP.sections, profiles: [STUDENT_PROFILE],
  student_semesters: SEMESTERS, contracts: [CONTRACT, INTERNSHIP],
  contract_reviews: [{ id: uuid(90), contract_id: CONTRACT.id, from_status: null,
    to_status: 'pending', comment: 'Dépôt initial', reviewer_id: STUDENT_PROFILE.id,
    created_at: '2026-08-01T00:00:00Z', profiles: { first_name: 'Yacine', last_name: 'Meziane' } }],
  contract_attachments: [], notifications: [NOTIF], academic_rules: [RULE],
  user_permissions: [{ permission: 'reports.export' }], subjects: [SUBJECT], grades: [GRADE],
  students: [], teachers: [], document_requests: [], courses: [], attendance: [],
  exams: [], exam_questions: [], exam_submissions: [],
};

const EFFECTIVE_RULE = { source: 'national', label: 'Règlement national 2026', pass_mark: 10,
  resit_pass_mark: 10, auto_progress: true, auto_resit: true,
  on_resit_failure: 'repeat_semester', max_repeats: 1, min_attendance_rate: null };

const STATS = {
  establishments: { total: 1, active: 1, by_type: { insfp: 1 },
    by_wilaya: [{ wilaya: 'Batna', code: '05', count: 1 }] },
  students: { total: 1, active: 1, graduated: 0, repeating: 0, dismissed: 0, pending: 0,
    by_semester: { s1: 1 }, by_mode: [{ mode: MODE.name, code: MODE.code, count: 1 }],
    by_program: [{ program: PROGRAM.name, code: PROGRAM.code, count: 1 }],
    by_specialty: [{ specialty: 'Développement', count: 1 }],
    by_establishment: [{ establishment: ESTAB.name, count: 1 }] },
  academic: { validated: 1, pending_resit: 0, resit_failed: 1, in_progress: 0, average: 10.2,
    success_rate: 50, attendance_rate: 86.2,
    by_semester: { s1: { total: 1, validated: 1, resit: 0, average: 11.83 } } },
  training: { programs: 1, published: 1, fields: 1, modes: 1, specialties: 1, groups: 1,
    sessions: 1, teachers: 0, seats: 30, capacity_vs_enrolled: { capacity: 30, enrolled: 1 } },
  apprenticeship: { students: 0, submitted: 1, pending: 1, review: 0, approved: 0, rejected: 0,
    changes: 0 },
  internships: { s5_students: 0, submitted: 1, missing: 0, pending: 0, review: 0, approved: 1,
    rejected: 0, completed: 0, companies: 1,
    locations: [{ location: 'Batna', count: 1 }] },
  wilayas: { total: 1, active: 1, with_admin: 1 },
  users: { total: 3, pending: 0, by_role: { student: 1, ministry: 1, direction: 1 } },
  per_wilaya: [{ id: WILAYA.id, code: '05', name: 'Batna', status: 'active',
                 establishments: 1, students: 1 }],
  wilaya: WILAYA, establishment: ESTAB,
  by_group: [{ group: 'TS-DEV-1A', count: 1 }], pending_contracts: 1, document_requests: 0,
  scope: 'test',
};

const SEARCH_ROW = { profile_id: STUDENT_PROFILE.id, student_number: '2026-0001',
  first_name: 'Yacine', last_name: 'Meziane', email: 'y@x.dz', establishment: ESTAB.name,
  establishment_id: ESTAB.id, wilaya: 'Batna', specialty: 'Développement',
  program: PROGRAM.name, training_mode: MODE.name, semester: 's1', enrollment: 'enrolled',
  semester_status: 'validated', average: 11.83, contract_status: 'pending',
  internship_status: 'approved' };

const RPC = {
  stats_national: () => STATS,
  stats_wilaya: () => STATS,
  stats_establishment: () => STATS,
  student_overview: () => ({
    student: { profile_id: STUDENT_PROFILE.id, student_number: '2026-0001',
      first_name: 'Yacine', last_name: 'Meziane', email: 'y@x.dz',
      establishment: ESTAB.name, establishment_type: 'insfp', wilaya: 'Batna',
      specialty: 'Développement', program: PROGRAM.name, program_id: PROGRAM.id,
      training_mode: MODE.name, requires_contract: true, group: GROUP.name,
      current_semester: 's2', enrollment_status: 'enrolled', enrollment_date: '2026-09-01' },
    semesters: SEMESTERS, rule: EFFECTIVE_RULE, contracts: [CONTRACT, INTERNSHIP],
    unread_notifications: 1,
  }),
  effective_academic_rule: () => EFFECTIVE_RULE,
  search_students: () => [SEARCH_ROW],
  public_establishments: () => [{ id: ESTAB.id, name: ESTAB.name, code: ESTAB.code,
    type: 'insfp', wilaya_name: 'Batna', wilaya_code: '05' }],
  public_wilayas: () => [{ id: WILAYA.id, code: '05', name: 'Batna' }],
  mark_notifications_read: () => 1,
  create_account: () => uuid(99),
  create_wilaya_with_admin: () => ({ wilaya_id: uuid(1), admin_id: uuid(99) }),
  set_account_status: () => STUDENT_PROFILE,
  broadcast_announcement: () => 3,
  apply_semester_decision: () => SEMESTERS[1],
  recalc_student_semester: () => SEMESTERS[0],
  set_permissions: () => null,
  delete_account: () => null,
};

function builder(table) {
  const rows = TABLES[table] ? [...TABLES[table]] : [];
  const res = { data: rows, error: null, count: rows.length };
  const chain = {
    select() { return chain; }, insert(v) { chain._d = v; return chain; },
    update() { return chain; }, upsert() { return chain; }, delete() { return chain; },
    eq() { return chain; }, is() { return chain; }, in() { return chain; },
    neq() { return chain; }, gt() { return chain; }, gte() { return chain; },
    lt() { return chain; }, lte() { return chain; }, like() { return chain; },
    ilike() { return chain; }, or() { return chain; }, not() { return chain; },
    filter() { return chain; }, contains() { return chain; }, overlaps() { return chain; },
    match() { return chain; }, textSearch() { return chain; },
    order() { return chain; }, limit() { return chain; }, range() { return chain; },
    maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
    single() { return Promise.resolve({ data: rows[0] || null, error: null }); },
    then(ok, ko) { return Promise.resolve(res).then(ok, ko); },
  };
  return chain;
}

const client = {
  from: builder,
  rpc(name) {
    const fn = RPC[name];
    const data = fn ? fn() : null;
    return { data, error: null, then: (ok, ko) => Promise.resolve({ data, error: null }).then(ok, ko) };
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: {}, error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: 'about:blank' }, error: null }),
      remove: async () => ({ data: {}, error: null }),
    }),
  },
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: {}, error: null }),
    signUp: async () => ({ data: {}, error: null }),
    signOut: async () => ({}),
  },
};

export function initApi() { return client; }
export function getApi() { return client; }
export function isApiConfigured() { return true; }
export const api = client;
