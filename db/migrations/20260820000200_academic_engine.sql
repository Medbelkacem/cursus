-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Moteur académique
--
--   • Portée par wilaya (helpers RLS)
--   • Règlement pédagogique effectif (établissement › wilaya › national)
--   • Calcul automatique des moyennes semestrielles (§11)
--   • Rattrapage, validation et progression S1 → S5
--   • Notifications automatiques (§20)
--
--  AUCUNE règle n'est codée en dur : les seuils et la décision en cas d'échec
--  au rattrapage proviennent de `public.academic_rules`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers de portée
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.current_wilaya()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.wilaya_id from public.profiles p where p.id = auth.uid()),
    (select e.wilaya_id
       from public.profiles p
       join public.establishments e on e.id = p.establishment_id
      where p.id = auth.uid()),
    (select d.wilaya_id
       from public.profiles p
       join public.directions d on d.id = p.direction_id
      where p.id = auth.uid())
  )
$$;

-- Un établissement est-il dans le périmètre du responsable de wilaya /
-- de direction courant ?  (rétro-compatible : direction_id OU wilaya_id)
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
      and (
        (public.current_direction() is not null and e.direction_id = public.current_direction())
        or
        (public.current_wilaya() is not null and e.wilaya_id = public.current_wilaya())
      )
  )
$$;

comment on function public.establishment_in_my_direction(uuid) is
  'Vrai si l''établissement appartient à la direction OU à la wilaya de l''utilisateur courant.';

-- L'utilisateur courant possède-t-il cette permission fine ?
create or replace function public.has_permission(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_permissions up
    where up.user_id = auth.uid() and up.permission = p
  )
$$;

-- Établissement d'un étudiant (utilisé par les policies contrats / stages)
create or replace function public.student_establishment(target uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select establishment_id from public.students where profile_id = target
$$;

-- Peut-on agir sur le dossier académique de cet étudiant ?
--   ministère · direction de sa wilaya · admin ou professeur de son établissement.
create or replace function public.can_manage_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.has_role('ministry') then true
    when public.has_role('direction')
      then public.establishment_in_my_direction(public.student_establishment(p_student))
    when public.has_any_role(array['admin', 'teacher']::public.user_role[])
      then public.student_establishment(p_student) = public.current_establishment()
    else false
  end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Règlement pédagogique effectif
--   Priorité : établissement › wilaya › national › valeurs par défaut.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.academic_rule_effective as (
    source              text,
    label               text,
    pass_mark           numeric,
    resit_pass_mark     numeric,
    auto_progress       boolean,
    auto_resit          boolean,
    on_resit_failure    public.failure_decision,
    max_repeats         smallint,
    min_attendance_rate numeric
  );
exception when duplicate_object then null; end $$;

create or replace function public.effective_academic_rule(p_establishment uuid default null)
returns public.academic_rule_effective
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r        public.academic_rules;
  v_wilaya uuid;
  v_src    text;
begin
  if p_establishment is not null then
    select e.wilaya_id into v_wilaya from public.establishments e where e.id = p_establishment;

    select * into r from public.academic_rules
     where active and scope = 'establishment' and establishment_id = p_establishment
     limit 1;
    if found then v_src := 'establishment'; end if;

    if v_src is null and v_wilaya is not null then
      select * into r from public.academic_rules
       where active and scope = 'wilaya' and wilaya_id = v_wilaya
       limit 1;
      if found then v_src := 'wilaya'; end if;
    end if;
  end if;

  if v_src is null then
    select * into r from public.academic_rules
     where active and scope = 'national'
     limit 1;
    if found then v_src := 'national'; end if;
  end if;

  if v_src is null then
    -- Aucun règlement enregistré → valeurs neutres. Jamais d'exclusion
    -- automatique : la décision reste manuelle tant que rien n'est configuré.
    return row(
      'default',
      'Défaut (aucun règlement enregistré)',
      10::numeric, 10::numeric,
      true, true,
      'manual_review'::public.failure_decision,
      1::smallint,
      null::numeric
    )::public.academic_rule_effective;
  end if;

  return row(
    v_src, r.label,
    r.pass_mark, r.resit_pass_mark,
    r.auto_progress, r.auto_resit,
    r.on_resit_failure, r.max_repeats,
    r.min_attendance_rate
  )::public.academic_rule_effective;
end;
$$;

comment on function public.effective_academic_rule(uuid) is
  'Règlement pédagogique applicable : établissement › wilaya › national › défaut neutre.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.notify(
  p_user  uuid,
  p_kind  public.notification_kind,
  p_title text,
  p_body  text default null,
  p_link  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_user is null then return null; end if;
  insert into public.notifications (user_id, kind, title, body, link, created_by)
  values (p_user, p_kind, p_title, p_body, p_link, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Moyennes : par matière puis pondérée par coefficient
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.semester_average(
  p_student  uuid,
  p_semester public.semester_code,
  p_resit    boolean default false
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(
    sum(sub_avg * coefficient) / nullif(sum(coefficient), 0)
  , 2)
  from (
    select avg(g.value) as sub_avg, s.coefficient
    from public.grades g
    join public.subjects s on s.id = g.subject_id
    where g.student_id = p_student
      and coalesce(g.semester, s.semester) = p_semester
      and g.is_resit = p_resit
    group by g.subject_id, s.coefficient
  ) t
$$;

create or replace function public.semester_attendance_rate(
  p_student  uuid,
  p_semester public.semester_code
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 0 then null else
    round(100.0 * sum(case when a.status = 'present' then 1 else 0 end) / count(*), 1)
  end
  from public.attendance a
  join public.subjects s on s.id = a.subject_id
  where a.student_id = p_student and s.semester = p_semester
$$;

-- Crédits obtenus (matières dont la moyenne atteint le seuil)
create or replace function public.semester_credits(
  p_student  uuid,
  p_semester public.semester_code,
  p_pass     numeric
)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(credits), 0)::smallint
  from (
    select s.credits, avg(g.value) as sub_avg
    from public.grades g
    join public.subjects s on s.id = g.subject_id
    where g.student_id = p_student
      and coalesce(g.semester, s.semester) = p_semester
      and s.credits is not null
    group by s.id, s.credits
  ) t
  where sub_avg >= p_pass
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Recalcul du relevé semestriel  (§11)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.recalc_student_semester(
  p_student  uuid,
  p_semester public.semester_code,
  p_year     text default null
)
returns public.student_semesters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule     public.academic_rule_effective;
  v_estab    uuid;
  v_year     text;
  v_avg      numeric;
  v_resit    numeric;
  v_final    numeric;
  v_att      numeric;
  v_credits  smallint;
  v_status   public.semester_status;
  v_decision public.failure_decision;
  row_out    public.student_semesters;
  had_resit  boolean;
  prev_status public.semester_status;
begin
  if p_student <> auth.uid() and not public.can_manage_student(p_student) then
    raise exception 'accès refusé au dossier de cet étudiant' using errcode = '42501';
  end if;

  select establishment_id into v_estab from public.students where profile_id = p_student;
  v_rule := public.effective_academic_rule(v_estab);

  v_year := coalesce(
    p_year,
    (select academic_year from public.student_semesters
      where student_id = p_student and semester = p_semester
      order by created_at desc limit 1),
    ''
  );

  v_avg     := public.semester_average(p_student, p_semester, false);
  v_resit   := public.semester_average(p_student, p_semester, true);
  v_att     := public.semester_attendance_rate(p_student, p_semester);
  v_credits := public.semester_credits(p_student, p_semester, v_rule.pass_mark);
  had_resit := v_resit is not null;

  -- Après rattrapage, c'est la note de rattrapage qui décide (§11).
  v_final := coalesce(v_resit, v_avg);

  if v_avg is null then
    v_status := 'in_progress';
  elsif v_avg >= v_rule.pass_mark then
    v_status := 'validated';
  elsif not had_resit then
    v_status := case when v_rule.auto_resit then 'pending_resit'::public.semester_status
                     else 'in_progress'::public.semester_status end;
  elsif v_resit >= v_rule.resit_pass_mark then
    v_status := 'validated';
  else
    v_status := 'resit_failed';
    v_decision := v_rule.on_resit_failure;
  end if;

  select status into prev_status from public.student_semesters
   where student_id = p_student and semester = p_semester and academic_year = v_year;

  insert into public.student_semesters as ss (
    student_id, semester, academic_year, average, resit_average, final_average,
    credits_earned, attendance_rate, status, decision,
    validated_at
  ) values (
    p_student, p_semester, v_year, v_avg, v_resit, v_final,
    v_credits, v_att, v_status, v_decision,
    case when v_status = 'validated' then now() else null end
  )
  on conflict (student_id, semester, academic_year) do update set
    average         = excluded.average,
    resit_average   = excluded.resit_average,
    final_average   = excluded.final_average,
    credits_earned  = excluded.credits_earned,
    attendance_rate = excluded.attendance_rate,
    -- une décision administrative déjà prise (redoublement / exclusion) n'est
    -- jamais écrasée par un simple recalcul
    status          = case when ss.status in ('repeating', 'dismissed') then ss.status
                           else excluded.status end,
    decision        = coalesce(excluded.decision, ss.decision),
    validated_at    = case when excluded.status = 'validated'
                           then coalesce(ss.validated_at, now()) else ss.validated_at end
  returning * into row_out;

  -- Progression automatique + notifications ────────────────────────────────
  if row_out.status = 'validated' and prev_status is distinct from 'validated' then
    if v_rule.auto_progress then
      perform public.progress_student(p_student, p_semester);
    end if;
    perform public.notify(
      p_student, 'semester_validated',
      'Semestre ' || upper(p_semester::text) || ' validé',
      'Moyenne : ' || to_char(v_final, 'FM990.00') || '/20.',
      '/etudiant/parcours'
    );
  elsif row_out.status = 'pending_resit' and prev_status is distinct from 'pending_resit' then
    perform public.notify(
      p_student, 'resit_exam',
      'Rattrapage — semestre ' || upper(p_semester::text),
      'Moyenne : ' || to_char(v_avg, 'FM990.00') || '/20 (seuil ' ||
        to_char(v_rule.pass_mark, 'FM990.00') || '). Un examen de rattrapage est requis.',
      '/etudiant/parcours'
    );
  elsif row_out.status = 'resit_failed' and prev_status is distinct from 'resit_failed' then
    perform public.notify(
      p_student, 'resit_exam',
      'Rattrapage non validé — semestre ' || upper(p_semester::text),
      'Décision applicable : ' || coalesce(v_decision::text, 'examen par l''administration') || '.',
      '/etudiant/parcours'
    );
  end if;

  return row_out;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Progression S1 → S5 → diplômé
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.next_semester(p public.semester_code)
returns public.semester_code
language sql
immutable
as $$
  select case p
    when 's1' then 's2'::public.semester_code
    when 's2' then 's3'::public.semester_code
    when 's3' then 's4'::public.semester_code
    when 's4' then 's5'::public.semester_code
    else null
  end
$$;

create or replace function public.progress_student(
  p_student  uuid,
  p_from     public.semester_code
)
returns public.semester_code
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next    public.semester_code;
  v_current public.semester_code;
begin
  select current_semester into v_current from public.students where profile_id = p_student;
  -- On ne fait progresser que si l'étudiant est bien sur le semestre validé.
  if v_current is distinct from p_from then return v_current; end if;

  v_next := public.next_semester(p_from);

  if v_next is null then
    -- S5 validé → fin de cursus
    update public.students
       set enrollment_status = 'graduated'
     where profile_id = p_student;
    perform public.notify(p_student, 'semester_validated', 'Cursus terminé',
      'Le semestre S5 est validé : votre formation est achevée.', '/etudiant/parcours');
    return p_from;
  end if;

  update public.students
     set current_semester  = v_next,
         enrollment_status = case when enrollment_status = 'repeating' then 'enrolled'
                                  else enrollment_status end
   where profile_id = p_student;

  -- Ouvre le relevé du semestre suivant
  insert into public.student_semesters (student_id, semester, academic_year, status)
  select p_student, v_next,
         coalesce((select academic_year from public.student_semesters
                    where student_id = p_student and semester = p_from
                    order by created_at desc limit 1), ''),
         'in_progress'
  on conflict (student_id, semester, academic_year) do nothing;

  -- S5 → rappel du stage pratique obligatoire (§13)
  if v_next = 's5' then
    perform public.notify(p_student, 'internship_deadline',
      'Stage pratique S5 requis',
      'Le semestre S5 comporte un stage pratique obligatoire. Déposez votre convention de stage.',
      '/etudiant/stage');
  end if;

  return v_next;
end;
$$;

-- Décision administrative après échec au rattrapage (§11)
create or replace function public.apply_semester_decision(
  p_semester_row uuid,
  p_decision     public.failure_decision,
  p_note         text default null
)
returns public.student_semesters
language plpgsql
security definer
set search_path = public
as $$
declare
  ss      public.student_semesters;
  row_out public.student_semesters;
begin
  select * into ss from public.student_semesters where id = p_semester_row;
  if not found then raise exception 'relevé semestriel introuvable'; end if;

  -- §23 : décision réservée à l'administration compétente, vérifiée côté serveur.
  if not public.can_manage_student(ss.student_id) or public.has_role('teacher') then
    raise exception 'seule l''administration peut prononcer une décision pédagogique'
      using errcode = '42501';
  end if;

  update public.student_semesters
     set decision      = p_decision,
         decision_note = p_note,
         decided_by    = auth.uid(),
         status        = case p_decision
                           when 'repeat_semester'    then 'repeating'::public.semester_status
                           when 'stay_same_semester' then 'repeating'::public.semester_status
                           when 'dismiss'            then 'dismissed'::public.semester_status
                           else status
                         end
   where id = p_semester_row
  returning * into row_out;

  if p_decision = 'dismiss' then
    update public.students set enrollment_status = 'dismissed' where profile_id = ss.student_id;
    perform public.notify(ss.student_id, 'announcement', 'Décision pédagogique',
      coalesce(p_note, 'Exclusion pédagogique prononcée.'), '/etudiant/parcours');
  elsif p_decision in ('repeat_semester', 'stay_same_semester') then
    update public.students
       set enrollment_status = 'repeating', current_semester = ss.semester
     where profile_id = ss.student_id;
    perform public.notify(ss.student_id, 'announcement', 'Décision pédagogique',
      coalesce(p_note, 'Redoublement du semestre ' || upper(ss.semester::text) || '.'),
      '/etudiant/parcours');
  end if;

  return row_out;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Déclencheurs : recalcul automatique à chaque note saisie / modifiée
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.grades_recalc_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student  uuid;
  v_semester public.semester_code;
begin
  v_student := coalesce(new.student_id, old.student_id);
  v_semester := coalesce(
    new.semester, old.semester,
    (select s.semester from public.subjects s where s.id = coalesce(new.subject_id, old.subject_id))
  );
  if v_student is not null and v_semester is not null then
    perform public.recalc_student_semester(v_student, v_semester);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists grades_recalc on public.grades;
create trigger grades_recalc
  after insert or update or delete on public.grades
  for each row execute function public.grades_recalc_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- Déclencheurs : contrats d'apprentissage & stages (§9, §14, §20)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.contracts_workflow_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := case when new.kind = 'apprenticeship'
                       then 'Contrat d''apprentissage' else 'Convention de stage' end;
  v_link  text := case when new.kind = 'apprenticeship'
                       then '/etudiant/apprentissage' else '/etudiant/stage' end;
begin
  if TG_OP = 'INSERT' then
    insert into public.contract_reviews (contract_id, from_status, to_status, comment, reviewer_id)
    values (new.id, null, new.status, 'Dépôt initial', new.student_id);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.contract_reviews (contract_id, from_status, to_status, comment, reviewer_id)
    values (new.id, old.status, new.status, new.review_comment, auth.uid());

    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
    new.reviewed_at := now();

    if new.status = 'approved' then
      perform public.notify(new.student_id, 'contract_approved',
        v_label || ' approuvé', 'Votre dossier a été validé par l''administration.', v_link);
    elsif new.status = 'rejected' then
      perform public.notify(new.student_id, 'contract_rejected',
        v_label || ' refusé', coalesce(new.review_comment, 'Consultez les commentaires de l''administration.'), v_link);
    elsif new.status = 'modification_required' then
      perform public.notify(new.student_id, 'contract_modification',
        v_label || ' — modification demandée',
        coalesce(new.review_comment, 'Des modifications sont requises avant validation.'), v_link);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_workflow on public.contracts;
create trigger contracts_workflow
  before update on public.contracts
  for each row execute function public.contracts_workflow_trigger();

drop trigger if exists contracts_workflow_ins on public.contracts;
create trigger contracts_workflow_ins
  after insert on public.contracts
  for each row execute function public.contracts_workflow_trigger();

-- Renseigne automatiquement l'établissement du contrat depuis l'étudiant
create or replace function public.contracts_fill_establishment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.establishment_id is null then
    new.establishment_id := public.student_establishment(new.student_id);
  end if;
  if new.kind = 'internship' and new.semester is null then
    new.semester := 's5';
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_fill on public.contracts;
create trigger contracts_fill
  before insert on public.contracts
  for each row execute function public.contracts_fill_establishment();

-- ─────────────────────────────────────────────────────────────────────────────
-- Publication d'un programme → notification aux étudiants concernés (§20)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.programs_publish_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := coalesce(new.published_at, now());
    insert into public.notifications (user_id, kind, title, body, link, created_by)
    select st.profile_id, 'program_published',
           'Programme publié — ' || new.name,
           'Le programme de formation est disponible dans votre espace.',
           '/etudiant/programme', auth.uid()
    from public.students st
    where st.program_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists programs_publish on public.programs;
create trigger programs_publish
  before update on public.programs
  for each row execute function public.programs_publish_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- Ouverture du relevé S1 à l'inscription d'un étudiant
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.students_bootstrap_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_semesters (student_id, semester, academic_year, status)
  values (new.profile_id, new.current_semester, '', 'in_progress')
  on conflict (student_id, semester, academic_year) do nothing;
  return new;
end;
$$;

drop trigger if exists students_bootstrap on public.students;
create trigger students_bootstrap
  after insert on public.students
  for each row execute function public.students_bootstrap_trigger();
