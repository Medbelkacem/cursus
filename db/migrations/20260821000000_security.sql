-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Renforcement de la sécurité
--
--   • limitation du débit des tentatives de connexion, par IP et par compte
--   • jetons de réinitialisation de mot de passe à usage unique
--   • journal des connexions (réussies et échouées)
--   • politique de mot de passe appliquée en base
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Limitation du débit — une ligne par (clé, fenêtre)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists auth.rate_limits (
  bucket      text not null,          -- ex : 'login:ip:1.2.3.4'
  window_start timestamptz not null,
  hits        integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_window_idx on auth.rate_limits(window_start);

-- Incrémente et indique si la limite est franchie.
-- Fenêtre glissante approximée par des fenêtres fixes : suffisant ici et
-- très peu coûteux.
create or replace function auth.rate_limit_hit(
  p_bucket  text,
  p_limit   integer,
  p_window  interval default interval '15 minutes'
)
returns table (allowed boolean, hits integer, retry_after integer)
language plpgsql
security definer
set search_path = auth
as $$
declare
  v_start timestamptz := date_trunc('second', now())
                       - make_interval(secs => mod(extract(epoch from now())::bigint,
                                                   extract(epoch from p_window)::bigint));
  v_hits  integer;
begin
  insert into auth.rate_limits (bucket, window_start, hits)
  values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = auth.rate_limits.hits + 1
  returning auth.rate_limits.hits into v_hits;

  -- Ménage opportuniste
  if random() < 0.01 then
    delete from auth.rate_limits where window_start < now() - p_window * 4;
  end if;

  return query select v_hits <= p_limit, v_hits,
    greatest(0, extract(epoch from (v_start + p_window - now()))::integer);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Journal des connexions
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists auth.login_log (
  id         bigserial primary key,
  email      text,
  user_id    uuid references auth.users(id) on delete set null,
  success    boolean not null,
  reason     text,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists login_log_created_idx on auth.login_log(created_at desc);
create index if not exists login_log_email_idx   on auth.login_log(lower(email), created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Réinitialisation de mot de passe — jeton haché, à usage unique
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists auth.password_resets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_resets_user_idx on auth.password_resets(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Politique de mot de passe, appliquée en base pour qu'aucun chemin d'écriture
-- ne puisse la contourner (API, script d'amorçage, console psql).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function auth.check_password_policy(p_password text, p_email text default null)
returns void
language plpgsql
immutable
as $$
begin
  if p_password is null or length(p_password) < 10 then
    raise exception 'Le mot de passe doit comporter au moins 10 caractères.'
      using errcode = '22023';
  end if;
  if length(p_password) > 200 then
    raise exception 'Mot de passe trop long.' using errcode = '22023';
  end if;
  if p_password !~ '[A-Za-zÀ-ÿ]' or p_password !~ '[0-9]' then
    raise exception 'Le mot de passe doit contenir au moins une lettre et un chiffre.'
      using errcode = '22023';
  end if;
  if p_email is not null and p_email <> ''
     and lower(p_password) like '%' || lower(split_part(p_email, '@', 1)) || '%' then
    raise exception 'Le mot de passe ne doit pas contenir votre identifiant.'
      using errcode = '22023';
  end if;
  if lower(p_password) in (
    'motdepasse', 'password12', 'azerty1234', 'qwerty1234', '1234567890',
    'motdepasse1', 'password123', 'admin12345', 'cursus1234'
  ) then
    raise exception 'Ce mot de passe est trop courant.' using errcode = '22023';
  end if;
end;
$$;

-- Applique la politique à la définition de mot de passe.
create or replace function auth.set_password(p_user uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = auth, extensions
as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = p_user;
  perform auth.check_password_policy(p_password, v_email);
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
         failed_attempts = 0, locked_until = null, updated_at = now()
   where id = p_user;
end;
$$;

-- Idem pour la création de comptes depuis l'interface.
create or replace function public.assert_password_ok(p_password text, p_email text default null)
returns void
language sql
immutable
as $$ select auth.check_password_policy(p_password, p_email) $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Les tables d'authentification ne sont jamais exposées au rôle applicatif :
-- seule l'API, qui s'exécute avec le rôle propriétaire pour l'authentification,
-- y accède.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on all tables in schema auth from authenticated, anon, app_authenticated;
revoke all on schema auth from anon;
grant usage on schema auth to authenticated, app_authenticated;
grant execute on function auth.uid()   to authenticated, anon, app_authenticated;
grant execute on function auth.role()  to authenticated, anon, app_authenticated;
grant execute on function auth.email() to authenticated, app_authenticated;
