-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Buckets Supabase Storage et policies associées
--
--  Buckets :
--    - course-materials   : supports de cours (déposés par les profs).
--                           Lecture : étudiants de l'établissement.
--    - exam-submissions   : fichiers de réponse aux examens.
--                           Lecture : prof de la matière + admin de l'établissement.
--    - documents          : documents administratifs générés / téléversés par
--                           l'admin pour les demandes. Privé.
--
--  Convention de nommage des objets :
--    course-materials/{establishment_id}/{subject_id}/{filename}
--    exam-submissions/{exam_id}/{student_id}-{filename}
--    documents/{establishment_id}/{student_id}/{type}-{timestamp}.pdf
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Création des buckets (privés, accès via policies) ──────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-materials',  'course-materials',  false, 52428800, null),   -- 50 MB
  ('exam-submissions',  'exam-submissions',  false, 52428800, null),
  ('documents',         'documents',         false, 10485760,
    array['application/pdf','image/png','image/jpeg'])
on conflict (id) do nothing;

-- ─── Helper : extraire l'établissement depuis le chemin (1er segment) ───────

create or replace function public.storage_path_estab(p text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(p, '/', 1), '')::uuid
$$;

-- ─── COURSE-MATERIALS ──────────────────────────────────────────────────────

-- Lecture : tout utilisateur dont l'établissement match le 1er segment du path
create policy "course-mat read: own estab"
  on storage.objects for select
  using (
    bucket_id = 'course-materials'
    and public.storage_path_estab(name) = public.current_establishment()
  );

create policy "course-mat read: ministry"
  on storage.objects for select
  using (
    bucket_id = 'course-materials'
    and public.has_role('ministry')
  );

create policy "course-mat read: direction"
  on storage.objects for select
  using (
    bucket_id = 'course-materials'
    and public.has_role('direction')
    and public.establishment_in_my_direction(public.storage_path_estab(name))
  );

-- Écriture / suppression : professeur ou admin de l'établissement
create policy "course-mat write: teacher or admin"
  on storage.objects for insert
  with check (
    bucket_id = 'course-materials'
    and public.has_any_role(array['teacher','admin']::public.user_role[])
    and public.storage_path_estab(name) = public.current_establishment()
  );

create policy "course-mat update: teacher or admin"
  on storage.objects for update
  using (
    bucket_id = 'course-materials'
    and public.has_any_role(array['teacher','admin']::public.user_role[])
    and public.storage_path_estab(name) = public.current_establishment()
  );

create policy "course-mat delete: teacher or admin"
  on storage.objects for delete
  using (
    bucket_id = 'course-materials'
    and public.has_any_role(array['teacher','admin']::public.user_role[])
    and public.storage_path_estab(name) = public.current_establishment()
  );

-- ─── EXAM-SUBMISSIONS ──────────────────────────────────────────────────────
--   Convention : exam-submissions/{exam_id}/{student_id}-{filename}

-- L'étudiant peut lire/écrire les objets dont le nom contient son uid après le '/'.
-- On se base sur storage.foldername(name) → premier élément = exam_id ; le nom
-- du fichier commence par {student_id}-…
create policy "exam-sub read: student own"
  on storage.objects for select
  using (
    bucket_id = 'exam-submissions'
    and position(auth.uid()::text in objects.name) > 0
  );

create policy "exam-sub write: student own"
  on storage.objects for insert
  with check (
    bucket_id = 'exam-submissions'
    and public.has_role('student')
    and position(auth.uid()::text in objects.name) > 0
  );

create policy "exam-sub read: teacher of subject"
  on storage.objects for select
  using (
    bucket_id = 'exam-submissions'
    and public.has_role('teacher')
    and exists (
      select 1
      from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      where sub.teacher_id = auth.uid()
        and split_part(objects.name, '/', 1) = e.id::text
    )
  );

create policy "exam-sub read: admin of estab"
  on storage.objects for select
  using (
    bucket_id = 'exam-submissions'
    and public.has_role('admin')
    and exists (
      select 1
      from public.exams e
      join public.subjects sub on sub.id = e.subject_id
      join public.specialties sp on sp.id = sub.specialty_id
      where sp.establishment_id = public.current_establishment()
        and split_part(objects.name, '/', 1) = e.id::text
    )
  );

-- ─── DOCUMENTS ─────────────────────────────────────────────────────────────
--   Convention : documents/{establishment_id}/{student_id}/{file}
--   Lecture : étudiant concerné + admin de l'établissement.

create policy "docs read: student own"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 2) = auth.uid()::text
  );

create policy "docs read: admin own estab"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and public.has_role('admin')
    and public.storage_path_estab(name) = public.current_establishment()
  );

create policy "docs write: admin only"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and public.has_role('admin')
    and public.storage_path_estab(name) = public.current_establishment()
  );

create policy "docs update: admin only"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and public.has_role('admin')
    and public.storage_path_estab(name) = public.current_establishment()
  );

create policy "docs delete: admin only"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and public.has_role('admin')
    and public.storage_path_estab(name) = public.current_establishment()
  );
