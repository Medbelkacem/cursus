-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Création et gestion hiérarchique des comptes (§2, §3, §6, §23)
--
--  Qui peut créer quoi (vérifié EN BASE) :
--    ministère  → direction (wilaya), admin, teacher, student, ministry
--    direction  → admin, teacher, student   (dans sa wilaya uniquement)
--    admin      → teacher, student, admin   (dans son établissement uniquement)
--
--  Remplace `admin_create_user` (conservée pour compatibilité).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.create_account(
  p_email            text,
  p_password         text,
  p_role             public.user_role,
  p_first_name       text default '',
  p_last_name        text default '',
  p_phone            text default null,
  p_establishment_id uuid default null,
  p_wilaya_id        uuid default null,
  p_direction_id     uuid default null,
  p_student_number   text default null,
  p_specialty_id     uuid default null,
  p_group_id         uuid default null,
  p_program_id       uuid default null,
  p_training_mode_id uuid default null,
  p_permissions      text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_caller       public.user_role;
  v_caller_estab uuid;
  v_caller_wil   uuid;
  v_id           uuid := gen_random_uuid();
  v_email        text := lower(trim(p_email));
  v_estab        uuid := p_establishment_id;
  v_wilaya       uuid := p_wilaya_id;
  v_perm         text;
begin
  -- 1 ─ Authentification ────────────────────────────────────────────────────
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select role, establishment_id into v_caller, v_caller_estab
    from public.profiles where id = auth.uid();
  v_caller_wil := public.current_wilaya();

  if v_caller is null then
    raise exception 'profil appelant introuvable' using errcode = '42501';
  end if;

  -- 2 ─ Autorisation hiérarchique ───────────────────────────────────────────
  if v_caller = 'ministry' then
    null;                                        -- tout est permis

  elsif v_caller = 'direction' then
    if p_role not in ('admin', 'teacher', 'student') then
      raise exception 'une direction de wilaya ne peut créer que des comptes établissement'
        using errcode = '42501';
    end if;
    if v_estab is null or not public.establishment_in_my_direction(v_estab) then
      raise exception 'établissement hors de votre wilaya' using errcode = '42501';
    end if;
    v_wilaya := v_caller_wil;

  elsif v_caller = 'admin' then
    if p_role not in ('admin', 'teacher', 'student') then
      raise exception 'un établissement ne peut créer que des comptes internes'
        using errcode = '42501';
    end if;
    if v_caller_estab is null then
      raise exception 'aucun établissement associé à votre compte' using errcode = '42501';
    end if;
    v_estab  := v_caller_estab;                  -- forcé : jamais un autre établissement
    v_wilaya := v_caller_wil;

  else
    raise exception 'votre rôle ne permet pas de créer des comptes' using errcode = '42501';
  end if;

  -- 3 ─ Validation ──────────────────────────────────────────────────────────
  if v_email = '' or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'adresse email invalide';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'le mot de passe doit faire au moins 8 caractères';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'email déjà utilisé : %', v_email using errcode = '23505';
  end if;

  if p_role in ('admin', 'teacher', 'student') and v_estab is null then
    raise exception 'un établissement est requis pour ce rôle';
  end if;
  if p_role = 'direction' and v_wilaya is null and p_direction_id is null then
    raise exception 'une wilaya est requise pour un compte de direction de wilaya';
  end if;

  -- Complète la wilaya depuis l'établissement si elle n'est pas fournie
  if v_wilaya is null and v_estab is not null then
    select wilaya_id into v_wilaya from public.establishments where id = v_estab;
  end if;

  -- 4 ─ Création dans auth.users (le trigger crée le profil) ────────────────
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object(
      'role',              p_role::text,
      'first_name',        coalesce(p_first_name, ''),
      'last_name',         coalesce(p_last_name, ''),
      'phone',             p_phone,
      'establishment_id',  v_estab,
      'direction_id',      p_direction_id,
      'student_number',    p_student_number,
      'specialty_id',      p_specialty_id,
      'preferred_language','fr'
    ),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  -- 5 ─ Complète le profil (le trigger le crée en 'pending') ────────────────
  update public.profiles
     set status           = 'active',
         first_name       = coalesce(nullif(first_name, ''), p_first_name, ''),
         last_name        = coalesce(nullif(last_name, ''),  p_last_name,  ''),
         phone            = coalesce(phone, p_phone),
         establishment_id = coalesce(establishment_id, v_estab),
         direction_id     = coalesce(direction_id, p_direction_id),
         wilaya_id        = v_wilaya
   where id = v_id;

  -- 6 ─ Lignes spécifiques au rôle ──────────────────────────────────────────
  if p_role = 'student' then
    insert into public.students as st (
      profile_id, student_number, establishment_id, specialty_id,
      group_id, program_id, training_mode_id
    )
    values (
      v_id,
      coalesce(nullif(trim(p_student_number), ''), substr(v_id::text, 1, 8)),
      v_estab, p_specialty_id, p_group_id, p_program_id, p_training_mode_id
    )
    on conflict (profile_id) do update set
      student_number   = excluded.student_number,
      specialty_id     = coalesce(excluded.specialty_id,     st.specialty_id),
      group_id         = coalesce(excluded.group_id,         st.group_id),
      program_id       = coalesce(excluded.program_id,        st.program_id),
      training_mode_id = coalesce(excluded.training_mode_id,  st.training_mode_id);

  elsif p_role = 'teacher' then
    insert into public.teachers (profile_id, establishment_id)
    values (v_id, v_estab)
    on conflict (profile_id) do nothing;
  end if;

  -- 7 ─ Permissions fines optionnelles (§6) ─────────────────────────────────
  if p_permissions is not null then
    foreach v_perm in array p_permissions loop
      insert into public.user_permissions (user_id, permission, granted_by)
      values (v_id, v_perm, auth.uid())
      on conflict (user_id, permission) do nothing;
    end loop;
  end if;

  -- 8 ─ Notification + audit (§20, §23) ─────────────────────────────────────
  perform public.notify(v_id, 'account_created', 'Bienvenue sur Cursus',
    'Votre compte a été créé par l''administration. Vous pouvez vous connecter.', '/profil');

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'account.create', 'profiles', v_id,
          jsonb_build_object('role', p_role, 'email', v_email,
                             'establishment_id', v_estab, 'wilaya_id', v_wilaya));

  return v_id;
end;
$$;

revoke all on function public.create_account(
  text, text, public.user_role, text, text, text, uuid, uuid, uuid,
  text, uuid, uuid, uuid, uuid, text[]) from public, anon;
grant execute on function public.create_account(
  text, text, public.user_role, text, text, text, uuid, uuid, uuid,
  text, uuid, uuid, uuid, uuid, text[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Activer / désactiver / refuser un compte (§2 « activate, deactivate »)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_account_status(
  p_user   uuid,
  p_status public.user_status
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.user_role;
  v_target public.profiles;
  v_out    public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'vous ne pouvez pas modifier le statut de votre propre compte'
      using errcode = '42501';
  end if;

  select role into v_caller from public.profiles where id = auth.uid();
  select *    into v_target from public.profiles where id = p_user;
  if not found then raise exception 'utilisateur introuvable'; end if;

  if v_caller = 'ministry' then
    null;
  elsif v_caller = 'direction' then
    if v_target.establishment_id is null
       or not public.establishment_in_my_direction(v_target.establishment_id) then
      raise exception 'utilisateur hors de votre wilaya' using errcode = '42501';
    end if;
  elsif v_caller = 'admin' then
    if v_target.establishment_id is distinct from public.current_establishment()
       or v_target.role not in ('student', 'teacher', 'admin') then
      raise exception 'utilisateur hors de votre établissement' using errcode = '42501';
    end if;
  else
    raise exception 'accès refusé' using errcode = '42501';
  end if;

  update public.profiles set status = p_status where id = p_user returning * into v_out;

  perform public.notify(p_user, 'account_status',
    case p_status
      when 'active'   then 'Compte activé'
      when 'rejected' then 'Compte désactivé'
      else 'Compte en attente'
    end,
    'Votre statut de compte a été mis à jour par l''administration.', '/profil');

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'account.status', 'profiles', p_user,
          jsonb_build_object('from', v_target.status, 'to', p_status));

  return v_out;
end;
$$;

grant execute on function public.set_account_status(uuid, public.user_status) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Supprimer un compte (ministère uniquement — cascade sur le profil)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.delete_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_role('ministry') then
    raise exception 'suppression réservée au ministère' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'vous ne pouvez pas supprimer votre propre compte' using errcode = '42501';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'account.delete', 'profiles', p_user,
          (select jsonb_build_object('email', email, 'role', role)
             from public.profiles where id = p_user));

  delete from auth.users where id = p_user;   -- cascade → profiles → students/teachers
end;
$$;

grant execute on function public.delete_account(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Accorder / retirer une permission fine (§6)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_permissions(p_user uuid, p_permissions text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.user_role;
  v_estab  uuid;
  v_perm   text;
begin
  select role into v_caller from public.profiles where id = auth.uid();
  select establishment_id into v_estab from public.profiles where id = p_user;

  if v_caller = 'ministry' then
    null;
  elsif v_caller = 'direction' and v_estab is not null
        and public.establishment_in_my_direction(v_estab) then
    null;
  elsif v_caller = 'admin' and v_estab = public.current_establishment() then
    null;
  else
    raise exception 'accès refusé' using errcode = '42501';
  end if;

  delete from public.user_permissions where user_id = p_user;
  if p_permissions is not null then
    foreach v_perm in array p_permissions loop
      insert into public.user_permissions (user_id, permission, granted_by)
      values (p_user, v_perm, auth.uid())
      on conflict (user_id, permission) do nothing;
    end loop;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'permissions.set', 'profiles', p_user,
          jsonb_build_object('permissions', p_permissions));
end;
$$;

grant execute on function public.set_permissions(uuid, text[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Créer une wilaya + son compte directeur en une opération (§4)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.create_wilaya_with_admin(
  p_code             text,
  p_name             text,
  p_directorate_name text default null,
  p_address          text default null,
  p_contact_email    text default null,
  p_contact_phone    text default null,
  p_admin_email      text default null,
  p_admin_password   text default null,
  p_admin_first_name text default '',
  p_admin_last_name  text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wilaya uuid;
  v_admin  uuid;
begin
  if not public.has_role('ministry') then
    raise exception 'réservé au ministère' using errcode = '42501';
  end if;

  insert into public.wilayas (code, name, directorate_name, address,
                              contact_email, contact_phone, created_by)
  values (trim(p_code), trim(p_name), p_directorate_name, p_address,
          p_contact_email, p_contact_phone, auth.uid())
  returning id into v_wilaya;

  if p_admin_email is not null and trim(p_admin_email) <> '' then
    v_admin := public.create_account(
      p_email      => p_admin_email,
      p_password   => p_admin_password,
      p_role       => 'direction',
      p_first_name => p_admin_first_name,
      p_last_name  => p_admin_last_name,
      p_wilaya_id  => v_wilaya
    );
  end if;

  return jsonb_build_object('wilaya_id', v_wilaya, 'admin_id', v_admin);
end;
$$;

grant execute on function public.create_wilaya_with_admin(
  text, text, text, text, text, text, text, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Marquer les notifications comme lues
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language sql
security definer
set search_path = public
as $$
  with upd as (
    update public.notifications
       set read_at = now()
     where user_id = auth.uid()
       and read_at is null
       and (p_ids is null or id = any(p_ids))
    returning 1
  )
  select count(*)::integer from upd
$$;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Annonce administrative diffusée à un périmètre (§20)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.broadcast_announcement(
  p_title  text,
  p_body   text,
  p_scope  text default 'national',   -- national | wilaya | establishment
  p_target uuid default null,
  p_roles  public.user_role[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller public.user_role;
  v_count  integer;
begin
  select role into v_caller from public.profiles where id = auth.uid();

  if v_caller = 'ministry' then
    null;
  elsif v_caller = 'direction' and p_scope in ('wilaya', 'establishment') then
    if p_scope = 'wilaya' and p_target is distinct from public.current_wilaya() then
      raise exception 'hors de votre wilaya' using errcode = '42501';
    end if;
    if p_scope = 'establishment' and not public.establishment_in_my_direction(p_target) then
      raise exception 'hors de votre wilaya' using errcode = '42501';
    end if;
  elsif v_caller = 'admin' and p_scope = 'establishment'
        and p_target = public.current_establishment() then
    null;
  else
    raise exception 'accès refusé' using errcode = '42501';
  end if;

  with targets as (
    select p.id
    from public.profiles p
    left join public.establishments e on e.id = p.establishment_id
    where p.status = 'active'
      and p.id <> auth.uid()
      and (p_roles is null or p.role = any(p_roles))
      and (
        p_scope = 'national'
        or (p_scope = 'wilaya'        and coalesce(p.wilaya_id, e.wilaya_id) = p_target)
        or (p_scope = 'establishment' and p.establishment_id = p_target)
      )
  ), ins as (
    insert into public.notifications (user_id, kind, title, body, created_by)
    select id, 'announcement', p_title, p_body, auth.uid() from targets
    returning 1
  )
  select count(*)::integer into v_count from ins;

  insert into public.audit_log (actor_id, action, entity, details)
  values (auth.uid(), 'announcement.broadcast', 'notifications',
          jsonb_build_object('scope', p_scope, 'target', p_target, 'recipients', v_count));

  return v_count;
end;
$$;

grant execute on function public.broadcast_announcement(
  text, text, text, uuid, public.user_role[]) to authenticated;
