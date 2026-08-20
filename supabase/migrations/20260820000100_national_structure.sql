-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Structure nationale
--
--  Hiérarchie complète :
--    Ministère → Wilayas → Directions de wilaya → Établissements
--             → Classes / Spécialités → Professeurs → Étudiants
--             → Semestres (S1…S5) → Modules / Notes
--             → Contrats d'apprentissage / Stages
--
--  AUCUNE donnée n'est insérée par ce fichier : la plateforme démarre vide.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Types énumérés
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.entity_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.semester_code as enum ('s1', 's2', 's3', 's4', 's5');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.semester_status as enum (
    'in_progress',   -- semestre en cours
    'validated',     -- moyenne ≥ seuil → validé
    'pending_resit', -- moyenne < seuil → rattrapage à passer
    'resit_failed',  -- rattrapage échoué → décision administrative
    'repeating',     -- redouble le semestre
    'dismissed'      -- exclusion pédagogique
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.student_enrollment_status as enum (
    'enrolled', 'graduated', 'repeating', 'suspended', 'dismissed', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_status as enum (
    'pending',               -- soumis, en attente
    'under_review',          -- en cours d'examen
    'approved',              -- approuvé
    'rejected',              -- refusé
    'modification_required'  -- modification demandée
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.completion_status as enum (
    'not_started', 'in_progress', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.failure_decision as enum (
    'repeat_semester',      -- redoublement du semestre
    'stay_same_semester',   -- maintien dans le même semestre
    'dismiss',              -- exclusion
    'manual_review'         -- décision au cas par cas (jury)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.publication_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_kind as enum (
    'account_created',
    'account_status',
    'contract_submitted',
    'contract_approved',
    'contract_rejected',
    'contract_modification',
    'internship_deadline',
    'program_published',
    'course_published',
    'exam_result',
    'resit_exam',
    'semester_validated',
    'announcement'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rule_scope as enum ('national', 'wilaya', 'establishment');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. WILAYAS  (§4 du cahier des charges)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.wilayas (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,          -- « 05 », « 42 » …
  name              text not null,
  name_ar           text,
  directorate_name  text,                          -- Direction de la Formation Professionnelle de …
  address           text,
  contact_email     text,
  contact_phone     text,
  status            public.entity_status not null default 'active',
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists wilayas_updated on public.wilayas;
create trigger wilayas_updated
  before update on public.wilayas
  for each row execute function public.set_updated_at();

create index if not exists wilayas_code_idx   on public.wilayas(code);
create index if not exists wilayas_status_idx on public.wilayas(status);

-- Rattachement des entités existantes à la wilaya
alter table public.directions     add column if not exists wilaya_id uuid references public.wilayas(id) on delete set null;
alter table public.establishments add column if not exists wilaya_id uuid references public.wilayas(id) on delete restrict;
alter table public.profiles       add column if not exists wilaya_id uuid references public.wilayas(id) on delete set null;

create index if not exists directions_wilaya_id_idx     on public.directions(wilaya_id);
create index if not exists establishments_wilaya_id_idx on public.establishments(wilaya_id);
create index if not exists profiles_wilaya_id_idx       on public.profiles(wilaya_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ÉTABLISSEMENTS — champs complémentaires (§5)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.establishments add column if not exists code          text;
alter table public.establishments add column if not exists director_name text;
alter table public.establishments add column if not exists status        public.entity_status not null default 'active';
alter table public.establishments add column if not exists created_by    uuid references public.profiles(id) on delete set null;

create unique index if not exists establishments_code_uniq
  on public.establishments(code) where code is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. MODES DE FORMATION (§8)
--    Table de nomenclature — vide au départ. Le ministère saisit les modes
--    (ou importe les 5 modes officiels via l'interface, action explicite).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.training_modes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,   -- residential | apprenticeship | distance | evening | mobile
  name              text not null,
  name_ar           text,
  description       text,
  target_audience   text,
  min_age           smallint check (min_age is null or min_age between 0 and 99),
  max_age           smallint check (max_age is null or max_age between 0 and 99),
  max_age_female    smallint check (max_age_female is null or max_age_female between 0 and 99),
  requires_contract boolean not null default false,  -- apprentissage → contrat obligatoire
  status            public.entity_status not null default 'active',
  position          smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists training_modes_updated on public.training_modes;
create trigger training_modes_updated
  before update on public.training_modes
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FILIÈRES / DOMAINES (§7 « Fields »)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.fields (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  name        text not null unique,
  name_ar     text,
  description text,
  status      public.entity_status not null default 'active',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists fields_updated on public.fields;
create trigger fields_updated
  before update on public.fields
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PROGRAMMES DE FORMATION NATIONAUX (§7 et §12)
--    Nomenclature nationale créée par le ministère. Un établissement ouvre
--    ensuite une « spécialité » (offre locale) rattachée à un programme.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.programs (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  name                  text not null,
  name_ar               text,
  description           text,
  field_id              uuid references public.fields(id) on delete set null,
  duration_months       smallint check (duration_months is null or duration_months > 0),
  semesters_count       smallint not null default 5 check (semesters_count between 1 and 5),
  establishment_type    public.establishment_type,      -- type d'établissement habilité
  training_mode_id      uuid references public.training_modes(id) on delete set null,
  target_audience       text,
  seats                 integer check (seats is null or seats >= 0),
  required_level        text,                            -- ex : « 3AS », « 9AF »
  qualification_level   text,                            -- ex : « Technicien Supérieur »
  internship_required   boolean not null default true,   -- stage pratique S5
  practical_required    boolean not null default false,  -- travaux pratiques obligatoires
  apprenticeship_allowed boolean not null default false,
  status                public.publication_status not null default 'draft',
  published_at          timestamptz,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists programs_updated on public.programs;
create trigger programs_updated
  before update on public.programs
  for each row execute function public.set_updated_at();

create index if not exists programs_field_idx  on public.programs(field_id);
create index if not exists programs_mode_idx   on public.programs(training_mode_id);
create index if not exists programs_status_idx on public.programs(status);

-- Structure semestrielle d'un programme
create table if not exists public.program_semesters (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  semester    public.semester_code not null,
  title       text,
  description text,
  objectives  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (program_id, semester)
);

drop trigger if exists program_semesters_updated on public.program_semesters;
create trigger program_semesters_updated
  before update on public.program_semesters
  for each row execute function public.set_updated_at();

-- Modules / matières du référentiel national
create table if not exists public.program_modules (
  id                  uuid primary key default gen_random_uuid(),
  program_semester_id uuid not null references public.program_semesters(id) on delete cascade,
  code                text,
  name                text not null,
  description         text,
  objectives          text,
  coefficient         numeric(4,2) not null default 1 check (coefficient > 0),
  credits             smallint check (credits is null or credits >= 0),
  hours               smallint check (hours is null or hours >= 0),
  is_practical        boolean not null default false,
  position            smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists program_modules_updated on public.program_modules;
create trigger program_modules_updated
  before update on public.program_modules
  for each row execute function public.set_updated_at();

create index if not exists program_modules_semester_idx on public.program_modules(program_semester_id);

-- Documents pédagogiques publiés (PDF, programmes officiels, guides…)
create table if not exists public.program_documents (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  semester    public.semester_code,
  module_id   uuid references public.program_modules(id) on delete set null,
  title       text not null,
  description text,
  category    text not null default 'programme',  -- programme | cours | guide | tp | administratif | examen
  file_path   text,                               -- bucket « curricula »
  file_name   text,
  file_size   bigint,
  published   boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists program_documents_updated on public.program_documents;
create trigger program_documents_updated
  before update on public.program_documents
  for each row execute function public.set_updated_at();

create index if not exists program_documents_program_idx on public.program_documents(program_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. OFFRE LOCALE : spécialités, sessions, classes, sections (§7)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.specialties add column if not exists program_id       uuid references public.programs(id) on delete set null;
alter table public.specialties add column if not exists description      text;
alter table public.specialties add column if not exists training_mode_id uuid references public.training_modes(id) on delete set null;
alter table public.specialties add column if not exists seats            integer check (seats is null or seats >= 0);
alter table public.specialties add column if not exists status           public.entity_status not null default 'active';

create index if not exists specialties_program_idx on public.specialties(program_id);

-- Sessions de formation (rentrées)
create table if not exists public.training_sessions (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,                   -- ex : « Rentrée Février 2026 »
  establishment_id uuid references public.establishments(id) on delete cascade,
  academic_year    text,
  start_date       date,
  end_date         date,
  status           public.entity_status not null default 'active',
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

drop trigger if exists training_sessions_updated on public.training_sessions;
create trigger training_sessions_updated
  before update on public.training_sessions
  for each row execute function public.set_updated_at();

create index if not exists training_sessions_estab_idx on public.training_sessions(establishment_id);

-- Classes (table `groups` existante) — champs complémentaires
alter table public.groups add column if not exists semester         public.semester_code;
alter table public.groups add column if not exists training_mode_id uuid references public.training_modes(id) on delete set null;
alter table public.groups add column if not exists session_id       uuid references public.training_sessions(id) on delete set null;
alter table public.groups add column if not exists capacity         integer check (capacity is null or capacity >= 0);
alter table public.groups add column if not exists status           public.entity_status not null default 'active';

create index if not exists groups_session_idx on public.groups(session_id);

-- Sections (subdivision d'une classe)
create table if not exists public.sections (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  name       text not null,
  capacity   integer check (capacity is null or capacity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);

drop trigger if exists sections_updated on public.sections;
create trigger sections_updated
  before update on public.sections
  for each row execute function public.set_updated_at();

-- Matières locales — rattachement au référentiel + semestre
alter table public.subjects add column if not exists semester          public.semester_code;
alter table public.subjects add column if not exists program_module_id uuid references public.program_modules(id) on delete set null;
alter table public.subjects add column if not exists credits           smallint check (credits is null or credits >= 0);
alter table public.subjects add column if not exists group_id          uuid references public.groups(id) on delete set null;

create index if not exists subjects_semester_idx on public.subjects(semester);
create index if not exists subjects_group_idx    on public.subjects(group_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ÉTUDIANTS — parcours académique (§10)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.students add column if not exists program_id        uuid references public.programs(id) on delete set null;
alter table public.students add column if not exists training_mode_id  uuid references public.training_modes(id) on delete set null;
alter table public.students add column if not exists section_id        uuid references public.sections(id) on delete set null;
alter table public.students add column if not exists session_id        uuid references public.training_sessions(id) on delete set null;
alter table public.students add column if not exists current_semester  public.semester_code not null default 's1';
alter table public.students add column if not exists enrollment_status public.student_enrollment_status not null default 'enrolled';
alter table public.students add column if not exists birth_date        date;
alter table public.students add column if not exists gender            text check (gender is null or gender in ('m', 'f'));

create index if not exists students_program_idx  on public.students(program_id);
create index if not exists students_semester_idx on public.students(current_semester);
create index if not exists students_status_idx   on public.students(enrollment_status);

-- Relevé semestriel : une ligne par (étudiant, semestre, année)
create table if not exists public.student_semesters (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  semester         public.semester_code not null,
  academic_year    text not null default '',
  average          numeric(5,2) check (average is null or (average >= 0 and average <= 20)),
  resit_average    numeric(5,2) check (resit_average is null or (resit_average >= 0 and resit_average <= 20)),
  final_average    numeric(5,2) check (final_average is null or (final_average >= 0 and final_average <= 20)),
  credits_earned   smallint,
  attendance_rate  numeric(5,2),
  status           public.semester_status not null default 'in_progress',
  decision         public.failure_decision,
  decision_note    text,
  validated_at     timestamptz,
  decided_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (student_id, semester, academic_year)
);

drop trigger if exists student_semesters_updated on public.student_semesters;
create trigger student_semesters_updated
  before update on public.student_semesters
  for each row execute function public.set_updated_at();

create index if not exists student_semesters_student_idx on public.student_semesters(student_id);
create index if not exists student_semesters_status_idx  on public.student_semesters(status);

-- Notes : rattachement au semestre + session de rattrapage
alter table public.grades add column if not exists semester public.semester_code;
alter table public.grades add column if not exists is_resit boolean not null default false;

create index if not exists grades_semester_idx on public.grades(semester);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RÈGLES ACADÉMIQUES CONFIGURABLES (§11 — pas de règle codée en dur)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.academic_rules (
  id                    uuid primary key default gen_random_uuid(),
  scope                 public.rule_scope not null default 'national',
  wilaya_id             uuid references public.wilayas(id) on delete cascade,
  establishment_id      uuid references public.establishments(id) on delete cascade,
  label                 text not null default 'Règlement pédagogique',
  pass_mark             numeric(4,2) not null default 10 check (pass_mark >= 0 and pass_mark <= 20),
  resit_pass_mark       numeric(4,2) not null default 10 check (resit_pass_mark >= 0 and resit_pass_mark <= 20),
  auto_progress         boolean not null default true,   -- passage auto au semestre suivant
  auto_resit            boolean not null default true,   -- bascule auto en « rattrapage »
  on_resit_failure      public.failure_decision not null default 'manual_review',
  max_repeats           smallint not null default 1 check (max_repeats >= 0),
  min_attendance_rate   numeric(5,2),                    -- optionnel : présence minimale
  active                boolean not null default true,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (scope <> 'wilaya'        or wilaya_id is not null),
  check (scope <> 'establishment' or establishment_id is not null)
);

drop trigger if exists academic_rules_updated on public.academic_rules;
create trigger academic_rules_updated
  before update on public.academic_rules
  for each row execute function public.set_updated_at();

create unique index if not exists academic_rules_national_uniq
  on public.academic_rules(scope) where scope = 'national' and active;
create unique index if not exists academic_rules_wilaya_uniq
  on public.academic_rules(wilaya_id) where scope = 'wilaya' and active;
create unique index if not exists academic_rules_estab_uniq
  on public.academic_rules(establishment_id) where scope = 'establishment' and active;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CONTRATS D'APPRENTISSAGE (§9) ET STAGES S5 (§13)
--    Une seule table, discriminée par `kind`, pour partager le workflow de
--    validation (soumission → examen → approbation/refus/modification).
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.contract_kind as enum ('apprenticeship', 'internship');
exception when duplicate_object then null; end $$;

create table if not exists public.contracts (
  id                 uuid primary key default gen_random_uuid(),
  kind               public.contract_kind not null,
  student_id         uuid not null references public.profiles(id) on delete cascade,
  establishment_id   uuid references public.establishments(id) on delete set null,
  semester           public.semester_code,             -- stage pratique → 's5'
  company_name       text not null,
  company_address    text,
  location           text,
  start_date         date,
  end_date           date,
  duration_days      integer generated always as (
                       case when start_date is not null and end_date is not null
                            then (end_date - start_date) else null end
                     ) stored,
  supervisor_name    text,
  supervisor_role    text,
  supervisor_email   text,
  supervisor_phone   text,
  contract_file_path text,                             -- bucket « contracts »
  contract_file_name text,
  contract_file_size bigint,
  notes              text,
  status             public.contract_status not null default 'pending',
  completion         public.completion_status not null default 'not_started',
  review_comment     text,
  reviewed_by        uuid references public.profiles(id) on delete set null,
  reviewed_at        timestamptz,
  submitted_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

drop trigger if exists contracts_updated on public.contracts;
create trigger contracts_updated
  before update on public.contracts
  for each row execute function public.set_updated_at();

create index if not exists contracts_student_idx on public.contracts(student_id);
create index if not exists contracts_estab_idx   on public.contracts(establishment_id);
create index if not exists contracts_status_idx  on public.contracts(status);
create index if not exists contracts_kind_idx    on public.contracts(kind);

-- Pièces justificatives complémentaires
create table if not exists public.contract_attachments (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  title       text,
  file_path   text not null,
  file_name   text,
  file_size   bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists contract_attachments_contract_idx on public.contract_attachments(contract_id);

-- Historique de validation (traçabilité des décisions)
create table if not exists public.contract_reviews (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  from_status public.contract_status,
  to_status   public.contract_status not null,
  comment     text,
  reviewer_id uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists contract_reviews_contract_idx on public.contract_reviews(contract_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. NOTIFICATIONS (§20)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       public.notification_kind not null default 'announcement',
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx   on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. PERMISSIONS FINES (§6 / §23) — au-delà du rôle
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_permissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  permission text not null,     -- ex : 'contracts.review', 'reports.export', 'users.manage'
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, permission)
);

create index if not exists user_permissions_user_idx on public.user_permissions(user_id);

-- Journal d'audit des actions sensibles
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_actor_idx  on public.audit_log(actor_id, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log(entity, entity_id);
