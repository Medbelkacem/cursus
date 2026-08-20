-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — RLS des tables de la structure nationale (§23)
--
--  Hiérarchie d'autorisation, appliquée EN BASE (jamais seulement dans l'UI) :
--    Ministère    → national, tout
--    Direction    → sa wilaya uniquement
--    Établissement→ son établissement uniquement
--    Professeur   → ses classes / matières
--    Étudiant     → son propre dossier
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.wilayas              enable row level security;
alter table public.training_modes       enable row level security;
alter table public.fields               enable row level security;
alter table public.programs             enable row level security;
alter table public.program_semesters    enable row level security;
alter table public.program_modules      enable row level security;
alter table public.program_documents    enable row level security;
alter table public.training_sessions    enable row level security;
alter table public.sections             enable row level security;
alter table public.student_semesters    enable row level security;
alter table public.academic_rules       enable row level security;
alter table public.contracts            enable row level security;
alter table public.contract_attachments enable row level security;
alter table public.contract_reviews     enable row level security;
alter table public.notifications        enable row level security;
alter table public.user_permissions     enable row level security;
alter table public.audit_log            enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- WILAYAS (§4)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "wilaya: read all"        on public.wilayas;
drop policy if exists "wilaya: ministry manages" on public.wilayas;
drop policy if exists "wilaya: direction updates own" on public.wilayas;

create policy "wilaya: read all"
  on public.wilayas for select
  using (auth.uid() is not null);

create policy "wilaya: ministry manages"
  on public.wilayas for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

-- Le responsable de wilaya peut mettre à jour les coordonnées de SA wilaya
create policy "wilaya: direction updates own"
  on public.wilayas for update
  using (public.has_role('direction') and id = public.current_wilaya())
  with check (public.has_role('direction') and id = public.current_wilaya());

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTABLISSEMENTS — correctif : portée wilaya en plus de direction_id
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "estab: direction updates own zone" on public.establishments;

create policy "estab: direction updates own zone"
  on public.establishments for update
  using (public.has_role('direction') and public.establishment_in_my_direction(id))
  with check (public.has_role('direction') and public.establishment_in_my_direction(id));

-- ─────────────────────────────────────────────────────────────────────────────
-- NOMENCLATURE NATIONALE : modes de formation, filières, programmes (§7, §8, §12)
--   Lecture ouverte à tout compte authentifié (les étudiants doivent voir leur
--   programme) ; écriture réservée au ministère.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare tbl text;
begin
  foreach tbl in array array['training_modes', 'fields', 'programs',
                             'program_semesters', 'program_modules']
  loop
    execute format('drop policy if exists %I on public.%I', tbl || ': read all', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || ': ministry manages', tbl);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() is not null)',
      tbl || ': read all', tbl);
    execute format(
      'create policy %I on public.%I for all using (public.has_role(''ministry''))
         with check (public.has_role(''ministry''))',
      tbl || ': ministry manages', tbl);
  end loop;
end $$;

-- Documents pédagogiques : les étudiants ne voient que le publié (§12)
drop policy if exists "progdoc: read published"   on public.program_documents;
drop policy if exists "progdoc: staff read all"   on public.program_documents;
drop policy if exists "progdoc: ministry manages" on public.program_documents;

create policy "progdoc: read published"
  on public.program_documents for select
  using (auth.uid() is not null and published);

create policy "progdoc: staff read all"
  on public.program_documents for select
  using (public.has_any_role(array['ministry', 'direction', 'admin', 'teacher']::public.user_role[]));

create policy "progdoc: ministry manages"
  on public.program_documents for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

-- ─────────────────────────────────────────────────────────────────────────────
-- SESSIONS & SECTIONS (§7) — gérées par l'établissement
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "session: read scope"     on public.training_sessions;
drop policy if exists "session: admin manages"  on public.training_sessions;
drop policy if exists "session: ministry manages" on public.training_sessions;

create policy "session: read scope"
  on public.training_sessions for select
  using (
    public.has_role('ministry')
    or (public.has_role('direction') and public.establishment_in_my_direction(establishment_id))
    or establishment_id = public.current_establishment()
  );

create policy "session: admin manages"
  on public.training_sessions for all
  using (public.has_role('admin') and establishment_id = public.current_establishment())
  with check (public.has_role('admin') and establishment_id = public.current_establishment());

create policy "session: ministry manages"
  on public.training_sessions for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

drop policy if exists "section: read scope"    on public.sections;
drop policy if exists "section: admin manages" on public.sections;
drop policy if exists "section: ministry manages" on public.sections;

create policy "section: read scope"
  on public.sections for select
  using (
    public.has_role('ministry')
    or exists (
      select 1 from public.groups g
      join public.specialties sp on sp.id = g.specialty_id
      where g.id = sections.group_id
        and (
          sp.establishment_id = public.current_establishment()
          or (public.has_role('direction') and public.establishment_in_my_direction(sp.establishment_id))
        )
    )
  );

create policy "section: admin manages"
  on public.sections for all
  using (
    public.has_role('admin') and exists (
      select 1 from public.groups g
      join public.specialties sp on sp.id = g.specialty_id
      where g.id = sections.group_id and sp.establishment_id = public.current_establishment()
    )
  )
  with check (
    public.has_role('admin') and exists (
      select 1 from public.groups g
      join public.specialties sp on sp.id = g.specialty_id
      where g.id = sections.group_id and sp.establishment_id = public.current_establishment()
    )
  );

create policy "section: ministry manages"
  on public.sections for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

-- ─────────────────────────────────────────────────────────────────────────────
-- RELEVÉS SEMESTRIELS (§10, §11)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "sem: student reads self"  on public.student_semesters;
drop policy if exists "sem: staff reads scope"   on public.student_semesters;
drop policy if exists "sem: admin manages scope" on public.student_semesters;
drop policy if exists "sem: ministry manages"    on public.student_semesters;

create policy "sem: student reads self"
  on public.student_semesters for select
  using (student_id = auth.uid());

create policy "sem: staff reads scope"
  on public.student_semesters for select
  using (public.can_manage_student(student_id));

create policy "sem: admin manages scope"
  on public.student_semesters for all
  using (
    public.has_any_role(array['admin', 'direction']::public.user_role[])
    and public.can_manage_student(student_id)
  )
  with check (
    public.has_any_role(array['admin', 'direction']::public.user_role[])
    and public.can_manage_student(student_id)
  );

create policy "sem: ministry manages"
  on public.student_semesters for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

-- ─────────────────────────────────────────────────────────────────────────────
-- RÈGLEMENT PÉDAGOGIQUE (§11 — configurable, jamais codé en dur)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "rule: read all"           on public.academic_rules;
drop policy if exists "rule: ministry manages"   on public.academic_rules;
drop policy if exists "rule: direction manages"  on public.academic_rules;
drop policy if exists "rule: admin manages"      on public.academic_rules;

create policy "rule: read all"
  on public.academic_rules for select
  using (auth.uid() is not null);

create policy "rule: ministry manages"
  on public.academic_rules for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

create policy "rule: direction manages"
  on public.academic_rules for all
  using (public.has_role('direction') and scope = 'wilaya' and wilaya_id = public.current_wilaya())
  with check (public.has_role('direction') and scope = 'wilaya' and wilaya_id = public.current_wilaya());

create policy "rule: admin manages"
  on public.academic_rules for all
  using (public.has_role('admin') and scope = 'establishment' and establishment_id = public.current_establishment())
  with check (public.has_role('admin') and scope = 'establishment' and establishment_id = public.current_establishment());

-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRATS D'APPRENTISSAGE & STAGES (§9, §13, §14)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "contract: student reads self"    on public.contracts;
drop policy if exists "contract: student submits"       on public.contracts;
drop policy if exists "contract: student edits pending" on public.contracts;
drop policy if exists "contract: staff reads scope"     on public.contracts;
drop policy if exists "contract: admin reviews"         on public.contracts;
drop policy if exists "contract: direction reviews"     on public.contracts;
drop policy if exists "contract: ministry manages"      on public.contracts;

create policy "contract: student reads self"
  on public.contracts for select
  using (student_id = auth.uid());

create policy "contract: student submits"
  on public.contracts for insert
  with check (student_id = auth.uid() and public.has_role('student') and public.is_active());

-- L'étudiant ne peut modifier que tant que le dossier n'est pas approuvé
create policy "contract: student edits pending"
  on public.contracts for update
  using (
    student_id = auth.uid()
    and status in ('pending', 'rejected', 'modification_required')
  )
  with check (
    student_id = auth.uid()
    and status in ('pending', 'under_review')
  );

create policy "contract: staff reads scope"
  on public.contracts for select
  using (public.can_manage_student(student_id));

create policy "contract: admin reviews"
  on public.contracts for update
  using (public.has_role('admin') and establishment_id = public.current_establishment())
  with check (public.has_role('admin') and establishment_id = public.current_establishment());

create policy "contract: direction reviews"
  on public.contracts for update
  using (public.has_role('direction') and public.establishment_in_my_direction(establishment_id))
  with check (public.has_role('direction') and public.establishment_in_my_direction(establishment_id));

create policy "contract: ministry manages"
  on public.contracts for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

-- Pièces jointes — suivent le contrat
drop policy if exists "cattach: read scope"    on public.contract_attachments;
drop policy if exists "cattach: student write" on public.contract_attachments;
drop policy if exists "cattach: staff write"   on public.contract_attachments;

create policy "cattach: read scope"
  on public.contract_attachments for select
  using (exists (
    select 1 from public.contracts c
    where c.id = contract_attachments.contract_id
      and (c.student_id = auth.uid() or public.can_manage_student(c.student_id))
  ));

create policy "cattach: student write"
  on public.contract_attachments for all
  using (exists (
    select 1 from public.contracts c
    where c.id = contract_attachments.contract_id and c.student_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.contracts c
    where c.id = contract_attachments.contract_id and c.student_id = auth.uid()
  ));

create policy "cattach: staff write"
  on public.contract_attachments for all
  using (exists (
    select 1 from public.contracts c
    where c.id = contract_attachments.contract_id
      and public.can_manage_student(c.student_id) and not public.has_role('teacher')
  ))
  with check (exists (
    select 1 from public.contracts c
    where c.id = contract_attachments.contract_id
      and public.can_manage_student(c.student_id) and not public.has_role('teacher')
  ));

-- Historique de validation — lecture seule côté client
drop policy if exists "creview: read scope" on public.contract_reviews;

create policy "creview: read scope"
  on public.contract_reviews for select
  using (exists (
    select 1 from public.contracts c
    where c.id = contract_reviews.contract_id
      and (c.student_id = auth.uid() or public.can_manage_student(c.student_id))
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS (§20)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "notif: read own"    on public.notifications;
drop policy if exists "notif: update own"  on public.notifications;
drop policy if exists "notif: delete own"  on public.notifications;
drop policy if exists "notif: staff sends" on public.notifications;

create policy "notif: read own"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notif: update own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notif: delete own"
  on public.notifications for delete
  using (user_id = auth.uid());

-- Annonces administratives : le personnel peut notifier son périmètre
create policy "notif: staff sends"
  on public.notifications for insert
  with check (
    public.has_role('ministry')
    or (public.has_any_role(array['admin', 'direction']::public.user_role[])
        and public.can_manage_student(user_id))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISSIONS FINES & AUDIT (§6, §23)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "perm: read own"         on public.user_permissions;
drop policy if exists "perm: ministry manages" on public.user_permissions;
drop policy if exists "perm: admin reads estab" on public.user_permissions;

create policy "perm: read own"
  on public.user_permissions for select
  using (user_id = auth.uid());

create policy "perm: admin reads estab"
  on public.user_permissions for select
  using (
    public.has_any_role(array['admin', 'direction']::public.user_role[])
    and exists (
      select 1 from public.profiles p
      where p.id = user_permissions.user_id
        and (
          p.establishment_id = public.current_establishment()
          or (public.has_role('direction') and p.establishment_id is not null
              and public.establishment_in_my_direction(p.establishment_id))
        )
    )
  );

create policy "perm: ministry manages"
  on public.user_permissions for all
  using (public.has_role('ministry'))
  with check (public.has_role('ministry'));

drop policy if exists "audit: ministry reads" on public.audit_log;

create policy "audit: ministry reads"
  on public.audit_log for select
  using (public.has_role('ministry'));
