-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Durcissement du cloisonnement (§3, §23)
--
--  Avant : « estab: read all (everyone) » laissait tout compte authentifié
--  lire l'annuaire complet des établissements — y compris une direction de
--  wilaya lisant ceux d'une autre wilaya.
--
--  Après : lecture strictement cloisonnée. Le formulaire d'inscription
--  publique passe par une RPC dédiée qui n'expose que l'annuaire minimal
--  (nom, code, type, wilaya) — jamais les coordonnées ni les rattachements.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "estab: read all (everyone)" on public.establishments;
drop policy if exists "estab: ministry reads all"  on public.establishments;
drop policy if exists "estab: direction reads own" on public.establishments;
drop policy if exists "estab: member reads own"    on public.establishments;

create policy "estab: ministry reads all"
  on public.establishments for select
  using (public.has_role('ministry'));

create policy "estab: direction reads own"
  on public.establishments for select
  using (public.has_role('direction') and public.establishment_in_my_direction(id));

-- Personnel et étudiants : uniquement leur propre établissement
create policy "estab: member reads own"
  on public.establishments for select
  using (id = public.current_establishment());

-- ─────────────────────────────────────────────────────────────────────────────
-- Annuaire public minimal — utilisé par le formulaire d'inscription
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.public_establishments()
returns table (id uuid, name text, code text, type text, wilaya_name text, wilaya_code text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.name, e.code, e.type::text, w.name, w.code
  from public.establishments e
  left join public.wilayas w on w.id = e.wilaya_id
  where e.status = 'active'
  order by w.code nulls last, e.name
$$;

grant execute on function public.public_establishments() to anon, authenticated;

create or replace function public.public_wilayas()
returns table (id uuid, code text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.code, w.name
  from public.wilayas w
  where w.status = 'active'
  order by w.code
$$;

grant execute on function public.public_wilayas() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Wilayas : nomenclature nationale, lisible par tout compte authentifié, mais
-- une direction ne peut modifier que la sienne (déjà couvert par rls_v2).
-- ─────────────────────────────────────────────────────────────────────────────

comment on table public.wilayas is
  'Nomenclature nationale des wilayas. Lecture ouverte aux comptes authentifiés ; écriture réservée au ministère (une direction peut mettre à jour les coordonnées de sa propre wilaya).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Recherche transversale (§21) — respecte le périmètre de l'appelant, car la
-- fonction s'exécute SECURITY INVOKER : les policies ci-dessus s'appliquent.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.search_students(
  p_query      text default null,
  p_wilaya     uuid default null,
  p_estab      uuid default null,
  p_type       public.establishment_type default null,
  p_specialty  uuid default null,
  p_program    uuid default null,
  p_mode       uuid default null,
  p_semester   public.semester_code default null,
  p_enrollment public.student_enrollment_status default null,
  p_academic   public.semester_status default null,
  p_contract   public.contract_status default null,
  p_limit      integer default 200,
  p_offset     integer default 0
)
returns table (
  profile_id       uuid,
  student_number   text,
  first_name       text,
  last_name        text,
  email            text,
  establishment    text,
  establishment_id uuid,
  wilaya           text,
  specialty        text,
  program          text,
  training_mode    text,
  semester         public.semester_code,
  enrollment       public.student_enrollment_status,
  semester_status  public.semester_status,
  average          numeric,
  contract_status  public.contract_status,
  internship_status public.contract_status
)
language sql
stable
as $$
  select
    s.profile_id,
    s.student_number,
    p.first_name,
    p.last_name,
    p.email,
    e.name,
    e.id,
    w.name,
    sp.name,
    pr.name,
    tm.name,
    s.current_semester,
    s.enrollment_status,
    ss.status,
    ss.final_average,
    (select c.status from public.contracts c
      where c.student_id = s.profile_id and c.kind = 'apprenticeship'
      order by c.created_at desc limit 1),
    (select c.status from public.contracts c
      where c.student_id = s.profile_id and c.kind = 'internship'
      order by c.created_at desc limit 1)
  from public.students s
  join public.profiles p        on p.id  = s.profile_id
  left join public.establishments e on e.id = s.establishment_id
  left join public.wilayas w        on w.id = e.wilaya_id
  left join public.specialties sp   on sp.id = s.specialty_id
  left join public.programs pr      on pr.id = s.program_id
  left join public.training_modes tm on tm.id = s.training_mode_id
  left join public.student_semesters ss
         on ss.student_id = s.profile_id and ss.semester = s.current_semester
  where (p_query is null or p_query = '' or (
          p.first_name     ilike '%' || p_query || '%'
       or p.last_name      ilike '%' || p_query || '%'
       or p.email          ilike '%' || p_query || '%'
       or s.student_number ilike '%' || p_query || '%'))
    and (p_wilaya     is null or e.wilaya_id = p_wilaya)
    and (p_estab      is null or s.establishment_id = p_estab)
    and (p_type       is null or e.type = p_type)
    and (p_specialty  is null or s.specialty_id = p_specialty)
    and (p_program    is null or s.program_id = p_program)
    and (p_mode       is null or s.training_mode_id = p_mode)
    and (p_semester   is null or s.current_semester = p_semester)
    and (p_enrollment is null or s.enrollment_status = p_enrollment)
    and (p_academic   is null or ss.status = p_academic)
    and (p_contract   is null or exists (
          select 1 from public.contracts c
           where c.student_id = s.profile_id and c.status = p_contract))
  order by p.last_name, p.first_name
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
  offset greatest(0, coalesce(p_offset, 0))
$$;

grant execute on function public.search_students(
  text, uuid, uuid, public.establishment_type, uuid, uuid, uuid,
  public.semester_code, public.student_enrollment_status, public.semester_status,
  public.contract_status, integer, integer) to authenticated;

comment on function public.search_students is
  'Recherche multicritère (§21). SECURITY INVOKER : le cloisonnement RLS de l''appelant s''applique automatiquement.';
