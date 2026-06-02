-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Schéma de base
--  PostgreSQL 15 / Supabase
--
--  Hiérarchie :  Ministère → Direction → Établissement → Professeur / Étudiant
--
--  Conventions :
--    - UUIDs partout (v4, via gen_random_uuid).
--    - created_at / updated_at gérés par triggers.
--    - Aucune donnée fictive : ce fichier ne fait QUE créer la structure.
--    - Toutes les tables seront couvertes par RLS (voir 20260101000200_rls.sql).
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- Types énumérés
-- ─────────────────────────────────────────────────────────────────────────────

create type public.user_role as enum (
  'student',
  'teacher',
  'admin',
  'direction',
  'ministry'
);

create type public.user_status as enum (
  'pending',
  'active',
  'rejected'
);

create type public.establishment_type as enum (
  'cfpa',          -- Centre de Formation Professionnelle et d'Apprentissage
  'insfp',         -- Institut National Spécialisé de Formation Professionnelle
  'ifpm',          -- Institut de Formation Professionnelle des Métiers
  'iap',           -- Institut Algérien du Pétrole
  'infs',          -- Institut National de Formation Supérieure (sport)
  'paramedical',   -- Institut de Formation Paramédicale
  'private',       -- Centre privé de formation
  'private_school',
  'sectoral',
  'excellence',
  'distance',
  'apprenticeship',
  'specialized_public',
  'higher_pro_school',
  'perfecting',
  'other'
);

create type public.attendance_status as enum ('present', 'late', 'absent');

create type public.grade_type as enum ('cours', 'controle', 'tp', 'examen');

create type public.exam_kind as enum ('exam', 'tp');

create type public.exam_mode as enum ('qcm', 'direct', 'file');

create type public.question_type as enum ('qcm', 'direct');

create type public.document_type as enum (
  'attestation_scolarite',
  'releve_notes',
  'attestation_inscription',
  'attestation_reussite',
  'autre'
);

create type public.document_status as enum ('pending', 'sent', 'rejected');

create type public.preferred_language as enum ('fr', 'en', 'ar');

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers : updated_at automatique
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Directions régionales (≈ une par groupe de wilayas)
create table public.directions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  wilaya      text,
  contact_email text,
  contact_phone text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger directions_updated
  before update on public.directions
  for each row execute function public.set_updated_at();

create index directions_wilaya_idx on public.directions(wilaya);

-- Établissements / centres de formation
create table public.establishments (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           public.establishment_type not null default 'other',
  wilaya         text,
  address        text,
  contact_email  text,
  contact_phone  text,
  direction_id   uuid references public.directions(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger establishments_updated
  before update on public.establishments
  for each row execute function public.set_updated_at();

create index establishments_direction_idx on public.establishments(direction_id);
create index establishments_wilaya_idx    on public.establishments(wilaya);

-- Profils utilisateurs — liés 1-1 à auth.users
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               public.user_role not null,
  first_name         text not null default '',
  last_name          text not null default '',
  phone              text,
  email              text,
  status             public.user_status not null default 'pending',
  establishment_id   uuid references public.establishments(id) on delete set null,
  direction_id       uuid references public.directions(id) on delete set null,
  preferred_language public.preferred_language not null default 'fr',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index profiles_role_idx          on public.profiles(role);
create index profiles_establishment_idx on public.profiles(establishment_id);
create index profiles_direction_idx     on public.profiles(direction_id);
create index profiles_status_idx        on public.profiles(status);

-- Spécialités d'un établissement (ex: "Informatique", "Mécanique générale")
create table public.specialties (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  code             text,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (establishment_id, name)
);

create trigger specialties_updated
  before update on public.specialties
  for each row execute function public.set_updated_at();

create index specialties_establishment_idx on public.specialties(establishment_id);

-- Groupes (ex: "TS-INFO-2A", "BTS-COMPTA-1B")
create table public.groups (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  specialty_id     uuid not null references public.specialties(id) on delete cascade,
  level            text,
  academic_year    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger groups_updated
  before update on public.groups
  for each row execute function public.set_updated_at();

create index groups_specialty_idx on public.groups(specialty_id);

-- Matières (cours enseignés)
create table public.subjects (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  coefficient      numeric(4,2) not null default 1 check (coefficient > 0),
  specialty_id     uuid not null references public.specialties(id) on delete cascade,
  teacher_id       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger subjects_updated
  before update on public.subjects
  for each row execute function public.set_updated_at();

create index subjects_specialty_idx on public.subjects(specialty_id);
create index subjects_teacher_idx   on public.subjects(teacher_id);

-- Liaison étudiant ↔ profil ↔ inscription
create table public.students (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  student_number   text not null,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  specialty_id     uuid references public.specialties(id) on delete set null,
  group_id         uuid references public.groups(id) on delete set null,
  level            text,
  enrollment_date  date default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (establishment_id, student_number)
);

create trigger students_updated
  before update on public.students
  for each row execute function public.set_updated_at();

create index students_establishment_idx on public.students(establishment_id);
create index students_specialty_idx     on public.students(specialty_id);
create index students_group_idx         on public.students(group_id);

-- Liaison professeur ↔ profil
create table public.teachers (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  employee_number  text,
  hired_at         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger teachers_updated
  before update on public.teachers
  for each row execute function public.set_updated_at();

create index teachers_establishment_idx on public.teachers(establishment_id);

-- Supports de cours (fichiers déposés par le professeur)
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  title       text not null,
  description text,
  file_path   text,        -- chemin dans Supabase Storage (bucket course-materials)
  file_name   text,
  file_size   bigint,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger courses_updated
  before update on public.courses
  for each row execute function public.set_updated_at();

create index courses_subject_idx on public.courses(subject_id);

-- Présence par séance
create table public.attendance (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  subject_id    uuid not null references public.subjects(id) on delete cascade,
  session_date  date not null,
  session_label text,                          -- ex: "Cours 4 - 09:45"
  status        public.attendance_status not null,
  note          text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (student_id, subject_id, session_date, session_label)
);

create trigger attendance_updated
  before update on public.attendance
  for each row execute function public.set_updated_at();

create index attendance_student_idx on public.attendance(student_id);
create index attendance_subject_idx on public.attendance(subject_id);
create index attendance_date_idx    on public.attendance(session_date);

-- Notes
create table public.grades (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  type        public.grade_type not null,
  value       numeric(5,2) not null check (value >= 0 and value <= 20),
  label       text,                            -- ex: "Contrôle continu n°2"
  graded_at   date default current_date,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger grades_updated
  before update on public.grades
  for each row execute function public.set_updated_at();

create index grades_student_idx on public.grades(student_id);
create index grades_subject_idx on public.grades(subject_id);

-- Examens / TP — un examen = un événement programmé pour une matière
create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  subject_id       uuid not null references public.subjects(id) on delete cascade,
  title            text not null,
  description      text,
  kind             public.exam_kind not null default 'exam',
  mode             public.exam_mode not null,
  start_at         timestamptz not null,
  end_at           timestamptz not null check (end_at > start_at),
  duration_minutes integer not null check (duration_minutes > 0),
  total_points     numeric(5,2) not null default 20,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger exams_updated
  before update on public.exams
  for each row execute function public.set_updated_at();

create index exams_subject_idx on public.exams(subject_id);
create index exams_start_idx   on public.exams(start_at);

-- Questions d'un examen
create table public.exam_questions (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.exams(id) on delete cascade,
  question_text   text not null,
  type            public.question_type not null,
  options         jsonb,            -- pour QCM : ["a", "b", "c", "d"]
  correct_answer  text,             -- index ou texte
  points          numeric(5,2) not null default 1,
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);

create index exam_questions_exam_idx on public.exam_questions(exam_id);

-- Réponses des étudiants
create table public.exam_submissions (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  submitted_at   timestamptz default now(),
  file_path      text,             -- bucket exam-submissions
  answers        jsonb,            -- {questionId: réponse}
  score          numeric(5,2),
  graded_at      timestamptz,
  graded_by      uuid references public.profiles(id) on delete set null,
  feedback       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (exam_id, student_id)
);

create trigger exam_submissions_updated
  before update on public.exam_submissions
  for each row execute function public.set_updated_at();

create index exam_subs_exam_idx    on public.exam_submissions(exam_id);
create index exam_subs_student_idx on public.exam_submissions(student_id);

-- Demandes de documents administratifs
create table public.document_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  document_type public.document_type not null,
  status        public.document_status not null default 'pending',
  note          text,
  reason        text,
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz,
  processed_by  uuid references public.profiles(id) on delete set null,
  email_sent_to text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger document_requests_updated
  before update on public.document_requests
  for each row execute function public.set_updated_at();

create index document_requests_student_idx on public.document_requests(student_id);
create index document_requests_status_idx  on public.document_requests(status);
