-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Statistiques des tableaux de bord (§17, §18, §19)
--
--  Chaque fonction est SECURITY DEFINER **et vérifie explicitement** les
--  droits de l'appelant : l'autorisation est donc appliquée côté serveur,
--  jamais seulement dans l'interface (§23).
--
--  Toutes renvoient du JSON ; sur une base vide elles renvoient des zéros,
--  jamais de données fictives (§1, §24).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Garde d'accès
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.assert_scope(
  p_wilaya uuid default null,
  p_estab  uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_active() then
    raise exception 'compte inactif' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = auth.uid();

  if v_role = 'ministry' then return; end if;

  if v_role = 'direction' then
    if p_estab is not null and public.establishment_in_my_direction(p_estab) then return; end if;
    if p_wilaya is not null and p_wilaya = public.current_wilaya() then return; end if;
    raise exception 'hors périmètre de votre wilaya' using errcode = '42501';
  end if;

  if v_role in ('admin', 'teacher') then
    if p_estab is not null and p_estab = public.current_establishment() then return; end if;
    raise exception 'hors périmètre de votre établissement' using errcode = '42501';
  end if;

  raise exception 'accès refusé' using errcode = '42501';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bloc réutilisable : agrégats sur un ensemble d'établissements
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.stats_for_establishments(p_estabs uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
est as (
  select e.* from public.establishments e where e.id = any(p_estabs)
),
stu as (
  select s.*, p.status as profile_status
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.establishment_id = any(p_estabs)
),
sem as (
  select ss.* from public.student_semesters ss
  join stu on stu.profile_id = ss.student_id
),
ctr as (
  select c.* from public.contracts c where c.establishment_id = any(p_estabs)
)
select jsonb_build_object(
  'establishments', jsonb_build_object(
    'total',   (select count(*) from est),
    'active',  (select count(*) from est where status = 'active'),
    'by_type', coalesce((
      select jsonb_object_agg(type, n) from (
        select type::text as type, count(*) as n from est group by type
      ) t), '{}'::jsonb),
    'by_wilaya', coalesce((
      select jsonb_agg(jsonb_build_object('wilaya', name, 'code', code, 'count', n) order by n desc)
      from (
        select w.name, w.code, count(*) as n
        from est join public.wilayas w on w.id = est.wilaya_id
        group by w.name, w.code
      ) t), '[]'::jsonb)
  ),

  'students', jsonb_build_object(
    'total',       (select count(*) from stu),
    'active',      (select count(*) from stu where enrollment_status = 'enrolled'),
    'graduated',   (select count(*) from stu where enrollment_status = 'graduated'),
    'repeating',   (select count(*) from stu where enrollment_status = 'repeating'),
    'dismissed',   (select count(*) from stu where enrollment_status = 'dismissed'),
    'pending',     (select count(*) from stu where profile_status = 'pending'),
    'by_semester', coalesce((
      select jsonb_object_agg(semester, n) from (
        select current_semester::text as semester, count(*) as n from stu group by current_semester
      ) t), '{}'::jsonb),
    'by_mode', coalesce((
      select jsonb_agg(jsonb_build_object('mode', name, 'code', code, 'count', n) order by n desc)
      from (
        select tm.name, tm.code, count(*) as n
        from stu join public.training_modes tm on tm.id = stu.training_mode_id
        group by tm.name, tm.code
      ) t), '[]'::jsonb),
    'by_program', coalesce((
      select jsonb_agg(jsonb_build_object('program', name, 'code', code, 'count', n) order by n desc)
      from (
        select pr.name, pr.code, count(*) as n
        from stu join public.programs pr on pr.id = stu.program_id
        group by pr.name, pr.code
      ) t), '[]'::jsonb),
    'by_specialty', coalesce((
      select jsonb_agg(jsonb_build_object('specialty', name, 'count', n) order by n desc)
      from (
        select sp.name, count(*) as n
        from stu join public.specialties sp on sp.id = stu.specialty_id
        group by sp.name
      ) t), '[]'::jsonb),
    'by_establishment', coalesce((
      select jsonb_agg(jsonb_build_object('establishment', name, 'count', n) order by n desc)
      from (
        select e.name, count(*) as n
        from stu join public.establishments e on e.id = stu.establishment_id
        group by e.name
      ) t), '[]'::jsonb)
  ),

  'academic', jsonb_build_object(
    'validated',      (select count(*) from sem where status = 'validated'),
    'pending_resit',  (select count(*) from sem where status = 'pending_resit'),
    'resit_failed',   (select count(*) from sem where status = 'resit_failed'),
    'in_progress',    (select count(*) from sem where status = 'in_progress'),
    'average',        (select round(avg(final_average)::numeric, 2) from sem where final_average is not null),
    'success_rate',   (select case when count(*) = 0 then null
                                   else round(100.0 * count(*) filter (where status = 'validated') / count(*), 1)
                              end
                       from sem where status <> 'in_progress'),
    'attendance_rate',(select round(avg(attendance_rate)::numeric, 1) from sem where attendance_rate is not null),
    'by_semester', coalesce((
      select jsonb_object_agg(semester, o) from (
        select semester::text as semester,
               jsonb_build_object(
                 'total', count(*),
                 'validated', count(*) filter (where status = 'validated'),
                 'resit', count(*) filter (where status = 'pending_resit'),
                 'average', round(avg(final_average)::numeric, 2)
               ) as o
        from sem group by semester
      ) t), '{}'::jsonb)
  ),

  'training', jsonb_build_object(
    'programs',    (select count(*) from public.programs),
    'published',   (select count(*) from public.programs where status = 'published'),
    'fields',      (select count(*) from public.fields),
    'modes',       (select count(*) from public.training_modes where status = 'active'),
    'specialties', (select count(*) from public.specialties sp where sp.establishment_id = any(p_estabs)),
    'groups',      (select count(*) from public.groups g
                     join public.specialties sp on sp.id = g.specialty_id
                    where sp.establishment_id = any(p_estabs)),
    'sessions',    (select count(*) from public.training_sessions where establishment_id = any(p_estabs)),
    'teachers',    (select count(*) from public.teachers where establishment_id = any(p_estabs)),
    'seats',       (select coalesce(sum(seats), 0) from public.specialties where establishment_id = any(p_estabs)),
    'capacity_vs_enrolled', jsonb_build_object(
      'capacity', (select coalesce(sum(seats), 0) from public.specialties where establishment_id = any(p_estabs)),
      'enrolled', (select count(*) from stu where enrollment_status = 'enrolled')
    )
  ),

  'apprenticeship', jsonb_build_object(
    'students',  (select count(*) from stu
                   join public.training_modes tm on tm.id = stu.training_mode_id
                  where tm.requires_contract),
    'submitted', (select count(*) from ctr where kind = 'apprenticeship'),
    'pending',   (select count(*) from ctr where kind = 'apprenticeship' and status = 'pending'),
    'review',    (select count(*) from ctr where kind = 'apprenticeship' and status = 'under_review'),
    'approved',  (select count(*) from ctr where kind = 'apprenticeship' and status = 'approved'),
    'rejected',  (select count(*) from ctr where kind = 'apprenticeship' and status = 'rejected'),
    'changes',   (select count(*) from ctr where kind = 'apprenticeship' and status = 'modification_required')
  ),

  'internships', jsonb_build_object(
    's5_students', (select count(*) from stu where current_semester = 's5'),
    'submitted',   (select count(*) from ctr where kind = 'internship'),
    'missing',     greatest(
                     (select count(*) from stu where current_semester = 's5')
                     - (select count(distinct student_id) from ctr where kind = 'internship'), 0),
    'pending',     (select count(*) from ctr where kind = 'internship' and status = 'pending'),
    'review',      (select count(*) from ctr where kind = 'internship' and status = 'under_review'),
    'approved',    (select count(*) from ctr where kind = 'internship' and status = 'approved'),
    'rejected',    (select count(*) from ctr where kind = 'internship' and status = 'rejected'),
    'completed',   (select count(*) from ctr where kind = 'internship' and completion = 'completed'),
    'companies',   (select count(distinct company_name) from ctr where kind = 'internship'),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('location', location, 'count', n) order by n desc)
      from (
        select coalesce(nullif(location, ''), 'Non précisé') as location, count(*) as n
        from ctr where kind = 'internship' group by 1 limit 25
      ) t), '[]'::jsonb)
  )
)
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §17 — Tableau de bord national
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.stats_national()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_estabs uuid[];
  v_out    jsonb;
begin
  if not public.has_role('ministry') then
    raise exception 'réservé au ministère' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}') into v_estabs from public.establishments;

  v_out := public.stats_for_establishments(v_estabs);

  return v_out || jsonb_build_object(
    'scope', 'national',
    'wilayas', jsonb_build_object(
      'total',    (select count(*) from public.wilayas),
      'active',   (select count(*) from public.wilayas where status = 'active'),
      'with_admin', (select count(distinct wilaya_id) from public.profiles
                      where role = 'direction' and wilaya_id is not null)
    ),
    'users', jsonb_build_object(
      'total',    (select count(*) from public.profiles),
      'pending',  (select count(*) from public.profiles where status = 'pending'),
      'by_role',  coalesce((select jsonb_object_agg(role, n) from (
                    select role::text as role, count(*) as n from public.profiles group by role) t),
                  '{}'::jsonb)
    ),
    'per_wilaya', coalesce((
      select jsonb_agg(o order by o->>'name')
      from (
        select jsonb_build_object(
          'id', w.id, 'code', w.code, 'name', w.name, 'status', w.status,
          'establishments', (select count(*) from public.establishments e where e.wilaya_id = w.id),
          'students', (select count(*) from public.students s
                        join public.establishments e on e.id = s.establishment_id
                       where e.wilaya_id = w.id)
        ) as o
        from public.wilayas w
      ) t), '[]'::jsonb)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §18 — Tableau de bord de wilaya
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.stats_wilaya(p_wilaya uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_wilaya uuid := coalesce(p_wilaya, public.current_wilaya());
  v_estabs uuid[];
begin
  if v_wilaya is null then
    raise exception 'aucune wilaya associée à ce compte' using errcode = '42501';
  end if;
  perform public.assert_scope(p_wilaya => v_wilaya);

  select coalesce(array_agg(id), '{}') into v_estabs
    from public.establishments where wilaya_id = v_wilaya;

  return public.stats_for_establishments(v_estabs) || jsonb_build_object(
    'scope', 'wilaya',
    'wilaya', (select to_jsonb(w) from public.wilayas w where w.id = v_wilaya)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §19 — Tableau de bord d'établissement
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.stats_establishment(p_estab uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_estab uuid := coalesce(p_estab, public.current_establishment());
begin
  if v_estab is null then
    raise exception 'aucun établissement associé à ce compte' using errcode = '42501';
  end if;
  perform public.assert_scope(p_estab => v_estab);

  return public.stats_for_establishments(array[v_estab]) || jsonb_build_object(
    'scope', 'establishment',
    'establishment', (select to_jsonb(e) from public.establishments e where e.id = v_estab),
    'by_group', coalesce((
      select jsonb_agg(jsonb_build_object('group', name, 'count', n) order by n desc)
      from (
        select g.name, count(s.profile_id) as n
        from public.groups g
        join public.specialties sp on sp.id = g.specialty_id
        left join public.students s on s.group_id = g.id
        where sp.establishment_id = v_estab
        group by g.name
      ) t), '[]'::jsonb),
    'pending_contracts', (
      select count(*) from public.contracts
       where establishment_id = v_estab and status in ('pending', 'under_review')
    ),
    'document_requests', (
      select count(*) from public.document_requests dr
      join public.profiles p on p.id = dr.student_id
      where p.establishment_id = v_estab and dr.status = 'pending'
    )
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §15 — Synthèse du parcours d'un étudiant
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.student_overview(p_student uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student uuid := coalesce(p_student, auth.uid());
  v_estab   uuid;
  v_role    public.user_role;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  select establishment_id into v_estab from public.students where profile_id = v_student;

  if v_student <> auth.uid() then
    perform public.assert_scope(p_estab => v_estab);
  end if;

  return jsonb_build_object(
    'student', (
      select to_jsonb(s) || jsonb_build_object(
        'first_name', p.first_name, 'last_name', p.last_name, 'email', p.email,
        'establishment', (select name from public.establishments e where e.id = s.establishment_id),
        'establishment_type', (select type from public.establishments e where e.id = s.establishment_id),
        'wilaya', (select w.name from public.establishments e
                    join public.wilayas w on w.id = e.wilaya_id where e.id = s.establishment_id),
        'specialty', (select name from public.specialties sp where sp.id = s.specialty_id),
        'program', (select name from public.programs pr where pr.id = s.program_id),
        'training_mode', (select name from public.training_modes tm where tm.id = s.training_mode_id),
        'requires_contract', coalesce((select requires_contract from public.training_modes tm
                                        where tm.id = s.training_mode_id), false),
        'group', (select name from public.groups g where g.id = s.group_id)
      )
      from public.students s join public.profiles p on p.id = s.profile_id
      where s.profile_id = v_student
    ),
    'semesters', coalesce((
      select jsonb_agg(to_jsonb(ss) order by ss.semester)
      from public.student_semesters ss where ss.student_id = v_student
    ), '[]'::jsonb),
    'rule', to_jsonb(public.effective_academic_rule(v_estab)),
    'contracts', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at desc)
      from public.contracts c where c.student_id = v_student
    ), '[]'::jsonb),
    'unread_notifications', (
      select count(*) from public.notifications where user_id = v_student and read_at is null
    )
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Droits d'exécution
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.stats_for_establishments(uuid[]) from public, anon, authenticated;

grant execute on function public.stats_national()                to authenticated;
grant execute on function public.stats_wilaya(uuid)              to authenticated;
grant execute on function public.stats_establishment(uuid)       to authenticated;
grant execute on function public.student_overview(uuid)          to authenticated;
grant execute on function public.effective_academic_rule(uuid)   to authenticated;
grant execute on function public.apply_semester_decision(uuid, public.failure_decision, text) to authenticated;
grant execute on function public.recalc_student_semester(uuid, public.semester_code, text)    to authenticated;
