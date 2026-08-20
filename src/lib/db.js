// ─────────────────────────────────────────────────────────────────────────────
//  Couche d'accès aux données — toutes les requêtes de la plateforme.
//
//  Chaque fonction renvoie `{ data, error }` ou lève une erreur explicite.
//  Le cloisonnement (§23) est assuré par les policies RLS côté PostgreSQL :
//  ce module ne fait que formuler les requêtes, il n'accorde aucun droit.
// ─────────────────────────────────────────────────────────────────────────────

import { getApi } from './api.js';

function sb() {
  const c = getApi();
  if (!c) throw new Error('API_UNCONFIGURED');
  return c;
}

const rows = ({ data, error }) => { if (error) throw error; return data || []; };
const one  = ({ data, error }) => { if (error) throw error; return data || null; };

// ── Wilayas (§4) ─────────────────────────────────────────────────────────────

export const listWilayas = () =>
  sb().from('wilayas').select('*').order('code').then(rows);

export const createWilayaWithAdmin = (p) =>
  sb().rpc('create_wilaya_with_admin', p).then(one);

export const updateWilaya = (id, patch) =>
  sb().from('wilayas').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteWilaya = (id) =>
  sb().from('wilayas').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

// ── Établissements (§5) ──────────────────────────────────────────────────────

const ESTAB_SELECT =
  'id, name, code, type, status, address, contact_email, contact_phone, director_name,'
  + ' wilaya_id, direction_id, created_at, wilayas(id, name, code)';

export const listEstablishments = (filters = {}) => {
  let q = sb().from('establishments').select(ESTAB_SELECT).order('name');
  if (filters.wilaya_id) q = q.eq('wilaya_id', filters.wilaya_id);
  if (filters.type)      q = q.eq('type', filters.type);
  if (filters.status)    q = q.eq('status', filters.status);
  return q.then(rows);
};

export const getEstablishment = (id) =>
  sb().from('establishments').select(ESTAB_SELECT).eq('id', id).maybeSingle().then(one);

export const createEstablishment = (payload) =>
  sb().from('establishments').insert(payload).select(ESTAB_SELECT).maybeSingle().then(one);

export const updateEstablishment = (id, patch) =>
  sb().from('establishments').update(patch).eq('id', id).select(ESTAB_SELECT).maybeSingle().then(one);

export const deleteEstablishment = (id) =>
  sb().from('establishments').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const publicEstablishments = () =>
  sb().rpc('public_establishments').then(rows);

// ── Comptes & permissions (§6) ───────────────────────────────────────────────

export const createAccount = (p) => sb().rpc('create_account', p).then(one);
export const setAccountStatus = (userId, status) =>
  sb().rpc('set_account_status', { p_user: userId, p_status: status }).then(one);
export const deleteAccount = (userId) =>
  sb().rpc('delete_account', { p_user: userId }).then(({ error }) => { if (error) throw error; });
export const setPermissions = (userId, permissions) =>
  sb().rpc('set_permissions', { p_user: userId, p_permissions: permissions })
      .then(({ error }) => { if (error) throw error; });

const PROFILE_SELECT =
  'id, role, first_name, last_name, email, phone, status, establishment_id, wilaya_id,'
  + ' direction_id, created_at, establishments(id, name, type), wilayas(id, name, code)';

export const listProfiles = (filters = {}) => {
  let q = sb().from('profiles').select(PROFILE_SELECT).order('last_name');
  if (filters.role)             q = q.eq('role', filters.role);
  if (filters.status)           q = q.eq('status', filters.status);
  if (filters.establishment_id) q = q.eq('establishment_id', filters.establishment_id);
  if (filters.wilaya_id)        q = q.eq('wilaya_id', filters.wilaya_id);
  return q.then(rows);
};

export const listUserPermissions = (userId) =>
  sb().from('user_permissions').select('permission').eq('user_id', userId)
      .then(rows).then((r) => r.map((x) => x.permission));

export const updateProfile = (id, patch) =>
  sb().from('profiles').update(patch).eq('id', id).select().maybeSingle().then(one);

// ── Nomenclature : modes, filières, programmes (§7, §8, §12) ────────────────

export const listTrainingModes = () =>
  sb().from('training_modes').select('*').order('position').order('name').then(rows);

export const upsertTrainingMode = (payload) =>
  sb().from('training_modes').upsert(payload, { onConflict: 'code' }).select().then(rows);

export const updateTrainingMode = (id, patch) =>
  sb().from('training_modes').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteTrainingMode = (id) =>
  sb().from('training_modes').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const listFields = () =>
  sb().from('fields').select('*').order('name').then(rows);

export const createField = (payload) =>
  sb().from('fields').insert(payload).select().maybeSingle().then(one);

export const updateField = (id, patch) =>
  sb().from('fields').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteField = (id) =>
  sb().from('fields').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

const PROGRAM_SELECT =
  'id, code, name, description, duration_months, semesters_count, establishment_type,'
  + ' target_audience, seats, required_level, qualification_level, internship_required,'
  + ' practical_required, apprenticeship_allowed, status, published_at, field_id,'
  + ' training_mode_id, created_at, fields(id, name), training_modes(id, name, code, requires_contract)';

export const listPrograms = (filters = {}) => {
  let q = sb().from('programs').select(PROGRAM_SELECT).order('name');
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.field_id) q = q.eq('field_id', filters.field_id);
  return q.then(rows);
};

export const getProgram = (id) =>
  sb().from('programs').select(PROGRAM_SELECT).eq('id', id).maybeSingle().then(one);

export const createProgram = (payload) =>
  sb().from('programs').insert(payload).select(PROGRAM_SELECT).maybeSingle().then(one);

export const updateProgram = (id, patch) =>
  sb().from('programs').update(patch).eq('id', id).select(PROGRAM_SELECT).maybeSingle().then(one);

export const deleteProgram = (id) =>
  sb().from('programs').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const listProgramSemesters = (programId) =>
  sb().from('program_semesters')
      .select('*, program_modules(*)')
      .eq('program_id', programId).order('semester').then(rows);

export const upsertProgramSemester = (payload) =>
  sb().from('program_semesters')
      .upsert(payload, { onConflict: 'program_id,semester' })
      .select().maybeSingle().then(one);

export const createProgramModule = (payload) =>
  sb().from('program_modules').insert(payload).select().maybeSingle().then(one);

export const updateProgramModule = (id, patch) =>
  sb().from('program_modules').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteProgramModule = (id) =>
  sb().from('program_modules').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const listProgramDocuments = (programId) =>
  sb().from('program_documents').select('*').eq('program_id', programId)
      .order('created_at', { ascending: false }).then(rows);

export const createProgramDocument = (payload) =>
  sb().from('program_documents').insert(payload).select().maybeSingle().then(one);

export const updateProgramDocument = (id, patch) =>
  sb().from('program_documents').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteProgramDocument = (id) =>
  sb().from('program_documents').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

// ── Offre locale : spécialités, sessions, classes, sections (§7) ─────────────

export const listSpecialties = (establishmentId = null) => {
  let q = sb().from('specialties')
    .select('*, programs(id, name, code), training_modes(id, name), establishments(id, name)')
    .order('name');
  if (establishmentId) q = q.eq('establishment_id', establishmentId);
  return q.then(rows);
};

export const createSpecialty = (payload) =>
  sb().from('specialties').insert(payload).select().maybeSingle().then(one);

export const updateSpecialty = (id, patch) =>
  sb().from('specialties').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteSpecialty = (id) =>
  sb().from('specialties').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const listGroups = (establishmentId = null) => {
  let q = sb().from('groups')
    .select('*, specialties!inner(id, name, establishment_id), training_modes(id, name),'
          + ' training_sessions(id, name), sections(id, name, capacity)')
    .order('name');
  if (establishmentId) q = q.eq('specialties.establishment_id', establishmentId);
  return q.then(rows);
};

export const createGroup = (payload) =>
  sb().from('groups').insert(payload).select().maybeSingle().then(one);

export const updateGroup = (id, patch) =>
  sb().from('groups').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteGroup = (id) =>
  sb().from('groups').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const createSection = (payload) =>
  sb().from('sections').insert(payload).select().maybeSingle().then(one);

export const deleteSection = (id) =>
  sb().from('sections').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const listSessions = (establishmentId = null) => {
  let q = sb().from('training_sessions').select('*').order('start_date', { ascending: false });
  if (establishmentId) q = q.eq('establishment_id', establishmentId);
  return q.then(rows);
};

export const createSession = (payload) =>
  sb().from('training_sessions').insert(payload).select().maybeSingle().then(one);

export const updateSession = (id, patch) =>
  sb().from('training_sessions').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteSession = (id) =>
  sb().from('training_sessions').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

// ── Étudiants & parcours (§10, §11, §21) ────────────────────────────────────

export const searchStudents = (params = {}) =>
  sb().rpc('search_students', params).then(rows);

export const studentOverview = (studentId = null) =>
  sb().rpc('student_overview', studentId ? { p_student: studentId } : {}).then(one);

export const listStudentSemesters = (studentId) =>
  sb().from('student_semesters').select('*').eq('student_id', studentId)
      .order('semester').then(rows);

export const applySemesterDecision = (semesterRowId, decision, note) =>
  sb().rpc('apply_semester_decision', {
    p_semester_row: semesterRowId, p_decision: decision, p_note: note || null,
  }).then(one);

export const recalcSemester = (studentId, semester) =>
  sb().rpc('recalc_student_semester', { p_student: studentId, p_semester: semester }).then(one);

export const updateStudent = (profileId, patch) =>
  sb().from('students').update(patch).eq('profile_id', profileId).select().maybeSingle().then(one);

export const listStudentGrades = (studentId) =>
  sb().from('grades')
      .select('*, subjects(id, name, coefficient, credits, semester)')
      .eq('student_id', studentId)
      .order('graded_at', { ascending: false })
      .then(rows);

// ── Règlement pédagogique (§11) ─────────────────────────────────────────────

export const listAcademicRules = () =>
  sb().from('academic_rules')
      .select('*, wilayas(id, name, code), establishments(id, name)')
      .order('scope').then(rows);

export const createAcademicRule = (payload) =>
  sb().from('academic_rules').insert(payload).select().maybeSingle().then(one);

export const updateAcademicRule = (id, patch) =>
  sb().from('academic_rules').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteAcademicRule = (id) =>
  sb().from('academic_rules').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const effectiveRule = (establishmentId = null) =>
  sb().rpc('effective_academic_rule', { p_establishment: establishmentId }).then(one);

// ── Contrats d'apprentissage & stages (§9, §13, §14) ────────────────────────

const CONTRACT_SELECT =
  'id, kind, student_id, establishment_id, semester, company_name, company_address, location,'
  + ' start_date, end_date, duration_days, supervisor_name, supervisor_role, supervisor_email,'
  + ' supervisor_phone, contract_file_path, contract_file_name, contract_file_size, notes,'
  + ' status, completion, review_comment, reviewed_at, submitted_at, created_at,'
  + ' profiles!contracts_student_id_fkey(id, first_name, last_name, email),'
  + ' establishments(id, name, wilaya_id, wilayas(name, code))';

export const listContracts = (filters = {}) => {
  let q = sb().from('contracts').select(CONTRACT_SELECT).order('submitted_at', { ascending: false });
  if (filters.kind)             q = q.eq('kind', filters.kind);
  if (filters.status)           q = q.eq('status', filters.status);
  if (filters.student_id)       q = q.eq('student_id', filters.student_id);
  if (filters.establishment_id) q = q.eq('establishment_id', filters.establishment_id);
  return q.then(rows);
};

export const createContract = (payload) =>
  sb().from('contracts').insert(payload).select(CONTRACT_SELECT).maybeSingle().then(one);

export const updateContract = (id, patch) =>
  sb().from('contracts').update(patch).eq('id', id).select(CONTRACT_SELECT).maybeSingle().then(one);

export const deleteContract = (id) =>
  sb().from('contracts').delete().eq('id', id).then(({ error }) => { if (error) throw error; });

export const listContractReviews = (contractId) =>
  sb().from('contract_reviews')
      .select('*, profiles(first_name, last_name)')
      .eq('contract_id', contractId)
      .order('created_at').then(rows);

export const listContractAttachments = (contractId) =>
  sb().from('contract_attachments').select('*').eq('contract_id', contractId)
      .order('created_at').then(rows);

export const addContractAttachment = (payload) =>
  sb().from('contract_attachments').insert(payload).select().maybeSingle().then(one);

// ── Stockage (§9, §12, §13) ─────────────────────────────────────────────────

export async function uploadFile(bucket, path, file) {
  const { error } = await sb().storage.from(bucket).upload(path, file, {
    upsert: true, contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function signedURL(bucket, path, seconds = 300) {
  const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

export const removeFile = (bucket, path) =>
  sb().storage.from(bucket).remove([path]).then(({ error }) => { if (error) throw error; });

// ── Notifications (§20) ─────────────────────────────────────────────────────

export const listNotifications = (limit = 50) =>
  sb().from('notifications').select('*')
      .order('created_at', { ascending: false }).limit(limit).then(rows);

export const countUnread = () =>
  sb().from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
      .then(({ count, error }) => { if (error) throw error; return count || 0; });

export const markNotificationsRead = (ids = null) =>
  sb().rpc('mark_notifications_read', { p_ids: ids }).then(one);

export const broadcastAnnouncement = (p) =>
  sb().rpc('broadcast_announcement', p).then(one);

// ── Statistiques (§17, §18, §19) ────────────────────────────────────────────

export const statsNational = () => sb().rpc('stats_national').then(one);
export const statsWilaya = (wilayaId = null) =>
  sb().rpc('stats_wilaya', wilayaId ? { p_wilaya: wilayaId } : {}).then(one);
export const statsEstablishment = (estabId = null) =>
  sb().rpc('stats_establishment', estabId ? { p_estab: estabId } : {}).then(one);

// ── Matières & professeurs ──────────────────────────────────────────────────

export const listSubjects = (establishmentId = null) => {
  let q = sb().from('subjects')
    .select('*, specialties!inner(id, name, establishment_id), profiles(id, first_name, last_name),'
          + ' groups(id, name)')
    .order('name');
  if (establishmentId) q = q.eq('specialties.establishment_id', establishmentId);
  return q.then(rows);
};

export const createSubject = (payload) =>
  sb().from('subjects').insert(payload).select().maybeSingle().then(one);

export const updateSubject = (id, patch) =>
  sb().from('subjects').update(patch).eq('id', id).select().maybeSingle().then(one);

export const deleteSubject = (id) =>
  sb().from('subjects').delete().eq('id', id).then(({ error }) => { if (error) throw error; });
