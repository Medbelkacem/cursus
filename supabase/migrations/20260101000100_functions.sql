-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — fonctions utilitaires & vues
--
--  Toutes utilisées par les politiques RLS pour éviter les jointures coûteuses
--  dans les policies (qui s'exécutent à chaque ligne).
-- ═══════════════════════════════════════════════════════════════════════════

-- Rôle de l'utilisateur courant
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Statut du compte courant
create or replace function public.current_status()
returns public.user_status
language sql
stable
security definer
set search_path = public
as $$
  select status from public.profiles where id = auth.uid()
$$;

-- Établissement de l'utilisateur courant (null pour ministère/direction)
create or replace function public.current_establishment()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select establishment_id from public.profiles where id = auth.uid()
$$;

-- Direction de l'utilisateur courant (pour les rôles direction / ministère)
create or replace function public.current_direction()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select direction_id from public.profiles where id = auth.uid()
$$;

-- L'utilisateur est-il actif ?
create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status = 'active' from public.profiles where id = auth.uid()),
    false
  )
$$;

-- L'utilisateur a-t-il (au moins) ce rôle ?
create or replace function public.has_role(target public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = target from public.profiles where id = auth.uid()),
    false
  )
$$;

-- L'utilisateur courant est-il dans un de ces rôles ?
create or replace function public.has_any_role(targets public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = any(targets) from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Est-ce que l'établissement appartient à la direction de l'utilisateur ?
create or replace function public.establishment_in_my_direction(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.establishments e
    where e.id = target
      and e.direction_id = public.current_direction()
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger : créer automatiquement un profil lors d'une nouvelle inscription
-- via Supabase Auth. Lit les "user_metadata" passés lors du signup.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role := coalesce((meta->>'role')::public.user_role, 'student');
begin
  insert into public.profiles (
    id, role, first_name, last_name, phone, email,
    status, establishment_id, direction_id, preferred_language
  ) values (
    new.id,
    v_role,
    coalesce(meta->>'first_name', ''),
    coalesce(meta->>'last_name', ''),
    meta->>'phone',
    new.email,
    -- Les rôles ministère / direction sont créés manuellement par un admin
    -- du Studio Supabase. Étudiants / profs / admins passent par pending.
    case
      when v_role in ('ministry', 'direction') then 'pending'::public.user_status
      else 'pending'::public.user_status
    end,
    nullif(meta->>'establishment_id', '')::uuid,
    nullif(meta->>'direction_id', '')::uuid,
    coalesce((meta->>'preferred_language')::public.preferred_language, 'fr')
  );

  -- Si c'est un étudiant ou un professeur, créer aussi la ligne
  -- spécifique à condition que l'établissement soit fourni.
  if v_role = 'student' and (meta->>'establishment_id') is not null then
    insert into public.students (profile_id, student_number, establishment_id, specialty_id)
    values (
      new.id,
      coalesce(meta->>'student_number', new.id::text),
      (meta->>'establishment_id')::uuid,
      nullif(meta->>'specialty_id', '')::uuid
    )
    on conflict do nothing;
  elsif v_role = 'teacher' and (meta->>'establishment_id') is not null then
    insert into public.teachers (profile_id, establishment_id)
    values (new.id, (meta->>'establishment_id')::uuid)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Vue : moyenne d'un étudiant par matière
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.student_subject_averages as
select
  g.student_id,
  g.subject_id,
  s.name              as subject_name,
  s.coefficient,
  count(g.id)         as grade_count,
  round(avg(g.value)::numeric, 2) as average
from public.grades g
join public.subjects s on s.id = g.subject_id
group by g.student_id, g.subject_id, s.name, s.coefficient;

-- Moyenne pondérée globale d'un étudiant (sur toutes ses matières)
create or replace function public.student_overall_average(target uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(
    sum(avg_per_subject * coefficient) /
    nullif(sum(coefficient), 0)
  , 2)
  from (
    select
      avg(value) as avg_per_subject,
      s.coefficient
    from public.grades g
    join public.subjects s on s.id = g.subject_id
    where g.student_id = target
    group by g.subject_id, s.coefficient
  ) t
$$;

-- Taux de présence d'un étudiant (en %)
create or replace function public.student_attendance_rate(target uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when count(*) = 0 then null
    else round(
      100.0 * sum(case when status = 'present' then 1 else 0 end) / count(*),
      1
    )
  end
  from public.attendance
  where student_id = target
$$;
