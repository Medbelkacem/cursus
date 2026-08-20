-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Buckets pour les contrats / stages et les curricula (§9, §12, §13)
--
--  Buckets :
--    contracts   : contrats d'apprentissage, conventions de stage et pièces
--                  justificatives déposés par l'étudiant.
--                  Chemin : contracts/{student_id}/{contract_id}/{fichier}
--    curricula   : programmes officiels, cours, guides publiés par le ministère.
--                  Chemin : curricula/{program_id}/{fichier}
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('contracts', 'contracts', false, 20971520,     -- 20 MB
    array['application/pdf','image/png','image/jpeg','image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('curricula', 'curricula', false, 52428800,     -- 50 MB
    null)
on conflict (id) do nothing;

-- Premier segment du chemin, en uuid (null si non convertible)
create or replace function public.storage_path_owner(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return nullif(split_part(p, '/', 1), '')::uuid;
exception when others then
  return null;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRACTS
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "contracts read: own"        on storage.objects;
drop policy if exists "contracts read: staff"      on storage.objects;
drop policy if exists "contracts write: student"   on storage.objects;
drop policy if exists "contracts write: staff"     on storage.objects;

-- L'étudiant lit et gère ses propres fichiers (1er segment = son id)
create policy "contracts read: own"
  on storage.objects for select
  using (
    bucket_id = 'contracts'
    and public.storage_path_owner(name) = auth.uid()
  );

create policy "contracts write: student"
  on storage.objects for all
  using (
    bucket_id = 'contracts'
    and public.storage_path_owner(name) = auth.uid()
  )
  with check (
    bucket_id = 'contracts'
    and public.storage_path_owner(name) = auth.uid()
  );

-- L'administration compétente lit les dossiers de son périmètre
create policy "contracts read: staff"
  on storage.objects for select
  using (
    bucket_id = 'contracts'
    and public.can_manage_student(public.storage_path_owner(name))
  );

create policy "contracts write: staff"
  on storage.objects for all
  using (
    bucket_id = 'contracts'
    and public.has_any_role(array['ministry','direction','admin']::public.user_role[])
    and public.can_manage_student(public.storage_path_owner(name))
  )
  with check (
    bucket_id = 'contracts'
    and public.has_any_role(array['ministry','direction','admin']::public.user_role[])
    and public.can_manage_student(public.storage_path_owner(name))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- CURRICULA — lecture par tout compte actif, écriture ministère
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "curricula read: authenticated" on storage.objects;
drop policy if exists "curricula write: ministry"     on storage.objects;

create policy "curricula read: authenticated"
  on storage.objects for select
  using (bucket_id = 'curricula' and auth.uid() is not null and public.is_active());

create policy "curricula write: ministry"
  on storage.objects for all
  using (bucket_id = 'curricula' and public.has_role('ministry'))
  with check (bucket_id = 'curricula' and public.has_role('ministry'));
