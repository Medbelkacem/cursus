-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Ministère : créer un compte utilisateur (admin d'institut /
--  responsable de direction) depuis l'UI ministère, sans Edge Function ni
--  service_role key.
--
--  Le client appelle public.admin_create_user(...) via PostgREST RPC en
--  étant authentifié en tant que ministère ; la fonction s'exécute en
--  SECURITY DEFINER (rôle postgres) après avoir vérifié que l'appelant a
--  bien le rôle 'ministry'.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_create_user(
  p_email            text,
  p_password         text,
  p_role             public.user_role,
  p_first_name       text default '',
  p_last_name        text default '',
  p_phone            text default null,
  p_establishment_id uuid default null,
  p_direction_id     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_caller_role public.user_role;
  v_id          uuid := gen_random_uuid();
  v_email       text := lower(trim(p_email));
begin
  -- 1. Authorization : caller must be 'ministry' ────────────────────────────
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'ministry' then
    raise exception 'only ministry users can create accounts (caller role: %)',
      coalesce(v_caller_role::text, 'none') using errcode = '42501';
  end if;

  -- 2. Validation ───────────────────────────────────────────────────────────
  if v_email = '' or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'password must be at least 6 characters';
  end if;
  if p_role not in ('admin', 'direction') then
    raise exception 'admin_create_user can only create admin or direction accounts (got %)', p_role;
  end if;
  if p_role = 'admin' and p_establishment_id is null then
    raise exception 'establishment_id is required for an institute admin';
  end if;
  if p_role = 'direction' and p_direction_id is null then
    raise exception 'direction_id is required for a direction account';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'email already in use: %', v_email using errcode = '23505';
  end if;

  -- 3. Insert into auth.users (the trigger handle_new_user creates the profile)
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated', 'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    jsonb_build_object(
      'provider',  'email',
      'providers', jsonb_build_array('email')
    ),
    jsonb_build_object(
      'role',             p_role::text,
      'first_name',       coalesce(p_first_name, ''),
      'last_name',        coalesce(p_last_name,  ''),
      'phone',            p_phone,
      'establishment_id', p_establishment_id,
      'direction_id',     p_direction_id,
      'preferred_language','fr'
    ),
    now(), now(),
    '', '', '', ''
  );

  -- 4. Identity row (needed for password sign-in on GoTrue ≥ 2.x) ──────────
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(),
    v_id::text,
    v_id,
    jsonb_build_object(
      'sub',            v_id::text,
      'email',          v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now(), now()
  );

  -- 5. Activate the profile (trigger creates it as 'pending')
  --    Also overwrite establishment/direction in case the trigger's nullif
  --    coalescing dropped them (defensive — they should already be set).
  update public.profiles
  set status            = 'active',
      first_name        = coalesce(nullif(first_name, ''), p_first_name, ''),
      last_name         = coalesce(nullif(last_name,  ''), p_last_name,  ''),
      establishment_id  = coalesce(establishment_id, p_establishment_id),
      direction_id      = coalesce(direction_id,     p_direction_id)
  where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_create_user(text, text, public.user_role, text, text, text, uuid, uuid) from public;
grant execute on function public.admin_create_user(text, text, public.user_role, text, text, text, uuid, uuid) to authenticated;

comment on function public.admin_create_user(text, text, public.user_role, text, text, text, uuid, uuid) is
  'Ministry-only: creates an admin (institute) or direction account with a chosen email and password. The function verifies the caller has role=ministry before running.';
