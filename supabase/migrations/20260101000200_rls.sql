-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Row Level Security (RLS)
--
--  Principe :
--    - On active RLS sur TOUTES les tables.
--    - On écrit des policies par rôle et par opération (select/insert/update/delete).
--    - Tout est refusé par défaut.
--
--  Lecture / écriture par rôle :
--    Étudiant   : lit son périmètre (ses notes, sa présence, ses cours/examens
--                 dans ses matières, ses demandes).
--    Professeur : lit/gère matières/cours/examens/présence/notes dont il est l'enseignant.
--    Admin      : gère TOUT au sein de son établissement.
--    Direction  : LECTURE seule des établissements de sa direction.
--    Ministère  : LECTURE seule de tout (statistiques).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Activer RLS sur toutes les tables
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.directions        enable row level security;
alter table public.establishments    enable row level security;
alter table public.specialties       enable row level security;
alter table public.groups            enable row level security;
alter table public.subjects          enable row level security;
alter table public.students          enable row level security;
alter table public.teachers          enable row level security;
alter table public.courses           enable row level security;
alter table public.attendance        enable row level security;
alter table public.grades            enable row level security;
alter table public.exams             enable row level security;
alter table public.exam_questions    enable row level security;
alter table public.exam_submissions  enable row level security;
alter table public.document_requests enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────────────────

-- L'utilisateur lit son propre profil (toujours, même en pending — sinon il
-- ne pourrait pas se voir comme "en attente")
create policy "profile: read self"
  on public.profiles for select
  using (id = auth.uid());

-- Ministère lit tout
create policy "profile: ministry reads all"
  on public.profiles for select
  using (public.has_role('ministry'));

-- Direction lit les profils de ses établissements
create policy "profile: direction reads own zone"
  on public.profiles for select
  using (
    public.has_role('direction')
    and establishment_id is not null
    and public.establishment_in_my_direction(establishment_id)
  );

-- Admin lit les profils de son établissement
create policy "profile: admin reads own establishment"
  on public.profiles for select
  using (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
  );

-- Professeur lit les autres profils de son établissement (mais pas direction/ministère)
create policy "profile: teacher reads peers"
  on public.profiles for select
  using (
    public.has_role('teacher')
    and establishment_id = public.current_establishment()
    and role in ('student', 'teacher', 'admin')
  );

-- L'utilisateur met à jour son propre profil (mais pas son rôle ni son statut)
create policy "profile: update self"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and status = (select status from public.profiles where id = auth.uid())
  );

-- Admin valide / refuse / met à jour les profils de son établissement
create policy "profile: admin manages own establishment"
  on public.profiles for update
  using (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
  )
  with check (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
    and role in ('student', 'teacher', 'admin')
  );

-- Ministère met à jour TOUT (peut nommer une direction, p. ex.)
create policy "profile: ministry manages all"
  on public.profiles for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

-- ─────────────────────────────────────────────────────────────────────────────
-- DIRECTIONS
-- ─────────────────────────────────────────────────────────────────────────────

create policy "direction: read all (everyone)"
  on public.directions for select
  using (auth.uid() is not null);

create policy "direction: ministry manages all"
  on public.directions for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

-- ─────────────────────────────────────────────────────────────────────────────
-- ESTABLISHMENTS
-- ─────────────────────────────────────────────────────────────────────────────

-- Liste publique (pour le formulaire d'inscription, on doit pouvoir lire la liste)
create policy "estab: read all (everyone)"
  on public.establishments for select
  using (auth.uid() is not null);

-- Direction met à jour ses établissements
create policy "estab: direction updates own zone"
  on public.establishments for update
  using (
    public.has_role('direction')
    and direction_id = public.current_direction()
  )
  with check (
    public.has_role('direction')
    and direction_id = public.current_direction()
  );

-- Ministère gère tout
create policy "estab: ministry manages all"
  on public.establishments for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

-- ─────────────────────────────────────────────────────────────────────────────
-- SPECIALTIES / GROUPS / SUBJECTS  (gérées par l'admin de l'établissement)
-- ─────────────────────────────────────────────────────────────────────────────

-- SPECIALTIES
create policy "spec: read peer establishment"
  on public.specialties for select
  using (
    public.has_role('ministry')
    or public.has_role('direction') and public.establishment_in_my_direction(establishment_id)
    or establishment_id = public.current_establishment()
  );

create policy "spec: admin manages own"
  on public.specialties for all
  using (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
  )
  with check (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
  );

-- GROUPS
create policy "group: read peer establishment"
  on public.groups for select
  using (
    exists (
      select 1 from public.specialties s
      where s.id = groups.specialty_id
        and (
          public.has_role('ministry')
          or (public.has_role('direction') and public.establishment_in_my_direction(s.establishment_id))
          or s.establishment_id = public.current_establishment()
        )
    )
  );

create policy "group: admin manages own"
  on public.groups for all
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.specialties s
      where s.id = groups.specialty_id
        and s.establishment_id = public.current_establishment()
    )
  )
  with check (
    public.has_role('admin')
    and exists (
      select 1 from public.specialties s
      where s.id = groups.specialty_id
        and s.establishment_id = public.current_establishment()
    )
  );

-- SUBJECTS
create policy "subj: read peer establishment"
  on public.subjects for select
  using (
    exists (
      select 1 from public.specialties s
      where s.id = subjects.specialty_id
        and (
          public.has_role('ministry')
          or (public.has_role('direction') and public.establishment_in_my_direction(s.establishment_id))
          or s.establishment_id = public.current_establishment()
        )
    )
  );

create policy "subj: admin manages own"
  on public.subjects for all
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.specialties s
      where s.id = subjects.specialty_id
        and s.establishment_id = public.current_establishment()
    )
  )
  with check (
    public.has_role('admin')
    and exists (
      select 1 from public.specialties s
      where s.id = subjects.specialty_id
        and s.establishment_id = public.current_establishment()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- STUDENTS / TEACHERS  (lignes spécifiques)
-- ─────────────────────────────────────────────────────────────────────────────

create policy "stud: read self"
  on public.students for select
  using (profile_id = auth.uid());

create policy "stud: peers read own estab"
  on public.students for select
  using (
    public.has_role('ministry')
    or (public.has_role('direction') and public.establishment_in_my_direction(establishment_id))
    or establishment_id = public.current_establishment()
  );

create policy "stud: admin manages own"
  on public.students for all
  using (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
  )
  with check (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
  );

create policy "teach: read self"
  on public.teachers for select
  using (profile_id = auth.uid());

create policy "teach: peers read own estab"
  on public.teachers for select
  using (
    public.has_role('ministry')
    or (public.has_role('direction') and public.establishment_in_my_direction(establishment_id))
    or establishment_id = public.current_establishment()
  );

create policy "teach: admin manages own"
  on public.teachers for all
  using (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
  )
  with check (
    public.has_role('admin')
    and establishment_id = public.current_establishment()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- COURSES (supports de cours)
-- ─────────────────────────────────────────────────────────────────────────────

create policy "course: read in own estab"
  on public.courses for select
  using (
    exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = courses.subject_id
        and (
          public.has_role('ministry')
          or (public.has_role('direction') and public.establishment_in_my_direction(sp.establishment_id))
          or sp.establishment_id = public.current_establishment()
        )
    )
  );

create policy "course: teacher manages own"
  on public.courses for all
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = courses.subject_id
        and sub.teacher_id = auth.uid()
    )
  )
  with check (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = courses.subject_id
        and sub.teacher_id = auth.uid()
    )
  );

create policy "course: admin manages own estab"
  on public.courses for all
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = courses.subject_id
        and sp.establishment_id = public.current_establishment()
    )
  )
  with check (
    public.has_role('admin')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = courses.subject_id
        and sp.establishment_id = public.current_establishment()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ATTENDANCE
-- ─────────────────────────────────────────────────────────────────────────────

create policy "att: student reads self"
  on public.attendance for select
  using (student_id = auth.uid());

create policy "att: teacher reads own subjects"
  on public.attendance for select
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = attendance.subject_id
        and sub.teacher_id = auth.uid()
    )
  );

create policy "att: admin reads own estab"
  on public.attendance for select
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = attendance.subject_id
        and sp.establishment_id = public.current_establishment()
    )
  );

create policy "att: direction reads own zone"
  on public.attendance for select
  using (
    public.has_role('direction')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = attendance.subject_id
        and public.establishment_in_my_direction(sp.establishment_id)
    )
  );

create policy "att: ministry reads all"
  on public.attendance for select
  using (public.has_role('ministry'));

create policy "att: teacher manages own"
  on public.attendance for all
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = attendance.subject_id
        and sub.teacher_id = auth.uid()
    )
  )
  with check (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = attendance.subject_id
        and sub.teacher_id = auth.uid()
    )
  );

create policy "att: admin manages own estab"
  on public.attendance for all
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = attendance.subject_id
        and sp.establishment_id = public.current_establishment()
    )
  )
  with check (
    public.has_role('admin')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = attendance.subject_id
        and sp.establishment_id = public.current_establishment()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- GRADES
-- ─────────────────────────────────────────────────────────────────────────────

create policy "grade: student reads self"
  on public.grades for select
  using (student_id = auth.uid());

create policy "grade: teacher reads own subjects"
  on public.grades for select
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = grades.subject_id
        and sub.teacher_id = auth.uid()
    )
  );

create policy "grade: admin reads own estab"
  on public.grades for select
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = grades.subject_id
        and sp.establishment_id = public.current_establishment()
    )
  );

create policy "grade: direction reads own zone"
  on public.grades for select
  using (
    public.has_role('direction')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = grades.subject_id
        and public.establishment_in_my_direction(sp.establishment_id)
    )
  );

create policy "grade: ministry reads all"
  on public.grades for select
  using (public.has_role('ministry'));

create policy "grade: teacher manages own"
  on public.grades for all
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = grades.subject_id
        and sub.teacher_id = auth.uid()
    )
  )
  with check (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = grades.subject_id
        and sub.teacher_id = auth.uid()
    )
  );

create policy "grade: admin manages own estab"
  on public.grades for all
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = grades.subject_id
        and sp.establishment_id = public.current_establishment()
    )
  )
  with check (
    public.has_role('admin')
    and exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = grades.subject_id
        and sp.establishment_id = public.current_establishment()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- EXAMS  / EXAM_QUESTIONS / EXAM_SUBMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────

create policy "exam: read in own estab"
  on public.exams for select
  using (
    exists (
      select 1 from public.subjects sub
      join public.specialties sp on sp.id = sub.specialty_id
      where sub.id = exams.subject_id
        and (
          public.has_role('ministry')
          or (public.has_role('direction') and public.establishment_in_my_direction(sp.establishment_id))
          or sp.establishment_id = public.current_establishment()
        )
    )
  );

create policy "exam: teacher manages own"
  on public.exams for all
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = exams.subject_id
        and sub.teacher_id = auth.uid()
    )
  )
  with check (
    public.has_role('teacher')
    and exists (
      select 1 from public.subjects sub
      where sub.id = exams.subject_id
        and sub.teacher_id = auth.uid()
    )
  );

-- Étudiants peuvent voir les questions (sauf correct_answer — filtré côté app)
-- Note: la `correct_answer` reste accessible via cette policy. Côté client
-- on n'a JAMAIS besoin de la lire pour les étudiants. Les corrections sont
-- effectuées côté serveur (Edge Function) ou côté professeur.
-- Pour blinder davantage, on bloque correct_answer pour les étudiants
-- via une vue dédiée :  v_student_exam_questions  (non incluse ici, on s'en
-- chargera côté requêtes : select(...) sans la colonne).

create policy "exam_q: student reads"
  on public.exam_questions for select
  using (
    exists (
      select 1
      from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      join public.specialties sp on sp.id = sub.specialty_id
      where e.id = exam_questions.exam_id
        and (sp.establishment_id = public.current_establishment())
    )
  );

create policy "exam_q: teacher manages own"
  on public.exam_questions for all
  using (
    public.has_role('teacher')
    and exists (
      select 1
      from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      where e.id = exam_questions.exam_id
        and sub.teacher_id = auth.uid()
    )
  )
  with check (
    public.has_role('teacher')
    and exists (
      select 1
      from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      where e.id = exam_questions.exam_id
        and sub.teacher_id = auth.uid()
    )
  );

-- Soumissions : un étudiant ne lit / n'écrit que les siennes
create policy "exam_sub: student rw self"
  on public.exam_submissions for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "exam_sub: teacher reads own subjects"
  on public.exam_submissions for select
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      where e.id = exam_submissions.exam_id
        and sub.teacher_id = auth.uid()
    )
  );

create policy "exam_sub: teacher grades own subjects"
  on public.exam_submissions for update
  using (
    public.has_role('teacher')
    and exists (
      select 1 from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      where e.id = exam_submissions.exam_id
        and sub.teacher_id = auth.uid()
    )
  )
  with check (
    public.has_role('teacher')
    and exists (
      select 1 from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      where e.id = exam_submissions.exam_id
        and sub.teacher_id = auth.uid()
    )
  );

create policy "exam_sub: admin reads own estab"
  on public.exam_submissions for select
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      join public.specialties sp on sp.id = sub.specialty_id
      where e.id = exam_submissions.exam_id
        and sp.establishment_id = public.current_establishment()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENT_REQUESTS
-- ─────────────────────────────────────────────────────────────────────────────

create policy "docreq: student rw self"
  on public.document_requests for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and public.has_role('student'));

create policy "docreq: admin manages own estab"
  on public.document_requests for all
  using (
    public.has_role('admin')
    and exists (
      select 1 from public.students s
      where s.profile_id = document_requests.student_id
        and s.establishment_id = public.current_establishment()
    )
  )
  with check (
    public.has_role('admin')
    and exists (
      select 1 from public.students s
      where s.profile_id = document_requests.student_id
        and s.establishment_id = public.current_establishment()
    )
  );
